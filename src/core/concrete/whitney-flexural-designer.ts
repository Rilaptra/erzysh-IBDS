/**
 * @file whitney-flexural-designer.ts
 * @description Reinforced concrete beam flexural design and detailing engine
 * following the equivalent rectangular Whitney stress block per SNI 2847:2019.
 * Evaluates tension-controlled ductilities (epsilon_t >= 0.005), minimum steel ratios (As,min),
 * automatic 1- or 2-layer rebar arrangements with clear spacing verification,
 * and effective depth (d) centroid recalculations.
 */

import { kilonewtonMeter, millimeter, utilizationRatio } from "@/types/branded-units";
import type {
  KilonewtonMeter,
  Megapascal,
  Millimeter,
  MillimeterSquared,
  UtilizationRatio,
} from "@/types/branded-units";
import { ConcreteDesignError } from "@/types/concrete-sni2847-types";
import type {
  ConcreteFlexuralDesignResult,
  ConcreteSectionInput,
  ConcreteSectionTensionStatus,
  RebarLayerArrangement,
  RebarNominalBar,
  RebarSteelGrade,
} from "@/types/concrete-sni2847-types";

import {
  calculateWhitneyBeta1,
  CONCRETE_EPSILON_CU,
  getNominalBar,
  getRebarProperties,
  REBAR_ELASTIC_MODULUS_ES_MPA,
  STANDARD_NOMINAL_BARS,
} from "./concrete-grade-converter";

/** Default candidate longitudinal bar diameters in mm. */
export const DEFAULT_CANDIDATE_BAR_DIAMETERS: readonly number[] = [13, 16, 19, 22, 25, 29, 32];

/** Options configuring Whitney flexural design calculation. */
export interface FlexuralDesignerOptions {
  /** Transverse stirrup bar diameter in mm (default: 10 mm). */
  readonly stirrupDiameterMm?: number;
  /** Compression rebar nominal diameter in mm (default: 13 mm). */
  readonly compressionRebarDiameterMm?: number;
  /** Candidate longitudinal bar diameters to evaluate (default: [13, 16, 19, 22, 25, 29, 32]). */
  readonly candidateBarDiametersMm?: readonly number[];
  /** Minimum vertical clear distance between layers 1 and 2 in mm (default: 25 mm per SNI 2847 Pasal 25.2.2). */
  readonly verticalLayerSpacingMm?: number;
}

/** Internal layer layout computation result. */
interface LayerLayout {
  readonly layerCount: 1 | 2;
  readonly barsPerLayer: readonly number[];
  readonly clearSpacingPerLayer: readonly number[];
  readonly effectiveCentroidFromBottomMm: number;
  readonly effectiveDepthDMm: number;
}

/**
 * Calculates the layer arrangement and effective depth d for n bars of diameter db on width bw.
 * Per SNI 2847:2019 Pasal 25.2.1 and 25.2.2:
 * - Minimum horizontal clear spacing: s_clean,min = max(db, 25 mm, 1.33 * maxAggregateSize).
 * - If n exceeds 1-layer capacity, automatically splits into 2 layers with a 25 mm vertical clear gap
 *   and recomputes the centroidal effective depth d.
 *
 * @param bw Beam web width in mm.
 * @param h Total beam height in mm.
 * @param barCount Total number of tensile bars (n >= 2).
 * @param db Bar diameter in mm.
 * @param coverMm Clear concrete cover in mm.
 * @param stirrupDiaMm Stirrup bar diameter in mm.
 * @param maxAggSizeMm Maximum aggregate size in mm.
 * @param vertSpacingMm Vertical gap between layers in mm.
 * @returns LayerLayout metadata or null if bars cannot physically fit within 2 layers.
 */
function computeTensileLayerLayout(
  bw: number,
  h: number,
  barCount: number,
  db: number,
  coverMm: number,
  stirrupDiaMm: number,
  maxAggSizeMm: number,
  vertSpacingMm: number,
): LayerLayout | null {
  const minClearSpacing = Math.max(db, 25.0, 1.33 * maxAggSizeMm);
  const availWidth = bw - 2.0 * (coverMm + stirrupDiaMm);

  if (availWidth < db) {
    return null;
  }

  // Maximum number of bars that fit in 1 single horizontal layer
  const maxBarsInOneLayer = Math.max(
    1,
    Math.floor((availWidth + minClearSpacing) / (db + minClearSpacing)),
  );

  const y1 = coverMm + stirrupDiaMm + 0.5 * db;

  if (barCount <= maxBarsInOneLayer) {
    const clearSpace =
      barCount > 1 ? (availWidth - barCount * db) / (barCount - 1) : availWidth - db;
    return {
      layerCount: 1,
      barsPerLayer: [barCount],
      clearSpacingPerLayer: [clearSpace],
      effectiveCentroidFromBottomMm: y1,
      effectiveDepthDMm: h - y1,
    };
  }

  // Multi-layer arrangement: split into 2 layers
  const maxBarsInTwoLayers = maxBarsInOneLayer * 2;
  if (barCount > maxBarsInTwoLayers) {
    return null; // Cannot fit within 2 layers without violating horizontal clearance
  }

  // Fill bottom layer up to max capacity, remainder on top layer
  const n1 = maxBarsInOneLayer;
  const n2 = barCount - n1;
  const y2 = y1 + db + vertSpacingMm;

  const clearSpace1 = n1 > 1 ? (availWidth - n1 * db) / (n1 - 1) : availWidth - db;
  const clearSpace2 = n2 > 1 ? (availWidth - n2 * db) / (n2 - 1) : availWidth - db;

  const yCentroid = (n1 * y1 + n2 * y2) / (n1 + n2);
  const effectiveD = h - yCentroid;

  return {
    layerCount: 2,
    barsPerLayer: [n1, n2],
    clearSpacingPerLayer: [clearSpace1, clearSpace2],
    effectiveCentroidFromBottomMm: yCentroid,
    effectiveDepthDMm: effectiveD,
  };
}

/**
 * Designs tensile (As) and optional compression (A's) reinforcement for a rectangular reinforced
 * concrete beam section under factored bending moment Mu following SNI 2847:2019 Whitney stress block theory.
 *
 * @param section Concrete cross-section geometry, concrete strength fc', and steel grades.
 * @param factoredMomentMu Factored bending moment Mu in kNm (absolute magnitude used).
 * @param options Detailing options for stirrup size, candidate bars, and layer gaps.
 * @returns Complete ConcreteFlexuralDesignResult including rebar layers, phi, Mn, and DCR.
 * @throws {ConcreteDesignError} If dimensions or loads violate code boundary constraints.
 * @example
 * const res = designWhitneyFlexure(concreteSection, kilonewtonMeter(120));
 * console.log(res.providedAs, res.flexuralDcr, res.tensionStatus);
 */
export function designWhitneyFlexure(
  section: ConcreteSectionInput,
  factoredMomentMu: KilonewtonMeter | number,
  options: FlexuralDesignerOptions = {},
): ConcreteFlexuralDesignResult {
  const bw = Number(section.bw);
  const h = Number(section.h);
  const fc = Number(section.fc);
  const muAbs = Math.abs(Number(factoredMomentMu));

  if (!Number.isFinite(bw) || bw <= 0) {
    throw new ConcreteDesignError("bw", bw, "Beam width must be strictly positive.");
  }
  if (!Number.isFinite(h) || h <= 0) {
    throw new ConcreteDesignError("h", h, "Beam height must be strictly positive.");
  }
  if (!Number.isFinite(fc) || fc <= 0) {
    throw new ConcreteDesignError(
      "fc",
      fc,
      "Concrete compressive strength must be strictly positive.",
    );
  }

  const cover = Number(section.concreteCover ?? 40);
  const stirrupDia = Number(options.stirrupDiameterMm ?? 10);
  const compRebarDia = Number(options.compressionRebarDiameterMm ?? 13);
  const vertSpacing = Number(options.verticalLayerSpacingMm ?? 25);
  const aggSize = Number(section.maxAggregateSizeMm ?? 20);

  const rebarProps = getRebarProperties(section.longitudinalRebarGrade);
  const fy = Number(rebarProps.fy);
  const es = REBAR_ELASTIC_MODULUS_ES_MPA;
  const ey = fy / es;
  const beta1 = calculateWhitneyBeta1(fc);

  // Preliminary effective depth estimate (assuming single layer 19 mm bar)
  const preliminaryD = h - cover - stirrupDia - 9.5;
  if (preliminaryD <= 0) {
    throw new ConcreteDesignError(
      "h",
      h,
      `Beam height ${h} mm is too shallow for concrete cover (${cover} mm) and stirrup (${stirrupDia} mm).`,
    );
  }

  // Minimum tensile reinforcement area As,min per SNI 2847:2019 Pasal 9.6.1.2
  const asMinFormula1 = (0.25 * Math.sqrt(fc) * bw * preliminaryD) / fy;
  const asMinFormula2 = (1.4 * bw * preliminaryD) / fy;
  const preliminaryAsMin = Math.max(asMinFormula1, asMinFormula2);

  const candidateDiameters = options.candidateBarDiametersMm ?? DEFAULT_CANDIDATE_BAR_DIAMETERS;

  let bestResult: ConcreteFlexuralDesignResult | null = null;
  let minOverdesignArea = Number.POSITIVE_INFINITY;

  for (const db of candidateDiameters) {
    let nominalBar: RebarNominalBar;
    try {
      nominalBar = getNominalBar(db);
    } catch {
      continue;
    }

    const ab = Number(nominalBar.area);
    const dEstimate = h - cover - stirrupDia - 0.5 * db;

    // Maximum tension-controlled neutral axis and Whitney depth (epsilon_t = 0.005, phi = 0.90)
    const cMax = (CONCRETE_EPSILON_CU / (CONCRETE_EPSILON_CU + 0.005)) * dEstimate; // 0.375 * dEstimate
    const aMax = beta1 * cMax;
    const mnMaxNmm = 0.85 * fc * aMax * bw * (dEstimate - 0.5 * aMax);

    const muRequiredNmm = (muAbs * 1_000_000) / 0.9;
    let asRequiredMm2 = 0;
    let asPrimeRequiredMm2 = 0;

    if (muRequiredNmm <= mnMaxNmm) {
      // Singly reinforced design
      const discriminant = dEstimate * dEstimate - (2.0 * muRequiredNmm) / (0.85 * fc * bw);
      const a = discriminant > 0 ? dEstimate - Math.sqrt(discriminant) : aMax;
      asRequiredMm2 = (0.85 * fc * a * bw) / fy;
      asPrimeRequiredMm2 = 0;
    } else {
      // Doubly reinforced design needed to maintain ductile behavior (epsilon_t >= 0.005)
      const deltaMnNmm = muRequiredNmm - mnMaxNmm;
      const dPrime = cover + stirrupDia + 0.5 * compRebarDia;
      const epsilonSPrime = CONCRETE_EPSILON_CU * (1.0 - dPrime / cMax);
      const fsPrime = Math.min(fy, Math.max(0, es * epsilonSPrime));
      const arm = Math.max(10.0, dEstimate - dPrime);

      asPrimeRequiredMm2 = deltaMnNmm / (fsPrime * arm);
      asRequiredMm2 = (0.85 * fc * aMax * bw) / fy + deltaMnNmm / (fy * arm);
    }

    const asDesignTarget = Math.max(asRequiredMm2, preliminaryAsMin);
    const barCount = Math.max(2, Math.ceil(asDesignTarget / ab));

    // Arrange tensile reinforcement into 1 or 2 layers and recompute exact effective depth d
    const layout = computeTensileLayerLayout(
      bw,
      h,
      barCount,
      db,
      cover,
      stirrupDia,
      aggSize,
      vertSpacing,
    );

    if (!layout) {
      // Bars cannot physically fit into 2 layers for this diameter
      continue;
    }

    const actualD = layout.effectiveDepthDMm;
    const providedAsMm2 = barCount * ab;

    // Minimum steel check using exact effective depth d
    const exactAsMin = Math.max(
      (0.25 * Math.sqrt(fc) * bw * actualD) / fy,
      (1.4 * bw * actualD) / fy,
    );
    if (providedAsMm2 < exactAsMin) {
      continue;
    }

    // Compression steel sizing (if doubly reinforced required)
    let compBarCount = 0;
    let providedAsPrimeMm2 = 0;
    const compLayers: RebarLayerArrangement[] = [];

    if (asPrimeRequiredMm2 > 0) {
      const compNominalBar = getNominalBar(compRebarDia);
      const compAb = Number(compNominalBar.area);
      compBarCount = Math.max(2, Math.ceil(asPrimeRequiredMm2 / compAb));
      providedAsPrimeMm2 = compBarCount * compAb;

      const compAvailWidth = bw - 2.0 * (cover + stirrupDia);
      const compClearSpace =
        compBarCount > 1
          ? (compAvailWidth - compBarCount * compRebarDia) / (compBarCount - 1)
          : compAvailWidth - compRebarDia;

      compLayers.push({
        barCount: compBarCount,
        barDiameter: millimeter(compRebarDia),
        totalArea: providedAsPrimeMm2 as MillimeterSquared,
        clearSpacingMm: compClearSpace,
      });
    }

    // Exact sectional equilibrium solving for neutral axis depth c
    const dPrime = cover + stirrupDia + 0.5 * compRebarDia;
    let aActual = (providedAsMm2 * fy) / (0.85 * fc * bw);
    let cActual = aActual / beta1;

    if (providedAsPrimeMm2 > 0) {
      // Iterative equilibrium accounting for compression steel stress fs'
      for (let iter = 0; iter < 10; iter++) {
        const epsPrime = CONCRETE_EPSILON_CU * ((cActual - dPrime) / cActual);
        const fsPrime = Math.min(fy, Math.max(0, es * epsPrime));
        const ccRequired = providedAsMm2 * fy - providedAsPrimeMm2 * fsPrime;
        aActual = Math.max(0.1, ccRequired / (0.85 * fc * bw));
        cActual = aActual / beta1;
      }
    }

    const netTensileStrain = CONCRETE_EPSILON_CU * ((actualD - cActual) / cActual);

    let phi: number;
    let tensionStatus: ConcreteSectionTensionStatus;

    if (netTensileStrain >= 0.005) {
      phi = 0.9;
      tensionStatus = "TENSION_CONTROLLED";
    } else if (netTensileStrain > ey) {
      phi = 0.65 + 0.25 * ((netTensileStrain - ey) / (0.005 - ey));
      tensionStatus = "TRANSITION_ZONE";
    } else {
      phi = 0.65;
      tensionStatus = "COMPRESSION_CONTROLLED";
    }

    // Nominal moment strength Mn
    let mnNmm: number;
    if (providedAsPrimeMm2 > 0) {
      const epsPrime = CONCRETE_EPSILON_CU * ((cActual - dPrime) / cActual);
      const fsPrime = Math.min(fy, Math.max(0, es * epsPrime));
      const cc = 0.85 * fc * aActual * bw;
      const cs = providedAsPrimeMm2 * fsPrime;
      mnNmm = cc * (actualD - 0.5 * aActual) + cs * (actualD - dPrime);
    } else {
      mnNmm = providedAsMm2 * fy * (actualD - 0.5 * aActual);
    }

    const phiMnKnm = (phi * mnNmm) / 1_000_000;
    const dcr = muAbs / Math.max(1e-6, phiMnKnm);

    if (dcr <= 1.0) {
      const overdesign = providedAsMm2 - asRequiredMm2;
      if (overdesign < minOverdesignArea) {
        minOverdesignArea = overdesign;

        const tensionLayers: RebarLayerArrangement[] = [];
        for (let l = 0; l < layout.layerCount; l++) {
          const countInLayer = layout.barsPerLayer[l]!;
          tensionLayers.push({
            barCount: countInLayer,
            barDiameter: millimeter(db),
            totalArea: (countInLayer * ab) as MillimeterSquared,
            clearSpacingMm: layout.clearSpacingPerLayer[l]!,
          });
        }

        bestResult = {
          requiredAs: (Math.round(asRequiredMm2 * 100) / 100) as MillimeterSquared,
          providedAs: providedAsMm2 as MillimeterSquared,
          providedAsPrime: providedAsPrimeMm2 as MillimeterSquared,
          effectiveDepthD: millimeter(Math.round(actualD * 10) / 10),
          whitneyBlockDepthA: Math.round(aActual * 100) / 100,
          neutralAxisDepthC: Math.round(cActual * 100) / 100,
          beta1,
          netTensileStrain: Number(netTensileStrain.toFixed(5)),
          phiFlexure: Number(phi.toFixed(3)),
          nominalMomentMn: kilonewtonMeter(Math.round((mnNmm / 1e6) * 100) / 100),
          designMomentPhiMn: kilonewtonMeter(Math.round(phiMnKnm * 100) / 100),
          flexuralDcr: utilizationRatio(Number(dcr.toFixed(3))),
          tensionStatus,
          tensionLayers,
          compressionLayers: compLayers,
        };
      }
    }
  }

  if (!bestResult) {
    throw new ConcreteDesignError(
      "sectionCapacity",
      `${bw}x${h} mm`,
      `Section cannot accommodate required flexural reinforcement for Mu = ${muAbs} kNm within 2 rebar layers. Enlarge section dimensions bw or h.`,
    );
  }

  return bestResult;
}
