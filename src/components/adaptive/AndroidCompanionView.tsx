/**
 * @file AndroidCompanionView.tsx
 * @description Lightweight companion layout designed for mobile/field Android devices:
 * - Single-column scrollable responsive layout
 * - Bypasses heavy 3D WebGL canvas to preserve battery and eliminate thermal throttling
 * - Focuses on Mode B (Factored Internal Forces), SNI Optimizers, and 2D Cross-Section SVG preview
 * - Quick export and consultation capabilities
 */

"use client";

import React, { type ReactElement, useState } from "react";

import { ErzyshDarkGridBackground } from "@/components/canvas/ErzyshDarkGridBackground";
import { ConcreteDesignParametersForm } from "@/components/forms/ConcreteDesignParametersForm";
import { DirectInternalForcesForm } from "@/components/forms/DirectInternalForcesForm";
import { MaterialAndLoadModeSelector } from "@/components/forms/MaterialAndLoadModeSelector";
import { SteelDesignParametersForm } from "@/components/forms/SteelDesignParametersForm";
import { ConcreteOptimizationResultCard } from "@/components/results/ConcreteOptimizationResultCard";
import { DeflectionServiceabilityBadge } from "@/components/results/DeflectionServiceabilityBadge";
import { ProfileAndModelExportModal } from "@/components/results/ProfileAndModelExportModal";
import { SteelOptimizationRankingTable } from "@/components/results/SteelOptimizationRankingTable";
import { CustomEpochVisitorFlexBadge } from "@/components/telemetry/CustomEpochVisitorFlexBadge";
import { useStructuralSolverEngine } from "@/hooks/use-structural-solver-engine";
import { useBeamSimulatorStore } from "@/state/beam-simulator-store";

export function AndroidCompanionView(): ReactElement {
  const store = useBeamSimulatorStore();
  const { compliance, concreteResult, steelResult } = useStructuralSolverEngine();
  const [activeTab, setActiveTab] = useState<"INPUT" | "PARAMETERS" | "RESULTS">("RESULTS");
  const [isExportOpen, setIsExportOpen] = useState(false);

  return (
    <ErzyshDarkGridBackground
      style={{
        width: "100vw",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
      }}
    >
      {/* Top Mobile Header */}
      <header
        style={{
          padding: "12px 16px",
          background: "rgba(15, 20, 22, 0.9)",
          borderBottom: "1px solid rgba(148, 163, 184, 0.14)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#F8FAFC" }}>
            IBDS Mobile Companion
          </h1>
          <span style={{ fontSize: 10, color: "#94A3B8" }}>
            Kalkulator Desain Balok SNI (Mode Lapangan)
          </span>
        </div>

        <DeflectionServiceabilityBadge compliance={compliance} />
      </header>

      {/* Mobile Telemetry Visitor Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          padding: "6px 16px",
          background: "rgba(10, 10, 10, 0.7)",
          borderBottom: "1px solid rgba(148, 163, 184, 0.08)",
        }}
      >
        <CustomEpochVisitorFlexBadge />
      </div>

      {/* Tab Navigation */}
      <nav
        style={{
          display: "flex",
          borderBottom: "1px solid rgba(148, 163, 184, 0.12)",
          background: "rgba(30, 41, 59, 0.3)",
        }}
      >
        {(
          [
            ["RESULTS", "Hasil Desain"],
            ["INPUT", "Gaya Dalam"],
            ["PARAMETERS", "Parameter SNI"],
          ] as const
        ).map(([tab, label]) => {
          const isCurrent = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: "10px 4px",
                border: "none",
                fontSize: 12,
                fontWeight: isCurrent ? 700 : 500,
                background: isCurrent ? "rgba(6, 182, 212, 0.15)" : "transparent",
                color: isCurrent ? "#38BDF8" : "#94A3B8",
                borderBottom: isCurrent ? "2px solid #06B6D4" : "none",
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          );
        })}
      </nav>

      {/* Main Tab Content */}
      <main style={{ padding: 16, flex: 1, maxWidth: 600, margin: "0 auto", width: "100%" }}>
        {activeTab === "RESULTS" && (
          <div>
            {store.materialKind === "CONCRETE" ? (
              <ConcreteOptimizationResultCard
                result={concreteResult}
                onOpenExportModal={() => setIsExportOpen(true)}
              />
            ) : (
              <SteelOptimizationRankingTable
                result={steelResult}
                onOpenExportModal={() => setIsExportOpen(true)}
              />
            )}
          </div>
        )}

        {activeTab === "INPUT" && (
          <div
            style={{
              background: "rgba(15, 20, 22, 0.8)",
              border: "1px solid rgba(148, 163, 184, 0.14)",
              borderRadius: 10,
              padding: 14,
            }}
          >
            <DirectInternalForcesForm />
          </div>
        )}

        {activeTab === "PARAMETERS" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              style={{
                background: "rgba(15, 20, 22, 0.8)",
                border: "1px solid rgba(148, 163, 184, 0.14)",
                borderRadius: 10,
                padding: 14,
              }}
            >
              <MaterialAndLoadModeSelector />
            </div>

            <div
              style={{
                background: "rgba(15, 20, 22, 0.8)",
                border: "1px solid rgba(148, 163, 184, 0.14)",
                borderRadius: 10,
                padding: 14,
              }}
            >
              {store.materialKind === "CONCRETE" ? (
                <ConcreteDesignParametersForm />
              ) : (
                <SteelDesignParametersForm />
              )}
            </div>
          </div>
        )}
      </main>

      <ProfileAndModelExportModal isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} />
    </ErzyshDarkGridBackground>
  );
}

export default AndroidCompanionView;
