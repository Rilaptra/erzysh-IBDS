/**
 * @file SteelDesignParametersForm.tsx
 * @description Form component for structural steel design parameters (SNI 1729:2020):
 * - Profile type filter (IWF vs BOX)
 * - Steel material grade (BJ 34 s/d BJ 55)
 * - Lateral unbraced length Lb (m) for LTB analysis
 * - Maximum geometric depth Hmax and flange width Bmax filters
 */

"use client";

import React, { type ReactElement } from "react";

import { beamSimulatorActions, useBeamSimulatorStore } from "@/state/beam-simulator-store";
import type { SteelGrade, SteelProfileType } from "@/types/steel-sni1729-types";

const STEEL_GRADES: Array<{ value: SteelGrade; label: string }> = [
  { value: "BJ_34", label: "BJ 34 (fy = 210 MPa, fu = 340 MPa)" },
  { value: "BJ_37", label: "BJ 37 (fy = 240 MPa, fu = 370 MPa)" },
  { value: "BJ_41", label: "BJ 41 (fy = 250 MPa, fu = 410 MPa)" },
  { value: "BJ_50", label: "BJ 50 (fy = 290 MPa, fu = 500 MPa)" },
  { value: "BJ_55", label: "BJ 55 (fy = 410 MPa, fu = 550 MPa)" },
];

export function SteelDesignParametersForm(): ReactElement {
  const {
    steelProfileType,
    steelGrade,
    steelUnbracedLengthLbM,
    steelMaxHeightMm,
    steelMaxWidthMm,
  } = useBeamSimulatorStore();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 12 }}>
      {/* 1. Tipe Penampang Baja */}
      <div>
        <label style={{ display: "block", color: "#94A3B8", fontWeight: 600, marginBottom: 4 }}>
          Tipe Penampang Baja Standar
        </label>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={() => beamSimulatorActions.setSteelParameters({ profileType: "IWF" })}
            style={{
              flex: 1,
              padding: "6px 8px",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              fontWeight: steelProfileType === "IWF" ? 700 : 500,
              background:
                steelProfileType === "IWF"
                  ? "linear-gradient(90deg, #06B6D4 0%, #3B82F6 100%)"
                  : "rgba(30, 41, 59, 0.6)",
              color: steelProfileType === "IWF" ? "#FFFFFF" : "#94A3B8",
            }}
          >
            IWF / H-Beam
          </button>
          <button
            type="button"
            onClick={() => beamSimulatorActions.setSteelParameters({ profileType: "BOX" })}
            style={{
              flex: 1,
              padding: "6px 8px",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              fontWeight: steelProfileType === "BOX" ? 700 : 500,
              background:
                steelProfileType === "BOX"
                  ? "linear-gradient(90deg, #06B6D4 0%, #3B82F6 100%)"
                  : "rgba(30, 41, 59, 0.6)",
              color: steelProfileType === "BOX" ? "#FFFFFF" : "#94A3B8",
            }}
          >
            BOX / Hollow HSS
          </button>
        </div>
      </div>

      {/* 2. Mutu Material Baja */}
      <div>
        <label style={{ display: "block", color: "#94A3B8", fontWeight: 600, marginBottom: 2 }}>
          Mutu Baja Struktural (SNI 1729 / JIS G 3101)
        </label>
        <select
          value={steelGrade}
          onChange={(e) =>
            beamSimulatorActions.setSteelParameters({ grade: e.target.value as SteelGrade })
          }
          style={{
            width: "100%",
            background: "rgba(30, 41, 59, 0.8)",
            border: "1px solid rgba(148, 163, 184, 0.2)",
            borderRadius: 6,
            color: "#F8FAFC",
            padding: "6px 8px",
            fontSize: 11,
          }}
        >
          {STEEL_GRADES.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
      </div>

      {/* 3. Panjang Tak Terkekang Lateral Lb */}
      <div>
        <label style={{ display: "block", color: "#94A3B8", fontWeight: 600, marginBottom: 2 }}>
          Panjang Tak Terkekang Lateral Lb (m)
        </label>
        <input
          type="number"
          step="0.5"
          value={Number(steelUnbracedLengthLbM)}
          onChange={(e) =>
            beamSimulatorActions.setSteelParameters({
              unbracedLengthLbM: parseFloat(e.target.value) || 1,
            })
          }
          style={{
            width: "100%",
            background: "rgba(30, 41, 59, 0.8)",
            border: "1px solid rgba(148, 163, 184, 0.2)",
            color: "#F8FAFC",
            borderRadius: 6,
            padding: "6px 8px",
            fontSize: 11,
          }}
        />
        <span style={{ fontSize: 10, color: "#64748B" }}>
          Digunakan untuk analisis Tekuk Torsi Lateral (LTB SNI Bab F).
        </span>
      </div>

      {/* 4. Filter Batasan Geometri Maksimum (Hmax & Bmax) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <label style={{ display: "block", color: "#94A3B8", fontWeight: 600, marginBottom: 2 }}>
            Batas Hmax (mm)
          </label>
          <input
            type="number"
            placeholder="Tanpa batas"
            value={steelMaxHeightMm ? Number(steelMaxHeightMm) : ""}
            onChange={(e) =>
              beamSimulatorActions.setSteelParameters({
                maxHeightMm: e.target.value ? parseFloat(e.target.value) : undefined,
              })
            }
            style={{
              width: "100%",
              background: "rgba(30, 41, 59, 0.8)",
              border: "1px solid rgba(148, 163, 184, 0.2)",
              color: "#F8FAFC",
              borderRadius: 6,
              padding: "5px 8px",
              fontSize: 11,
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", color: "#94A3B8", fontWeight: 600, marginBottom: 2 }}>
            Batas Bmax (mm)
          </label>
          <input
            type="number"
            placeholder="Tanpa batas"
            value={steelMaxWidthMm ? Number(steelMaxWidthMm) : ""}
            onChange={(e) =>
              beamSimulatorActions.setSteelParameters({
                maxWidthMm: e.target.value ? parseFloat(e.target.value) : undefined,
              })
            }
            style={{
              width: "100%",
              background: "rgba(30, 41, 59, 0.8)",
              border: "1px solid rgba(148, 163, 184, 0.2)",
              color: "#F8FAFC",
              borderRadius: 6,
              padding: "5px 8px",
              fontSize: 11,
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default SteelDesignParametersForm;
