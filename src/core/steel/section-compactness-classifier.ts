/**
 * @file section-compactness-classifier.ts
 * @description Slenderness and compactness classification engine for structural steel
 * IWF and BOX/PSR profiles per Indonesian National Standard SNI 1729:2020 Table B4.1b.
 * Evaluates width-to-thickness ratios (lambda_f, lambda_w) against limiting compactness
 * (lambda_p) and noncompactness (lambda_r) boundaries.
 */

import rawBoxCatalog from "@/data/steel-box-catalog.json";
import rawIwfCatalog from "@/data/steel-iwf-catalog.json";
import type { Millimeter } from "@/types/branded-units";
import { SteelDesignError } from "@/types/steel-sni1729-types";
import type {
  BoxPrimaryDimensions,
  CompactnessClassification,
  IwfPrimaryDimensions,
  SectionCompactnessResult,
  SteelSectionProperties,
} from "@/types/steel-sni1729-types";

/** Default modulus of elasticity E in MPa per SNI 1729:2020 Pasal A3.1. */
export const DEFAULT_STEEL_E_MPA = 200_000 as const;

/** Quick map of primary dimensions by profile name for zero-overhead parameter retrieval. */
const IWF_DIMS_MAP = new Map<string, IwfPrimaryDimensions>(
  (rawIwfCatalog as unknown as readonly IwfPrimaryDimensions[]).map((d) => [d.name, d]),
);
const BOX_DIMS_MAP = new Map<string, BoxPrimaryDimensions>(
  (rawBoxCatalog as unknown as readonly BoxPrimaryDimensions[]).map((d) => [d.name, d]),
);

/**
 * Classifies an individual width-to-thickness ratio lambda against limiting ratios lambda_p and lambda_r.
 *
 * @param lambda Width-to-thickness ratio.
 * @param lambdaP Limiting compactness ratio (compact if lambda <= lambdaP).
 * @param lambdaR Limiting noncompactness ratio (noncompact if lambdaP < lambda <= lambdaR, slender if > lambdaR).
 * @returns CompactnessClassification enum ("COMPACT" | "NON_COMPACT" | "SLENDER").
 */
export function classifySlenderness(
  lambda: number,
  lambdaP: number,
  lambdaR: number,
): CompactnessClassification {
  if (lambda <= lambdaP + 1e-6) {
    return "COMPACT";
  }
  if (lambda <= lambdaR + 1e-6) {
    return "NON_COMPACT";
  }
  return "SLENDER";
}

/**
 * Resolves the overall governing section classification from flange and web classifications.
 * The most severe condition governs: SLENDER > NON_COMPACT > COMPACT.
 *
 * @param flange Flange classification.
 * @param web Web classification.
 * @returns Governing section classification.
 */
export function getGoverningCompactness(
  flange: CompactnessClassification,
  web: CompactnessClassification,
): CompactnessClassification {
  if (flange === "SLENDER" || web === "SLENDER") {
    return "SLENDER";
  }
  if (flange === "NON_COMPACT" || web === "NON_COMPACT") {
    return "NON_COMPACT";
  }
  return "COMPACT";
}

/**
 * Evaluates the compactness of a structural steel IWF or BOX profile under flexure
 * according to SNI 1729:2020 Table B4.1b.
 *
 * - For IWF (Case 10 & 15):
 *   Flange: lambda_f = b_f / (2 * t_f), lambda_pf = 0.38 * sqrt(E / Fy), lambda_rf = 1.00 * sqrt(E / Fy)
 *   Web:    lambda_w = h_c / t_w,       lambda_pw = 3.76 * sqrt(E / Fy), lambda_rw = 5.70 * sqrt(E / Fy)
 *
 * - For BOX / PSR (Case 13 & 14, Note d):
 *   Flange: lambda_f = b_flat / t,      lambda_pf = 1.12 * sqrt(E / Fy), lambda_rf = 1.40 * sqrt(E / Fy)
 *   Web:    lambda_w = h_flat / t,      lambda_pw = 2.42 * sqrt(E / Fy), lambda_rw = 5.70 * sqrt(E / Fy)
 *
 * @param section Section properties or primary dimensions of the steel profile.
 * @param fy Minimum yield stress Fy in MPa (must be > 0).
 * @param modulusOfElasticityE Modulus of elasticity E in MPa (default: 200,000 MPa).
 * @param explicitDims Optional explicit primary dimensions override.
 * @returns Complete SectionCompactnessResult.
 * @throws {SteelDesignError} If Fy <= 0 or geometry dimensions are physically invalid.
 * @example
 * const compactness = classifySectionCompactness(iwfSection, 240);
 * console.log(compactness.flangeClassification, compactness.governingClassification);
 */
export function classifySectionCompactness(
  section: SteelSectionProperties,
  fy: number,
  modulusOfElasticityE: number = DEFAULT_STEEL_E_MPA,
  explicitDims?: IwfPrimaryDimensions | BoxPrimaryDimensions,
): SectionCompactnessResult {
  if (!Number.isFinite(fy) || fy <= 0) {
    throw new SteelDesignError(
      section.name,
      "classifySectionCompactness",
      `Yield stress Fy must be strictly positive. Received: ${fy} MPa.`,
    );
  }
  if (!Number.isFinite(modulusOfElasticityE) || modulusOfElasticityE <= 0) {
    throw new SteelDesignError(
      section.name,
      "classifySectionCompactness",
      `Modulus of elasticity E must be strictly positive. Received: ${modulusOfElasticityE} MPa.`,
    );
  }

  const sqrtEOverFy = Math.sqrt(modulusOfElasticityE / fy);

  if (section.profileType === "IWF") {
    const dims =
      (explicitDims as IwfPrimaryDimensions) ??
      IWF_DIMS_MAP.get(section.name) ??
      (section.H && section.B && section.tw && section.tf
        ? ({
            name: section.name,
            H: section.H,
            B: section.B,
            tw: section.tw,
            tf: section.tf,
            r: section.r ?? (0 as Millimeter),
          } as IwfPrimaryDimensions)
        : undefined);
    if (!dims) {
      throw new SteelDesignError(
        section.name,
        "classifySectionCompactness",
        `Primary dimensions for IWF profile '${section.name}' not found. Provide explicitDims.`,
      );
    }

    const bf = Number(dims.B);
    const tf = Number(dims.tf);
    const tw = Number(dims.tw);
    const hc = Number(section.hc);

    // Table B4.1b Case 10 (Flanges of rolled I-shaped sections in flexure)
    const lambdaF = bf / (2.0 * tf);
    const lambdaPf = 0.38 * sqrtEOverFy;
    const lambdaRf = 1.0 * sqrtEOverFy;

    // Table B4.1b Case 15 (Webs of doubly symmetric I-shaped sections in pure flexure)
    const lambdaW = hc / tw;
    const lambdaPw = 3.76 * sqrtEOverFy;
    const lambdaRw = 5.7 * sqrtEOverFy;

    const flangeClassification = classifySlenderness(lambdaF, lambdaPf, lambdaRf);
    const webClassification = classifySlenderness(lambdaW, lambdaPw, lambdaRw);
    const governingClassification = getGoverningCompactness(
      flangeClassification,
      webClassification,
    );

    return {
      flangeClassification,
      webClassification,
      governingClassification,
      lambdaF: Number(lambdaF.toFixed(3)),
      lambdaPf: Number(lambdaPf.toFixed(3)),
      lambdaRf: Number(lambdaRf.toFixed(3)),
      lambdaW: Number(lambdaW.toFixed(3)),
      lambdaPw: Number(lambdaPw.toFixed(3)),
      lambdaRw: Number(lambdaRw.toFixed(3)),
    };
  }

  // BOX / PSR Profile
  const dims =
    (explicitDims as BoxPrimaryDimensions) ??
    BOX_DIMS_MAP.get(section.name) ??
    (section.H && section.B && (section.t || section.tw)
      ? ({
          name: section.name,
          H: section.H,
          B: section.B,
          t: (section.t ?? section.tw) as Millimeter,
          shapeType: section.H === section.B ? "SQUARE" : "RECTANGULAR",
        } as BoxPrimaryDimensions)
      : undefined);
  if (!dims) {
    throw new SteelDesignError(
      section.name,
      "classifySectionCompactness",
      `Primary dimensions for BOX profile '${section.name}' not found. Provide explicitDims.`,
    );
  }

  const b = Number(dims.B);
  const h = Number(dims.H);
  const t = Number(dims.t);

  // Table B4.1b Note d: b_flat = B - 3*t, h_flat = H - 3*t
  const bFlat = Math.max(1.0, b - 3.0 * t);
  const hFlat = Math.max(1.0, h - 3.0 * t);

  // Table B4.1b Case 13 (Flanges of rectangular HSS in flexure)
  const lambdaF = bFlat / t;
  const lambdaPf = 1.12 * sqrtEOverFy;
  const lambdaRf = 1.4 * sqrtEOverFy;

  // Table B4.1b Case 14 (Webs of rectangular HSS in flexure)
  const lambdaW = hFlat / t;
  const lambdaPw = 2.42 * sqrtEOverFy;
  const lambdaRw = 5.7 * sqrtEOverFy;

  const flangeClassification = classifySlenderness(lambdaF, lambdaPf, lambdaRf);
  const webClassification = classifySlenderness(lambdaW, lambdaPw, lambdaRw);
  const governingClassification = getGoverningCompactness(flangeClassification, webClassification);

  return {
    flangeClassification,
    webClassification,
    governingClassification,
    lambdaF: Number(lambdaF.toFixed(3)),
    lambdaPf: Number(lambdaPf.toFixed(3)),
    lambdaRf: Number(lambdaRf.toFixed(3)),
    lambdaW: Number(lambdaW.toFixed(3)),
    lambdaPw: Number(lambdaPw.toFixed(3)),
    lambdaRw: Number(lambdaRw.toFixed(3)),
  };
}
