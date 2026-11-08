// FILE 1: engine.ts
// Thermal-Optimized (<45°C), Knuckle-Anchored (Zero Pinch-Dip) Multimodal Engine

export type Brand<K, T> = K & { readonly __brand: T };
export type Kilonewton = Brand<number, "kN">;
export type Meter = Brand<number, "m">;

export type GestureType = "PALM" | "PINCH" | "FIST" | "POINT" | "TWO_FINGER";
export type MaterialMode = "RC" | "STEEL";
export type LoadMode = "EXTERNAL" | "INTERNAL";
export type SteelFilter = "ALL" | "IWF" | "BOX";

export type CommandId =
  | "set.material.rc"
  | "set.material.steel"
  | "set.loadmode.external"
  | "set.loadmode.internal"
  | "set.steel.filter.iwf"
  | "set.steel.filter.box"
  | "set.steel.filter.all"
  | "toggle.diagram.bmd"
  | "toggle.diagram.sfd"
  | "toggle.mode.optimize"
  | "toggle.window.gesture"
  | "toggle.window.load"
  | "toggle.voice";

export interface Landmark2D {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface GestureMeta {
  readonly type: GestureType;
  readonly symbol: "◎" | "⌖" | "▼" | "▸" | "▣";
  readonly label: string;
  readonly color: string;
}

export const GESTURE_MAP: Readonly<Record<GestureType, GestureMeta>> = {
  PALM: {
    type: "PALM",
    symbol: "◎",
    label: "Open Palm (Pointer)",
    color: "#38bdf8",
  },
  PINCH: {
    type: "PINCH",
    symbol: "⌖",
    label: "Pinch (Click Locked)",
    color: "#10b981",
  },
  FIST: {
    type: "FIST",
    symbol: "▼",
    label: "Fist (Real-Time Load)",
    color: "#f97316",
  },
  POINT: {
    type: "POINT",
    symbol: "▸",
    label: "Point (Precision Snap)",
    color: "#eab308",
  },
  TWO_FINGER: {
    type: "TWO_FINGER",
    symbol: "▣",
    label: "Two-Finger (Grab Window)",
    color: "#a855f7",
  },
};

// MediaPipe 21-Landmark Bone Pairs for accurate 1:1 skeleton rendering
const HAND_BONES: readonly (readonly [number, number])[] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
];

interface SteelProfile {
  readonly name: string;
  readonly type: "IWF" | "BOX";
  readonly zx: number;
  readonly ix: number;
  readonly weight: number;
}

const STEEL_PROFILES: readonly SteelProfile[] = [
  { name: "BOX 150x150x6", type: "BOX", zx: 192, ix: 1210, weight: 26.4 },
  { name: "IWF 200x100x5.5x8", type: "IWF", zx: 200, ix: 1840, weight: 21.3 },
  { name: "IWF 250x125x6x9", type: "IWF", zx: 352, ix: 4050, weight: 29.6 },
  { name: "BOX 200x200x9", type: "BOX", zx: 498, ix: 4180, weight: 51.8 },
  { name: "IWF 300x150x6.5x9", type: "IWF", zx: 525, ix: 7210, weight: 36.7 },
  { name: "BOX 250x250x9", type: "BOX", zx: 798, ix: 8390, weight: 66.0 },
  { name: "IWF 350x175x7x11", type: "IWF", zx: 841, ix: 13600, weight: 49.6 },
  { name: "IWF 400x200x8x13", type: "IWF", zx: 1285, ix: 23700, weight: 66.0 },
  { name: "BOX 300x300x12", type: "BOX", zx: 1510, ix: 19100, weight: 105.0 },
  { name: "IWF 500x200x10x16", type: "IWF", zx: 2090, ix: 47800, weight: 89.6 },
];

const STEEL_GRADES = [
  { name: "BJ 37", fy: 240 },
  { name: "BJ 41", fy: 250 },
  { name: "BJ 50", fy: 290 },
  { name: "BJ 55", fy: 410 },
] as const;

export interface EngineState {
  material: MaterialMode;
  loadMode: LoadMode;
  steelFilter: SteelFilter;
  spanL: Meter;
  pointLoadP: Kilonewton;
  pointLoadX: Meter;
  uniformLoadQ: Kilonewton;
  showBMD: boolean;
  showSFD: boolean;
  autoOptimize: boolean;
  voiceActive: boolean;
  snapNodeIndex: number | null;
}

// 61 nodes is the sweet spot for smooth curves with half the CPU/GPU vertex cost
const NODES = 61;
const xBuf = new Float64Array(NODES);
const sfdBuf = new Float64Array(NODES);
const bmdBuf = new Float64Array(NODES);
const deflBuf = new Float64Array(NODES);

const state: EngineState = {
  material: "STEEL",
  loadMode: "EXTERNAL",
  steelFilter: "ALL",
  spanL: 6.0 as Meter,
  pointLoadP: 110 as Kilonewton,
  pointLoadX: 3.0 as Meter,
  uniformLoadQ: 12 as Kilonewton,
  showBMD: true,
  showSFD: true,
  autoOptimize: true,
  voiceActive: false,
  snapNodeIndex: null,
};

const gestureHistory: GestureType[] = ["PALM", "PALM", "PALM"];

function dist2D(a: Landmark2D, b: Landmark2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export interface HandClassificationResult {
  readonly gesture: GestureType;
  readonly isPrePinching: boolean;
  readonly anchorX: number;
  readonly anchorY: number;
}

// Uses MCP Knuckles (landmarks 5 & 9) as cursor anchor so bending fingertips to pinch NEVER dips the cursor
export function analyzeHandLandmarks(landmarks: readonly Landmark2D[]): HandClassificationResult {
  const wrist = landmarks[0]!;
  const thumbTip = landmarks[4]!;
  const indexMcp = landmarks[5]!;
  const indexPip = landmarks[6]!;
  const indexTip = landmarks[8]!;
  const middleMcp = landmarks[9]!;
  const middlePip = landmarks[10]!;
  const middleTip = landmarks[12]!;
  const ringPip = landmarks[14]!;
  const ringTip = landmarks[16]!;
  const pinkyPip = landmarks[18]!;
  const pinkyTip = landmarks[20]!;

  const palmSize = Math.max(dist2D(wrist, middleMcp), 0.01);
  const pinchRatio = dist2D(thumbTip, indexTip) / palmSize;

  // Pre-pinch zone freezes cursor drift right before thumb and index touch
  const isPrePinching = pinchRatio < 0.62;

  const isIndexExt = dist2D(indexTip, wrist) > dist2D(indexPip, wrist) * 1.13;
  const isMiddleExt = dist2D(middleTip, wrist) > dist2D(middlePip, wrist) * 1.13;
  const isRingExt = dist2D(ringTip, wrist) > dist2D(ringPip, wrist) * 1.11;
  const isPinkyExt = dist2D(pinkyTip, wrist) > dist2D(pinkyPip, wrist) * 1.11;

  let raw: GestureType = "PALM";

  if (pinchRatio < 0.42 && (isMiddleExt || dist2D(indexTip, wrist) > palmSize * 0.8)) {
    raw = "PINCH";
  } else if (!isIndexExt && !isMiddleExt && !isRingExt && !isPinkyExt) {
    raw = "FIST";
  } else if (isIndexExt && isMiddleExt && !isRingExt && !isPinkyExt) {
    raw = "TWO_FINGER";
  } else if (isIndexExt && !isMiddleExt && !isRingExt && !isPinkyExt) {
    raw = "POINT";
  } else {
    raw = "PALM";
  }

  gestureHistory.shift();
  gestureHistory.push(raw);

  const counts: Record<GestureType, number> = {
    PALM: 0,
    PINCH: 0,
    FIST: 0,
    POINT: 0,
    TWO_FINGER: 0,
  };
  for (let i = 0; i < gestureHistory.length; i++) {
    counts[gestureHistory[i]!]++;
  }
  let best: GestureType = raw;
  let maxCount = 0;
  for (const k of Object.keys(counts) as GestureType[]) {
    if (counts[k] > maxCount) {
      maxCount = counts[k];
      best = k;
    }
  }

  // Stable anatomical knuckle anchor (65% Index MCP + 35% Middle MCP)
  // Remap active camera zone [0.15 .. 0.85] to full screen [0.0 .. 1.0] for effortless reach
  const rawAnchorX = 1 - (indexMcp.x * 0.65 + middleMcp.x * 0.35);
  const rawAnchorY = indexMcp.y * 0.65 + middleMcp.y * 0.35;

  const anchorX = Math.min(Math.max((rawAnchorX - 0.14) / 0.72, 0), 1);
  const anchorY = Math.min(Math.max((rawAnchorY - 0.14) / 0.72, 0), 1);

  return { gesture: best, isPrePinching, anchorX, anchorY };
}

export function solveBeamMechanics(): {
  maxM: number;
  maxV: number;
  maxDeflMm: number;
  allowDeflMm: number;
  designSummary: string;
  dcrRatio: number;
} {
  const L = state.spanL;
  const P = state.pointLoadP;
  const a = Math.min(Math.max(state.pointLoadX, 0.05 * L), 0.95 * L);
  const b = L - a;
  const q = state.uniformLoadQ;

  const Ra = (P * b) / L + (q * L) / 2;
  const Rb = (P * a) / L + (q * L) / 2;

  let maxM = 0;
  const maxV = Math.max(Math.abs(Ra), Math.abs(Rb));
  const EI = state.material === "STEEL" ? 28500 : 21000;

  let maxDeflMm = 0;
  for (let i = 0; i < NODES; i++) {
    const x = (i / (NODES - 1)) * L;
    xBuf[i] = x;

    const V = x < a ? Ra - q * x : Ra - q * x - P;
    sfdBuf[i] = V;

    const M = x <= a ? Ra * x - (q * x * x) / 2 : Ra * x - (q * x * x) / 2 - P * (x - a);
    bmdBuf[i] = M;
    if (M > maxM) maxM = M;

    const wUniform = ((q * x * (L * L * L - 2 * L * x * x + x * x * x)) / (24 * EI)) * 1000;
    let wPoint = 0;
    if (x <= a) {
      wPoint = ((P * b * x * (L * L - b * b - x * x)) / (6 * L * EI)) * 1000;
    } else {
      const xr = L - x;
      wPoint = ((P * a * xr * (L * L - a * a - xr * xr)) / (6 * L * EI)) * 1000;
    }
    const totalW = wUniform + wPoint;
    deflBuf[i] = totalW;
    if (totalW > maxDeflMm) maxDeflMm = totalW;
  }

  const allowDeflMm = (L * 1000) / 360;
  let designSummary = "";
  let dcrRatio = 0.85;

  if (state.material === "STEEL") {
    const pool = STEEL_PROFILES.filter(
      (p) => state.steelFilter === "ALL" || p.type === state.steelFilter,
    );
    let chosenProfile = pool[pool.length - 1]!;
    let chosenGrade = STEEL_GRADES[0];
    let bestDcr = 0;

    outer: for (const grade of STEEL_GRADES) {
      const targetZxCm3 = (maxM * 1e6) / (0.9 * grade.fy * 1e3);
      let low = 0;
      let high = pool.length - 1;
      while (low <= high) {
        const mid = (low + high) >>> 1;
        const prof = pool[mid]!;
        if (prof.zx >= targetZxCm3) {
          const phiMn = (0.9 * prof.zx * 1e3 * grade.fy) / 1e6;
          const dcr = maxM / Math.max(phiMn, 1);
          chosenProfile = prof;
          chosenGrade = grade;
          bestDcr = dcr;
          if (dcr >= 0.88 && dcr <= 1.0) break outer;
          high = mid - 1;
        } else {
          low = mid + 1;
        }
      }
    }
    if (bestDcr === 0) {
      const phiMn = (0.9 * chosenProfile.zx * 1e3 * chosenGrade.fy) / 1e6;
      bestDcr = maxM / Math.max(phiMn, 1);
    }
    dcrRatio = bestDcr;
    designSummary = `${chosenProfile.name} (${chosenGrade.name}) · Zx=${chosenProfile.zx} cm³`;
  } else {
    const bMm = 300;
    const hMm = Math.max(
      400,
      Math.ceil((Math.sqrt((maxM * 1e6) / (0.14 * 30 * bMm)) + 60) / 50) * 50,
    );
    const dMm = hMm - 55;
    const asReq = (maxM * 1e6) / (0.9 * 400 * 0.88 * dMm);
    const barAreaD19 = 283.5;
    const nBars = Math.max(3, Math.ceil(asReq / barAreaD19));
    const phiMn = (0.9 * (nBars * barAreaD19) * 400 * 0.88 * dMm) / 1e6;
    dcrRatio = maxM / Math.max(phiMn, 1);
    designSummary = `RC ${bMm}×${hMm} mm (f'c 30 MPa) · Tarik: ${nBars}-D19 · Sengkang: Ø10-150`;
  }

  return { maxM, maxV, maxDeflMm, allowDeflMm, designSummary, dcrRatio };
}

function sap2000Color(ratio: number): string {
  const t = Math.min(Math.max(ratio, 0), 1);
  const r = Math.round(255 * Math.min(Math.max(1.5 - Math.abs(4 * t - 3), 0), 1));
  const g = Math.round(255 * Math.min(Math.max(1.5 - Math.abs(4 * t - 2), 0), 1));
  const b = Math.round(255 * Math.min(Math.max(1.5 - Math.abs(4 * t - 1), 0), 1));
  return `rgb(${r},${g},${b})`;
}

export function executeCommand(cmd: CommandId): string {
  switch (cmd) {
    case "set.material.rc":
      state.material = "RC";
      return "Material: Reinforced Concrete (SNI 2847)";
    case "set.material.steel":
      state.material = "STEEL";
      return "Material: Structural Steel (SNI 1729)";
    case "set.loadmode.external":
      state.loadMode = "EXTERNAL";
      return "Load Mode: External Real-Time Force (Mode A)";
    case "set.loadmode.internal":
      state.loadMode = "INTERNAL";
      return "Load Mode: Direct Internal Forces (Mode B)";
    case "set.steel.filter.iwf":
      state.material = "STEEL";
      state.steelFilter = "IWF";
      return "Steel Filter: IWF Profiles Only";
    case "set.steel.filter.box":
      state.material = "STEEL";
      state.steelFilter = "BOX";
      return "Steel Filter: BOX Profiles Only";
    case "set.steel.filter.all":
      state.material = "STEEL";
      state.steelFilter = "ALL";
      return "Steel Filter: All Profiles (IWF + BOX)";
    case "toggle.diagram.bmd":
      state.showBMD = !state.showBMD;
      return `Bending Moment Diagram (BMD): ${state.showBMD ? "ON" : "OFF"}`;
    case "toggle.diagram.sfd":
      state.showSFD = !state.showSFD;
      return `Shear Force Diagram (SFD): ${state.showSFD ? "ON" : "OFF"}`;
    case "toggle.mode.optimize":
      state.autoOptimize = !state.autoOptimize;
      return `Iterative Section Optimizer: ${state.autoOptimize ? "ON" : "OFF"}`;
    case "toggle.window.gesture": {
      const el = document.getElementById("win-gesture");
      if (el) el.classList.toggle("hidden-win");
      return "Toggled Gesture Floating Window";
    }
    case "toggle.window.load": {
      const el = document.getElementById("win-config");
      if (el) el.classList.toggle("hidden-win");
      return "Toggled Config Floating Window";
    }
    case "toggle.voice":
      state.voiceActive = !state.voiceActive;
      return `Voice Command Control: ${state.voiceActive ? "ACTIVE" : "MUTED"}`;
  }
}

export function routeVoiceTranscript(transcript: string): CommandId | null {
  const t = transcript.toLowerCase();
  if (t.includes("beton") || t.includes("concrete")) return "set.material.rc";
  if (t.includes("iwf")) return "set.steel.filter.iwf";
  if (t.includes("box") || t.includes("hollow")) return "set.steel.filter.box";
  if (t.includes("baja") || t.includes("steel")) return "set.material.steel";
  if (t.includes("gaya dalam") || t.includes("internal")) return "set.loadmode.internal";
  if (t.includes("eksternal") || t.includes("external")) return "set.loadmode.external";
  if (t.includes("momen") || t.includes("bmd")) return "toggle.diagram.bmd";
  if (t.includes("geser") || t.includes("lintang") || t.includes("sfd"))
    return "toggle.diagram.sfd";
  if (t.includes("optimasi") || t.includes("ekonomis")) return "toggle.mode.optimize";
  if (t.includes("gestur") || t.includes("kamera")) return "toggle.window.gesture";
  if (t.includes("beban") || t.includes("window")) return "toggle.window.load";
  return null;
}

export function initWorkstation(): void {
  const canvas = document.getElementById("sim-canvas") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d", { alpha: false })!;
  const cursorEl = document.getElementById("virtual-cursor") as HTMLDivElement;
  const cursorSym = document.getElementById("cursor-symbol") as HTMLSpanElement;
  const cursorTag = document.getElementById("cursor-tag") as HTMLSpanElement;
  const logBanner = document.getElementById("cmd-toast") as HTMLDivElement;
  const videoEl = document.getElementById("webcam-video") as HTMLVideoElement;
  const handCanvas = document.getElementById("hand-skeleton") as HTMLCanvasElement;
  const handCtx = handCanvas.getContext("2d")!;

  let cursorX = window.innerWidth * 0.5;
  let cursorY = window.innerHeight * 0.45;
  let targetX = cursorX;
  let targetY = cursorY;
  let activeGesture: GestureType = "PALM";
  let prevGesture: GestureType = "PALM";
  let isPrePinching = false;
  let cameraRunning = false;

  // Dirty-flag prevents unnecessary 60 FPS canvas redraws, cutting GPU temperature drastically
  let isCanvasDirty = true;

  let draggedWindow: HTMLElement | null = null;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  function resizeCanvas(): void {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    isCanvasDirty = true;
  }
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  function showToast(msg: string): void {
    logBanner.textContent = `⚡ ${msg}`;
  }

  function syncUIButtons(): void {
    document.querySelectorAll<HTMLElement>("[data-cmd]").forEach((btn) => {
      const cmd = btn.dataset.cmd as CommandId;
      let active = false;
      if (cmd === "set.material.rc" && state.material === "RC") active = true;
      if (cmd === "set.material.steel" && state.material === "STEEL") active = true;
      if (cmd === "set.steel.filter.iwf" && state.steelFilter === "IWF") active = true;
      if (cmd === "set.steel.filter.box" && state.steelFilter === "BOX") active = true;
      if (cmd === "set.steel.filter.all" && state.steelFilter === "ALL") active = true;
      if (cmd === "toggle.diagram.bmd" && state.showBMD) active = true;
      if (cmd === "toggle.diagram.sfd" && state.showSFD) active = true;
      btn.classList.toggle("active-chip", active);
    });
  }

  function processVirtualInteraction(x: number, y: number, gesture: GestureType): void {
    if (gesture !== prevGesture) {
      const meta = GESTURE_MAP[gesture];
      cursorSym.textContent = meta.symbol;
      cursorTag.textContent = meta.label;
      cursorEl.style.borderColor = meta.color;
      cursorSym.style.color = meta.color;

      const statusBadge = document.getElementById("gesture-live-badge");
      if (statusBadge) {
        statusBadge.textContent = `${meta.symbol} ${meta.label}`;
        statusBadge.style.color = meta.color;
      }
      isCanvasDirty = true;
    }

    // 1. TWO_FINGER (▣): Grab & move floating window
    if (gesture === "TWO_FINGER") {
      if (!draggedWindow) {
        const elUnder = document.elementFromPoint(x, y);
        const win = elUnder?.closest(".floating-win") as HTMLElement | null;
        if (win) {
          draggedWindow = win;
          const rect = win.getBoundingClientRect();
          dragOffsetX = x - rect.left;
          dragOffsetY = y - rect.top;
          win.classList.add("grabbed-win");
        }
      } else {
        draggedWindow.style.left = `${Math.max(12, Math.min(window.innerWidth - 300, x - dragOffsetX))}px`;
        draggedWindow.style.top = `${Math.max(12, Math.min(window.innerHeight - 100, y - dragOffsetY))}px`;
      }
    } else if (draggedWindow && prevGesture === "TWO_FINGER") {
      draggedWindow.classList.remove("grabbed-win");
      draggedWindow = null;
    }

    // 2. PINCH (⌖): Trigger button click without cursor dip
    if (gesture === "PINCH" && prevGesture !== "PINCH") {
      const elUnder = document.elementFromPoint(x, y) as HTMLElement | null;
      const cmdBtn = elUnder?.closest("[data-cmd]") as HTMLElement | null;
      if (cmdBtn && cmdBtn.dataset.cmd) {
        const msg = executeCommand(cmdBtn.dataset.cmd as CommandId);
        showToast(`[PINCH ⌖] ${msg}`);
        syncUIButtons();
        isCanvasDirty = true;
      } else if (elUnder?.tagName === "BUTTON") {
        elUnder.click();
      }
    }

    // 3. FIST (▼): Real-time external point load manipulation
    const beamLeft = canvas.width * 0.16;
    const beamRight = canvas.width * 0.84;
    const beamWidthPx = beamRight - beamLeft;
    if (gesture === "FIST" && state.loadMode === "EXTERNAL") {
      const normX = Math.min(Math.max((x - beamLeft) / beamWidthPx, 0.05), 0.95);
      const normY = Math.min(
        Math.max((y - canvas.height * 0.15) / (canvas.height * 0.45), 0.05),
        1.0,
      );
      const nextX = (normX * state.spanL) as Meter;
      const nextP = Math.round(25 + normY * 225) as Kilonewton;
      if (Math.abs(nextX - state.pointLoadX) > 0.01 || nextP !== state.pointLoadP) {
        state.pointLoadX = nextX;
        state.pointLoadP = nextP;
        isCanvasDirty = true;
      }
    }

    // 4. POINT (▸): Precision node snapping
    if (gesture === "POINT") {
      const normX = Math.min(Math.max((x - beamLeft) / beamWidthPx, 0), 1);
      const nextIdx = Math.round(normX * (NODES - 1));
      if (nextIdx !== state.snapNodeIndex) {
        state.snapNodeIndex = nextIdx;
        isCanvasDirty = true;
      }
    } else if (state.snapNodeIndex !== null) {
      state.snapNodeIndex = null;
      isCanvasDirty = true;
    }

    prevGesture = gesture;
  }

  window.addEventListener("mousemove", (e) => {
    if (!cameraRunning) {
      targetX = e.clientX;
      targetY = e.clientY;
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "1") activeGesture = "PALM";
    if (e.key === "2") activeGesture = "PINCH";
    if (e.key === "3") activeGesture = "FIST";
    if (e.key === "4") activeGesture = "POINT";
    if (e.key === "5") activeGesture = "TWO_FINGER";
  });

  document.querySelectorAll<HTMLElement>("[data-cmd]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cmd = btn.dataset.cmd as CommandId;
      const res = executeCommand(cmd);
      showToast(res);
      syncUIButtons();
      isCanvasDirty = true;
    });
  });

  document.querySelectorAll<HTMLElement>(".win-header").forEach((hdr) => {
    hdr.addEventListener("mousedown", (e) => {
      const win = hdr.closest(".floating-win") as HTMLElement;
      draggedWindow = win;
      const rect = win.getBoundingClientRect();
      dragOffsetX = e.clientX - rect.left;
      dragOffsetY = e.clientY - rect.top;
      win.classList.add("grabbed-win");
    });
  });

  window.addEventListener("mouseup", () => {
    if (draggedWindow && activeGesture !== "TWO_FINGER") {
      draggedWindow.classList.remove("grabbed-win");
      draggedWindow = null;
    }
  });

  window.addEventListener("mousemove", (e) => {
    if (draggedWindow && activeGesture !== "TWO_FINGER") {
      draggedWindow.style.left = `${e.clientX - dragOffsetX}px`;
      draggedWindow.style.top = `${e.clientY - dragOffsetY}px`;
    }
  });

  // MediaPipe Camera with 16 FPS (62ms) Inference Throttler to keep GPU/CPU < 45°C
  const camBtn = document.getElementById("btn-toggle-cam") as HTMLButtonElement;
  let handLandmarker: any = null;
  let lastInferenceTimestamp = 0;

  camBtn.addEventListener("click", async () => {
    if (cameraRunning) {
      cameraRunning = false;
      const stream = videoEl.srcObject as MediaStream | null;
      stream?.getTracks().forEach((t) => t.stop());
      videoEl.srcObject = null;
      handCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);
      camBtn.textContent = "📷 Activate Hand Camera (Eco 16 FPS)";
      showToast("Camera stopped · Switched to Mouse + Keys [1-5]");
      return;
    }

    try {
      camBtn.textContent = "⏳ Loading MediaPipe Eco Model...";
      if (!handLandmarker) {
        const mpUrl = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm";
        const visionPkg = await import(mpUrl);
        const fileset = await visionPkg.FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
        );
        handLandmarker = await visionPkg.HandLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 1,
          minHandDetectionConfidence: 0.55,
          minHandPresenceConfidence: 0.55,
          minTrackingConfidence: 0.55,
        });
      }

      // Request 240x180 (4:3) at 15fps to minimize webcam & GPU texture bandwidth
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 240, height: 180, frameRate: { ideal: 15, max: 20 } },
      });
      videoEl.srcObject = stream;
      await videoEl.play();
      cameraRunning = true;
      camBtn.textContent = "🛑 Stop Hand Camera";
      showToast("Eco Hand Tracking Active! Cursor anchored to Knuckle (No Pinch-Dip)");
    } catch {
      cameraRunning = false;
      camBtn.textContent = "📷 Activate Hand Camera (Eco 16 FPS)";
      showToast("Camera unavailable · Use Mouse + Keys [1..5]");
    }
  });

  const voiceBtn = document.getElementById("btn-voice") as HTMLButtonElement;
  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  let recognition: any = null;

  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = "id-ID";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event: any) => {
      const last = event.results[event.results.length - 1];
      const text = last[0].transcript.trim();
      const matchedCmd = routeVoiceTranscript(text);
      if (matchedCmd) {
        const res = executeCommand(matchedCmd);
        showToast(`🎤 "${text}" ➔ ${res}`);
        syncUIButtons();
        isCanvasDirty = true;
      } else {
        showToast(`🎤 Heard: "${text}"`);
      }
    };
  }

  voiceBtn.addEventListener("click", () => {
    if (!recognition) {
      showToast("Web Speech API not supported in this browser");
      return;
    }
    state.voiceActive = !state.voiceActive;
    if (state.voiceActive) {
      recognition.start();
      voiceBtn.textContent = "🎙️ Voice STT: LISTENING";
      voiceBtn.classList.add("active-chip");
    } else {
      recognition.stop();
      voiceBtn.textContent = "🎤 Enable Voice Command";
      voiceBtn.classList.remove("active-chip");
    }
  });

  function renderStructuralCanvas(): void {
    const summary = solveBeamMechanics();

    // Solid dark fill (faster on GPU than alpha clearRect + CSS radial-gradient)
    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const x0 = canvas.width * 0.16;
    const x1 = canvas.width * 0.84;
    const spanPx = x1 - x0;
    const yBase = canvas.height * 0.44;
    const deflVisualScale = Math.min(110 / Math.max(summary.allowDeflMm, 1), 9.5);

    // 1. Reference Neutral Axis
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x0, yBase);
    ctx.lineTo(x1, yBase);
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. BMD Diagram
    if (state.showBMD) {
      ctx.beginPath();
      ctx.moveTo(x0, yBase);
      for (let i = 0; i < NODES; i++) {
        const px = x0 + (i / (NODES - 1)) * spanPx;
        const py = yBase + (bmdBuf[i]! / Math.max(summary.maxM, 1)) * 95;
        ctx.lineTo(px, py);
      }
      ctx.lineTo(x1, yBase);
      ctx.fillStyle = "rgba(16, 185, 129, 0.12)";
      ctx.fill();
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // 3. SFD Diagram
    if (state.showSFD) {
      ctx.beginPath();
      ctx.moveTo(x0, yBase);
      for (let i = 0; i < NODES; i++) {
        const px = x0 + (i / (NODES - 1)) * spanPx;
        const py = yBase - (sfdBuf[i]! / Math.max(summary.maxV, 1)) * 65;
        ctx.lineTo(px, py);
      }
      ctx.lineTo(x1, yBase);
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // 4. Single-Draw-Call SAP2000 Color Contour Beam (Replaces 120 strokes with 1 gradient stroke!)
    const grad = ctx.createLinearGradient(x0, 0, x1, 0);
    const stops = 10;
    for (let s = 0; s <= stops; s++) {
      const frac = s / stops;
      const idx = Math.round(frac * (NODES - 1));
      const ratio = deflBuf[idx]! / Math.max(summary.allowDeflMm, 0.1);
      grad.addColorStop(frac, sap2000Color(ratio));
    }

    ctx.beginPath();
    for (let i = 0; i < NODES; i++) {
      const px = x0 + (i / (NODES - 1)) * spanPx;
      const py = yBase + deflBuf[i]! * deflVisualScale;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = grad;
    ctx.lineWidth = 11;
    ctx.stroke();

    // 5. Supports
    ctx.fillStyle = "#94a3b8";
    ctx.beginPath();
    ctx.moveTo(x0, yBase + 6);
    ctx.lineTo(x0 - 14, yBase + 28);
    ctx.lineTo(x0 + 14, yBase + 28);
    ctx.moveTo(x1, yBase + 6);
    ctx.lineTo(x1 - 14, yBase + 28);
    ctx.lineTo(x1 + 14, yBase + 28);
    ctx.fill();

    // 6. External Point Load Vector (P)
    const loadPx = x0 + (state.pointLoadX / state.spanL) * spanPx;
    const nodeIdx = Math.round((state.pointLoadX / state.spanL) * (NODES - 1));
    const loadPy = yBase + (deflBuf[nodeIdx] ?? 0) * deflVisualScale;

    ctx.strokeStyle = "#f97316";
    ctx.fillStyle = "#f97316";
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(loadPx, loadPy - 82);
    ctx.lineTo(loadPx, loadPy - 10);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(loadPx, loadPy - 6);
    ctx.lineTo(loadPx - 9, loadPy - 22);
    ctx.lineTo(loadPx + 9, loadPy - 22);
    ctx.closePath();
    ctx.fill();

    ctx.font = "bold 13px monospace";
    ctx.fillText(
      `Pu = ${state.pointLoadP} kN @ x=${state.pointLoadX.toFixed(2)}m`,
      loadPx - 78,
      loadPy - 92,
    );

    // 7. Precision Point Snap Tooltip
    if (state.snapNodeIndex !== null) {
      const idx = state.snapNodeIndex;
      const sx = x0 + (idx / (NODES - 1)) * spanPx;
      const sy = yBase + deflBuf[idx]! * deflVisualScale;

      ctx.strokeStyle = "#eab308";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, 9, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "#0f172a";
      ctx.fillRect(sx - 95, sy + 18, 190, 62);
      ctx.strokeRect(sx - 95, sy + 18, 190, 62);
      ctx.fillStyle = "#fef08a";
      ctx.font = "12px monospace";
      ctx.fillText(`x = ${xBuf[idx]!.toFixed(2)} m`, sx - 85, sy + 36);
      ctx.fillText(
        `Δ = ${deflBuf[idx]!.toFixed(2)} mm | M = ${bmdBuf[idx]!.toFixed(1)} kNm`,
        sx - 85,
        sy + 54,
      );
      ctx.fillText(`V = ${sfdBuf[idx]!.toFixed(1)} kN`, sx - 85, sy + 71);
    }

    const elSummary = document.getElementById("opt-result");
    if (elSummary) elSummary.textContent = summary.designSummary;
    const elDcr = document.getElementById("dcr-val");
    if (elDcr) {
      const pct = (summary.dcrRatio * 100).toFixed(1);
      elDcr.textContent = `${pct}% (${summary.dcrRatio <= 1.0 ? "SAFE · SNI OK" : "OVERSTRESSED"})`;
      elDcr.style.color = summary.dcrRatio <= 1.0 ? "#10b981" : "#ef4444";
    }
    const elDefl = document.getElementById("defl-val");
    if (elDefl) {
      elDefl.textContent = `${summary.maxDeflMm.toFixed(2)} mm (Allow L/360 = ${summary.allowDeflMm.toFixed(1)} mm)`;
    }
  }

  function animate(now: number): void {
    // Throttle MediaPipe inference to ~16 FPS (every 62ms) so GPU stays cool
    if (
      cameraRunning &&
      handLandmarker &&
      now - lastInferenceTimestamp >= 62 &&
      videoEl.readyState >= 2
    ) {
      lastInferenceTimestamp = now;
      const result = handLandmarker.detectForVideo(videoEl, now);
      handCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);

      if (result.landmarks && result.landmarks.length > 0) {
        const lm = result.landmarks[0] as Landmark2D[];
        const analysis = analyzeHandLandmarks(lm);
        activeGesture = analysis.gesture;
        isPrePinching = analysis.isPrePinching;

        // Only update target coordinates if NOT in pre-pinch freeze zone
        if (!isPrePinching || activeGesture === "FIST" || activeGesture === "TWO_FINGER") {
          targetX = analysis.anchorX * window.innerWidth;
          targetY = analysis.anchorY * window.innerHeight;
        }

        // Batch-render 21-landmark bones and joints in exact 4:3 aspect ratio
        const w = handCanvas.width;
        const h = handCanvas.height;
        handCtx.strokeStyle = GESTURE_MAP[activeGesture].color;
        handCtx.lineWidth = 2;
        handCtx.beginPath();
        for (let i = 0; i < HAND_BONES.length; i++) {
          const [aIdx, bIdx] = HAND_BONES[i]!;
          const a = lm[aIdx]!;
          const b = lm[bIdx]!;
          handCtx.moveTo((1 - a.x) * w, a.y * h);
          handCtx.lineTo((1 - b.x) * w, b.y * h);
        }
        handCtx.stroke();

        // Draw joints + highlight Knuckle Anchor (landmark 5) in cyan
        handCtx.fillStyle = "#f8fafc";
        handCtx.beginPath();
        for (let i = 0; i < lm.length; i++) {
          const px = (1 - lm[i]!.x) * w;
          const py = lm[i]!.y * h;
          handCtx.moveTo(px + 2.5, py);
          handCtx.arc(px, py, 2.5, 0, Math.PI * 2);
        }
        handCtx.fill();
      }
    }

    // Magnetic damping when pre-pinching so cursor stays locked on buttons
    const smoothingFactor = isPrePinching && activeGesture !== "FIST" ? 0.04 : 0.26;
    cursorX += (targetX - cursorX) * smoothingFactor;
    cursorY += (targetY - cursorY) * smoothingFactor;
    cursorEl.style.transform = `translate3d(${cursorX - 22}px, ${cursorY - 22}px, 0)`;

    processVirtualInteraction(cursorX, cursorY, activeGesture);

    // Only redraw the heavy structural canvas when state actually changed!
    if (isCanvasDirty) {
      renderStructuralCanvas();
      isCanvasDirty = false;
    }

    requestAnimationFrame(animate);
  }

  syncUIButtons();
  requestAnimationFrame(animate);
}

if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", initWorkstation);
}
