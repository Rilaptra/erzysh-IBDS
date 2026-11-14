// src/components/canvas/SteelProfileCrossSectionSvg.tsx
/**
 * @file SteelProfileCrossSectionSvg.tsx
 * @description Technical 2D SVG drawing of structural steel cross-section:
 * - IWF: Top/bottom flanges, central web, and dimension annotations (H, B, tw, tf)
 * - BOX: Hollow structural tube with outer and inner wall perimeter and annotations (H, B, t)
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
 * 2D Technical drawing of a structural steel cross section (IWF or BOX)
 * with dynamic aspect-ratio scaling and explicit thickness annotations (`tw`, `tf`, `t`).
 *
 * @param props Geometric dimensions and SVG viewport configuration.
 * @returns React element containing the annotated technical SVG drawing.
 * @example
 * <SteelProfileCrossSectionSvg profileType="IWF" depthH={300} widthB={150} webThicknessTw={6.5} flangeThicknessTf={9} />
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
  height = 200,
  className,
  style,
}: SteelProfileCrossSectionSvgProps): ReactElement {
  const padX = 42;
  const padY = 32;
  const maxDrawableW = Math.max(width - padX * 2, 60);
  const maxDrawableH = Math.max(height - padY * 2, 60);

  // Blend relative catalog scale (against 600mm reference) with fit-to-box scale
  // so larger profiles look visibly larger while still fitting inside the viewport.
  const fitScale = Math.min(maxDrawableW / Math.max(widthB, 1), maxDrawableH / Math.max(depthH, 1));
  const referenceScale = Math.min(maxDrawableW, maxDrawableH) / 500;
  const sizeFactor = Math.min(1.0, Math.max(0.58, Math.max(depthH, widthB) / 450));
  const scale = Math.min(fitScale, Math.max(referenceScale, fitScale * sizeFactor));

  const scaledH = Math.max(depthH * scale, 36);
  const scaledB = Math.max(widthB * scale, 28);
  const originX = (width - scaledB) / 2;
  const originY = (height - scaledH) / 2;

  return (
    <div
      className={className}
      data-component="SteelProfileCrossSectionSvg"
      style={{
        display: "block",
        width: "100%",
        maxWidth: width + 18,
        marginInline: "auto",
        boxSizing: "border-box",
        background: "rgba(11, 16, 20, 0.96)",
        border: "1px solid rgba(148, 163, 184, 0.22)",
        borderRadius: 8,
        padding: 8,
        ...style,
      }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: "block", width: "100%", height: "auto" }}
      >
        {profileType === "IWF"
          ? (() => {
              const tf = Math.min(Math.max(flangeThicknessTf * scale, 3.5), scaledH * 0.28);
              const tw = Math.min(Math.max(webThicknessTw * scale, 2.5), scaledB * 0.4);
              const webLeft = originX + (scaledB - tw) / 2;

              return (
                <g>
                  {/* Top Flange */}
                  <rect
                    x={originX}
                    y={originY}
                    width={scaledB}
                    height={tf}
                    fill="#38BDF8"
                    fillOpacity="0.28"
                    stroke="#38BDF8"
                    strokeWidth="1.75"
                  />
                  {/* Web */}
                  <rect
                    x={webLeft}
                    y={originY + tf}
                    width={tw}
                    height={Math.max(scaledH - 2 * tf, 4)}
                    fill="#38BDF8"
                    fillOpacity="0.28"
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
                    fillOpacity="0.28"
                    stroke="#38BDF8"
                    strokeWidth="1.75"
                  />
                  {/* Web Thickness tw Annotation */}
                  <text
                    x={webLeft + tw + 5}
                    y={originY + scaledH / 2 - 5}
                    fill="#38BDF8"
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    tw={webThicknessTw}
                  </text>
                  {/* Flange Thickness tf Annotation */}
                  <text
                    x={originX - 4}
                    y={originY + tf / 2 + 3}
                    textAnchor="end"
                    fill="#7DD3FC"
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    tf={flangeThicknessTf}
                  </text>
                </g>
              );
            })()
          : (() => {
              const t = Math.min(
                Math.max(boxThicknessT * scale, 3.5),
                Math.min(scaledB, scaledH) * 0.28,
              );
              const isCustom = profileName.includes("(Custom)") || filletRadiusR === 0;
              const outerRx = isCustom ? 0 : 4;
              const innerRx = isCustom ? 0 : 2;
              return (
                <g>
                  {/* Outer Box */}
                  <rect
                    x={originX}
                    y={originY}
                    width={scaledB}
                    height={scaledH}
                    rx={outerRx}
                    fill="#38BDF8"
                    fillOpacity="0.24"
                    stroke="#38BDF8"
                    strokeWidth="2"
                  />
                  {/* Inner Hollow Cavity */}
                  <rect
                    x={originX + t}
                    y={originY + t}
                    width={Math.max(scaledB - 2 * t, 4)}
                    height={Math.max(scaledH - 2 * t, 4)}
                    rx={innerRx}
                    fill="#0F1416"
                    stroke="#38BDF8"
                    strokeWidth="1.5"
                  />
                  {/* Wall Thickness t Annotation */}
                  <text
                    x={originX + scaledB / 2}
                    y={originY + scaledH / 2 - 4}
                    textAnchor="middle"
                    fill="#38BDF8"
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    t={boxThicknessT} mm
                  </text>
                </g>
              );
            })()}

        {/* Centerline Axes (X-X and Y-Y) */}
        <line
          x1={originX - 8}
          y1={originY + scaledH / 2}
          x2={originX + scaledB + 8}
          y2={originY + scaledH / 2}
          stroke="#475569"
          strokeWidth="1"
          strokeDasharray="4 3"
        />
        <line
          x1={originX + scaledB / 2}
          y1={originY - 8}
          x2={originX + scaledB / 2}
          y2={originY + scaledH + 8}
          stroke="#475569"
          strokeWidth="1"
          strokeDasharray="4 3"
        />

        {/* Dimension: Flange Width B */}
        <line
          x1={originX}
          y1={originY + scaledH + 12}
          x2={originX + scaledB}
          y2={originY + scaledH + 12}
          stroke="#64748B"
          strokeWidth="1.5"
        />
        <text
          x={originX + scaledB / 2}
          y={originY + scaledH + 23}
          textAnchor="middle"
          fill="#CBD5E1"
          fontSize="9.5"
          fontFamily="monospace"
        >
          B = {widthB} mm
        </text>

        {/* Dimension: Overall Depth H */}
        <line
          x1={originX + scaledB + 10}
          y1={originY}
          x2={originX + scaledB + 10}
          y2={originY + scaledH}
          stroke="#64748B"
          strokeWidth="1.5"
        />
        <text
          x={originX + scaledB + 15}
          y={originY + scaledH / 2}
          dominantBaseline="middle"
          fill="#CBD5E1"
          fontSize="9.5"
          fontFamily="monospace"
        >
          H={depthH}
        </text>
      </svg>

      <div style={{ fontSize: 10, color: "#94A3B8", textAlign: "center", marginTop: 4 }}>
        <strong style={{ color: "#E2E8F0" }}>{profileName}</strong>{" "}
        {profileType === "IWF"
          ? `(H=${depthH}, B=${widthB}, tw=${webThicknessTw}, tf=${flangeThicknessTf}${filletRadiusR ? `, r=${filletRadiusR}` : ""})`
          : `(H=${depthH}, B=${widthB}, t=${boxThicknessT})`}
      </div>
    </div>
  );
}

export default SteelProfileCrossSectionSvg;
