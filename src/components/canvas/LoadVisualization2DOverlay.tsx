/**
 * @file LoadVisualization2DOverlay.tsx
 * @description Renders 2D vector engineering load symbols (Point Loads P & Distributed Loads q)
 * locked to the projected screen coordinates of the 3D beam ends A and B.
 */

"use client";

import React, { type CSSProperties, type ReactElement } from "react";

import type { DistributedLoad, PointLoad } from "@/types/beam-loading-modes";

import type { ScreenProjection } from "./Beam3DExtrudedViewport";

export interface LoadVisualization2DOverlayProps {
  readonly spanLengthM: number;
  readonly pointLoads: readonly PointLoad[];
  readonly distributedLoads: readonly DistributedLoad[];
  readonly endAScreen: ScreenProjection | null;
  readonly endBScreen: ScreenProjection | null;
  readonly visible?: boolean;
  readonly className?: string;
  readonly style?: CSSProperties;
}

interface Point2D {
  readonly x: number;
  readonly y: number;
}

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

/**
 * 2D Load Visualization Overlay component.
 * Renders distributed load bands (q) and point load arrows (P) above the projected beam.
 */
export function LoadVisualization2DOverlay({
  spanLengthM,
  pointLoads,
  distributedLoads,
  endAScreen,
  endBScreen,
  visible = true,
  className,
  style,
}: LoadVisualization2DOverlayProps): ReactElement | null {
  if (!visible || !endAScreen || !endBScreen || spanLengthM <= 0) {
    return null;
  }

  if (pointLoads.length === 0 && distributedLoads.length === 0) {
    return null;
  }

  const ax = endAScreen.x;
  const ay = endAScreen.y;
  const bx = endBScreen.x;
  const by = endBScreen.y;
  const dx = bx - ax;
  const dy = by - ay;
  const pixelLen = Math.hypot(dx, dy);

  if (pixelLen < 20) {
    return null;
  }

  // Unit vector along beam & upward normal in screen space (ny <= 0)
  const ux = dx / pixelLen;
  const uy = dy / pixelLen;
  let nx = -uy;
  let ny = ux;
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }

  const pointAlongBeam = (t: number, normalOffset: number): Point2D => ({
    x: ax + t * dx + nx * normalOffset,
    y: ay + t * dy + ny * normalOffset,
  });

  const baseOffset = 14;
  const distTopOffset = 48;
  const pointTailOffset = 74;

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
        {/* 1. Beban Merata (Distributed Loads) */}
        {distributedLoads.map((dl, idx) => {
          const t1 = Math.max(0, Math.min(1, Number(dl.startPosition) / spanLengthM));
          const t2 = Math.max(0, Math.min(1, Number(dl.endPosition) / spanLengthM));
          if (t2 <= t1) return null;

          const mag = Number(dl.magnitude);
          const isDownward = mag >= 0;
          const p1Base = pointAlongBeam(t1, baseOffset);
          const p2Base = pointAlongBeam(t2, baseOffset);
          const p1Top = pointAlongBeam(t1, distTopOffset);
          const p2Top = pointAlongBeam(t2, distTopOffset);
          const midTop = pointAlongBeam((t1 + t2) / 2, distTopOffset + 14);

          const segPx = (t2 - t1) * pixelLen;
          const arrowCount = Math.max(3, Math.min(16, Math.round(segPx / 32) + 1));
          const arrowDirX = isDownward ? -nx : nx;
          const arrowDirY = isDownward ? -ny : ny;

          return (
            <g key={dl.id || `dist-${idx}`}>
              {/* Shaded distributed load area */}
              <polygon
                points={`${p1Base.x.toFixed(1)},${p1Base.y.toFixed(1)} ${p1Top.x.toFixed(1)},${p1Top.y.toFixed(1)} ${p2Top.x.toFixed(1)},${p2Top.y.toFixed(1)} ${p2Base.x.toFixed(1)},${p2Base.y.toFixed(1)}`}
                fill="rgba(245, 158, 11, 0.14)"
                stroke="rgba(245, 158, 11, 0.35)"
                strokeWidth="1"
              />

              {/* Top horizontal bar */}
              <line
                x1={p1Top.x}
                y1={p1Top.y}
                x2={p2Top.x}
                y2={p2Top.y}
                stroke="#F59E0B"
                strokeWidth="2"
                strokeLinecap="round"
              />

              {/* Evenly spaced load arrows */}
              {Array.from({ length: arrowCount }).map((_, aIdx) => {
                const t = t1 + (aIdx / (arrowCount - 1)) * (t2 - t1);
                const start = pointAlongBeam(t, isDownward ? distTopOffset : baseOffset);
                const end = pointAlongBeam(t, isDownward ? baseOffset : distTopOffset);
                return (
                  <g key={aIdx}>
                    <line
                      x1={start.x}
                      y1={start.y}
                      x2={end.x - arrowDirX * 5}
                      y2={end.y - arrowDirY * 5}
                      stroke="#F59E0B"
                      strokeWidth="1.6"
                    />
                    <polygon
                      points={buildArrowHeadPolygon(end, arrowDirX, arrowDirY, 7, 3.5)}
                      fill="#F59E0B"
                    />
                  </g>
                );
              })}

              {/* Distributed load label */}
              <g transform={`translate(${midTop.x.toFixed(1)}, ${midTop.y.toFixed(1)})`}>
                <rect
                  x="-46"
                  y="-10"
                  width="92"
                  height="18"
                  rx="4"
                  fill="rgba(15, 20, 22, 0.88)"
                  stroke="rgba(245, 158, 11, 0.55)"
                  strokeWidth="1"
                />
                <text
                  x="0"
                  y="3"
                  textAnchor="middle"
                  fill="#FCD34D"
                  fontSize="10"
                  fontWeight="700"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                >
                  {`${dl.id || "q"}: ${mag.toFixed(1)} kN/m`}
                </text>
              </g>
            </g>
          );
        })}

        {/* 2. Beban Terpusat (Point Loads) */}
        {pointLoads.map((pl, idx) => {
          const t = Math.max(0, Math.min(1, Number(pl.position) / spanLengthM));
          const mag = Number(pl.magnitude);
          const isDownward = mag >= 0;

          const beamTip = pointAlongBeam(t, baseOffset);
          const tail = pointAlongBeam(t, pointTailOffset);
          const start = isDownward ? tail : beamTip;
          const end = isDownward ? beamTip : tail;
          const dirX = isDownward ? -nx : nx;
          const dirY = isDownward ? -ny : ny;
          const labelPos = pointAlongBeam(t, pointTailOffset + 14);

          return (
            <g key={pl.id || `point-${idx}`}>
              {/* Arrow shaft */}
              <line
                x1={start.x}
                y1={start.y}
                x2={end.x - dirX * 7}
                y2={end.y - dirY * 7}
                stroke="#F43F5E"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              {/* Arrow head */}
              <polygon points={buildArrowHeadPolygon(end, dirX, dirY, 10, 5)} fill="#F43F5E" />

              {/* Point load label pill */}
              <g transform={`translate(${labelPos.x.toFixed(1)}, ${labelPos.y.toFixed(1)})`}>
                <rect
                  x="-42"
                  y="-10"
                  width="84"
                  height="18"
                  rx="4"
                  fill="rgba(15, 20, 22, 0.92)"
                  stroke="rgba(244, 63, 94, 0.65)"
                  strokeWidth="1"
                />
                <text
                  x="0"
                  y="3"
                  textAnchor="middle"
                  fill="#FDA4AF"
                  fontSize="10"
                  fontWeight="700"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                >
                  {`${pl.id || "P"}: ${mag.toFixed(1)} kN`}
                </text>
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default LoadVisualization2DOverlay;
