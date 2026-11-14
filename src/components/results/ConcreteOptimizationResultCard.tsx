/**
 * @file ConcreteOptimizationResultCard.tsx
 * @description Result card displaying SNI 2847:2019 reinforced concrete optimization summary:
 * - Optimal cross-section dimensions (bw x h)
 * - Longitudinal tensile reinforcement detailing (layers, rebar count & diameter, clear spacing)
 * - Compression reinforcement (A's)
 * - Flexural capacity phi*Mn & DCR
 * - Transverse shear stirrup spacing s & shear capacity phi*Vn
 */

"use client";

import { cn } from "cn";
import React, { type ReactElement } from "react";

import { ConcreteCrossSectionSvg } from "@/components/canvas/ConcreteCrossSectionSvg";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import type {
  ConcreteOptimizationResult,
  RebarLayerArrangement,
} from "@/types/concrete-sni2847-types";

export interface ConcreteOptimizationResultCardProps {
  readonly result: ConcreteOptimizationResult | null;
  readonly onOpenExportModal?: () => void;
}

export function ConcreteOptimizationResultCard({
  result,
  onOpenExportModal,
}: ConcreteOptimizationResultCardProps): ReactElement {
  if (!result) {
    return (
      <Empty className="py-6 text-center">
        <EmptyDescription className="text-muted-foreground text-xs">
          Menunggu input gaya dalam untuk menghitung desain beton SNI 2847…
        </EmptyDescription>
      </Empty>
    );
  }

  const { section, flexure, shear } = result;

  return (
    <div className="flex min-w-0 flex-col gap-2.5 text-xs">
      {/* 1. Header Ringkasan Penampang */}
      <Card size="sm" className="border-border/50 bg-card/95 min-w-0">
        <CardContent className="flex items-start justify-between gap-2 p-2.5">
          <div className="min-w-0 flex-1">
            <span className="text-muted-foreground text-[10px] font-medium">DIMENSI PENAMPANG</span>
            <div className="text-sm font-bold text-sky-400">
              {Number(section.bw)} × {Number(section.h)} mm
            </div>
          </div>

          <div className="shrink-0 text-right">
            <span className="text-muted-foreground text-[10px] font-medium whitespace-nowrap">
              RASIO TULANGAN (ρ)
            </span>
            <div className="text-xs font-bold text-amber-300">
              {(result.reinforcementRatioRho * 100).toFixed(2)}%
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Gambar Potongan SVG 2D */}
      <div className="flex justify-center py-0.5">
        <ConcreteCrossSectionSvg result={result} width={220} height={200} />
      </div>

      {/* 3. Desain Lentur (Whitney Flexure) */}
      <Card size="sm" className="border-border/50 bg-card/95 min-w-0">
        <CardHeader className="flex flex-row items-center justify-between px-3 pt-2.5 pb-1">
          <CardTitle className="text-xs font-bold text-sky-400">Tulangan Lentur (As)</CardTitle>
          <Badge
            variant={Number(flexure.flexuralDcr) > 1.0 ? "destructive" : "secondary"}
            className="text-[10px] font-semibold"
          >
            DCR: {(Number(flexure.flexuralDcr) * 100).toFixed(1)}%
          </Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 px-3 pb-2.5 text-[11px]">
          <div className="text-foreground/90">
            • Tarik:{" "}
            {flexure.tensionLayers
              .map(
                (l: RebarLayerArrangement, i: number) =>
                  `${l.barCount} D${Number(l.barDiameter)} (Lapis ${i + 1})`,
              )
              .join(", ")}
          </div>
          <div className="text-muted-foreground">
            • As Perlu: {Math.round(Number(flexure.requiredAs))} mm² | Terpasang:{" "}
            {Math.round(Number(flexure.providedAs))} mm²
          </div>
          <div className="text-muted-foreground">
            • Kapasitas Desain φMn: {Number(flexure.designMomentPhiMn).toFixed(1)} kNm
          </div>
        </CardContent>
      </Card>

      <Separator className="my-0.5 opacity-40" />

      {/* 4. Desain Geser (Stirrups) */}
      <Card size="sm" className="border-border/50 bg-card/95 min-w-0">
        <CardHeader className="flex flex-row items-center justify-between px-3 pt-2.5 pb-1">
          <CardTitle className="text-xs font-bold text-emerald-400">Sengkang Geser (Av)</CardTitle>
          <Badge
            variant={Number(shear.shearDcr) > 1.0 ? "destructive" : "secondary"}
            className="text-[10px] font-semibold"
          >
            DCR: {(Number(shear.shearDcr) * 100).toFixed(1)}%
          </Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 px-3 pb-2.5 text-[11px]">
          <div className="text-foreground/90">
            • Sengkang: {shear.stirrupLegs}-Kaki D{Number(shear.stirrupDiameter)} — jarak{" "}
            {Number(shear.stirrupSpacing)} mm
          </div>
          <div className="text-muted-foreground">
            • Kapasitas Desain φVn: {Number(shear.designShearPhiVn).toFixed(1)} kN (Vc ={" "}
            {Number(shear.concreteShearStrengthVc).toFixed(1)} kN)
          </div>
        </CardContent>
      </Card>

      {/* 5. Tombol Ekspor CAD / BIM */}
      {onOpenExportModal ? (
        <Button
          type="button"
          onClick={onOpenExportModal}
          className="mt-1 h-auto min-h-9 w-full bg-linear-to-r from-cyan-500 to-blue-600 py-2 text-center leading-snug font-bold whitespace-normal text-white shadow-sm hover:from-cyan-600 hover:to-blue-700"
        >
          📦 Ekspor Gambar CAD (.dxf) & Model BIM (.ifc)
        </Button>
      ) : null}
    </div>
  );
}

export default ConcreteOptimizationResultCard;
