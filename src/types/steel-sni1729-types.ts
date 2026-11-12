/**
 * @file steel-sni1729-types.ts
 * @description Type definitions for structural steel design and section optimization
 * according to the Indonesian National Standard SNI 1729:2020 (AISC 360-16 equivalent).
 * Covers IWF and BOX primary dimensions, derived geometric properties, custom parametric
 * hollow box generation contracts, Table B4.1b compactness classifications, Chapter F LTB,
 * and Chapter H interaction.
 */

import type {
  Kilonewton,
  KilonewtonMeter,
  Megapascal,
  Millimeter,
  MillimeterCubed,
  MillimeterSquared,
  MillimeterToFourth,
  UtilizationRatio,
} from "./branded-units";

// ============================================================================
// Steel Profile & Material Grade Classifications
// ============================================================================

/** Supported structural steel cross-section geometry types. */
export type SteelProfileType = "IWF" | "BOX";

/**
 * Standard Indonesian structural steel grades per SNI 1729 / JIS G 3101.
 */
export type SteelGrade =
  | "BJ_34" // fy = 210 MPa, fu = 340 MPa
  | "BJ_37" // fy = 240 MPa, fu = 370 MPa
  | "BJ_41" // fy = 250 MPa, fu = 410 MPa
  | "BJ_50" // fy = 290 MPa, fu = 500 MPa
  | "BJ_55"; // fy = 410 MPa, fu = 550 MPa

/** Mechanical properties of a structural steel material grade. */
export interface SteelGradeProperties {
  readonly grade: SteelGrade;
  /** Specified minimum yield stress fy in MPa. */
  readonly fy: Megapascal;
  /** Specified minimum tensile strength fu in MPa. */
  readonly fu: Megapascal;
  /** Modulus of elasticity E = 200,000 MPa per SNI 1729 Pasal A3.1. */
  readonly E: Megapascal;
  /** Shear modulus G = 77,200 MPa per SNI 1729 Pasal A3.1. */
  readonly G: Megapascal;
  /** Poisson's ratio nu = 0.30. */
  readonly nu: number;
}

// ============================================================================
// Parametric Custom Box Hollow Generator Contracts
// ============================================================================

/** Geometric aspect ratio rule for parametric hollow box generation. */
export type CustomBoxShapeRule = "ALL" | "SQUARE_ONLY" | "RECTANGULAR_ONLY";

/**
 * Configuration parameters for the Parametric Custom Hollow Box (HSS) Generator & Optimizer.
 */
export interface CustomBoxOptimizationConfig {
  /** Whether the parametric custom hollow box generator mode is active (default: false). */
  readonly enabled: boolean;
  /** Minimum section depth H in mm (default: 200). */
  readonly hMinMm: number;
  /** Maximum section depth H in mm (default: 600). */
  readonly hMaxMm: number;
  /** Minimum section width B in mm (default: 200). */
  readonly bMinMm: number;
  /** Maximum section width B in mm (default: 600). */
  readonly bMaxMm: number;
  /** Step interval for H and B dimensions in mm (default: 50). */
  readonly dimensionStepMm: number;
  /** Minimum wall thickness t in mm (default: 20). */
  readonly tMinMm: number;
  /** Maximum wall thickness t in mm (default: 35). */
  readonly tMaxMm: number;
  /** Step interval for wall thickness t in mm (default: 5). */
  readonly thicknessStepMm: number;
  /** Cross-sectional shape filter rule (default: "ALL"). */
  readonly shapeRule: CustomBoxShapeRule;
}

// ============================================================================
// Primary Dimensions (Katalog Primer JSON)
// ============================================================================

/**
 * Raw 5 primary dimensions for IWF profiles per JIS G 3192 / SNI.
 * Only these 5 values are stored in JSON to minimize bundle size.
 */
export interface IwfPrimaryDimensions {
  readonly name: string;
  /** Overall depth H in mm. */
  readonly H: Millimeter;
  /** Flange width B in mm. */
  readonly B: Millimeter;
  /** Web thickness tw in mm. */
  readonly tw: Millimeter;
  /** Flange thickness tf in mm. */
  readonly tf: Millimeter;
  /** Root fillet radius r in mm. */
  readonly r: Millimeter;
}

/**
 * Raw primary dimensions for BOX (Hollow Structural Section) per JIS G 3466.
 */
export interface BoxPrimaryDimensions {
  readonly name: string;
  /** Overall depth H in mm. */
  readonly H: Millimeter;
  /** Overall width B in mm. */
  readonly B: Millimeter;
  /** Uniform wall thickness t in mm. */
  readonly t: Millimeter;
  /** Profile category: Square or Rectangular. */
  readonly shapeType: "SQUARE" | "RECTANGULAR";
  /** Root corner fillet radius r in mm (0 for sharp-cornered custom sections). */
  readonly r?: Millimeter;
}

// ============================================================================
// Complete Derived Geometric Properties (Calculated via Bun Macro)
// ============================================================================

/**
 * Exhaustive geometric sectional properties for structural analysis and design.
 */
export interface SteelSectionProperties {
  readonly name: string;
  readonly profileType: SteelProfileType;
  /** Overall depth H in mm. */
  readonly H: Millimeter;
  /** Overall flange or box width B in mm. */
  readonly B: Millimeter;
  /** Web thickness tw in mm (equals wall thickness t for BOX sections). */
  readonly tw: Millimeter;
  /** Flange thickness tf in mm (equals wall thickness t for BOX sections). */
  readonly tf: Millimeter;
  /** Root fillet radius r in mm (applicable to IWF sections). */
  readonly r?: Millimeter;
  /** Uniform wall thickness t in mm (applicable to BOX sections). */
  readonly t?: Millimeter;
  /** Indicates whether the section was dynamically synthesized by the parametric custom generator. */
  readonly isCustomGenerated?: boolean;
  /** Gross cross-sectional area A in mm². */
  readonly area: MillimeterSquared;
  /** Nominal unit mass W in kg/m. */
  readonly unitWeightKgPerM: number;
  /** Strong-axis moment of inertia Ix in mm⁴. */
  readonly Ix: MillimeterToFourth;
  /** Weak-axis moment of inertia Iy in mm⁴. */
  readonly Iy: MillimeterToFourth;
  /** Strong-axis radius of gyration rx = sqrt(Ix / A) in mm. */
  readonly rx: Millimeter;
  /** Weak-axis radius of gyration ry = sqrt(Iy / A) in mm. */
  readonly ry: Millimeter;
  /** Elastic section modulus about strong axis Sx = Ix / (H / 2) in mm³. */
  readonly Sx: MillimeterCubed;
  /** Elastic section modulus about weak axis Sy = Iy / (B / 2) in mm³. */
  readonly Sy: MillimeterCubed;
  /** Plastic section modulus about strong axis Zx in mm³. */
  readonly Zx: MillimeterCubed;
  /** Plastic section modulus about weak axis Zy in mm³. */
  readonly Zy: MillimeterCubed;
  /** Distance between flange centroids h0 = H - tf in mm. */
  readonly h0: Millimeter;
  /** Clear distance between web fillets hc = H - 2*(tf + r) in mm. */
  readonly hc: Millimeter;
  /** St. Venant torsional constant J in mm⁴. */
  readonly J: MillimeterToFourth;
  /** Warping torsional constant Cw in mm⁶. */
  readonly Cw: number;
  /** Effective radius of gyration for lateral-torsional buckling rts in mm. */
  readonly rts: Millimeter;
}

// ============================================================================
// Compactness & LRFD Capacity Evaluation Interfaces
// ============================================================================

/** Compactness category per SNI 1729:2020 Table B4.1b. */
export type CompactnessClassification = "COMPACT" | "NON_COMPACT" | "SLENDER";

/**
 * Slenderness assessment for flange and web elements.
 */
export interface SectionCompactnessResult {
  readonly flangeClassification: CompactnessClassification;
  readonly webClassification: CompactnessClassification;
  /** Overall governing section classification. */
  readonly governingClassification: CompactnessClassification;
  /** Width-to-thickness ratio of flange lambda_f. */
  readonly lambdaF: number;
  /** Limiting compactness ratio for flange lambda_pf. */
  readonly lambdaPf: number;
  /** Limiting noncompactness ratio for flange lambda_rf. */
  readonly lambdaRf: number;
  /** Width-to-thickness ratio of web lambda_w. */
  readonly lambdaW: number;
  /** Limiting compactness ratio for web lambda_pw. */
  readonly lambdaPw: number;
  /** Limiting noncompactness ratio for web lambda_rw. */
  readonly lambdaRw: number;
}

/**
 * Lateral-Torsional Buckling (LTB) evaluation per SNI 1729:2020 Chapter F.
 */
export interface LateralTorsionalBucklingResult {
  /** Unbraced length Lb in mm. */
  readonly unbracedLengthLb: Millimeter;
  /** Limiting unbraced length for plastic flexural strength Lp in mm. */
  readonly plasticLengthLp: Millimeter;
  /** Limiting unbraced length for inelastic lateral-torsional buckling Lr in mm. */
  readonly inelasticLengthLr: Millimeter;
  /** Moment gradient factor Cb (default 1.0). */
  readonly momentGradientCb: number;
  /** Governing flexural zone: Zone 1 (Plastic), Zone 2 (Inelastic LTB), Zone 3 (Elastic LTB). */
  readonly governingZone: "ZONE_1_PLASTIC" | "ZONE_2_INELASTIC_LTB" | "ZONE_3_ELASTIC_LTB";
  /** Nominal flexural strength Mn in kNm. */
  readonly nominalFlexuralMn: KilonewtonMeter;
  /** Design flexural strength phi_b * Mn in kNm (phi_b = 0.90). */
  readonly designFlexuralPhiMn: KilonewtonMeter;
}

/**
 * Biaxial Bending and Axial Force Interaction per SNI 1729:2020 Chapter H1.
 */
export interface BiaxialInteractionResult {
  /** Applied factored axial force Pu in kN. */
  readonly Pu: Kilonewton;
  /** Design compressive strength phi_c * Pn in kN. */
  readonly phiPn: Kilonewton;
  /** Axial load ratio Pu / (phi_c * Pn). */
  readonly axialRatio: number;
  /** Applied factored strong-axis moment Mux in kNm. */
  readonly Mux: KilonewtonMeter;
  /** Design strong-axis flexural strength phi_b * Mnx in kNm. */
  readonly phiMnx: KilonewtonMeter;
  /** Applied factored weak-axis moment Muy in kNm. */
  readonly Muy: KilonewtonMeter;
  /** Design weak-axis flexural strength phi_b * Mny in kNm. */
  readonly phiMny: KilonewtonMeter;
  /** Combined interaction equation value per Equation H1-1a or H1-1b. */
  readonly interactionValue: UtilizationRatio;
  /** Whether the section passes interaction check (interactionValue <= 1.00). */
  readonly isSafe: boolean;
}

/**
 * Candidate profile evaluated during section optimization search.
 */
export interface SteelOptimizationCandidate {
  readonly properties: SteelSectionProperties;
  readonly grade: SteelGradeProperties;
  readonly compactness: SectionCompactnessResult;
  readonly ltb: LateralTorsionalBucklingResult;
  readonly interaction: BiaxialInteractionResult;
  /** Overall governing Demand-to-Capacity Ratio. */
  readonly governingDcr: UtilizationRatio;
  /** Optimization suitability status. */
  readonly status: "OPTIMAL" | "ACCEPTABLE" | "OVERSTRESSED" | "DIMENSION_EXCEEDED";
}

// ============================================================================
// Custom Error Hierarchy
// ============================================================================

/**
 * Custom error thrown when steel section calculations encounter geometric or code anomalies.
 */
export class SteelDesignError extends Error {
  public readonly profileName: string;
  public readonly context: string;

  constructor(profileName: string, context: string, message: string) {
    super(`[SteelDesignError] Profile '${profileName}' in context '${context}': ${message}`);
    this.name = "SteelDesignError";
    this.profileName = profileName;
    this.context = context;
  }
}
