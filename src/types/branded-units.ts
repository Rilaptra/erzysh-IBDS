/**
 * @file branded-units.ts
 * @description Strict branded nominal types and conversion utilities for civil engineering units.
 * Enforces compile-time dimensional safety and prevents erroneous unit mixing (e.g., kNm vs Nmm).
 */

declare const UnitBrand: unique symbol;

/**
 * Generic branded type wrapper attaching a compile-time phantom tag.
 * @template T Underlying primitive type.
 * @template B Unique string identifier for the unit.
 */
export type Branded<T, B extends string> = T & { readonly [UnitBrand]: B };

/** Force in Kilonewtons (kN). 1 kN = 1,000 N. */
export type Kilonewton = Branded<number, "kN">;

/** Bending / Torsional Moment in Kilonewton-Meters (kNm). 1 kNm = 1,000,000 Nmm. */
export type KilonewtonMeter = Branded<number, "kNm">;

/** Force in Newtons (N). 1 N = 0.001 kN. */
export type Newton = Branded<number, "N">;

/** Moment in Newton-Millimeters (Nmm). 1 Nmm = 1e-6 kNm. */
export type NewtonMillimeter = Branded<number, "Nmm">;

/** Stress or Strength in Megapascals (MPa = N/mm²). */
export type Megapascal = Branded<number, "MPa">;

/** Pressure or Stress in Pascals (Pa = N/m²). */
export type Pascal = Branded<number, "Pa">;

/** Modulus of Elasticity in Gigapascals (GPa = 1,000 MPa). */
export type Gigapascal = Branded<number, "GPa">;

/** Linear dimension or deflection in Millimeters (mm). */
export type Millimeter = Branded<number, "mm">;

/** Beam span length or coordinate in Meters (m). 1 m = 1,000 mm. */
export type Meter = Branded<number, "m">;

/** Distributed load in Kilonewtons per Meter (kN/m = N/mm). */
export type KilonewtonPerMeter = Branded<number, "kN/m">;

/** Angle in Radians (rad). */
export type Radian = Branded<number, "rad">;

/** Angle in Degrees (deg). */
export type Degree = Branded<number, "deg">;

/** Demand-to-Capacity Ratio (DCR = Mu / (phi * Mn) or Vu / (phi * Vn)). Dimensionless. */
export type UtilizationRatio = Branded<number, "DCR">;

/** Unit weight in Kilonewtons per Cubic Meter (kN/m³). */
export type KilonewtonPerCubicMeter = Branded<number, "kN/m3">;

/** Mass density in Kilograms per Cubic Meter (kg/m³). */
export type KilogramPerCubicMeter = Branded<number, "kg/m3">;

/** Section modulus in Cubic Millimeters (mm³). */
export type MillimeterCubed = Branded<number, "mm3">;

/** Second moment of area / Moment of inertia in Quartic Millimeters (mm⁴). */
export type MillimeterToFourth = Branded<number, "mm4">;

/** Cross-sectional area in Square Millimeters (mm²). */
export type MillimeterSquared = Branded<number, "mm2">;

// ============================================================================
// Custom Error Hierarchy for Unit Validation
// ============================================================================

/**
 * Custom error thrown when a numerical value fails unit domain boundaries.
 */
export class UnitValidationError extends Error {
  public readonly unitName: string;
  public readonly providedValue: unknown;

  constructor(unitName: string, providedValue: unknown, reason: string) {
    super(`[UnitValidationError] Invalid ${unitName} value (${String(providedValue)}): ${reason}`);
    this.name = "UnitValidationError";
    this.unitName = unitName;
    this.providedValue = providedValue;
  }
}

// ============================================================================
// Runtime Constructor Helpers with Validation
// ============================================================================

/**
 * Validates that an input is a finite, non-NaN number.
 * @param value The value to validate.
 * @param unitName Name of the unit for diagnostic reporting.
 * @throws {UnitValidationError} When value is not a finite number.
 */
function assertFiniteNumber(value: number, unitName: string): void {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    throw new UnitValidationError(unitName, value, "Value must be a finite number.");
  }
}

/**
 * Creates a validated Kilonewton (kN) value.
 * @param value Numeric force in kN.
 * @returns Branded Kilonewton.
 * @example const load = kilonewton(25.5);
 */
export function kilonewton(value: number): Kilonewton {
  assertFiniteNumber(value, "Kilonewton (kN)");
  return value as Kilonewton;
}

/**
 * Creates a validated KilonewtonMeter (kNm) value.
 * @param value Numeric moment in kNm.
 * @returns Branded KilonewtonMeter.
 * @example const moment = kilonewtonMeter(120.0);
 */
export function kilonewtonMeter(value: number): KilonewtonMeter {
  assertFiniteNumber(value, "KilonewtonMeter (kNm)");
  return value as KilonewtonMeter;
}

/**
 * Creates a validated Megapascal (MPa) value.
 * Must be strictly non-negative for material strengths.
 * @param value Numeric stress/strength in MPa.
 * @param allowNegative Whether compressive or negative stress is permitted (default: false).
 * @returns Branded Megapascal.
 * @example const fc = megapascal(25);
 */
export function megapascal(value: number, allowNegative = false): Megapascal {
  assertFiniteNumber(value, "Megapascal (MPa)");
  if (!allowNegative && value < 0) {
    throw new UnitValidationError(
      "Megapascal (MPa)",
      value,
      "Material strength cannot be negative.",
    );
  }
  return value as Megapascal;
}

/**
 * Creates a validated Millimeter (mm) value.
 * @param value Numeric dimension in mm.
 * @returns Branded Millimeter.
 * @example const height = millimeter(400);
 */
export function millimeter(value: number): Millimeter {
  assertFiniteNumber(value, "Millimeter (mm)");
  return value as Millimeter;
}

/**
 * Creates a validated Meter (m) value.
 * @param value Numeric length in m.
 * @returns Branded Meter.
 * @example const span = meter(6.0);
 */
export function meter(value: number): Meter {
  assertFiniteNumber(value, "Meter (m)");
  return value as Meter;
}

/**
 * Creates a validated KilonewtonPerMeter (kN/m) value.
 * @param value Numeric distributed load in kN/m.
 * @returns Branded KilonewtonPerMeter.
 * @example const q = kilonewtonPerMeter(15.0);
 */
export function kilonewtonPerMeter(value: number): KilonewtonPerMeter {
  assertFiniteNumber(value, "KilonewtonPerMeter (kN/m)");
  return value as KilonewtonPerMeter;
}

/**
 * Creates a validated Demand-to-Capacity Ratio (DCR).
 * @param value Dimensionless ratio (e.g. Mu / phi*Mn).
 * @returns Branded UtilizationRatio.
 * @example const dcr = utilizationRatio(0.94);
 */
export function utilizationRatio(value: number): UtilizationRatio {
  assertFiniteNumber(value, "UtilizationRatio (DCR)");
  if (value < 0) {
    throw new UnitValidationError("UtilizationRatio (DCR)", value, "DCR ratio cannot be negative.");
  }
  return value as UtilizationRatio;
}

// ============================================================================
// Unit Conversion Helpers
// ============================================================================

/**
 * Converts Kilonewton-Meters to Newton-Millimeters for cross-sectional stress calculations.
 * 1 kNm = 10^3 N * 10^3 mm = 10^6 Nmm.
 * @param moment Moment in kNm.
 * @returns Moment in Nmm.
 * @example toNmm(kilonewtonMeter(50)) // returns 50000000
 */
export function toNmm(moment: KilonewtonMeter): NewtonMillimeter {
  assertFiniteNumber(moment, "KilonewtonMeter (kNm)");
  return (moment * 1_000_000) as NewtonMillimeter;
}

/**
 * Converts Newton-Millimeters to Kilonewton-Meters.
 * @param momentNmm Moment in Nmm.
 * @returns Moment in kNm.
 */
export function toKNm(momentNmm: number): KilonewtonMeter {
  assertFiniteNumber(momentNmm, "NewtonMillimeter (Nmm)");
  return (momentNmm / 1_000_000) as KilonewtonMeter;
}

/**
 * Converts Meters to Millimeters.
 * @param lengthInMeters Length in meters.
 * @returns Dimension in millimeters.
 */
export function toMillimeters(lengthInMeters: Meter): Millimeter {
  assertFiniteNumber(lengthInMeters, "Meter (m)");
  return (lengthInMeters * 1_000) as Millimeter;
}

/**
 * Converts Millimeters to Meters.
 * @param lengthInMm Length in millimeters.
 * @returns Length in meters.
 */
export function toMeters(lengthInMm: Millimeter): Meter {
  assertFiniteNumber(lengthInMm, "Millimeter (mm)");
  return (lengthInMm / 1_000) as Meter;
}

/**
 * Converts Kilonewtons to Newtons.
 * @param forceInKn Force in kilonewtons.
 * @returns Force in newtons.
 */
export function toNewtons(forceInKn: Kilonewton): Newton {
  assertFiniteNumber(forceInKn, "Kilonewton (kN)");
  return (forceInKn * 1_000) as Newton;
}

/**
 * Converts Newtons to Kilonewtons.
 * @param forceInN Force in newtons.
 * @returns Force in kilonewtons.
 */
export function toKilonewtons(forceInN: number): Kilonewton {
  assertFiniteNumber(forceInN, "Newton (N)");
  return (forceInN / 1_000) as Kilonewton;
}

// ============================================================================
// Coordinate System Contracts & Spatial Vector Types
// ============================================================================

/** Supported 3D coordinate system orientation modes. */
export type CoordinateSystemMode = "Z-Up" | "Y-Up" | "CustomXYZ";

/**
 * 3D Coordinate Point or Direction Vector in orthogonal space.
 */
export interface Vector3D {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * 3x3 Orthogonal transformation matrix represented as row-major tuple.
 */
export type Matrix3x3 = readonly [
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number],
];

/**
 * Predefined permutation matrices to transform from local beam coordinates
 * (Span along X, Vertical Deflection along Local Vertical) to active 3D mode.
 */
export const COORDINATE_TRANSFORMS: Record<CoordinateSystemMode, Matrix3x3> = {
  // Z-Up (Civil Engineering Standard: SAP2000, ETABS, Revit, AutoCAD)
  // X = Beam Span, Y = Transverse Horizontal, Z = Vertical Elevation
  "Z-Up": [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
  // Y-Up (WebGL, Three.js, SolidWorks default)
  // X = Beam Span, Y = Vertical Elevation, Z = Transverse Depth
  "Y-Up": [
    [1, 0, 0],
    [0, 0, 1],
    [0, 1, 0],
  ],
  // Custom XYZ
  CustomXYZ: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
};

// ============================================================================
// Negative Deflection Convention Verification (Δ < 0)
// ============================================================================

/**
 * Verifies that a downward deflection value satisfies the structural mechanics convention (Δ < 0).
 * S.I. structural mechanics establishes upward vertical deflection as positive (+v)
 * and downward deflection under gravity as strictly negative (-v).
 *
 * @param deflectionMm The deflection value in mm.
 * @param context Diagnostic context string for error tracing.
 * @throws {UnitValidationError} When a downward deflection is erroneously passed as positive.
 */
export function assertNegativeDeflection(deflectionMm: number, context = "deflection"): void {
  assertFiniteNumber(deflectionMm, context);
  if (deflectionMm > 0) {
    throw new UnitValidationError(
      context,
      deflectionMm,
      `Downward gravity deflection must be negative (Δ < 0). Received positive value: +${deflectionMm.toFixed(3)} mm.`,
    );
  }
}
