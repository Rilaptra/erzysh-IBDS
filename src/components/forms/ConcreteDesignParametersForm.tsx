/**
 * @file ConcreteDesignParametersForm.tsx
 * @description Form component for reinforced concrete design parameters (SNI 2847:2019):
 * - Cylinder fc' (MPa) or Cube K-xxx selector
 * - Section dimensions (bw x h in mm)
 * - Concrete clear cover (dc in mm)
 * - Longitudinal and stirrup rebar grade selectors (BJTP / BJTS)
 * - Maximum aggregate size
 */

"use client";

import React, { type ReactElement } from "react";

import { beamSimulatorActions, useBeamSimulatorStore } from "@/state/beam-simulator-store";
import type { ConcreteCubeGrade, RebarSteelGrade } from "@/types/concrete-sni2847-types";

const CUBE_GRADES: ConcreteCubeGrade[] = [
  "K_175",
  "K_200",
  "K_225",
  "K_250",
  "K_300",
  "K_350",
  "K_400",
  "K_500",
];

const REBAR_GRADES: Array<{ value: RebarSteelGrade; label: string }> = [
  { value: "BJTP_24", label: "BJTP 24 (Polos, fy = 240 MPa)" },
  { value: "BJTP_30", label: "BJTP 30 (Polos, fy = 300 MPa)" },
  { value: "BJTS_40", label: "BJTS 40 (Ulir, fy = 400 MPa)" },
  { value: "BJTS_50", label: "BJTS 50 (Ulir, fy = 500 MPa)" },
  { value: "BJTS_60", label: "BJTS 60 (Ulir, fy = 600 MPa)" },
];

export function ConcreteDesignParametersForm(): ReactElement {
  const {
    concreteBwMm,
    concreteHMm,
    concreteCoverMm,
    concreteFcMpa,
    concreteCubeGrade,
    longitudinalRebarGrade,
    stirrupRebarGrade,
    maxAggregateSizeMm,
  } = useBeamSimulatorStore();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 12 }}>
      {/* 1. Mutu Beton: Silinder fc' atau Kubus K */}
      <div>
        <label style={{ display: "block", color: "#94A3B8", fontWeight: 600, marginBottom: 4 }}>
          Mutu Kuat Tekan Beton
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <div>
            <span style={{ fontSize: 10, color: "#64748B" }}>Silinder fc' (MPa)</span>
            <input
              type="number"
              min="17"
              max="60"
              value={Number(concreteFcMpa)}
              onChange={(e) =>
                beamSimulatorActions.setConcreteParameters({
                  fcMpa: parseFloat(e.target.value) || 25,
                  cubeGrade: null,
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
            <span style={{ fontSize: 10, color: "#64748B" }}>Atau Kubus K-xxx</span>
            <select
              value={concreteCubeGrade ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                if (val) {
                  beamSimulatorActions.setConcreteParameters({
                    cubeGrade: val as ConcreteCubeGrade,
                  });
                } else {
                  beamSimulatorActions.setConcreteParameters({ cubeGrade: null });
                }
              }}
              style={{
                width: "100%",
                background: "rgba(30, 41, 59, 0.8)",
                border: "1px solid rgba(148, 163, 184, 0.2)",
                color: "#F8FAFC",
                borderRadius: 6,
                padding: "5px 8px",
                fontSize: 11,
              }}
            >
              <option value="">Pilih K-xxx...</option>
              {CUBE_GRADES.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 2. Dimensi Penampang Balok (bw x h) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <label style={{ display: "block", color: "#94A3B8", fontWeight: 600, marginBottom: 2 }}>
            Lebar bw (mm)
          </label>
          <input
            type="number"
            step="25"
            value={Number(concreteBwMm)}
            onChange={(e) =>
              beamSimulatorActions.setConcreteParameters({
                bwMm: parseFloat(e.target.value) || 200,
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
            Tinggi h (mm)
          </label>
          <input
            type="number"
            step="50"
            value={Number(concreteHMm)}
            onChange={(e) =>
              beamSimulatorActions.setConcreteParameters({ hMm: parseFloat(e.target.value) || 300 })
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

      {/* 3. Selimut Beton (dc) */}
      <div>
        <label style={{ display: "block", color: "#94A3B8", fontWeight: 600, marginBottom: 2 }}>
          Tebal Selimut Beton Bersih dc (mm)
        </label>
        <input
          type="number"
          step="5"
          value={Number(concreteCoverMm)}
          onChange={(e) =>
            beamSimulatorActions.setConcreteParameters({
              coverMm: parseFloat(e.target.value) || 40,
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

      {/* 4. Mutu Baja Tulangan Longitudinal */}
      <div>
        <label style={{ display: "block", color: "#94A3B8", fontWeight: 600, marginBottom: 2 }}>
          Mutu Tulangan Pokok Memanjang
        </label>
        <select
          value={longitudinalRebarGrade}
          onChange={(e) =>
            beamSimulatorActions.setConcreteParameters({
              longitudinalGrade: e.target.value as RebarSteelGrade,
            })
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
          {REBAR_GRADES.map((rg) => (
            <option key={rg.value} value={rg.value}>
              {rg.label}
            </option>
          ))}
        </select>
      </div>

      {/* 5. Mutu Baja Tulangan Sengkang Geser */}
      <div>
        <label style={{ display: "block", color: "#94A3B8", fontWeight: 600, marginBottom: 2 }}>
          Mutu Tulangan Sengkang Geser
        </label>
        <select
          value={stirrupRebarGrade}
          onChange={(e) =>
            beamSimulatorActions.setConcreteParameters({
              stirrupGrade: e.target.value as RebarSteelGrade,
            })
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
          {REBAR_GRADES.map((rg) => (
            <option key={rg.value} value={rg.value}>
              {rg.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default ConcreteDesignParametersForm;
