// src/components/results/SteelOptimizationRankingTable.tsx
/**
 * @file SteelOptimizationRankingTable.tsx
 * @description Ranking table & summary card for SNI 1729:2020 structural steel optimization:
 * - Optimal governing profile recommendation (lightest compliant section)
 * - Destructive error banner when demands exceed catalog capacity (`solverError`)
 * - Interactive clickable candidate ranking rows to inspect/select alternative profiles
 * - Exact 2D SVG technical cross-section preview using true catalog H, B, tw, tf, r, t
 */

"use client";

import React, { type ReactElement } from "react";

import { SteelProfileCrossSectionSvg } from "@/components/canvas/SteelProfileCrossSectionSvg";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SteelOptimizationResult } from "@/core/steel/steel-section-optimizer";
import { cn } from "@/lib/utils";
import { beamSimulatorActions, useBeamSimulatorStore } from "@/state/beam-simulator-store";
import type { SteelOptimizationCandidate } from "@/types/steel-sni1729-types";

export interface SteelOptimizationRankingTableProps {
  readonly result: SteelOptimizationResult | null;
  readonly onOpenExportModal?: () => void;
}

/**
 * Renders the SNI 1729:2020 steel profile optimization summary, 2D SVG cross-section,
 * interactive alternative profile table, and error diagnostics.
 *
 * @param props Optimization result and optional export modal callback.
 * @returns React element displaying steel optimization results.
 * @example
 * <SteelOptimizationRankingTable result={steelResult} />
 */
export function SteelOptimizationRankingTable({
  result,
  onOpenExportModal,
}: SteelOptimizationRankingTableProps): ReactElement {
  const { solverError, selectedSteelProfileName, governingForces } = useBeamSimulatorStore();

  if (solverError) {
    return (
      <div className="flex flex-col gap-2.5 text-xs">
        <div
          role="alert"
          className="rounded-lg border border-red-500/50 bg-red-950/45 p-3 text-xs leading-relaxed text-red-200"
        >
          <div className="font-bold text-red-400">
            ⚠️ Tidak Ada Profil Baja yang Memenuhi Syarat
          </div>
          <p className="mt-1.5 text-[11px] text-red-200/90">{solverError}</p>
          <div className="mt-2 rounded border border-red-500/30 bg-black/30 p-2 font-mono text-[10px] text-slate-300">
            Mux = {governingForces.absoluteMaxMux.toFixed(1)} kNm | Muy ={" "}
            {governingForces.absoluteMaxMuy.toFixed(1)} kNm | Vu ={" "}
            {governingForces.absoluteMaxVu.toFixed(1)} kN | Pu ={" "}
            {governingForces.absoluteMaxPu.toFixed(1)} kN
          </div>
          <div className="mt-2 flex gap-2">
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() =>
                beamSimulatorActions.setSteelParameters({
                  grade: "BJ_55",
                  maxHeightMm: undefined,
                  maxWidthMm: undefined,
                  selectedProfileName: null,
                })
              }
              className="border-amber-500/50 text-[10px] font-semibold text-amber-300 hover:bg-amber-500/20"
            >
              Naikkan ke BJ 55 & Hapus Batas Hmax
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!result || !result.bestCandidate) {
    return (
      <Empty className="py-6 text-center">
        <EmptyDescription className="text-muted-foreground text-xs">
          Menunggu hasil kalkulasi gaya dalam untuk mencari profil baja ekonomis…
        </EmptyDescription>
      </Empty>
    );
  }

  const { bestCandidate, compliantCandidates } = result;
  const props = bestCandidate.properties;

  return (
    <div className="flex flex-col gap-2.5 text-xs">
      {/* 1. Header Rekomendasi Teratas */}
      <Card size="sm" className="border-border/40 bg-card/60">
        <CardContent className="flex items-center justify-between p-2.5">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground text-[10px] font-medium">
                PROFIL TERPILIH (SNI 1729)
              </span>
              {selectedSteelProfileName ? (
                <Badge
                  variant="outline"
                  className="h-4 border-amber-500/40 bg-amber-500/10 px-1 text-[9px] text-amber-300"
                >
                  Manual
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="h-4 border-sky-500/40 bg-sky-500/10 px-1 text-[9px] text-sky-300"
                >
                  Auto Ekonomis
                </Badge>
              )}
            </div>
            <div className="text-sm font-bold text-sky-400">{props.name}</div>
            <div className="text-muted-foreground text-[10px]">
              Mutu {bestCandidate.grade.grade.replace("_", " ")} (fy ={" "}
              {Number(bestCandidate.grade.fy)} MPa) • {Number(props.unitWeightKgPerM).toFixed(1)}{" "}
              kg/m
            </div>
          </div>

          <div className="text-right">
            <span className="text-muted-foreground text-[10px] font-medium">EFISIENSI DCR</span>
            <div className="mt-0.5">
              <Badge
                variant={Number(bestCandidate.governingDcr) <= 1.0 ? "secondary" : "destructive"}
                className={cn(
                  "text-xs font-bold",
                  Number(bestCandidate.governingDcr) <= 1.0
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                    : "border-destructive/40 bg-destructive/15 text-destructive",
                )}
              >
                {(Number(bestCandidate.governingDcr) * 100).toFixed(1)}%
              </Badge>
            </div>
            {selectedSteelProfileName ? (
              <button
                type="button"
                onClick={() =>
                  beamSimulatorActions.setSteelParameters({ selectedProfileName: null })
                }
                className="mt-1 text-[10px] font-medium text-sky-400 underline hover:text-sky-300"
              >
                Reset ke Auto
              </button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* 2. Potongan SVG 2D Profil Baja */}
      <div className="flex justify-center py-1">
        <SteelProfileCrossSectionSvg
          profileType={result.profileType}
          profileName={props.name}
          depthH={Number(props.H)}
          widthB={Number(props.B)}
          webThicknessTw={Number(props.tw)}
          flangeThicknessTf={Number(props.tf)}
          boxThicknessT={Number(props.t ?? props.tw)}
          filletRadiusR={Number(props.r ?? 0)}
          width={230}
          height={185}
        />
      </div>

      {/* 3. Detail Kapasitas & Evaluasi Kelangsingan */}
      <Card size="sm" className="border-border/40 bg-card/60">
        <CardContent className="flex flex-col gap-1 p-2.5 text-[11px] leading-relaxed">
          <div>
            • Klasifikasi Penampang:{" "}
            <strong className="text-sky-400">
              {bestCandidate.compactness.governingClassification === "COMPACT"
                ? "Kompak"
                : bestCandidate.compactness.governingClassification === "NON_COMPACT"
                  ? "Non-Kompak"
                  : "Langsing"}
            </strong>{" "}
            (Sayap: {bestCandidate.compactness.flangeClassification}, Badan:{" "}
            {bestCandidate.compactness.webClassification})
          </div>
          <div>
            • Kondisi Tekuk LTB:{" "}
            <strong className="text-emerald-400">
              {bestCandidate.ltb.governingZone === "ZONE_1_PLASTIC"
                ? "Zona 1 (Plastis Penuh)"
                : bestCandidate.ltb.governingZone === "ZONE_2_INELASTIC_LTB"
                  ? "Zona 2 (Inelastis)"
                  : "Zona 3 (Tekuk Elastis)"}
            </strong>
          </div>
          <div className="text-muted-foreground">
            • Kapasitas φMnx: {Number(bestCandidate.ltb.designFlexuralPhiMn).toFixed(1)} kNm | Ix:{" "}
            {(Number(props.Ix) / 1e4).toFixed(0)} cm⁴
          </div>
        </CardContent>
      </Card>

      {/* 4. Tabel Peringkat Kandidat (Klik baris untuk memilih profil) */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[10px] font-semibold">
            Peringkat Profil Ekonomis (Klik baris untuk pilih):
          </span>
          <span className="text-muted-foreground text-[10px]">
            {compliantCandidates.length} lulus
          </span>
        </div>
        <ScrollArea className="border-border/40 h-32 w-full rounded-md border">
          <Table className="text-[10px]">
            <TableHeader>
              <TableRow className="border-border/30 hover:bg-transparent">
                <TableHead className="text-muted-foreground h-7 px-2 text-left text-[10px]">
                  Profil
                </TableHead>
                <TableHead className="text-muted-foreground h-7 px-2 text-right text-[10px]">
                  DCR
                </TableHead>
                <TableHead className="text-muted-foreground h-7 px-2 text-right text-[10px]">
                  Berat
                </TableHead>
                <TableHead className="text-muted-foreground h-7 px-2 text-center text-[10px]">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {compliantCandidates.slice(0, 10).map((c: SteelOptimizationCandidate) => {
                const isSelected = c.properties.name === bestCandidate.properties.name;
                return (
                  <TableRow
                    key={`${c.properties.name}-${c.grade.grade}`}
                    onClick={() =>
                      beamSimulatorActions.setSteelParameters({
                        selectedProfileName: c.properties.name,
                      })
                    }
                    className={cn(
                      "border-border/20 cursor-pointer transition-colors hover:bg-sky-500/10",
                      isSelected && "bg-sky-500/15 font-bold",
                    )}
                  >
                    <TableCell className="text-foreground px-2 py-1 font-semibold">
                      {isSelected ? "▸ " : ""}
                      {c.properties.name}
                    </TableCell>
                    <TableCell className="px-2 py-1 text-right font-mono">
                      {(Number(c.governingDcr) * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-muted-foreground px-2 py-1 text-right font-mono">
                      {Number(c.properties.unitWeightKgPerM).toFixed(1)} kg/m
                    </TableCell>
                    <TableCell className="px-2 py-1 text-center">
                      <Badge
                        variant={c.status === "OPTIMAL" ? "default" : "secondary"}
                        className={cn(
                          "h-4 px-1.5 py-0 text-[9px] font-medium",
                          c.status === "OPTIMAL"
                            ? "border border-emerald-500/30 bg-emerald-500/20 text-emerald-400"
                            : "text-muted-foreground",
                        )}
                      >
                        {c.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      {/* 5. Tombol Ekspor CAD / CAE */}
      {onOpenExportModal ? (
        <Button
          type="button"
          onClick={onOpenExportModal}
          className="mt-1 w-full bg-linear-to-r from-cyan-500 to-blue-600 font-bold text-white shadow-sm hover:from-cyan-600 hover:to-blue-700"
        >
          📦 Ekspor CAD (.dxf), SAP2000 (.s2k), & STEP (.step)
        </Button>
      ) : null}
    </div>
  );
}

export default SteelOptimizationRankingTable;
