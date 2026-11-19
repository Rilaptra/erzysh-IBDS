/**
 * @file LoadVisualization2DOverlay.tsx
 * @description Renders 2D vector engineering load symbols (Point Loads P & Distributed Loads q)
 * projected accurately from 3D world space onto the beam's top flange along the active vertical
 * world gravity axis (`Z-Up`, `Y-Up`, or `CustomXYZ`), with automatic badge collision avoidance.
 */

"use client";

import React, { type CSSProperties, type ReactElement } from "react";

import type { DistributedLoad, PointLoad } from "@/types/beam-loading-modes";

import {
  projectWorldToScreen,
  type ScreenProjection,
  type Vec3Tuple,
  type ViewportProjectionSnapshot,
} from "./Beam3DExtrudedViewport";

export interface LoadVisualization2DOverlayProps {
  readonly spanLengthM: number;
  readonly pointLoads: readonly PointLoad[];
  readonly distributedLoads: readonly DistributedLoad[];
  /** Full 3D viewport projection snapshot for perspective-accurate world-to-screen load projection. */
  readonly projection?: ViewportProjectionSnapshot | null;
  readonly endAScreen: ScreenProjection | null;
  readonly endBScreen: ScreenProjection | null;
  readonly visible?: boolean;
  readonly className?: string;
  readonly style?: CSSProperties;
}

export interface Point2D {
  readonly x: number;
  readonly y: number;
}

export interface BadgeRect {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

export interface BeamLoadProjector {
  /** Projects normalized span position `t ∈ [0, 1]` and visual height `offsetPx` along world-up. */
  readonly project: (t: number, offsetPx: number) => Point2D | null;
  /** Baseline clearance above the beam anchor in CSS px. */
  readonly baseOffsetPx: number;
  /** Projected beam span length in CSS px (used for adaptive arrow spacing). */
  readonly spanPixelLength: number;
}

export interface ResolvedDistributedArrow {
  readonly start: Point2D;
  readonly end: Point2D;
  readonly dirX: number;
  readonly dirY: number;
}

export interface ResolvedDistributedLoad {
  readonly id: string;
  readonly magnitude: number;
  readonly p1Base: Point2D;
  readonly p2Base: Point2D;
  readonly p1Top: Point2D;
  readonly p2Top: Point2D;
  readonly arrows: readonly ResolvedDistributedArrow[];
  readonly labelPos: Point2D;
  readonly labelRect: BadgeRect;
}

export interface ResolvedPointLoad {
  readonly id: string;
  readonly magnitude: number;
  readonly start: Point2D;
  readonly end: Point2D;
  readonly dirX: number;
  readonly dirY: number;
  readonly labelPos: Point2D;
  readonly labelRect: BadgeRect;
}

export interface ResolvedLoadLayout {
  readonly distributed: readonly ResolvedDistributedLoad[];
  readonly point: readonly ResolvedPointLoad[];
}

const Q_BADGE_WIDTH = 96;
const Q_BADGE_HALF_W = Q_BADGE_WIDTH / 2;
const P_BADGE_WIDTH = 88;
const P_BADGE_HALF_W = P_BADGE_WIDTH / 2;
const BADGE_HEIGHT = 18;
const BADGE_HALF_H = BADGE_HEIGHT / 2;
const BADGE_GAP_X = 6;
const BADGE_GAP_Y = 4;
const BADGE_STACK_STEP_PX = BADGE_HEIGHT + BADGE_GAP_Y;
const SHAFT_CLEARANCE_PX = 10;

const BASE_GAP_3D_PX = 4;
const BASE_GAP_2D_FALLBACK_PX = 14;
const DIST_BAND_HEIGHT_PX = 40;
const POINT_ARROW_CLEAR_HEIGHT_PX = 62;
const POINT_ARROW_OVERLAP_HEIGHT_PX = 82;
const LABEL_OFFSET_ABOVE_TOP_PX = 14;
const MAX_STAGGER_TIERS = 6;

function buildArrowHeadPolygon(
  tip: Point2D,
  dirX: number,
  dirY: number,
  length = 8,
  halfWidth = 4.5,
): string {
  const baseX = tip.x - dirX * length;
  const baseY = tip.y - dirY * length;
  const perpX = -dirY * halfWidth;
  const perpY = dirX * halfWidth;

  return `${tip.x.toFixed(1)},${tip.y.toFixed(1)} ${(baseX + perpX).toFixed(1)},${(baseY + perpY).toFixed(1)} ${(baseX - perpX).toFixed(1)},${(baseY - perpY).toFixed(1)}`;
}

function makeBadgeRect(center: Point2D, halfWidth: number): BadgeRect {
  return {
    left: center.x - halfWidth,
    right: center.x + halfWidth,
    top: center.y - BADGE_HALF_H,
    bottom: center.y + BADGE_HALF_H,
  };
}

function rectsOverlap(a: BadgeRect, b: BadgeRect): boolean {
  return (
    a.left < b.right + BADGE_GAP_X &&
    a.right + BADGE_GAP_X > b.left &&
    a.top < b.bottom + BADGE_GAP_Y &&
    a.bottom + BADGE_GAP_Y > b.top
  );
}

function resolveUnitDirection(start: Point2D, end: Point2D, fallbackY: number): Point2D {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  if (len > 1e-4) {
    return { x: dx / len, y: dy / len };
  }
  return { x: 0, y: fallbackY };
}

/**
 * Creates a low-allocation projector that maps `(t, heightPx)` to screen CSS pixels.
 * Uses true 3D world-space projection along the beam's top flange and `projection.worldUp`
 * when a 3D snapshot is available; falls back to screen-vertical `(0, -1)` otherwise.
 */
export function createBeamLoadProjector(
  projection: ViewportProjectionSnapshot | null | undefined,
  endAScreen: ScreenProjection | null,
  endBScreen: ScreenProjection | null,
): BeamLoadProjector | null {
  const topA = projection?.beamTopAWorld ?? null;
  const topB = projection?.beamTopBWorld ?? null;

  if (projection && topA && topB && projection.widthCss > 0 && projection.heightCss > 0) {
    const vp = projection.viewProjection;
    const w = projection.widthCss;
    const h = projection.heightCss;
    const up = projection.worldUp;
    const spanDx = topB[0] - topA[0];
    const spanDy = topB[1] - topA[1];
    const spanDz = topB[2] - topA[2];

    const screenA = projectWorldToScreen(vp, topA, w, h);
    const screenB = projectWorldToScreen(vp, topB, w, h);
    if (!screenA || !screenB) return null;

    const spanPixelLength = Math.hypot(screenB.x - screenA.x, screenB.y - screenA.y);
    if (spanPixelLength < 20) return null;

    // Calibrate world-mm per CSS pixel along the projected 3D vertical axis at midspan.
    const midWorld: Vec3Tuple = [
      topA[0] + 0.5 * spanDx,
      topA[1] + 0.5 * spanDy,
      topA[2] + 0.5 * spanDz,
    ];
    const sampleMm = Math.max(projection.worldUnitsPerPixel * 48, 10);
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

    // Clamp minimum vertical scale so extreme near-top-down orbits (~85-89°) stay well-conditioned.
    const minPxPerMmUp = 0.25 / Math.max(projection.worldUnitsPerPixel, 1e-3);
    const useWorldUpProjection = pxPerMmUp > 1e-5;
    const effectivePxPerMmUp = Math.max(pxPerMmUp, minPxPerMmUp);

    // Pre-allocated scratch buffer reused across all projection calls in this render pass.
    const scratchWorld: [number, number, number] = [0, 0, 0];

    const project = (t: number, offsetPx: number): Point2D | null => {
      if (useWorldUpProjection) {
        const worldOffsetMm = offsetPx / effectivePxPerMmUp;
        scratchWorld[0] = topA[0] + t * spanDx + up[0] * worldOffsetMm;
        scratchWorld[1] = topA[1] + t * spanDy + up[1] * worldOffsetMm;
        scratchWorld[2] = topA[2] + t * spanDz + up[2] * worldOffsetMm;
        const p = projectWorldToScreen(vp, scratchWorld, w, h);
        return p ? { x: p.x, y: p.y } : null;
      }

      scratchWorld[0] = topA[0] + t * spanDx;
      scratchWorld[1] = topA[1] + t * spanDy;
      scratchWorld[2] = topA[2] + t * spanDz;
      const base = projectWorldToScreen(vp, scratchWorld, w, h);
      return base ? { x: base.x, y: base.y - offsetPx } : null;
    };

    return {
      project,
      baseOffsetPx: BASE_GAP_3D_PX,
      spanPixelLength,
    };
  }

  // Fallback when only 2D screen endpoints are supplied: use true vertical screen-up (0, -1),
  // never the tilted beam perpendicular normal.
  if (!endAScreen || !endBScreen) return null;
  const dx = endBScreen.x - endAScreen.x;
  const dy = endBScreen.y - endAScreen.y;
  const spanPixelLength = Math.hypot(dx, dy);
  if (spanPixelLength < 20) return null;

  return {
    project: (t: number, offsetPx: number): Point2D => ({
      x: endAScreen.x + t * dx,
      y: endAScreen.y + t * dy - offsetPx,
    }),
    baseOffsetPx: BASE_GAP_2D_FALLBACK_PX,
    spanPixelLength,
  };
}

/**
 * Selects the clearest normalized span coordinate `t ∈ [t1, t2]` for a distributed-load badge
 * so that point-load vertical arrow shafts do not slice through the badge.
 */
function pickClearDistributedLabelT(
  t1: number,
  t2: number,
  labelHeightPx: number,
  pointShaftXs: readonly number[],
  pointTs: readonly number[],
  project: (t: number, offsetPx: number) => Point2D | null,
): number {
  const tMid = (t1 + t2) * 0.5;
  const midPos = project(tMid, labelHeightPx);
  if (!midPos) return tMid;

  const isClearOfShafts = (x: number): boolean => {
    for (let i = 0; i < pointShaftXs.length; i++) {
      if (Math.abs(x - pointShaftXs[i]!) < Q_BADGE_HALF_W + SHAFT_CLEARANCE_PX) {
        return false;
      }
    }
    return true;
  };

  if (isClearOfShafts(midPos.x)) {
    return tMid;
  }

  // Partition [t1, t2] by interior point-load positions and pick the widest clear sub-interval.
  const splits: number[] = [t1];
  for (let i = 0; i < pointTs.length; i++) {
    const tp = pointTs[i]!;
    if (tp > t1 + 1e-4 && tp < t2 - 1e-4) {
      splits.push(tp);
    }
  }
  splits.push(t2);
  splits.sort((a, b) => a - b);

  let bestT = tMid;
  let bestScore = -1;
  for (let i = 0; i < splits.length - 1; i++) {
    const subA = splits[i]!;
    const subB = splits[i + 1]!;
    const width = subB - subA;
    if (width <= 1e-4) continue;
    const candidateT = (subA + subB) * 0.5;
    const candidatePos = project(candidateT, labelHeightPx);
    if (!candidatePos) continue;
    let minShaftDist = Number.POSITIVE_INFINITY;
    for (let j = 0; j < pointShaftXs.length; j++) {
      const d = Math.abs(candidatePos.x - pointShaftXs[j]!);
      if (d < minShaftDist) minShaftDist = d;
    }
    // Strongly prefer candidates completely clear of shafts, then widest sub-interval.
    const clearBonus = minShaftDist >= Q_BADGE_HALF_W + SHAFT_CLEARANCE_PX ? 10_000 : 0;
    const score = clearBonus + minShaftDist + width * 50;
    if (score > bestScore) {
      bestScore = score;
      bestT = candidateT;
    }
  }

  return bestT;
}

/**
 * Computes all 2D vector load geometry and collision-free badge placements.
 */
export function computeLoadLayout(
  spanLengthM: number,
  pointLoads: readonly PointLoad[],
  distributedLoads: readonly DistributedLoad[],
  projector: BeamLoadProjector,
): ResolvedLoadLayout {
  const { project, baseOffsetPx, spanPixelLength } = projector;
  const distTopOffset = baseOffsetPx + DIST_BAND_HEIGHT_PX;
  const distLabelOffset = distTopOffset + LABEL_OFFSET_ABOVE_TOP_PX;

  // Precompute normalized spans for overlap checks.
  const distRanges: Array<{ readonly t1: number; readonly t2: number }> = [];
  for (let i = 0; i < distributedLoads.length; i++) {
    const dl = distributedLoads[i]!;
    const t1 = Math.max(0, Math.min(1, Number(dl.startPosition) / spanLengthM));
    const t2 = Math.max(0, Math.min(1, Number(dl.endPosition) / spanLengthM));
    if (t2 > t1) {
      distRanges.push({ t1, t2 });
    }
  }

  const pointTs: number[] = [];
  const pointShaftXs: number[] = [];
  for (let i = 0; i < pointLoads.length; i++) {
    const t = Math.max(0, Math.min(1, Number(pointLoads[i]!.position) / spanLengthM));
    pointTs.push(t);
    const shaftAtLabelHeight = project(t, distLabelOffset);
    if (shaftAtLabelHeight) {
      pointShaftXs.push(shaftAtLabelHeight.x);
    }
  }

  const placedRects: BadgeRect[] = [];
  const resolvedDistributed: ResolvedDistributedLoad[] = [];

  for (let idx = 0; idx < distributedLoads.length; idx++) {
    const dl = distributedLoads[idx]!;
    const t1 = Math.max(0, Math.min(1, Number(dl.startPosition) / spanLengthM));
    const t2 = Math.max(0, Math.min(1, Number(dl.endPosition) / spanLengthM));
    if (t2 <= t1) continue;

    const p1Base = project(t1, baseOffsetPx);
    const p2Base = project(t2, baseOffsetPx);
    const p1Top = project(t1, distTopOffset);
    const p2Top = project(t2, distTopOffset);
    if (!p1Base || !p2Base || !p1Top || !p2Top) continue;

    const mag = Number(dl.magnitude);
    const isDownward = mag >= 0;
    const segPx = (t2 - t1) * spanPixelLength;
    const arrowCount = Math.max(3, Math.min(16, Math.round(segPx / 32) + 1));

    const arrows: ResolvedDistributedArrow[] = [];
    for (let aIdx = 0; aIdx < arrowCount; aIdx++) {
      const t = t1 + (aIdx / (arrowCount - 1)) * (t2 - t1);
      const start = project(t, isDownward ? distTopOffset : baseOffsetPx);
      const end = project(t, isDownward ? baseOffsetPx : distTopOffset);
      if (!start || !end) continue;
      const dir = resolveUnitDirection(start, end, isDownward ? 1 : -1);
      arrows.push({ start, end, dirX: dir.x, dirY: dir.y });
    }

    const tLabel = pickClearDistributedLabelT(
      t1,
      t2,
      distLabelOffset,
      pointShaftXs,
      pointTs,
      project,
    );
    let labelPos = project(tLabel, distLabelOffset) ?? {
      x: (p1Top.x + p2Top.x) * 0.5,
      y: (p1Top.y + p2Top.y) * 0.5 - LABEL_OFFSET_ABOVE_TOP_PX,
    };

    // If a narrow Q band still lands on a P shaft, nudge horizontally clear of the nearest shaft.
    for (let i = 0; i < pointShaftXs.length; i++) {
      const sx = pointShaftXs[i]!;
      const dx = labelPos.x - sx;
      if (Math.abs(dx) < Q_BADGE_HALF_W + SHAFT_CLEARANCE_PX) {
        const pushSign = dx >= 0 ? 1 : -1;
        labelPos = {
          x: sx + pushSign * (Q_BADGE_HALF_W + SHAFT_CLEARANCE_PX),
          y: labelPos.y,
        };
      }
    }

    // Resolve badge-to-badge overlap vertically upward.
    let labelRect = makeBadgeRect(labelPos, Q_BADGE_HALF_W);
    for (let tier = 0; tier < MAX_STAGGER_TIERS; tier++) {
      const collides = placedRects.some((r) => rectsOverlap(labelRect, r));
      if (!collides) break;
      labelPos = { x: labelPos.x, y: labelPos.y - BADGE_STACK_STEP_PX };
      labelRect = makeBadgeRect(labelPos, Q_BADGE_HALF_W);
    }

    placedRects.push(labelRect);
    resolvedDistributed.push({
      id: dl.id || `q${idx + 1}`,
      magnitude: mag,
      p1Base,
      p2Base,
      p1Top,
      p2Top,
      arrows,
      labelPos,
      labelRect,
    });
  }

  const resolvedPoint: ResolvedPointLoad[] = [];
  for (let idx = 0; idx < pointLoads.length; idx++) {
    const pl = pointLoads[idx]!;
    const t = Math.max(0, Math.min(1, Number(pl.position) / spanLengthM));
    const mag = Number(pl.magnitude);
    const isDownward = mag >= 0;

    const overlapsAnyQ = distRanges.some((r) => t >= r.t1 - 1e-4 && t <= r.t2 + 1e-4);
    let tailOffset =
      baseOffsetPx + (overlapsAnyQ ? POINT_ARROW_OVERLAP_HEIGHT_PX : POINT_ARROW_CLEAR_HEIGHT_PX);

    let labelPos = project(t, tailOffset + LABEL_OFFSET_ABOVE_TOP_PX);
    if (!labelPos) continue;
    let labelRect = makeBadgeRect(labelPos, P_BADGE_HALF_W);

    // Stagger upward (extending arrow tail together with its badge) if overlapping any prior badge.
    for (let tier = 0; tier < MAX_STAGGER_TIERS; tier++) {
      const collides = placedRects.some((r) => rectsOverlap(labelRect, r));
      if (!collides) break;
      tailOffset += BADGE_STACK_STEP_PX;
      const lifted = project(t, tailOffset + LABEL_OFFSET_ABOVE_TOP_PX);
      if (!lifted) break;
      labelPos = lifted;
      labelRect = makeBadgeRect(labelPos, P_BADGE_HALF_W);
    }

    const beamTip = project(t, baseOffsetPx);
    const tail = project(t, tailOffset);
    if (!beamTip || !tail) continue;

    const start = isDownward ? tail : beamTip;
    const end = isDownward ? beamTip : tail;
    const dir = resolveUnitDirection(start, end, isDownward ? 1 : -1);

    placedRects.push(labelRect);
    resolvedPoint.push({
      id: pl.id || `P${idx + 1}`,
      magnitude: mag,
      start,
      end,
      dirX: dir.x,
      dirY: dir.y,
      labelPos,
      labelRect,
    });
  }

  return {
    distributed: resolvedDistributed,
    point: resolvedPoint,
  };
}

/**
 * 2D Load Visualization Overlay component.
 * Renders distributed load bands (q) and point load arrows (P) aligned with the 3D world gravity axis.
 */
export function LoadVisualization2DOverlay({
  spanLengthM,
  pointLoads,
  distributedLoads,
  projection,
  endAScreen,
  endBScreen,
  visible = true,
  className,
  style,
}: LoadVisualization2DOverlayProps): ReactElement | null {
  if (!visible || spanLengthM <= 0) {
    return null;
  }

  if (pointLoads.length === 0 && distributedLoads.length === 0) {
    return null;
  }

  const projector = createBeamLoadProjector(projection, endAScreen, endBScreen);
  if (!projector) {
    return null;
  }

  const layout = computeLoadLayout(spanLengthM, pointLoads, distributedLoads, projector);

  return (
    <div
      className={className}
      data-component="LoadVisualization2DOverlay"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 5,
        overflow: "hidden",
        ...style,
      }}
    >
      <svg
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0, overflow: "visible" }}
      >
        {/* Layer 1: Distributed load bands & arrows (Q) */}
        {layout.distributed.map((dl) => (
          <g key={`dist-geom-${dl.id}`}>
            <polygon
              points={`${dl.p1Base.x.toFixed(1)},${dl.p1Base.y.toFixed(1)} ${dl.p1Top.x.toFixed(1)},${dl.p1Top.y.toFixed(1)} ${dl.p2Top.x.toFixed(1)},${dl.p2Top.y.toFixed(1)} ${dl.p2Base.x.toFixed(1)},${dl.p2Base.y.toFixed(1)}`}
              fill="rgba(245, 158, 11, 0.14)"
              stroke="rgba(245, 158, 11, 0.35)"
              strokeWidth="1"
            />

            <line
              x1={dl.p1Top.x}
              y1={dl.p1Top.y}
              x2={dl.p2Top.x}
              y2={dl.p2Top.y}
              stroke="#F59E0B"
              strokeWidth="2"
              strokeLinecap="round"
            />

            {dl.arrows.map((arrow, aIdx) => (
              <g key={aIdx}>
                <line
                  x1={arrow.start.x}
                  y1={arrow.start.y}
                  x2={arrow.end.x - arrow.dirX * 5}
                  y2={arrow.end.y - arrow.dirY * 5}
                  stroke="#F59E0B"
                  strokeWidth="1.6"
                />
                <polygon
                  points={buildArrowHeadPolygon(arrow.end, arrow.dirX, arrow.dirY, 7, 3.5)}
                  fill="#F59E0B"
                />
              </g>
            ))}
          </g>
        ))}

        {/* Layer 2: Point load arrows (P) */}
        {layout.point.map((pl) => (
          <g key={`point-geom-${pl.id}`}>
            <line
              x1={pl.start.x}
              y1={pl.start.y}
              x2={pl.end.x - pl.dirX * 7}
              y2={pl.end.y - pl.dirY * 7}
              stroke="#F43F5E"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <polygon
              points={buildArrowHeadPolygon(pl.end, pl.dirX, pl.dirY, 10, 5)}
              fill="#F43F5E"
            />
          </g>
        ))}

        {/* Layer 3: Badges (rendered above all shafts for crisp legibility) */}
        {layout.distributed.map((dl) => (
          <g
            key={`dist-label-${dl.id}`}
            transform={`translate(${dl.labelPos.x.toFixed(1)}, ${dl.labelPos.y.toFixed(1)})`}
          >
            <rect
              x={-Q_BADGE_HALF_W}
              y={-BADGE_HALF_H}
              width={Q_BADGE_WIDTH}
              height={BADGE_HEIGHT}
              rx="4"
              fill="rgba(15, 20, 22, 0.90)"
              stroke="rgba(245, 158, 11, 0.55)"
              strokeWidth="1"
            />
            <text
              x="0"
              y="3.5"
              textAnchor="middle"
              fill="#FCD34D"
              fontSize="10"
              fontWeight="700"
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            >
              {`${dl.id}: ${dl.magnitude.toFixed(1)} kN/m`}
            </text>
          </g>
        ))}

        {layout.point.map((pl) => (
          <g
            key={`point-label-${pl.id}`}
            transform={`translate(${pl.labelPos.x.toFixed(1)}, ${pl.labelPos.y.toFixed(1)})`}
          >
            <rect
              x={-P_BADGE_HALF_W}
              y={-BADGE_HALF_H}
              width={P_BADGE_WIDTH}
              height={BADGE_HEIGHT}
              rx="4"
              fill="rgba(15, 20, 22, 0.92)"
              stroke="rgba(244, 63, 94, 0.65)"
              strokeWidth="1"
            />
            <text
              x="0"
              y="3.5"
              textAnchor="middle"
              fill="#FDA4AF"
              fontSize="10"
              fontWeight="700"
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            >
              {`${pl.id}: ${pl.magnitude.toFixed(1)} kN`}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export default LoadVisualization2DOverlay;
