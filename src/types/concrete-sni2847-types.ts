/**
 * @file concrete-sni2847-types.ts
 * @description Type definitions for reinforced concrete structural design
 * following the Indonesian National Standard SNI 2847:2019.
 * Covers Whitney stress block flexural design, shear stirrup detailing,
 * material grades (fc' & K-xxx, BJTP/BJTS), and optimization results.
 */

import type {
  Kilonewton,
  KilonewtonMeter,
  Megapascal,
  Millimeter,
  MillimeterSquared,
  UtilizationRatio,
} from "./branded-units";

// ============================================================================
// Concrete & Rebar Material Grades
// ============================================================================

/**
 * Standard concrete cylinder compressive strength grade identifier.
 */
export type ConcreteCylinderGrade =
  "FC_20" | "FC_25" | "FC_30" | "FC_35" | "FC_40" | "FC_45" | "FC_50";

/**
 * Historical/conventional Indonesian cube compressive strength grade identifier (K-xxx).
 * Cube size 150x150x150 mm. Converted to cylinder fc' via fc' = 0.83 * K * 0.0980665.
 */
export type ConcreteCubeGrade =
  "K_175" | "K_200" | "K_225" | "K_250" | "K_300" | "K_350" | "K_400" | "K_500";

/**
 * Indonesian National Standard rebar steel grades.
 * BJTP: Baja Tulangan Polos (Plain bar)
 * BJTS: Baja Tulangan Sirip/Ulir (Deformed bar)
 */
export type RebarSteelGrade =
  | "BJTP_24" // fy = 240 MPa, fu = 390 MPa
  | "BJTP_30" // fy = 300 MPa, fu = 450 MPa
  | "BJTS_40" // fy = 400 MPa, fu = 570 MPa
  | "BJTS_50" // fy = 500 MPa, fu = 650 MPa
  | "BJTS_60"; // fy = 600 MPa, fu = 750 MPa

/**
 * Mechanical specifications of a reinforcing steel grade.
 */
export interface RebarGradeProperties {
  readonly grade: RebarSteelGrade;
  /** Specified minimum yield strength in MPa. */
  readonly fy: Megapascal;
  /** Specified minimum tensile strength in MPa. */
  readonly fu: Megapascal;
  /** Bar surface deformation type: Plain (Polos) or Deformed (Sirip/Ulir). */
  readonly type: "PLAIN" | "DEFORMED";
}

/**
 * Standard nominal bar diameter and cross-sectional area per single bar.
 */
export interface RebarNominalBar {
  /** Nominal bar diameter in mm (e.g. 10, 13, 16, 19, 22, 25). */
  readonly diameter: Millimeter;
  /** Cross-sectional area of one single bar Ab = (pi / 4) * db^2 in mm². */
  readonly area: MillimeterSquared;
  /** Unit weight in kg/m = 0.006165 * db^2. */
  readonly unitWeightKgPerM: number;
}

// ============================================================================
// Concrete Section Input Parameters
// ============================================================================

/**
 * Geometric and material configuration of a rectangular reinforced concrete beam.
 */
export interface ConcreteSectionInput {
  /** Beam width bw in mm. */
  readonly bw: Millimeter;
  /** Total beam overall height h in mm. */
  readonly h: Millimeter;
  /** Concrete clear cover dc in mm (default 40 mm per SNI 2847 Table 20.6.1.3.1). */
  readonly concreteCover: Millimeter;
  /** Concrete cylinder compressive strength fc' in MPa. */
  readonly fc: Megapascal;
  /** Longitudinal tensile/compression rebar steel grade. */
  readonly longitudinalRebarGrade: RebarSteelGrade;
  /** Transverse shear stirrup steel grade. */
  readonly stirrupRebarGrade: RebarSteelGrade;
  /** Aggregate maximum size in mm (default 20 mm). Used for minimum clear spacing check. */
  readonly maxAggregateSizeMm: number;
}

// ============================================================================
// Design & Detailing Result Interfaces
// ============================================================================

/**
 * Section flexural condition classification based on net tensile steel strain (epsilon_t).
 */
export type ConcreteSectionTensionStatus =
  | "TENSION_CONTROLLED" // epsilon_t >= 0.005, phi = 0.90 (Ductile)
  | "TRANSITION_ZONE" // 0.002 <= epsilon_t < 0.005, phi interpolated
  | "COMPRESSION_CONTROLLED"; // epsilon_t < 0.002, phi = 0.65 (Brittle)

/**
 * Flexural reinforcement detailing arrangement.
 */
export interface RebarLayerArrangement {
  /** Number of longitudinal bars in this layer. */
  readonly barCount: number;
  /** Nominal bar diameter db in mm. */
  readonly barDiameter: Millimeter;
  /** Total steel area of this layer in mm². */
  readonly totalArea: MillimeterSquared;
  /** Clear horizontal spacing between adjacent bars in mm. */
  readonly clearSpacingMm: number;
}

/**
 * Results of SNI 2847:2019 Whitney flexural design calculation.
 */
export interface ConcreteFlexuralDesignResult {
  /** Required tensile steel area As in mm². */
  readonly requiredAs: MillimeterSquared;
  /** Provided tensile steel area As,prov in mm². */
  readonly providedAs: MillimeterSquared;
  /** Provided compressive steel area A's in mm² (if doubly reinforced required). */
  readonly providedAsPrime: MillimeterSquared;
  /** Effective depth d in mm. */
  readonly effectiveDepthD: Millimeter;
  /** Depth of equivalent Whitney rectangular stress block a in mm. */
  readonly whitneyBlockDepthA: number;
  /** Distance from extreme compression fiber to neutral axis c = a / beta1 in mm. */
  readonly neutralAxisDepthC: number;
  /** Whitney stress block reduction factor beta1. */
  readonly beta1: number;
  /** Net tensile strain in extreme tension reinforcement epsilon_t. */
  readonly netTensileStrain: number;
  /** Strength reduction factor phi for flexure (0.65 to 0.90). */
  readonly phiFlexure: number;
  /** Nominal flexural strength Mn in kNm. */
  readonly nominalMomentMn: KilonewtonMeter;
  /** Design flexural strength phi*Mn in kNm. */
  readonly designMomentPhiMn: KilonewtonMeter;
  /** Demand-to-Capacity Ratio (Mu / phi*Mn). */
  readonly flexuralDcr: UtilizationRatio;
  /** Section ductility status. */
  readonly tensionStatus: ConcreteSectionTensionStatus;
  /** Detailing layers for tensile rebar. */
  readonly tensionLayers: readonly RebarLayerArrangement[];
  /** Detailing layers for compressive rebar. */
  readonly compressionLayers: readonly RebarLayerArrangement[];
}

/**
 * Results of SNI 2847:2019 shear stirrup design calculation.
 */
export interface ConcreteShearDesignResult {
  /** Factored shear force Vu in kN. */
  readonly factoredShearVu: Kilonewton;
  /** Nominal concrete shear capacity Vc = 0.17 * lambda * sqrt(fc') * bw * d in kN. */
  readonly concreteShearStrengthVc: Kilonewton;
  /** Required nominal shear strength from stirrups Vs = (Vu / phi) - Vc in kN. */
  readonly requiredStirrupVs: Kilonewton;
  /** Number of stirrup vertical legs (typically 2 for single closed hoop). */
  readonly stirrupLegs: number;
  /** Nominal stirrup diameter in mm. */
  readonly stirrupDiameter: Millimeter;
  /** Calculated stirrup spacing s in mm. */
  readonly stirrupSpacing: Millimeter;
  /** Maximum permissible stirrup spacing s_max per SNI 2847 Table 9.7.6.2.2 in mm. */
  readonly maxPermissibleSpacing: Millimeter;
  /** Design shear capacity phi*Vn = phi * (Vc + Vs) in kN. */
  readonly designShearPhiVn: Kilonewton;
  /** Shear Demand-to-Capacity Ratio (Vu / phi*Vn). */
  readonly shearDcr: UtilizationRatio;
}

/**
 * Comprehensive concrete beam optimization deliverable.
 */
export interface ConcreteOptimizationResult {
  /** Chosen cross-section dimensions (bw x h). */
  readonly section: ConcreteSectionInput;
  /** Flexural design calculations and rebar detailing. */
  readonly flexure: ConcreteFlexuralDesignResult;
  /** Shear stirrup calculations and spacing detailing. */
  readonly shear: ConcreteShearDesignResult;
  /** Total reinforcement volume ratio rho = As / (bw * d). */
  readonly reinforcementRatioRho: number;
  /** Overall compliance status. */
  readonly isCompliant: boolean;
  /** Advisory or warning messages regarding code compliance or detailing constraints. */
  readonly advisories: readonly string[];
}

// ============================================================================
// Custom Error Hierarchy
// ============================================================================

/**
 * Custom error thrown when concrete design parameters violate SNI 2847 code provisions.
 */
export class ConcreteDesignError extends Error {
  public readonly parameterName: string;
  public readonly parameterValue: unknown;

  constructor(parameterName: string, parameterValue: unknown, message: string) {
    super(
      `[ConcreteDesignError] Parameter '${parameterName}' (${String(parameterValue)}): ${message}`,
    );
    this.name = "ConcreteDesignError";
    this.parameterName = parameterName;
    this.parameterValue = parameterValue;
  }
}
