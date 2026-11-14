/**
 * @file DesktopWorkstationView.tsx
 * @description Master desktop workstation UI combining:
 * - Erzysh Dark Void Theme background
 * - SSR-isolated 3D Extruded Beam WebGL viewport
 * - 2D Support Symbols & Multi-Mode Diagrams synchronized to camera projections
 * - 6 Draggable Floating Windows with smart layout and pointer event isolation
 * - Deflection HUD, Colorbar legend, and 3D Axis Switcher
 * - Multi-format CAD/BIM/CAE export modal
 */

"use client";

import dynamic from "next/dynamic";
import React, { type ReactElement, useEffect, useMemo, useRef, useState } from "react";

import { StructuralAiAssistantPanel } from "@/components/assistant/StructuralAiAssistantPanel";
import { VoiceCommandStatusToast } from "@/components/assistant/VoiceCommandStatusToast";
import type {
  CameraPreset,
  ViewportProjectionSnapshot,
} from "@/components/canvas/Beam3DExtrudedViewport";
import { CoordinateAxisSwitcher } from "@/components/canvas/CoordinateAxisSwitcher";
import { DeflectionHudAndColorbar } from "@/components/canvas/DeflectionHudAndColorbar";
import { ErzyshDarkGridBackground } from "@/components/canvas/ErzyshDarkGridBackground";
import {
  MultiModeDiagram2DOverlay,
  SingleDiagramCard,
} from "@/components/canvas/MultiModeDiagram2DOverlay";
import { SupportSymbols2DOverlay } from "@/components/canvas/SupportSymbols2DOverlay";
import { ConcreteDesignParametersForm } from "@/components/forms/ConcreteDesignParametersForm";
import { DirectInternalForcesForm } from "@/components/forms/DirectInternalForcesForm";
import { ExternalLoadInteractiveForm } from "@/components/forms/ExternalLoadInteractiveForm";
import { MaterialAndLoadModeSelector } from "@/components/forms/MaterialAndLoadModeSelector";
import { SteelDesignParametersForm } from "@/components/forms/SteelDesignParametersForm";
import { ConcreteOptimizationResultCard } from "@/components/results/ConcreteOptimizationResultCard";
import { ProfileAndModelExportModal } from "@/components/results/ProfileAndModelExportModal";
import { SteelOptimizationRankingTable } from "@/components/results/SteelOptimizationRankingTable";
import { CustomEpochVisitorFlexBadge } from "@/components/telemetry/CustomEpochVisitorFlexBadge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { DraggableFloatingWindow } from "@/components/windows/DraggableFloatingWindow";
import { DynamicHandCursorOverlay } from "@/components/windows/DynamicHandCursorOverlay";
import { HandTrackingCameraPreview } from "@/components/windows/HandTrackingCameraPreview";
import { useMediapipeHandTracking } from "@/hooks/use-mediapipe-hand-tracking";
import { useStructuralSolverEngine } from "@/hooks/use-structural-solver-engine";
import { useWebSpeechCommand } from "@/hooks/use-web-speech-command";
import { cn } from "@/lib/utils";
import { beamSimulatorActions, useBeamSimulatorStore } from "@/state/beam-simulator-store";
import {
  floatingWindowActions,
  type FloatingWindowId,
  useFloatingWindowStore,
} from "@/state/floating-window-store";
import type { PointLoad } from "@/types/beam-loading-modes";
import type { Kilonewton, Meter } from "@/types/branded-units";

// Dynamically import Beam3DExtrudedViewport with SSR disabled
const DynamicBeam3DViewport = dynamic(() => import("@/components/canvas/Beam3DExtrudedViewport"), {
  ssr: false,
});

export function DesktopWorkstationView(): ReactElement {
  const store = useBeamSimulatorStore();
  const windowStore = useFloatingWindowStore();
  const {
    meshViews,
    rebarCageViews,
    stationViews,
    maxDeflectionMm,
    maxDeflectionStationM,
    compliance,
    concreteResult,
    steelResult,
  } = useStructuralSolverEngine();

  const [projection, setProjection] = useState<ViewportProjectionSnapshot | null>(null);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>("ISOMETRIC_3D");
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  const tracking = useMediapipeHandTracking();
  const voice = useWebSpeechCommand();

  // Camera voice control event listener
  useEffect(() => {
    const handleCamera = (e: Event) => {
      const detail = (e as CustomEvent<{ action: string }>).detail;
      const act = detail?.action;
      if (act === "STOP") {
        tracking.stopTracking();
      } else if (act === "START") {
        void tracking.startTracking();
      } else if (act === "TOGGLE") {
        void tracking.toggleRunning();
      }
    };
    window.addEventListener("app:camera-control", handleCamera);
    return () => window.removeEventListener("app:camera-control", handleCamera);
  }, [tracking]);

  // Camera preset view listener (e.g. 3D Isometric or Front 2D from AI voice command)
  useEffect(() => {
    const handlePreset = (e: Event) => {
      const detail = (e as CustomEvent<{ preset: CameraPreset }>).detail;
      if (detail?.preset) {
        setCameraPreset(detail.preset);
      }
    };
    window.addEventListener("app:camera-preset", handlePreset);
    return () => window.removeEventListener("app:camera-preset", handlePreset);
  }, []);

  // Export modal voice trigger listener
  useEffect(() => {
    const handleExport = () => {
      setIsExportModalOpen((prev) => !prev);
    };
    window.addEventListener("app:toggle-export-modal", handleExport);
    return () => window.removeEventListener("app:toggle-export-modal", handleExport);
  }, []);

  // Compute 2D screen projection and station along 3D beam axis (adapted from prototype/hand-tracking/engine.ts)
  const beamInteraction = useMemo(() => {
    const screenW = typeof window !== "undefined" ? window.innerWidth : 1920;
    const screenH = typeof window !== "undefined" ? window.innerHeight : 1080;
    const cx =
      tracking.state.screenCoordinates.x >= 0 ? tracking.state.screenCoordinates.x : screenW * 0.5;
    const cy =
      tracking.state.screenCoordinates.y >= 0 ? tracking.state.screenCoordinates.y : screenH * 0.5;
    const spanLength = (store.spanLengthM as number) ?? 6;

    if (projection?.endAScreen && projection?.endBScreen) {
      const ax = projection.endAScreen.x;
      const ay = projection.endAScreen.y;
      const bx = projection.endBScreen.x;
      const by = projection.endBScreen.y;
      const dx = bx - ax;
      const dy = by - ay;
      const lenSq = dx * dx + dy * dy;
      if (lenSq >= 1) {
        const tRaw = ((cx - ax) * dx + (cy - ay) * dy) / lenSq;
        const t = Math.max(0.05, Math.min(0.95, tRaw));
        const projX = ax + t * dx;
        const projY = ay + t * dy;
        const stationM = Math.round(t * spanLength * 100) / 100;
        const normY = Math.min(Math.max((cy - screenH * 0.15) / (screenH * 0.45), 0.05), 1.0);
        const magKn = Math.round(25 + normY * 225);

        return {
          t,
          stationM,
          magKn,
          projX,
          projY,
        };
      }
    }

    // Fallback screen-space beam mapping from prototype/hand-tracking/engine.ts lines 534-545
    const beamLeft = screenW * 0.16;
    const beamRight = screenW * 0.84;
    const beamWidthPx = Math.max(beamRight - beamLeft, 100);
    const t = Math.min(Math.max((cx - beamLeft) / beamWidthPx, 0.05), 0.95);
    const normY = Math.min(Math.max((cy - screenH * 0.15) / (screenH * 0.45), 0.05), 1.0);
    const stationM = Math.round(t * spanLength * 100) / 100;
    const magKn = Math.round(25 + normY * 225);
    const projX = beamLeft + t * beamWidthPx;
    const projY = screenH * 0.45;

    return {
      t,
      stationM,
      magKn,
      projX,
      projY,
    };
  }, [projection, tracking.state.screenCoordinates, store.spanLengthM]);

  // 1. TWO_FINGER_GRAB (▣): Grab & move floating window (adapted from prototype/hand-tracking/engine.ts lines 499-517)
  const grabbedWindowRef = useRef<{
    id: FloatingWindowId;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  useEffect(() => {
    if (!tracking.state.isRunning || tracking.state.activeGesture !== "TWO_FINGER_GRAB") {
      grabbedWindowRef.current = null;
      return;
    }

    const x = tracking.state.screenCoordinates.x;
    const y = tracking.state.screenCoordinates.y;
    if (x < 0 || y < 0 || typeof document === "undefined" || typeof window === "undefined") return;

    if (!grabbedWindowRef.current) {
      const elUnder = document.elementFromPoint(x, y);
      const winEl = elUnder?.closest<HTMLElement>("[data-window-id]");
      const winId = winEl?.dataset.windowId as FloatingWindowId | undefined;
      if (winEl && winId) {
        const rect = winEl.getBoundingClientRect();
        floatingWindowActions.bringToFront(winId);
        grabbedWindowRef.current = {
          id: winId,
          offsetX: x - rect.left,
          offsetY: y - rect.top,
        };
      }
    } else {
      const { id, offsetX, offsetY } = grabbedWindowRef.current;
      const nextX = Math.max(8, Math.min(window.innerWidth - 260, x - offsetX));
      const nextY = Math.max(8, Math.min(window.innerHeight - 80, y - offsetY));
      floatingWindowActions.updatePosition(id, nextX, nextY);
    }
  }, [
    tracking.state.isRunning,
    tracking.state.activeGesture,
    tracking.state.screenCoordinates.x,
    tracking.state.screenCoordinates.y,
  ]);

  // 2. FIST_LOAD (▼): Real-time external point load manipulation (adapted from prototype/hand-tracking/engine.ts lines 534-550)
  const lastFistUpdateRef = useRef<number>(0);

  useEffect(() => {
    if (
      !tracking.state.isRunning ||
      tracking.state.activeGesture !== "FIST_LOAD" ||
      !beamInteraction
    ) {
      return;
    }

    const now = Date.now();
    if (now - lastFistUpdateRef.current < 60) return;
    lastFistUpdateRef.current = now;

    if (store.loadingMode !== "MODE_A_EXTERNAL_LOADS") {
      beamSimulatorActions.setLoadingMode("MODE_A_EXTERNAL_LOADS");
    }

    const currentLoads = store.pointLoads;
    const station = Math.max(
      0.1,
      Math.min(((store.spanLengthM as number) ?? 6) - 0.1, beamInteraction.stationM),
    );
    const mag = beamInteraction.magKn;

    const existingIdx = currentLoads.findIndex((pl) => pl.id === "gesture-load" || pl.id === "P1");

    if (existingIdx >= 0) {
      const existing = currentLoads[existingIdx];
      if (
        existing &&
        (Math.abs(existing.position - station) > 0.01 || existing.magnitude !== mag)
      ) {
        const updated = [...currentLoads];
        updated[existingIdx] = {
          id: existing.id,
          position: station as Meter,
          magnitude: mag as Kilonewton,
        };
        beamSimulatorActions.setPointLoads(updated);
      }
    } else {
      const newLoad: PointLoad = {
        id: "P1",
        position: station as Meter,
        magnitude: mag as Kilonewton,
      };
      beamSimulatorActions.setPointLoads([...currentLoads, newLoad]);
    }
  }, [
    tracking.state.isRunning,
    tracking.state.activeGesture,
    beamInteraction,
    store.loadingMode,
    store.pointLoads,
    store.spanLengthM,
  ]);

  // 3. POINT_PRECISION (▸): Precision node snapping & inspection (adapted from prototype/hand-tracking/engine.ts lines 553-563)
  const pointInspection = useMemo(() => {
    if (
      !tracking.state.isRunning ||
      tracking.state.activeGesture !== "POINT_PRECISION" ||
      !beamInteraction ||
      !stationViews ||
      stationViews.stationsM.length === 0
    ) {
      return null;
    }
    const n = stationViews.stationsM.length;
    const idx = Math.max(0, Math.min(n - 1, Math.round(beamInteraction.t * (n - 1))));
    return {
      xM: stationViews.stationsM[idx] ?? 0,
      deflectionMm: stationViews.deflectionMm[idx] ?? 0,
      momentKnm: stationViews.bendingMomentMajorKnm[idx] ?? 0,
      shearKn: stationViews.shearForceKn[idx] ?? 0,
      screenX: beamInteraction.projX,
      screenY: beamInteraction.projY,
    };
  }, [tracking.state.isRunning, tracking.state.activeGesture, beamInteraction, stationViews]);

  return (
    <ErzyshDarkGridBackground className="h-dvh w-full">
      {/* 1. WebGL 3D Beam Extruded Viewport (Client Only) */}
      <DynamicBeam3DViewport
        mesh={meshViews}
        meshRevision={store.solverRevision}
        rebarCage={rebarCageViews}
        materialKind={store.materialKind}
        concreteViewMode={store.concreteViewMode}
        onConcreteViewModeChange={beamSimulatorActions.setConcreteViewMode}
        coordinateMode={store.coordinateMode}
        customUpVector={store.customUpVector}
        cameraPreset={cameraPreset}
        onCameraPresetChange={setCameraPreset}
        onProjectionChange={setProjection}
        showToolbar={false}
      />

      {/* 2. 2D Support Symbols Overlay */}
      <SupportSymbols2DOverlay
        supportOrientation={store.supportOrientation}
        endAScreen={projection?.endAScreen ?? null}
        endBScreen={projection?.endBScreen ?? null}
      />

      {/* 3. 2D Diagram Overlay (Mode 1 & Mode 2) */}
      <MultiModeDiagram2DOverlay
        stationViews={stationViews}
        displayMode={store.diagramDisplayMode}
        visibility={store.visibleDiagrams}
        endAScreen={projection?.endAScreen ?? null}
        endBScreen={projection?.endBScreen ?? null}
      />

      {/* 4. Right Edge Deflection Colorbar & Bottom-Left Deflection Card */}
      <DeflectionHudAndColorbar
        maxDeflectionMm={maxDeflectionMm}
        maxDeflectionStationM={maxDeflectionStationM}
        compliance={compliance}
        limitDenominator={store.deflectionLimitDenominator}
      />

      {/* 5. 3D Coordinate Axis Switcher */}
      <CoordinateAxisSwitcher />

      {/* 6. Top Workstation Header: Window Quick Dock Bar + Camera Preset Switcher + Telemetry Badge */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-40 flex flex-wrap items-center justify-between gap-2 xl:inset-x-4">
        <div
          className="bg-card/85 border-border/40 pointer-events-auto order-1 flex flex-wrap items-center gap-1 rounded-lg border px-1.5 py-1 shadow-xl backdrop-blur-md xl:gap-1.5 xl:px-2 xl:py-1.5"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {(
            [
              ["MATERIAL_LOAD_MODE", "1. Material"],
              ["REALTIME_LOAD_INPUT", "2. Beban"],
              ["SNI_DESIGN_PARAMETERS", "3. Parameter"],
              ["OPTIMIZATION_RESULTS", "4. Optimasi"],
              ["INTERNAL_FORCE_DIAGRAMS", "5. Diagram"],
              ["GESTURE_AI_ASSISTANT", "6. AI & Gestur"],
            ] as const
          ).map(([id, label]) => {
            const isOpen = windowStore.windows[id].isOpen;
            return (
              <Button
                key={id}
                type="button"
                variant={isOpen ? "secondary" : "ghost"}
                size="xs"
                onClick={() => floatingWindowActions.toggleWindow(id as FloatingWindowId)}
                className={cn(
                  "text-[11px] font-medium transition-colors",
                  isOpen && "bg-sky-500/20 font-bold text-sky-400 hover:bg-sky-500/30",
                )}
              >
                {label}
              </Button>
            );
          })}
        </div>

        {/* Camera Preset & Concrete Sub-Mode Toolbar */}
        <div
          role="toolbar"
          aria-label="Kontrol kamera balok 3D"
          className="bg-card/85 border-border/40 pointer-events-auto order-2 flex flex-wrap items-center gap-1 rounded-lg border px-1.5 py-1 shadow-xl backdrop-blur-md xl:py-1.5"
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <Button
            type="button"
            variant={cameraPreset === "ISOMETRIC_3D" ? "secondary" : "ghost"}
            size="xs"
            onClick={() => setCameraPreset("ISOMETRIC_3D")}
            title="Kamera perspektif isometrik (tombol 3)"
            className={cn(
              "text-[11px] font-medium transition-colors",
              cameraPreset === "ISOMETRIC_3D" &&
                "bg-sky-500/20 font-bold text-sky-400 hover:bg-sky-500/30",
            )}
          >
            3D Isometrik
          </Button>
          <Button
            type="button"
            variant={cameraPreset === "FRONT_2D" ? "secondary" : "ghost"}
            size="xs"
            onClick={() => setCameraPreset("FRONT_2D")}
            title="Proyeksi ortografis tampak depan, sejajar overlay 2D (tombol 1)"
            className={cn(
              "text-[11px] font-medium transition-colors",
              cameraPreset === "FRONT_2D" &&
                "bg-sky-500/20 font-bold text-sky-400 hover:bg-sky-500/30",
            )}
          >
            Tampak Depan 2D
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => window.dispatchEvent(new CustomEvent("app:camera-fit"))}
            title="Pusatkan balok ke layar (tombol F / klik ganda)"
            className="text-[11px] font-medium transition-colors"
          >
            Fit
          </Button>

          {store.materialKind === "CONCRETE" && (
            <>
              <span aria-hidden className="bg-border/60 mx-0.5 h-4 w-px" />
              <Button
                type="button"
                variant={
                  store.concreteViewMode === "SOLID_WITH_END_SECTION" ? "secondary" : "ghost"
                }
                size="xs"
                onClick={() => beamSimulatorActions.setConcreteViewMode("SOLID_WITH_END_SECTION")}
                title="Beton solid dengan gambar potongan ujung"
                className={cn(
                  "text-[11px] font-medium transition-colors",
                  store.concreteViewMode === "SOLID_WITH_END_SECTION" &&
                    "bg-sky-500/20 font-bold text-sky-400 hover:bg-sky-500/30",
                )}
              >
                Solid + Potongan
              </Button>
              <Button
                type="button"
                variant={store.concreteViewMode === "WIREFRAME_REBAR_CAGE" ? "secondary" : "ghost"}
                size="xs"
                onClick={() => beamSimulatorActions.setConcreteViewMode("WIREFRAME_REBAR_CAGE")}
                title="Selubung transparan dengan tulangan pokok & cincin sengkang"
                className={cn(
                  "text-[11px] font-medium transition-colors",
                  store.concreteViewMode === "WIREFRAME_REBAR_CAGE" &&
                    "bg-sky-500/20 font-bold text-sky-400 hover:bg-sky-500/30",
                )}
              >
                Wireframe Tulangan
              </Button>
            </>
          )}
        </div>

        {/* Top-Right Telemetry Badge (GA4 Custom Epoch Visitor Counter) */}
        <div className="pointer-events-auto order-3">
          <CustomEpochVisitorFlexBadge />
        </div>
      </div>

      {/* 7. The 6 Floating Windows */}
      {/* Window 1: Material & Load Mode */}
      <DraggableFloatingWindow id="MATERIAL_LOAD_MODE">
        <MaterialAndLoadModeSelector />
      </DraggableFloatingWindow>

      {/* Window 2: Beban Real-Time (Mode A / Mode B) */}
      <DraggableFloatingWindow id="REALTIME_LOAD_INPUT">
        {store.loadingMode === "MODE_A_EXTERNAL_LOADS" ? (
          <ExternalLoadInteractiveForm />
        ) : (
          <DirectInternalForcesForm />
        )}
      </DraggableFloatingWindow>

      {/* Window 3: Parameter Desain SNI */}
      <DraggableFloatingWindow id="SNI_DESIGN_PARAMETERS">
        {store.materialKind === "CONCRETE" ? (
          <ConcreteDesignParametersForm />
        ) : (
          <SteelDesignParametersForm />
        )}
      </DraggableFloatingWindow>

      {/* Window 4: Hasil Optimasi SNI & Ekspor */}
      <DraggableFloatingWindow id="OPTIMIZATION_RESULTS">
        {store.materialKind === "CONCRETE" ? (
          <ConcreteOptimizationResultCard
            result={concreteResult}
            onOpenExportModal={() => setIsExportModalOpen(true)}
          />
        ) : (
          <SteelOptimizationRankingTable
            result={steelResult}
            onOpenExportModal={() => setIsExportModalOpen(true)}
          />
        )}
      </DraggableFloatingWindow>

      {/* Window 5: Diagram Gaya Dalam Khusus (Mode 3) */}
      <DraggableFloatingWindow id="INTERNAL_FORCE_DIAGRAMS">
        {stationViews ? (
          <div className="flex flex-col gap-1.5">
            <SingleDiagramCard
              title="BMD — Bidang Momen Lentur (Mux)"
              unit="kNm"
              strokeColor="#06B6D4"
              fillColor="rgba(6, 182, 212, 0.18)"
              stations={stationViews.stationsM}
              values={stationViews.bendingMomentMajorKnm}
              width={420}
              height={80}
            />
            <SingleDiagramCard
              title="SFD — Bidang Gaya Geser (Vu)"
              unit="kN"
              strokeColor="#10B981"
              fillColor="rgba(16, 185, 129, 0.18)"
              stations={stationViews.stationsM}
              values={stationViews.shearForceKn}
              width={420}
              height={80}
            />
            <SingleDiagramCard
              title="NFD — Bidang Gaya Aksial (Pu)"
              unit="kN"
              strokeColor="#A855F7"
              fillColor="rgba(168, 85, 247, 0.18)"
              stations={stationViews.stationsM}
              values={stationViews.normalForceKn}
              width={420}
              height={70}
            />
          </div>
        ) : (
          <Empty className="border-dashed py-6">
            <EmptyHeader>
              <EmptyTitle className="text-xs">Diagram Belum Tersedia</EmptyTitle>
              <EmptyDescription className="text-[11px]">
                Diagram gaya dalam dihitung pada Mode A (Beban Eksternal).
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </DraggableFloatingWindow>

      {/* Window 6: Gestur & Asisten AI */}
      <DraggableFloatingWindow
        id="GESTURE_AI_ASSISTANT"
        className="flex flex-col"
        contentClassName="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto"
      >
        <StructuralAiAssistantPanel
          className="min-h-0 flex-1"
          onToggleCamera={tracking.toggleRunning}
          isCameraRunning={tracking.state.isRunning}
        />
        <div className="shrink-0">
          <HandTrackingCameraPreview
            state={tracking.state}
            onToggleRunning={tracking.toggleRunning}
            onToggleEcoMode={tracking.toggleEcoMode}
            videoRef={tracking.videoRef}
            canvasRef={tracking.canvasRef}
            lastError={tracking.lastError}
          />
        </div>
      </DraggableFloatingWindow>

      {/* 8. Export Modal */}
      <ProfileAndModelExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />

      {/* 9. Dynamic Hand Cursor Overlay (Zero Pinch-Dip) */}
      <DynamicHandCursorOverlay state={tracking.state} />

      {/* 9b. Beam Gesture Inspection HUD Overlay */}
      {pointInspection && (
        <div
          className="pointer-events-none fixed z-[9999] -translate-x-1/2 -translate-y-full rounded-lg border border-cyan-400/80 bg-slate-950/92 px-3 py-1.5 shadow-2xl backdrop-blur-md"
          style={{
            left: `${pointInspection.screenX}px`,
            top: `${pointInspection.screenY - 14}px`,
          }}
        >
          <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
            <span>👉 Titik Balok: x = {pointInspection.xM.toFixed(2)} m</span>
          </div>
          <div className="mt-1 flex items-center gap-2.5 font-mono text-[11px] text-slate-200">
            <span>
              Δ ={" "}
              <strong className="text-amber-300">
                {pointInspection.deflectionMm.toFixed(2)} mm
              </strong>
            </span>
            <span>
              Mu ={" "}
              <strong className="text-cyan-300">{pointInspection.momentKnm.toFixed(1)} kNm</strong>
            </span>
            <span>
              Vu ={" "}
              <strong className="text-emerald-300">{pointInspection.shearKn.toFixed(1)} kN</strong>
            </span>
          </div>
        </div>
      )}

      {/* 9c. Beam Fist Load Placement HUD Overlay */}
      {tracking.state.isRunning &&
        tracking.state.activeGesture === "FIST_LOAD" &&
        beamInteraction && (
          <div
            className="pointer-events-none fixed z-[9999] -translate-x-1/2 -translate-y-full rounded-lg border border-amber-400/80 bg-slate-950/92 px-3 py-1.5 shadow-2xl backdrop-blur-md"
            style={{
              left: `${beamInteraction.projX}px`,
              top: `${beamInteraction.projY - 14}px`,
            }}
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
              <span>
                ✊ Beban P = {beamInteraction.magKn} kN @ x = {beamInteraction.stationM.toFixed(2)}{" "}
                m
              </span>
            </div>
            <div className="text-[10px] text-slate-300">
              Geser horizontal untuk posisi (x) · Geser vertikal untuk besar beban (P)
            </div>
          </div>
        )}

      {/* 10. Voice Command Floating Status Toast */}
      <VoiceCommandStatusToast
        isListening={voice.isListening}
        isMuted={voice.isMuted}
        isSupported={voice.isSupported}
        transcript={voice.transcript}
        feedbackMessage={voice.feedbackMessage}
        lastExecution={voice.lastExecution}
        error={voice.error}
        onToggleListening={voice.toggleListening}
        suggestions={voice.suggestions}
        onSelectSuggestion={voice.executeTranscript}
      />
    </ErzyshDarkGridBackground>
  );
}

export default DesktopWorkstationView;
