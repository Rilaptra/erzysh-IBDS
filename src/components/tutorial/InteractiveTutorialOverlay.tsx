"use client";

/**
 * @file InteractiveTutorialOverlay.tsx
 * @description HUD tutorial interaktif bergaya game ("IBDS Engineer Quest") yang
 * dipandu asisten AI Ucuy, mendukung interaksi mouse/sentuh, perintah suara langsung
 * (Live Voice Input), sorotan spotlight non-blocking, serta ekspor & panduan AutoCAD DXF.
 */

import {
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileCode2,
  Gamepad2,
  Layers,
  Mic,
  MicOff,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import React, { type ReactElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { CameraPreset } from "@/components/canvas/Beam3DExtrudedViewport";
import { Button } from "@/components/ui/button";
import {
  TOTAL_TUTORIAL_STEPS,
  TUTORIAL_QUEST_STEPS,
  type TutorialMobileTab,
  type TutorialQuestStep,
} from "@/config/tutorial-steps-config";
import { buildDxfFromSimulatorState } from "@/core/exporters/dxf-autocad-exporter";
import {
  synthesizeAudioTone,
  type UseWebSpeechCommandResult,
} from "@/hooks/use-web-speech-command";
import {
  type BeamSimulatorState,
  getBeamSimulatorSnapshot,
  useBeamSimulatorStore,
} from "@/state/beam-simulator-store";
import { floatingWindowActions, useFloatingWindowStore } from "@/state/floating-window-store";
import { tutorialTourActions, useTutorialTourStore } from "@/state/tutorial-tour-store";
import type { CommandExecutionResult } from "@/types/command-registry-types";

export interface InteractiveTutorialOverlayProps {
  /** Hook suara langsung (Web Speech API + Gemini Live TTS). */
  readonly voice?: UseWebSpeechCommandResult;
  /** Preset kamera aktif saat ini (Desktop). */
  readonly cameraPreset?: CameraPreset;
  /** Callback pergantian tab saat berjalan di AndroidCompanionView. */
  readonly onMobileTabChange?: (tab: TutorialMobileTab) => void;
  /** Status kamera deteksi gestur tangan aktif (Desktop). */
  readonly isHandTrackingActive?: boolean;
}

interface SpotlightRect {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

interface MissionBaselineSnapshot {
  readonly stepId: string;
  readonly materialKind: BeamSimulatorState["materialKind"];
  readonly loadingMode: BeamSimulatorState["loadingMode"];
  readonly spanLengthM: BeamSimulatorState["spanLengthM"];
  readonly supportOrientation: BeamSimulatorState["supportOrientation"];
  readonly includeSelfWeight: boolean;
  readonly pointLoadsRef: BeamSimulatorState["pointLoads"];
  readonly distributedLoadsRef: BeamSimulatorState["distributedLoads"];
  readonly directSpanLengthM: BeamSimulatorState["directSpanLengthM"];
  readonly directAxialPuKn: BeamSimulatorState["directAxialPuKn"];
  readonly directMomentMuxKnm: BeamSimulatorState["directMomentMuxKnm"];
  readonly directMomentMuyKnm: BeamSimulatorState["directMomentMuyKnm"];
  readonly directTorsionTuKnm: BeamSimulatorState["directTorsionTuKnm"];
  readonly directShearVuKn: BeamSimulatorState["directShearVuKn"];
  readonly concreteBwMm: BeamSimulatorState["concreteBwMm"];
  readonly concreteHMm: BeamSimulatorState["concreteHMm"];
  readonly concreteCoverMm: BeamSimulatorState["concreteCoverMm"];
  readonly concreteFcMpa: BeamSimulatorState["concreteFcMpa"];
  readonly longitudinalRebarGrade: BeamSimulatorState["longitudinalRebarGrade"];
  readonly stirrupRebarGrade: BeamSimulatorState["stirrupRebarGrade"];
  readonly steelGrade: BeamSimulatorState["steelGrade"];
  readonly steelUnbracedLengthLbM: BeamSimulatorState["steelUnbracedLengthLbM"];
  readonly deflectionLimitDenominator: BeamSimulatorState["deflectionLimitDenominator"];
  readonly concreteViewMode: BeamSimulatorState["concreteViewMode"];
  readonly coordinateMode: BeamSimulatorState["coordinateMode"];
  readonly cameraPreset: CameraPreset | undefined;
  readonly diagramDisplayMode: BeamSimulatorState["diagramDisplayMode"];
  readonly visibleDiagrams: BeamSimulatorState["visibleDiagrams"];
  readonly steelProfileType: BeamSimulatorState["steelProfileType"];
  readonly selectedSteelProfileName: BeamSimulatorState["selectedSteelProfileName"];
  readonly customBoxConfig: BeamSimulatorState["customBoxConfig"];
  readonly isListening: boolean;
  readonly isHandTrackingActive: boolean;
}

function captureMissionBaseline(
  stepId: string,
  store: BeamSimulatorState,
  cameraPreset: CameraPreset | undefined,
  isListening: boolean,
  isHandTrackingActive: boolean,
): MissionBaselineSnapshot {
  return {
    stepId,
    materialKind: store.materialKind,
    loadingMode: store.loadingMode,
    spanLengthM: store.spanLengthM,
    supportOrientation: store.supportOrientation,
    includeSelfWeight: store.includeSelfWeight,
    pointLoadsRef: store.pointLoads,
    distributedLoadsRef: store.distributedLoads,
    directSpanLengthM: store.directSpanLengthM,
    directAxialPuKn: store.directAxialPuKn,
    directMomentMuxKnm: store.directMomentMuxKnm,
    directMomentMuyKnm: store.directMomentMuyKnm,
    directTorsionTuKnm: store.directTorsionTuKnm,
    directShearVuKn: store.directShearVuKn,
    concreteBwMm: store.concreteBwMm,
    concreteHMm: store.concreteHMm,
    concreteCoverMm: store.concreteCoverMm,
    concreteFcMpa: store.concreteFcMpa,
    longitudinalRebarGrade: store.longitudinalRebarGrade,
    stirrupRebarGrade: store.stirrupRebarGrade,
    steelGrade: store.steelGrade,
    steelUnbracedLengthLbM: store.steelUnbracedLengthLbM,
    deflectionLimitDenominator: store.deflectionLimitDenominator,
    concreteViewMode: store.concreteViewMode,
    coordinateMode: store.coordinateMode,
    cameraPreset,
    diagramDisplayMode: store.diagramDisplayMode,
    visibleDiagrams: store.visibleDiagrams,
    steelProfileType: store.steelProfileType,
    selectedSteelProfileName: store.selectedSteelProfileName,
    customBoxConfig: store.customBoxConfig,
    isListening,
    isHandTrackingActive,
  };
}

function hasMissionStateChanged(
  stepId: string,
  baseline: MissionBaselineSnapshot,
  current: {
    store: BeamSimulatorState;
    cameraPreset: CameraPreset | undefined;
    isListening: boolean;
    isHandTrackingActive: boolean;
  },
): boolean {
  if (baseline.stepId !== stepId) {
    return false;
  }
  const { store } = current;

  switch (stepId) {
    case "quest-1-material":
      return (
        store.materialKind !== baseline.materialKind || store.loadingMode !== baseline.loadingMode
      );

    case "quest-2-loads":
      return (
        store.spanLengthM !== baseline.spanLengthM ||
        store.supportOrientation !== baseline.supportOrientation ||
        store.includeSelfWeight !== baseline.includeSelfWeight ||
        store.pointLoads !== baseline.pointLoadsRef ||
        store.distributedLoads !== baseline.distributedLoadsRef ||
        store.directSpanLengthM !== baseline.directSpanLengthM ||
        store.directAxialPuKn !== baseline.directAxialPuKn ||
        store.directMomentMuxKnm !== baseline.directMomentMuxKnm ||
        store.directMomentMuyKnm !== baseline.directMomentMuyKnm ||
        store.directTorsionTuKnm !== baseline.directTorsionTuKnm ||
        store.directShearVuKn !== baseline.directShearVuKn
      );

    case "quest-3-sni":
      return (
        store.concreteBwMm !== baseline.concreteBwMm ||
        store.concreteHMm !== baseline.concreteHMm ||
        store.concreteCoverMm !== baseline.concreteCoverMm ||
        store.concreteFcMpa !== baseline.concreteFcMpa ||
        store.longitudinalRebarGrade !== baseline.longitudinalRebarGrade ||
        store.stirrupRebarGrade !== baseline.stirrupRebarGrade ||
        store.steelGrade !== baseline.steelGrade ||
        store.steelUnbracedLengthLbM !== baseline.steelUnbracedLengthLbM ||
        store.deflectionLimitDenominator !== baseline.deflectionLimitDenominator
      );

    case "quest-4-viewport":
      return (
        current.cameraPreset !== baseline.cameraPreset ||
        store.concreteViewMode !== baseline.concreteViewMode ||
        store.coordinateMode !== baseline.coordinateMode
      );

    case "quest-5-diagrams":
      return (
        store.diagramDisplayMode !== baseline.diagramDisplayMode ||
        store.visibleDiagrams.sfd !== baseline.visibleDiagrams.sfd ||
        store.visibleDiagrams.bmd !== baseline.visibleDiagrams.bmd ||
        store.visibleDiagrams.nfd !== baseline.visibleDiagrams.nfd ||
        store.visibleDiagrams.tfd !== baseline.visibleDiagrams.tfd
      );

    case "quest-6-optimization":
      return (
        store.steelProfileType !== baseline.steelProfileType ||
        store.selectedSteelProfileName !== baseline.selectedSteelProfileName ||
        store.customBoxConfig !== baseline.customBoxConfig
      );

    case "quest-7-ai-voice-gesture":
      return (
        (!baseline.isListening && current.isListening) ||
        (!baseline.isHandTrackingActive && current.isHandTrackingActive)
      );

    default:
      return false;
  }
}

function extractTutorialAction(execution: CommandExecutionResult | null): string | null {
  if (!execution || !execution.payload || typeof execution.payload !== "object") {
    return null;
  }
  const payload = execution.payload as Record<string, unknown>;
  if (typeof payload.tutorialAction === "string") {
    return payload.tutorialAction;
  }
  if (Array.isArray(payload.results)) {
    for (const item of payload.results) {
      if (item && typeof item === "object") {
        const innerPayload = (item as Record<string, unknown>).payload;
        if (innerPayload && typeof innerPayload === "object") {
          const action = (innerPayload as Record<string, unknown>).tutorialAction;
          if (typeof action === "string") {
            return action;
          }
        }
      }
    }
  }
  return null;
}

function triggerBrowserFileDownload(content: string, fileName: string, mimeType: string): void {
  if (typeof document === "undefined" || typeof URL === "undefined") {
    return;
  }
  const blob = new Blob([content], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}

function triggerDirectDxfExport(voice?: UseWebSpeechCommandResult): void {
  if (voice?.executeCommand) {
    voice.executeCommand("EXPORT_DXF");
    return;
  }
  const snapshot = getBeamSimulatorSnapshot();
  const dxf = buildDxfFromSimulatorState(snapshot);
  triggerBrowserFileDownload(dxf.content, dxf.fileName, dxf.mimeType);
  const newlyCompleted = tutorialTourActions.recordDxfExport(dxf.fileName);
  if (newlyCompleted) {
    synthesizeAudioTone("SUCCESS");
  }
}

export type Quest8ExportStage = "OPEN_WINDOW4_BTN" | "SELECT_DXF" | "CLICK_DOWNLOAD";

function resolveQuest8DomState(): {
  readonly stage: Quest8ExportStage;
  readonly selector: string;
  readonly isModalOpen: boolean;
} {
  if (typeof document === "undefined") {
    return {
      stage: "OPEN_WINDOW4_BTN",
      selector: "[data-tutorial-export-trigger='true']",
      isModalOpen: false,
    };
  }
  const modalEl = document.querySelector("[data-tutorial-export-modal='true']");
  if (!modalEl) {
    return {
      stage: "OPEN_WINDOW4_BTN",
      selector: "[data-tutorial-export-trigger='true']",
      isModalOpen: false,
    };
  }
  const dxfCard = modalEl.querySelector("[data-tutorial-export-format='dxf']");
  const isDxfSelected = dxfCard?.getAttribute("data-selected") === "true";
  if (!isDxfSelected) {
    return {
      stage: "SELECT_DXF",
      selector: "[data-tutorial-export-format='dxf']",
      isModalOpen: true,
    };
  }
  return {
    stage: "CLICK_DOWNLOAD",
    selector: "[data-tutorial-export-download='true']",
    isModalOpen: true,
  };
}

function getQuest8StageCopy(
  stage: Quest8ExportStage,
  fallbackStep: TutorialQuestStep,
  isCompleted: boolean,
): {
  readonly ucuyDialogue: string;
  readonly missionTitle: string;
  readonly missionDescription: string;
} {
  if (isCompleted) {
    return {
      ucuyDialogue:
        "Mantap! File AutoCAD (.dxf) sudah terunduh. Klik Lanjut untuk membaca panduan membuka dan menampilkan penampang di AutoCAD.",
      missionTitle: "File AutoCAD (.dxf) siap dibuka",
      missionDescription:
        "Anda dapat menekan 'Lanjut' menuju Misi 9 (Panduan AutoCAD), atau unduh ulang lewat tombol ekspor di bawah.",
    };
  }

  switch (stage) {
    case "SELECT_DXF":
      return {
        ucuyDialogue:
          "Jendela Ekspor sudah terbuka, tapi format .dxf belum terpilih! Klik kartu '.dxf Drawing Exchange Format' yang disorot dulu.",
        missionTitle: "Pilih format .dxf (Drawing Exchange Format)",
        missionDescription:
          "Kartu format .dxf saat ini belum aktif. Klik kartu '.dxf' yang disorot cyan, atau klik tombol 'Ekspor Langsung AutoCAD (.dxf)' di bawah.",
      };
    case "CLICK_DOWNLOAD":
      return {
        ucuyDialogue:
          "Sip! Format .dxf sudah dipilih. Sekarang klik tombol 'Unduh File Pilihan' yang disorot agar gambar DXF langsung tersimpan.",
        missionTitle: "Klik 'Unduh File Pilihan' untuk mengunduh .dxf",
        missionDescription:
          "Tekan tombol 'Unduh File Pilihan' yang disorot di jendela Ekspor (atau gunakan tombol 'Ekspor Langsung AutoCAD (.dxf)' di bawah).",
      };
    case "OPEN_WINDOW4_BTN":
    default:
      return {
        ucuyDialogue: fallbackStep.ucuyDialogue,
        missionTitle: fallbackStep.missionTitle,
        missionDescription: fallbackStep.missionDescription,
      };
  }
}

function computeBoxOverlapArea(
  a: { left: number; top: number; right: number; bottom: number },
  b: { left: number; top: number; right: number; bottom: number },
): number {
  const overlapW = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const overlapH = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return overlapW * overlapH;
}

function computeHudDockClass(rect: SpotlightRect | null, modalRect: SpotlightRect | null): string {
  const avoidRect = modalRect ?? rect;
  if (!avoidRect || typeof window === "undefined") {
    return "sm:bottom-16 sm:right-4";
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const hudW = Math.min(392, vw - 24);
  const hudH = 380;

  const candidates = [
    {
      cls: "sm:bottom-16 sm:right-4",
      box: { left: vw - 16 - hudW, top: vh - 64 - hudH, right: vw - 16, bottom: vh - 64 },
    },
    {
      cls: "sm:top-16 sm:right-4",
      box: { left: vw - 16 - hudW, top: 64, right: vw - 16, bottom: 64 + hudH },
    },
    {
      cls: "sm:top-16 sm:left-4",
      box: { left: 16, top: 64, right: 16 + hudW, bottom: 64 + hudH },
    },
    {
      cls: "sm:bottom-24 sm:left-4",
      box: { left: 16, top: vh - 96 - hudH, right: 16 + hudW, bottom: vh - 96 },
    },
  ];

  const avoidBox = {
    left: avoidRect.left,
    top: avoidRect.top,
    right: avoidRect.left + avoidRect.width,
    bottom: avoidRect.top + avoidRect.height,
  };

  let bestCandidate = candidates[0]!;
  let minOverlap = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const area = computeBoxOverlapArea(candidate.box, avoidBox);
    if (area === 0) {
      return candidate.cls;
    }
    if (area < minOverlap) {
      minOverlap = area;
      bestCandidate = candidate;
    }
  }

  return bestCandidate.cls;
}

function AutoCadWorkflowGuideBox(): ReactElement {
  const layers = [
    { name: "S-SECT-OUTLINE", desc: "Garis luar penampang beton / baja (Putih)" },
    { name: "S-REBAR-STIRRUP", desc: "Detail sengkang penampang (Hijau)" },
    { name: "S-REBAR-MAIN", desc: "Tulangan utama & profil baja (Merah)" },
    { name: "S-ANNO-DIMS", desc: "Garis dimensi & anotasi (Cyan)" },
  ];

  return (
    <div className="space-y-2 rounded-lg border border-emerald-500/35 bg-emerald-950/25 p-2.5 text-[11px]">
      <div className="flex items-center gap-1.5 font-bold text-emerald-300">
        <FileCode2 className="h-3.5 w-3.5 shrink-0" />
        <span>Panduan Cepat Buka DXF di AutoCAD</span>
      </div>
      <ol className="text-foreground/90 list-inside list-decimal space-y-1 text-[10.5px] leading-snug">
        <li>
          Jalankan{" "}
          <code className="rounded bg-slate-900/90 px-1 font-mono text-cyan-300">OPEN</code> di
          AutoCAD dan pilih file <span className="font-semibold text-cyan-200">.dxf</span> yang baru
          terunduh.
        </li>
        <li>
          Ketik <code className="rounded bg-slate-900/90 px-1 font-mono text-cyan-300">ZOOM</code>{" "}
          lalu <code className="rounded bg-slate-900/90 px-1 font-mono text-cyan-300">EXTENTS</code>{" "}
          (<code className="rounded bg-slate-900/90 px-1 font-mono text-cyan-300">Z</code> + Enter,{" "}
          <code className="rounded bg-slate-900/90 px-1 font-mono text-cyan-300">E</code> + Enter)
          agar penampang langsung terlihat dalam satuan <strong>Millimeters</strong>.
        </li>
      </ol>
      <div className="border-t border-emerald-500/20 pt-1.5">
        <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold tracking-wider text-emerald-200/80 uppercase">
          <Layers className="h-3 w-3" />
          <span>4 Layer Standar Otomatis</span>
        </div>
        <div className="grid grid-cols-1 gap-1">
          {layers.map((layer) => (
            <div
              key={layer.name}
              className="flex items-center justify-between gap-2 rounded bg-slate-950/60 px-1.5 py-0.5 text-[10px]"
            >
              <code className="font-mono font-semibold text-cyan-300">{layer.name}</code>
              <span className="text-muted-foreground truncate text-[9.5px]">{layer.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Overlay Tutorial Interaktif ("IBDS Engineer Quest") dengan spotlight non-blocking,
 * progres misi otomatis, suara live (Web Speech API + narasi TTS), dan ekspor langsung DXF.
 */
export function InteractiveTutorialOverlay({
  voice,
  cameraPreset,
  onMobileTabChange,
  isHandTrackingActive = false,
}: InteractiveTutorialOverlayProps): ReactElement | null {
  const tutorial = useTutorialTourStore();
  const store = useBeamSimulatorStore();
  const windowStore = useFloatingWindowStore();

  const [isClientMounted, setIsClientMounted] = useState(false);
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);
  const [exportModalRect, setExportModalRect] = useState<SpotlightRect | null>(null);
  const [quest8Stage, setQuest8Stage] = useState<Quest8ExportStage>("OPEN_WINDOW4_BTN");
  const reticleRef = useRef<HTMLDivElement | null>(null);
  const measureTargetRef = useRef<(() => void) | null>(null);
  const baselineRef = useRef<MissionBaselineSnapshot | null>(null);
  const processedExecTimestampRef = useRef<number | null>(null);
  const narratedSessionStepRef = useRef<string | null>(null);
  const activeSessionRef = useRef<number>(0);

  useEffect(() => {
    setIsClientMounted(true);
  }, []);

  const activeStep: TutorialQuestStep | undefined =
    TUTORIAL_QUEST_STEPS[tutorial.currentStepIndex] ?? TUTORIAL_QUEST_STEPS[0];
  const activeTargetWindow = activeStep?.targetWindowId
    ? windowStore.windows[activeStep.targetWindowId]
    : undefined;
  const effectiveTargetSelector =
    activeStep?.id === "quest-8-export-dxf"
      ? resolveQuest8DomState().selector
      : activeStep?.targetSelector;

  const isStepCompleted = Boolean(activeStep && tutorial.completedStepIds.includes(activeStep.id));
  const isFinalStep = tutorial.currentStepIndex >= TOTAL_TUTORIAL_STEPS - 1;

  const completeWithAudio = useCallback((stepId: string, withAudio = true) => {
    const newlyCompleted = tutorialTourActions.markStepCompleted(stepId);
    if (newlyCompleted && withAudio) {
      synthesizeAudioTone("SUCCESS");
    }
  }, []);

  // 1. Buka floating window / tab mobile otomatis & reset baseline saat pindah misi
  useEffect(() => {
    if (!tutorial.isActive || !activeStep) {
      baselineRef.current = null;
      return;
    }

    baselineRef.current = captureMissionBaseline(
      activeStep.id,
      getBeamSimulatorSnapshot(),
      cameraPreset,
      voice?.isListening ?? false,
      isHandTrackingActive,
    );

    if (activeStep.targetWindowId) {
      floatingWindowActions.openWindow(activeStep.targetWindowId);
    }
    if (activeStep.mobileTab && onMobileTabChange) {
      onMobileTabChange(activeStep.mobileTab);
    }
    if (activeStep.id === "quest-8-export-dxf") {
      const next = resolveQuest8DomState();
      setQuest8Stage(next.stage);
      const scrollTimer = window.setTimeout(() => {
        const triggerBtn = document.querySelector("[data-tutorial-export-trigger='true']");
        if (triggerBtn && typeof triggerBtn.scrollIntoView === "function") {
          triggerBtn.scrollIntoView({ block: "nearest" });
        }
      }, 130);
      return () => window.clearTimeout(scrollTimer);
    }
    if (activeStep.id === "quest-9-autocad-guide" && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("app:close-export-modal"));
    }
    // Sengaja dipicu saat perpindahan step / aktivasi tutorial
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorial.isActive, activeStep?.id]);

  // 1b. Pantau pembukaan modal ekspor dan pilihan format .dxf saat di Misi 8
  useEffect(() => {
    if (
      !tutorial.isActive ||
      activeStep?.id !== "quest-8-export-dxf" ||
      typeof document === "undefined"
    ) {
      setExportModalRect(null);
      setQuest8Stage("OPEN_WINDOW4_BTN");
      return;
    }

    const syncQuest8Dom = (): void => {
      const resolved = resolveQuest8DomState();
      setQuest8Stage((prev) => (prev === resolved.stage ? prev : resolved.stage));
      const modalEl = document.querySelector("[data-tutorial-export-modal='true']");
      if (!modalEl) {
        setExportModalRect((prev) => (prev === null ? prev : null));
        return;
      }
      const r = modalEl.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) {
        return;
      }
      setExportModalRect((prev) => {
        const next = {
          top: Math.round(r.top),
          left: Math.round(r.left),
          width: Math.round(r.width),
          height: Math.round(r.height),
        };
        if (
          prev &&
          prev.top === next.top &&
          prev.left === next.left &&
          prev.width === next.width &&
          prev.height === next.height
        ) {
          return prev;
        }
        return next;
      });
    };

    syncQuest8Dom();

    let observer: MutationObserver | null = null;
    if (typeof MutationObserver !== "undefined") {
      observer = new MutationObserver(() => {
        syncQuest8Dom();
        window.requestAnimationFrame(() => measureTargetRef.current?.());
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["data-selected", "data-state"],
      });
    }

    return () => {
      observer?.disconnect();
    };
  }, [tutorial.isActive, activeStep?.id]);

  // 2. Narasi suara Ucuy opsional (STT otomatis jeda & lanjut via speakFeedback)
  useEffect(() => {
    if (!tutorial.isActive) {
      narratedSessionStepRef.current = null;
      return;
    }
    activeSessionRef.current += 1;
    const sessionKey = `${activeSessionRef.current}:${activeStep?.id ?? ""}`;
    if (!tutorial.isVoiceNarrationEnabled || !activeStep || !voice?.speakFeedback) {
      return;
    }
    if (narratedSessionStepRef.current === sessionKey) {
      return;
    }
    const timer = window.setTimeout(() => {
      narratedSessionStepRef.current = sessionKey;
      void voice.speakFeedback(activeStep.voiceNarration);
    }, 240);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorial.isActive, tutorial.isVoiceNarrationEnabled, activeStep?.id]);

  // 3. Pantau perubahan state simulator (mouse / keyboard / sentuh) untuk auto-complete misi
  useEffect(() => {
    if (!tutorial.isActive || !activeStep || !baselineRef.current) {
      return;
    }
    if (
      hasMissionStateChanged(activeStep.id, baselineRef.current, {
        store,
        cameraPreset,
        isListening: voice?.isListening ?? false,
        isHandTrackingActive,
      })
    ) {
      completeWithAudio(activeStep.id, true);
    }
  }, [
    tutorial.isActive,
    activeStep,
    store,
    cameraPreset,
    isHandTrackingActive,
    voice?.isListening,
    completeWithAudio,
  ]);

  // 4. Pantau hasil eksekusi perintah suara (Live Voice Commands)
  useEffect(() => {
    if (!tutorial.isActive || !activeStep || !voice?.lastExecution) {
      return;
    }
    const exec = voice.lastExecution;
    if (!exec.success || processedExecTimestampRef.current === exec.timestamp) {
      return;
    }
    processedExecTimestampRef.current = exec.timestamp;

    // Abaikan perintah navigasi tutorial agar tidak tidak sengaja menuntaskan Misi 7
    if (extractTutorialAction(exec)) {
      return;
    }

    const matchesAccepted = activeStep.acceptedCommandIds.includes(exec.commandId);
    const matchesAiConsultation =
      activeStep.id === "quest-7-ai-voice-gesture" && exec.commandId === "AI_CONSULTATION";

    if (matchesAccepted || matchesAiConsultation) {
      completeWithAudio(activeStep.id, false);
    }
  }, [tutorial.isActive, activeStep, voice?.lastExecution, completeWithAudio]);

  // 5. Event global: DXF exported, kamera toolbar events, navigasi suara tutorial, klik target window, & Escape
  useEffect(() => {
    const handleDxfExported = (ev: Event): void => {
      const detail = (ev as CustomEvent<{ fileName?: string }>).detail;
      const fileName = detail?.fileName || "IBDS-Section.dxf";
      tutorialTourActions.recordDxfExport(fileName);
    };

    const handleTutorialControl = (ev: Event): void => {
      const action = (ev as CustomEvent<{ action?: string }>).detail?.action;
      switch (action) {
        case "START":
          tutorialTourActions.startTutorial(0);
          break;
        case "NEXT":
          tutorialTourActions.nextStep();
          break;
        case "PREV":
          tutorialTourActions.prevStep();
          break;
        case "REPEAT":
          if (activeStep && voice?.speakFeedback) {
            void voice.speakFeedback(activeStep.voiceNarration);
          }
          break;
        case "STOP":
          tutorialTourActions.stopTutorial(true);
          break;
      }
    };

    const handleCameraAction = (): void => {
      if (tutorial.isActive && activeStep?.id === "quest-4-viewport") {
        completeWithAudio("quest-4-viewport", true);
      }
    };

    const handleTargetInteraction = (ev: Event): void => {
      if (!tutorial.isActive || !activeStep) {
        return;
      }
      const target = ev.target as HTMLElement | null;
      if (!target) {
        return;
      }
      if (activeStep.id === "quest-6-optimization") {
        const panel = target.closest("[data-window-id='OPTIMIZATION_RESULTS']");
        const actionEl = target.closest("button, [role='button'], tr[data-profile-row]");
        if (panel && actionEl) {
          completeWithAudio("quest-6-optimization", true);
        }
      } else if (activeStep.id === "quest-7-ai-voice-gesture") {
        const panel = target.closest("[data-window-id='GESTURE_AI_ASSISTANT']");
        const actionEl = target.closest("button, [type='submit'], input, textarea");
        if (panel && actionEl) {
          completeWithAudio("quest-7-ai-voice-gesture", true);
        }
      }
    };

    const handleKeyDown = (ev: KeyboardEvent): void => {
      if (ev.key !== "Escape") {
        return;
      }
      if (tutorial.isActive) {
        tutorialTourActions.stopTutorial(true);
      } else if (tutorial.isWelcomeOpen) {
        tutorialTourActions.dismissWelcome();
      }
    };

    window.addEventListener("app:dxf-exported", handleDxfExported);
    window.addEventListener("app:tutorial-control", handleTutorialControl);
    window.addEventListener("app:camera-fit", handleCameraAction);
    window.addEventListener("app:camera-preset", handleCameraAction);
    window.addEventListener("app:camera-control", handleCameraAction);
    window.addEventListener("click", handleTargetInteraction, true);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("app:dxf-exported", handleDxfExported);
      window.removeEventListener("app:tutorial-control", handleTutorialControl);
      window.removeEventListener("app:camera-fit", handleCameraAction);
      window.removeEventListener("app:camera-preset", handleCameraAction);
      window.removeEventListener("app:camera-control", handleCameraAction);
      window.removeEventListener("click", handleTargetInteraction, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [tutorial.isActive, tutorial.isWelcomeOpen, activeStep, voice, completeWithAudio]);

  // 6. Pelacakan real-time bounding box target DOM (capture pointer, ResizeObserver, MutationObserver)
  useEffect(() => {
    if (!tutorial.isActive || !effectiveTargetSelector || typeof document === "undefined") {
      measureTargetRef.current = null;
      setSpotlightRect(null);
      return;
    }

    let rafId = 0;
    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;
    let observedElement: Element | null = null;

    const measure = (): void => {
      const el = effectiveTargetSelector ? document.querySelector(effectiveTargetSelector) : null;
      if (!el) {
        setSpotlightRect((prev) => (prev === null ? prev : null));
        return;
      }
      if (el !== observedElement) {
        resizeObserver?.disconnect();
        mutationObserver?.disconnect();
        observedElement = el;
        if (typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(scheduleMeasure);
          resizeObserver.observe(el);
        }
        if (typeof MutationObserver !== "undefined") {
          mutationObserver = new MutationObserver(measure);
          mutationObserver.observe(el, {
            attributes: true,
            attributeFilter: ["style", "class"],
          });
        }
      }

      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) {
        setSpotlightRect((prev) => (prev === null ? prev : null));
        return;
      }

      const nextTop = Math.max(4, Math.round(r.top - 4));
      const nextLeft = Math.max(4, Math.round(r.left - 4));
      const nextWidth = Math.round(r.width + 8);
      const nextHeight = Math.round(r.height + 8);

      if (reticleRef.current) {
        reticleRef.current.style.top = `${nextTop}px`;
        reticleRef.current.style.left = `${nextLeft}px`;
        reticleRef.current.style.width = `${nextWidth}px`;
        reticleRef.current.style.height = `${nextHeight}px`;
      }

      setSpotlightRect((prev) => {
        if (
          prev &&
          prev.top === nextTop &&
          prev.left === nextLeft &&
          prev.width === nextWidth &&
          prev.height === nextHeight
        ) {
          return prev;
        }
        return {
          top: nextTop,
          left: nextLeft,
          width: nextWidth,
          height: nextHeight,
        };
      });
    };

    const scheduleMeasure = (): void => {
      window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(measure);
    };

    measureTargetRef.current = measure;
    measure();

    const capturePassive: AddEventListenerOptions = { capture: true, passive: true };
    const initialTimer = window.setTimeout(measure, 90);
    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("pointerdown", scheduleMeasure, capturePassive);
    window.addEventListener("pointermove", scheduleMeasure, capturePassive);
    window.addEventListener("pointerup", scheduleMeasure, capturePassive);
    window.addEventListener("scroll", scheduleMeasure, capturePassive);

    return () => {
      measureTargetRef.current = null;
      window.clearTimeout(initialTimer);
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("pointerdown", scheduleMeasure, { capture: true });
      window.removeEventListener("pointermove", scheduleMeasure, { capture: true });
      window.removeEventListener("pointerup", scheduleMeasure, { capture: true });
      window.removeEventListener("scroll", scheduleMeasure, { capture: true });
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
    };
  }, [tutorial.isActive, activeStep?.id, effectiveTargetSelector, quest8Stage]);

  // Sinkronkan posisi reticle saat store posisi/ukuran floating window berubah (termasuk gestur tangan)
  useEffect(() => {
    if (!tutorial.isActive) {
      return;
    }
    measureTargetRef.current?.();
  }, [
    tutorial.isActive,
    activeTargetWindow?.x,
    activeTargetWindow?.y,
    activeTargetWindow?.width,
    activeTargetWindow?.isOpen,
    activeTargetWindow?.isMinimized,
    quest8Stage,
  ]);

  const hudDockClass = useMemo(
    () => computeHudDockClass(spotlightRect, exportModalRect),
    [spotlightRect, exportModalRect],
  );

  const handleRunVoiceExample = useCallback(() => {
    if (!activeStep || !voice?.executeTranscript) {
      return;
    }
    voice.executeTranscript(activeStep.voiceCommandExample);
  }, [activeStep, voice]);

  const renderInPortal = (node: ReactElement): ReactElement => {
    if (isClientMounted && typeof document !== "undefined") {
      return createPortal(node, document.body);
    }
    return node;
  };

  // Welcome Prompt Card (First Visit)
  if (!tutorial.isActive && tutorial.isWelcomeOpen) {
    return renderInPortal(
      <div
        role="dialog"
        aria-modal="false"
        aria-labelledby="tutorial-welcome-title"
        data-tutorial-hud="true"
        data-testid="tutorial-welcome-dialog"
        style={{ pointerEvents: "auto" }}
        className="pointer-events-auto fixed inset-x-3 bottom-4 z-[9995] mx-auto w-[min(26rem,calc(100vw-1.5rem))] sm:inset-x-auto sm:right-5 sm:bottom-5 sm:mx-0"
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <div className="rounded-xl border border-cyan-400/45 bg-slate-950/95 p-4 shadow-[0_20px_50px_rgba(6,182,212,0.22)] backdrop-blur-xl">
          <div className="mb-2.5 flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-400/40 bg-cyan-500/15 text-cyan-300">
                <Gamepad2 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-wider text-cyan-400 uppercase">
                  IBDS Engineer Quest • Tur Interaktif
                </p>
                <h2 id="tutorial-welcome-title" className="text-foreground text-sm font-extrabold">
                  Baru pertama kali memakai IBDS?
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={() => tutorialTourActions.dismissWelcome()}
              aria-label="Tutup sambutan tutorial"
              className="text-muted-foreground hover:text-foreground rounded-md p-1 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="text-muted-foreground mb-3 text-xs leading-relaxed">
            Ikuti <span className="text-foreground font-semibold">9 misi interaktif</span> bersama
            asisten AI <span className="font-semibold text-cyan-300">Ucuy</span> — mendukung kendali
            mouse maupun{" "}
            <span className="font-semibold text-emerald-300">perintah suara langsung</span> hingga
            ekspor file <span className="font-semibold text-violet-300">AutoCAD (.dxf)</span>!
          </p>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => tutorialTourActions.dismissWelcome()}
              className="h-8 border-slate-700 bg-slate-900/80 text-xs"
            >
              Nanti Saja
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => tutorialTourActions.startTutorial(0)}
              className="h-8 gap-1.5 bg-linear-to-r from-cyan-400 to-violet-500 text-xs font-bold text-slate-950 hover:brightness-110"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Mulai Misi Tutorial
            </Button>
          </div>
        </div>
      </div>,
    );
  }

  if (!tutorial.isActive || !activeStep) {
    return null;
  }

  const progressPct = Math.round(((tutorial.currentStepIndex + 1) / TOTAL_TUTORIAL_STEPS) * 100);
  const questCopy =
    activeStep.id === "quest-8-export-dxf"
      ? getQuest8StageCopy(quest8Stage, activeStep, isStepCompleted)
      : {
          ucuyDialogue: activeStep.ucuyDialogue,
          missionTitle: activeStep.missionTitle,
          missionDescription: activeStep.missionDescription,
        };

  return renderInPortal(
    <>
      {/* 1. Non-blocking Spotlight Reticle agar user tetap bebas klik / geser slider target */}
      {spotlightRect && (
        <div
          ref={reticleRef}
          aria-hidden="true"
          data-testid="tutorial-spotlight-reticle"
          className="pointer-events-none fixed z-[9990] rounded-xl border-2 border-cyan-400 shadow-[0_0_0_2px_rgba(6,182,212,0.28),0_0_26px_rgba(34,211,238,0.45)]"
          style={{
            top: spotlightRect.top,
            left: spotlightRect.left,
            width: spotlightRect.width,
            height: spotlightRect.height,
          }}
        >
          <span className="absolute -top-3 left-3 inline-flex items-center gap-1 rounded-full border border-cyan-300/70 bg-cyan-950/95 px-2 py-0.5 text-[10px] font-bold text-cyan-200 shadow-lg">
            <Sparkles className="h-2.5 w-2.5 text-cyan-300" />
            TARGET MISI {activeStep.stepNumber}
          </span>
        </div>
      )}

      {/* 2. Quest HUD Card (Reflow aman >=320px, z-index di atas canvas, window, & dialog ekspor) */}
      <aside
        role="dialog"
        aria-modal="false"
        aria-labelledby="tutorial-quest-title"
        data-tutorial-hud="true"
        data-testid="tutorial-quest-hud"
        style={{ pointerEvents: "auto" }}
        className={`pointer-events-auto fixed z-[9995] max-sm:inset-x-2 max-sm:bottom-2 max-sm:max-h-[72dvh] max-sm:overflow-y-auto sm:w-[min(24.5rem,calc(100vw-1.5rem))] ${hudDockClass}`}
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <div className="rounded-xl border border-cyan-400/50 bg-slate-950/95 p-3.5 shadow-[0_22px_60px_rgba(2,132,199,0.28)] backdrop-blur-xl">
          {/* Header Quest Progress & Exit */}
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-cyan-500/40 bg-cyan-500/15 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
                <Gamepad2 className="h-3 w-3" />
                {activeStep.stepNumber}/{TOTAL_TUTORIAL_STEPS}
              </span>
              <span className="truncate text-[10px] font-semibold tracking-wide text-violet-300 uppercase">
                {activeStep.badgeLabel}
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => tutorialTourActions.toggleVoiceNarration()}
                title={
                  tutorial.isVoiceNarrationEnabled
                    ? "Matikan narasi suara Ucuy"
                    : "Aktifkan narasi suara Ucuy"
                }
                aria-label={
                  tutorial.isVoiceNarrationEnabled
                    ? "Matikan narasi suara Ucuy"
                    : "Aktifkan narasi suara Ucuy"
                }
                className={`rounded-md border px-1.5 py-1 text-[10px] font-semibold transition-colors ${
                  tutorial.isVoiceNarrationEnabled
                    ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25"
                    : "border-slate-700 bg-slate-900/70 text-slate-400 hover:text-slate-200"
                }`}
              >
                {tutorial.isVoiceNarrationEnabled ? (
                  <Volume2 className="h-3.5 w-3.5" />
                ) : (
                  <VolumeX className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => tutorialTourActions.stopTutorial(true)}
                aria-label="Lewati dan tutup tutorial (Esc)"
                title="Lewati tutorial (Esc)"
                className="text-muted-foreground hover:text-foreground rounded-md p-1 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Progress Bar + Step Dots */}
          <div className="mb-2.5 space-y-1.5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-linear-to-r from-cyan-400 via-sky-400 to-violet-500 transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex items-center gap-1">
              {TUTORIAL_QUEST_STEPS.map((step, idx) => {
                const done = tutorial.completedStepIds.includes(step.id);
                const active = idx === tutorial.currentStepIndex;
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => tutorialTourActions.goToStep(idx)}
                    title={`Misi ${step.stepNumber}: ${step.title}`}
                    aria-label={`Buka Misi ${step.stepNumber}: ${step.title}`}
                    className={`h-1.5 flex-1 rounded-full transition-all ${
                      active
                        ? "bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.85)]"
                        : done
                          ? "bg-emerald-400/80 hover:bg-emerald-300"
                          : "bg-slate-700/80 hover:bg-slate-600"
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {/* Title & Completion Badge */}
          <div className="mb-2 flex items-start justify-between gap-2">
            <h2
              id="tutorial-quest-title"
              className="text-foreground text-sm leading-snug font-extrabold"
            >
              {activeStep.title}
            </h2>
            {isStepCompleted && (
              <span
                data-testid="tutorial-mission-completed-badge"
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-400/50 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-extrabold text-emerald-300"
              >
                <CheckCircle2 className="h-3 w-3" />
                MISI SELESAI!
              </span>
            )}
          </div>

          {/* Ucuy Dialogue Bubble */}
          <div className="mb-2.5 flex items-start gap-2 rounded-lg border border-cyan-500/25 bg-cyan-950/30 p-2">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-cyan-400/40 bg-cyan-500/20 text-cyan-300">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <p className="text-foreground/90 text-[11.5px] leading-relaxed">
              <span className="font-bold text-cyan-300">Ucuy:</span> &ldquo;
              {questCopy.ucuyDialogue}&rdquo;
            </p>
          </div>

          {/* Interactive Mission Objective */}
          <div className="mb-2.5 rounded-lg border border-slate-700/80 bg-slate-900/75 p-2.5">
            <p className="text-[10px] font-bold tracking-wider text-amber-300 uppercase">
              Target Misi
            </p>
            <p className="text-foreground mt-0.5 text-xs font-semibold">{questCopy.missionTitle}</p>
            <p className="text-muted-foreground mt-1 text-[11px] leading-snug">
              {questCopy.missionDescription}
            </p>

            {/* Quest 8 Special Action: Direct AutoCAD .DXF Export (tanpa buka modal & tanpa LSP) */}
            {activeStep.questKind === "EXPORT_DXF" && (
              <div className="mt-2.5 space-y-1.5">
                <Button
                  type="button"
                  size="sm"
                  data-testid="tutorial-direct-dxf-export-btn"
                  onClick={() => triggerDirectDxfExport(voice)}
                  className="h-8 w-full gap-1.5 bg-linear-to-r from-cyan-400 to-emerald-400 text-xs font-bold text-slate-950 hover:brightness-110"
                >
                  <Download className="h-3.5 w-3.5" />
                  Ekspor Langsung AutoCAD (.dxf)
                </Button>
                {tutorial.lastExportedDxfFile && (
                  <p
                    data-testid="tutorial-dxf-downloaded-info"
                    className="flex items-center gap-1 rounded border border-emerald-500/35 bg-emerald-500/15 px-2 py-1 text-[10.5px] font-medium text-emerald-300"
                  >
                    <CheckCircle2 className="h-3 w-3 shrink-0" />
                    File terunduh:{" "}
                    <code className="truncate font-mono">{tutorial.lastExportedDxfFile}</code>
                  </p>
                )}
              </div>
            )}

            {/* Quest 9 Special Guide: How to Open & Use .DXF in AutoCAD */}
            {activeStep.questKind === "AUTOCAD_GUIDE" && (
              <div className="mt-2.5">
                <AutoCadWorkflowGuideBox />
              </div>
            )}
          </div>

          {/* Live Voice Input Bar */}
          <div className="mb-3 rounded-lg border border-violet-500/30 bg-violet-950/20 p-2">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                {voice?.isListening ? (
                  <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-400" />
                ) : (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-slate-500" />
                )}
                <span className="truncate text-[10px] font-bold tracking-wider text-violet-200 uppercase">
                  {voice?.isListening ? "Live Voice Input Aktif" : "Perintah Suara Langsung"}
                </span>
              </div>

              <div className="flex items-center gap-1">
                {voice?.speakFeedback && (
                  <button
                    type="button"
                    onClick={() => void voice.speakFeedback(activeStep.voiceNarration)}
                    title="Bacakan ulang instruksi Ucuy"
                    className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-900/90 px-1.5 py-0.5 text-[10px] font-medium text-slate-300 hover:border-cyan-500/50 hover:text-cyan-200"
                  >
                    <RotateCcw className="h-2.5 w-2.5" />
                    Bacakan
                  </button>
                )}
                {voice && (
                  <button
                    type="button"
                    onClick={() => voice.toggleListening()}
                    disabled={!voice.isSupported}
                    aria-label={
                      voice.isListening ? "Matikan mikrofon live" : "Nyalakan mikrofon live"
                    }
                    className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold transition-colors disabled:opacity-50 ${
                      voice.isListening
                        ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-200"
                        : "border-violet-400/40 bg-violet-500/20 text-violet-200 hover:bg-violet-500/30"
                    }`}
                  >
                    {voice.isListening ? (
                      <>
                        <Mic className="h-2.5 w-2.5" />
                        Mic On
                      </>
                    ) : (
                      <>
                        <MicOff className="h-2.5 w-2.5" />
                        Mic Off
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {voice?.transcript && (
              <p className="mb-1.5 truncate rounded bg-slate-950/70 px-2 py-0.5 text-[10.5px] text-cyan-200">
                🎙️ &ldquo;{voice.transcript}&rdquo;
              </p>
            )}

            <button
              type="button"
              onClick={handleRunVoiceExample}
              disabled={!voice?.executeTranscript}
              className="flex w-full items-center justify-between gap-2 rounded-md border border-cyan-500/30 bg-slate-900/80 px-2 py-1 text-left text-[11px] text-cyan-200 transition-colors hover:border-cyan-400/60 hover:bg-cyan-500/10 disabled:cursor-default disabled:opacity-75"
            >
              <span className="truncate">
                🗣️ Coba ucap/klik:{" "}
                <strong className="text-cyan-300">
                  &ldquo;{activeStep.voiceCommandExample}&rdquo;
                </strong>
              </span>
              <span className="shrink-0 rounded bg-cyan-500/20 px-1.5 py-0.5 text-[9.5px] font-bold text-cyan-200">
                Jalankan
              </span>
            </button>
          </div>

          {/* Footer Navigation */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => tutorialTourActions.prevStep()}
                disabled={tutorial.currentStepIndex === 0}
                className="h-8 gap-1 border-slate-700 bg-slate-900/80 px-2.5 text-xs"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Kembali
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => tutorialTourActions.stopTutorial(true)}
                className="text-muted-foreground hover:text-foreground h-8 px-2 text-[11px]"
              >
                Lewati
              </Button>
            </div>

            {isFinalStep ? (
              <Button
                type="button"
                size="sm"
                data-testid="tutorial-finish-btn"
                onClick={() => tutorialTourActions.finishTutorial()}
                className="h-8 gap-1.5 bg-linear-to-r from-emerald-400 to-cyan-400 px-3 text-xs font-extrabold text-slate-950 hover:brightness-110"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Selesai &amp; Tutup
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                data-testid="tutorial-next-btn"
                onClick={() => tutorialTourActions.nextStep()}
                className="h-8 gap-1 bg-cyan-400 px-3 text-xs font-extrabold text-slate-950 hover:bg-cyan-300"
              >
                Lanjut
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </aside>
    </>,
  );
}
