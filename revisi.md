================================================================================
FILE 1: src/types/steel-sni1729-types.ts
================================================================================

```ts
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
```

================================================================================
FILE 2: src/core/steel/steel-section-optimizer.ts
================================================================================

```ts
/**
 * @file steel-section-optimizer.ts
 * @description High-efficiency structural steel section optimizer (SNI 1729:2020).
 * Implements binary-search-assisted profile discovery across JIS G 3192 (IWF),
 * JIS G 3466 (BOX) precomputed catalogs, and the Parametric Custom Box Hollow
 * Section Generator (configurable H, B intervals and wall thickness t = 20–35 mm).
 * Evaluates Table B4.1b compactness, Chapter F LTB, Chapter G shear, Chapter H1 interaction,
 * Chapter H3 torsion, geometric constraints (H_max, B_max), and Smart Grade optimization
 * (BJ 34, BJ 37, BJ 41, BJ 50, BJ 55) with weight-first economic ranking.
 */

import type { DeflectionLimitKey } from "@/config/deflection-limits-config";
import { evaluateDeflectionCompliance } from "@/config/deflection-limits-config";
import rawSteelGrades from "@/data/steel-material-grades.json";
import type { Kilonewton, KilonewtonMeter, Meter } from "@/types/branded-units";
import {
  kilonewton,
  kilonewtonMeter,
  meter,
  millimeter,
  utilizationRatio,
} from "@/types/branded-units";
import type {
  CustomBoxOptimizationConfig,
  SteelGrade,
  SteelGradeProperties,
  SteelOptimizationCandidate,
  SteelProfileType,
  SteelSectionProperties,
} from "@/types/steel-sni1729-types";
import { SteelDesignError } from "@/types/steel-sni1729-types";

import {
  getPrecomputedSortedBoxCatalog,
  getPrecomputedSortedIwfCatalog,
} from "../../macros/precompute-steel-catalog.macro";
import { evaluateBiaxialInteraction } from "./biaxial-interaction-evaluator";
import { type BoxSectionProperties, computeBoxSectionProperties } from "./iwf-geometric-properties";
import { solveLateralTorsionalBuckling } from "./lateral-torsional-buckling-solver";
import { classifySectionCompactness } from "./section-compactness-classifier";
import { evaluateSteelShear, evaluateSteelTorsion } from "./steel-torsion-shear-evaluator";

/** Standard steel material grades catalog. */
export const STEEL_GRADES_CATALOG: Record<SteelGrade, SteelGradeProperties> = {
  BJ_34: rawSteelGrades[0] as unknown as SteelGradeProperties,
  BJ_37: rawSteelGrades[1] as unknown as SteelGradeProperties,
  BJ_41: rawSteelGrades[2] as unknown as SteelGradeProperties,
  BJ_50: rawSteelGrades[3] as unknown as SteelGradeProperties,
  BJ_55: rawSteelGrades[4] as unknown as SteelGradeProperties,
};

/** Pre-computed catalogs loaded at compile time via Bun Macro. */
const SORTED_IWF_CATALOG: readonly SteelSectionProperties[] = getPrecomputedSortedIwfCatalog();
const SORTED_BOX_CATALOG: readonly BoxSectionProperties[] = getPrecomputedSortedBoxCatalog();

/** Safety cap on parametric combinations to preserve low-RAM device responsiveness. */
const MAX_CUSTOM_BOX_COMBINATIONS = 2500;

/** Input parameters configuring steel section optimization. */
export interface SteelOptimizerInput {
  /** Target profile geometry type ("IWF", "BOX", or "ANY"). Default: "IWF". */
  readonly profileType?: SteelProfileType | "ANY";
  /** Applied factored axial force Pu in kN (positive = tension, negative = compression). */
  readonly factoredAxialPu?: Kilonewton | number;
  /** Applied factored strong-axis moment Mux in kNm. */
  readonly factoredMomentMux: KilonewtonMeter | number;
  /** Applied factored weak-axis moment Muy in kNm. */
  readonly factoredMomentMuy?: KilonewtonMeter | number;
  /** Applied factored shear force Vu in kN. */
  readonly factoredShearVu?: Kilonewton | number;
  /** Applied factored torsional moment Tu in kNm. */
  readonly factoredTorsionTu?: KilonewtonMeter | number;
  /** Unbraced span length Lb in meters. */
  readonly unbracedLengthLbM: Meter | number;
  /** Total clear span length L in meters (used for deflection check). */
  readonly spanLengthM?: Meter | number;
  /** Deflection serviceability limit key (default: "L_360"). */
  readonly deflectionLimitKey?: DeflectionLimitKey;
  /** Target steel material grade (or undefined to enable Smart Grade Optimizer). */
  readonly steelGrade?: SteelGrade;
  /** Maximum allowable depth H in mm (optional geometric filter). */
  readonly maxDepthMm?: number;
  /** Maximum allowable flange/box width B in mm (optional geometric filter). */
  readonly maxWidthMm?: number;
  /** Target minimum DCR for efficiency highlight (default: 0.90). */
  readonly targetMinDcr?: number;
  /** Optional parametric custom box hollow section generator configuration. */
  readonly customBoxConfig?: CustomBoxOptimizationConfig;
}

/** Complete optimization search deliverable. */
export interface SteelOptimizationResult {
  /** Best overall candidate section (lightest compliant section). */
  readonly bestCandidate: SteelOptimizationCandidate;
  /** Alternative compliant candidates sorted ascending by unit weight. */
  readonly compliantCandidates: readonly SteelOptimizationCandidate[];
  /** Profile type evaluated. */
  readonly profileType: SteelProfileType;
  /** Number of catalog entries evaluated. */
  readonly evaluatedCount: number;
}

/**
 * Generates a sorted catalog of custom parametric hollow box sections (`BoxSectionProperties`)
 * across user-defined depth `H`, width `B`, and wall thickness `t` intervals.
 *
 * Enforces SNI 1729:2020 Table B4.1b flat-wall geometry validity (`H > 3*t` and `B > 3*t`)
 * and computes exact section properties (`A`, `W`, `Ix`, `Iy`, `Zx`, `Zy`, `J`, `C`).
 *
 * @param config Parametric generation bounds and step intervals.
 * @returns Read-only array of `BoxSectionProperties` sorted ascending by strong-axis `Zx`.
 * @example
 * const customCatalog = generateCustomBoxCatalog({
 *   enabled: true,
 *   hMinMm: 200,
 *   hMaxMm: 300,
 *   bMinMm: 200,
 *   bMaxMm: 300,
 *   dimensionStepMm: 50,
 *   tMinMm: 20,
 *   tMaxMm: 35,
 *   thicknessStepMm: 5,
 *   shapeRule: "ALL",
 * });
 */
export function generateCustomBoxCatalog(
  config: CustomBoxOptimizationConfig,
): readonly BoxSectionProperties[] {
  const sections: BoxSectionProperties[] = [];
  const stepDim = Math.max(10, Math.round(Number(config.dimensionStepMm) || 50));
  const rawStepT = Number(config.thicknessStepMm);
  const stepT = Number.isFinite(rawStepT) && rawStepT >= 0.5 ? rawStepT : 5;

  const hMin = Math.max(60, Math.round(Number(config.hMinMm) || 200));
  const hMax = Math.max(hMin, Math.round(Number(config.hMaxMm) || 600));
  const bMin = Math.max(60, Math.round(Number(config.bMinMm) || 200));
  const bMax = Math.max(bMin, Math.round(Number(config.bMaxMm) || 600));

  const tMin = Math.max(2, Number(config.tMinMm) || 20);
  const tMax = Math.max(tMin, Number(config.tMaxMm) || 35);

  for (let H = hMin; H <= hMax; H += stepDim) {
    for (let B = bMin; B <= bMax; B += stepDim) {
      if (config.shapeRule === "SQUARE_ONLY" && H !== B) {
        continue;
      }
      if (config.shapeRule === "RECTANGULAR_ONLY" && H === B) {
        continue;
      }

      for (let rawT = tMin; rawT <= tMax + 1e-6; rawT += stepT) {
        if (sections.length >= MAX_CUSTOM_BOX_COMBINATIONS) {
          break;
        }

        const t = Number(rawT.toFixed(2));
        // SNI 1729 Table B4.1b flat-wall requirement: clear flat width H - 3t > 0 and B - 3t > 0
        if (H <= 3 * t || B <= 3 * t) {
          continue;
        }

        const isSquare = H === B;
        const name = `BOX ${H} x ${B} x ${t} (Custom)`;
        try {
          const props = computeBoxSectionProperties({
            name,
            H: millimeter(H),
            B: millimeter(B),
            t: millimeter(t),
            shapeType: isSquare ? "SQUARE" : "RECTANGULAR",
          });
          sections.push({
            ...props,
            isCustomGenerated: true,
          });
        } catch {
          // Skip physically invalid combinations
        }
      }
    }
  }

  return sections.sort((a, b) => Number(a.Zx) - Number(b.Zx));
}

/**
 * Searches the sorted structural steel catalogs (or the Parametric Custom Box Generator when enabled)
 * and determines the most material-efficient compliant section matching load demands
 * (Pu, Mux, Muy, Vu, Tu) per SNI 1729:2020.
 *
 * Candidates satisfying `governingDcr <= 1.0` and deflection limits are sorted primarily
 * by `unitWeightKgPerM` ascending (lightest & most economical section wins).
 *
 * @param input Loads, span length, steel grade, geometric filters, and optional custom box config.
 * @returns Complete SteelOptimizationResult with bestCandidate and compliant alternatives.
 * @throws {SteelDesignError} When no compliant section can be found within catalog bounds.
 * @example
 * const res = optimizeSteelSection({
 *   profileType: "BOX",
 *   factoredMomentMux: kilonewtonMeter(350),
 *   factoredShearVu: kilonewton(140),
 *   unbracedLengthLbM: meter(6.0),
 *   steelGrade: "BJ_41",
 *   customBoxConfig: {
 *     enabled: true,
 *     hMinMm: 200,
 *     hMaxMm: 600,
 *     bMinMm: 200,
 *     bMaxMm: 600,
 *     dimensionStepMm: 50,
 *     tMinMm: 20,
 *     tMaxMm: 35,
 *     thicknessStepMm: 5,
 *     shapeRule: "ALL",
 *   },
 * });
 */
export function optimizeSteelSection(input: SteelOptimizerInput): SteelOptimizationResult {
  const pu = Number(input.factoredAxialPu ?? 0);
  const mux = Math.abs(Number(input.factoredMomentMux));
  const muy = Math.abs(Number(input.factoredMomentMuy ?? 0));
  const vu = Math.abs(Number(input.factoredShearVu ?? 0));
  const tu = Math.abs(Number(input.factoredTorsionTu ?? 0));
  const lbMm = Number(input.unbracedLengthLbM) * 1000;

  if (!Number.isFinite(lbMm) || lbMm <= 0) {
    throw new SteelDesignError(
      "UNKNOWN",
      "optimizeSteelSection",
      `Unbraced length Lb must be strictly positive. Received: ${lbMm / 1000} m.`,
    );
  }

  const selectedProfileType: SteelProfileType = input.profileType === "BOX" ? "BOX" : "IWF";
  const isCustomBoxActive =
    selectedProfileType === "BOX" && Boolean(input.customBoxConfig?.enabled);

  const catalog: readonly SteelSectionProperties[] =
    selectedProfileType === "BOX"
      ? isCustomBoxActive && input.customBoxConfig
        ? generateCustomBoxCatalog(input.customBoxConfig)
        : SORTED_BOX_CATALOG
      : SORTED_IWF_CATALOG;

  if (catalog.length === 0) {
    throw new SteelDesignError(
      "CUSTOM_BOX_EMPTY",
      "optimizeSteelSection",
      "Generator BOX Custom tidak menghasilkan penampang yang memenuhi syarat geometri dasar SNI 1729 (H > 3t dan B > 3t). Perbesar nilai Hmax/Bmax atau kurangi tebal tmin.",
    );
  }

  const gradesToEvaluate: SteelGradeProperties[] = input.steelGrade
    ? [STEEL_GRADES_CATALOG[input.steelGrade]]
    : [
        STEEL_GRADES_CATALOG.BJ_37,
        STEEL_GRADES_CATALOG.BJ_41,
        STEEL_GRADES_CATALOG.BJ_50,
        STEEL_GRADES_CATALOG.BJ_55,
      ];

  const targetMinDcr = input.targetMinDcr ?? 0.9;
  const compliantCandidates: SteelOptimizationCandidate[] = [];
  let evaluatedCount = 0;

  for (const grade of gradesToEvaluate) {
    const fy = Number(grade.fy);
    const e = Number(grade.E);

    // Initial estimation of required plastic modulus Zx_req ~ Mux / (0.90 * Fy)
    const zxReqMm3 = (mux * 1e6) / (0.9 * fy);

    // Binary search lower bound index where catalog Zx >= 0.70 * zxReqMm3
    let low = 0;
    let high = catalog.length - 1;
    let startIndex = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const midItem = catalog[mid];
      if (midItem && Number(midItem.Zx) >= 0.7 * zxReqMm3) {
        startIndex = mid;
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    // Scan from binary search starting index to end of catalog
    for (let i = startIndex; i < catalog.length; i++) {
      const section = catalog[i];
      if (!section) {
        continue;
      }
      evaluatedCount++;

      // Geometric dimensional filtering (H_max, B_max)
      const depthH = Number(section.H ?? section.h0);
      if (input.maxDepthMm && depthH > input.maxDepthMm) {
        continue;
      }
      const widthB = Number(section.B ?? 0);
      if (input.maxWidthMm && widthB > 0 && widthB > input.maxWidthMm) {
        continue;
      }

      // 1. Compactness classification (Table B4.1b)
      const compactness = classifySectionCompactness(section, fy, e);

      // 2. Lateral-Torsional Buckling (Chapter F)
      const ltb = solveLateralTorsionalBuckling(section, fy, lbMm, {
        modulusOfElasticityE: e,
      });

      // 3. Weak-axis bending capacity phi_b * Mny (Pasal F6 or F7)
      const mnyKnm = (fy * Number(section.Zy)) / 1e6;
      const phiMnyKnm = 0.9 * mnyKnm;

      // 4. Axial capacity phi_c * Pn (nominal approximation phi_c * Ag * Fy)
      const agMm2 = Number(section.area);
      const phiPnKn = (0.9 * agMm2 * fy) / 1000;

      // 5. Chapter H1 Biaxial Interaction
      const interaction = evaluateBiaxialInteraction({
        profileName: section.name,
        factoredAxialPu: kilonewton(pu),
        factoredMomentMux: kilonewtonMeter(mux),
        factoredMomentMuy: kilonewtonMeter(muy),
        designAxialPhiPn: kilonewton(phiPnKn),
        designFlexuralPhiMnx: ltb.designFlexuralPhiMn,
        designFlexuralPhiMny: kilonewtonMeter(phiMnyKnm),
      });

      // 6. Chapter G Shear evaluation
      const shear = evaluateSteelShear(section, fy, vu, e);

      // 7. Chapter H3 Torsion evaluation
      const torsion = evaluateSteelTorsion(
        section,
        fy,
        tu,
        Number(interaction.interactionValue),
        Number(shear.shearDcr),
        e,
      );

      // 8. Serviceability Deflection check (if spanLengthM is provided)
      let deflectionCompliant = true;
      if (input.spanLengthM && Number(input.spanLengthM) > 0) {
        const spanM = meter(Number(input.spanLengthM));
        const lMm = Number(spanM) * 1000;
        const ixMm4 = Number(section.Ix);
        const deltaMm = (5.0 * (mux * 1e6) * lMm * lMm) / (48.0 * e * ixMm4);
        const deflEval = evaluateDeflectionCompliance(
          -deltaMm,
          spanM,
          input.deflectionLimitKey ?? "L_360",
        );
        if (!deflEval.isCompliant) {
          deflectionCompliant = false;
        }
      }

      const governingDcrValue = Math.max(
        Number(interaction.interactionValue),
        Number(shear.shearDcr),
        Number(torsion.combinedH3Dcr),
      );

      if (governingDcrValue <= 1.0 && deflectionCompliant) {
        const status: "OPTIMAL" | "ACCEPTABLE" =
          governingDcrValue >= targetMinDcr && governingDcrValue <= 1.0 ? "OPTIMAL" : "ACCEPTABLE";

        compliantCandidates.push({
          properties: section,
          grade,
          compactness,
          ltb,
          interaction,
          governingDcr: utilizationRatio(Number(governingDcrValue.toFixed(3))),
          status,
        });
      }
    }
  }

  if (compliantCandidates.length === 0) {
    const sourceLabel = isCustomBoxActive
      ? `Generator BOX Custom (H=${input.customBoxConfig?.hMinMm}–${input.customBoxConfig?.hMaxMm} mm, B=${input.customBoxConfig?.bMinMm}–${input.customBoxConfig?.bMaxMm} mm, t=${input.customBoxConfig?.tMinMm}–${input.customBoxConfig?.tMaxMm} mm)`
      : `katalog standar ${selectedProfileType}`;

    throw new SteelDesignError(
      "CATALOG_EXHAUSTED",
      "optimizeSteelSection",
      `Tidak ditemukan profil baja pada ${sourceLabel} (${input.steelGrade ?? "Multi-Grade"}) yang mampu menahan kombinasi beban (Mux=${mux.toFixed(1)} kNm, Muy=${muy.toFixed(1)} kNm, Vu=${vu.toFixed(1)} kN, Pu=${pu.toFixed(1)} kN, Tu=${tu.toFixed(1)} kNm pada Lb=${(lbMm / 1000).toFixed(2)} m). Silakan perbesar batas dimensi Hmax/Bmax, aktifkan Generator BOX Custom (t=20–35 mm), atau naikkan mutu baja ke BJ 50 / BJ 55.`,
    );
  }

  // Sort candidates primarily by lightest unit weight (kg/m ascending),
  // breaking ties by higher governing DCR (closer to 1.0).
  compliantCandidates.sort((a, b) => {
    const weightDiff = a.properties.unitWeightKgPerM - b.properties.unitWeightKgPerM;
    if (Math.abs(weightDiff) > 1e-6) {
      return weightDiff;
    }
    return Number(b.governingDcr) - Number(a.governingDcr);
  });

  // Mark the lightest compliant candidate as OPTIMAL so the top recommendation is always highlighted
  const lightestCandidate = compliantCandidates[0]!;
  if (lightestCandidate.status !== "OPTIMAL") {
    compliantCandidates[0] = {
      ...lightestCandidate,
      status: "OPTIMAL",
    };
  }

  return {
    bestCandidate: compliantCandidates[0]!,
    compliantCandidates,
    profileType: selectedProfileType,
    evaluatedCount,
  };
}
```

================================================================================
FILE 3: src/state/beam-simulator-store.ts
================================================================================

```ts
/**
 * @file beam-simulator-store.ts
 * @description Central reactive state store for the beam deflection and design simulator.
 * Built using React's useSyncExternalStore pattern for zero-dependency, ultra-fast,
 * and flicker-free updates across 60 FPS slider interactions.
 */

import { useSyncExternalStore } from "react";

import type {
  BeamMaterialKind,
  ConcreteViewMode,
} from "@/components/canvas/Beam3DExtrudedViewport";
import type { SteelOptimizationResult } from "@/core/steel/steel-section-optimizer";
import type { DistributedLoad, PointLoad, SupportOrientation } from "@/types/beam-loading-modes";
import type {
  CoordinateSystemMode,
  Kilonewton,
  KilonewtonMeter,
  KilonewtonPerMeter,
  Megapascal,
  Meter,
  Millimeter,
  Vector3D,
} from "@/types/branded-units";
import type {
  ConcreteCubeGrade,
  ConcreteOptimizationResult,
  RebarSteelGrade,
} from "@/types/concrete-sni2847-types";
import type {
  CustomBoxOptimizationConfig,
  SteelGrade,
  SteelProfileType,
} from "@/types/steel-sni1729-types";

/**
 * Supported 2D internal force diagram display layouts.
 */
export type DiagramDisplayMode = "IN_PLACE_BEAM_AXIS" | "STACKED_VERTICAL" | "FLOATING_WINDOW";

/**
 * Diagram layer visibility flags.
 */
export interface DiagramVisibilityFlags {
  readonly sfd: boolean;
  readonly bmd: boolean;
  readonly nfd: boolean;
  readonly tfd: boolean;
}

/**
 * Evaluated governing internal forces across the beam span.
 */
export interface GoverningInternalForces {
  readonly maxPositiveMux: number;
  readonly maxNegativeMux: number;
  readonly absoluteMaxMux: number;
  readonly absoluteMaxMuy: number;
  readonly absoluteMaxVu: number;
  readonly absoluteMaxPu: number;
  readonly absoluteMaxTu: number;
}

/**
 * Complete immutable simulator state tree.
 */
export interface BeamSimulatorState {
  /** Active material family. */
  readonly materialKind: BeamMaterialKind;
  /** Active loading calculation paradigm (Mode A vs Mode B). */
  readonly loadingMode: "MODE_A_EXTERNAL_LOADS" | "MODE_B_DIRECT_INTERNAL_FORCES";

  // Mode A: Interactive External Loads
  readonly spanLengthM: Meter;
  readonly supportOrientation: SupportOrientation;
  readonly includeSelfWeight: boolean;
  readonly pointLoads: readonly PointLoad[];
  readonly distributedLoads: readonly DistributedLoad[];

  // Mode B: Direct Factored Internal Forces
  readonly directSpanLengthM: Meter;
  readonly directAxialPuKn: Kilonewton;
  readonly directMomentMuxKnm: KilonewtonMeter;
  readonly directMomentMuyKnm: KilonewtonMeter;
  readonly directTorsionTuKnm: KilonewtonMeter;
  readonly directShearVuKn: Kilonewton;

  // Concrete design parameters (SNI 2847:2019)
  readonly concreteBwMm: Millimeter;
  readonly concreteHMm: Millimeter;
  readonly concreteCoverMm: Millimeter;
  readonly concreteFcMpa: Megapascal;
  readonly concreteCubeGrade: ConcreteCubeGrade | null;
  readonly longitudinalRebarGrade: RebarSteelGrade;
  readonly stirrupRebarGrade: RebarSteelGrade;
  readonly maxAggregateSizeMm: number;
  readonly concreteViewMode: ConcreteViewMode;

  // Steel design parameters (SNI 1729:2020)
  readonly steelProfileType: SteelProfileType;
  readonly steelGrade: SteelGrade;
  readonly steelUnbracedLengthLbM: Meter;
  readonly steelMaxHeightMm: Millimeter | undefined;
  readonly steelMaxWidthMm: Millimeter | undefined;
  readonly selectedSteelProfileName: string | null;
  readonly customBoxConfig: CustomBoxOptimizationConfig;

  // Visual & Canvas Preferences
  readonly coordinateMode: CoordinateSystemMode;
  readonly customUpVector: Vector3D;
  readonly diagramDisplayMode: DiagramDisplayMode;
  readonly visibleDiagrams: DiagramVisibilityFlags;
  readonly deflectionLimitDenominator: 180 | 240 | 360 | 480;

  // Solver Engine Computed Outputs
  readonly isSolving: boolean;
  readonly solverRevision: number;
  readonly solverError: string | null;
  readonly maxDeflectionMm: number;
  readonly maxDeflectionStationM: number;
  readonly governingForces: GoverningInternalForces;
  readonly concreteOptimizationResult: ConcreteOptimizationResult | null;
  readonly steelOptimizationResult: SteelOptimizationResult | null;
}

/** Initial default state satisfying civil engineering best practices. */
const INITIAL_STATE: BeamSimulatorState = {
  materialKind: "STEEL",
  loadingMode: "MODE_A_EXTERNAL_LOADS",

  spanLengthM: 6.0 as Meter,
  supportOrientation: "PINNED_ROLLER",
  includeSelfWeight: false,
  pointLoads: [
    {
      id: "P1",
      magnitude: 50 as Kilonewton,
      position: 3.0 as Meter,
    },
  ],
  distributedLoads: [
    {
      id: "Q1",
      magnitude: 15 as KilonewtonPerMeter,
      startPosition: 0 as Meter,
      endPosition: 6.0 as Meter,
    },
  ],

  directSpanLengthM: 6.0 as Meter,
  directAxialPuKn: 0 as Kilonewton,
  directMomentMuxKnm: 120 as KilonewtonMeter,
  directMomentMuyKnm: 0 as KilonewtonMeter,
  directTorsionTuKnm: 0 as KilonewtonMeter,
  directShearVuKn: 80 as Kilonewton,

  concreteBwMm: 300 as Millimeter,
  concreteHMm: 500 as Millimeter,
  concreteCoverMm: 40 as Millimeter,
  concreteFcMpa: 25 as Megapascal,
  concreteCubeGrade: null,
  longitudinalRebarGrade: "BJTS_40",
  stirrupRebarGrade: "BJTP_24",
  maxAggregateSizeMm: 20,
  concreteViewMode: "SOLID_WITH_END_SECTION",

  steelProfileType: "IWF",
  steelGrade: "BJ_37",
  steelUnbracedLengthLbM: 6.0 as Meter,
  steelMaxHeightMm: undefined,
  steelMaxWidthMm: undefined,
  selectedSteelProfileName: null,
  customBoxConfig: {
    enabled: false,
    hMinMm: 200,
    hMaxMm: 600,
    bMinMm: 200,
    bMaxMm: 600,
    dimensionStepMm: 50,
    tMinMm: 20,
    tMaxMm: 35,
    thicknessStepMm: 5,
    shapeRule: "ALL",
  },

  coordinateMode: "Z-Up",
  customUpVector: { x: 0, y: 0, z: 1 },
  diagramDisplayMode: "IN_PLACE_BEAM_AXIS",
  visibleDiagrams: { sfd: true, bmd: true, nfd: false, tfd: false },
  deflectionLimitDenominator: 360,

  isSolving: false,
  solverRevision: 0,
  solverError: null,
  maxDeflectionMm: 0,
  maxDeflectionStationM: 0,
  governingForces: {
    maxPositiveMux: 0,
    maxNegativeMux: 0,
    absoluteMaxMux: 0,
    absoluteMaxMuy: 0,
    absoluteMaxVu: 0,
    absoluteMaxPu: 0,
    absoluteMaxTu: 0,
  },
  concreteOptimizationResult: null,
  steelOptimizationResult: null,
};

// Subscriber listeners
let currentState = INITIAL_STATE;
const listeners = new Set<() => void>();

/**
 * Notifies all subscribed React components of a state transition.
 */
function emitChange(): void {
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Setter and mutation actions exposed by the simulator store.
 */
export const beamSimulatorActions = {
  setMaterialKind(materialKind: BeamMaterialKind): void {
    currentState = { ...currentState, materialKind };
    emitChange();
  },

  setLoadingMode(loadingMode: "MODE_A_EXTERNAL_LOADS" | "MODE_B_DIRECT_INTERNAL_FORCES"): void {
    currentState = { ...currentState, loadingMode };
    emitChange();
  },

  setSpanLength(spanLengthM: number): void {
    if (spanLengthM > 0 && Number.isFinite(spanLengthM)) {
      currentState = { ...currentState, spanLengthM: spanLengthM as Meter };
      emitChange();
    }
  },

  setSupportOrientation(supportOrientation: SupportOrientation): void {
    currentState = { ...currentState, supportOrientation };
    emitChange();
  },

  setIncludeSelfWeight(includeSelfWeight: boolean): void {
    currentState = { ...currentState, includeSelfWeight };
    emitChange();
  },

  setPointLoads(pointLoads: readonly PointLoad[]): void {
    currentState = { ...currentState, pointLoads };
    emitChange();
  },

  setDistributedLoads(distributedLoads: readonly DistributedLoad[]): void {
    currentState = { ...currentState, distributedLoads };
    emitChange();
  },

  /**
   * Updates Mode B direct internal forces and automatically activates
   * `MODE_B_DIRECT_INTERNAL_FORCES` so the solver engine responds immediately.
   *
   * @param forces Partial set of direct factored internal forces and span length.
   */
  setDirectForces(forces: {
    spanLengthM?: number;
    axialPuKn?: number;
    momentMuxKnm?: number;
    momentMuyKnm?: number;
    torsionTuKnm?: number;
    shearVuKn?: number;
  }): void {
    currentState = {
      ...currentState,
      loadingMode: "MODE_B_DIRECT_INTERNAL_FORCES",
      directSpanLengthM:
        forces.spanLengthM !== undefined
          ? (forces.spanLengthM as Meter)
          : currentState.directSpanLengthM,
      directAxialPuKn:
        forces.axialPuKn !== undefined
          ? (forces.axialPuKn as Kilonewton)
          : currentState.directAxialPuKn,
      directMomentMuxKnm:
        forces.momentMuxKnm !== undefined
          ? (forces.momentMuxKnm as KilonewtonMeter)
          : currentState.directMomentMuxKnm,
      directMomentMuyKnm:
        forces.momentMuyKnm !== undefined
          ? (forces.momentMuyKnm as KilonewtonMeter)
          : currentState.directMomentMuyKnm,
      directTorsionTuKnm:
        forces.torsionTuKnm !== undefined
          ? (forces.torsionTuKnm as KilonewtonMeter)
          : currentState.directTorsionTuKnm,
      directShearVuKn:
        forces.shearVuKn !== undefined
          ? (forces.shearVuKn as Kilonewton)
          : currentState.directShearVuKn,
    };
    emitChange();
  },

  setConcreteParameters(params: {
    bwMm?: number;
    hMm?: number;
    coverMm?: number;
    fcMpa?: number;
    cubeGrade?: ConcreteCubeGrade | null;
    longitudinalGrade?: RebarSteelGrade;
    stirrupGrade?: RebarSteelGrade;
    maxAggregateMm?: number;
  }): void {
    currentState = {
      ...currentState,
      concreteBwMm:
        params.bwMm !== undefined ? (params.bwMm as Millimeter) : currentState.concreteBwMm,
      concreteHMm: params.hMm !== undefined ? (params.hMm as Millimeter) : currentState.concreteHMm,
      concreteCoverMm:
        params.coverMm !== undefined
          ? (params.coverMm as Millimeter)
          : currentState.concreteCoverMm,
      concreteFcMpa:
        params.fcMpa !== undefined ? (params.fcMpa as Megapascal) : currentState.concreteFcMpa,
      concreteCubeGrade:
        params.cubeGrade !== undefined ? params.cubeGrade : currentState.concreteCubeGrade,
      longitudinalRebarGrade: params.longitudinalGrade ?? currentState.longitudinalRebarGrade,
      stirrupRebarGrade: params.stirrupGrade ?? currentState.stirrupRebarGrade,
      maxAggregateSizeMm: params.maxAggregateMm ?? currentState.maxAggregateSizeMm,
    };
    emitChange();
  },

  setConcreteViewMode(concreteViewMode: ConcreteViewMode): void {
    currentState = { ...currentState, concreteViewMode };
    emitChange();
  },

  /**
   * Updates structural steel design parameters, including optional parametric
   * custom hollow box generator settings (`customBoxConfig`).
   *
   * @param params Partial steel design and custom box parameters.
   */
  setSteelParameters(params: {
    profileType?: SteelProfileType;
    grade?: SteelGrade;
    unbracedLengthLbM?: number;
    maxHeightMm?: number;
    maxWidthMm?: number;
    selectedProfileName?: string | null;
    customBoxConfig?: Partial<CustomBoxOptimizationConfig>;
  }): void {
    const nextProfileType = params.profileType ?? currentState.steelProfileType;
    const profileTypeChanged = nextProfileType !== currentState.steelProfileType;
    const customBoxChanged = params.customBoxConfig !== undefined;

    currentState = {
      ...currentState,
      steelProfileType: nextProfileType,
      steelGrade: params.grade ?? currentState.steelGrade,
      steelUnbracedLengthLbM:
        params.unbracedLengthLbM !== undefined
          ? (params.unbracedLengthLbM as Meter)
          : currentState.steelUnbracedLengthLbM,
      steelMaxHeightMm:
        "maxHeightMm" in params
          ? params.maxHeightMm !== undefined
            ? (params.maxHeightMm as Millimeter)
            : undefined
          : currentState.steelMaxHeightMm,
      steelMaxWidthMm:
        "maxWidthMm" in params
          ? params.maxWidthMm !== undefined
            ? (params.maxWidthMm as Millimeter)
            : undefined
          : currentState.steelMaxWidthMm,
      customBoxConfig: params.customBoxConfig
        ? { ...currentState.customBoxConfig, ...params.customBoxConfig }
        : currentState.customBoxConfig,
      selectedSteelProfileName:
        params.selectedProfileName !== undefined
          ? params.selectedProfileName
          : profileTypeChanged || customBoxChanged
            ? null
            : currentState.selectedSteelProfileName,
    };
    emitChange();
  },

  setCoordinateMode(coordinateMode: CoordinateSystemMode, customUpVector?: Vector3D): void {
    currentState = {
      ...currentState,
      coordinateMode,
      customUpVector: customUpVector ?? currentState.customUpVector,
    };
    emitChange();
  },

  setDiagramDisplayMode(diagramDisplayMode: DiagramDisplayMode): void {
    currentState = { ...currentState, diagramDisplayMode };
    emitChange();
  },

  toggleDiagramVisibility(diagram: keyof DiagramVisibilityFlags): void {
    currentState = {
      ...currentState,
      visibleDiagrams: {
        ...currentState.visibleDiagrams,
        [diagram]: !currentState.visibleDiagrams[diagram],
      },
    };
    emitChange();
  },

  setDeflectionLimitDenominator(denominator: 180 | 240 | 360 | 480): void {
    currentState = { ...currentState, deflectionLimitDenominator: denominator };
    emitChange();
  },

  setSolverResults(results: {
    maxDeflectionMm: number;
    maxDeflectionStationM: number;
    governingForces: GoverningInternalForces;
    concreteOptimizationResult: ConcreteOptimizationResult | null;
    steelOptimizationResult: SteelOptimizationResult | null;
    solverError?: string | null;
  }): void {
    currentState = {
      ...currentState,
      isSolving: false,
      solverRevision: currentState.solverRevision + 1,
      solverError: results.solverError ?? null,
      maxDeflectionMm: results.maxDeflectionMm,
      maxDeflectionStationM: results.maxDeflectionStationM,
      governingForces: results.governingForces,
      concreteOptimizationResult: results.concreteOptimizationResult,
      steelOptimizationResult: results.steelOptimizationResult,
    };
    emitChange();
  },

  /**
   * Records a solver or design optimization error message so UI components
   * can alert the engineer immediately.
   *
   * @param error Diagnostic error message string.
   */
  setSolverError(error: string): void {
    currentState = {
      ...currentState,
      isSolving: false,
      solverRevision: currentState.solverRevision + 1,
      solverError: error,
    };
    emitChange();
  },

  setIsSolving(isSolving: boolean): void {
    currentState = { ...currentState, isSolving };
    emitChange();
  },
};

/**
 * Direct non-reactive getter for the current simulator state snapshot.
 * Useful for non-React callers, exporters, and automated test suites.
 *
 * @returns Current immutable `BeamSimulatorState`.
 */
export function getBeamSimulatorSnapshot(): BeamSimulatorState {
  return currentState;
}

/**
 * React hook to subscribe to the Beam Simulator state.
 * @returns Current immutable BeamSimulatorState snapshot.
 * @example
 * const { materialKind, spanLengthM } = useBeamSimulatorStore();
 */
export function useBeamSimulatorStore(): BeamSimulatorState {
  return useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    () => currentState,
    () => INITIAL_STATE,
  );
}

useBeamSimulatorStore.getState = getBeamSimulatorSnapshot;
```

================================================================================
FILE 4: src/hooks/use-structural-solver-engine.ts
================================================================================

```ts
/**
 * @file use-structural-solver-engine.ts
 * @description Master reactive hook linking simulator store inputs to the Rust WASM
 * mechanics engine and TypeScript SNI 2847 (Concrete) & SNI 1729 (Steel) optimizers.
 * Provides zero-copy 3D mesh views and diagram station arrays for both Mode A and Mode B.
 */

"use client";

import { useEffect, useState } from "react";

import {
  type DeflectionEvaluationResult,
  evaluateDeflectionCompliance,
} from "@/config/deflection-limits-config";
import { convertCubeToCylinderMpa } from "@/core/concrete/concrete-grade-converter";
import { optimizeConcreteSection } from "@/core/concrete/concrete-section-optimizer";
import { interpolateModeBInternalForces } from "@/core/mechanics/direct-internal-force-interpolator";
import {
  type ExtrusionCrossSectionInput,
  solveEulerBernoulliDeflection,
} from "@/core/mechanics/euler-bernoulli-deflection-solver";
import {
  getZeroCopyStationViews,
  type ZeroCopyMesh3DViews,
  type ZeroCopyRebarCage3DViews,
  type ZeroCopyStationViews,
} from "@/core/mechanics/wasm-mechanics-bridge";
import type { SteelOptimizationResult } from "@/core/steel/steel-section-optimizer";
import { optimizeSteelSection } from "@/core/steel/steel-section-optimizer";
import {
  beamSimulatorActions,
  type GoverningInternalForces,
  useBeamSimulatorStore,
} from "@/state/beam-simulator-store";
import type { ExternalLoadsModeAConfig } from "@/types/beam-loading-modes";
import { kilonewton, kilonewtonMeter, meter } from "@/types/branded-units";
import type { ConcreteOptimizationResult } from "@/types/concrete-sni2847-types";
import type { SteelProfileType, SteelSectionProperties } from "@/types/steel-sni1729-types";

/**
 * Result bundle returned by `useStructuralSolverEngine`.
 */
export interface StructuralSolverEngineResult {
  readonly isSolving: boolean;
  readonly solverRevision: number;
  readonly solverError: string | null;
  readonly meshViews: ZeroCopyMesh3DViews | null;
  readonly rebarCageViews: ZeroCopyRebarCage3DViews | null;
  readonly stationViews: ZeroCopyStationViews | null;
  readonly maxDeflectionMm: number;
  readonly maxDeflectionStationM: number;
  readonly governingForces: GoverningInternalForces;
  readonly concreteResult: ConcreteOptimizationResult | null;
  readonly steelResult: SteelOptimizationResult | null;
  readonly compliance: DeflectionEvaluationResult | null;
}

/**
 * Builds a 3D extrusion cross-section input from a steel section's primary dimensions,
 * or falls back to default dimensions if no section is available.
 *
 * @param profileType Active steel profile type ("IWF" or "BOX").
 * @param props Optional steel section properties from catalog or parametric optimization.
 * @returns Extrusion cross-section input for the Rust WASM 3D mesh generator.
 */
function buildSteelExtrusionCrossSection(
  profileType: SteelProfileType,
  props?: SteelSectionProperties,
): ExtrusionCrossSectionInput {
  if (profileType === "BOX") {
    const hMm = props ? Number(props.H) : 200;
    const bMm = props ? Number(props.B) : 200;
    const tMm = props ? Number(props.t ?? props.tw) : 8;
    return {
      kind: "BOX",
      hMm,
      bMm,
      tMm,
    };
  }

  const dMm = props ? Number(props.H) : 300;
  const bfMm = props ? Number(props.B) : 150;
  const twMm = props ? Number(props.tw) : 6.5;
  const tfMm = props ? Number(props.tf) : 9.0;
  const rMm = props ? Number(props.r ?? 13.0) : 13.0;
  return {
    kind: "IWF",
    dMm,
    bfMm,
    twMm,
    tfMm,
    rMm,
  };
}

/**
 * Core reactive engine hook that synchronizes Mode A / Mode B structural mechanics,
 * SNI 1729 / SNI 2847 section optimization (including custom parametric BOX sections),
 * 3D WebGL extrusion meshes, and 256-station diagrams.
 *
 * @returns Reactive solver outputs, 3D mesh views, diagram views, and compliance status.
 * @example
 * const { meshViews, stationViews, steelResult, solverError } = useStructuralSolverEngine();
 */
export function useStructuralSolverEngine(): StructuralSolverEngineResult {
  const store = useBeamSimulatorStore();

  const [meshViews, setMeshViews] = useState<ZeroCopyMesh3DViews | null>(null);
  const [rebarCageViews, setRebarCageViews] = useState<ZeroCopyRebarCage3DViews | null>(null);
  const [stationViews, setStationViews] = useState<ZeroCopyStationViews | null>(null);
  const [compliance, setCompliance] = useState<DeflectionEvaluationResult | null>(null);

  useEffect(() => {
    try {
      beamSimulatorActions.setIsSolving(true);

      const isSteel = store.materialKind === "STEEL";
      const isModeA = store.loadingMode === "MODE_A_EXTERNAL_LOADS";
      const limitKey = `L_${store.deflectionLimitDenominator}` as const;

      // 1. Resolve initial Elastic Modulus (E) & Moment of Inertia (I)
      let E_Mpa = 200_000;
      let I_Mm4 = 100_000_000;

      const fcVal = store.concreteCubeGrade
        ? Number(convertCubeToCylinderMpa(store.concreteCubeGrade))
        : Number(store.concreteFcMpa);

      if (!isSteel) {
        E_Mpa = 4700 * Math.sqrt(Math.max(fcVal, 17));
        const bw = Number(store.concreteBwMm);
        const h = Number(store.concreteHMm);
        I_Mm4 = (bw * h ** 3) / 12;
      }

      const activeSpanM = isModeA
        ? Math.max(0.1, Number(store.spanLengthM))
        : Math.max(0.1, Number(store.directSpanLengthM));

      const effectiveLbM =
        Number(store.steelUnbracedLengthLbM) > 0
          ? Number(store.steelUnbracedLengthLbM)
          : activeSpanM;

      let maxDefl = 0;
      let maxDeflStation = 0;
      let govForces: GoverningInternalForces = {
        maxPositiveMux: 0,
        maxNegativeMux: 0,
        absoluteMaxMux: 0,
        absoluteMaxMuy: 0,
        absoluteMaxVu: 0,
        absoluteMaxPu: 0,
        absoluteMaxTu: 0,
      };

      let concOptResult: ConcreteOptimizationResult | null = null;
      let steelOptResult: SteelOptimizationResult | null = null;
      let optimizationErrorMsg: string | null = null;

      if (isModeA) {
        const modeAConfig: ExternalLoadsModeAConfig = {
          mode: "MODE_A_EXTERNAL_LOADS",
          spanLength: store.spanLengthM,
          supportOrientation: store.supportOrientation,
          includeSelfWeight: store.includeSelfWeight,
          pointLoads: store.pointLoads,
          distributedLoads: store.distributedLoads,
          appliedMoments: [],
        };

        // Initial cross-section for reactions & internal force diagram evaluation
        let crossSection: ExtrusionCrossSectionInput = isSteel
          ? buildSteelExtrusionCrossSection(store.steelProfileType)
          : {
              kind: "CONCRETE_RECT",
              bwMm: Number(store.concreteBwMm),
              hMm: Number(store.concreteHMm),
              rebarCage: {
                coverMm: Number(store.concreteCoverMm),
                stirrupDiaMm: 10,
                stirrupSpacingMm: 150,
                tensileBarCount: 4,
                tensileBarDiaMm: 19,
                compressiveBarCount: 2,
                compressiveBarDiaMm: 13,
              },
            };

        const initialSolve = solveEulerBernoulliDeflection({
          loadingConfig: modeAConfig,
          elasticModulusMpa: E_Mpa,
          momentOfInertiaMm4: I_Mm4,
          crossSection,
          visualScale: 15.0,
          coordinateMode: store.coordinateMode,
        });

        govForces = {
          maxPositiveMux: initialSolve.diagrams.maxPositiveMomentKnm,
          maxNegativeMux: initialSolve.diagrams.maxNegativeMomentKnm,
          absoluteMaxMux: Math.max(
            Math.abs(initialSolve.diagrams.maxPositiveMomentKnm),
            Math.abs(initialSolve.diagrams.maxNegativeMomentKnm),
          ),
          absoluteMaxMuy: 0,
          absoluteMaxVu: initialSolve.diagrams.maxShearAbsKn,
          absoluteMaxPu: Math.abs(initialSolve.diagrams.reactions.raAxialKn),
          absoluteMaxTu: 0,
        };

        // Run SNI section optimization using Mode A governing forces
        try {
          if (!isSteel) {
            concOptResult = optimizeConcreteSection({
              factoredMomentMu: kilonewtonMeter(govForces.absoluteMaxMux),
              factoredShearVu: kilonewton(govForces.absoluteMaxVu),
              fc: fcVal,
              spanLengthM: meter(activeSpanM),
              longitudinalRebarGrade: store.longitudinalRebarGrade,
              stirrupRebarGrade: store.stirrupRebarGrade,
              concreteCoverMm: Number(store.concreteCoverMm),
              minBwMm: Number(store.concreteBwMm),
              maxBwMm: Number(store.concreteBwMm) + 100,
              minHMm: Number(store.concreteHMm),
              maxHMm: Number(store.concreteHMm) + 150,
            });
          } else {
            const rawSteelOpt = optimizeSteelSection({
              factoredMomentMux: kilonewtonMeter(govForces.absoluteMaxMux),
              factoredMomentMuy: kilonewtonMeter(0),
              factoredShearVu: kilonewton(govForces.absoluteMaxVu),
              factoredAxialPu: kilonewton(govForces.absoluteMaxPu),
              factoredTorsionTu: kilonewtonMeter(govForces.absoluteMaxTu),
              unbracedLengthLbM: meter(effectiveLbM),
              spanLengthM: meter(activeSpanM),
              deflectionLimitKey: limitKey,
              profileType: store.steelProfileType,
              steelGrade: store.steelGrade,
              maxDepthMm: store.steelMaxHeightMm ? Number(store.steelMaxHeightMm) : undefined,
              maxWidthMm: store.steelMaxWidthMm ? Number(store.steelMaxWidthMm) : undefined,
              customBoxConfig: store.customBoxConfig,
            });

            const userCandidate = store.selectedSteelProfileName
              ? rawSteelOpt.compliantCandidates.find(
                  (c) => c.properties.name === store.selectedSteelProfileName,
                )
              : undefined;

            const activeCandidate = userCandidate ?? rawSteelOpt.bestCandidate;
            steelOptResult = userCandidate
              ? { ...rawSteelOpt, bestCandidate: userCandidate }
              : rawSteelOpt;

            E_Mpa = Number(activeCandidate.grade.E);
            I_Mm4 = Number(activeCandidate.properties.Ix);
            crossSection = buildSteelExtrusionCrossSection(
              store.steelProfileType,
              activeCandidate.properties,
            );
          }
        } catch (optErr) {
          optimizationErrorMsg = optErr instanceof Error ? optErr.message : String(optErr);
        }

        // Re-solve deflection & 3D mesh with exact section stiffness (Ix) and geometry
        const finalSolve = solveEulerBernoulliDeflection({
          loadingConfig: modeAConfig,
          elasticModulusMpa: E_Mpa,
          momentOfInertiaMm4: I_Mm4,
          crossSection,
          visualScale: 15.0,
          coordinateMode: store.coordinateMode,
        });

        maxDefl = finalSolve.maxDeflectionMm;
        maxDeflStation = finalSolve.maxDeflectionStationM;

        setMeshViews(finalSolve.mesh3D);
        setRebarCageViews(finalSolve.rebarCage3D);
        setStationViews(getZeroCopyStationViews());
      } else {
        // Mode B: Direct Factored Internal Forces
        govForces = {
          maxPositiveMux: Math.max(0, Number(store.directMomentMuxKnm)),
          maxNegativeMux: Math.min(0, Number(store.directMomentMuxKnm)),
          absoluteMaxMux: Math.abs(Number(store.directMomentMuxKnm)),
          absoluteMaxMuy: Math.abs(Number(store.directMomentMuyKnm)),
          absoluteMaxVu: Math.abs(Number(store.directShearVuKn)),
          absoluteMaxPu: Math.abs(Number(store.directAxialPuKn)),
          absoluteMaxTu: Math.abs(Number(store.directTorsionTuKnm)),
        };

        let crossSection: ExtrusionCrossSectionInput = isSteel
          ? buildSteelExtrusionCrossSection(store.steelProfileType)
          : {
              kind: "CONCRETE_RECT",
              bwMm: Number(store.concreteBwMm),
              hMm: Number(store.concreteHMm),
              rebarCage: {
                coverMm: Number(store.concreteCoverMm),
                stirrupDiaMm: 10,
                stirrupSpacingMm: 150,
                tensileBarCount: 4,
                tensileBarDiaMm: 19,
                compressiveBarCount: 2,
                compressiveBarDiaMm: 13,
              },
            };

        // Run SNI section optimization first so Mode B uses the true optimized profile stiffness & 3D dimensions
        try {
          if (!isSteel) {
            concOptResult = optimizeConcreteSection({
              factoredMomentMu: kilonewtonMeter(govForces.absoluteMaxMux),
              factoredShearVu: kilonewton(govForces.absoluteMaxVu),
              fc: fcVal,
              spanLengthM: meter(activeSpanM),
              longitudinalRebarGrade: store.longitudinalRebarGrade,
              stirrupRebarGrade: store.stirrupRebarGrade,
              concreteCoverMm: Number(store.concreteCoverMm),
              minBwMm: Number(store.concreteBwMm),
              maxBwMm: Number(store.concreteBwMm) + 100,
              minHMm: Number(store.concreteHMm),
              maxHMm: Number(store.concreteHMm) + 150,
            });
          } else {
            const rawSteelOpt = optimizeSteelSection({
              factoredMomentMux: kilonewtonMeter(govForces.absoluteMaxMux),
              factoredMomentMuy: kilonewtonMeter(govForces.absoluteMaxMuy),
              factoredShearVu: kilonewton(govForces.absoluteMaxVu),
              factoredAxialPu: kilonewton(Number(store.directAxialPuKn)),
              factoredTorsionTu: kilonewtonMeter(govForces.absoluteMaxTu),
              unbracedLengthLbM: meter(effectiveLbM),
              spanLengthM: meter(activeSpanM),
              deflectionLimitKey: limitKey,
              profileType: store.steelProfileType,
              steelGrade: store.steelGrade,
              maxDepthMm: store.steelMaxHeightMm ? Number(store.steelMaxHeightMm) : undefined,
              maxWidthMm: store.steelMaxWidthMm ? Number(store.steelMaxWidthMm) : undefined,
              customBoxConfig: store.customBoxConfig,
            });

            const userCandidate = store.selectedSteelProfileName
              ? rawSteelOpt.compliantCandidates.find(
                  (c) => c.properties.name === store.selectedSteelProfileName,
                )
              : undefined;

            const activeCandidate = userCandidate ?? rawSteelOpt.bestCandidate;
            steelOptResult = userCandidate
              ? { ...rawSteelOpt, bestCandidate: userCandidate }
              : rawSteelOpt;

            E_Mpa = Number(activeCandidate.grade.E);
            I_Mm4 = Number(activeCandidate.properties.Ix);
            crossSection = buildSteelExtrusionCrossSection(
              store.steelProfileType,
              activeCandidate.properties,
            );
          }
        } catch (optErr) {
          optimizationErrorMsg = optErr instanceof Error ? optErr.message : String(optErr);
        }

        // Interpolate Mode B internal forces & generate 3D extruded mesh + 256-node station views
        const modeBRes = interpolateModeBInternalForces({
          modeBConfig: {
            mode: "MODE_B_DIRECT_INTERNAL_FORCES",
            spanLength: store.directSpanLengthM,
            axialForcePu: store.directAxialPuKn,
            strongAxisMomentMux: store.directMomentMuxKnm,
            weakAxisMomentMuy: store.directMomentMuyKnm,
            torsionTu: store.directTorsionTuKnm,
            shearForceVu: store.directShearVuKn,
          },
          supportOrientation: store.supportOrientation,
          elasticModulusMpa: E_Mpa,
          momentOfInertiaMm4: I_Mm4,
          deflectionLimitKey: limitKey,
          crossSection,
          visualScale: 15.0,
          coordinateMode: store.coordinateMode,
        });

        maxDefl = Number(modeBRes.maxDeflectionMm);
        maxDeflStation = Number(modeBRes.maxDeflectionStationM);

        setMeshViews(modeBRes.mesh3D);
        setRebarCageViews(modeBRes.rebarCage3D);
        setStationViews(getZeroCopyStationViews());
      }

      // 3. Evaluate Deflection Serviceability Compliance
      const isCantilever = store.supportOrientation.startsWith("CANTILEVER");
      const compRes = evaluateDeflectionCompliance(
        maxDefl,
        meter(activeSpanM),
        limitKey,
        isCantilever,
      );
      setCompliance(compRes);

      // 4. Commit all computed outputs (and any optimization error) to the central store
      beamSimulatorActions.setSolverResults({
        maxDeflectionMm: maxDefl,
        maxDeflectionStationM: maxDeflStation,
        governingForces: govForces,
        concreteOptimizationResult: concOptResult,
        steelOptimizationResult: steelOptResult,
        solverError: optimizationErrorMsg,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      beamSimulatorActions.setSolverError(msg);
    }
  }, [
    store.materialKind,
    store.loadingMode,
    store.spanLengthM,
    store.supportOrientation,
    store.includeSelfWeight,
    store.pointLoads,
    store.distributedLoads,
    store.directSpanLengthM,
    store.directAxialPuKn,
    store.directMomentMuxKnm,
    store.directMomentMuyKnm,
    store.directTorsionTuKnm,
    store.directShearVuKn,
    store.concreteBwMm,
    store.concreteHMm,
    store.concreteCoverMm,
    store.concreteFcMpa,
    store.concreteCubeGrade,
    store.longitudinalRebarGrade,
    store.stirrupRebarGrade,
    store.maxAggregateSizeMm,
    store.steelProfileType,
    store.steelGrade,
    store.steelUnbracedLengthLbM,
    store.steelMaxHeightMm,
    store.steelMaxWidthMm,
    store.selectedSteelProfileName,
    store.customBoxConfig,
    store.coordinateMode,
    store.deflectionLimitDenominator,
  ]);

  return {
    isSolving: store.isSolving,
    solverRevision: store.solverRevision,
    solverError: store.solverError,
    meshViews,
    rebarCageViews,
    stationViews,
    maxDeflectionMm: store.maxDeflectionMm,
    maxDeflectionStationM: store.maxDeflectionStationM,
    governingForces: store.governingForces,
    concreteResult: store.concreteOptimizationResult,
    steelResult: store.steelOptimizationResult,
    compliance,
  };
}
```

================================================================================
FILE 5: src/components/forms/SteelDesignParametersForm.tsx
================================================================================

```tsx
/**
 * @file SteelDesignParametersForm.tsx
 * @description Form component for structural steel design parameters (SNI 1729:2020):
 * - Profile type filter (IWF vs BOX)
 * - Parametric Custom Hollow Box (HSS) Generator & Optimizer controls (step 50 mm, thickness 20–35 mm)
 * - Steel material grade (BJ 34 s/d BJ 55)
 * - Lateral unbraced length Lb (m) for LTB analysis
 * - Maximum geometric depth Hmax and flange width Bmax filters
 */

"use client";

import React, { type ReactElement, useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { generateCustomBoxCatalog } from "@/core/steel/steel-section-optimizer";
import { beamSimulatorActions, useBeamSimulatorStore } from "@/state/beam-simulator-store";
import type { CustomBoxShapeRule, SteelGrade, SteelProfileType } from "@/types/steel-sni1729-types";

const STEEL_GRADES: Array<{ value: SteelGrade; label: string }> = [
  { value: "BJ_34", label: "BJ 34 (fy = 210 MPa, fu = 340 MPa)" },
  { value: "BJ_37", label: "BJ 37 (fy = 240 MPa, fu = 370 MPa)" },
  { value: "BJ_41", label: "BJ 41 (fy = 250 MPa, fu = 410 MPa)" },
  { value: "BJ_50", label: "BJ 50 (fy = 290 MPa, fu = 500 MPa)" },
  { value: "BJ_55", label: "BJ 55 (fy = 410 MPa, fu = 550 MPa)" },
];

/**
 * Renders the SNI 1729:2020 Steel Design Parameters form, including the optional
 * Parametric Custom Box Hollow Section Generator when `steelProfileType === "BOX"`.
 *
 * @returns React element for steel design parameter configuration.
 * @example
 * <SteelDesignParametersForm />
 */
export function SteelDesignParametersForm(): ReactElement {
  const {
    steelProfileType,
    steelGrade,
    steelUnbracedLengthLbM,
    steelMaxHeightMm,
    steelMaxWidthMm,
    customBoxConfig,
  } = useBeamSimulatorStore();

  const generatedBoxCount = useMemo(() => {
    if (steelProfileType !== "BOX" || !customBoxConfig.enabled) {
      return 0;
    }
    return generateCustomBoxCatalog(customBoxConfig).length;
  }, [steelProfileType, customBoxConfig]);

  return (
    <FieldGroup className="gap-2.5 text-xs">
      {/* 1. Tipe Penampang Baja */}
      <Field>
        <FieldLabel className="text-muted-foreground font-semibold">
          Tipe Penampang Baja Standar
        </FieldLabel>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={steelProfileType}
          onValueChange={(val) => {
            if (val)
              beamSimulatorActions.setSteelParameters({ profileType: val as SteelProfileType });
          }}
          className="grid w-full grid-cols-2"
        >
          <ToggleGroupItem value="IWF" className="text-xs">
            IWF / H-Beam
          </ToggleGroupItem>
          <ToggleGroupItem value="BOX" className="text-xs">
            BOX / Hollow HSS
          </ToggleGroupItem>
        </ToggleGroup>
      </Field>

      {/* 1b. Panel Generator Parametrik BOX Hollow Custom (Khusus jika tipe = BOX) */}
      {steelProfileType === "BOX" ? (
        <div className="rounded-lg border border-purple-500/35 bg-purple-950/20 p-2.5">
          <Field orientation="horizontal" className="items-start gap-2">
            <Checkbox
              id="toggle-custom-box-generator"
              checked={customBoxConfig.enabled}
              onCheckedChange={(checked) =>
                beamSimulatorActions.setSteelParameters({
                  customBoxConfig: { enabled: Boolean(checked) },
                })
              }
              className="mt-0.5"
            />
            <div className="flex flex-1 flex-col gap-0.5">
              <FieldLabel
                htmlFor="toggle-custom-box-generator"
                className="cursor-pointer font-bold text-purple-300"
              >
                ⚡ Gunakan Generator Parametrik Custom (Interval 50 mm & Tebal 20–35 mm)
              </FieldLabel>
              <span className="text-muted-foreground text-[10px] leading-snug">
                Mencari penampang BOX hollow custom paling ringan sesuai SNI 1729:2020 di luar
                katalog standar JIS G 3466.
              </span>
            </div>
          </Field>

          {customBoxConfig.enabled ? (
            <div className="mt-2.5 flex flex-col gap-2 border-t border-purple-500/25 pt-2.5">
              {/* Badge Info Kombinasi */}
              <div className="flex items-center justify-between">
                <Badge
                  variant="outline"
                  className="border-purple-500/40 bg-purple-500/15 px-1.5 py-0 text-[10px] font-semibold text-purple-200"
                >
                  {generatedBoxCount} variasi penampang diuji real-time
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() =>
                    beamSimulatorActions.setSteelParameters({
                      customBoxConfig: {
                        enabled: true,
                        hMinMm: 200,
                        hMaxMm: 600,
                        bMinMm: 200,
                        bMaxMm: 600,
                        dimensionStepMm: 50,
                        tMinMm: 20,
                        tMaxMm: 35,
                        thicknessStepMm: 5,
                        shapeRule: "ALL",
                      },
                    })
                  }
                  className="h-5 px-1.5 text-[10px] text-purple-300 hover:bg-purple-500/20"
                >
                  ↺ Default (50mm / 20–35mm)
                </Button>
              </div>

              {/* Aturan Bentuk Penampang */}
              <Field>
                <FieldLabel className="text-muted-foreground text-[10px] font-semibold">
                  Aturan Bentuk Penampang BOX
                </FieldLabel>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  size="sm"
                  value={customBoxConfig.shapeRule}
                  onValueChange={(val) => {
                    if (val) {
                      beamSimulatorActions.setSteelParameters({
                        customBoxConfig: { shapeRule: val as CustomBoxShapeRule },
                      });
                    }
                  }}
                  className="grid w-full grid-cols-3"
                >
                  <ToggleGroupItem value="ALL" className="text-[10px]">
                    Semua
                  </ToggleGroupItem>
                  <ToggleGroupItem value="SQUARE_ONLY" className="text-[10px]">
                    Persegi (H=B)
                  </ToggleGroupItem>
                  <ToggleGroupItem value="RECTANGULAR_ONLY" className="text-[10px]">
                    Persegi Panjang
                  </ToggleGroupItem>
                </ToggleGroup>
              </Field>

              {/* Rentang Tinggi H (Hmin - Hmax) */}
              <div className="grid grid-cols-2 gap-2">
                <Field>
                  <FieldLabel className="text-muted-foreground text-[10px] font-semibold">
                    Tinggi Hmin
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      type="number"
                      step={customBoxConfig.dimensionStepMm}
                      min={100}
                      value={customBoxConfig.hMinMm}
                      onChange={(e) =>
                        beamSimulatorActions.setSteelParameters({
                          customBoxConfig: {
                            hMinMm: Math.max(100, Number.parseFloat(e.target.value) || 200),
                          },
                        })
                      }
                    />
                    <InputGroupAddon align="inline-end">mm</InputGroupAddon>
                  </InputGroup>
                </Field>

                <Field>
                  <FieldLabel className="text-muted-foreground text-[10px] font-semibold">
                    Tinggi Hmax
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      type="number"
                      step={customBoxConfig.dimensionStepMm}
                      min={100}
                      value={customBoxConfig.hMaxMm}
                      onChange={(e) =>
                        beamSimulatorActions.setSteelParameters({
                          customBoxConfig: {
                            hMaxMm: Math.max(100, Number.parseFloat(e.target.value) || 600),
                          },
                        })
                      }
                    />
                    <InputGroupAddon align="inline-end">mm</InputGroupAddon>
                  </InputGroup>
                </Field>
              </div>

              {/* Rentang Lebar B (Bmin - Bmax) */}
              <div className="grid grid-cols-2 gap-2">
                <Field>
                  <FieldLabel className="text-muted-foreground text-[10px] font-semibold">
                    Lebar Bmin
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      type="number"
                      step={customBoxConfig.dimensionStepMm}
                      min={100}
                      value={customBoxConfig.bMinMm}
                      onChange={(e) =>
                        beamSimulatorActions.setSteelParameters({
                          customBoxConfig: {
                            bMinMm: Math.max(100, Number.parseFloat(e.target.value) || 200),
                          },
                        })
                      }
                    />
                    <InputGroupAddon align="inline-end">mm</InputGroupAddon>
                  </InputGroup>
                </Field>

                <Field>
                  <FieldLabel className="text-muted-foreground text-[10px] font-semibold">
                    Lebar Bmax
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      type="number"
                      step={customBoxConfig.dimensionStepMm}
                      min={100}
                      value={customBoxConfig.bMaxMm}
                      onChange={(e) =>
                        beamSimulatorActions.setSteelParameters({
                          customBoxConfig: {
                            bMaxMm: Math.max(100, Number.parseFloat(e.target.value) || 600),
                          },
                        })
                      }
                    />
                    <InputGroupAddon align="inline-end">mm</InputGroupAddon>
                  </InputGroup>
                </Field>
              </div>

              {/* Rentang Tebal Dinding t (tmin - tmax) */}
              <div className="grid grid-cols-2 gap-2">
                <Field>
                  <FieldLabel className="text-[10px] font-bold text-amber-300">
                    Tebal Awal tmin
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      type="number"
                      step={customBoxConfig.thicknessStepMm}
                      min={2}
                      value={customBoxConfig.tMinMm}
                      onChange={(e) =>
                        beamSimulatorActions.setSteelParameters({
                          customBoxConfig: {
                            tMinMm: Math.max(2, Number.parseFloat(e.target.value) || 20),
                          },
                        })
                      }
                    />
                    <InputGroupAddon align="inline-end">mm</InputGroupAddon>
                  </InputGroup>
                </Field>

                <Field>
                  <FieldLabel className="text-[10px] font-bold text-amber-300">
                    Tebal Maks tmax
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      type="number"
                      step={customBoxConfig.thicknessStepMm}
                      min={2}
                      value={customBoxConfig.tMaxMm}
                      onChange={(e) =>
                        beamSimulatorActions.setSteelParameters({
                          customBoxConfig: {
                            tMaxMm: Math.max(2, Number.parseFloat(e.target.value) || 35),
                          },
                        })
                      }
                    />
                    <InputGroupAddon align="inline-end">mm</InputGroupAddon>
                  </InputGroup>
                </Field>
              </div>

              {/* Interval Step Dimensi (ΔH, ΔB) & Step Tebal (Δt) */}
              <div className="grid grid-cols-2 gap-2">
                <Field>
                  <FieldLabel className="text-muted-foreground text-[10px] font-semibold">
                    Step Dimensi (ΔH, ΔB)
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      type="number"
                      step={10}
                      min={10}
                      value={customBoxConfig.dimensionStepMm}
                      onChange={(e) =>
                        beamSimulatorActions.setSteelParameters({
                          customBoxConfig: {
                            dimensionStepMm: Math.max(10, Number.parseFloat(e.target.value) || 50),
                          },
                        })
                      }
                    />
                    <InputGroupAddon align="inline-end">mm</InputGroupAddon>
                  </InputGroup>
                </Field>

                <Field>
                  <FieldLabel className="text-muted-foreground text-[10px] font-semibold">
                    Step Tebal (Δt)
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      type="number"
                      step={0.5}
                      min={0.5}
                      value={customBoxConfig.thicknessStepMm}
                      onChange={(e) =>
                        beamSimulatorActions.setSteelParameters({
                          customBoxConfig: {
                            thicknessStepMm: Math.max(0.5, Number.parseFloat(e.target.value) || 5),
                          },
                        })
                      }
                    />
                    <InputGroupAddon align="inline-end">mm</InputGroupAddon>
                  </InputGroup>
                </Field>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* 2. Mutu Material Baja */}
      <Field>
        <FieldLabel className="text-muted-foreground font-semibold">
          Mutu Baja Struktural (SNI 1729 / JIS G 3101)
        </FieldLabel>
        <Select
          value={steelGrade}
          onValueChange={(val) =>
            beamSimulatorActions.setSteelParameters({ grade: val as SteelGrade })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent onPointerDown={(e) => e.stopPropagation()}>
            <SelectGroup>
              {STEEL_GRADES.map((g) => (
                <SelectItem key={g.value} value={g.value}>
                  {g.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>

      {/* 3. Panjang Tak Terkekang Lateral Lb */}
      <Field>
        <FieldLabel className="text-muted-foreground font-semibold">
          Panjang Tak Terkekang Lateral Lb
        </FieldLabel>
        <InputGroup>
          <InputGroupInput
            type="number"
            step="0.5"
            value={Number(steelUnbracedLengthLbM)}
            onChange={(e) =>
              beamSimulatorActions.setSteelParameters({
                unbracedLengthLbM: parseFloat(e.target.value) || 1,
              })
            }
          />
          <InputGroupAddon align="inline-end">m</InputGroupAddon>
        </InputGroup>
        <FieldDescription className="text-[10px]">
          Digunakan untuk analisis Tekuk Torsi Lateral (LTB SNI Bab F).
        </FieldDescription>
      </Field>

      {/* 4. Filter Batasan Geometri Maksimum (Hmax & Bmax) */}
      <div className="grid grid-cols-2 gap-2">
        <Field>
          <FieldLabel className="text-muted-foreground font-semibold">Batas Hmax</FieldLabel>
          <InputGroup>
            <InputGroupInput
              type="number"
              placeholder="Tanpa batas"
              value={steelMaxHeightMm ? Number(steelMaxHeightMm) : ""}
              onChange={(e) =>
                beamSimulatorActions.setSteelParameters({
                  maxHeightMm: e.target.value ? parseFloat(e.target.value) : undefined,
                })
              }
            />
            <InputGroupAddon align="inline-end">mm</InputGroupAddon>
          </InputGroup>
        </Field>

        <Field>
          <FieldLabel className="text-muted-foreground font-semibold">Batas Bmax</FieldLabel>
          <InputGroup>
            <InputGroupInput
              type="number"
              placeholder="Tanpa batas"
              value={steelMaxWidthMm ? Number(steelMaxWidthMm) : ""}
              onChange={(e) =>
                beamSimulatorActions.setSteelParameters({
                  maxWidthMm: e.target.value ? parseFloat(e.target.value) : undefined,
                })
              }
            />
            <InputGroupAddon align="inline-end">mm</InputGroupAddon>
          </InputGroup>
        </Field>
      </div>
    </FieldGroup>
  );
}

export default SteelDesignParametersForm;
```

================================================================================
FILE 6: src/components/results/SteelOptimizationRankingTable.tsx
================================================================================

```tsx
/**
 * @file SteelOptimizationRankingTable.tsx
 * @description Ranking table & summary card for SNI 1729:2020 structural steel optimization:
 * - Optimal governing profile recommendation (lightest compliant section)
 * - Highlights custom-generated parametric hollow box sections (`isCustomGenerated`)
 * - Destructive error banner when demands exceed catalog capacity (`solverError`)
 * - Interactive clickable candidate ranking rows to inspect/select alternative profiles
 * - Exact 2D SVG technical cross-section preview using true catalog H, B, tw, tf, r, t
 */

"use client";

import React, { type ReactElement } from "react";

import { SteelProfileCrossSectionSvg } from "@/components/canvas/SteelProfileCrossSectionSvg";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SteelOptimizationResult } from "@/core/steel/steel-section-optimizer";
import { cn } from "@/lib/utils";
import { beamSimulatorActions, useBeamSimulatorStore } from "@/state/beam-simulator-store";
import type { SteelOptimizationCandidate } from "@/types/steel-sni1729-types";

export interface SteelOptimizationRankingTableProps {
  readonly result: SteelOptimizationResult | null;
  readonly onOpenExportModal?: () => void;
}

/**
 * Renders the SNI 1729:2020 steel profile optimization summary, 2D SVG cross-section,
 * interactive alternative profile table, custom parametric badges, and error diagnostics.
 *
 * @param props Optimization result and optional export modal callback.
 * @returns React element displaying steel optimization results.
 * @example
 * <SteelOptimizationRankingTable result={steelResult} />
 */
export function SteelOptimizationRankingTable({
  result,
  onOpenExportModal,
}: SteelOptimizationRankingTableProps): ReactElement {
  const {
    solverError,
    selectedSteelProfileName,
    governingForces,
    steelProfileType,
    customBoxConfig,
  } = useBeamSimulatorStore();

  if (solverError) {
    return (
      <div className="flex flex-col gap-2.5 text-xs">
        <div
          role="alert"
          className="rounded-lg border border-red-500/50 bg-red-950/45 p-3 text-xs leading-relaxed text-red-200"
        >
          <div className="font-bold text-red-400">
            ⚠️ Tidak Ada Profil Baja yang Memenuhi Syarat
          </div>
          <p className="mt-1.5 text-[11px] text-red-200/90">{solverError}</p>
          <div className="mt-2 rounded border border-red-500/30 bg-black/30 p-2 font-mono text-[10px] text-slate-300">
            Mux = {governingForces.absoluteMaxMux.toFixed(1)} kNm | Muy ={" "}
            {governingForces.absoluteMaxMuy.toFixed(1)} kNm | Vu ={" "}
            {governingForces.absoluteMaxVu.toFixed(1)} kN | Pu ={" "}
            {governingForces.absoluteMaxPu.toFixed(1)} kN
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() =>
                beamSimulatorActions.setSteelParameters({
                  grade: "BJ_55",
                  maxHeightMm: undefined,
                  maxWidthMm: undefined,
                  selectedProfileName: null,
                })
              }
              className="border-amber-500/50 text-[10px] font-semibold text-amber-300 hover:bg-amber-500/20"
            >
              Naikkan ke BJ 55 & Hapus Batas Hmax
            </Button>

            {steelProfileType === "BOX" && !customBoxConfig.enabled ? (
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() =>
                  beamSimulatorActions.setSteelParameters({
                    customBoxConfig: { enabled: true },
                    selectedProfileName: null,
                  })
                }
                className="border-purple-500/50 text-[10px] font-semibold text-purple-300 hover:bg-purple-500/20"
              >
                ⚡ Aktifkan BOX Custom (t = 20–35 mm)
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (!result || !result.bestCandidate) {
    return (
      <Empty className="py-6 text-center">
        <EmptyDescription className="text-muted-foreground text-xs">
          Menunggu hasil kalkulasi gaya dalam untuk mencari profil baja ekonomis…
        </EmptyDescription>
      </Empty>
    );
  }

  const { bestCandidate, compliantCandidates } = result;
  const props = bestCandidate.properties;

  return (
    <div className="flex flex-col gap-2.5 text-xs">
      {/* 1. Header Rekomendasi Teratas */}
      <Card size="sm" className="border-border/40 bg-card/60">
        <CardContent className="flex items-center justify-between p-2.5">
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-muted-foreground text-[10px] font-medium">
                PROFIL TERPILIH (SNI 1729)
              </span>
              {props.isCustomGenerated ? (
                <Badge
                  variant="outline"
                  className="h-4 border-purple-500/50 bg-purple-500/15 px-1.5 text-[9px] font-bold text-purple-300"
                >
                  ⚡ PARAMETRIK CUSTOM
                </Badge>
              ) : null}
              {selectedSteelProfileName ? (
                <Badge
                  variant="outline"
                  className="h-4 border-amber-500/40 bg-amber-500/10 px-1 text-[9px] text-amber-300"
                >
                  Manual
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="h-4 border-sky-500/40 bg-sky-500/10 px-1 text-[9px] text-sky-300"
                >
                  Auto Ekonomis
                </Badge>
              )}
            </div>
            <div className="mt-0.5 text-sm font-bold text-sky-400">{props.name}</div>
            <div className="text-muted-foreground text-[10px]">
              Mutu {bestCandidate.grade.grade.replace("_", " ")} (fy ={" "}
              {Number(bestCandidate.grade.fy)} MPa) • {Number(props.unitWeightKgPerM).toFixed(1)}{" "}
              kg/m
            </div>
          </div>

          <div className="text-right">
            <span className="text-muted-foreground text-[10px] font-medium">EFISIENSI DCR</span>
            <div className="mt-0.5">
              <Badge
                variant={Number(bestCandidate.governingDcr) <= 1.0 ? "secondary" : "destructive"}
                className={cn(
                  "text-xs font-bold",
                  Number(bestCandidate.governingDcr) <= 1.0
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                    : "border-destructive/40 bg-destructive/15 text-destructive",
                )}
              >
                {(Number(bestCandidate.governingDcr) * 100).toFixed(1)}%
              </Badge>
            </div>
            {selectedSteelProfileName ? (
              <button
                type="button"
                onClick={() =>
                  beamSimulatorActions.setSteelParameters({ selectedProfileName: null })
                }
                className="mt-1 text-[10px] font-medium text-sky-400 underline hover:text-sky-300"
              >
                Reset ke Auto
              </button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* 2. Potongan SVG 2D Profil Baja */}
      <div className="flex justify-center py-1">
        <SteelProfileCrossSectionSvg
          profileType={result.profileType}
          profileName={props.name}
          depthH={Number(props.H)}
          widthB={Number(props.B)}
          webThicknessTw={Number(props.tw)}
          flangeThicknessTf={Number(props.tf)}
          boxThicknessT={Number(props.t ?? props.tw)}
          filletRadiusR={Number(props.r ?? 0)}
          width={230}
          height={185}
        />
      </div>

      {/* 3. Detail Kapasitas & Evaluasi Kelangsingan */}
      <Card size="sm" className="border-border/40 bg-card/60">
        <CardContent className="flex flex-col gap-1 p-2.5 text-[11px] leading-relaxed">
          <div>
            • Klasifikasi Penampang:{" "}
            <strong className="text-sky-400">
              {bestCandidate.compactness.governingClassification === "COMPACT"
                ? "Kompak"
                : bestCandidate.compactness.governingClassification === "NON_COMPACT"
                  ? "Non-Kompak"
                  : "Langsing"}
            </strong>{" "}
            (Sayap: {bestCandidate.compactness.flangeClassification}, Badan:{" "}
            {bestCandidate.compactness.webClassification})
          </div>
          <div>
            • Kondisi Tekuk LTB:{" "}
            <strong className="text-emerald-400">
              {bestCandidate.ltb.governingZone === "ZONE_1_PLASTIC"
                ? "Zona 1 (Plastis Penuh)"
                : bestCandidate.ltb.governingZone === "ZONE_2_INELASTIC_LTB"
                  ? "Zona 2 (Inelastis)"
                  : "Zona 3 (Tekuk Elastis)"}
            </strong>
          </div>
          <div className="text-muted-foreground">
            • Kapasitas φMnx: {Number(bestCandidate.ltb.designFlexuralPhiMn).toFixed(1)} kNm | Ix:{" "}
            {(Number(props.Ix) / 1e4).toFixed(0)} cm⁴
          </div>
        </CardContent>
      </Card>

      {/* 4. Tabel Peringkat Kandidat (Klik baris untuk memilih profil) */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[10px] font-semibold">
            Peringkat Profil Ekonomis (Klik baris untuk pilih):
          </span>
          <span className="text-muted-foreground text-[10px]">
            {compliantCandidates.length} lulus (dari {result.evaluatedCount} diuji)
          </span>
        </div>
        <ScrollArea className="border-border/40 h-32 w-full rounded-md border">
          <Table className="text-[10px]">
            <TableHeader>
              <TableRow className="border-border/30 hover:bg-transparent">
                <TableHead className="text-muted-foreground h-7 px-2 text-left text-[10px]">
                  Profil
                </TableHead>
                <TableHead className="text-muted-foreground h-7 px-2 text-right text-[10px]">
                  DCR
                </TableHead>
                <TableHead className="text-muted-foreground h-7 px-2 text-right text-[10px]">
                  Berat
                </TableHead>
                <TableHead className="text-muted-foreground h-7 px-2 text-center text-[10px]">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {compliantCandidates.slice(0, 10).map((c: SteelOptimizationCandidate) => {
                const isSelected = c.properties.name === bestCandidate.properties.name;
                return (
                  <TableRow
                    key={`${c.properties.name}-${c.grade.grade}`}
                    onClick={() =>
                      beamSimulatorActions.setSteelParameters({
                        selectedProfileName: c.properties.name,
                      })
                    }
                    className={cn(
                      "border-border/20 cursor-pointer transition-colors hover:bg-sky-500/10",
                      isSelected && "bg-sky-500/15 font-bold",
                    )}
                  >
                    <TableCell className="text-foreground px-2 py-1 font-semibold">
                      <div className="flex items-center gap-1">
                        <span>
                          {isSelected ? "▸ " : ""}
                          {c.properties.name}
                        </span>
                        {c.properties.isCustomGenerated ? (
                          <Badge
                            variant="outline"
                            className="h-3.5 border-purple-500/40 bg-purple-500/15 px-1 py-0 text-[8px] font-semibold text-purple-300"
                          >
                            Custom
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="px-2 py-1 text-right font-mono">
                      {(Number(c.governingDcr) * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-muted-foreground px-2 py-1 text-right font-mono">
                      {Number(c.properties.unitWeightKgPerM).toFixed(1)} kg/m
                    </TableCell>
                    <TableCell className="px-2 py-1 text-center">
                      <Badge
                        variant={c.status === "OPTIMAL" ? "default" : "secondary"}
                        className={cn(
                          "h-4 px-1.5 py-0 text-[9px] font-medium",
                          c.status === "OPTIMAL"
                            ? "border border-emerald-500/30 bg-emerald-500/20 text-emerald-400"
                            : "text-muted-foreground",
                        )}
                      >
                        {c.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      {/* 5. Tombol Ekspor CAD / CAE */}
      {onOpenExportModal ? (
        <Button
          type="button"
          onClick={onOpenExportModal}
          className="mt-1 w-full bg-linear-to-r from-cyan-500 to-blue-600 font-bold text-white shadow-sm hover:from-cyan-600 hover:to-blue-700"
        >
          📦 Ekspor CAD (.dxf), SAP2000 (.s2k), & STEP (.step)
        </Button>
      ) : null}
    </div>
  );
}

export default SteelOptimizationRankingTable;
```

================================================================================
FILE 7: tests/steel/steel-sni1729-optimizer.test.ts
================================================================================

```ts
/**
 * @file steel-sni1729-optimizer.test.ts
 * @description Comprehensive unit and integration test suite for the structural steel
 * optimization engine following SNI 1729:2020:
 * - Table B4.1b compactness slenderness classifications (IWF & BOX)
 * - Chapter F Lateral-Torsional Buckling (Zones 1, 2, and 3)
 * - Chapter H1 combined axial and biaxial bending interaction (Eq. H1-1a / H1-1b)
 * - Chapter H3 torsional capacity & shear-torsion interaction
 * - Binary search catalog optimizer (IWF & BOX) & Custom Parametric Box Hollow Generator
 */

import { describe, expect, test } from "bun:test";

import { evaluateBiaxialInteraction } from "@/core/steel/biaxial-interaction-evaluator";
import { computeIwfSectionProperties } from "@/core/steel/iwf-geometric-properties";
import { solveLateralTorsionalBuckling } from "@/core/steel/lateral-torsional-buckling-solver";
import { classifySectionCompactness } from "@/core/steel/section-compactness-classifier";
import {
  generateCustomBoxCatalog,
  optimizeSteelSection,
} from "@/core/steel/steel-section-optimizer";
import {
  evaluateSteelShear,
  evaluateSteelTorsion,
} from "@/core/steel/steel-torsion-shear-evaluator";
import { kilonewton, kilonewtonMeter, meter, millimeter } from "@/types/branded-units";
import type { IwfPrimaryDimensions } from "@/types/steel-sni1729-types";

describe("Step 4: SNI 1729:2020 Steel Engine Tests", () => {
  // Test specimen: WF 300 x 150 x 36.7 (H=300, B=150, tw=6.5, tf=9.0, r=9.0)
  const wf300x150Dims: IwfPrimaryDimensions = {
    name: "WF 300 x 150 x 36.7",
    H: millimeter(300),
    B: millimeter(150),
    tw: millimeter(6.5),
    tf: millimeter(9.0),
    r: millimeter(9.0),
  };
  const wf300x150Props = computeIwfSectionProperties(wf300x150Dims);
  const fyBj37 = 240; // BJ 37: Fy = 240 MPa

  describe("Table B4.1b Section Compactness Classification", () => {
    test("correctly evaluates IWF flange and web slenderness ratios and compactness", () => {
      const res = classifySectionCompactness(wf300x150Props, fyBj37);

      expect(res.lambdaF).toBeCloseTo(8.333, 2);
      expect(res.lambdaPf).toBeCloseTo(10.97, 1);
      expect(res.flangeClassification).toBe("COMPACT");

      expect(res.lambdaW).toBeCloseTo(40.615, 2);
      expect(res.lambdaPw).toBeCloseTo(108.54, 1);
      expect(res.webClassification).toBe("COMPACT");

      expect(res.governingClassification).toBe("COMPACT");
    });
  });

  describe("Chapter F Lateral-Torsional Buckling (LTB)", () => {
    test("governs by Zone 1 (Plastic Mp) when Lb <= Lp", () => {
      const res = solveLateralTorsionalBuckling(wf300x150Props, fyBj37, 1000);

      expect(res.governingZone).toBe("ZONE_1_PLASTIC");
      const expectedMpKnm = (fyBj37 * Number(wf300x150Props.Zx)) / 1e6;
      expect(Number(res.nominalFlexuralMn)).toBeCloseTo(expectedMpKnm, 1);
      expect(Number(res.designFlexuralPhiMn)).toBeCloseTo(0.9 * expectedMpKnm, 1);
    });

    test("governs by Zone 2 (Inelastic LTB) when Lp < Lb <= Lr", () => {
      const res = solveLateralTorsionalBuckling(wf300x150Props, fyBj37, 2500);

      expect(res.governingZone).toBe("ZONE_2_INELASTIC_LTB");
      expect(Number(res.unbracedLengthLb)).toBeGreaterThan(Number(res.plasticLengthLp));
      expect(Number(res.unbracedLengthLb)).toBeLessThanOrEqual(Number(res.inelasticLengthLr));

      const mpKnm = (fyBj37 * Number(wf300x150Props.Zx)) / 1e6;
      expect(Number(res.nominalFlexuralMn)).toBeLessThanOrEqual(mpKnm);
    });

    test("governs by Zone 3 (Elastic LTB) when Lb > Lr", () => {
      const res = solveLateralTorsionalBuckling(wf300x150Props, fyBj37, 8000);

      expect(res.governingZone).toBe("ZONE_3_ELASTIC_LTB");
      expect(Number(res.unbracedLengthLb)).toBeGreaterThan(Number(res.inelasticLengthLr));
      const mpKnm = (fyBj37 * Number(wf300x150Props.Zx)) / 1e6;
      expect(Number(res.nominalFlexuralMn)).toBeLessThan(mpKnm * 0.7);
    });
  });

  describe("Chapter H1 Combined Axial and Biaxial Bending Interaction", () => {
    test("evaluates Equation H1-1a when axial ratio Pr / Pc >= 0.20", () => {
      const res = evaluateBiaxialInteraction({
        profileName: "WF 300 x 150 x 36.7",
        factoredAxialPu: kilonewton(-250),
        factoredMomentMux: kilonewtonMeter(60),
        factoredMomentMuy: kilonewtonMeter(10),
        designAxialPhiPn: kilonewton(1000),
        designFlexuralPhiMnx: kilonewtonMeter(120),
        designFlexuralPhiMny: kilonewtonMeter(30),
      });

      expect(res.axialRatio).toBe(0.25);
      expect(Number(res.interactionValue)).toBeCloseTo(0.9907, 3);
      expect(res.isSafe).toBe(true);
    });

    test("evaluates Equation H1-1b when axial ratio Pr / Pc < 0.20", () => {
      const res = evaluateBiaxialInteraction({
        profileName: "WF 300 x 150 x 36.7",
        factoredAxialPu: kilonewton(-100),
        factoredMomentMux: kilonewtonMeter(60),
        factoredMomentMuy: kilonewtonMeter(10),
        designAxialPhiPn: kilonewton(1000),
        designFlexuralPhiMnx: kilonewtonMeter(120),
        designFlexuralPhiMny: kilonewtonMeter(30),
      });

      expect(res.axialRatio).toBe(0.1);
      expect(Number(res.interactionValue)).toBeCloseTo(0.8833, 3);
      expect(res.isSafe).toBe(true);
    });
  });

  describe("Chapter G Shear & Chapter H3 Torsion Evaluator", () => {
    test("computes shear capacity Vn and checks shear DCR", () => {
      const shear = evaluateSteelShear(wf300x150Props, fyBj37, kilonewton(100));

      expect(Number(shear.nominalShearVn)).toBeCloseTo(280.8, 1);
      expect(Number(shear.shearDcr)).toBeCloseTo(100 / (1.0 * 280.8), 2);
    });

    test("evaluates HSS torsional capacity and negligible threshold (Tu <= 0.20 * phi_T * Tn)", () => {
      const torsion = evaluateSteelTorsion(wf300x150Props, fyBj37, kilonewtonMeter(0.1));
      expect(torsion.isTorsionNegligible).toBe(true);
    });
  });

  describe("Binary Search Steel Section Optimizer", () => {
    test("optimizes IWF steel beam with compliant DCR <= 1.00", () => {
      const opt = optimizeSteelSection({
        profileType: "IWF",
        factoredMomentMux: kilonewtonMeter(140),
        factoredShearVu: kilonewton(75),
        unbracedLengthLbM: meter(4.0),
        steelGrade: "BJ_37",
        spanLengthM: meter(6.0),
      });

      expect(opt.bestCandidate).toBeDefined();
      expect(Number(opt.bestCandidate.governingDcr)).toBeLessThanOrEqual(1.0);
      expect(opt.bestCandidate.properties.profileType).toBe("IWF");
    });

    test("optimizes BOX steel beam for torsional and biaxial load demands", () => {
      const opt = optimizeSteelSection({
        profileType: "BOX",
        factoredMomentMux: kilonewtonMeter(100),
        factoredMomentMuy: kilonewtonMeter(20),
        factoredShearVu: kilonewton(50),
        factoredTorsionTu: kilonewtonMeter(5.0),
        unbracedLengthLbM: meter(4.0),
        steelGrade: "BJ_41",
      });

      expect(opt.bestCandidate).toBeDefined();
      expect(opt.bestCandidate.properties.profileType).toBe("BOX");
      expect(Number(opt.bestCandidate.governingDcr)).toBeLessThanOrEqual(1.0);
    });
  });

  describe("Custom Parametric Box Hollow Section Generator & Optimizer", () => {
    test("generates exact number of custom BOX sections with 50 mm step and t in [20, 35] mm", () => {
      // H in {200, 250, 300} (3), B in {200, 250, 300} (3), t in {20, 25, 30, 35} (4) -> 3 * 3 * 4 = 36
      const allCatalog = generateCustomBoxCatalog({
        enabled: true,
        hMinMm: 200,
        hMaxMm: 300,
        bMinMm: 200,
        bMaxMm: 300,
        dimensionStepMm: 50,
        tMinMm: 20,
        tMaxMm: 35,
        thicknessStepMm: 5,
        shapeRule: "ALL",
      });
      expect(allCatalog.length).toBe(36);
      expect(allCatalog.every((s) => s.isCustomGenerated === true)).toBe(true);
      expect(allCatalog.some((s) => s.name === "BOX 200 x 200 x 20 (Custom)")).toBe(true);
      expect(allCatalog.some((s) => s.name === "BOX 300 x 250 x 35 (Custom)")).toBe(true);

      // SQUARE_ONLY: H === B in {200, 250, 300} (3) * 4 thicknesses = 12
      const squareCatalog = generateCustomBoxCatalog({
        enabled: true,
        hMinMm: 200,
        hMaxMm: 300,
        bMinMm: 200,
        bMaxMm: 300,
        dimensionStepMm: 50,
        tMinMm: 20,
        tMaxMm: 35,
        thicknessStepMm: 5,
        shapeRule: "SQUARE_ONLY",
      });
      expect(squareCatalog.length).toBe(12);
      expect(squareCatalog.every((s) => Number(s.H) === Number(s.B))).toBe(true);
    });

    test("optimizes high-capacity custom BOX section (20 <= t <= 35 mm) under heavy demands", () => {
      const opt = optimizeSteelSection({
        profileType: "BOX",
        factoredMomentMux: kilonewtonMeter(450),
        factoredMomentMuy: kilonewtonMeter(80),
        factoredShearVu: kilonewton(220),
        factoredTorsionTu: kilonewtonMeter(30),
        unbracedLengthLbM: meter(6.0),
        spanLengthM: meter(6.0),
        steelGrade: "BJ_41",
        customBoxConfig: {
          enabled: true,
          hMinMm: 200,
          hMaxMm: 600,
          bMinMm: 200,
          bMaxMm: 600,
          dimensionStepMm: 50,
          tMinMm: 20,
          tMaxMm: 35,
          thicknessStepMm: 5,
          shapeRule: "ALL",
        },
      });

      expect(opt.bestCandidate).toBeDefined();
      expect(opt.bestCandidate.properties.isCustomGenerated).toBe(true);
      expect(Number(opt.bestCandidate.properties.t)).toBeGreaterThanOrEqual(20);
      expect(Number(opt.bestCandidate.properties.t)).toBeLessThanOrEqual(35);
      expect(Number(opt.bestCandidate.governingDcr)).toBeLessThanOrEqual(1.0);
    });
  });
});
```

================================================================================
RINGKASAN SINGKAT (`⌐■_■`)
================================================================================

Semua 7 file di atas sudah dipisahkan secara tegas dengan blok pembatas `================================================================================` per file tanpa ada teks yang terpotong/tumpang tindih. Kamu bisa langsung salin-tempel masing-masing file ke repositori dan jalankan `bun check -b && bun test tests/steel`! 🚀⚡
