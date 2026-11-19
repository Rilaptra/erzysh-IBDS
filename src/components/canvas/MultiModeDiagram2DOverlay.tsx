/**
 * @file MultiModeDiagram2DOverlay.tsx
 * @description Master 2D/3D-projected internal force diagram visualizer (SFD, BMD, NFD, TFD).
 * Supports 3 flexible placement modes:
 * - Mode 1 (`IN_PLACE_BEAM_AXIS`): True 3D-projected SVG overlay along the beam centerline
 *   using `ViewportProjectionSnapshot` (`worldUp` + perspective/orthographic matrix)
 * - Mode 2 (`STACKED_VERTICAL`): Series of 2D diagram cards stacked below the beam
 * - Mode 3 (`FLOATING_WINDOW`): Dedicated Floating Window mode (rendered in Window 5)
 */

"use client";

import React, { type CSSProperties, type ReactElement, useId, useMemo } from "react";

import type { ZeroCopyStationViews } from "@/core/mechanics/wasm-mechanics-bridge";
import type { DiagramDisplayMode, DiagramVisibilityFlags } from "@/state/beam-simulator-store";

import {
  projectWorldToScreen,
  type ScreenProjection,
  type Vec3Tuple,
  type ViewportProjectionSnapshot,
} from "./Beam3DExtrudedViewport";

export type DiagramKey = "bmd" | "sfd" | "nfd" | "tfd";

export interface DiagramPoint2D {
  readonly x: number;
  readonly y: number;
}

export interface BeamDiagramProjector {
  /** Projects normalized span position `t ∈ [0, 1]` and visual ordinate `offsetPx` along `worldUp`. */
  readonly project: (t: number, offsetPx: number) => DiagramPoint2D | null;
  /** Projected beam centerline end A (`t = 0`). */
  readonly endA: DiagramPoint2D;
  /** Projected beam centerline end B (`t = 1`). */
  readonly endB: DiagramPoint2D;
  /** Projected beam span length in CSS px. */
  readonly spanPixelLength: number;
  /** Target visual peak ordinate height in CSS px at midspan. */
  readonly peakHeightPx: number;
}

export interface ProjectedDiagramSegment {
  readonly sign: "positive" | "negative";
  readonly strokePath: string;
  readonly fillPath: string;
  readonly points: readonly DiagramPoint2D[];
}

export interface ProjectedDiagramExtrema {
  readonly value: number;
  readonly stationM: number;
  readonly basePoint: DiagramPoint2D;
  readonly curvePoint: DiagramPoint2D;
}

export interface ProjectedDiagram3D {
  readonly key: DiagramKey;
  readonly shortLabel: string;
  readonly unit: string;
  readonly minVal: number;
  readonly maxVal: number;
  readonly maxAbs: number;
  readonly segments: readonly ProjectedDiagramSegment[];
  readonly zeroLinePath: string;
  readonly positivePeak: ProjectedDiagramExtrema | null;
  readonly negativePeak: ProjectedDiagramExtrema | null;
  readonly lowestScreenY: number;
}

export interface MultiModeDiagram2DOverlayProps {
  readonly stationViews: ZeroCopyStationViews | null;
  readonly displayMode: DiagramDisplayMode;
  readonly visibility: DiagramVisibilityFlags;
  /** Full 3D viewport projection snapshot for true 3D beam-axis projection in Mode 1. */
  readonly projection?: ViewportProjectionSnapshot | null;
  /** Optional span length (m) fallback when station array does not end at span length. */
  readonly spanLengthM?: number;
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
    shortLabel: "SFD",
    unit: "kN",
  },
  bmd: {
    stroke: "#06B6D4", // Cyan (+)
    fill: "rgba(6, 182, 212, 0.22)",
    negStroke: "#F43F5E", // Rose/Coral (-)
    negFill: "rgba(244, 63, 94, 0.22)",
    label: "BMD (Bidang Momen Mux)",
    shortLabel: "BMD",
    unit: "kNm",
  },
  nfd: {
    stroke: "#A855F7", // Purple (+)
    fill: "rgba(168, 85, 247, 0.22)",
    negStroke: "#EC4899", // Magenta/Pink (-)
    negFill: "rgba(236, 72, 153, 0.22)",
    label: "NFD (Gaya Aksial Pu)",
    shortLabel: "NFD",
    unit: "kN",
  },
  tfd: {
    stroke: "#F59E0B", // Amber (+)
    fill: "rgba(245, 158, 11, 0.22)",
    negStroke: "#818CF8", // Indigo (-)
    negFill: "rgba(129, 140, 248, 0.22)",
    label: "TFD (Momen Torsi Tu)",
    shortLabel: "TFD",
    unit: "kNm",
  },
} as const;

const DIAGRAM_ORDER: readonly DiagramKey[] = ["bmd", "sfd", "nfd", "tfd"];
const MAX_DIAGRAM_SAMPLES = 80;
const TARGET_PEAK_HEIGHT_PX = 62;
const MIN_PEAK_HEIGHT_PX = 34;
const ZERO_EPSILON = 1e-6;
const PILL_WIDTH = 204;
const PILL_HALF_W = PILL_WIDTH / 2;
const PILL_HEIGHT = 20;
const PILL_HALF_H = PILL_HEIGHT / 2;
const PILL_STEP_Y = 24;

/**
 * Creates a low-allocation 3D projector mapping `(t, offsetPx)` along the beam centerline
 * and `projection.worldUp`. Falls back cleanly to `endAScreen -> endBScreen` + screen-up `(0, -1)`
 * when `projection` is absent.
 */
export function createBeamDiagramProjector(
  projection: ViewportProjectionSnapshot | null | undefined,
  endAScreen: ScreenProjection | null,
  endBScreen: ScreenProjection | null,
): BeamDiagramProjector | null {
  const topA = projection?.beamTopAWorld ?? null;
  const topB = projection?.beamTopBWorld ?? null;

  if (projection && topA && topB && projection.widthCss > 0 && projection.heightCss > 0) {
    const vp = projection.viewProjection;
    const w = projection.widthCss;
    const h = projection.heightCss;
    const up = projection.worldUp;

    const screenTopA = projectWorldToScreen(vp, topA, w, h);
    const screenTopB = projectWorldToScreen(vp, topB, w, h);
    if (!screenTopA || !screenTopB) return null;

    // Derive world-space vertical shift from beam top flange down to beam centerline using endAScreen.
    const sampleMm = Math.max(projection.worldUnitsPerPixel * 48, 10);
    let centerlineShiftMm = 0;
    const refEndA = projection.endAScreen ?? endAScreen;
    if (refEndA) {
      const topAUpWorld: Vec3Tuple = [
        topA[0] + up[0] * sampleMm,
        topA[1] + up[1] * sampleMm,
        topA[2] + up[2] * sampleMm,
      ];
      const screenTopAUp = projectWorldToScreen(vp, topAUpWorld, w, h);
      if (screenTopAUp) {
        const uX = (screenTopAUp.x - screenTopA.x) / sampleMm;
        const uY = (screenTopAUp.y - screenTopA.y) / sampleMm;
        const uLenSq = uX * uX + uY * uY;
        if (uLenSq > 1e-10) {
          const rawShift =
            ((refEndA.x - screenTopA.x) * uX + (refEndA.y - screenTopA.y) * uY) / uLenSq;
          centerlineShiftMm = Math.max(-2_000, Math.min(0, rawShift));
        }
      }
    }

    const centerA: Vec3Tuple = [
      topA[0] + up[0] * centerlineShiftMm,
      topA[1] + up[1] * centerlineShiftMm,
      topA[2] + up[2] * centerlineShiftMm,
    ];
    const centerB: Vec3Tuple = [
      topB[0] + up[0] * centerlineShiftMm,
      topB[1] + up[1] * centerlineShiftMm,
      topB[2] + up[2] * centerlineShiftMm,
    ];

    const spanDx = centerB[0] - centerA[0];
    const spanDy = centerB[1] - centerA[1];
    const spanDz = centerB[2] - centerA[2];

    const screenA = projectWorldToScreen(vp, centerA, w, h);
    const screenB = projectWorldToScreen(vp, centerB, w, h);
    if (!screenA || !screenB) return null;

    const spanPixelLength = Math.hypot(screenB.x - screenA.x, screenB.y - screenA.y);
    if (spanPixelLength < 20) return null;

    // Calibrate CSS pixels per world-mm along `worldUp` at beam midpoint.
    const midWorld: Vec3Tuple = [
      centerA[0] + 0.5 * spanDx,
      centerA[1] + 0.5 * spanDy,
      centerA[2] + 0.5 * spanDz,
    ];
    const midUpWorld: Vec3Tuple = [
      midWorld[0] + up[0] * sampleMm,
      midWorld[1] + up[1] * sampleMm,
      midWorld[2] + up[2] * sampleMm,
    ];
    const midScreen = projectWorldToScreen(vp, midWorld, w, h);
    const midUpScreen = projectWorldToScreen(vp, midUpWorld, w, h);

    let pxPerMmUp = 0;
    if (midScreen && midUpScreen) {
      pxPerMmUp = Math.hypot(midUpScreen.x - midScreen.x, midUpScreen.y - midScreen.y) / sampleMm;
    }

    const minPxPerMmUp = 0.25 / Math.max(projection.worldUnitsPerPixel, 1e-3);
    const useWorldUpProjection = pxPerMmUp > 1e-5;
    const effectivePxPerMmUp = Math.max(pxPerMmUp, minPxPerMmUp);
    const peakHeightPx = Math.min(
      TARGET_PEAK_HEIGHT_PX,
      Math.max(MIN_PEAK_HEIGHT_PX, spanPixelLength * 0.22),
    );

    const scratchWorld: [number, number, number] = [0, 0, 0];

    const project = (t: number, offsetPx: number): DiagramPoint2D | null => {
      if (useWorldUpProjection) {
        const worldOffsetMm = offsetPx / effectivePxPerMmUp;
        scratchWorld[0] = centerA[0] + t * spanDx + up[0] * worldOffsetMm;
        scratchWorld[1] = centerA[1] + t * spanDy + up[1] * worldOffsetMm;
        scratchWorld[2] = centerA[2] + t * spanDz + up[2] * worldOffsetMm;
        const p = projectWorldToScreen(vp, scratchWorld, w, h);
        return p ? { x: p.x, y: p.y } : null;
      }

      scratchWorld[0] = centerA[0] + t * spanDx;
      scratchWorld[1] = centerA[1] + t * spanDy;
      scratchWorld[2] = centerA[2] + t * spanDz;
      const base = projectWorldToScreen(vp, scratchWorld, w, h);
      return base ? { x: base.x, y: base.y - offsetPx } : null;
    };

    return {
      project,
      endA: { x: screenA.x, y: screenA.y },
      endB: { x: screenB.x, y: screenB.y },
      spanPixelLength,
      peakHeightPx,
    };
  }

  // Fallback when only 2D screen endpoints are supplied: interpolate along endA -> endB with screen-up (0, -1).
  if (!endAScreen || !endBScreen) return null;
  const dx = endBScreen.x - endAScreen.x;
  const dy = endBScreen.y - endAScreen.y;
  const spanPixelLength = Math.hypot(dx, dy);
  if (spanPixelLength < 20) return null;

  const peakHeightPx = Math.min(
    TARGET_PEAK_HEIGHT_PX,
    Math.max(MIN_PEAK_HEIGHT_PX, spanPixelLength * 0.22),
  );

  return {
    project: (t: number, offsetPx: number): DiagramPoint2D => ({
      x: endAScreen.x + t * dx,
      y: endAScreen.y + t * dy - offsetPx,
    }),
    endA: { x: endAScreen.x, y: endAScreen.y },
    endB: { x: endBScreen.x, y: endBScreen.y },
    spanPixelLength,
    peakHeightPx,
  };
}

/**
 * Downsamples a station/value series to at most `maxSamples` indices while always preserving
 * endpoints, exact global extrema, sign-change brackets (for exact zero-crossing interpolation),
 * and sharp step discontinuities (e.g. point-load jumps in SFD).
 */
export function downsampleDiagramIndices(
  stations: Float64Array,
  values: Float64Array,
  maxSamples = MAX_DIAGRAM_SAMPLES,
): number[] {
  const n = Math.min(stations.length, values.length);
  if (n === 0) return [];
  const cap = Math.max(4, maxSamples);
  if (n <= cap) {
    const all: number[] = new Array(n);
    for (let i = 0; i < n; i++) all[i] = i;
    return all;
  }

  let minIdx = 0;
  let maxIdx = 0;
  let minVal = values[0] ?? 0;
  let maxVal = values[0] ?? 0;
  for (let i = 1; i < n; i++) {
    const v = values[i] ?? 0;
    if (v < minVal) {
      minVal = v;
      minIdx = i;
    }
    if (v > maxVal) {
      maxVal = v;
      maxIdx = i;
    }
  }
  const maxAbs = Math.max(Math.abs(minVal), Math.abs(maxVal), ZERO_EPSILON);
  const jumpThreshold = maxAbs * 0.12;

  const selected = new Set<number>([0, n - 1, minIdx, maxIdx]);

  // Preserve sign-change brackets and sharp step discontinuities (capped to avoid pathological blowup).
  let featureCount = 0;
  for (let i = 0; i < n - 1 && featureCount < 16; i++) {
    const v0 = values[i] ?? 0;
    const v1 = values[i + 1] ?? 0;
    const crossesZero = (v0 > 0 && v1 < 0) || (v0 < 0 && v1 > 0);
    const sharpJump = Math.abs(v1 - v0) > jumpThreshold;
    if (crossesZero || sharpJump) {
      selected.add(i);
      selected.add(i + 1);
      featureCount++;
    }
  }

  const remaining = Math.max(0, cap - selected.size);
  if (remaining > 0) {
    const step = (n - 1) / (remaining + 1);
    for (let k = 1; k <= remaining; k++) {
      selected.add(Math.round(k * step));
    }
  }

  return Array.from(selected).sort((a, b) => a - b);
}

interface SampleTV {
  readonly t: number;
  readonly v: number;
}

/**
 * Projects a single internal force series into true 3D screen-space SVG segments split cleanly
 * into positive (`>= 0`) and negative (`< 0`) polygons at interpolated zero-crossings.
 */
export function buildProjectedDiagram3D(
  key: DiagramKey,
  stations: Float64Array,
  values: Float64Array,
  projector: BeamDiagramProjector,
  spanLengthM?: number,
): ProjectedDiagram3D | null {
  const n = Math.min(stations.length, values.length);
  if (n < 2) return null;

  const lastStation = stations[n - 1] ?? 0;
  const spanL = lastStation > ZERO_EPSILON ? lastStation : (spanLengthM ?? 1);
  if (spanL <= ZERO_EPSILON) return null;

  let minVal = 0;
  let maxVal = 0;
  let minIdx = 0;
  let maxIdx = 0;
  for (let i = 0; i < n; i++) {
    const v = values[i] ?? 0;
    if (v < minVal) {
      minVal = v;
      minIdx = i;
    }
    if (v > maxVal) {
      maxVal = v;
      maxIdx = i;
    }
  }
  const maxAbs = Math.max(Math.abs(minVal), Math.abs(maxVal));
  const theme = DIAGRAM_THEME[key];

  // All-zero series: return a clean flat centerline stroke without blown-up noise.
  if (maxAbs < ZERO_EPSILON) {
    return {
      key,
      shortLabel: theme.shortLabel,
      unit: theme.unit,
      minVal: 0,
      maxVal: 0,
      maxAbs: 0,
      segments: [],
      zeroLinePath: `M ${projector.endA.x.toFixed(1)},${projector.endA.y.toFixed(1)} L ${projector.endB.x.toFixed(1)},${projector.endB.y.toFixed(1)}`,
      positivePeak: null,
      negativePeak: null,
      lowestScreenY: Math.max(projector.endA.y, projector.endB.y),
    };
  }

  const indices = downsampleDiagramIndices(stations, values, MAX_DIAGRAM_SAMPLES);

  // Expand samples with exact interpolated zero-crossings so no segment ever straddles zero.
  const expanded: SampleTV[] = [];
  for (let i = 0; i < indices.length; i++) {
    const idx = indices[i]!;
    const t = Math.max(0, Math.min(1, (stations[idx] ?? 0) / spanL));
    const v = values[idx] ?? 0;

    if (expanded.length > 0) {
      const prev = expanded[expanded.length - 1]!;
      if ((prev.v > 0 && v < 0) || (prev.v < 0 && v > 0)) {
        const alpha = Math.abs(prev.v) / (Math.abs(prev.v) + Math.abs(v));
        expanded.push({ t: prev.t + alpha * (t - prev.t), v: 0 });
      }
    }
    expanded.push({ t, v });
  }

  const scalePx = projector.peakHeightPx / maxAbs;
  let lowestScreenY = Math.max(projector.endA.y, projector.endB.y);

  // Group consecutive pairs into contiguous positive or negative runs.
  const segments: ProjectedDiagramSegment[] = [];
  let runSign: "positive" | "negative" | null = null;
  let runStartIdx = 0;

  const flushRun = (endIdx: number): void => {
    if (!runSign || endIdx <= runStartIdx) return;

    const firstSample = expanded[runStartIdx]!;
    const lastSample = expanded[endIdx]!;
    const baseStart = projector.project(firstSample.t, 0);
    const baseEnd = projector.project(lastSample.t, 0);
    if (!baseStart || !baseEnd) return;

    const curvePoints: DiagramPoint2D[] = [];
    for (let k = runStartIdx; k <= endIdx; k++) {
      const s = expanded[k]!;
      const p = projector.project(s.t, s.v * scalePx);
      if (p) {
        curvePoints.push(p);
        if (p.y > lowestScreenY) lowestScreenY = p.y;
      }
    }
    if (curvePoints.length < 2) return;

    const strokeParts: string[] = new Array(curvePoints.length);
    for (let k = 0; k < curvePoints.length; k++) {
      const pt = curvePoints[k]!;
      strokeParts[k] = `${k === 0 ? "M" : "L"} ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
    }
    const strokePath = strokeParts.join(" ");

    // Because a 3D straight line projects to a 2D straight line, closing directly from baseEnd -> baseStart is exact.
    const fillParts: string[] = [
      `M ${baseStart.x.toFixed(1)},${baseStart.y.toFixed(1)}`,
      ...curvePoints.map((pt) => `L ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`),
      `L ${baseEnd.x.toFixed(1)},${baseEnd.y.toFixed(1)}`,
      "Z",
    ];

    segments.push({
      sign: runSign,
      strokePath,
      fillPath: fillParts.join(" "),
      points: curvePoints,
    });
  };

  for (let i = 0; i < expanded.length - 1; i++) {
    const a = expanded[i]!;
    const b = expanded[i + 1]!;
    let pairSign: "positive" | "negative" | null = null;
    if (a.v > ZERO_EPSILON || b.v > ZERO_EPSILON) {
      pairSign = "positive";
    } else if (a.v < -ZERO_EPSILON || b.v < -ZERO_EPSILON) {
      pairSign = "negative";
    }

    if (pairSign !== runSign) {
      flushRun(i);
      runSign = pairSign;
      runStartIdx = i;
    }
  }
  flushRun(expanded.length - 1);

  const buildExtrema = (idx: number, val: number): ProjectedDiagramExtrema | null => {
    const stationM = stations[idx] ?? 0;
    const t = Math.max(0, Math.min(1, stationM / spanL));
    const basePoint = projector.project(t, 0);
    const curvePoint = projector.project(t, val * scalePx);
    if (!basePoint || !curvePoint) return null;
    if (curvePoint.y > lowestScreenY) lowestScreenY = curvePoint.y;
    return { value: val, stationM, basePoint, curvePoint };
  };

  const positivePeak = maxVal > ZERO_EPSILON ? buildExtrema(maxIdx, maxVal) : null;
  const negativePeak = minVal < -ZERO_EPSILON ? buildExtrema(minIdx, minVal) : null;

  return {
    key,
    shortLabel: theme.shortLabel,
    unit: theme.unit,
    minVal,
    maxVal,
    maxAbs,
    segments,
    zeroLinePath: `M ${projector.endA.x.toFixed(1)},${projector.endA.y.toFixed(1)} L ${projector.endB.x.toFixed(1)},${projector.endB.y.toFixed(1)}`,
    positivePeak,
    negativePeak,
    lowestScreenY,
  };
}

/**
 * Builds an SVG path string from span station coordinates and value array (used by 2D SingleDiagramCard).
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

  const points: Array<[number, number]> = [];

  for (let i = 0; i < stations.length; i++) {
    const x = ((stations[i] || 0) / L) * widthPx;
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
 * Used by `STACKED_VERTICAL` mode and Floating Window 5.
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
      data-component="SingleDiagramCard"
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
 * Multi-Mode 2D / 3D-Projected Diagram Overlay Component.
 */
export function MultiModeDiagram2DOverlay({
  stationViews,
  displayMode,
  visibility,
  projection,
  spanLengthM,
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
        data-component="MultiModeDiagram2DOverlay"
        data-display-mode="STACKED_VERTICAL"
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

  // Mode 1: In-Place Beam Axis Overlay (true 3D projected SVG along the beam centerline)
  if (displayMode === "IN_PLACE_BEAM_AXIS") {
    const enabledKeys = DIAGRAM_ORDER.filter((key) => visibility[key]);
    if (enabledKeys.length === 0) return null;

    const projector = createBeamDiagramProjector(projection, endAScreen, endBScreen);
    if (!projector) return null;

    const seriesMap: Record<DiagramKey, Float64Array> = {
      bmd: bendingMomentMajorKnm,
      sfd: shearForceKn,
      nfd: normalForceKn,
      tfd: torsionMomentKnm,
    };

    const projectedDiagrams: ProjectedDiagram3D[] = [];
    let lowestContentY = Math.max(projector.endA.y, projector.endB.y);

    for (const key of enabledKeys) {
      const built = buildProjectedDiagram3D(key, stationsM, seriesMap[key], projector, spanLengthM);
      if (built) {
        projectedDiagrams.push(built);
        if (built.lowestScreenY > lowestContentY) {
          lowestContentY = built.lowestScreenY;
        }
      }
    }

    if (projectedDiagrams.length === 0) return null;

    const multiFillOpacity = projectedDiagrams.length > 1 ? 0.65 : 1;
    const pillCenterX = (projector.endA.x + projector.endB.x) * 0.5;
    const rawPillStartY = lowestContentY + 24;
    const totalPillStackHeight = projectedDiagrams.length * PILL_STEP_Y;
    const maxViewportY =
      projection && projection.heightCss > 0
        ? Math.max(40, projection.heightCss - totalPillStackHeight - 12)
        : rawPillStartY;
    const pillStartY = Math.min(rawPillStartY, maxViewportY);

    return (
      <div
        className={className}
        data-component="MultiModeDiagram2DOverlay"
        data-display-mode="IN_PLACE_BEAM_AXIS"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 6,
          pointerEvents: "none",
          overflow: "hidden",
          ...style,
        }}
      >
        <svg
          width="100%"
          height="100%"
          style={{ position: "absolute", inset: 0, overflow: "visible" }}
        >
          {/* Layer 1: 3D-projected dashed centerline baseline along the beam axis */}
          <line
            data-diagram-baseline="true"
            x1={projector.endA.x.toFixed(1)}
            y1={projector.endA.y.toFixed(1)}
            x2={projector.endB.x.toFixed(1)}
            y2={projector.endB.y.toFixed(1)}
            stroke="rgba(148, 163, 184, 0.55)"
            strokeWidth="1.25"
            strokeDasharray="4 4"
          />

          {/* Layer 2: 3D-projected internal force ribbons, strokes, and extrema ticks */}
          {projectedDiagrams.map((diagram) => {
            const theme = DIAGRAM_THEME[diagram.key];
            return (
              <g key={diagram.key} data-diagram-key={diagram.key}>
                {diagram.segments.length > 0 ? (
                  diagram.segments.map((seg, sIdx) => {
                    const isPos = seg.sign === "positive";
                    return (
                      <g key={sIdx} data-diagram-sign={seg.sign}>
                        <path
                          d={seg.fillPath}
                          fill={isPos ? theme.fill : theme.negFill}
                          fillOpacity={multiFillOpacity}
                        />
                        <path
                          d={seg.strokePath}
                          fill="none"
                          stroke={isPos ? theme.stroke : theme.negStroke}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </g>
                    );
                  })
                ) : (
                  <path
                    d={diagram.zeroLinePath}
                    fill="none"
                    stroke={theme.stroke}
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    opacity="0.65"
                  />
                )}

                {diagram.positivePeak ? (
                  <g data-diagram-peak="positive">
                    <line
                      x1={diagram.positivePeak.basePoint.x.toFixed(1)}
                      y1={diagram.positivePeak.basePoint.y.toFixed(1)}
                      x2={diagram.positivePeak.curvePoint.x.toFixed(1)}
                      y2={diagram.positivePeak.curvePoint.y.toFixed(1)}
                      stroke={theme.stroke}
                      strokeWidth="1"
                      strokeDasharray="2 2"
                      opacity="0.7"
                    />
                    <circle
                      cx={diagram.positivePeak.curvePoint.x.toFixed(1)}
                      cy={diagram.positivePeak.curvePoint.y.toFixed(1)}
                      r="3"
                      fill={theme.stroke}
                      stroke="#0F1416"
                      strokeWidth="1"
                    />
                  </g>
                ) : null}

                {diagram.negativePeak ? (
                  <g data-diagram-peak="negative">
                    <line
                      x1={diagram.negativePeak.basePoint.x.toFixed(1)}
                      y1={diagram.negativePeak.basePoint.y.toFixed(1)}
                      x2={diagram.negativePeak.curvePoint.x.toFixed(1)}
                      y2={diagram.negativePeak.curvePoint.y.toFixed(1)}
                      stroke={theme.negStroke}
                      strokeWidth="1"
                      strokeDasharray="2 2"
                      opacity="0.7"
                    />
                    <circle
                      cx={diagram.negativePeak.curvePoint.x.toFixed(1)}
                      cy={diagram.negativePeak.curvePoint.y.toFixed(1)}
                      r="3"
                      fill={theme.negStroke}
                      stroke="#0F1416"
                      strokeWidth="1"
                    />
                  </g>
                ) : null}
              </g>
            );
          })}

          {/* Layer 3: Compact floating SVG peak/legend pills stacked neatly below the beam */}
          {projectedDiagrams.map((diagram, idx) => {
            const theme = DIAGRAM_THEME[diagram.key];
            const pillY = pillStartY + idx * PILL_STEP_Y;
            return (
              <g
                key={`pill-${diagram.key}`}
                data-diagram-pill={diagram.key}
                transform={`translate(${pillCenterX.toFixed(1)}, ${pillY.toFixed(1)})`}
              >
                <rect
                  x={-PILL_HALF_W}
                  y={-PILL_HALF_H}
                  width={PILL_WIDTH}
                  height={PILL_HEIGHT}
                  rx="5"
                  fill="rgba(15, 20, 22, 0.88)"
                  stroke={theme.stroke}
                  strokeOpacity="0.55"
                  strokeWidth="1"
                />
                <circle cx={-PILL_HALF_W + 11} cy="0" r="3.5" fill={theme.stroke} />
                <text
                  x={-PILL_HALF_W + 20}
                  y="3.5"
                  fill={theme.stroke}
                  fontSize="10"
                  fontWeight="700"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                >
                  {diagram.shortLabel}
                </text>
                <text
                  x={-PILL_HALF_W + 52}
                  y="3.5"
                  fontSize="10"
                  fontWeight="600"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                >
                  <tspan fill={theme.stroke}>{`+${diagram.maxVal.toFixed(1)}`}</tspan>
                  <tspan fill="#64748B">{" / "}</tspan>
                  <tspan fill={theme.negStroke}>{`${diagram.minVal.toFixed(1)}`}</tspan>
                  <tspan fill="#94A3B8">{` ${diagram.unit}`}</tspan>
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  // Mode 3 is displayed within Floating Window 5
  return null;
}

export default MultiModeDiagram2DOverlay;
