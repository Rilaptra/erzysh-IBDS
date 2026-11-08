/**
 * @file MaterialAndLoadModeSelector.tsx
 * @description Form component for Window 1:
 * - Material Selector (Beton Bertulang vs Baja Struktural)
 * - Load Mode Selector (Mode A: External Loads vs Mode B: Direct Internal Forces)
 * - 3D Concrete Sub-Mode (Solid + Potongan Ujung vs Wireframe Tulangan)
 * - Batas Lendutan Izin (L/180, L/240, L/360, L/480)
 * - Tampilan Diagram 2D & Checkboxes (SFD, BMD, NFD, TFD)
 */

"use client";

import React, { type ReactElement } from "react";

import { beamSimulatorActions, useBeamSimulatorStore } from "@/state/beam-simulator-store";

export function MaterialAndLoadModeSelector(): ReactElement {
  const {
    materialKind,
    loadingMode,
    concreteViewMode,
    deflectionLimitDenominator,
    diagramDisplayMode,
    visibleDiagrams,
  } = useBeamSimulatorStore();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 12 }}>
      {/* 1. Material Selector */}
      <div>
        <label style={{ display: "block", color: "#94A3B8", fontWeight: 600, marginBottom: 4 }}>
          Jenis Material Struktur
        </label>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={() => beamSimulatorActions.setMaterialKind("STEEL")}
            style={{
              flex: 1,
              padding: "7px 10px",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              fontWeight: materialKind === "STEEL" ? 700 : 500,
              background:
                materialKind === "STEEL"
                  ? "linear-gradient(90deg, #06B6D4 0%, #3B82F6 100%)"
                  : "rgba(30, 41, 59, 0.6)",
              color: materialKind === "STEEL" ? "#FFFFFF" : "#94A3B8",
            }}
          >
            Baja (SNI 1729)
          </button>
          <button
            type="button"
            onClick={() => beamSimulatorActions.setMaterialKind("CONCRETE")}
            style={{
              flex: 1,
              padding: "7px 10px",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              fontWeight: materialKind === "CONCRETE" ? 700 : 500,
              background:
                materialKind === "CONCRETE"
                  ? "linear-gradient(90deg, #06B6D4 0%, #3B82F6 100%)"
                  : "rgba(30, 41, 59, 0.6)",
              color: materialKind === "CONCRETE" ? "#FFFFFF" : "#94A3B8",
            }}
          >
            Beton (SNI 2847)
          </button>
        </div>
      </div>

      {/* 2. Loading Mode Selector */}
      <div>
        <label style={{ display: "block", color: "#94A3B8", fontWeight: 600, marginBottom: 4 }}>
          Paradigma Pembebanan
        </label>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={() => beamSimulatorActions.setLoadingMode("MODE_A_EXTERNAL_LOADS")}
            style={{
              flex: 1,
              padding: "7px 8px",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              fontWeight: loadingMode === "MODE_A_EXTERNAL_LOADS" ? 700 : 500,
              background:
                loadingMode === "MODE_A_EXTERNAL_LOADS"
                  ? "linear-gradient(90deg, #3B82F6 0%, #8B5CF6 100%)"
                  : "rgba(30, 41, 59, 0.6)",
              color: loadingMode === "MODE_A_EXTERNAL_LOADS" ? "#FFFFFF" : "#94A3B8",
            }}
          >
            Mode A: Beban Eksternal
          </button>
          <button
            type="button"
            onClick={() => beamSimulatorActions.setLoadingMode("MODE_B_DIRECT_INTERNAL_FORCES")}
            style={{
              flex: 1,
              padding: "7px 8px",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              fontWeight: loadingMode === "MODE_B_DIRECT_INTERNAL_FORCES" ? 700 : 500,
              background:
                loadingMode === "MODE_B_DIRECT_INTERNAL_FORCES"
                  ? "linear-gradient(90deg, #3B82F6 0%, #8B5CF6 100%)"
                  : "rgba(30, 41, 59, 0.6)",
              color: loadingMode === "MODE_B_DIRECT_INTERNAL_FORCES" ? "#FFFFFF" : "#94A3B8",
            }}
          >
            Mode B: Gaya Dalam
          </button>
        </div>
      </div>

      {/* 3. Sub-Mode Beton 3D (Hanya tampil jika Beton) */}
      {materialKind === "CONCRETE" ? (
        <div>
          <label style={{ display: "block", color: "#94A3B8", fontWeight: 600, marginBottom: 4 }}>
            Sub-Mode Visualisasi Beton 3D
          </label>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              onClick={() => beamSimulatorActions.setConcreteViewMode("SOLID_WITH_END_SECTION")}
              style={{
                flex: 1,
                padding: "6px 8px",
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: concreteViewMode === "SOLID_WITH_END_SECTION" ? 700 : 500,
                background:
                  concreteViewMode === "SOLID_WITH_END_SECTION"
                    ? "rgba(6, 182, 212, 0.25)"
                    : "rgba(30, 41, 59, 0.6)",
                color: concreteViewMode === "SOLID_WITH_END_SECTION" ? "#38BDF8" : "#94A3B8",
                borderWidth: 1,
                borderStyle: "solid",
                borderColor:
                  concreteViewMode === "SOLID_WITH_END_SECTION"
                    ? "#06B6D4"
                    : "rgba(148, 163, 184, 0.1)",
              }}
            >
              Solid + Potongan
            </button>
            <button
              type="button"
              onClick={() => beamSimulatorActions.setConcreteViewMode("WIREFRAME_REBAR_CAGE")}
              style={{
                flex: 1,
                padding: "6px 8px",
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: concreteViewMode === "WIREFRAME_REBAR_CAGE" ? 700 : 500,
                background:
                  concreteViewMode === "WIREFRAME_REBAR_CAGE"
                    ? "rgba(6, 182, 212, 0.25)"
                    : "rgba(30, 41, 59, 0.6)",
                color: concreteViewMode === "WIREFRAME_REBAR_CAGE" ? "#38BDF8" : "#94A3B8",
                borderWidth: 1,
                borderStyle: "solid",
                borderColor:
                  concreteViewMode === "WIREFRAME_REBAR_CAGE"
                    ? "#06B6D4"
                    : "rgba(148, 163, 184, 0.1)",
              }}
            >
              Wireframe Tulangan
            </button>
          </div>
        </div>
      ) : null}

      {/* 4. Batas Lendutan Izin */}
      <div>
        <label style={{ display: "block", color: "#94A3B8", fontWeight: 600, marginBottom: 4 }}>
          Batas Lendutan Izin SNI
        </label>
        <div style={{ display: "flex", gap: 4 }}>
          {([180, 240, 360, 480] as const).map((denom) => {
            const isSel = deflectionLimitDenominator === denom;
            return (
              <button
                key={denom}
                type="button"
                onClick={() => beamSimulatorActions.setDeflectionLimitDenominator(denom)}
                style={{
                  flex: 1,
                  padding: "5px 4px",
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: isSel ? 700 : 500,
                  background: isSel ? "rgba(16, 185, 129, 0.25)" : "rgba(30, 41, 59, 0.6)",
                  color: isSel ? "#34D399" : "#94A3B8",
                  borderWidth: 1,
                  borderStyle: "solid",
                  borderColor: isSel ? "#10B981" : "rgba(148, 163, 184, 0.1)",
                }}
              >
                L/{denom}
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Tampilan Diagram Gaya Dalam */}
      <div>
        <label style={{ display: "block", color: "#94A3B8", fontWeight: 600, marginBottom: 4 }}>
          Mode Tampilan Diagram 2D
        </label>
        <select
          value={diagramDisplayMode}
          onChange={(e) => beamSimulatorActions.setDiagramDisplayMode(e.target.value as any)}
          style={{
            width: "100%",
            background: "rgba(30, 41, 59, 0.8)",
            border: "1px solid rgba(148, 163, 184, 0.2)",
            borderRadius: 6,
            color: "#F8FAFC",
            padding: "6px 8px",
            fontSize: 11,
            outline: "none",
            marginBottom: 6,
          }}
        >
          <option value="IN_PLACE_BEAM_AXIS">Mode 1: Bertumpuk di As Balok</option>
          <option value="STACKED_VERTICAL">Mode 2: Sejajar Vertikal ke Bawah</option>
          <option value="FLOATING_WINDOW">Mode 3: Jendela Khusus Terpisah</option>
        </select>

        {/* Checkbox toggles per diagram */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 4 }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: "#10B981",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={visibleDiagrams.sfd}
              onChange={() => beamSimulatorActions.toggleDiagramVisibility("sfd")}
            />
            SFD (Geser)
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: "#06B6D4",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={visibleDiagrams.bmd}
              onChange={() => beamSimulatorActions.toggleDiagramVisibility("bmd")}
            />
            BMD (Momen)
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: "#A855F7",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={visibleDiagrams.nfd}
              onChange={() => beamSimulatorActions.toggleDiagramVisibility("nfd")}
            />
            NFD (Aksial)
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: "#F59E0B",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={visibleDiagrams.tfd}
              onChange={() => beamSimulatorActions.toggleDiagramVisibility("tfd")}
            />
            TFD (Torsi)
          </label>
        </div>
      </div>
    </div>
  );
}

export default MaterialAndLoadModeSelector;
