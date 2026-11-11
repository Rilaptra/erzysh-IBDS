/**
 * @file steel-torsion-shear-evaluator.ts
 * @description Transverse shear capacity (Chapter G) and torsional strength evaluation
 * (Chapter H3) for structural steel IWF and BOX profiles per SNI 1729:2020.
 * Evaluates HSS critical torsional stress Fcr, torsional constant C, and combined
 * interaction Equation (H3-6) when Tu > 0.20 * phi_T * Tn.
 */

import rawBoxCatalog from "@/data/steel-box-catalog.json";
import rawIwfCatalog from "@/data/steel-iwf-catalog.json";
import { kilonewton, kilonewtonMeter, utilizationRatio } from "@/types/branded-units";
import type { Kilonewton, KilonewtonMeter, UtilizationRatio } from "@/types/branded-units";
import { SteelDesignError } from "@/types/steel-sni1729-types";
import type {
  BoxPrimaryDimensions,
  IwfPrimaryDimensions,
  SteelSectionProperties,
} from "@/types/steel-sni1729-types";

import type { BoxSectionProperties } from "./iwf-geometric-properties";
import { DEFAULT_STEEL_E_MPA } from "./section-compactness-classifier";

/** Resistance factor for shear phi_v per SNI 1729:2020 Pasal G1. */
export const PHI_SHEAR_STEEL = 0.9 as const;

/** Resistance factor for torsion phi_T per SNI 1729:2020 Pasal H3.1. */
export const PHI_TORSION_STEEL = 0.9 as const;

/** Quick map of primary dimensions by profile name. */
const IWF_DIMS_MAP = new Map<string, IwfPrimaryDimensions>(
  (rawIwfCatalog as unknown as readonly IwfPrimaryDimensions[]).map((d) => [d.name, d]),
);
const BOX_DIMS_MAP = new Map<string, BoxPrimaryDimensions>(
  (rawBoxCatalog as unknown as readonly BoxPrimaryDimensions[]).map((d) => [d.name, d]),
);

/** Result of shear capacity evaluation per Chapter G. */
export interface SteelShearCapacityResult {
  /** Nominal shear capacity Vn in kN. */
  readonly nominalShearVn: Kilonewton;
  /** Design shear capacity phi_v * Vn in kN. */
  readonly designShearPhiVn: Kilonewton;
  /** Web shear coefficient Cv1. */
  readonly webShearCv: number;
  /** Shear Demand-to-Capacity Ratio (Vu / phi_v*Vn). */
  readonly shearDcr: UtilizationRatio;
}

/** Result of torsion capacity and interaction evaluation per Chapter H3. */
export interface SteelTorsionCapacityResult {
  /** Nominal torsional capacity Tn in kNm. */
  readonly nominalTorsionTn: KilonewtonMeter;
  /** Design torsional capacity phi_T * Tn in kNm. */
  readonly designTorsionPhiTn: KilonewtonMeter;
  /** Critical torsional stress Fcr in MPa. */
  readonly criticalStressFcrMpa: number;
  /** Torsional constant C in mm³ (for BOX) or equivalent. */
  readonly torsionalConstantC: number;
  /** Torsion threshold ratio Tu / (phi_T * Tn). */
  readonly torsionRatio: number;
  /** Whether torsional effect is negligible (Tu <= 0.20 * phi_T * Tn per Pasal H3.2). */
  readonly isTorsionNegligible: boolean;
  /** Combined shear-torsion-flexure interaction ratio per Eq. (H3-6) (when Tu > 0.20*phi*Tn). */
  readonly combinedH3Dcr: UtilizationRatio;
}

/**
 * Calculates the nominal and design shear capacity of a steel profile according to SNI 1729:2020 Chapter G.
 *
 * @param section Steel section properties (IWF or BOX).
 * @param fy Minimum yield stress Fy in MPa.
 * @param factoredShearVu Factored shear force Vu in kN.
 * @param modulusOfElasticityE Modulus of elasticity E in MPa (default: 200,000 MPa).
 * @returns SteelShearCapacityResult with Vn, phi*Vn, and shearDcr.
 * @throws {SteelDesignError} If Fy <= 0 or geometry is invalid.
 * @example
 * const shear = evaluateSteelShear(iwfSection, 240, 150);
 * console.log(shear.designShearPhiVn, shear.shearDcr);
 */
export function evaluateSteelShear(
  section: SteelSectionProperties,
  fy: number,
  factoredShearVu: Kilonewton | number,
  modulusOfElasticityE: number = DEFAULT_STEEL_E_MPA,
): SteelShearCapacityResult {
  const vuAbs = Math.abs(Number(factoredShearVu));

  if (!Number.isFinite(fy) || fy <= 0) {
    throw new SteelDesignError(
      section.name,
      "evaluateSteelShear",
      `Yield stress Fy must be strictly positive. Received: ${fy} MPa.`,
    );
  }

  let awMm2: number;
  let cv = 1.0;
  let phiV: number = PHI_SHEAR_STEEL;

  if (section.profileType === "IWF") {
    const dims = IWF_DIMS_MAP.get(section.name);
    const h = dims ? Number(dims.H) : Number(section.H ?? section.h0);
    const tw = dims ? Number(dims.tw) : Number(section.tw ?? 6.0);
    awMm2 = h * tw;

    // SNI 1729:2020 Pasal G2.1a: rolled I-shapes with h/tw <= 2.24*sqrt(E/Fy) have phi_v = 1.0, Cv1 = 1.0
    const limit = 2.24 * Math.sqrt(modulusOfElasticityE / fy);
    const slenderness = Number(section.hc) / tw;
    if (slenderness <= limit) {
      phiV = 1.0;
      cv = 1.0;
    } else {
      phiV = 0.9;
      cv = Math.min(1.0, limit / slenderness);
    }
  } else {
    // BOX Profile (Pasal G4)
    const dims = BOX_DIMS_MAP.get(section.name);
    const h = dims ? Number(dims.H) : Number(section.H ?? section.h0);
    const t = dims ? Number(dims.t) : Number(section.t ?? section.tw ?? 6.0);
    const hFlat = Math.max(1.0, h - 3.0 * t);
    awMm2 = 2.0 * hFlat * t; // 2 vertical shear webs
    phiV = 0.9;
    cv = 1.0;
  }

  // Nominal shear capacity Vn = 0.6 * Fy * Aw * Cv (kN)
  const vnKn = 0.6 * fy * awMm2 * cv * 1e-3;
  const phiVnKn = phiV * vnKn;
  const dcr = vuAbs / Math.max(1e-6, phiVnKn);

  return {
    nominalShearVn: kilonewton(Number(vnKn.toFixed(1))),
    designShearPhiVn: kilonewton(Number(phiVnKn.toFixed(1))),
    webShearCv: cv,
    shearDcr: utilizationRatio(Number(dcr.toFixed(3))),
  };
}

/**
 * Evaluates the nominal and design torsional capacity of a steel profile per SNI 1729:2020 Chapter H3.
 *
 * For BOX / PSR profiles:
 * - Tn = Fcr * C (Eq. H3-1)
 * - Fcr determined by Eq. (H3-3), (H3-4), (H3-5)
 * - If Tu > 0.20 * phi_T * Tn, evaluates combined interaction Eq. (H3-6)
 *
 * @param section Steel section properties (IWF or BOX).
 * @param fy Minimum yield stress Fy in MPa.
 * @param factoredTorsionTu Factored torsional moment Tu in kNm.
 * @param axialFlexuralRatio Combined (Pr/Pc + Mr/Mc) ratio for Eq. (H3-6).
 * @param shearRatio Factored shear ratio (Vr / Vc).
 * @param modulusOfElasticityE Modulus of elasticity E in MPa.
 * @returns Complete SteelTorsionCapacityResult.
 * @throws {SteelDesignError} If parameters are non-finite or non-positive.
 * @example
 * const torsion = evaluateSteelTorsion(boxSection, 240, 5.0, 0.6, 0.3);
 * console.log(torsion.isTorsionNegligible, torsion.combinedH3Dcr);
 */
export function evaluateSteelTorsion(
  section: SteelSectionProperties,
  fy: number,
  factoredTorsionTu: KilonewtonMeter | number,
  axialFlexuralRatio = 0.0,
  shearRatio = 0.0,
  modulusOfElasticityE: number = DEFAULT_STEEL_E_MPA,
): SteelTorsionCapacityResult {
  const tuAbs = Math.abs(Number(factoredTorsionTu));

  if (!Number.isFinite(fy) || fy <= 0) {
    throw new SteelDesignError(
      section.name,
      "evaluateSteelTorsion",
      `Yield stress Fy must be strictly positive. Received: ${fy} MPa.`,
    );
  }

  let tnKnm = 0;
  let fcrMpa = 0.6 * fy;
  let cMm3 = 0;

  if (section.profileType === "BOX") {
    const boxProps = section as BoxSectionProperties;
    const dims = BOX_DIMS_MAP.get(section.name);
    const h = dims ? Number(dims.H) : Number(section.H ?? section.h0);
    const t = dims ? Number(dims.t) : Number(section.t ?? section.tw ?? 6.0);

    // HSS Torsional constant C in mm³
    cMm3 = boxProps.C ? Number(boxProps.C) : 2.0 * (h - t) * (h - t) * t;

    // Critical torsional stress Fcr per SNI 1729:2020 Eq. (H3-3) s/d (H3-5)
    const htRatio = (h - 3.0 * t) / t;
    const limit1 = 2.45 * Math.sqrt(modulusOfElasticityE / fy);
    const limit2 = 3.07 * Math.sqrt(modulusOfElasticityE / fy);

    if (htRatio <= limit1) {
      fcrMpa = 0.6 * fy;
    } else if (htRatio <= limit2) {
      fcrMpa = (0.6 * fy * limit1) / htRatio;
    } else {
      fcrMpa = (0.458 * Math.PI * Math.PI * modulusOfElasticityE) / (htRatio * htRatio);
    }

    // Nominal torsional strength Tn = Fcr * C (kNm)
    tnKnm = (fcrMpa * cMm3) / 1_000_000;
  } else {
    // IWF Open Profile: approximate torsional yield capacity based on thin web/flange St. Venant J
    const jMm4 = Number(section.J);
    const dims = IWF_DIMS_MAP.get(section.name);
    const tf = dims ? Number(dims.tf) : Number(section.tf ?? 10.0);
    cMm3 = jMm4 / tf;
    fcrMpa = 0.6 * fy;
    tnKnm = (fcrMpa * cMm3) / 1_000_000;
  }

  const phiTnKnm = PHI_TORSION_STEEL * tnKnm;
  const torsionRatio = tuAbs / Math.max(1e-6, phiTnKnm);

  // Pasal H3.2: When Tu <= 0.20 * phi_T * Tn, torsion effects can be neglected
  const isTorsionNegligible = torsionRatio <= 0.2;

  let combinedH3Dcr = Math.max(axialFlexuralRatio, torsionRatio);

  if (!isTorsionNegligible && section.profileType === "BOX") {
    // Eq. (H3-6): (Pr/Pc + Mr/Mc) + (Vr/Vc + Tr/Tc)^2 <= 1.0
    const termShearTorsion = shearRatio + torsionRatio;
    combinedH3Dcr = axialFlexuralRatio + termShearTorsion * termShearTorsion;
  }

  return {
    nominalTorsionTn: kilonewtonMeter(Number(tnKnm.toFixed(2))),
    designTorsionPhiTn: kilonewtonMeter(Number(phiTnKnm.toFixed(2))),
    criticalStressFcrMpa: Number(fcrMpa.toFixed(1)),
    torsionalConstantC: Math.round(cMm3),
    torsionRatio: Number(torsionRatio.toFixed(4)),
    isTorsionNegligible,
    combinedH3Dcr: utilizationRatio(Number(combinedH3Dcr.toFixed(4))),
  };
}
