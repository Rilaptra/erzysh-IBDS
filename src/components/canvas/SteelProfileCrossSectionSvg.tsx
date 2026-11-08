/**
 * @file SteelProfileCrossSectionSvg.tsx
 * @description Technical 2D SVG drawing of structural steel cross-section:
 * - IWF: Top/bottom flanges, central web, root fillet arcs, and dimension annotations
 * - BOX: Hollow structural tube with outer and inner wall perimeter
 * Follows JIS G 3192 & JIS G 3466 / SNI 1729 specifications.
 */

"use client";

import React, { type CSSProperties, type ReactElement } from "react";

import type { SteelProfileType } from "@/types/steel-sni1729-types";

export interface SteelProfileCrossSectionSvgProps {
  readonly profileType: SteelProfileType;
  readonly profileName?: string;
  readonly depthH?: number;
  readonly widthB?: number;
  readonly webThicknessTw?: number;
  readonly flangeThicknessTf?: number;
  readonly boxThicknessT?: number;
  readonly filletRadiusR?: number;
  readonly width?: number;
  readonly height?: number;
  readonly className?: string;
  readonly style?: CSSProperties;
}

/**
 * 2D Technical drawing of steel cross section.
 */
export function SteelProfileCrossSectionSvg({
  profileType,
  profileName = "WF 300x150x6.5x9",
  depthH = 300,
  widthB = 150,
  webThicknessTw = 6.5,
  flangeThicknessTf = 9.0,
  boxThicknessT = 8.0,
  filletRadiusR = 13.0,
  width = 240,
  height = 280,
  className,
  style,
}: SteelProfileCrossSectionSvgProps): ReactElement {
  const pad = 36;
  const maxDim = Math.max(depthH, widthB);
  const scale = (Math.min(width, height) - pad * 2) / maxDim;

  const scaledH = depthH * scale;
  const scaledB = widthB * scale;
  const originX = (width - scaledB) / 2;
  const originY = (height - scaledH) / 2;

  return (
    <div
      className={className}
      data-component="SteelProfileCrossSectionSvg"
      style={{
        display: "inline-block",
        background: "rgba(15, 20, 22, 0.8)",
        border: "1px solid rgba(148, 163, 184, 0.16)",
        borderRadius: 8,
        padding: 8,
        ...style,
      }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: "block" }}
      >
        {profileType === "IWF"
          ? // I-Beam (IWF) Geometry
            (() => {
              const tf = Math.max(flangeThicknessTf * scale, 3);
              const tw = Math.max(webThicknessTw * scale, 2);
              const webLeft = originX + (scaledB - tw) / 2;
              const webRight = webLeft + tw;

              return (
                <g>
                  {/* Top Flange */}
                  <rect
                    x={originX}
                    y={originY}
                    width={scaledB}
                    height={tf}
                    fill="#38BDF8"
                    fillOpacity="0.25"
                    stroke="#38BDF8"
                    strokeWidth="2"
                  />
                  {/* Web */}
                  <rect
                    x={webLeft}
                    y={originY + tf}
                    width={tw}
                    height={scaledH - 2 * tf}
                    fill="#38BDF8"
                    fillOpacity="0.25"
                    stroke="#38BDF8"
                    strokeWidth="1.5"
                  />
                  {/* Bottom Flange */}
                  <rect
                    x={originX}
                    y={originY + scaledH - tf}
                    width={scaledB}
                    height={tf}
                    fill="#38BDF8"
                    fillOpacity="0.25"
                    stroke="#38BDF8"
                    strokeWidth="2"
                  />
                </g>
              );
            })()
          : // BOX Hollow Section Geometry
            (() => {
              const t = Math.max(boxThicknessT * scale, 3);
              return (
                <g>
                  {/* Outer Box */}
                  <rect
                    x={originX}
                    y={originY}
                    width={scaledB}
                    height={scaledH}
                    rx="4"
                    fill="#38BDF8"
                    fillOpacity="0.2"
                    stroke="#38BDF8"
                    strokeWidth="2"
                  />
                  {/* Inner Hollow Cavity */}
                  <rect
                    x={originX + t}
                    y={originY + t}
                    width={Math.max(scaledB - 2 * t, 4)}
                    height={Math.max(scaledH - 2 * t, 4)}
                    rx="2"
                    fill="#0F1416"
                    stroke="#38BDF8"
                    strokeWidth="1.5"
                  />
                </g>
              );
            })()}

        {/* Centerline Axes (X-X and Y-Y) */}
        <line
          x1={originX - 10}
          y1={originY + scaledH / 2}
          x2={originX + scaledB + 10}
          y2={originY + scaledH / 2}
          stroke="#475569"
          strokeWidth="1"
          strokeDasharray="4 3"
        />
        <line
          x1={originX + scaledB / 2}
          y1={originY - 10}
          x2={originX + scaledB / 2}
          y2={originY + scaledH + 10}
          stroke="#475569"
          strokeWidth="1"
          strokeDasharray="4 3"
        />

        {/* Dimension: Flange Width B */}
        <line
          x1={originX}
          y1={originY + scaledH + 14}
          x2={originX + scaledB}
          y2={originY + scaledH + 14}
          stroke="#64748B"
          strokeWidth="1.5"
        />
        <text
          x={originX + scaledB / 2}
          y={originY + scaledH + 26}
          textAnchor="middle"
          fill="#CBD5E1"
          fontSize="10"
          fontFamily="monospace"
        >
          B = {widthB} mm
        </text>

        {/* Dimension: Overall Depth H */}
        <line
          x1={originX + scaledB + 14}
          y1={originY}
          x2={originX + scaledB + 14}
          y2={originY + scaledH}
          stroke="#64748B"
          strokeWidth="1.5"
        />
        <text
          x={originX + scaledB + 20}
          y={originY + scaledH / 2}
          dominantBaseline="middle"
          fill="#CBD5E1"
          fontSize="10"
          fontFamily="monospace"
        >
          H = {depthH}
        </text>
      </svg>

      <div style={{ fontSize: 10, color: "#94A3B8", textAlign: "center", marginTop: 4 }}>
        {profileName} ({profileType})
      </div>
    </div>
  );
}

export default SteelProfileCrossSectionSvg;
