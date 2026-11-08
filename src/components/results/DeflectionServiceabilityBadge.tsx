/**
 * @file DeflectionServiceabilityBadge.tsx
 * @description Deflection serviceability status badge complying with SNI 1729:2020 & SNI 2847:2019:
 * - Checks calculated peak deflection |-Δ_max| against allowable threshold L/denominator
 * - Visual status pill (AMAN / MELEBIHI BATAS) with utilization ratio percentage
 */

"use client";

import { cn } from "cn";
import React, { type CSSProperties, type ReactElement } from "react";

import { Badge } from "@/components/ui/badge";
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
    return (
      <Badge
        variant="outline"
        className={cn("text-muted-foreground text-[11px]", className)}
        style={style}
      >
        Mengevaluasi lendutan...
      </Badge>
    );
  }

  const { isCompliant, absDeflectionMm, allowableLimitMm, deflectionDcr, advisory } = compliance;

  return (
    <Badge
      variant={isCompliant ? "outline" : "destructive"}
      className={cn(
        "inline-flex items-center gap-2 px-2.5 py-1 text-[11px] font-normal transition-colors",
        isCompliant
          ? "border-emerald-500/35 bg-emerald-500/15 text-emerald-400"
          : "border-destructive/35 bg-destructive/15 text-destructive",
        className,
      )}
      style={style}
      data-component="DeflectionServiceabilityBadge"
      title={advisory}
    >
      <span
        className={cn(
          "size-2 shrink-0 rounded-full",
          isCompliant ? "bg-emerald-500" : "bg-destructive",
        )}
      />
      <span className="font-bold">{isCompliant ? "AMAN (OK)" : "MELEBIHI BATAS (NG)"}</span>
      <span className="text-muted-foreground">
        | Δ = {Number(absDeflectionMm).toFixed(2)} mm (Batas: {Number(allowableLimitMm).toFixed(2)}{" "}
        mm)
      </span>
      <span className="font-semibold">({(deflectionDcr * 100).toFixed(1)}%)</span>
    </Badge>
  );
}

export default DeflectionServiceabilityBadge;
