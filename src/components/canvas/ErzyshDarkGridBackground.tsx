/**
 * @file ErzyshDarkGridBackground.tsx
 * @description Master CAD/CAE background canvas styling implementing the Erzysh Dark Void Theme:
 * - Base color #0A0A0A (rgb(10, 10, 10))
 * - Orthogonal 40px x 40px grid lines #1F2020 with soft radial vignette mask
 * - Ambient radial glow (Teal/Cyan) behind the 3D beam stage
 */

import React, { type CSSProperties, type ReactElement } from "react";

export interface ErzyshDarkGridBackgroundProps {
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly children?: React.ReactNode;
}

/**
 * Background layer for the hybrid 3D/2D engineering canvas.
 * @param props {@link ErzyshDarkGridBackgroundProps}
 * @returns ReactElement
 */
export function ErzyshDarkGridBackground({
  className,
  style,
  children,
}: ErzyshDarkGridBackgroundProps): ReactElement {
  return (
    <div
      className={className}
      data-component="ErzyshDarkGridBackground"
      style={{
        position: "relative",
        isolation: "isolate",
        width: "100%",
        height: "100%",
        backgroundColor: "#0A0A0A",
        overflow: "hidden",
        ...style,
      }}
    >
      {/* 40px x 40px Orthogonal Grid with Stationary Radial Vignette + Subtle Idle Drift */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: -1,
          maskImage: "radial-gradient(circle at 50% 50%, black 50%, transparent 95%)",
          WebkitMaskImage: "radial-gradient(circle at 50% 50%, black 50%, transparent 95%)",
          opacity: 0.85,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        <div
          className="erzysh-sim-grid-drift"
          style={{
            position: "absolute",
            inset: "-40px",
            backgroundImage: `
              linear-gradient(to right, #1F2020 1px, transparent 1px),
              linear-gradient(to bottom, #1F2020 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      {/* Teal/Cyan Soft Ambient Glow behind the beam (subtle idle breathing) */}
      <div
        aria-hidden="true"
        className="erzysh-ambient-breath"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: -1,
          background:
            "radial-gradient(circle at 50% 48%, rgba(6, 182, 212, 0.09) 0%, rgba(10, 14, 14, 0.02) 45%, transparent 75%)",
          pointerEvents: "none",
        }}
      />

      {/* Whisper-quiet horizontal HUD telemetry sweep */}
      <div
        aria-hidden="true"
        className="erzysh-hud-sweep"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: "1px",
          zIndex: -1,
          background:
            "linear-gradient(90deg, transparent 5%, rgba(34, 211, 238, 0.35) 50%, transparent 95%)",
          pointerEvents: "none",
        }}
      />

      {/* Subtle CAD corner reticle hairlines */}
      <div
        aria-hidden="true"
        className="erzysh-badge-beacon"
        style={{
          position: "absolute",
          top: "12px",
          left: "12px",
          width: "12px",
          height: "12px",
          zIndex: -1,
          borderTop: "1px solid rgba(34, 211, 238, 0.28)",
          borderLeft: "1px solid rgba(34, 211, 238, 0.28)",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden="true"
        className="erzysh-badge-beacon"
        style={{
          position: "absolute",
          bottom: "12px",
          right: "12px",
          width: "12px",
          height: "12px",
          zIndex: -1,
          borderBottom: "1px solid rgba(34, 211, 238, 0.28)",
          borderRight: "1px solid rgba(34, 211, 238, 0.28)",
          animationDelay: "1.6s",
          pointerEvents: "none",
        }}
      />

      {children}
    </div>
  );
}

export default ErzyshDarkGridBackground;
