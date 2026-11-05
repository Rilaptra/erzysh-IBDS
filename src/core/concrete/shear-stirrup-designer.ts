/**
 * @file shear-stirrup-designer.ts
 * @description Reinforced concrete beam shear stirrup design and detailing engine
 * following SNI 2847:2019 (Pasal 22.5 & Tabel 9.7.6.2.2).
 * Enforces nominal concrete capacity Vc, web crushing limit Vs,max = 0.66 * sqrt(fc') * bw * d,
 * minimum shear reinforcement Av,min, and geometric maximum spacing controls.
 */

import { kilonewton, millimeter, utilizationRatio } from "@/types/branded-units";
import type { Kilonewton, Megapascal, Millimeter, UtilizationRatio } from "@/types/branded-units";
import { ConcreteDesignError } from "@/types/concrete-sni2847-types";
import type {
  ConcreteSectionInput,
  ConcreteShearDesignResult,
  RebarNominalBar,
  RebarSteelGrade,
} from "@/types/concrete-sni2847-types";

import { getNominalBar, getRebarProperties } from "./concrete-grade-converter";

/** Strength reduction factor for shear phi_v per SNI 2847:2019 Tabel 21.2.1. */
export const PHI_SHEAR = 0.75 as const;

/** Concrete density modification factor lambda for normal-weight concrete. */
export const NORMAL_WEIGHT_CONCRETE_LAMBDA = 1.0 as const;

/** Diagnostic error code returned when web crushing limit Vs,max is exceeded. */
export const SECTION_TOO_SMALL_FOR_SHEAR = "SECTION_TOO_SMALL_FOR_SHEAR" as const;

/** Candidate transverse stirrup diameters in mm. */
export const DEFAULT_CANDIDATE_STIRRUP_DIAMETERS: readonly number[] = [8, 10, 12, 13];

/** Configuration options for shear stirrup design. */
export interface ShearDesignerOptions {
  /** Number of vertical shear legs (default: 2 legs for standard closed hoop). */
  readonly stirrupLegs?: number;
  /** Candidate stirrup diameters to evaluate in mm (default: [8, 10, 12, 13]). */
  readonly candidateDiametersMm?: readonly number[];
  /** Preferred rounding increment for detailing spacing in mm (10 or 25, default: 25). */
  readonly spacingRoundingIncrementMm?: 10 | 25;
  /** Minimum permissible practical stirrup spacing in mm (default: 50 mm). */
  readonly minPracticalSpacingMm?: number;
}

/**
 * Checks whether the cross-section dimensions (bw x d) can support factored shear Vu
 * without exceeding the web crushing limit Vs,max per SNI 2847:2019 Pasal 22.5.1.2.
 *
 * @param bw Web width in mm.
 * @param d Effective depth in mm.
 * @param fc Concrete compressive strength in MPa.
 * @param factoredShearVu Factored shear force Vu in kN.
 * @returns Object indicating whether the section is adequate or SECTION_TOO_SMALL_FOR_SHEAR.
 */
export function checkShearWebCrushingLimit(
  bw: number,
  d: number,
  fc: number,
  factoredShearVu: number,
): { readonly isAdequate: boolean; readonly vsMaxKn: number; readonly vuMaxKn: number } {
  const vcKn = 0.17 * NORMAL_WEIGHT_CONCRETE_LAMBDA * Math.sqrt(fc) * bw * d * 1e-3;
  const vsMaxKn = 0.66 * Math.sqrt(fc) * bw * d * 1e-3;
  const vuMaxKn = PHI_SHEAR * (vcKn + vsMaxKn);
  const vuAbs = Math.abs(factoredShearVu);

  return {
    isAdequate: vuAbs <= vuMaxKn + 1e-6,
    vsMaxKn,
    vuMaxKn,
  };
}

/**
 * Designs transverse shear reinforcement (stirrup diameter and spacing) for a reinforced
 * concrete beam section under factored shear force Vu per SNI 2847:2019.
 *
 * @param section Concrete cross-section geometry, concrete strength fc', and rebar grades.
 * @param effectiveDepthD Calculated effective depth d in mm from flexural design.
 * @param factoredShearVu Factored shear force Vu in kN (absolute magnitude used).
 * @param options Transverse detailing options (legs, candidate diameters, rounding increment).
 * @returns Complete ConcreteShearDesignResult with stirrup spacing, capacities, and DCR.
 * @throws {ConcreteDesignError} If Vs exceeds Vs,max with parameterName SECTION_TOO_SMALL_FOR_SHEAR.
 * @example
 * const res = designShearStirrups(concreteSection, millimeter(440), kilonewton(85));
 * console.log(res.stirrupDiameter, res.stirrupSpacing, res.shearDcr);
 */
export function designShearStirrups(
  section: ConcreteSectionInput,
  effectiveDepthD: Millimeter | number,
  factoredShearVu: Kilonewton | number,
  options: ShearDesignerOptions = {},
): ConcreteShearDesignResult {
  const bw = Number(section.bw);
  const d = Number(effectiveDepthD);
  const fc = Number(section.fc);
  const vuAbs = Math.abs(Number(factoredShearVu));

  if (!Number.isFinite(bw) || bw <= 0) {
    throw new ConcreteDesignError("bw", bw, "Beam width must be strictly positive.");
  }
  if (!Number.isFinite(d) || d <= 0) {
    throw new ConcreteDesignError(
      "effectiveDepthD",
      d,
      "Effective depth d must be strictly positive.",
    );
  }
  if (!Number.isFinite(fc) || fc <= 0) {
    throw new ConcreteDesignError(
      "fc",
      fc,
      "Concrete compressive strength must be strictly positive.",
    );
  }

  // Check Web Crushing Limit Vs,max per SNI 2847:2019 Pasal 22.5.1.2
  const check = checkShearWebCrushingLimit(bw, d, fc, vuAbs);
  if (!check.isAdequate) {
    throw new ConcreteDesignError(
      SECTION_TOO_SMALL_FOR_SHEAR,
      `Vu = ${vuAbs.toFixed(1)} kN > phi*(Vc + Vs,max) = ${check.vuMaxKn.toFixed(1)} kN`,
      `Web crushing limit exceeded per SNI 2847:2019 Pasal 22.5.1.2. Section dimensions (${bw}x${Number(section.h)} mm) are too small for shear.`,
    );
  }

  const stirrupGrade = section.stirrupRebarGrade ?? "BJTP_24";
  const stirrupProps = getRebarProperties(stirrupGrade);
  const fyt = Number(stirrupProps.fy);

  const legs = options.stirrupLegs ?? 2;
  const roundingIncrement = options.spacingRoundingIncrementMm ?? 25;
  const minSpacingMm = options.minPracticalSpacingMm ?? 50;

  // 1. Concrete nominal shear capacity Vc (Pasal 22.5.5.1)
  const vcKn = 0.17 * NORMAL_WEIGHT_CONCRETE_LAMBDA * Math.sqrt(fc) * bw * d * 1e-3;
  const phiVcKn = PHI_SHEAR * vcKn;

  // 2. Required stirrup shear capacity Vs (Pasal 22.5.1.1)
  let requiredVsKn = 0;
  if (vuAbs > phiVcKn) {
    requiredVsKn = vuAbs / PHI_SHEAR - vcKn;
  }

  // 3. Spacing limit thresholds based on Vs magnitude (Tabel 9.7.6.2.2)
  const thresholdVsKn = 0.33 * Math.sqrt(fc) * bw * d * 1e-3;
  const sMaxGeometric =
    requiredVsKn <= thresholdVsKn ? Math.min(d / 2.0, 600.0) : Math.min(d / 4.0, 300.0);

  const candidateDiameters = options.candidateDiametersMm ?? DEFAULT_CANDIDATE_STIRRUP_DIAMETERS;

  let bestResult: ConcreteShearDesignResult | null = null;
  let optimalWeightScore = Number.POSITIVE_INFINITY;

  for (const ds of candidateDiameters) {
    let nominalBar: RebarNominalBar;
    try {
      nominalBar = getNominalBar(ds);
    } catch {
      continue;
    }

    const singleBarArea = Number(nominalBar.area);
    const avMm2 = legs * singleBarArea;

    // Required spacing based on strength
    const sStrength = requiredVsKn > 0 ? (avMm2 * fyt * d) / (requiredVsKn * 1e3) : 1000.0;

    // Minimum shear reinforcement spacing per SNI 2847:2019 Pasal 9.6.3.3
    const sMinAv1 = (avMm2 * fyt) / (0.062 * Math.sqrt(fc) * bw);
    const sMinAv2 = (avMm2 * fyt) / (0.35 * bw);
    const sMinReinforcement = Math.min(sMinAv1, sMinAv2);

    let theoreticalSpacing: number;
    if (vuAbs <= 0.5 * phiVcKn) {
      // Theoretical shear reinforcement not needed, provide practical max spacing
      theoreticalSpacing = sMaxGeometric;
    } else if (vuAbs <= phiVcKn) {
      // Minimum shear reinforcement required
      theoreticalSpacing = Math.min(sMinReinforcement, sMaxGeometric);
    } else {
      // Strength requirement governs
      theoreticalSpacing = Math.min(sStrength, sMinReinforcement, sMaxGeometric);
    }

    // Round down to conservative practical spacing increment (e.g. 100, 125, 150 mm)
    let practicalSpacing = Math.floor(theoreticalSpacing / roundingIncrement) * roundingIncrement;
    practicalSpacing = Math.max(minSpacingMm, practicalSpacing);

    if (practicalSpacing > theoreticalSpacing) {
      practicalSpacing -= roundingIncrement;
    }

    if (practicalSpacing < minSpacingMm) {
      // Rebar spacing too congested for this stirrup diameter
      continue;
    }

    // Calculate provided stirrup capacity and DCR
    const providedVsKn = (avMm2 * fyt * d) / (practicalSpacing * 1e3);
    const designPhiVnKn = PHI_SHEAR * (vcKn + providedVsKn);
    const dcr = vuAbs / Math.max(1e-6, designPhiVnKn);

    if (dcr <= 1.0) {
      // Steel weight metric per unit length: Av / spacing
      const weightScore = avMm2 / practicalSpacing;
      if (weightScore < optimalWeightScore) {
        optimalWeightScore = weightScore;
        bestResult = {
          factoredShearVu: kilonewton(Number(vuAbs.toFixed(2))),
          concreteShearStrengthVc: kilonewton(Number(vcKn.toFixed(2))),
          requiredStirrupVs: kilonewton(Number(requiredVsKn.toFixed(2))),
          stirrupLegs: legs,
          stirrupDiameter: millimeter(ds),
          stirrupSpacing: millimeter(practicalSpacing),
          maxPermissibleSpacing: millimeter(Math.round(sMaxGeometric)),
          designShearPhiVn: kilonewton(Number(designPhiVnKn.toFixed(2))),
          shearDcr: utilizationRatio(Number(dcr.toFixed(3))),
        };
      }
    }
  }

  if (!bestResult) {
    throw new ConcreteDesignError(
      SECTION_TOO_SMALL_FOR_SHEAR,
      `bw=${bw} mm, d=${d} mm, Vu=${vuAbs} kN`,
      `Stirrups cannot be detailed within permissible spacing limits (s >= ${minSpacingMm} mm). Enlarge beam cross-section.`,
    );
  }

  return bestResult;
}
