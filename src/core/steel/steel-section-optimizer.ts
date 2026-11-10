// src/core/steel/steel-section-optimizer.ts
/**
 * @file steel-section-optimizer.ts
 * @description High-efficiency structural steel section optimizer (SNI 1729:2020).
 * Implements binary-search-assisted profile discovery across JIS G 3192 (IWF) and
 * JIS G 3466 (BOX) precomputed catalogs.
 * Evaluates Table B4.1b compactness, Chapter F LTB, Chapter G shear, Chapter H1 interaction,
 * Chapter H3 torsion, geometric constraints (H_max, B_max), and Smart Grade optimization
 * (BJ 34, BJ 37, BJ 41, BJ 50, BJ 55) with weight-first economic ranking.
 */

import type { DeflectionLimitKey } from "@/config/deflection-limits-config";
import { evaluateDeflectionCompliance } from "@/config/deflection-limits-config";
import rawSteelGrades from "@/data/steel-material-grades.json";
import type { Kilonewton, KilonewtonMeter, Meter } from "@/types/branded-units";
import { kilonewton, kilonewtonMeter, meter, utilizationRatio } from "@/types/branded-units";
import type {
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
import type { BoxSectionProperties } from "./iwf-geometric-properties";
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
 * Searches the sorted structural steel catalogs and determines the most material-efficient
 * compliant section matching load demands (Pu, Mux, Muy, Vu, Tu) per SNI 1729:2020.
 *
 * Candidates satisfying `governingDcr <= 1.0` and deflection limits are sorted primarily
 * by `unitWeightKgPerM` ascending (lightest & most economical section wins).
 *
 * @param input Loads, span length, steel grade, and geometric filters.
 * @returns Complete SteelOptimizationResult with bestCandidate and compliant alternatives.
 * @throws {SteelDesignError} When no compliant section can be found within catalog bounds.
 * @example
 * const res = optimizeSteelSection({
 *   factoredMomentMux: kilonewtonMeter(120),
 *   factoredShearVu: kilonewton(60),
 *   unbracedLengthLbM: meter(4.0),
 *   steelGrade: "BJ_37",
 * });
 * console.log(res.bestCandidate.properties.name, res.bestCandidate.governingDcr);
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
  const catalog: readonly SteelSectionProperties[] =
    selectedProfileType === "BOX" ? SORTED_BOX_CATALOG : SORTED_IWF_CATALOG;

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
    throw new SteelDesignError(
      "CATALOG_EXHAUSTED",
      "optimizeSteelSection",
      `Tidak ditemukan profil baja ${selectedProfileType} (${input.steelGrade ?? "Multi-Grade"}) di katalog yang mampu menahan kombinasi beban (Mux=${mux.toFixed(1)} kNm, Muy=${muy.toFixed(1)} kNm, Vu=${vu.toFixed(1)} kN, Pu=${pu.toFixed(1)} kN, Tu=${tu.toFixed(1)} kNm pada Lb=${(lbMm / 1000).toFixed(2)} m). Silakan naikkan mutu baja (misal ke BJ 50 / BJ 55), perbesar batas geometri Hmax/Bmax, atau kurangi beban/bentang.`,
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
