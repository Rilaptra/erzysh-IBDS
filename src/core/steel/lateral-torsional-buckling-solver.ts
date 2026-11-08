/**
 * @file lateral-torsional-buckling-solver.ts
 * @description Lateral-Torsional Buckling (LTB) and nominal flexural strength solver
 * for structural steel IWF and BOX profiles per SNI 1729:2020 Chapter F (Pasal F2, F3, F7).
 * Evaluates Zones 1 (Plastic), 2 (Inelastic LTB), and 3 (Elastic LTB) as well as
 * Flange/Web Local Buckling (FLB/WLB) limits.
 */

import { kilonewtonMeter, millimeter } from "@/types/branded-units";
import type { KilonewtonMeter, Millimeter } from "@/types/branded-units";
import { SteelDesignError } from "@/types/steel-sni1729-types";
import type {
  LateralTorsionalBucklingResult,
  SteelSectionProperties,
} from "@/types/steel-sni1729-types";

import { classifySectionCompactness, DEFAULT_STEEL_E_MPA } from "./section-compactness-classifier";

/** Resistance factor for flexure phi_b per SNI 1729:2020 Pasal F1. */
export const PHI_B = 0.9 as const;

/**
 * Options for Lateral-Torsional Buckling evaluation.
 */
export interface LtbSolverOptions {
  /** Moment gradient modifier Cb per SNI 1729:2020 Eq. (F1-1). Default: 1.0 (conservative). */
  readonly momentGradientCb?: number;
  /** Modulus of elasticity E in MPa (default: 200,000 MPa). */
  readonly modulusOfElasticityE?: number;
}

/**
 * Evaluates the nominal flexural strength Mn and design flexural strength phi_b * Mn
 * of a structural steel profile (IWF or BOX) under strong-axis bending for a given
 * unbraced length Lb according to SNI 1729:2020 Chapters F2, F3, and F7.
 *
 * @param section Section properties of the steel profile (IWF or BOX).
 * @param fy Minimum yield stress Fy in MPa (must be > 0).
 * @param unbracedLengthLb Unbraced span length Lb in mm (Lb >= 0).
 * @param options Optional Cb modifier (default: 1.0) and E modulus.
 * @returns Complete LateralTorsionalBucklingResult with Lp, Lr, governingZone, Mn, and phi*Mn.
 * @throws {SteelDesignError} If Fy <= 0, Lb < 0, or sectional parameters are invalid.
 * @example
 * const ltb = solveLateralTorsionalBuckling(iwfSection, 240, 3000);
 * console.log(ltb.governingZone, ltb.designFlexuralPhiMn);
 */
export function solveLateralTorsionalBuckling(
  section: SteelSectionProperties,
  fy: number,
  unbracedLengthLb: Millimeter | number,
  options: LtbSolverOptions = {},
): LateralTorsionalBucklingResult {
  const lbMm = Number(unbracedLengthLb);
  const cb = options.momentGradientCb ?? 1.0;
  const eMpa = options.modulusOfElasticityE ?? DEFAULT_STEEL_E_MPA;

  if (!Number.isFinite(fy) || fy <= 0) {
    throw new SteelDesignError(
      section.name,
      "solveLateralTorsionalBuckling",
      `Yield stress Fy must be strictly positive. Received: ${fy} MPa.`,
    );
  }
  if (!Number.isFinite(lbMm) || lbMm < 0) {
    throw new SteelDesignError(
      section.name,
      "solveLateralTorsionalBuckling",
      `Unbraced length Lb cannot be negative. Received: ${lbMm} mm.`,
    );
  }
  if (!Number.isFinite(cb) || cb <= 0) {
    throw new SteelDesignError(
      section.name,
      "solveLateralTorsionalBuckling",
      `Moment gradient factor Cb must be strictly positive. Received: ${cb}.`,
    );
  }

  const zxMm3 = Number(section.Zx);
  const sxMm3 = Number(section.Sx);
  const ryMm = Number(section.ry);
  const jMm4 = Number(section.J);
  const h0Mm = Number(section.h0);

  // Plastic moment Mp in kNm
  const mpKnm = (fy * zxMm3) / 1_000_000;

  const compactness = classifySectionCompactness(section, fy, eMpa);

  if (section.profileType === "IWF") {
    // ------------------------------------------------------------------------
    // IWF Profiles (SNI 1729:2020 Pasal F2 & F3)
    // ------------------------------------------------------------------------
    const rtsMm = Number(section.rts);
    const c = 1.0; // Doubly symmetric I-shapes

    // Eq. (F2-5): Lp = 1.76 * ry * sqrt(E / Fy)
    const lpMm = 1.76 * ryMm * Math.sqrt(eMpa / fy);

    // Eq. (F2-6): Lr calculation
    const term1 = (jMm4 * c) / (sxMm3 * h0Mm);
    const term2 = 6.76 * Math.pow((0.7 * fy) / eMpa, 2);
    const sqrtInside = Math.sqrt(term1 * term1 + term2);
    const lrMm = 1.95 * rtsMm * (eMpa / (0.7 * fy)) * Math.sqrt(term1 + sqrtInside);

    let mnLtbKnm: number;
    let governingZone: "ZONE_1_PLASTIC" | "ZONE_2_INELASTIC_LTB" | "ZONE_3_ELASTIC_LTB";

    if (lbMm <= lpMm + 1e-6) {
      // Zone 1: Full Plastic Moment (Eq. F2-1)
      governingZone = "ZONE_1_PLASTIC";
      mnLtbKnm = mpKnm;
    } else if (lbMm <= lrMm + 1e-6) {
      // Zone 2: Inelastic LTB (Eq. F2-2)
      governingZone = "ZONE_2_INELASTIC_LTB";
      const m07Knm = (0.7 * fy * sxMm3) / 1_000_000;
      const slope = (lbMm - lpMm) / (lrMm - lpMm);
      mnLtbKnm = cb * (mpKnm - (mpKnm - m07Knm) * slope);
      mnLtbKnm = Math.min(mpKnm, mnLtbKnm);
    } else {
      // Zone 3: Elastic LTB (Eq. F2-3 & F2-4)
      governingZone = "ZONE_3_ELASTIC_LTB";
      const slendernessLtb = lbMm / rtsMm;
      const fcrTerm =
        1.0 + 0.078 * ((jMm4 * c) / (sxMm3 * h0Mm)) * (slendernessLtb * slendernessLtb);
      const fcrMpa =
        ((cb * Math.PI * Math.PI * eMpa) / (slendernessLtb * slendernessLtb)) *
        Math.sqrt(Math.max(1.0, fcrTerm));
      mnLtbKnm = Math.min(mpKnm, (fcrMpa * sxMm3) / 1_000_000);
    }

    // Flange Local Buckling (FLB) Check per Pasal F3.2
    let mnFlbKnm = mpKnm;
    if (compactness.flangeClassification === "NON_COMPACT") {
      // Eq. (F3-1)
      const m07Knm = (0.7 * fy * sxMm3) / 1_000_000;
      const flbRatio =
        (compactness.lambdaF - compactness.lambdaPf) /
        (compactness.lambdaRf - compactness.lambdaPf);
      mnFlbKnm = mpKnm - (mpKnm - m07Knm) * flbRatio;
    } else if (compactness.flangeClassification === "SLENDER") {
      // Eq. (F3-2)
      const hcMm = Number(section.hc);
      const twEst = section.name.includes("WF") ? 6.0 : 6.0;
      const kc = Math.min(0.76, Math.max(0.35, 4.0 / Math.sqrt(hcMm / twEst)));
      mnFlbKnm =
        (0.9 * eMpa * kc * sxMm3) / (compactness.lambdaF * compactness.lambdaF * 1_000_000);
    }

    const nominalMnKnm = Math.min(mnLtbKnm, mnFlbKnm);
    const designPhiMnKnm = PHI_B * nominalMnKnm;

    return {
      unbracedLengthLb: millimeter(lbMm),
      plasticLengthLp: millimeter(Math.round(lpMm * 10) / 10),
      inelasticLengthLr: millimeter(Math.round(lrMm * 10) / 10),
      momentGradientCb: cb,
      governingZone,
      nominalFlexuralMn: kilonewtonMeter(Number(nominalMnKnm.toFixed(2))),
      designFlexuralPhiMn: kilonewtonMeter(Number(designPhiMnKnm.toFixed(2))),
    };
  }

  // --------------------------------------------------------------------------
  // BOX / PSR Profiles (SNI 1729:2020 Pasal F7)
  // --------------------------------------------------------------------------
  const agMm2 = Number(section.area);

  // Eq. (F7-12): Lp = 0.13 * E * ry * sqrt(J * Ag) / Mp
  const mpNmm = mpKnm * 1_000_000;
  const lpMm = (0.13 * eMpa * ryMm * Math.sqrt(jMm4 * agMm2)) / mpNmm;

  // Eq. (F7-13): Lr = 2 * E * ry * sqrt(J * Ag) / (0.7 * Fy * Sx)
  const lrMm = (2.0 * eMpa * ryMm * Math.sqrt(jMm4 * agMm2)) / (0.7 * fy * sxMm3);

  let mnLtbKnm: number;
  let governingZone: "ZONE_1_PLASTIC" | "ZONE_2_INELASTIC_LTB" | "ZONE_3_ELASTIC_LTB";

  if (lbMm <= lpMm + 1e-6) {
    governingZone = "ZONE_1_PLASTIC";
    mnLtbKnm = mpKnm;
  } else if (lbMm <= lrMm + 1e-6) {
    governingZone = "ZONE_2_INELASTIC_LTB";
    const m07Knm = (0.7 * fy * sxMm3) / 1_000_000;
    const slope = (lbMm - lpMm) / (lrMm - lpMm);
    mnLtbKnm = cb * (mpKnm - (mpKnm - m07Knm) * slope);
    mnLtbKnm = Math.min(mpKnm, mnLtbKnm);
  } else {
    governingZone = "ZONE_3_ELASTIC_LTB";
    const slenderness = lbMm / ryMm;
    mnLtbKnm = ((2.0 * eMpa * cb * Math.sqrt(jMm4 * agMm2)) / slenderness) * 1e-6;
    mnLtbKnm = Math.min(mpKnm, mnLtbKnm);
  }

  // Flange Local Buckling Check for HSS per Eq. (F7-2) & (F7-3)
  let mnFlbKnm = mpKnm;
  if (compactness.flangeClassification === "NON_COMPACT") {
    const myKnm = (fy * sxMm3) / 1_000_000;
    const flbFactor = 3.57 * compactness.lambdaF * Math.sqrt(fy / eMpa) - 4.0;
    mnFlbKnm = mpKnm - (mpKnm - myKnm) * flbFactor;
    mnFlbKnm = Math.min(mpKnm, mnFlbKnm);
  } else if (compactness.flangeClassification === "SLENDER") {
    // Effective flange width be per Eq. (F7-4)
    const factor = (0.38 / compactness.lambdaF) * Math.sqrt(eMpa / fy);
    const beRatio = Math.min(1.0, Math.max(0.2, 1.0 - factor));
    mnFlbKnm = (fy * (sxMm3 * beRatio)) / 1_000_000;
  }

  // Web Local Buckling Check for HSS per Eq. (F7-6)
  let mnWlbKnm = mpKnm;
  if (compactness.webClassification === "NON_COMPACT") {
    const myKnm = (fy * sxMm3) / 1_000_000;
    const wlbFactor = 0.305 * compactness.lambdaW * Math.sqrt(fy / eMpa) - 0.738;
    mnWlbKnm = mpKnm - (mpKnm - myKnm) * wlbFactor;
    mnWlbKnm = Math.min(mpKnm, mnWlbKnm);
  }

  const nominalMnKnm = Math.min(mnLtbKnm, mnFlbKnm, mnWlbKnm);
  const designPhiMnKnm = PHI_B * nominalMnKnm;

  return {
    unbracedLengthLb: millimeter(lbMm),
    plasticLengthLp: millimeter(Math.round(lpMm * 10) / 10),
    inelasticLengthLr: millimeter(Math.round(lrMm * 10) / 10),
    momentGradientCb: cb,
    governingZone,
    nominalFlexuralMn: kilonewtonMeter(Number(nominalMnKnm.toFixed(2))),
    designFlexuralPhiMn: kilonewtonMeter(Number(designPhiMnKnm.toFixed(2))),
  };
}
