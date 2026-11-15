/**
 * @file MultiModeDiagram2DOverlay.tsx
 * @description Master 2D internal force diagram visualizer (SFD, BMD, NFD, TFD).
 * Supports 3 flexible placement modes:
 * - Mode 1: In-Place Beam Axis Overlay (directly on the 3D beam centerline)
 * - Mode 2: Stacked Vertical Alignment (series of diagrams below the beam)
 * - Mode 3: Dedicated Floating Window mode
 */

"use client";

import React, { type CSSProperties, type ReactElement, useId, useMemo } from "react";

import type { ZeroCopyStationViews } from "@/core/mechanics/wasm-mechanics-bridge";
import type { DiagramDisplayMode, DiagramVisibilityFlags } from "@/state/beam-simulator-store";

import type { ScreenProjection } from "./Beam3DExtrudedViewport";

export interface MultiModeDiagram2DOverlayProps {
  readonly stationViews: ZeroCopyStationViews | null;
  readonly displayMode: DiagramDisplayMode;
  readonly visibility: DiagramVisibilityFlags;
  readonly endAScreen: ScreenProjection | null;
  readonly endBScreen: ScreenProjection | null;
  readonly className?: string;
  readonly style?: CSSProperties;
}

/** Diagram colors adhering to civil engineering CAD conventions with distinct positive/negative pairs per force type. */
export const DIAGRAM_THEME = {
  sfd: {
    stroke: "#10B981", // Emerald Green (+)
    fill: "rgba(16, 185, 129, 0.22)",
    negStroke: "#F97316", // Orange (-)
    negFill: "rgba(249, 115, 22, 0.22)",
    label: "SFD (Gaya Geser Vu)",
    unit: "kN",
  },
  bmd: {
    stroke: "#06B6D4", // Cyan (+)
    fill: "rgba(6, 182, 212, 0.22)",
    negStroke: "#F43F5E", // Rose/Coral (-)
    negFill: "rgba(244, 63, 94, 0.22)",
    label: "BMD (Bidang Momen Mux)",
    unit: "kNm",
  },
  nfd: {
    stroke: "#A855F7", // Purple (+)
    fill: "rgba(168, 85, 247, 0.22)",
    negStroke: "#EC4899", // Magenta/Pink (-)
    negFill: "rgba(236, 72, 153, 0.22)",
    label: "NFD (Gaya Aksial Pu)",
    unit: "kN",
  },
  tfd: {
    stroke: "#F59E0B", // Amber (+)
    fill: "rgba(245, 158, 11, 0.22)",
    negStroke: "#818CF8", // Indigo (-)
    negFill: "rgba(129, 140, 248, 0.22)",
    label: "TFD (Momen Torsi Tu)",
    unit: "kNm",
  },
} as const;

/**
 * Builds an SVG path string from span station coordinates and value array.
 */
function buildDiagramSvgPath(
  stations: Float64Array,
  values: Float64Array,
  widthPx: number,
  heightPx: number,
  maxAbsoluteVal: number,
): { strokePath: string; fillPath: string } {
  if (stations.length === 0 || widthPx <= 0 || heightPx <= 0) {
    return { strokePath: "", fillPath: "" };
  }

  const L = stations[stations.length - 1] || 1;
  const centerY = heightPx / 2;
  const scale = maxAbsoluteVal > 0 ? (heightPx * 0.42) / maxAbsoluteVal : 0;

  let points: Array<[number, number]> = [];

  for (let i = 0; i < stations.length; i++) {
    const x = ((stations[i] || 0) / L) * widthPx;
    // In structural graphics, positive moments are plotted downwards or upwards depending on convention
    const y = centerY - (values[i] || 0) * scale;
    points.push([x, y]);
  }

  const strokePath = points
    .map((p, idx) => `${idx === 0 ? "M" : "L"} ${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join(" ");
  const fillPath = `M 0,${centerY} ${points.map((p) => `L ${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")} L ${widthPx},${centerY} Z`;

  return { strokePath, fillPath };
}

/**
 * Standalone Single 2D Diagram Graph Card with per-diagram distinct positive (+) and negative (-) colors.
 */
export function SingleDiagramCard({
  title,
  unit,
  strokeColor,
  fillColor,
  negativeStrokeColor = "#F43F5E",
  negativeFillColor = "rgba(244, 63, 94, 0.22)",
  stations,
  values,
  width = 440,
  height = 90,
}: {
  readonly title: string;
  readonly unit: string;
  readonly strokeColor: string;
  readonly fillColor: string;
  readonly negativeStrokeColor?: string;
  readonly negativeFillColor?: string;
  readonly stations: Float64Array;
  readonly values: Float64Array;
  readonly width?: number;
  readonly height?: number;
}): ReactElement {
  const clipBaseId = useId();
  const posClipId = `${clipBaseId}-pos`;
  const negClipId = `${clipBaseId}-neg`;
  const centerY = height / 2;

  let min = 0;
  let max = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i] || 0;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const maxAbs = Math.max(Math.abs(min), Math.abs(max), 1e-4);

  const { strokePath, fillPath } = useMemo(
    () => buildDiagramSvgPath(stations, values, width, height, maxAbs),
    [stations, values, width, height, maxAbs],
  );

  return (
    <div
      style={{
        background: "rgba(15, 20, 22, 0.7)",
        border: "1px solid rgba(148, 163, 184, 0.14)",
        borderRadius: 8,
        padding: "8px 12px",
        marginBottom: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          fontSize: 11,
          color: "#94A3B8",
          marginBottom: 4,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontWeight: 600, color: strokeColor }}>{title}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: strokeColor }}>
            (+) +{max.toFixed(1)} {unit}
          </span>
          <span style={{ color: "#475569" }}>|</span>
          <span style={{ color: negativeStrokeColor }}>
            (-) {min.toFixed(1)} {unit}
          </span>
        </span>
      </div>

      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: "block" }}
      >
        <defs>
          <clipPath id={posClipId}>
            <rect x="0" y="0" width={width} height={centerY} />
          </clipPath>
          <clipPath id={negClipId}>
            <rect x="0" y={centerY} width={width} height={height - centerY} />
          </clipPath>
        </defs>

        {/* Baseline Center Zero */}
        <line
          x1="0"
          y1={centerY}
          x2={width}
          y2={centerY}
          stroke="#334155"
          strokeWidth="1"
          strokeDasharray="3 3"
        />

        {/* Positive Region (>= 0) */}
        <g clipPath={`url(#${posClipId})`}>
          <path d={fillPath} fill={fillColor} />
          <path d={strokePath} fill="none" stroke={strokeColor} strokeWidth="2" />
        </g>

        {/* Negative Region (< 0) */}
        <g clipPath={`url(#${negClipId})`}>
          <path d={fillPath} fill={negativeFillColor} />
          <path d={strokePath} fill="none" stroke={negativeStrokeColor} strokeWidth="2" />
        </g>
      </svg>
    </div>
  );
}

/**
 * Multi-Mode 2D Diagram Overlay Component.
 */
export function MultiModeDiagram2DOverlay({
  stationViews,
  displayMode,
  visibility,
  endAScreen,
  endBScreen,
  className,
  style,
}: MultiModeDiagram2DOverlayProps): ReactElement | null {
  if (!stationViews) return null;

  const { stationsM, shearForceKn, bendingMomentMajorKnm, normalForceKn, torsionMomentKnm } =
    stationViews;

  // Mode 2: Stacked Vertical below the beam
  if (displayMode === "STACKED_VERTICAL") {
    if (!endAScreen || !endBScreen) return null;

    const spanWidthPx = Math.max(Math.abs(endBScreen.x - endAScreen.x), 200);
    const leftPx = Math.min(endAScreen.x, endBScreen.x);
    const topPx = Math.max(endAScreen.y, endBScreen.y) + 40;

    return (
      <div
        className={className}
        style={{
          position: "absolute",
          left: `${leftPx}px`,
          top: `${topPx}px`,
          width: `${spanWidthPx}px`,
          zIndex: 6,
          pointerEvents: "none",
          ...style,
        }}
      >
        {visibility.bmd ? (
          <SingleDiagramCard
            title={DIAGRAM_THEME.bmd.label}
            unit={DIAGRAM_THEME.bmd.unit}
            strokeColor={DIAGRAM_THEME.bmd.stroke}
            fillColor={DIAGRAM_THEME.bmd.fill}
            negativeStrokeColor={DIAGRAM_THEME.bmd.negStroke}
            negativeFillColor={DIAGRAM_THEME.bmd.negFill}
            stations={stationsM}
            values={bendingMomentMajorKnm}
            width={spanWidthPx}
            height={80}
          />
        ) : null}

        {visibility.sfd ? (
          <SingleDiagramCard
            title={DIAGRAM_THEME.sfd.label}
            unit={DIAGRAM_THEME.sfd.unit}
            strokeColor={DIAGRAM_THEME.sfd.stroke}
            fillColor={DIAGRAM_THEME.sfd.fill}
            negativeStrokeColor={DIAGRAM_THEME.sfd.negStroke}
            negativeFillColor={DIAGRAM_THEME.sfd.negFill}
            stations={stationsM}
            values={shearForceKn}
            width={spanWidthPx}
            height={80}
          />
        ) : null}

        {visibility.nfd ? (
          <SingleDiagramCard
            title={DIAGRAM_THEME.nfd.label}
            unit={DIAGRAM_THEME.nfd.unit}
            strokeColor={DIAGRAM_THEME.nfd.stroke}
            fillColor={DIAGRAM_THEME.nfd.fill}
            negativeStrokeColor={DIAGRAM_THEME.nfd.negStroke}
            negativeFillColor={DIAGRAM_THEME.nfd.negFill}
            stations={stationsM}
            values={normalForceKn}
            width={spanWidthPx}
            height={70}
          />
        ) : null}

        {visibility.tfd ? (
          <SingleDiagramCard
            title={DIAGRAM_THEME.tfd.label}
            unit={DIAGRAM_THEME.tfd.unit}
            strokeColor={DIAGRAM_THEME.tfd.stroke}
            fillColor={DIAGRAM_THEME.tfd.fill}
            negativeStrokeColor={DIAGRAM_THEME.tfd.negStroke}
            negativeFillColor={DIAGRAM_THEME.tfd.negFill}
            stations={stationsM}
            values={torsionMomentKnm}
            width={spanWidthPx}
            height={70}
          />
        ) : null}
      </div>
    );
  }

  // Mode 1: In-Place Beam Axis Overlay (drawn on the projected centerline)
  if (displayMode === "IN_PLACE_BEAM_AXIS" && endAScreen && endBScreen) {
    const spanWidthPx = Math.max(Math.abs(endBScreen.x - endAScreen.x), 200);
    const leftPx = Math.min(endAScreen.x, endBScreen.x);
    const topPx = (endAScreen.y + endBScreen.y) / 2 - 40;

    return (
      <div
        className={className}
        style={{
          position: "absolute",
          left: `${leftPx}px`,
          top: `${topPx}px`,
          width: `${spanWidthPx}px`,
          height: 80,
          zIndex: 6,
          pointerEvents: "none",
          ...style,
        }}
      >
        {visibility.bmd ? (
          <SingleDiagramCard
            title={DIAGRAM_THEME.bmd.label}
            unit={DIAGRAM_THEME.bmd.unit}
            strokeColor={DIAGRAM_THEME.bmd.stroke}
            fillColor={DIAGRAM_THEME.bmd.fill}
            negativeStrokeColor={DIAGRAM_THEME.bmd.negStroke}
            negativeFillColor={DIAGRAM_THEME.bmd.negFill}
            stations={stationsM}
            values={bendingMomentMajorKnm}
            width={spanWidthPx}
            height={80}
          />
        ) : null}
      </div>
    );
  }

  // Mode 3 is displayed within Floating Window 5
  return null;
}

export default MultiModeDiagram2DOverlay;
