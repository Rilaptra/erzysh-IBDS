/**
 * @file ExternalLoadInteractiveForm.tsx
 * @description Real-time interactive form for Mode A (External Loads):
 * - Clear span length L (m)
 * - 5 Support categories (8 boundary orientations)
 * - Point loads list (P in kN, position x in m)
 * - Distributed segment loads (q in kN/m, start x1, end x2 in m)
 * - Self-weight inclusion toggle
 */

"use client";

import React, { type ReactElement } from "react";

import { beamSimulatorActions, useBeamSimulatorStore } from "@/state/beam-simulator-store";
import type { SupportOrientation } from "@/types/beam-loading-modes";
import { kilonewton, kilonewtonPerMeter, meter } from "@/types/branded-units";

const SUPPORT_OPTIONS: Array<{ value: SupportOrientation; label: string }> = [
  { value: "PINNED_ROLLER", label: "Sendi — Rol (Simply Supported)" },
  { value: "ROLLER_PINNED", label: "Rol — Sendi" },
  { value: "CANTILEVER_LEFT", label: "Kantilever (Jepit Kiri — Bebas)" },
  { value: "CANTILEVER_RIGHT", label: "Kantilever (Bebas — Jepit Kanan)" },
  { value: "FIXED_FIXED", label: "Jepit — Jepit (Fixed End)" },
  { value: "FIXED_ROLLER", label: "Jepit — Rol" },
  { value: "ROLLER_FIXED", label: "Rol — Jepit" },
  { value: "FIXED_PINNED", label: "Jepit — Sendi" },
  { value: "PINNED_FIXED", label: "Sendi — Jepit" },
];

export function ExternalLoadInteractiveForm(): ReactElement {
  const { spanLengthM, supportOrientation, includeSelfWeight, pointLoads, distributedLoads } =
    useBeamSimulatorStore();

  const handleSpanChange = (val: number): void => {
    if (val > 0) {
      beamSimulatorActions.setSpanLength(val);
    }
  };

  const handleAddPointLoad = (): void => {
    const nextId = `P${pointLoads.length + 1}`;
    beamSimulatorActions.setPointLoads([
      ...pointLoads,
      {
        id: nextId,
        magnitude: kilonewton(30),
        position: meter(Number(spanLengthM) / 2),
      },
    ]);
  };

  const handleRemovePointLoad = (index: number): void => {
    beamSimulatorActions.setPointLoads(pointLoads.filter((_, idx) => idx !== index));
  };

  const handleUpdatePointLoad = (index: number, mag: number, pos: number): void => {
    const updated = [...pointLoads];
    const target = updated[index];
    if (target) {
      updated[index] = {
        ...target,
        magnitude: kilonewton(mag),
        position: meter(Math.min(Math.max(0, pos), Number(spanLengthM))),
      };
      beamSimulatorActions.setPointLoads(updated);
    }
  };

  const handleAddDistLoad = (): void => {
    const nextId = `Q${distributedLoads.length + 1}`;
    beamSimulatorActions.setDistributedLoads([
      ...distributedLoads,
      {
        id: nextId,
        magnitude: kilonewtonPerMeter(10),
        startPosition: meter(0),
        endPosition: meter(Number(spanLengthM)),
      },
    ]);
  };

  const handleRemoveDistLoad = (index: number): void => {
    beamSimulatorActions.setDistributedLoads(distributedLoads.filter((_, idx) => idx !== index));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 12 }}>
      {/* 1. Panjang Bentang L */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <label style={{ color: "#94A3B8", fontWeight: 600 }}>Panjang Bentang Balok (L)</label>
          <span style={{ color: "#38BDF8", fontWeight: 700, fontFamily: "monospace" }}>
            {Number(spanLengthM).toFixed(2)} m
          </span>
        </div>
        <input
          type="range"
          min="1"
          max="24"
          step="0.25"
          value={Number(spanLengthM)}
          onChange={(e) => handleSpanChange(parseFloat(e.target.value))}
          style={{ width: "100%", accentColor: "#06B6D4" }}
        />
      </div>

      {/* 2. Konfigurasi Tumpuan */}
      <div>
        <label style={{ display: "block", color: "#94A3B8", fontWeight: 600, marginBottom: 4 }}>
          Konfigurasi Tumpuan Balok
        </label>
        <select
          value={supportOrientation}
          onChange={(e) => beamSimulatorActions.setSupportOrientation(e.target.value as any)}
          style={{
            width: "100%",
            background: "rgba(30, 41, 59, 0.8)",
            border: "1px solid rgba(148, 163, 184, 0.2)",
            borderRadius: 6,
            color: "#F8FAFC",
            padding: "6px 8px",
            fontSize: 11,
            outline: "none",
          }}
        >
          {SUPPORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* 3. Beban Titik Terpusat (P) */}
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 4,
          }}
        >
          <label style={{ color: "#94A3B8", fontWeight: 600 }}>Beban Titik Terpusat (P)</label>
          <button
            type="button"
            onClick={handleAddPointLoad}
            style={{
              padding: "2px 8px",
              background: "rgba(6, 182, 212, 0.2)",
              border: "1px solid rgba(6, 182, 212, 0.4)",
              color: "#38BDF8",
              borderRadius: 4,
              fontSize: 10,
              cursor: "pointer",
            }}
          >
            + Tambah P
          </button>
        </div>

        {pointLoads.map((pl, idx) => (
          <div
            key={pl.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(30, 41, 59, 0.4)",
              padding: "4px 8px",
              borderRadius: 6,
              marginBottom: 4,
            }}
          >
            <span style={{ color: "#EF4444", fontWeight: 700, width: 22 }}>{pl.id}</span>
            <input
              type="number"
              value={Number(pl.magnitude)}
              onChange={(e) =>
                handleUpdatePointLoad(idx, parseFloat(e.target.value) || 0, Number(pl.position))
              }
              style={{
                width: 65,
                background: "rgba(15, 20, 22, 0.8)",
                border: "1px solid rgba(148, 163, 184, 0.2)",
                color: "#F8FAFC",
                borderRadius: 4,
                padding: "2px 4px",
                fontSize: 11,
              }}
            />
            <span style={{ color: "#64748B", fontSize: 10 }}>kN</span>
            <span style={{ color: "#64748B", fontSize: 10, marginLeft: "auto" }}>x =</span>
            <input
              type="number"
              step="0.1"
              value={Number(pl.position)}
              onChange={(e) =>
                handleUpdatePointLoad(idx, Number(pl.magnitude), parseFloat(e.target.value) || 0)
              }
              style={{
                width: 55,
                background: "rgba(15, 20, 22, 0.8)",
                border: "1px solid rgba(148, 163, 184, 0.2)",
                color: "#F8FAFC",
                borderRadius: 4,
                padding: "2px 4px",
                fontSize: 11,
              }}
            />
            <span style={{ color: "#64748B", fontSize: 10 }}>m</span>
            <button
              type="button"
              onClick={() => handleRemovePointLoad(idx)}
              style={{
                background: "transparent",
                border: "none",
                color: "#94A3B8",
                cursor: "pointer",
                padding: "0 4px",
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* 4. Beban Merata (q) */}
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 4,
          }}
        >
          <label style={{ color: "#94A3B8", fontWeight: 600 }}>Beban Merata (q)</label>
          <button
            type="button"
            onClick={handleAddDistLoad}
            style={{
              padding: "2px 8px",
              background: "rgba(16, 185, 129, 0.2)",
              border: "1px solid rgba(16, 185, 129, 0.4)",
              color: "#34D399",
              borderRadius: 4,
              fontSize: 10,
              cursor: "pointer",
            }}
          >
            + Tambah q
          </button>
        </div>

        {distributedLoads.map((dl, idx) => (
          <div
            key={dl.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(30, 41, 59, 0.4)",
              padding: "4px 8px",
              borderRadius: 6,
              marginBottom: 4,
            }}
          >
            <span style={{ color: "#10B981", fontWeight: 700, width: 22 }}>{dl.id}</span>
            <input
              type="number"
              value={Number(dl.magnitude)}
              onChange={(e) => {
                const updated = [...distributedLoads];
                const target = updated[idx];
                if (target) {
                  updated[idx] = {
                    ...target,
                    magnitude: kilonewtonPerMeter(parseFloat(e.target.value) || 0),
                  };
                  beamSimulatorActions.setDistributedLoads(updated);
                }
              }}
              style={{
                width: 65,
                background: "rgba(15, 20, 22, 0.8)",
                border: "1px solid rgba(148, 163, 184, 0.2)",
                color: "#F8FAFC",
                borderRadius: 4,
                padding: "2px 4px",
                fontSize: 11,
              }}
            />
            <span style={{ color: "#64748B", fontSize: 10 }}>kN/m</span>
            <button
              type="button"
              onClick={() => handleRemoveDistLoad(idx)}
              style={{
                background: "transparent",
                border: "none",
                color: "#94A3B8",
                cursor: "pointer",
                padding: "0 4px",
                marginLeft: "auto",
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ExternalLoadInteractiveForm;
