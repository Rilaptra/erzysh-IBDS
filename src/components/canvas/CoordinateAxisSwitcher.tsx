/**
 * @file CoordinateAxisSwitcher.tsx
 * @description Right-side HUD switcher for active 3D coordinate system modes:
 * - Z-Up: Civil Engineering standard (SAP2000, ETABS, Revit, AutoCAD)
 * - Y-Up: WebGL / Computer Graphics / CAD default (Three.js, SolidWorks)
 * - CustomXYZ: Custom orientation
 * Includes mini 3D Axis Gizmo SVG indicating spatial directions.
 */

"use client";

import { cn } from "cn";
import React, { type CSSProperties, type ReactElement } from "react";

import { Card } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
    <Card
      size="sm"
      className={cn(
        "border-border/40 bg-card/85 pointer-events-auto absolute right-5 bottom-6 z-10 flex flex-col items-center gap-2 p-2.5 shadow-lg backdrop-blur-md",
        className,
      )}
      data-component="CoordinateAxisSwitcher"
      onPointerDown={(e) => e.stopPropagation()}
      style={style}
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

      {/* Axis Switcher ToggleGroup */}
      <ToggleGroup
        type="single"
        value={coordinateMode}
        onValueChange={(val) => {
          if (val) {
            beamSimulatorActions.setCoordinateMode(val as CoordinateSystemMode);
          }
        }}
        size="sm"
        variant="outline"
        spacing={1}
      >
        <ToggleGroupItem
          value="Z-Up"
          title="Standar Rekayasa Sipil (SAP2000, Revit, AutoCAD)"
          className="h-6 px-2 text-[10px] font-medium"
        >
          Z-Up
        </ToggleGroupItem>
        <ToggleGroupItem
          value="Y-Up"
          title="Standar WebGL & CAD (Three.js, SolidWorks)"
          className="h-6 px-2 text-[10px] font-medium"
        >
          Y-Up
        </ToggleGroupItem>
      </ToggleGroup>
    </Card>
  );
}

export default CoordinateAxisSwitcher;
