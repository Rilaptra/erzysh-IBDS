/**
 * @file SupportSymbols2DOverlay.tsx
 * @description Renders crisp 2D vector engineering support symbols (Sendi, Rol, Jepit)
 * locked to the projected screen coordinates of the beam ends A and B.
 * Follows technical specifications from Gambar 3:
 * - Stroke: #94A3B8 (Slate 400, 2.5px)
 * - Fill: Linear gradient #334155 -> #1E293B
 * - Datum: Vertical dashed lines #6D7C90
 * - Fixed: Wall + 6 diagonal 45-degree hatch lines
 * - Pinned: Triangle (base 32px, height 28px)
 * - Roller: Triangle + horizontal bed plate + 2 rolling wheels (radius 4.5px)
 */

"use client";

import React, { type CSSProperties, type ReactElement } from "react";

import type { SupportOrientation } from "@/types/beam-loading-modes";

import type { ScreenProjection } from "./Beam3DExtrudedViewport";

export interface SupportSymbols2DOverlayProps {
  readonly supportOrientation: SupportOrientation;
  readonly endAScreen: ScreenProjection | null;
  readonly endBScreen: ScreenProjection | null;
  readonly className?: string;
  readonly style?: CSSProperties;
}

/**
 * Single 2D Fixed (Jepit) wall support symbol with 6 diagonal hatching lines.
 */
function FixedWallSupportSvg({ isLeft }: { readonly isLeft: boolean }): ReactElement {
  const wallX = isLeft ? 20 : 10;
  const hatchSign = isLeft ? -1 : 1;
  const hatchLength = 12;

  return (
    <svg width="40" height="70" viewBox="0 0 40 70" fill="none" style={{ overflow: "visible" }}>
      {/* Vertical Wall */}
      <line
        x1={wallX}
        y1="5"
        x2={wallX}
        y2="65"
        stroke="#94A3B8"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* 6 Diagonal 45-degree hatch lines */}
      {[10, 20, 30, 40, 50, 60].map((y, idx) => (
        <line
          key={idx}
          x1={wallX}
          y1={y}
          x2={wallX + hatchSign * hatchLength}
          y2={y + hatchLength}
          stroke="#94A3B8"
          strokeWidth="2"
          strokeLinecap="round"
        />
      ))}

      {/* Vertical Dashed Datum Line */}
      <line
        x1={wallX}
        y1="65"
        x2={wallX}
        y2="105"
        stroke="#6D7C90"
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />
    </svg>
  );
}

/**
 * Single 2D Pinned (Sendi) triangle support symbol.
 */
function PinnedSupportSvg(): ReactElement {
  return (
    <svg width="40" height="70" viewBox="0 0 40 70" fill="none" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="pinnedGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="100%" stopColor="#1E293B" />
        </linearGradient>
      </defs>

      {/* Triangle: apex at (20, 0), base at (4, 28) to (36, 28) */}
      <polygon
        points="20,0 4,28 36,28"
        fill="url(#pinnedGrad)"
        stroke="#94A3B8"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* Pin Pivot Circle */}
      <circle cx="20" cy="5" r="2.5" fill="#94A3B8" />

      {/* Foundation Ground Line */}
      <line
        x1="0"
        y1="32"
        x2="40"
        y2="32"
        stroke="#94A3B8"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Vertical Dashed Datum Line */}
      <line
        x1="20"
        y1="32"
        x2="20"
        y2="80"
        stroke="#6D7C90"
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />
    </svg>
  );
}

/**
 * Single 2D Roller (Rol) triangle support with bed plate and 2 rolling wheels.
 */
function RollerSupportSvg(): ReactElement {
  return (
    <svg width="40" height="75" viewBox="0 0 40 75" fill="none" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="rollerGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="100%" stopColor="#1E293B" />
        </linearGradient>
      </defs>

      {/* Triangle apex at (20, 0), base at (4, 28) to (36, 28) */}
      <polygon
        points="20,0 4,28 36,28"
        fill="url(#rollerGrad)"
        stroke="#94A3B8"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* Pin Pivot Circle */}
      <circle cx="20" cy="5" r="2.5" fill="#94A3B8" />

      {/* Bed Plate under triangle base */}
      <line x1="4" y1="31" x2="36" y2="31" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />

      {/* 2 Circular Wheels: radius 4.5px, center Y = 38 */}
      <circle cx="12" cy="38" r="4.5" fill="#334155" stroke="#94A3B8" strokeWidth="2" />
      <circle cx="28" cy="38" r="4.5" fill="#334155" stroke="#94A3B8" strokeWidth="2" />

      {/* Ground Foundation Line */}
      <line
        x1="0"
        y1="45"
        x2="40"
        y2="45"
        stroke="#94A3B8"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Vertical Dashed Datum Line */}
      <line
        x1="20"
        y1="45"
        x2="20"
        y2="85"
        stroke="#6D7C90"
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />
    </svg>
  );
}

/**
 * 2D Support Symbols Overlay component.
 * Maps support boundary conditions onto screen space coordinates.
 */
export function SupportSymbols2DOverlay({
  supportOrientation,
  endAScreen,
  endBScreen,
  className,
  style,
}: SupportSymbols2DOverlayProps): ReactElement {
  // Determine support type at End A (left) and End B (right)
  let supportA: "FIXED_LEFT" | "PINNED" | "ROLLER" | "NONE" = "PINNED";
  let supportB: "FIXED_RIGHT" | "PINNED" | "ROLLER" | "NONE" = "ROLLER";

  switch (supportOrientation) {
    case "CANTILEVER_LEFT":
      supportA = "FIXED_LEFT";
      supportB = "NONE";
      break;
    case "CANTILEVER_RIGHT":
      supportA = "NONE";
      supportB = "FIXED_RIGHT";
      break;
    case "PINNED_ROLLER":
      supportA = "PINNED";
      supportB = "ROLLER";
      break;
    case "ROLLER_PINNED":
      supportA = "ROLLER";
      supportB = "PINNED";
      break;
    case "FIXED_FIXED":
      supportA = "FIXED_LEFT";
      supportB = "FIXED_RIGHT";
      break;
    case "FIXED_ROLLER":
      supportA = "FIXED_LEFT";
      supportB = "ROLLER";
      break;
    case "ROLLER_FIXED":
      supportA = "ROLLER";
      supportB = "FIXED_RIGHT";
      break;
    case "FIXED_PINNED":
      supportA = "FIXED_LEFT";
      supportB = "PINNED";
      break;
    case "PINNED_FIXED":
      supportA = "PINNED";
      supportB = "FIXED_RIGHT";
      break;
  }

  return (
    <div
      className={className}
      data-component="SupportSymbols2DOverlay"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 5,
        ...style,
      }}
    >
      {/* End A Support Symbol */}
      {endAScreen && supportA !== "NONE" ? (
        <div
          style={{
            position: "absolute",
            left: `${endAScreen.x}px`,
            top: `${endAScreen.y}px`,
            transform:
              supportA === "FIXED_LEFT" ? "translate(-20px, -35px)" : "translate(-20px, 0px)",
            pointerEvents: "none",
          }}
        >
          {supportA === "FIXED_LEFT" ? (
            <FixedWallSupportSvg isLeft={true} />
          ) : supportA === "PINNED" ? (
            <PinnedSupportSvg />
          ) : (
            <RollerSupportSvg />
          )}
        </div>
      ) : null}

      {/* End B Support Symbol */}
      {endBScreen && supportB !== "NONE" ? (
        <div
          style={{
            position: "absolute",
            left: `${endBScreen.x}px`,
            top: `${endBScreen.y}px`,
            transform:
              supportB === "FIXED_RIGHT" ? "translate(-10px, -35px)" : "translate(-20px, 0px)",
            pointerEvents: "none",
          }}
        >
          {supportB === "FIXED_RIGHT" ? (
            <FixedWallSupportSvg isLeft={false} />
          ) : supportB === "PINNED" ? (
            <PinnedSupportSvg />
          ) : (
            <RollerSupportSvg />
          )}
        </div>
      ) : null}
    </div>
  );
}

export default SupportSymbols2DOverlay;
