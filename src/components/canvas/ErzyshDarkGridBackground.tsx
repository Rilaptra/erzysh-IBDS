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
        width: "100%",
        height: "100%",
        backgroundColor: "#0A0A0A",
        overflow: "hidden",
        ...style,
      }}
    >
      {/* 40px x 40px Orthogonal Grid with Radial Vignette */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(to right, #1F2020 1px, transparent 1px),
            linear-gradient(to bottom, #1F2020 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
          maskImage: "radial-gradient(circle at 50% 50%, black 50%, transparent 95%)",
          WebkitMaskImage: "radial-gradient(circle at 50% 50%, black 50%, transparent 95%)",
          opacity: 0.85,
          pointerEvents: "none",
        }}
      />

      {/* Teal/Cyan Soft Ambient Glow behind the beam */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 48%, rgba(6, 182, 212, 0.08) 0%, rgba(10, 14, 14, 0.02) 45%, transparent 75%)",
          pointerEvents: "none",
        }}
      />

      {children}
    </div>
  );
}

export default ErzyshDarkGridBackground;
