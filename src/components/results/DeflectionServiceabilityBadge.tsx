/**
 * @file DeflectionServiceabilityBadge.tsx
 * @description Deflection serviceability status badge complying with SNI 1729:2020 & SNI 2847:2019:
 * - Checks calculated peak deflection |-Δ_max| against allowable threshold L/denominator
 * - Visual status pill (AMAN / MELEBIHI BATAS) with utilization ratio percentage
 */

"use client";

import React, { type CSSProperties, type ReactElement } from "react";

import type { DeflectionEvaluationResult } from "@/config/deflection-limits-config";

export interface DeflectionServiceabilityBadgeProps {
  readonly compliance: DeflectionEvaluationResult | null;
  readonly className?: string;
  readonly style?: CSSProperties;
}

export function DeflectionServiceabilityBadge({
  compliance,
  className,
  style,
}: DeflectionServiceabilityBadgeProps): ReactElement {
  if (!compliance) {
    return <span style={{ color: "#64748B", fontSize: 11 }}>Mengevaluasi lendutan...</span>;
  }

  const { isCompliant, absDeflectionMm, allowableLimitMm, deflectionDcr, advisory } = compliance;

  return (
    <div
      className={className}
      data-component="DeflectionServiceabilityBadge"
      title={advisory}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 10px",
        borderRadius: 8,
        background: isCompliant ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
        border: `1px solid ${isCompliant ? "rgba(16, 185, 129, 0.35)" : "rgba(239, 68, 68, 0.35)"}`,
        color: isCompliant ? "#34D399" : "#F87171",
        fontSize: 11,
        ...style,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: isCompliant ? "#10B981" : "#EF4444",
        }}
      />
      <span style={{ fontWeight: 700 }}>{isCompliant ? "AMAN (OK)" : "MELEBIHI BATAS (NG)"}</span>
      <span style={{ color: "#94A3B8" }}>
        | Δ = {Number(absDeflectionMm).toFixed(2)} mm (Batas: {Number(allowableLimitMm).toFixed(2)}{" "}
        mm)
      </span>
      <span style={{ fontWeight: 600 }}>({(deflectionDcr * 100).toFixed(1)}%)</span>
    </div>
  );
}

export default DeflectionServiceabilityBadge;
