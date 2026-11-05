/**
 * @file SteelOptimizationRankingTable.tsx
 * @description Ranking table & summary card for SNI 1729:2020 structural steel optimization:
 * - Optimal governing profile recommendation (0.90 <= DCR <= 1.00)
 * - Section compactness status (Kompak / Non-Kompak / Langsing)
 * - LTB zone (Zona 1 / 2 / 3)
 * - Candidate profile rankings table
 */

"use client";

import React, { type ReactElement } from "react";

import { SteelProfileCrossSectionSvg } from "@/components/canvas/SteelProfileCrossSectionSvg";
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
      <div style={{ color: "#64748B", fontSize: 12, padding: 12, textAlign: "center" }}>
        Menunggu hasil kalkulasi gaya dalam untuk mencari profil baja ekonomis…
      </div>
    );
  }

  const { bestCandidate, compliantCandidates } = result;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 12 }}>
      {/* 1. Header Rekomendasi Teratas */}
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
          <span style={{ fontSize: 10, color: "#94A3B8" }}>PROFIL TERPILIH (SNI 1729)</span>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#38BDF8" }}>
            {bestCandidate.properties.name}
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <span style={{ fontSize: 10, color: "#94A3B8" }}>EFISIENSI DCR</span>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: Number(bestCandidate.governingDcr) <= 1.0 ? "#34D399" : "#F87171",
            }}
          >
            {(Number(bestCandidate.governingDcr) * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* 2. Potongan SVG 2D Profil Baja */}
      <div style={{ display: "flex", justifyContent: "center" }}>
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
      <div
        style={{
          background: "rgba(15, 20, 22, 0.6)",
          border: "1px solid rgba(148, 163, 184, 0.12)",
          borderRadius: 6,
          padding: 8,
          fontSize: 11,
          lineHeight: 1.5,
        }}
      >
        <div>
          • Klasifikasi Penampang:{" "}
          <strong style={{ color: "#38BDF8" }}>
            {bestCandidate.compactness.governingClassification === "COMPACT"
              ? "Kompak"
              : "Non-Kompak"}
          </strong>{" "}
          (Sayap: {bestCandidate.compactness.flangeClassification}, Badan:{" "}
          {bestCandidate.compactness.webClassification})
        </div>
        <div>
          • Kondisi Tekuk LTB:{" "}
          <strong style={{ color: "#10B981" }}>
            {bestCandidate.ltb.governingZone === "ZONE_1_PLASTIC"
              ? "Zona 1 (Plastis Penuh)"
              : bestCandidate.ltb.governingZone === "ZONE_2_INELASTIC_LTB"
                ? "Zona 2 (Inelastis)"
                : "Zona 3 (Tekuk Elastis)"}
          </strong>
        </div>
        <div>
          • Kapasitas Desain φMn: {Number(bestCandidate.ltb.designFlexuralPhiMn).toFixed(1)} kNm |
          Berat: {Number(bestCandidate.properties.unitWeightKgPerM).toFixed(1)} kg/m
        </div>
      </div>

      {/* 4. Tabel Peringkat Kandidat */}
      <div>
        <span style={{ fontSize: 10, color: "#94A3B8", fontWeight: 600 }}>
          Peringkat Profil Alternatif:
        </span>
        <div style={{ maxHeight: 110, overflowY: "auto", marginTop: 4 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
            <thead>
              <tr style={{ color: "#64748B", borderBottom: "1px solid rgba(148, 163, 184, 0.1)" }}>
                <th style={{ textAlign: "left", padding: "2px 4px" }}>Profil</th>
                <th style={{ textAlign: "right", padding: "2px 4px" }}>DCR</th>
                <th style={{ textAlign: "right", padding: "2px 4px" }}>Berat</th>
                <th style={{ textAlign: "center", padding: "2px 4px" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {compliantCandidates.slice(0, 5).map((c: SteelOptimizationCandidate) => (
                <tr
                  key={c.properties.name}
                  style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.05)" }}
                >
                  <td style={{ padding: "3px 4px", color: "#F8FAFC", fontWeight: 600 }}>
                    {c.properties.name}
                  </td>
                  <td style={{ textAlign: "right", padding: "3px 4px" }}>
                    {(Number(c.governingDcr) * 100).toFixed(0)}%
                  </td>
                  <td style={{ textAlign: "right", padding: "3px 4px", color: "#94A3B8" }}>
                    {Number(c.properties.unitWeightKgPerM).toFixed(0)} kg/m
                  </td>
                  <td style={{ textAlign: "center", padding: "3px 4px" }}>
                    <span
                      style={{
                        padding: "1px 5px",
                        borderRadius: 3,
                        fontSize: 9,
                        background:
                          c.status === "OPTIMAL"
                            ? "rgba(16, 185, 129, 0.2)"
                            : "rgba(30, 41, 59, 0.6)",
                        color: c.status === "OPTIMAL" ? "#34D399" : "#94A3B8",
                      }}
                    >
                      {c.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Tombol Ekspor CAD / CAE */}
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
          📦 Ekspor CAD (.dxf), SAP2000 (.s2k), & STEP (.step)
        </button>
      ) : null}
    </div>
  );
}

export default SteelOptimizationRankingTable;
