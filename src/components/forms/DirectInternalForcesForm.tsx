/**
 * @file DirectInternalForcesForm.tsx
 * @description Real-time interactive form for Mode B (Direct Factored Internal Forces):
 * - Factored strong-axis moment Mux (kNm)
 * - Factored shear force Vu (kN)
 * - Factored axial force Pu (kN)
 * - Factored weak-axis moment Muy (kNm)
 * - Factored torsion Tu (kNm)
 * - Span length L (m)
 */

"use client";

import React, { type ReactElement } from "react";

import { beamSimulatorActions, useBeamSimulatorStore } from "@/state/beam-simulator-store";

export function DirectInternalForcesForm(): ReactElement {
  const {
    directSpanLengthM,
    directMomentMuxKnm,
    directShearVuKn,
    directAxialPuKn,
    directMomentMuyKnm,
    directTorsionTuKnm,
  } = useBeamSimulatorStore();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 12 }}>
      {/* 1. Bentang L */}
      <div>
        <label style={{ display: "block", color: "#94A3B8", fontWeight: 600, marginBottom: 2 }}>
          Panjang Bentang Balok (L)
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="number"
            step="0.5"
            value={Number(directSpanLengthM)}
            onChange={(e) =>
              beamSimulatorActions.setDirectForces({ spanLengthM: parseFloat(e.target.value) || 1 })
            }
            style={{
              flex: 1,
              background: "rgba(30, 41, 59, 0.8)",
              border: "1px solid rgba(148, 163, 184, 0.2)",
              color: "#F8FAFC",
              borderRadius: 6,
              padding: "6px 8px",
              fontSize: 11,
            }}
          />
          <span style={{ color: "#64748B", fontSize: 11 }}>meter</span>
        </div>
      </div>

      {/* 2. Mux (Momen Lentur Utama) */}
      <div>
        <label style={{ display: "block", color: "#06B6D4", fontWeight: 700, marginBottom: 2 }}>
          Momen Lentur Terfaktor Mux
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="number"
            value={Number(directMomentMuxKnm)}
            onChange={(e) =>
              beamSimulatorActions.setDirectForces({
                momentMuxKnm: parseFloat(e.target.value) || 0,
              })
            }
            style={{
              flex: 1,
              background: "rgba(30, 41, 59, 0.8)",
              border: "1px solid rgba(6, 182, 212, 0.3)",
              color: "#F8FAFC",
              borderRadius: 6,
              padding: "6px 8px",
              fontSize: 11,
            }}
          />
          <span style={{ color: "#64748B", fontSize: 11 }}>kNm</span>
        </div>
      </div>

      {/* 3. Vu (Gaya Geser) */}
      <div>
        <label style={{ display: "block", color: "#10B981", fontWeight: 700, marginBottom: 2 }}>
          Gaya Geser Terfaktor Vu
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="number"
            value={Number(directShearVuKn)}
            onChange={(e) =>
              beamSimulatorActions.setDirectForces({ shearVuKn: parseFloat(e.target.value) || 0 })
            }
            style={{
              flex: 1,
              background: "rgba(30, 41, 59, 0.8)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              color: "#F8FAFC",
              borderRadius: 6,
              padding: "6px 8px",
              fontSize: 11,
            }}
          />
          <span style={{ color: "#64748B", fontSize: 11 }}>kN</span>
        </div>
      </div>

      {/* 4. Pu (Gaya Aksial) */}
      <div>
        <label style={{ display: "block", color: "#A855F7", fontWeight: 700, marginBottom: 2 }}>
          Gaya Aksial Terfaktor Pu
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="number"
            value={Number(directAxialPuKn)}
            onChange={(e) =>
              beamSimulatorActions.setDirectForces({ axialPuKn: parseFloat(e.target.value) || 0 })
            }
            style={{
              flex: 1,
              background: "rgba(30, 41, 59, 0.8)",
              border: "1px solid rgba(168, 85, 247, 0.3)",
              color: "#F8FAFC",
              borderRadius: 6,
              padding: "6px 8px",
              fontSize: 11,
            }}
          />
          <span style={{ color: "#64748B", fontSize: 11 }}>kN (+T / -C)</span>
        </div>
      </div>

      {/* 5. Muy (Momen Sumbu Lemah) */}
      <div>
        <label style={{ display: "block", color: "#94A3B8", fontWeight: 600, marginBottom: 2 }}>
          Momen Sumbu Lemah Muy (Khusus Baja)
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="number"
            value={Number(directMomentMuyKnm)}
            onChange={(e) =>
              beamSimulatorActions.setDirectForces({
                momentMuyKnm: parseFloat(e.target.value) || 0,
              })
            }
            style={{
              flex: 1,
              background: "rgba(30, 41, 59, 0.8)",
              border: "1px solid rgba(148, 163, 184, 0.2)",
              color: "#F8FAFC",
              borderRadius: 6,
              padding: "6px 8px",
              fontSize: 11,
            }}
          />
          <span style={{ color: "#64748B", fontSize: 11 }}>kNm</span>
        </div>
      </div>

      {/* 6. Tu (Torsi) */}
      <div>
        <label style={{ display: "block", color: "#F59E0B", fontWeight: 600, marginBottom: 2 }}>
          Momen Puntir / Torsi Tu (Khusus Baja)
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="number"
            value={Number(directTorsionTuKnm)}
            onChange={(e) =>
              beamSimulatorActions.setDirectForces({
                torsionTuKnm: parseFloat(e.target.value) || 0,
              })
            }
            style={{
              flex: 1,
              background: "rgba(30, 41, 59, 0.8)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              color: "#F8FAFC",
              borderRadius: 6,
              padding: "6px 8px",
              fontSize: 11,
            }}
          />
          <span style={{ color: "#64748B", fontSize: 11 }}>kNm</span>
        </div>
      </div>
    </div>
  );
}

export default DirectInternalForcesForm;
