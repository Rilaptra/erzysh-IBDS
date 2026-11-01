// FILE 1: engine.ts
// Bimanual (2-Hand) Structural Simulator + Adaptive Thermal Throttler (16 FPS -> 12 FPS)

export type Brand<K, T> = K & { readonly __brand: T };
export type Kilonewton = Brand<number, "kN">;
export type KilonewtonMeter = Brand<number, "kNm">;
export type Meter = Brand<number, "m">;

export type GestureType = "PALM" | "PINCH" | "FIST" | "POINT" | "TWO_FINGER";
export type MaterialMode = "RC" | "STEEL";
export type SteelFilter = "ALL" | "IWF" | "BOX";
export type SupportType = "SIMPLY_SUPPORTED" | "FIXED_FIXED" | "CANTILEVER";

export type CommandId =
  | "set.material.rc"
  | "set.material.steel"
  | "set.steel.filter.iwf"
  | "set.steel.filter.box"
  | "set.steel.filter.all"
  | "cycle.support"
  | "toggle.dual.load"
  | "toggle.diagram.bmd"
  | "toggle.diagram.sfd"
  | "toggle.bimanual";

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
    label: "Palm (Pointer)",
    color: "#38bdf8",
  },
  PINCH: {
    type: "PINCH",
    symbol: "⌖",
    label: "Pinch (Click / Stretch UDL)",
    color: "#10b981",
  },
  FIST: {
    type: "FIST",
    symbol: "▼",
    label: "Fist (Load / Torque Wheel)",
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
    label: "2-Finger (Drag / Clutch)",
    color: "#a855f7",
  },
};

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
  readonly jTorsion: number; // Torsional constant factor
}

const STEEL_PROFILES: readonly SteelProfile[] = [
  { name: "BOX 150x150x6", type: "BOX", zx: 192, jTorsion: 1850 },
  { name: "IWF 200x100x5.5x8", type: "IWF", zx: 200, jTorsion: 48 },
  { name: "IWF 250x125x6x9", type: "IWF", zx: 352, jTorsion: 92 },
  { name: "BOX 200x200x9", type: "BOX", zx: 498, jTorsion: 6300 },
  { name: "IWF 300x150x6.5x9", type: "IWF", zx: 525, jTorsion: 136 },
  { name: "BOX 250x250x9", type: "BOX", zx: 798, jTorsion: 12600 },
  { name: "IWF 350x175x7x11", type: "IWF", zx: 841, jTorsion: 268 },
  { name: "IWF 400x200x8x13", type: "IWF", zx: 1285, jTorsion: 510 },
  { name: "BOX 300x300x12", type: "BOX", zx: 1510, jTorsion: 28900 },
  { name: "IWF 500x200x10x16", type: "IWF", zx: 2090, jTorsion: 1090 },
];

const STEEL_GRADES = [
  { name: "BJ 37", fy: 240 },
  { name: "BJ 41", fy: 250 },
  { name: "BJ 50", fy: 290 },
  { name: "BJ 55", fy: 410 },
] as const;

export interface EngineState {
  material: MaterialMode;
  steelFilter: SteelFilter;
  supportType: SupportType;
  bimanualEnabled: boolean;
  spanL: Meter;
  // Point Load 1 (Right / Primary Hand)
  loadP1: Kilonewton;
  loadX1: Meter;
  // Point Load 2 (Left Hand in Dual-Fist Mode)
  dualLoadActive: boolean;
  loadP2: Kilonewton;
  loadX2: Meter;
  // Partial UDL (Stretched by 2-Hand Pinch)
  udlQ: Kilonewton;
  udlX1: Meter;
  udlX2: Meter;
  // Torsion from 2-Hand Steering Angle
  torsionTu: KilonewtonMeter;
  steeringAngleDeg: number;
  showBMD: boolean;
  showSFD: boolean;
  snapNodeIndex: number | null;
}

// Pre-allocated Float64Arrays for zero-GC 61-node numerical Euler-Bernoulli integration
const NODES = 61;
const xBuf = new Float64Array(NODES);
const vLoadBuf = new Float64Array(NODES);
const mLoadBuf = new Float64Array(NODES);
const sfdBuf = new Float64Array(NODES);
const bmdBuf = new Float64Array(NODES);
const slopeBuf = new Float64Array(NODES);
const deflBuf = new Float64Array(NODES);

const state: EngineState = {
  material: "STEEL",
  steelFilter: "ALL",
  supportType: "SIMPLY_SUPPORTED",
  bimanualEnabled: true,
  spanL: 6.0 as Meter,
  loadP1: 110 as Kilonewton,
  loadX1: 3.2 as Meter,
  dualLoadActive: false,
  loadP2: 95 as Kilonewton,
  loadX2: 1.8 as Meter,
  udlQ: 18 as Kilonewton,
  udlX1: 0.0 as Meter,
  udlX2: 6.0 as Meter,
  torsionTu: 0 as KilonewtonMeter,
  steeringAngleDeg: 0,
  showBMD: true,
  showSFD: true,
  snapNodeIndex: null,
};

// Separate 3-frame hysteresis buffers for Left (0) and Right (1) hands
const gestureHistories: [GestureType[], GestureType[]] = [
  ["PALM", "PALM", "PALM"],
  ["PALM", "PALM", "PALM"],
];

function dist2D(a: Landmark2D, b: Landmark2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export interface HandAnalysis {
  readonly gesture: GestureType;
  readonly isPrePinching: boolean;
  readonly anchorX: number;
  readonly anchorY: number;
}

export function analyzeHand(
  landmarks: readonly Landmark2D[],
  slot: 0 | 1,
): HandAnalysis {
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
  const isPrePinching = pinchRatio < 0.62;

  const isIndexExt = dist2D(indexTip, wrist) > dist2D(indexPip, wrist) * 1.13;
  const isMiddleExt =
    dist2D(middleTip, wrist) > dist2D(middlePip, wrist) * 1.13;
  const isRingExt = dist2D(ringTip, wrist) > dist2D(ringPip, wrist) * 1.11;
  const isPinkyExt = dist2D(pinkyTip, wrist) > dist2D(pinkyPip, wrist) * 1.11;

  let raw: GestureType = "PALM";
  if (
    pinchRatio < 0.42 &&
    (isMiddleExt || dist2D(indexTip, wrist) > palmSize * 0.8)
  ) {
    raw = "PINCH";
  } else if (!isIndexExt && !isMiddleExt && !isRingExt && !isPinkyExt) {
    raw = "FIST";
  } else if (isIndexExt && isMiddleExt && !isRingExt && !isPinkyExt) {
    raw = "TWO_FINGER";
  } else if (isIndexExt && !isMiddleExt && !isRingExt && !isPinkyExt) {
    raw = "POINT";
  }

  const hist = gestureHistories[slot];
  hist.shift();
  hist.push(raw);

  const counts: Record<GestureType, number> = {
    PALM: 0,
    PINCH: 0,
    FIST: 0,
    POINT: 0,
    TWO_FINGER: 0,
  };
  for (let i = 0; i < hist.length; i++) counts[hist[i]!]++;

  let best: GestureType = raw;
  let maxCount = 0;
  for (const k of Object.keys(counts) as GestureType[]) {
    if (counts[k] > maxCount) {
      maxCount = counts[k];
      best = k;
    }
  }

  // Knuckle anchor prevents cursor dip when pinching
  const rawX = 1 - (indexMcp.x * 0.65 + middleMcp.x * 0.35);
  const rawY = indexMcp.y * 0.65 + middleMcp.y * 0.35;
  const anchorX = Math.min(Math.max((rawX - 0.12) / 0.76, 0), 1);
  const anchorY = Math.min(Math.max((rawY - 0.14) / 0.72, 0), 1);

  return { gesture: best, isPrePinching, anchorX, anchorY };
}

// Universal O(N) Numerical Euler-Bernoulli Solver (Supports Dual Loads, Partial UDL, & 3 Support Types)
export function solveBeamMechanics(): {
  maxAbsM: number;
  maxAbsV: number;
  maxDeflMm: number;
  allowDeflMm: number;
  designSummary: string;
  dcrRatio: number;
  bimanualNote: string;
} {
  const L = state.spanL;
  const dx = L / (NODES - 1);
  const EI = state.material === "STEEL" ? 29000 : 22000;

  const q1 = Math.min(state.udlX1, state.udlX2);
  const q2 = Math.max(state.udlX1, state.udlX2);

  // 1. Integrate downward loads to get static shear vLoadBuf and static moment mLoadBuf
  let cumV = 0;
  let cumM = 0;
  for (let i = 0; i < NODES; i++) {
    const x = i * dx;
    xBuf[i] = x;

    if (i > 0) {
      const prevX = (i - 1) * dx;
      const midX = 0.5 * (prevX + x);
      if (midX >= q1 && midX <= q2) {
        cumV += state.udlQ * dx;
      }
      if (prevX < state.loadX1 && x >= state.loadX1) {
        cumV += state.loadP1;
      }
      if (state.dualLoadActive && prevX < state.loadX2 && x >= state.loadX2) {
        cumV += state.loadP2;
      }
      cumM -= 0.5 * (vLoadBuf[i - 1]! + cumV) * dx;
    }
    vLoadBuf[i] = cumV;
    mLoadBuf[i] = cumM;
  }

  // 2. Solve boundary reactions Ra (left vertical reaction) and Ma (left internal moment)
  let Ra = 0;
  let Ma = 0;

  if (state.supportType === "SIMPLY_SUPPORTED") {
    Ma = 0;
    Ra = -mLoadBuf[NODES - 1]! / L;
  } else if (state.supportType === "CANTILEVER") {
    Ra = vLoadBuf[NODES - 1]!;
    Ma = -Ra * L - mLoadBuf[NODES - 1]!;
  } else {
    // FIXED_FIXED via Moment-Area integrals I0 and I1
    let I0 = 0;
    let I1 = 0;
    for (let i = 1; i < NODES; i++) {
      const mAvg = 0.5 * (mLoadBuf[i - 1]! + mLoadBuf[i]!);
      const xAvg = 0.5 * (xBuf[i - 1]! + xBuf[i]!);
      I0 += mAvg * dx;
      I1 += xAvg * mAvg * dx;
    }
    Ra = (6 * I0 * L - 12 * I1) / (L * L * L);
    Ma = -I0 / L - (Ra * L) / 2;
  }

  // 3. Compute final SFD, BMD, and integrate twice for Deflection (mm)
  let maxAbsM = 0;
  let maxAbsV = 0;
  slopeBuf[0] = 0;
  deflBuf[0] = 0;

  for (let i = 0; i < NODES; i++) {
    const x = xBuf[i]!;
    const V = Ra - vLoadBuf[i]!;
    const M = Ma + Ra * x + mLoadBuf[i]!;
    sfdBuf[i] = V;
    bmdBuf[i] = M;

    if (Math.abs(M) > maxAbsM) maxAbsM = Math.abs(M);
    if (Math.abs(V) > maxAbsV) maxAbsV = Math.abs(V);

    if (i > 0) {
      const kPrev = bmdBuf[i - 1]! / EI;
      const kCurr = M / EI;
      slopeBuf[i] = slopeBuf[i - 1]! + 0.5 * (kPrev + kCurr) * dx;
      deflBuf[i] =
        deflBuf[i - 1]! + 0.5 * (slopeBuf[i - 1]! + slopeBuf[i]!) * dx * 1000;
    }
  }

  // Enforce right support zero-deflection drift for Simply Supported & Fixed-Fixed
  let maxDeflMm = 0;
  const endDrift = state.supportType === "CANTILEVER" ? 0 : deflBuf[NODES - 1]!;
  for (let i = 0; i < NODES; i++) {
    const xFrac = i / (NODES - 1);
    const corrected = Math.abs(deflBuf[i]! - xFrac * endDrift);
    deflBuf[i] = corrected;
    if (corrected > maxDeflMm) maxDeflMm = corrected;
  }

  const allowDeflMm =
    state.supportType === "CANTILEVER" ? (L * 1000) / 180 : (L * 1000) / 360;

  // 4. Section Optimizer (SNI 1729 Steel + Torsion Check vs SNI 2847 RC + Torsion Stirrups)
  let designSummary = "";
  let dcrRatio = 0.85;
  let bimanualNote = "Mode Standar (Lentur + Geser)";

  // Equivalent design moment factoring in St. Venant / Warping Torsion Tu
  const torsionPenaltyIWF = state.torsionTu * 2.4;
  const torsionPenaltyBOX = state.torsionTu * 0.35;

  if (state.material === "STEEL") {
    const pool = STEEL_PROFILES.filter(
      (p) => state.steelFilter === "ALL" || p.type === state.steelFilter,
    );
    let chosenProfile = pool[pool.length - 1]!;
    let chosenGrade = STEEL_GRADES[0];
    let bestDcr = 9.9;

    for (const grade of STEEL_GRADES) {
      for (const prof of pool) {
        const effM =
          maxAbsM +
          (prof.type === "IWF" ? torsionPenaltyIWF : torsionPenaltyBOX);
        const phiMn = (0.9 * prof.zx * 1e3 * grade.fy) / 1e6;
        const dcr = effM / Math.max(phiMn, 1);
        if (dcr <= 1.0 && dcr >= 0.75) {
          chosenProfile = prof;
          chosenGrade = grade;
          bestDcr = dcr;
          break;
        }
        if (dcr < bestDcr) {
          chosenProfile = prof;
          chosenGrade = grade;
          bestDcr = dcr;
        }
      }
      if (bestDcr <= 1.0 && bestDcr >= 0.75) break;
    }

    dcrRatio = bestDcr;
    designSummary = `${chosenProfile.name} (${chosenGrade.name}) · Zx=${chosenProfile.zx} cm³`;
    if (state.torsionTu >= 12) {
      bimanualNote = `Torsi Tu=${state.torsionTu} kNm Tinggi ➔ BOX jauh lebih efisien dari IWF!`;
    } else if (state.dualLoadActive) {
      bimanualNote = `Dual Axle Load (P1=${state.loadP1}kN, P2=${state.loadP2}kN) Aktif`;
    }
  } else {
    const effM = maxAbsM + state.torsionTu * 1.1;
    const bMm = 300;
    const hMm = Math.max(
      400,
      Math.ceil((Math.sqrt((effM * 1e6) / (0.14 * 30 * bMm)) + 60) / 50) * 50,
    );
    const dMm = hMm - 55;
    const asReq = (effM * 1e6) / (0.9 * 400 * 0.88 * dMm);
    const nBars = Math.max(3, Math.ceil(asReq / 283.5));
    const phiMn = (0.9 * (nBars * 283.5) * 400 * 0.88 * dMm) / 1e6;
    dcrRatio = effM / Math.max(phiMn, 1);
    const stirrup =
      state.torsionTu > 10
        ? "Sengkang Tertutup Ø12-100 (+Al Torsi)"
        : "Sengkang Ø10-150";
    designSummary = `RC ${bMm}×${hMm} mm · ${nBars}-D19 · ${stirrup}`;
    if (state.torsionTu > 10) {
      bimanualNote = `Torsi Tu=${state.torsionTu} kNm > T_th ➔ Sengkang Torsi Aktif (SNI 2847)`;
    }
  }

  return {
    maxAbsM,
    maxAbsV,
    maxDeflMm,
    allowDeflMm,
    designSummary,
    dcrRatio,
    bimanualNote,
  };
}

function sap2000Color(ratio: number): string {
  const t = Math.min(Math.max(ratio, 0), 1);
  const r = Math.round(
    255 * Math.min(Math.max(1.5 - Math.abs(4 * t - 3), 0), 1),
  );
  const g = Math.round(
    255 * Math.min(Math.max(1.5 - Math.abs(4 * t - 2), 0), 1),
  );
  const b = Math.round(
    255 * Math.min(Math.max(1.5 - Math.abs(4 * t - 1), 0), 1),
  );
  return `rgb(${r},${g},${b})`;
}

export function executeCommand(cmd: CommandId): string {
  switch (cmd) {
    case "set.material.rc":
      state.material = "RC";
      return "Material: Beton Bertulang (SNI 2847)";
    case "set.material.steel":
      state.material = "STEEL";
      return "Material: Baja Struktural (SNI 1729)";
    case "set.steel.filter.iwf":
      state.material = "STEEL";
      state.steelFilter = "IWF";
      return "Filter Baja: Hanya IWF";
    case "set.steel.filter.box":
      state.material = "STEEL";
      state.steelFilter = "BOX";
      return "Filter Baja: Hanya BOX (Tahan Torsi)";
    case "set.steel.filter.all":
      state.material = "STEEL";
      state.steelFilter = "ALL";
      return "Filter Baja: Semua Profil (IWF + BOX)";
    case "cycle.support":
      if (state.supportType === "SIMPLY_SUPPORTED")
        state.supportType = "FIXED_FIXED";
      else if (state.supportType === "FIXED_FIXED")
        state.supportType = "CANTILEVER";
      else state.supportType = "SIMPLY_SUPPORTED";
      return `Tumpuan Diubah: ${state.supportType}`;
    case "toggle.dual.load":
      state.dualLoadActive = !state.dualLoadActive;
      return `Dual Point Load (P1 & P2): ${state.dualLoadActive ? "ON" : "OFF"}`;
    case "toggle.diagram.bmd":
      state.showBMD = !state.showBMD;
      return `Diagram Momen (BMD): ${state.showBMD ? "ON" : "OFF"}`;
    case "toggle.diagram.sfd":
      state.showSFD = !state.showSFD;
      return `Diagram Geser (SFD): ${state.showSFD ? "ON" : "OFF"}`;
    case "toggle.bimanual":
      state.bimanualEnabled = !state.bimanualEnabled;
      return `Mode 2-Tangan (Bimanual): ${state.bimanualEnabled ? "ON (Adaptive 12 FPS)" : "OFF (1-Hand 16 FPS)"}`;
  }
}

export function initWorkstation(): void {
  const canvas = document.getElementById("sim-canvas") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d", { alpha: false })!;
  const cursorR = document.getElementById("virtual-cursor-r") as HTMLDivElement;
  const symR = document.getElementById("cursor-sym-r") as HTMLSpanElement;
  const tagR = document.getElementById("cursor-tag-r") as HTMLSpanElement;

  const cursorL = document.getElementById("virtual-cursor-l") as HTMLDivElement;
  const symL = document.getElementById("cursor-sym-l") as HTMLSpanElement;
  const tagL = document.getElementById("cursor-tag-l") as HTMLSpanElement;

  const logBanner = document.getElementById("cmd-toast") as HTMLDivElement;
  const videoEl = document.getElementById("webcam-video") as HTMLVideoElement;
  const handCanvas = document.getElementById(
    "hand-skeleton",
  ) as HTMLCanvasElement;
  const handCtx = handCanvas.getContext("2d")!;

  // Right Hand (Primary) State
  let curRX = window.innerWidth * 0.58;
  let curRY = window.innerHeight * 0.42;
  let tarRX = curRX;
  let tarRY = curRY;
  let gestR: GestureType = "PALM";
  let prevGestR: GestureType = "PALM";
  let prePinchR = false;

  // Left Hand (Secondary / Bimanual) State
  let leftHandVisible = false;
  let curLX = window.innerWidth * 0.35;
  let curLY = window.innerHeight * 0.42;
  let tarLX = curLX;
  let tarLY = curLY;
  let gestL: GestureType = "FIST";
  let prevGestL: GestureType = "FIST";
  let prePinchL = false;

  let cameraRunning = false;
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
      if (cmd === "set.material.steel" && state.material === "STEEL")
        active = true;
      if (cmd === "set.steel.filter.iwf" && state.steelFilter === "IWF")
        active = true;
      if (cmd === "set.steel.filter.box" && state.steelFilter === "BOX")
        active = true;
      if (cmd === "set.steel.filter.all" && state.steelFilter === "ALL")
        active = true;
      if (cmd === "toggle.dual.load" && state.dualLoadActive) active = true;
      if (cmd === "toggle.diagram.bmd" && state.showBMD) active = true;
      if (cmd === "toggle.diagram.sfd" && state.showSFD) active = true;
      if (cmd === "toggle.bimanual" && state.bimanualEnabled) active = true;
      btn.classList.toggle("active-chip", active);
    });
    const supBtn = document.querySelector<HTMLElement>(
      '[data-cmd="cycle.support"]',
    );
    if (supBtn)
      supBtn.textContent = `📐 Tumpuan: ${state.supportType.replace("_", "-")}`;
  }

  // Master Bimanual + Unimanual Interaction Processor
  function processMultimodalPhysics(): void {
    const metaR = GESTURE_MAP[gestR];
    symR.textContent = metaR.symbol;
    tagR.textContent = `R · ${metaR.label}`;
    cursorR.style.borderColor = metaR.color;
    symR.style.color = metaR.color;

    cursorL.style.display = leftHandVisible ? "flex" : "none";
    if (leftHandVisible) {
      const metaL = GESTURE_MAP[gestL];
      symL.textContent = metaL.symbol;
      tagL.textContent = `L · ${metaL.label}`;
      cursorL.style.borderColor = metaL.color;
      symL.style.color = metaL.color;
    }

    const badge = document.getElementById("gesture-live-badge");
    if (badge) {
      badge.textContent = leftHandVisible
        ? `L:[${GESTURE_MAP[gestL].symbol} ${gestL}] + R:[${metaR.symbol} ${gestR}]`
        : `R:[${metaR.symbol} ${metaR.label}]`;
    }

    const beamLeft = canvas.width * 0.16;
    const beamRight = canvas.width * 0.84;
    const beamWidthPx = beamRight - beamLeft;

    // =========================================================================
    // BIMANUAL (2-HAND) COMBINATION LOGIC
    // =========================================================================
    if (leftHandVisible && state.bimanualEnabled) {
      // COMBO 1: ✊ Left Fist + ✊ Right Fist -> Dual Point Loads (P1 & P2) + Steering Torque (Tu)
      if (gestL === "FIST" && gestR === "FIST") {
        state.dualLoadActive = true;
        const normLX = Math.min(
          Math.max((curLX - beamLeft) / beamWidthPx, 0.05),
          0.95,
        );
        const normLY = Math.min(
          Math.max(
            (curLY - canvas.height * 0.15) / (canvas.height * 0.45),
            0.05,
          ),
          1.0,
        );
        const normRX = Math.min(
          Math.max((curRX - beamLeft) / beamWidthPx, 0.05),
          0.95,
        );
        const normRY = Math.min(
          Math.max(
            (curRY - canvas.height * 0.15) / (canvas.height * 0.45),
            0.05,
          ),
          1.0,
        );

        state.loadX2 = (normLX * state.spanL) as Meter;
        state.loadP2 = Math.round(25 + normLY * 200) as Kilonewton;
        state.loadX1 = (normRX * state.spanL) as Meter;
        state.loadP1 = Math.round(25 + normRY * 200) as Kilonewton;

        // Calculate "Steering Wheel" tilt angle between the two hands for Torsion Tu
        const dy = curRY - curLY;
        const dx = Math.max(Math.abs(curRX - curLX), 40);
        const angleDeg = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);
        state.steeringAngleDeg = angleDeg;
        state.torsionTu = (
          Math.abs(angleDeg) > 12 ? Math.round(Math.abs(angleDeg) * 0.75) : 0
        ) as KilonewtonMeter;

        isCanvasDirty = true;
      }

      // COMBO 2: 🤏 Left Pinch + 🤏 Right Pinch -> Stretch Partial UDL Zone (q_u from x1 to x2)
      else if (gestL === "PINCH" && gestR === "PINCH") {
        const elUnderR = document.elementFromPoint(curRX, curRY);
        if (!elUnderR?.closest(".floating-win")) {
          const normLX = Math.min(
            Math.max((curLX - beamLeft) / beamWidthPx, 0.0),
            1.0,
          );
          const normRX = Math.min(
            Math.max((curRX - beamLeft) / beamWidthPx, 0.0),
            1.0,
          );
          const avgY = 0.5 * (curLY + curRY);
          const normY = Math.min(
            Math.max(
              (avgY - canvas.height * 0.15) / (canvas.height * 0.45),
              0.05,
            ),
            1.0,
          );

          state.udlX1 = (Math.min(normLX, normRX) * state.spanL) as Meter;
          state.udlX2 = (Math.max(normLX + 0.08, normRX) *
            state.spanL) as Meter;
          state.udlQ = Math.round(8 + normY * 52) as Kilonewton;
          isCanvasDirty = true;
        }
      }

      // COMBO 3: ✊ Left Fist + ☝️ Right Point -> Left Hand Holds Load P2 while Right Hand Inspects
      else if (gestL === "FIST" && gestR === "POINT") {
        const normLX = Math.min(
          Math.max((curLX - beamLeft) / beamWidthPx, 0.05),
          0.95,
        );
        const normLY = Math.min(
          Math.max(
            (curLY - canvas.height * 0.15) / (canvas.height * 0.45),
            0.05,
          ),
          1.0,
        );
        state.loadX1 = (normLX * state.spanL) as Meter;
        state.loadP1 = Math.round(25 + normLY * 225) as Kilonewton;

        const normRX = Math.min(
          Math.max((curRX - beamLeft) / beamWidthPx, 0),
          1,
        );
        state.snapNodeIndex = Math.round(normRX * (NODES - 1));
        isCanvasDirty = true;
      }

      // COMBO 4: ✌️ Left Two-Finger (Clutch) + 🤏 Right Pinch -> Cycle Support Boundary Condition
      else if (
        gestL === "TWO_FINGER" &&
        gestR === "PINCH" &&
        prevGestR !== "PINCH"
      ) {
        const msg = executeCommand("cycle.support");
        showToast(`[2-HAND CLUTCH ✌️+🤏] ${msg}`);
        syncUIButtons();
        isCanvasDirty = true;
      }
    }

    // =========================================================================
    // STANDARD SINGLE-HAND (RIGHT/PRIMARY) INTERACTION
    // =========================================================================
    if (gestR === "TWO_FINGER") {
      if (!draggedWindow) {
        const elUnder = document.elementFromPoint(curRX, curRY);
        const win = elUnder?.closest(".floating-win") as HTMLElement | null;
        if (win) {
          draggedWindow = win;
          const rect = win.getBoundingClientRect();
          dragOffsetX = curRX - rect.left;
          dragOffsetY = curRY - rect.top;
          win.classList.add("grabbed-win");
        }
      } else {
        draggedWindow.style.left = `${Math.max(12, Math.min(window.innerWidth - 300, curRX - dragOffsetX))}px`;
        draggedWindow.style.top = `${Math.max(12, Math.min(window.innerHeight - 100, curRY - dragOffsetY))}px`;
      }
    } else if (draggedWindow && prevGestR === "TWO_FINGER") {
      draggedWindow.classList.remove("grabbed-win");
      draggedWindow = null;
    }

    // Single Pinch Click on UI Buttons
    if (
      gestR === "PINCH" &&
      prevGestR !== "PINCH" &&
      !(leftHandVisible && gestL === "TWO_FINGER")
    ) {
      const elUnder = document.elementFromPoint(
        curRX,
        curRY,
      ) as HTMLElement | null;
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

    // Single Fist Load Control (when Left Hand is not also in Fist)
    if (gestR === "FIST" && !(leftHandVisible && gestL === "FIST")) {
      const normX = Math.min(
        Math.max((curRX - beamLeft) / beamWidthPx, 0.05),
        0.95,
      );
      const normY = Math.min(
        Math.max((curRY - canvas.height * 0.15) / (canvas.height * 0.45), 0.05),
        1.0,
      );
      const nextX = (normX * state.spanL) as Meter;
      const nextP = Math.round(25 + normY * 225) as Kilonewton;
      if (Math.abs(nextX - state.loadX1) > 0.01 || nextP !== state.loadP1) {
        state.loadX1 = nextX;
        state.loadP1 = nextP;
        isCanvasDirty = true;
      }
    }

    // Single Point Node Snap
    if (gestR === "POINT" && !(leftHandVisible && gestL === "FIST")) {
      const normX = Math.min(Math.max((curRX - beamLeft) / beamWidthPx, 0), 1);
      const nextIdx = Math.round(normX * (NODES - 1));
      if (nextIdx !== state.snapNodeIndex) {
        state.snapNodeIndex = nextIdx;
        isCanvasDirty = true;
      }
    } else if (gestR !== "POINT" && state.snapNodeIndex !== null) {
      state.snapNodeIndex = null;
      isCanvasDirty = true;
    }

    if (gestR !== prevGestR || gestL !== prevGestL) {
      isCanvasDirty = true;
    }
    prevGestR = gestR;
    prevGestL = gestL;
  }

  // Keyboard + Mouse Simulator for 1 & 2 Hands (Space toggles Virtual Left Hand!)
  window.addEventListener("mousemove", (e) => {
    if (!cameraRunning) {
      tarRX = e.clientX;
      tarRY = e.clientY;
      if (leftHandVisible) isCanvasDirty = true;
    }
  });

  window.addEventListener("keydown", (e) => {
    // Right Hand Gesture Keys [1..5]
    if (e.key === "1") gestR = "PALM";
    if (e.key === "2") gestR = "PINCH";
    if (e.key === "3") gestR = "FIST";
    if (e.key === "4") gestR = "POINT";
    if (e.key === "5") gestR = "TWO_FINGER";

    // Spacebar toggles Virtual Left Hand for testing 2-hand combos without webcam
    if (e.code === "Space" && !cameraRunning) {
      e.preventDefault();
      leftHandVisible = !leftHandVisible;
      showToast(
        leftHandVisible
          ? "🙌 Virtual Left Hand ON! Keys [Q,W,E,R,T] = Left Gesture · [A,D,S] = Move Left Hand"
          : "🖐️ Virtual Left Hand OFF",
      );
      isCanvasDirty = true;
    }

    // Left Hand Gesture Keys [Q,W,E,R,T] & Position Nudge [A,D,S]
    const k = e.key.toLowerCase();
    if (k === "q") gestL = "PALM";
    if (k === "w") gestL = "PINCH";
    if (k === "e") gestL = "FIST";
    if (k === "r") gestL = "POINT";
    if (k === "t") gestL = "TWO_FINGER";
    if (k === "a") {
      tarLX = Math.max(100, tarLX - 28);
      isCanvasDirty = true;
    }
    if (k === "d") {
      tarLX = Math.min(window.innerWidth - 100, tarLX + 28);
      isCanvasDirty = true;
    }
    if (k === "s") {
      tarLY = ((tarLY - 160 + 35) % 260) + 160;
      isCanvasDirty = true;
    }
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
    if (draggedWindow && gestR !== "TWO_FINGER") {
      draggedWindow.classList.remove("grabbed-win");
      draggedWindow = null;
    }
  });

  window.addEventListener("mousemove", (e) => {
    if (draggedWindow && gestR !== "TWO_FINGER") {
      draggedWindow.style.left = `${e.clientX - dragOffsetX}px`;
      draggedWindow.style.top = `${e.clientY - dragOffsetY}px`;
    }
  });

  // MediaPipe 2-Hand Camera with Adaptive FPS Throttler (16 FPS for 1 hand, 12 FPS for 2 hands)
  const camBtn = document.getElementById("btn-toggle-cam") as HTMLButtonElement;
  let handLandmarker: any = null;
  let lastInferenceTimestamp = 0;

  camBtn.addEventListener("click", async () => {
    if (cameraRunning) {
      cameraRunning = false;
      leftHandVisible = false;
      const stream = videoEl.srcObject as MediaStream | null;
      stream?.getTracks().forEach((t) => t.stop());
      videoEl.srcObject = null;
      handCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);
      camBtn.textContent = "📷 Activate 2-Hand Camera (Eco Adaptive)";
      showToast(
        "Camera stopped · Press [Space] to test 2-Hand Simulator with Keyboard+Mouse!",
      );
      isCanvasDirty = true;
      return;
    }

    try {
      camBtn.textContent = "⏳ Loading 2-Hand Eco Model...";
      if (!handLandmarker) {
        const mpUrl =
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm";
        const visionPkg = await import(mpUrl);
        const fileset = await visionPkg.FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
        );
        handLandmarker = await visionPkg.HandLandmarker.createFromOptions(
          fileset,
          {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
              delegate: "GPU",
            },
            runningMode: "VIDEO",
            numHands: 2,
            minHandDetectionConfidence: 0.55,
            minHandPresenceConfidence: 0.55,
            minTrackingConfidence: 0.55,
          },
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 240, height: 180, frameRate: { ideal: 15, max: 20 } },
      });
      videoEl.srcObject = stream;
      await videoEl.play();
      cameraRunning = true;
      camBtn.textContent = "🛑 Stop 2-Hand Camera";
      showToast("2-Hand Bimanual Tracking Active! Show 1 or 2 hands to camera");
    } catch {
      cameraRunning = false;
      camBtn.textContent = "📷 Activate 2-Hand Camera (Eco Adaptive)";
      showToast(
        "Camera unavailable · Press [Space] to activate Virtual Left Hand!",
      );
    }
  });

  function renderStructuralCanvas(): void {
    const summary = solveBeamMechanics();

    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const x0 = canvas.width * 0.16;
    const x1 = canvas.width * 0.84;
    const spanPx = x1 - x0;
    const yBase = canvas.height * 0.46;
    const deflVisualScale = Math.min(
      105 / Math.max(summary.allowDeflMm, 1),
      9.0,
    );

    // 1. Reference Neutral Axis
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x0, yBase);
    ctx.lineTo(x1, yBase);
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. Partial UDL Distributed Load Block (q_u from udlX1 to udlX2)
    const udlStartPx =
      x0 + (Math.min(state.udlX1, state.udlX2) / state.spanL) * spanPx;
    const udlEndPx =
      x0 + (Math.max(state.udlX1, state.udlX2) / state.spanL) * spanPx;
    const udlHeightPx = 18 + (state.udlQ / 60) * 32;

    ctx.fillStyle = "rgba(168, 85, 247, 0.14)";
    ctx.strokeStyle = "rgba(168, 85, 247, 0.75)";
    ctx.lineWidth = 1.5;
    ctx.fillRect(
      udlStartPx,
      yBase - udlHeightPx,
      udlEndPx - udlStartPx,
      udlHeightPx,
    );
    ctx.strokeRect(
      udlStartPx,
      yBase - udlHeightPx,
      udlEndPx - udlStartPx,
      udlHeightPx,
    );
    ctx.fillStyle = "#d8b4fe";
    ctx.font = "11px monospace";
    ctx.fillText(
      `qu = ${state.udlQ} kN/m [${state.udlX1.toFixed(1)}m..${state.udlX2.toFixed(1)}m]`,
      udlStartPx + 6,
      yBase - udlHeightPx - 6,
    );

    // 3. BMD & SFD Diagrams
    if (state.showBMD) {
      ctx.beginPath();
      ctx.moveTo(x0, yBase);
      for (let i = 0; i < NODES; i++) {
        const px = x0 + (i / (NODES - 1)) * spanPx;
        const py = yBase + (bmdBuf[i]! / Math.max(summary.maxAbsM, 1)) * 90;
        ctx.lineTo(px, py);
      }
      ctx.lineTo(x1, yBase);
      ctx.fillStyle = "rgba(16, 185, 129, 0.12)";
      ctx.fill();
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    if (state.showSFD) {
      ctx.beginPath();
      ctx.moveTo(x0, yBase);
      for (let i = 0; i < NODES; i++) {
        const px = x0 + (i / (NODES - 1)) * spanPx;
        const py = yBase - (sfdBuf[i]! / Math.max(summary.maxAbsV, 1)) * 60;
        ctx.lineTo(px, py);
      }
      ctx.lineTo(x1, yBase);
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // 4. Single-Draw-Call SAP2000 Color Contour Beam
    const grad = ctx.createLinearGradient(x0, 0, x1, 0);
    for (let s = 0; s <= 10; s++) {
      const frac = s / 10;
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

    // 5. Render Boundary Supports (Simply Supported / Fixed-Fixed / Cantilever)
    ctx.fillStyle = "#94a3b8";
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 3;
    if (state.supportType === "SIMPLY_SUPPORTED") {
      ctx.beginPath();
      ctx.moveTo(x0, yBase + 6);
      ctx.lineTo(x0 - 14, yBase + 28);
      ctx.lineTo(x0 + 14, yBase + 28);
      ctx.moveTo(x1, yBase + 6);
      ctx.lineTo(x1 - 14, yBase + 28);
      ctx.lineTo(x1 + 14, yBase + 28);
      ctx.fill();
    } else if (state.supportType === "FIXED_FIXED") {
      ctx.fillRect(x0 - 10, yBase - 28, 10, 56);
      ctx.fillRect(x1, yBase - 28, 10, 56);
    } else {
      ctx.fillRect(x0 - 12, yBase - 32, 12, 64);
    }

    // 6. Helper to draw Point Load Arrows (P1 and P2)
    function drawPointLoad(
      xMeter: number,
      pKn: number,
      label: string,
      color: string,
    ): void {
      const px = x0 + (xMeter / state.spanL) * spanPx;
      const idx = Math.round((xMeter / state.spanL) * (NODES - 1));
      const py = yBase + (deflBuf[idx] ?? 0) * deflVisualScale;

      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(px, py - 82);
      ctx.lineTo(px, py - 10);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(px, py - 6);
      ctx.lineTo(px - 9, py - 22);
      ctx.lineTo(px + 9, py - 22);
      ctx.closePath();
      ctx.fill();

      ctx.font = "bold 12px monospace";
      ctx.fillText(
        `${label}=${pKn}kN @${xMeter.toFixed(1)}m`,
        px - 58,
        py - 90,
      );
    }

    drawPointLoad(state.loadX1, state.loadP1, "P1", "#f97316");
    if (state.dualLoadActive) {
      drawPointLoad(state.loadX2, state.loadP2, "P2", "#fb7185");
    }

    // 7. Draw Bimanual Vector Link (Steering Torque Wheel / UDL Stretcher)
    if (leftHandVisible && state.bimanualEnabled) {
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "#a855f7";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(curLX, curLY);
      ctx.lineTo(curRX, curRY);
      ctx.stroke();
      ctx.setLineDash([]);

      const midX = 0.5 * (curLX + curRX);
      const midY = 0.5 * (curLY + curRY);
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(midX - 95, midY - 16, 190, 26);
      ctx.strokeStyle = "#a855f7";
      ctx.strokeRect(midX - 95, midY - 16, 190, 26);
      ctx.fillStyle = "#f8fafc";
      ctx.font = "bold 11px monospace";
      ctx.fillText(
        `↻ Tilt: ${state.steeringAngleDeg}° | Tu: ${state.torsionTu} kNm`,
        midX - 86,
        midY + 1,
      );
    }

    // 8. Precision Point Snap Tooltip
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
      ctx.fillRect(sx - 95, sy + 18, 195, 62);
      ctx.strokeRect(sx - 95, sy + 18, 195, 62);
      ctx.fillStyle = "#fef08a";
      ctx.font = "12px monospace";
      ctx.fillText(
        `x = ${xBuf[idx]!.toFixed(2)} m | Tu = ${state.torsionTu} kNm`,
        sx - 85,
        sy + 36,
      );
      ctx.fillText(
        `Δ = ${deflBuf[idx]!.toFixed(2)} mm | M = ${bmdBuf[idx]!.toFixed(1)} kNm`,
        sx - 85,
        sy + 54,
      );
      ctx.fillText(`V = ${sfdBuf[idx]!.toFixed(1)} kN`, sx - 85, sy + 71);
    }

    // Update DOM Metrics
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
      elDefl.textContent = `${summary.maxDeflMm.toFixed(2)} mm (Izin = ${summary.allowDeflMm.toFixed(1)} mm)`;
    }
    const elNote = document.getElementById("bimanual-note");
    if (elNote) elNote.textContent = summary.bimanualNote;
  }

  function animate(now: number): void {
    // Adaptive FPS Throttler: 16 FPS (62ms) for 1 hand, 12 FPS (83ms) when 2 hands are active
    const intervalMs = leftHandVisible && cameraRunning ? 83 : 62;

    if (
      cameraRunning &&
      handLandmarker &&
      now - lastInferenceTimestamp >= intervalMs &&
      videoEl.readyState >= 2
    ) {
      lastInferenceTimestamp = now;
      const result = handLandmarker.detectForVideo(videoEl, now);
      handCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);

      const detectedCount = result.landmarks ? result.landmarks.length : 0;
      const w = handCanvas.width;
      const h = handCanvas.height;

      if (detectedCount === 1) {
        leftHandVisible = false;
        const lmR = result.landmarks[0] as Landmark2D[];
        const resR = analyzeHand(lmR, 1);
        gestR = resR.gesture;
        prePinchR = resR.isPrePinching;
        if (!prePinchR || gestR === "FIST" || gestR === "TWO_FINGER") {
          tarRX = resR.anchorX * window.innerWidth;
          tarRY = resR.anchorY * window.innerHeight;
        }
        drawSkeletonOnMiniHud(lmR, GESTURE_MAP[gestR].color, w, h);
      } else if (detectedCount >= 2 && state.bimanualEnabled) {
        leftHandVisible = true;
        const raw0 = result.landmarks[0] as Landmark2D[];
        const raw1 = result.landmarks[1] as Landmark2D[];

        // O(1) Screen-X Sorting: smaller screen X (larger raw mirrored X) is Left Hand!
        const isFirstLeft = 1 - raw0[5]!.x < 1 - raw1[5]!.x;
        const lmL = isFirstLeft ? raw0 : raw1;
        const lmR = isFirstLeft ? raw1 : raw0;

        const resL = analyzeHand(lmL, 0);
        const resR = analyzeHand(lmR, 1);

        gestL = resL.gesture;
        prePinchL = resL.isPrePinching;
        if (!prePinchL || gestL === "FIST" || gestL === "TWO_FINGER") {
          tarLX = resL.anchorX * window.innerWidth;
          tarLY = resL.anchorY * window.innerHeight;
        }

        gestR = resR.gesture;
        prePinchR = resR.isPrePinching;
        if (!prePinchR || gestR === "FIST" || gestR === "TWO_FINGER") {
          tarRX = resR.anchorX * window.innerWidth;
          tarRY = resR.anchorY * window.innerHeight;
        }

        drawSkeletonOnMiniHud(lmL, GESTURE_MAP[gestL].color, w, h);
        drawSkeletonOnMiniHud(lmR, GESTURE_MAP[gestR].color, w, h);
      } else if (detectedCount === 0) {
        leftHandVisible = false;
      }
    }

    const alphaR = prePinchR && gestR !== "FIST" ? 0.04 : 0.26;
    curRX += (tarRX - curRX) * alphaR;
    curRY += (tarRY - curRY) * alphaR;
    cursorR.style.transform = `translate3d(${curRX - 22}px, ${curRY - 22}px, 0)`;

    if (leftHandVisible) {
      const alphaL = prePinchL && gestL !== "FIST" ? 0.04 : 0.26;
      curLX += (tarLX - curLX) * alphaL;
      curLY += (tarLY - curLY) * alphaL;
      cursorL.style.transform = `translate3d(${curLX - 22}px, ${curLY - 22}px, 0)`;
    }

    processMultimodalPhysics();

    if (isCanvasDirty) {
      renderStructuralCanvas();
      isCanvasDirty = false;
    }

    requestAnimationFrame(animate);
  }

  function drawSkeletonOnMiniHud(
    lm: readonly Landmark2D[],
    color: string,
    w: number,
    h: number,
  ): void {
    handCtx.strokeStyle = color;
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

    handCtx.fillStyle = "#f8fafc";
    handCtx.beginPath();
    for (let i = 0; i < lm.length; i++) {
      const px = (1 - lm[i]!.x) * w;
      const py = lm[i]!.y * h;
      handCtx.moveTo(px + 2.2, py);
      handCtx.arc(px, py, 2.2, 0, Math.PI * 2);
    }
    handCtx.fill();
  }

  syncUIButtons();
  requestAnimationFrame(animate);
}

if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", initWorkstation);
}
