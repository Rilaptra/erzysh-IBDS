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
import React, { type ReactElement, useState } from "react";

import { StructuralAiAssistantPanel } from "@/components/assistant/StructuralAiAssistantPanel";
import { VoiceCommandStatusToast } from "@/components/assistant/VoiceCommandStatusToast";
import type { ViewportProjectionSnapshot } from "@/components/canvas/Beam3DExtrudedViewport";
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
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  const tracking = useMediapipeHandTracking();
  const voice = useWebSpeechCommand();

  return (
    <ErzyshDarkGridBackground className="h-screen w-screen">
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
        onProjectionChange={setProjection}
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

      {/* 6. Window Quick Dock Bar (Conditional when screen is clear) */}
      {windowStore.showComplementaryBars ? (
        <div
          className="bg-card/80 border-border/30 absolute top-3.5 left-6 z-30 flex items-center gap-1.5 rounded-lg border px-2 py-1.5 shadow-lg backdrop-blur-md"
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
      ) : null}

      {/* Top-Right Telemetry Badge (GA4 Custom Epoch Visitor Counter) */}
      <div className="absolute top-3.5 right-6 z-30">
        <CustomEpochVisitorFlexBadge />
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
      <DraggableFloatingWindow id="GESTURE_AI_ASSISTANT">
        <StructuralAiAssistantPanel
          onToggleCamera={tracking.toggleRunning}
          isCameraRunning={tracking.state.isRunning}
        />
        <div className="mt-2.5">
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
        onTestAudio={() => voice.testAudioTone("SUCCESS")}
      />
    </ErzyshDarkGridBackground>
  );
}

export default DesktopWorkstationView;
