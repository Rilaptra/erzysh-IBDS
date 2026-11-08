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
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStructuralSolverEngine } from "@/hooks/use-structural-solver-engine";
import { useBeamSimulatorStore } from "@/state/beam-simulator-store";

export function AndroidCompanionView(): ReactElement {
  const store = useBeamSimulatorStore();
  const { compliance, concreteResult, steelResult } = useStructuralSolverEngine();
  const [isExportOpen, setIsExportOpen] = useState(false);

  return (
    <ErzyshDarkGridBackground
      className="flex min-h-screen w-screen flex-col"
      style={{ overflowY: "auto" }}
    >
      {/* Top Mobile Header */}
      <header className="bg-card/90 border-border/40 flex items-center justify-between border-b px-4 py-3 backdrop-blur-md">
        <div>
          <h1 className="text-foreground text-sm font-extrabold">IBDS Mobile Companion</h1>
          <span className="text-muted-foreground text-[10px]">
            Kalkulator Desain Balok SNI (Mode Lapangan)
          </span>
        </div>

        <DeflectionServiceabilityBadge compliance={compliance} />
      </header>

      {/* Mobile Telemetry Visitor Bar */}
      <div className="border-border/20 flex justify-center border-b bg-black/50 px-4 py-1.5">
        <CustomEpochVisitorFlexBadge />
      </div>

      {/* Main Tabs Navigation & Content */}
      <Tabs defaultValue="RESULTS" className="flex w-full flex-1 flex-col gap-0">
        <TabsList
          variant="line"
          className="border-border/30 bg-muted/20 h-11 w-full justify-around rounded-none border-b px-2"
        >
          <TabsTrigger value="RESULTS" className="flex-1 text-xs font-semibold">
            Hasil Desain
          </TabsTrigger>
          <TabsTrigger value="INPUT" className="flex-1 text-xs font-semibold">
            Gaya Dalam
          </TabsTrigger>
          <TabsTrigger value="PARAMETERS" className="flex-1 text-xs font-semibold">
            Parameter SNI
          </TabsTrigger>
        </TabsList>

        <main className="mx-auto w-full max-w-xl flex-1 p-4">
          <TabsContent value="RESULTS" className="mt-0">
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

          <TabsContent value="INPUT" className="mt-0">
            <Card className="bg-card/85 border-border/40 p-4 py-4 backdrop-blur-md">
              <DirectInternalForcesForm />
            </Card>
          </TabsContent>

          <TabsContent value="PARAMETERS" className="mt-0 flex flex-col gap-3">
            <Card className="bg-card/85 border-border/40 p-4 py-4 backdrop-blur-md">
              <MaterialAndLoadModeSelector />
            </Card>

            <Card className="bg-card/85 border-border/40 p-4 py-4 backdrop-blur-md">
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
