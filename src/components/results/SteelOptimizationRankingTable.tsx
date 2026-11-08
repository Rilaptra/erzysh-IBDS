/**
 * @file SteelOptimizationRankingTable.tsx
 * @description Ranking table & summary card for SNI 1729:2020 structural steel optimization:
 * - Optimal governing profile recommendation (0.90 <= DCR <= 1.00)
 * - Section compactness status (Kompak / Non-Kompak / Langsing)
 * - LTB zone (Zona 1 / 2 / 3)
 * - Candidate profile rankings table
 */

"use client";

import { cn } from "cn";
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
import type { SteelOptimizationCandidate } from "@/types/steel-sni1729-types";

export interface SteelOptimizationRankingTableProps {
  readonly result: SteelOptimizationResult | null;
  readonly onOpenExportModal?: () => void;
}

export function SteelOptimizationRankingTable({
  result,
  onOpenExportModal,
}: SteelOptimizationRankingTableProps): ReactElement {
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

  return (
    <div className="flex flex-col gap-2.5 text-xs">
      {/* 1. Header Rekomendasi Teratas */}
      <Card size="sm" className="border-border/40 bg-card/60">
        <CardContent className="flex items-center justify-between p-2.5">
          <div>
            <span className="text-muted-foreground text-[10px] font-medium">
              PROFIL TERPILIH (SNI 1729)
            </span>
            <div className="text-sm font-bold text-sky-400">{bestCandidate.properties.name}</div>
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
          </div>
        </CardContent>
      </Card>

      {/* 2. Potongan SVG 2D Profil Baja */}
      <div className="flex justify-center py-1">
        <SteelProfileCrossSectionSvg
          profileType={result.profileType}
          profileName={bestCandidate.properties.name}
          depthH={Number(
            (bestCandidate.properties as any).H ??
              Math.round(
                (Number(bestCandidate.properties.Ix) / Number(bestCandidate.properties.Sx)) * 2,
              ),
          )}
          widthB={Number(
            (bestCandidate.properties as any).B ??
              Math.round(
                (Number(bestCandidate.properties.Iy) / Number(bestCandidate.properties.Sy)) * 2,
              ),
          )}
          webThicknessTw={Number(
            (bestCandidate.properties as any).tw ?? (bestCandidate.properties as any).t ?? 8,
          )}
          flangeThicknessTf={Number(
            (bestCandidate.properties as any).tf ?? (bestCandidate.properties as any).t ?? 12,
          )}
          boxThicknessT={Number((bestCandidate.properties as any).t ?? 8)}
          width={220}
          height={180}
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
                : "Non-Kompak"}
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
            • Kapasitas Desain φMn: {Number(bestCandidate.ltb.designFlexuralPhiMn).toFixed(1)} kNm |
            Berat: {Number(bestCandidate.properties.unitWeightKgPerM).toFixed(1)} kg/m
          </div>
        </CardContent>
      </Card>

      {/* 4. Tabel Peringkat Kandidat */}
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-[10px] font-semibold">
          Peringkat Profil Alternatif:
        </span>
        <ScrollArea className="border-border/40 h-28 w-full rounded-md border">
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
              {compliantCandidates.slice(0, 5).map((c: SteelOptimizationCandidate) => (
                <TableRow key={c.properties.name} className="border-border/20">
                  <TableCell className="text-foreground px-2 py-1 font-semibold">
                    {c.properties.name}
                  </TableCell>
                  <TableCell className="px-2 py-1 text-right">
                    {(Number(c.governingDcr) * 100).toFixed(0)}%
                  </TableCell>
                  <TableCell className="text-muted-foreground px-2 py-1 text-right">
                    {Number(c.properties.unitWeightKgPerM).toFixed(0)} kg/m
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
              ))}
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
