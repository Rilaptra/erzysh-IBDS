/**
 * @file concrete-section-optimizer.ts
 * @description Reinforced concrete beam cross-section optimizer per SNI 2847:2019.
 * Iterates through candidate beam dimensions (bw x h), automatically accommodates
 * 1- or 2-layer longitudinal reinforcement arrangements, enforces web crushing shear limits
 * (SECTION_TOO_SMALL_FOR_SHEAR), and discovers the most material-efficient cross-section.
 */

import { evaluateDeflectionCompliance } from "@/config/deflection-limits-config";
import type { DeflectionLimitKey } from "@/config/deflection-limits-config";
import { kilonewton, kilonewtonMeter, megapascal, meter, millimeter } from "@/types/branded-units";
import type {
  Kilonewton,
  KilonewtonMeter,
  Megapascal,
  Meter,
  Millimeter,
} from "@/types/branded-units";
import { ConcreteDesignError } from "@/types/concrete-sni2847-types";
import type {
  ConcreteOptimizationResult,
  ConcreteSectionInput,
  RebarSteelGrade,
} from "@/types/concrete-sni2847-types";

import { calculateConcreteModulusEc, resolveCylinderFcMpa } from "./concrete-grade-converter";
import {
  checkShearWebCrushingLimit,
  designShearStirrups,
  SECTION_TOO_SMALL_FOR_SHEAR,
} from "./shear-stirrup-designer";
import { designWhitneyFlexure } from "./whitney-flexural-designer";

/** Configuration parameters guiding concrete beam cross-section optimization. */
export interface ConcreteOptimizerInput {
  /** Factored design bending moment Mu in kNm. */
  readonly factoredMomentMu: KilonewtonMeter | number;
  /** Factored design shear force Vu in kN. */
  readonly factoredShearVu: Kilonewton | number;
  /** Concrete compressive strength fc' in MPa (or cylinder grade key). */
  readonly fc: Megapascal | number;
  /** Clear span length L in meters (optional, used for deflection serviceability check). */
  readonly spanLengthM?: Meter | number;
  /** Deflection serviceability limit key (default: "L_360"). */
  readonly deflectionLimitKey?: DeflectionLimitKey;
  /** Longitudinal tensile/compressive rebar steel grade (default: "BJTS_40"). */
  readonly longitudinalRebarGrade?: RebarSteelGrade;
  /** Transverse stirrup steel grade (default: "BJTP_24"). */
  readonly stirrupRebarGrade?: RebarSteelGrade;
  /** Clear concrete cover in mm (default: 40 mm). */
  readonly concreteCoverMm?: number;
  /** Minimum allowable beam web width bw in mm (default: 200 mm). */
  readonly minBwMm?: number;
  /** Maximum allowable beam web width bw in mm (default: 500 mm). */
  readonly maxBwMm?: number;
  /** Increment step for beam width bw in mm (default: 50 mm). */
  readonly stepBwMm?: number;
  /** Minimum allowable total beam height h in mm (default: 300 mm). */
  readonly minHMm?: number;
  /** Maximum allowable total beam height h in mm (default: 1000 mm). */
  readonly maxHMm?: number;
  /** Increment step for beam height h in mm (default: 50 mm). */
  readonly stepHMm?: number;
  /** Minimum permissible aspect ratio (h / bw, default: 1.2). */
  readonly minAspectRatio?: number;
  /** Maximum permissible aspect ratio (h / bw, default: 3.0). */
  readonly maxAspectRatio?: number;
}

/**
 * Searches for and returns the optimal reinforced concrete beam cross-section dimensions (bw x h)
 * and reinforcement detailing matching factored demands (Mu, Vu) under SNI 2847:2019.
 *
 * If a trial dimension exceeds web shear capacity Vs,max (SECTION_TOO_SMALL_FOR_SHEAR),
 * the optimizer automatically increments dimensions until an adequate cross-section is achieved.
 *
 * @param input Loads, concrete grade, rebar grades, and geometric boundary limits.
 * @returns ConcreteOptimizationResult containing chosen section, flexural/shear detailing, and advisories.
 * @throws {ConcreteDesignError} If no section satisfies demands within the specified bounds.
 * @example
 * const result = optimizeConcreteSection({
 *   factoredMomentMu: kilonewtonMeter(150),
 *   factoredShearVu: kilonewton(90),
 *   fc: megapascal(25),
 *   spanLengthM: meter(6.0),
 * });
 * console.log(result.section.bw, result.section.h, result.isCompliant);
 */
export function optimizeConcreteSection(input: ConcreteOptimizerInput): ConcreteOptimizationResult {
  const muAbs = Math.abs(Number(input.factoredMomentMu));
  const vuAbs = Math.abs(Number(input.factoredShearVu));
  const fcMpa = resolveCylinderFcMpa(input.fc);

  const longGrade = input.longitudinalRebarGrade ?? "BJTS_40";
  const stirrupGrade = input.stirrupRebarGrade ?? "BJTP_24";
  const coverMm = input.concreteCoverMm ?? 40;

  const minBw = input.minBwMm ?? 200;
  const maxBw = input.maxBwMm ?? 500;
  const stepBw = input.stepBwMm ?? 50;

  const minH = input.minHMm ?? 300;
  const maxH = input.maxHMm ?? 1000;
  const stepH = input.stepHMm ?? 50;

  const minAspect = input.minAspectRatio ?? 1.2;
  const maxAspect = input.maxAspectRatio ?? 3.0;

  let bestResult: ConcreteOptimizationResult | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  let shearLimitExceededCount = 0;

  for (let bw = minBw; bw <= maxBw; bw += stepBw) {
    for (let h = minH; h <= maxH; h += stepH) {
      const aspect = h / bw;
      if (aspect < minAspect || aspect > maxAspect) {
        continue;
      }

      const trialSection: ConcreteSectionInput = {
        bw: millimeter(bw),
        h: millimeter(h),
        concreteCover: millimeter(coverMm),
        fc: fcMpa,
        longitudinalRebarGrade: longGrade,
        stirrupRebarGrade: stirrupGrade,
        maxAggregateSizeMm: 20,
      };

      // 1. Quick guard check on web crushing limit
      const preliminaryD = h - coverMm - 10 - 10;
      const webCheck = checkShearWebCrushingLimit(bw, preliminaryD, fcMpa, vuAbs);
      if (!webCheck.isAdequate) {
        shearLimitExceededCount++;
        continue; // SECTION_TOO_SMALL_FOR_SHEAR -> try larger dimensions
      }

      // 2. Flexural design
      let flexureRes;
      try {
        flexureRes = designWhitneyFlexure(trialSection, muAbs);
      } catch (err) {
        continue;
      }

      // 3. Shear design using exact effective depth d
      let shearRes;
      try {
        shearRes = designShearStirrups(trialSection, flexureRes.effectiveDepthD, vuAbs);
      } catch (err) {
        if (
          err instanceof ConcreteDesignError &&
          err.parameterName === SECTION_TOO_SMALL_FOR_SHEAR
        ) {
          shearLimitExceededCount++;
        }
        continue;
      }

      // 4. Deflection check (if spanLengthM is provided)
      let deflectionCompliant = true;
      const advisories: string[] = [];

      if (input.spanLengthM && Number(input.spanLengthM) > 0) {
        const spanM = meter(Number(input.spanLengthM));
        const ec = calculateConcreteModulusEc(fcMpa);
        // Gross moment of inertia Ig = bw * h^3 / 12
        const ig = (bw * Math.pow(h, 3)) / 12;
        // Approximate cracked/effective inertia Ie ~ 0.5 * Ig per SNI 2847 Table 6.6.3.1.1(a) for beams
        const ie = 0.5 * ig;
        // Midspan deflection estimate for simple span under uniform load: Delta = 5 * M * L^2 / (48 * E * I)
        const lMm = Number(spanM) * 1000;
        const deltaMm = (5 * (muAbs * 1e6) * Math.pow(lMm, 2)) / (48 * ec * ie);

        const deflEval = evaluateDeflectionCompliance(
          -deltaMm,
          spanM,
          input.deflectionLimitKey ?? "L_360",
        );
        if (!deflEval.isCompliant) {
          deflectionCompliant = false;
          advisories.push(deflEval.advisory);
        }
      }

      const rho = Number(flexureRes.providedAs) / (bw * Number(flexureRes.effectiveDepthD));

      // Cost metric: concrete volume (proportional to bw * h) + equivalent steel penalty
      const concreteAreaScore = bw * h;
      const steelWeightScore = Number(flexureRes.providedAs) * 10;
      const combinedScore = concreteAreaScore + steelWeightScore;

      const isSafe =
        Number(flexureRes.flexuralDcr) <= 1.0 &&
        Number(shearRes.shearDcr) <= 1.0 &&
        deflectionCompliant;

      if (isSafe && combinedScore < bestScore) {
        bestScore = combinedScore;
        bestResult = {
          section: trialSection,
          flexure: flexureRes,
          shear: shearRes,
          reinforcementRatioRho: Number(rho.toFixed(4)),
          isCompliant: true,
          advisories,
        };
      }
    }
  }

  if (!bestResult) {
    throw new ConcreteDesignError(
      "optimizationFailure",
      `Mu=${muAbs} kNm, Vu=${vuAbs} kN within bounds [${minBw}..${maxBw}]x[${minH}..${maxH}] mm`,
      `Could not find a compliant concrete section. ${shearLimitExceededCount > 0 ? `(${shearLimitExceededCount} trials exceeded web shear crushing limit SECTION_TOO_SMALL_FOR_SHEAR).` : ""} Consider increasing allowable beam dimensions or concrete compressive strength fc'.`,
    );
  }

  return bestResult;
}
