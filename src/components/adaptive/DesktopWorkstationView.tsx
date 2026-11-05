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
import { DraggableFloatingWindow } from "@/components/windows/DraggableFloatingWindow";
import { useStructuralSolverEngine } from "@/hooks/use-structural-solver-engine";
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

  return (
    <ErzyshDarkGridBackground style={{ width: "100vw", height: "100vh" }}>
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
          style={{
            position: "absolute",
            top: 14,
            left: 24,
            zIndex: 30,
            display: "flex",
            gap: 6,
            background: "rgba(15, 20, 22, 0.8)",
            backdropFilter: "blur(8px)",
            padding: "4px 8px",
            borderRadius: 8,
            border: "1px solid rgba(148, 163, 184, 0.12)",
          }}
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
              <button
                key={id}
                type="button"
                onClick={() => floatingWindowActions.toggleWindow(id as FloatingWindowId)}
                style={{
                  border: "none",
                  padding: "4px 8px",
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: isOpen ? 700 : 500,
                  cursor: "pointer",
                  background: isOpen ? "rgba(6, 182, 212, 0.25)" : "transparent",
                  color: isOpen ? "#38BDF8" : "#94A3B8",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      ) : null}

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
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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
          <div style={{ color: "#64748B", fontSize: 11, textAlign: "center", padding: 12 }}>
            Diagram dihitung pada Mode A (Beban Eksternal).
          </div>
        )}
      </DraggableFloatingWindow>

      {/* Window 6: Gestur & Asisten AI */}
      <DraggableFloatingWindow id="GESTURE_AI_ASSISTANT">
        <div style={{ fontSize: 12, lineHeight: 1.5, color: "#CBD5E1" }}>
          <div style={{ marginBottom: 8, fontWeight: 700, color: "#38BDF8" }}>
            Asisten Rekayasa Struktur IBDS
          </div>
          <p style={{ margin: "0 0 8px 0", color: "#94A3B8" }}>
            Gunakan kontrol suara atau tanyakan saran optimasi profil SNI. Integrasi webcam & AI
            audio diaktifkan pada Step 7.
          </p>
          <div
            style={{
              background: "rgba(30, 41, 59, 0.4)",
              padding: 8,
              borderRadius: 6,
              fontSize: 11,
            }}
          >
            💡 <strong>Status:</strong> Siap menerima instruksi struktur.
          </div>
        </div>
      </DraggableFloatingWindow>

      {/* 8. Export Modal */}
      <ProfileAndModelExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />
    </ErzyshDarkGridBackground>
  );
}

export default DesktopWorkstationView;
