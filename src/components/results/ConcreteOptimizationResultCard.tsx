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

import React, { type ReactElement } from "react";

import { ConcreteCrossSectionSvg } from "@/components/canvas/ConcreteCrossSectionSvg";
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
      <div style={{ color: "#64748B", fontSize: 12, padding: 12, textAlign: "center" }}>
        Menunggu input gaya dalam untuk menghitung desain beton SNI 2847…
      </div>
    );
  }

  const { section, flexure, shear } = result;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 12 }}>
      {/* 1. Header Ringkasan Penampang */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "rgba(30, 41, 59, 0.4)",
          padding: "8px 10px",
          borderRadius: 6,
        }}
      >
        <div>
          <span style={{ fontSize: 10, color: "#94A3B8" }}>DIMENSI PENAMPANG</span>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#38BDF8" }}>
            {Number(section.bw)} × {Number(section.h)} mm
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <span style={{ fontSize: 10, color: "#94A3B8" }}>RASIO TULANGAN (ρ)</span>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#FCD34D" }}>
            {(result.reinforcementRatioRho * 100).toFixed(2)}%
          </div>
        </div>
      </div>

      {/* 2. Gambar Potongan SVG 2D */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <ConcreteCrossSectionSvg result={result} width={220} height={200} />
      </div>

      {/* 3. Desain Lentur (Whitney Flexure) */}
      <div
        style={{
          background: "rgba(15, 20, 22, 0.6)",
          border: "1px solid rgba(148, 163, 184, 0.12)",
          borderRadius: 6,
          padding: 8,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <strong style={{ color: "#38BDF8" }}>Tulangan Lentur (As)</strong>
          <span style={{ color: "#94A3B8" }}>
            DCR: <strong>{(Number(flexure.flexuralDcr) * 100).toFixed(1)}%</strong>
          </span>
        </div>

        <div style={{ fontSize: 11, color: "#CBD5E1" }}>
          • Tarik:{" "}
          {flexure.tensionLayers
            .map(
              (l: RebarLayerArrangement, i: number) =>
                `${l.barCount} D${Number(l.barDiameter)} (Lapis ${i + 1})`,
            )
            .join(", ")}
        </div>
        <div style={{ fontSize: 11, color: "#94A3B8" }}>
          • As Perlu: {Math.round(Number(flexure.requiredAs))} mm² | Terpasang:{" "}
          {Math.round(Number(flexure.providedAs))} mm²
        </div>
        <div style={{ fontSize: 11, color: "#94A3B8" }}>
          • Kapasitas Desain φMn: {Number(flexure.designMomentPhiMn).toFixed(1)} kNm
        </div>
      </div>

      {/* 4. Desain Geser (Stirrups) */}
      <div
        style={{
          background: "rgba(15, 20, 22, 0.6)",
          border: "1px solid rgba(148, 163, 184, 0.12)",
          borderRadius: 6,
          padding: 8,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <strong style={{ color: "#10B981" }}>Sengkang Geser (Av)</strong>
          <span style={{ color: "#94A3B8" }}>
            DCR: <strong>{(Number(shear.shearDcr) * 100).toFixed(1)}%</strong>
          </span>
        </div>

        <div style={{ fontSize: 11, color: "#CBD5E1" }}>
          • Sengkang: {shear.stirrupLegs}-Kaki D{Number(shear.stirrupDiameter)} — jarak{" "}
          {Number(shear.stirrupSpacing)} mm
        </div>
        <div style={{ fontSize: 11, color: "#94A3B8" }}>
          • Kapasitas Desain φVn: {Number(shear.designShearPhiVn).toFixed(1)} kN (Vc ={" "}
          {Number(shear.concreteShearStrengthVc).toFixed(1)} kN)
        </div>
      </div>

      {/* 5. Tombol Ekspor CAD / BIM */}
      {onOpenExportModal ? (
        <button
          type="button"
          onClick={onOpenExportModal}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: "none",
            cursor: "pointer",
            fontWeight: 700,
            background: "linear-gradient(90deg, #06B6D4 0%, #3B82F6 100%)",
            color: "#FFFFFF",
            marginTop: 4,
          }}
        >
          📦 Ekspor Gambar CAD (.dxf) & Model BIM (.ifc)
        </button>
      ) : null}
    </div>
  );
}

export default ConcreteOptimizationResultCard;
