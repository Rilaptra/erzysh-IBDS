/**
 * @file DeflectionHudAndColorbar.tsx
 * @description Master HUD displaying:
 * 1. Right Edge: Vertical Deflection Colorbar Legend (0.00 mm -> -Δ_max mm) using SAP2000 gradient colors.
 * 2. Bottom-Left: Maximum Deflection Card (-Δ_max mm, station x, allowable limit L/limit, and AMAN/NG badge).
 */

"use client";

import { cn } from "cn";
import React, { type CSSProperties, type ReactElement } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { DeflectionEvaluationResult } from "@/config/deflection-limits-config";

export interface DeflectionHudAndColorbarProps {
  /** Maximum downward deflection in mm (negative sign). */
  readonly maxDeflectionMm: number;
  /** Span station where maximum deflection occurs (meters). */
  readonly maxDeflectionStationM: number;
  /** Serviceability deflection evaluation compliance. */
  readonly compliance: DeflectionEvaluationResult | null;
  /** Selected deflection limit denominator (e.g. 360 for L/360). */
  readonly limitDenominator: number;
  readonly className?: string;
  readonly style?: CSSProperties;
}

/**
 * Deflection HUD and Colorbar Legend component.
 */
export function DeflectionHudAndColorbar({
  maxDeflectionMm,
  maxDeflectionStationM,
  compliance,
  limitDenominator,
  className,
  style,
}: DeflectionHudAndColorbarProps): ReactElement {
  const peakMagnitude = Math.abs(maxDeflectionMm);
  const isSatisfied = compliance?.isCompliant ?? true;

  return (
    <div
      className={cn("pointer-events-none absolute inset-0 z-10", className)}
      data-component="DeflectionHudAndColorbar"
      style={style}
    >
      {/* 1. RIGHT EDGE: Vertical Colorbar Legend */}
      <Card
        size="sm"
        className="border-border/40 bg-card/85 pointer-events-auto absolute top-1/2 right-5 -translate-y-1/2 flex-col items-center gap-2 p-3 shadow-lg backdrop-blur-md"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <span className="text-muted-foreground text-[11px] font-semibold tracking-wider">
          LENDUTAN (mm)
        </span>

        <div className="flex h-44 items-stretch gap-2">
          {/* Vertical Color Gradient Bar (SAP2000 Blue -> Cyan -> Green -> Yellow -> Red) */}
          <div className="w-3.5 rounded-full bg-linear-to-b from-blue-500 via-cyan-500 via-emerald-500 via-yellow-500 to-red-500 shadow-[0_0_10px_rgba(6,182,212,0.3)]" />

          {/* Tick Labels */}
          <div className="text-foreground/80 flex flex-col justify-between font-mono text-[10px]">
            <span> 0.00</span>
            <span>-{(peakMagnitude * 0.25).toFixed(2)}</span>
            <span>-{(peakMagnitude * 0.5).toFixed(2)}</span>
            <span>-{(peakMagnitude * 0.75).toFixed(2)}</span>
            <span className="font-bold text-red-400">-{peakMagnitude.toFixed(2)}</span>
          </div>
        </div>
      </Card>

      {/* 2. BOTTOM-LEFT: Maximum Deflection Status Card */}
      <Card
        size="sm"
        className="border-border/40 bg-card/90 pointer-events-auto absolute bottom-6 left-6 min-w-64 gap-2 p-3.5 shadow-2xl backdrop-blur-md"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground text-[11px] font-bold tracking-wider">
            LENDUTAN MAKSIMUM
          </span>
          <Badge
            variant={isSatisfied ? "outline" : "destructive"}
            className={cn(
              "px-2 py-0.5 text-[10px] font-bold",
              isSatisfied
                ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-400"
                : "border-destructive/40 bg-destructive/20 text-destructive",
            )}
          >
            {isSatisfied ? "AMAN (OK)" : "MELEBIHI BATAS (NG)"}
          </Badge>
        </div>

        <div className="flex items-baseline gap-1.5">
          <span className="text-foreground font-mono text-2xl font-extrabold">
            -{peakMagnitude.toFixed(2)}
          </span>
          <span className="text-muted-foreground text-xs">mm</span>
          <span className="text-muted-foreground ml-auto text-[11px]">
            di x = {maxDeflectionStationM.toFixed(2)} m
          </span>
        </div>

        <div className="border-border/30 text-muted-foreground border-t pt-1.5 text-[11px]">
          Batas Izin (L/{limitDenominator}):{" "}
          <strong className="text-foreground">
            -{Math.abs(compliance?.allowableLimitMm ?? 0).toFixed(2)} mm
          </strong>{" "}
          {compliance?.deflectionDcr !== undefined
            ? `(${(compliance.deflectionDcr * 100).toFixed(1)}%)`
            : ""}
        </div>
      </Card>
    </div>
  );
}

export default DeflectionHudAndColorbar;
