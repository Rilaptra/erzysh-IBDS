/**
 * @file DeflectionHudAndColorbar.tsx
 * @description Master HUD displaying:
 * 1. Right Edge: Vertical Deflection Colorbar Legend (0.00 mm -> -Δ_max mm) using SAP2000 gradient colors.
 * 2. Bottom-Left: Maximum Deflection Card (-Δ_max mm, station x, allowable limit L/limit, and AMAN/NG badge).
 */

"use client";

import React, { type CSSProperties, type ReactElement } from "react";

import type { DeflectionEvaluationResult } from "@/config/deflection-limits-config";

export interface DeflectionHudAndColorbarProps {
  /** Maximum downward deflection in mm (negative sign). */
  readonly maxDeflectionMm: number;
  /** Span station where maximum deflection occurs (meters). */
  readonly maxDeflectionStationM: number;
  /** Serviceability deflection evaluation compliance. */
  readonly compliance: DeflectionEvaluationResult | null;
  /** Selected deflection limit denominator (e.g. 360 for L/360). */
  readonly limitDenominator: number;
  readonly className?: string;
  readonly style?: CSSProperties;
}

/**
 * Deflection HUD and Colorbar Legend component.
 */
export function DeflectionHudAndColorbar({
  maxDeflectionMm,
  maxDeflectionStationM,
  compliance,
  limitDenominator,
  className,
  style,
}: DeflectionHudAndColorbarProps): ReactElement {
  const peakMagnitude = Math.abs(maxDeflectionMm);
  const isSatisfied = compliance?.isCompliant ?? true;

  return (
    <div
      className={className}
      data-component="DeflectionHudAndColorbar"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 10,
        ...style,
      }}
    >
      {/* 1. RIGHT EDGE: Vertical Colorbar Legend */}
      <div
        style={{
          position: "absolute",
          right: 20,
          top: "50%",
          transform: "translateY(-50%)",
          background: "rgba(15, 20, 22, 0.86)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(148, 163, 184, 0.14)",
          borderRadius: 10,
          padding: "12px 14px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          pointerEvents: "auto",
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", letterSpacing: 0.5 }}>
          LENDUTAN (mm)
        </span>

        <div style={{ display: "flex", gap: 8, alignItems: "stretch", height: 180 }}>
          {/* Vertical Color Gradient Bar (SAP2000 Blue -> Cyan -> Green -> Yellow -> Red) */}
          <div
            style={{
              width: 14,
              borderRadius: 7,
              background:
                "linear-gradient(180deg, #3B82F6 0%, #06B6D4 25%, #10B981 50%, #EAB308 75%, #EF4444 100%)",
              boxShadow: "0 0 10px rgba(6, 182, 212, 0.3)",
            }}
          />

          {/* Tick Labels */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              fontSize: 10,
              fontFamily: "monospace",
              color: "#CBD5E1",
            }}
          >
            <span> 0.00</span>
            <span>-{(peakMagnitude * 0.25).toFixed(2)}</span>
            <span>-{(peakMagnitude * 0.5).toFixed(2)}</span>
            <span>-{(peakMagnitude * 0.75).toFixed(2)}</span>
            <span style={{ color: "#FCA5A5", fontWeight: 700 }}>-{peakMagnitude.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* 2. BOTTOM-LEFT: Maximum Deflection Status Card */}
      <div
        style={{
          position: "absolute",
          left: 24,
          bottom: 24,
          background: "rgba(15, 20, 22, 0.90)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(148, 163, 184, 0.16)",
          borderRadius: 10,
          padding: "12px 16px",
          minWidth: 260,
          pointerEvents: "auto",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 6,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", letterSpacing: 0.5 }}>
            LENDUTAN MAKSIMUM
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 6,
              background: isSatisfied ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
              color: isSatisfied ? "#34D399" : "#F87171",
              border: `1px solid ${isSatisfied ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)"}`,
            }}
          >
            {isSatisfied ? "AMAN (OK)" : "MELEBIHI BATAS (NG)"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
          <span
            style={{ fontSize: 22, fontWeight: 800, fontFamily: "monospace", color: "#F8FAFC" }}
          >
            -{peakMagnitude.toFixed(2)}
          </span>
          <span style={{ fontSize: 12, color: "#64748B" }}>mm</span>
          <span style={{ fontSize: 11, color: "#94A3B8", marginLeft: "auto" }}>
            di x = {maxDeflectionStationM.toFixed(2)} m
          </span>
        </div>

        <div
          style={{
            fontSize: 11,
            color: "#94A3B8",
            borderTop: "1px solid rgba(148, 163, 184, 0.1)",
            paddingTop: 4,
          }}
        >
          Batas Izin (L/{limitDenominator}):{" "}
          <strong style={{ color: "#E2E8F0" }}>
            -{Math.abs(compliance?.allowableLimitMm ?? 0).toFixed(2)} mm
          </strong>{" "}
          {compliance?.deflectionDcr !== undefined
            ? `(${(compliance.deflectionDcr * 100).toFixed(1)}%)`
            : ""}
        </div>
      </div>
    </div>
  );
}

export default DeflectionHudAndColorbar;
