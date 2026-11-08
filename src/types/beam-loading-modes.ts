/**
 * @file beam-loading-modes.ts
 * @description Type definitions for the 5 support categories (8 orientation variants),
 * joint degree-of-freedom boundary conditions, and discriminated union contracts
 * for Mode A (External Loads) vs Mode B (Direct Internal Forces).
 */

import type {
  Kilonewton,
  KilonewtonMeter,
  KilonewtonPerMeter,
  Meter,
  Millimeter,
} from "./branded-units";

// ============================================================================
// 5 Support Categories & 8 Orientation Variations
// ============================================================================

/**
 * 5 Fundamental Civil Engineering Support Categories.
 */
export type SupportCategory =
  "CANTILEVER" | "PINNED_ROLLER" | "FIXED_FIXED" | "FIXED_ROLLER" | "FIXED_PINNED";

/**
 * 8 Precise Boundary Orientation Variations supported by the Rust WASM Solver.
 */
export type SupportOrientation =
  | "CANTILEVER_LEFT" // Fixed at x=0, Free at x=L
  | "CANTILEVER_RIGHT" // Free at x=0, Fixed at x=L
  | "PINNED_ROLLER" // Pinned at x=0, Roller at x=L
  | "ROLLER_PINNED" // Roller at x=0, Pinned at x=L
  | "FIXED_FIXED" // Fixed at x=0, Fixed at x=L
  | "FIXED_ROLLER" // Fixed at x=0, Roller at x=L
  | "ROLLER_FIXED" // Roller at x=0, Fixed at x=L
  | "FIXED_PINNED" // Fixed at x=0, Pinned at x=L
  | "PINNED_FIXED"; // Pinned at x=0, Fixed at x=L

/**
 * Degrees of Freedom (6-DOF) Restraints per SAP2000 / ETABS joint assignment conventions.
 * true = Restrained (Fixed displacement/rotation), false = Free.
 */
export interface JointRestraint6DOF {
  readonly ux: boolean; // Translation along X (Axial)
  readonly uy: boolean; // Translation along Y (Transverse)
  readonly uz: boolean; // Translation along Z (Vertical deflection)
  readonly rx: boolean; // Rotation about X (Torsion)
  readonly ry: boolean; // Rotation about Y (Weak-axis bending)
  readonly rz: boolean; // Rotation about Z (Strong-axis bending)
}

/** Pre-defined standard joint restraint configurations. */
export const STANDARD_RESTRAINTS: Record<
  "FIXED" | "PINNED" | "ROLLER" | "FREE",
  JointRestraint6DOF
> = {
  FIXED: { ux: true, uy: true, uz: true, rx: true, ry: true, rz: true },
  PINNED: { ux: true, uy: true, uz: true, rx: false, ry: false, rz: false },
  ROLLER: { ux: false, uy: true, uz: true, rx: false, ry: false, rz: false },
  FREE: { ux: false, uy: false, uz: false, rx: false, ry: false, rz: false },
};

// ============================================================================
// Load Primitives for Mode A (External Interactive Loading)
// ============================================================================

/**
 * Concentrated point load acting on the beam.
 */
export interface PointLoad {
  readonly id: string;
  /** Magnitude of load in kN. Downward gravity loads are positive numbers. */
  readonly magnitude: Kilonewton;
  /** Position from left support (x=0) in meters. 0 <= position <= L. */
  readonly position: Meter;
}

/**
 * Uniformly or trapezoidally distributed load acting on a span segment.
 */
export interface DistributedLoad {
  readonly id: string;
  /** Intensity in kN/m. Downward gravity loads are positive numbers. */
  readonly magnitude: KilonewtonPerMeter;
  /** Start coordinate in meters (x1). 0 <= startPosition < endPosition. */
  readonly startPosition: Meter;
  /** End coordinate in meters (x2). startPosition < endPosition <= L. */
  readonly endPosition: Meter;
}

/**
 * Concentrated external bending moment applied at a discrete coordinate.
 */
export interface AppliedMoment {
  readonly id: string;
  /** Magnitude in kNm. Counter-clockwise is positive. */
  readonly magnitude: KilonewtonMeter;
  /** Position from left support (x=0) in meters. 0 <= position <= L. */
  readonly position: Meter;
}

// ============================================================================
// Discriminated Union for Mode A vs Mode B
// ============================================================================

/**
 * Mode A: Interactive External Loading Configuration (Desktop full 3D simulation).
 */
export interface ExternalLoadsModeAConfig {
  readonly mode: "MODE_A_EXTERNAL_LOADS";
  /** Beam clear span length in meters (L > 0). */
  readonly spanLength: Meter;
  /** Boundary support condition orientation. */
  readonly supportOrientation: SupportOrientation;
  /** Whether beam self-weight is automatically incorporated based on cross-section density. */
  readonly includeSelfWeight: boolean;
  /** Array of discrete point loads. */
  readonly pointLoads: readonly PointLoad[];
  /** Array of distributed loads. */
  readonly distributedLoads: readonly DistributedLoad[];
  /** Array of applied moments. */
  readonly appliedMoments: readonly AppliedMoment[];
}

/**
 * Mode B: Direct Factored Internal Forces (Android Companion & Quick Calculator).
 * Bypasses external load modeling; receives structural analysis results directly.
 */
export interface DirectInternalForcesModeBConfig {
  readonly mode: "MODE_B_DIRECT_INTERNAL_FORCES";
  /** Effective unbraced span length in meters (L > 0). Used for LTB and deflection bounds. */
  readonly spanLength: Meter;
  /** Factored axial force Pu in kN. Positive = Tension, Negative = Compression. */
  readonly axialForcePu: Kilonewton;
  /** Factored strong-axis bending moment Mux in kNm. */
  readonly strongAxisMomentMux: KilonewtonMeter;
  /** Factored weak-axis bending moment Muy in kNm. */
  readonly weakAxisMomentMuy: KilonewtonMeter;
  /** Factored torsional moment Tu in kNm. */
  readonly torsionTu: KilonewtonMeter;
  /** Factored shear force Vu in kN. */
  readonly shearForceVu: Kilonewton;
}

/**
 * Discriminated union encompassing both loading evaluation paradigms.
 */
export type BeamLoadingConfig = ExternalLoadsModeAConfig | DirectInternalForcesModeBConfig;

// ============================================================================
// Error Hierarchy & Diagnostic Validation Helpers
// ============================================================================

/**
 * Custom error thrown when beam loading configuration parameters violate physics or geometry.
 */
export class BeamLoadingValidationError extends Error {
  public readonly fieldName: string;
  public readonly invalidValue: unknown;

  constructor(fieldName: string, invalidValue: unknown, reason: string) {
    super(`[BeamLoadingValidationError] Field '${fieldName}' (${String(invalidValue)}): ${reason}`);
    this.name = "BeamLoadingValidationError";
    this.fieldName = fieldName;
    this.invalidValue = invalidValue;
  }
}

/**
 * Resolves the primary SupportCategory from a specific SupportOrientation.
 * @param orientation Specific boundary condition orientation.
 * @returns Parent SupportCategory enum.
 * @example getSupportCategory("ROLLER_PINNED") // returns "PINNED_ROLLER"
 */
export function getSupportCategory(orientation: SupportOrientation): SupportCategory {
  switch (orientation) {
    case "CANTILEVER_LEFT":
    case "CANTILEVER_RIGHT":
      return "CANTILEVER";
    case "PINNED_ROLLER":
    case "ROLLER_PINNED":
      return "PINNED_ROLLER";
    case "FIXED_FIXED":
      return "FIXED_FIXED";
    case "FIXED_ROLLER":
    case "ROLLER_FIXED":
      return "FIXED_ROLLER";
    case "FIXED_PINNED":
    case "PINNED_FIXED":
      return "FIXED_PINNED";
    default: {
      const exhaustiveCheck: never = orientation;
      throw new BeamLoadingValidationError(
        "supportOrientation",
        exhaustiveCheck,
        "Unknown support orientation provided.",
      );
    }
  }
}

/**
 * Returns the boundary joint restraints (6-DOF) for both ends of the beam.
 * @param orientation Specific boundary support orientation.
 * @returns Object containing left joint restraint (at x=0) and right joint restraint (at x=L).
 * @example
 * const { left, right } = getBoundaryJointRestraints("PINNED_ROLLER");
 * // left is PINNED, right is ROLLER
 */
export function getBoundaryJointRestraints(orientation: SupportOrientation): {
  readonly left: JointRestraint6DOF;
  readonly right: JointRestraint6DOF;
} {
  switch (orientation) {
    case "CANTILEVER_LEFT":
      return { left: STANDARD_RESTRAINTS.FIXED, right: STANDARD_RESTRAINTS.FREE };
    case "CANTILEVER_RIGHT":
      return { left: STANDARD_RESTRAINTS.FREE, right: STANDARD_RESTRAINTS.FIXED };
    case "PINNED_ROLLER":
      return { left: STANDARD_RESTRAINTS.PINNED, right: STANDARD_RESTRAINTS.ROLLER };
    case "ROLLER_PINNED":
      return { left: STANDARD_RESTRAINTS.ROLLER, right: STANDARD_RESTRAINTS.PINNED };
    case "FIXED_FIXED":
      return { left: STANDARD_RESTRAINTS.FIXED, right: STANDARD_RESTRAINTS.FIXED };
    case "FIXED_ROLLER":
      return { left: STANDARD_RESTRAINTS.FIXED, right: STANDARD_RESTRAINTS.ROLLER };
    case "ROLLER_FIXED":
      return { left: STANDARD_RESTRAINTS.ROLLER, right: STANDARD_RESTRAINTS.FIXED };
    case "FIXED_PINNED":
      return { left: STANDARD_RESTRAINTS.FIXED, right: STANDARD_RESTRAINTS.PINNED };
    case "PINNED_FIXED":
      return { left: STANDARD_RESTRAINTS.PINNED, right: STANDARD_RESTRAINTS.FIXED };
    default: {
      const exhaustiveCheck: never = orientation;
      throw new BeamLoadingValidationError(
        "supportOrientation",
        exhaustiveCheck,
        "Unsupported orientation.",
      );
    }
  }
}

/**
 * Validates the geometric integrity of a Mode A configuration.
 * @param config Mode A configuration to validate.
 * @throws {BeamLoadingValidationError} If span length <= 0 or loads exceed span boundary.
 */
export function validateModeAConfig(config: ExternalLoadsModeAConfig): void {
  if (config.spanLength <= 0) {
    throw new BeamLoadingValidationError(
      "spanLength",
      config.spanLength,
      "Span length must be strictly positive (L > 0).",
    );
  }

  for (const [idx, pl] of config.pointLoads.entries()) {
    if (pl.position < 0 || pl.position > config.spanLength) {
      throw new BeamLoadingValidationError(
        `pointLoads[${idx}].position`,
        pl.position,
        `Point load position must be within span [0, ${config.spanLength} m].`,
      );
    }
  }

  for (const [idx, dl] of config.distributedLoads.entries()) {
    if (
      dl.startPosition < 0 ||
      dl.endPosition > config.spanLength ||
      dl.startPosition >= dl.endPosition
    ) {
      throw new BeamLoadingValidationError(
        `distributedLoads[${idx}]`,
        `x1=${dl.startPosition}, x2=${dl.endPosition}`,
        `Distributed load range must satisfy 0 <= x1 < x2 <= ${config.spanLength} m.`,
      );
    }
  }

  for (const [idx, m] of config.appliedMoments.entries()) {
    if (m.position < 0 || m.position > config.spanLength) {
      throw new BeamLoadingValidationError(
        `appliedMoments[${idx}].position`,
        m.position,
        `Moment position must be within span [0, ${config.spanLength} m].`,
      );
    }
  }
}

/**
 * Validates the numeric integrity of a Mode B configuration.
 * @param config Mode B configuration to validate.
 * @throws {BeamLoadingValidationError} If span length <= 0 or forces are non-finite.
 */
export function validateModeBConfig(config: DirectInternalForcesModeBConfig): void {
  if (config.spanLength <= 0) {
    throw new BeamLoadingValidationError(
      "spanLength",
      config.spanLength,
      "Span length must be strictly positive (L > 0).",
    );
  }

  const forces = [
    { name: "axialForcePu", val: config.axialForcePu },
    { name: "strongAxisMomentMux", val: config.strongAxisMomentMux },
    { name: "weakAxisMomentMuy", val: config.weakAxisMomentMuy },
    { name: "torsionTu", val: config.torsionTu },
    { name: "shearForceVu", val: config.shearForceVu },
  ];

  for (const f of forces) {
    if (!Number.isFinite(f.val)) {
      throw new BeamLoadingValidationError(
        f.name,
        f.val,
        "Internal force value must be a finite number.",
      );
    }
  }
}
