// src/components/adaptive/AndroidCompanionView.tsx
/**
 * @file AndroidCompanionView.tsx
 * @description Lightweight companion layout designed for mobile/field Android devices:
 * - Single-column scrollable responsive layout
 * - Bypasses heavy 3D WebGL canvas to preserve battery and eliminate thermal throttling
 * - Automatically activates Mode B (`MODE_B_DIRECT_INTERNAL_FORCES`) when entering the Gaya Dalam tab
 * - Focuses on Mode B (Factored Internal Forces), SNI Optimizers, and 2D Cross-Section SVG preview
 */

"use client";

import React, { type ReactElement, useState } from "react";

import { ErzyshDarkGridBackground } from "@/components/canvas/ErzyshDarkGridBackground";
import { ConcreteDesignParametersForm } from "@/components/forms/ConcreteDesignParametersForm";
import { DirectInternalForcesForm } from "@/components/forms/DirectInternalForcesForm";
import { ExternalLoadInteractiveForm } from "@/components/forms/ExternalLoadInteractiveForm";
import { MaterialAndLoadModeSelector } from "@/components/forms/MaterialAndLoadModeSelector";
import { SteelDesignParametersForm } from "@/components/forms/SteelDesignParametersForm";
import { ConcreteOptimizationResultCard } from "@/components/results/ConcreteOptimizationResultCard";
import { DeflectionServiceabilityBadge } from "@/components/results/DeflectionServiceabilityBadge";
import { ProfileAndModelExportModal } from "@/components/results/ProfileAndModelExportModal";
import { SteelOptimizationRankingTable } from "@/components/results/SteelOptimizationRankingTable";
import { CustomEpochVisitorFlexBadge } from "@/components/telemetry/CustomEpochVisitorFlexBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useStructuralSolverEngine } from "@/hooks/use-structural-solver-engine";
import { beamSimulatorActions, useBeamSimulatorStore } from "@/state/beam-simulator-store";

type AndroidCompanionTab = "RESULTS" | "INPUT" | "PARAMETERS";

const ANDROID_TAB_TRIGGER_CLASS =
  "h-full min-w-0 flex-1 rounded-none px-1.5 text-[11px] font-semibold focus-visible:border-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset data-[state=active]:bg-sky-500/12 data-[state=active]:text-sky-300 sm:text-xs";

/**
 * Renders the mobile-optimized Android Companion View supporting both Mode A
 * (External Loads) and Mode B (Direct Factored Internal Forces), SNI optimizers,
 * and responsive 2D cross-section preview.
 *
 * @returns React element for the mobile companion interface.
 * @example
 * <AndroidCompanionView />
 */
export function AndroidCompanionView(): ReactElement {
  const store = useBeamSimulatorStore();
  const { compliance, concreteResult, steelResult } = useStructuralSolverEngine();
  const [activeTab, setActiveTab] = useState<AndroidCompanionTab>("RESULTS");
  const [isExportOpen, setIsExportOpen] = useState(false);

  return (
    <ErzyshDarkGridBackground
      className="flex h-dvh w-full flex-col overflow-hidden"
      style={{ height: "100dvh", width: "100%", overflow: "hidden" }}
    >
      {/* Top Mobile Header */}
      <header className="bg-card/95 border-border/50 shrink-0 border-b px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] backdrop-blur-md sm:px-4">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-foreground truncate text-sm font-extrabold">
              IBDS Mobile Companion
            </h1>
            <p className="text-muted-foreground truncate text-[11px]">
              Kalkulator Desain Balok SNI (Mode Lapangan)
            </p>
          </div>

          <DeflectionServiceabilityBadge
            compliance={compliance}
            className="h-auto w-fit max-w-full flex-wrap justify-start py-1 text-[10px] leading-tight whitespace-normal"
          />
        </div>
      </header>

      {/* Mobile Telemetry Visitor Bar */}
      <div className="border-border/30 flex shrink-0 justify-center border-b bg-[#0b1014]/95 px-3 py-1.5">
        <CustomEpochVisitorFlexBadge className="max-w-full" />
      </div>

      {/* Main Tabs Navigation & Content */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as AndroidCompanionTab)}
        className="flex min-h-0 w-full flex-1 flex-col gap-0"
      >
        <TabsList
          variant="line"
          className="border-border/50 h-11 w-full shrink-0 justify-around rounded-none border-b bg-[#0d1317] p-0 group-data-horizontal/tabs:h-11"
        >
          <TabsTrigger value="RESULTS" className={ANDROID_TAB_TRIGGER_CLASS}>
            Hasil Desain
          </TabsTrigger>
          <TabsTrigger value="INPUT" className={ANDROID_TAB_TRIGGER_CLASS}>
            Beban &amp; Gaya
          </TabsTrigger>
          <TabsTrigger value="PARAMETERS" className={ANDROID_TAB_TRIGGER_CLASS}>
            Parameter SNI
          </TabsTrigger>
        </TabsList>

        <main className="mx-auto min-h-0 w-full max-w-2xl flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain p-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-4">
          <TabsContent value="RESULTS" className="mt-0 min-w-0">
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
          </TabsContent>

          <TabsContent value="INPUT" className="mt-0 min-w-0">
            <Card className="bg-card/95 border-border/50 flex min-w-0 flex-col gap-3 overflow-hidden p-3 py-3 sm:p-4 sm:py-4">
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={store.loadingMode}
                onValueChange={(val) => {
                  if (val) {
                    beamSimulatorActions.setLoadingMode(
                      val as "MODE_A_EXTERNAL_LOADS" | "MODE_B_DIRECT_INTERNAL_FORCES",
                    );
                  }
                }}
                className="grid w-full grid-cols-2"
              >
                <ToggleGroupItem
                  value="MODE_A_EXTERNAL_LOADS"
                  className="h-auto min-h-8 px-2 py-1.5 text-center text-[11px] leading-tight whitespace-normal sm:text-xs"
                >
                  Mode A: Beban Luar
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="MODE_B_DIRECT_INTERNAL_FORCES"
                  className="h-auto min-h-8 px-2 py-1.5 text-center text-[11px] leading-tight whitespace-normal sm:text-xs"
                >
                  Mode B: Gaya Dalam
                </ToggleGroupItem>
              </ToggleGroup>

              {store.loadingMode === "MODE_A_EXTERNAL_LOADS" ? (
                <>
                  <ExternalLoadInteractiveForm />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setActiveTab("RESULTS")}
                    className="h-auto min-h-8 w-full bg-linear-to-r from-cyan-500 to-blue-600 py-1.5 text-center text-xs font-bold whitespace-normal text-white shadow-sm hover:from-cyan-600 hover:to-blue-700"
                  >
                    Lihat Hasil Desain →
                  </Button>
                </>
              ) : (
                <DirectInternalForcesForm onAppliedSuccess={() => setActiveTab("RESULTS")} />
              )}
            </Card>
          </TabsContent>

          <TabsContent value="PARAMETERS" className="mt-0 flex min-w-0 flex-col gap-3">
            <Card className="bg-card/95 border-border/50 min-w-0 overflow-hidden p-3 py-3 sm:p-4 sm:py-4">
              <MaterialAndLoadModeSelector />
            </Card>

            <Card className="bg-card/95 border-border/50 min-w-0 overflow-hidden p-3 py-3 sm:p-4 sm:py-4">
              {store.materialKind === "CONCRETE" ? (
                <ConcreteDesignParametersForm />
              ) : (
                <SteelDesignParametersForm />
              )}
            </Card>
          </TabsContent>
        </main>
      </Tabs>

      <ProfileAndModelExportModal isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} />
    </ErzyshDarkGridBackground>
  );
}

export default AndroidCompanionView;
