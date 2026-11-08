/**
 * @file deflection-limits-config.ts
 * @description Deflection serviceability limit criteria (L/180, L/240, L/360, L/480)
 * per Indonesian National Standards (SNI 1729:2020 & SNI 2847:2019 Table 24.2.2).
 */

import { toMillimeters } from "@/types/branded-units";
import type { Meter, Millimeter } from "@/types/branded-units";

/**
 * Standard serviceability limit denominator keys.
 */
export type DeflectionLimitKey = "L_180" | "L_240" | "L_360" | "L_480";

/**
 * Metadata definition of a deflection serviceability criterion.
 */
export interface DeflectionLimitCriterion {
  readonly key: DeflectionLimitKey;
  readonly label: string;
  readonly denominator: number;
  readonly description: string;
}

/**
 * Standard deflection serviceability criteria catalog.
 */
export const DEFLECTION_LIMIT_CATALOG: Record<DeflectionLimitKey, DeflectionLimitCriterion> = {
  L_180: {
    key: "L_180",
    label: "L / 180",
    denominator: 180,
    description: "Atap yang tidak menumpu langit-langit gipsum/plester (SNI 2847 Table 24.2.2)",
  },
  L_240: {
    key: "L_240",
    label: "L / 240",
    denominator: 240,
    description:
      "Lantai umum yang menumpu elemen non-struktural yang tidak mudah rusak akibat lendutan",
  },
  L_360: {
    key: "L_360",
    label: "L / 360",
    denominator: 360,
    description:
      "Lantai yang menumpu langit-langit plesteran atau partisi rentan retak (Standar Utama SAP2000)",
  },
  L_480: {
    key: "L_480",
    label: "L / 480",
    denominator: 480,
    description:
      "Balok yang menumpu dinding partisi getas, kaca struktural, atau mesin presisi tinggi",
  },
};

/**
 * Result of deflection serviceability verification.
 */
export interface DeflectionEvaluationResult {
  /** Absolute value of maximum calculated deflection |Δ_max| in mm. */
  readonly absDeflectionMm: Millimeter;
  /** Allowable deflection limit Δ_allow = L_eff / denominator in mm. */
  readonly allowableLimitMm: Millimeter;
  /** Utilization ratio |Δ_max| / Δ_allow. */
  readonly deflectionDcr: number;
  /** Whether the beam satisfies the serviceability requirement (DCR <= 1.0). */
  readonly isCompliant: boolean;
  /** Status badge text for HUD / UI cards. */
  readonly statusBadge: "SAFE · SNI OK" | "EXCEEDED · DEFLECTION WARNING";
  /** Human-readable explanation. */
  readonly advisory: string;
}

/**
 * Evaluates whether a calculated beam deflection meets serviceability limits.
 * For cantilevers, effective span length is evaluated as 2 * L_c per structural mechanics standards.
 *
 * @param signedDeflectionMm Maximum calculated deflection in mm (conventionally negative for gravity).
 * @param spanLengthM Span length in meters (L > 0).
 * @param limitKey Selected limit criterion key (default: "L_360").
 * @param isCantilever Whether the boundary condition is a cantilever (effective span = 2 * L).
 * @returns Comprehensive DeflectionEvaluationResult object.
 * @throws {Error} If spanLengthM <= 0.
 * @example
 * evaluateDeflectionCompliance(-14.2, meter(6.0), "L_360");
 * // allowable = 6000 / 360 = 16.67 mm, |14.2| <= 16.67 => SAFE
 */
export function evaluateDeflectionCompliance(
  signedDeflectionMm: number,
  spanLengthM: Meter,
  limitKey: DeflectionLimitKey = "L_360",
  isCantilever = false,
): DeflectionEvaluationResult {
  if (spanLengthM <= 0) {
    throw new Error(
      `[DeflectionLimits] Invalid span length: ${spanLengthM} m. Span must be strictly positive.`,
    );
  }

  const criterion = DEFLECTION_LIMIT_CATALOG[limitKey];
  if (!criterion) {
    throw new Error(`[DeflectionLimits] Unrecognized deflection limit key: '${limitKey}'.`);
  }

  const spanMm = toMillimeters(spanLengthM);
  // For cantilevers, the equivalent simple span is 2 * L_c
  const effectiveSpanMm = isCantilever ? spanMm * 2 : spanMm;
  const allowableLimitMm = (effectiveSpanMm / criterion.denominator) as Millimeter;
  const absDeflectionMm = Math.abs(signedDeflectionMm) as Millimeter;
  const deflectionDcr = absDeflectionMm / allowableLimitMm;
  const isCompliant = deflectionDcr <= 1.0;

  const statusBadge = isCompliant ? "SAFE · SNI OK" : "EXCEEDED · DEFLECTION WARNING";
  const advisory = isCompliant
    ? `Lendutan maksimum |${absDeflectionMm.toFixed(2)} mm| memenuhi batas izin ${criterion.label} (${allowableLimitMm.toFixed(2)} mm).`
    : `Lendutan maksimum |${absDeflectionMm.toFixed(2)} mm| MELEBIHI batas izin ${criterion.label} (${allowableLimitMm.toFixed(2)} mm) dengan rasio ${(deflectionDcr * 100).toFixed(1)}%.`;

  return {
    absDeflectionMm,
    allowableLimitMm,
    deflectionDcr,
    isCompliant,
    statusBadge,
    advisory,
  };
}
