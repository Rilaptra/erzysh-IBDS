/**
 * @file CoordinateAxisSwitcher.tsx
 * @description Right-side HUD switcher for active 3D coordinate system modes:
 * - Z-Up: Civil Engineering standard (SAP2000, ETABS, Revit, AutoCAD)
 * - Y-Up: WebGL / Computer Graphics / CAD default (Three.js, SolidWorks)
 * - CustomXYZ: Custom orientation
 * Includes mini 3D Axis Gizmo SVG indicating spatial directions.
 */

"use client";

import React, { type CSSProperties, type ReactElement } from "react";

import { beamSimulatorActions, useBeamSimulatorStore } from "@/state/beam-simulator-store";
import type { CoordinateSystemMode } from "@/types/branded-units";

export interface CoordinateAxisSwitcherProps {
  readonly className?: string;
  readonly style?: CSSProperties;
}

/**
 * 3D Coordinate Axis Gizmo and quick-switch selector.
 */
export function CoordinateAxisSwitcher({
  className,
  style,
}: CoordinateAxisSwitcherProps): ReactElement {
  const { coordinateMode } = useBeamSimulatorStore();

  return (
    <div
      className={className}
      data-component="CoordinateAxisSwitcher"
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        right: 20,
        bottom: 24,
        background: "rgba(15, 20, 22, 0.86)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(148, 163, 184, 0.14)",
        borderRadius: 10,
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        zIndex: 10,
        pointerEvents: "auto",
        ...style,
      }}
    >
      {/* 3D Axis Mini Gizmo */}
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        {/* Origin Circle */}
        <circle cx="24" cy="24" r="3" fill="#64748B" />

        {/* X Axis: Red (Span length) */}
        <line
          x1="24"
          y1="24"
          x2="42"
          y2="24"
          stroke="#EF4444"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <text x="44" y="27" fill="#EF4444" fontSize="9" fontWeight="700">
          X
        </text>

        {/* Vertical Axis: Z (Blue for Z-Up) or Y (Green for Y-Up) */}
        <line
          x1="24"
          y1="24"
          x2="24"
          y2="6"
          stroke={coordinateMode === "Z-Up" ? "#3B82F6" : "#10B981"}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <text
          x="22"
          y="5"
          fill={coordinateMode === "Z-Up" ? "#3B82F6" : "#10B981"}
          fontSize="9"
          fontWeight="700"
        >
          {coordinateMode === "Z-Up" ? "Z" : "Y"}
        </text>

        {/* Depth Axis: Y (Green for Z-Up) or Z (Blue for Y-Up) */}
        <line
          x1="24"
          y1="24"
          x2="10"
          y2="36"
          stroke={coordinateMode === "Z-Up" ? "#10B981" : "#3B82F6"}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <text
          x="4"
          y="42"
          fill={coordinateMode === "Z-Up" ? "#10B981" : "#3B82F6"}
          fontSize="9"
          fontWeight="700"
        >
          {coordinateMode === "Z-Up" ? "Y" : "Z"}
        </text>
      </svg>

      {/* Axis Switcher Toggle Buttons */}
      <div style={{ display: "flex", gap: 4 }}>
        {(["Z-Up", "Y-Up"] as const).map((mode) => {
          const isActive = coordinateMode === mode;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => beamSimulatorActions.setCoordinateMode(mode)}
              title={
                mode === "Z-Up"
                  ? "Standar Rekayasa Sipil (SAP2000, Revit, AutoCAD)"
                  : "Standar WebGL & CAD (Three.js, SolidWorks)"
              }
              style={{
                border: "none",
                borderRadius: 6,
                padding: "4px 8px",
                fontSize: 10,
                fontWeight: isActive ? 700 : 500,
                cursor: "pointer",
                background: isActive
                  ? "linear-gradient(90deg, #06B6D4 0%, #3B82F6 100%)"
                  : "rgba(30, 41, 59, 0.6)",
                color: isActive ? "#F8FAFC" : "#94A3B8",
              }}
            >
              {mode}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default CoordinateAxisSwitcher;
