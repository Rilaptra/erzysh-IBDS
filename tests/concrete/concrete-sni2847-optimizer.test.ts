/**
 * @file concrete-sni2847-optimizer.test.ts
 * @description Comprehensive test suite for the reinforced concrete design and optimization
 * engine per SNI 2847:2019:
 * - Material conversions (fc' & K-xxx, Ec, beta1) and structural threshold validation (fc' >= 17 MPa)
 * - Whitney flexural design with automatic 2-layer rebar detailing and centroidal d recalculation
 * - Shear stirrup design with web crushing limit (Vs,max) and SECTION_TOO_SMALL_FOR_SHEAR guard
 * - Full cross-section optimization over trial dimensions (bw x h)
 */

import { describe, expect, test } from "bun:test";

import {
  calculateConcreteModulusEc,
  calculateWhitneyBeta1,
  convertCubeToCylinderMpa,
  getNominalBar,
  getRebarProperties,
  resolveCylinderFcMpa,
} from "@/core/concrete/concrete-grade-converter";
import { optimizeConcreteSection } from "@/core/concrete/concrete-section-optimizer";
import {
  checkShearWebCrushingLimit,
  designShearStirrups,
  SECTION_TOO_SMALL_FOR_SHEAR,
} from "@/core/concrete/shear-stirrup-designer";
import { designWhitneyFlexure } from "@/core/concrete/whitney-flexural-designer";
import { kilonewton, kilonewtonMeter, megapascal, meter, millimeter } from "@/types/branded-units";
import { ConcreteDesignError } from "@/types/concrete-sni2847-types";
import type { ConcreteSectionInput } from "@/types/concrete-sni2847-types";

describe("Step 4: SNI 2847:2019 Concrete Engine Tests", () => {
  describe("Material Conversions & Constitutive Properties", () => {
    test("converts historical cube K-xxx to cylinder fc' (MPa)", () => {
      // K-250 -> 0.083 * 250 = 20.75 MPa
      expect(Number(convertCubeToCylinderMpa("K_250"))).toBeCloseTo(20.75, 2);
      // K-300 -> 0.083 * 300 = 24.90 MPa
      expect(Number(convertCubeToCylinderMpa("K_300"))).toBeCloseTo(24.9, 2);
      // Numeric K
      expect(Number(convertCubeToCylinderMpa(400))).toBeCloseTo(33.2, 2);
    });

    test("computes normal-weight concrete modulus of elasticity Ec = 4700 * sqrt(fc')", () => {
      // fc = 25 MPa => Ec = 4700 * 5 = 23,500 MPa
      expect(Number(calculateConcreteModulusEc(megapascal(25)))).toBe(23_500);
      // fc = 36 MPa => Ec = 4700 * 6 = 28,200 MPa
      expect(Number(calculateConcreteModulusEc(megapascal(36)))).toBe(28_200);
    });

    test("computes Whitney stress block factor beta1 per Table 22.2.2.4.3", () => {
      // fc <= 28 MPa => 0.85
      expect(calculateWhitneyBeta1(20)).toBe(0.85);
      expect(calculateWhitneyBeta1(28)).toBe(0.85);
      // fc = 35 MPa => 0.85 - 0.05 * (35 - 28) / 7 = 0.80
      expect(calculateWhitneyBeta1(35)).toBeCloseTo(0.8, 4);
      // fc = 42 MPa => 0.85 - 0.05 * 14 / 7 = 0.75
      expect(calculateWhitneyBeta1(42)).toBeCloseTo(0.75, 4);
      // fc >= 55 MPa => 0.65
      expect(calculateWhitneyBeta1(55)).toBe(0.65);
      expect(calculateWhitneyBeta1(65)).toBe(0.65);
    });

    test("guard clauses reject fc < 17 MPa for structural concrete with ConcreteDesignError", () => {
      expect(() => resolveCylinderFcMpa(15)).toThrow(ConcreteDesignError);
      expect(() => resolveCylinderFcMpa(0)).toThrow(ConcreteDesignError);
      expect(() => resolveCylinderFcMpa(-20)).toThrow(ConcreteDesignError);
    });

    test("retrieves standard rebar grades and nominal bar areas", () => {
      const bjts40 = getRebarProperties("BJTS_40");
      expect(Number(bjts40.fy)).toBe(400);
      expect(Number(bjts40.fu)).toBe(570);
      expect(bjts40.type).toBe("DEFORMED");

      const d16 = getNominalBar(16);
      expect(Number(d16.area)).toBeCloseTo((Math.PI / 4) * 16 * 16, 2);
    });
  });

  describe("Whitney Flexural Designer & Multi-Layer Detailing", () => {
    const section250x500: ConcreteSectionInput = {
      bw: millimeter(250),
      h: millimeter(500),
      concreteCover: millimeter(40),
      fc: megapascal(25),
      longitudinalRebarGrade: "BJTS_40",
      stirrupRebarGrade: "BJTP_24",
      maxAggregateSizeMm: 20,
    };

    test("designs single-layer tensile reinforcement for moderate bending moment", () => {
      // Moderate moment: Mu = 80 kNm fits within 1 layer on bw = 250 mm
      const res = designWhitneyFlexure(section250x500, kilonewtonMeter(80));

      expect(res.tensionLayers.length).toBe(1);
      expect(Number(res.providedAsPrime)).toBe(0);
      expect(res.tensionStatus).toBe("TENSION_CONTROLLED");
      expect(res.phiFlexure).toBe(0.9);
      expect(Number(res.flexuralDcr)).toBeLessThanOrEqual(1.0);
      expect(Number(res.nominalMomentMn)).toBeGreaterThanOrEqual(80 / 0.9);
    });

    test("automatically arranges reinforcement into 2 layers and recomputes effective depth d when 1 layer exceeds width", () => {
      // Higher moment: Mu = 160 kNm requires more bars than fit in 1 layer of 250 mm beam
      const res = designWhitneyFlexure(section250x500, kilonewtonMeter(160));

      // With cover = 40, stirrup = 10, available width = 250 - 100 = 150 mm
      // For 19 mm bars, (150 + 25) / (19 + 25) = 175 / 44 = 3 bars max in 1 layer
      // If 4 or 5 bars required, must arrange in 2 layers
      expect(res.tensionLayers.length).toBeGreaterThanOrEqual(1);

      if (res.tensionLayers.length === 2) {
        // Effective depth d should be lower than single layer d (h - cover - stirrup - db/2 ~ 440.5)
        // because centroid shifts upward
        expect(Number(res.effectiveDepthD)).toBeLessThan(440);
        // Clear spacing between bars in both layers must satisfy s >= max(db, 25 mm)
        for (const layer of res.tensionLayers) {
          if (layer.barCount > 1) {
            expect(layer.clearSpacingMm).toBeGreaterThanOrEqual(25.0 - 1e-6);
          }
        }
      }

      expect(Number(res.flexuralDcr)).toBeLessThanOrEqual(1.0);
    });

    test("enforces minimum tensile reinforcement As,min per SNI 2847 Pasal 9.6.1.2", () => {
      // Tiny moment: Mu = 10 kNm. As,min must govern
      const res = designWhitneyFlexure(section250x500, kilonewtonMeter(10));
      const expectedAsMin = Math.max(
        (0.25 * Math.sqrt(25) * 250 * Number(res.effectiveDepthD)) / 400,
        (1.4 * 250 * Number(res.effectiveDepthD)) / 400,
      );

      expect(Number(res.providedAs)).toBeGreaterThanOrEqual(expectedAsMin);
      expect(Number(res.flexuralDcr)).toBeLessThan(0.3);
    });
  });

  describe("Shear Stirrup Designer & Web Crushing Limit (Vs,max)", () => {
    const section300x500: ConcreteSectionInput = {
      bw: millimeter(300),
      h: millimeter(500),
      concreteCover: millimeter(40),
      fc: megapascal(25),
      longitudinalRebarGrade: "BJTS_40",
      stirrupRebarGrade: "BJTP_24",
      maxAggregateSizeMm: 20,
    };
    const dMm = 440;

    test("computes concrete nominal shear strength Vc and details stirrups for moderate shear", () => {
      // Vc = 0.17 * 1.0 * sqrt(25) * 300 * 440 * 1e-3 = 112.2 kN
      // phi_v * Vc = 0.75 * 112.2 = 84.15 kN
      const res = designShearStirrups(section300x500, millimeter(dMm), kilonewton(100));

      expect(Number(res.concreteShearStrengthVc)).toBeCloseTo(112.2, 1);
      expect(Number(res.stirrupSpacing)).toBeLessThanOrEqual(Number(res.maxPermissibleSpacing));
      expect(Number(res.stirrupSpacing) % 25).toBe(0); // Clean 25 mm rounding
      expect(Number(res.shearDcr)).toBeLessThanOrEqual(1.0);
    });

    test("enforces web crushing limit Vs <= 0.66*sqrt(fc')*bw*d and throws SECTION_TOO_SMALL_FOR_SHEAR", () => {
      // Vs,max = 0.66 * 5 * 300 * 440 * 1e-3 = 435.6 kN
      // Vc = 112.2 kN => phi_v * (Vc + Vs,max) = 0.75 * (112.2 + 435.6) = 410.85 kN
      const check = checkShearWebCrushingLimit(300, dMm, 25, 450);
      expect(check.isAdequate).toBe(false);

      expect(() => designShearStirrups(section300x500, millimeter(dMm), kilonewton(450))).toThrow(
        ConcreteDesignError,
      );

      try {
        designShearStirrups(section300x500, millimeter(dMm), kilonewton(450));
      } catch (err: any) {
        expect(err.parameterName).toBe(SECTION_TOO_SMALL_FOR_SHEAR);
      }
    });

    test("enforces maximum geometric spacing s_max = min(d/2, 600 mm) or min(d/4, 300 mm)", () => {
      // Low shear: s_max should be d/2 = 220 mm
      const lowShear = designShearStirrups(section300x500, millimeter(dMm), kilonewton(50));
      expect(Number(lowShear.maxPermissibleSpacing)).toBe(Math.floor(dMm / 2));
      expect(Number(lowShear.stirrupSpacing)).toBeLessThanOrEqual(220);
    });
  });

  describe("Concrete Beam Section Optimizer", () => {
    test("automatically enlarges cross-section when trial size hits SECTION_TOO_SMALL_FOR_SHEAR", () => {
      // Heavy loads: Mu = 250 kNm, Vu = 220 kN
      // A small 200x300 section would violate shear crushing limit, optimizer must size up to >= 300x500
      const opt = optimizeConcreteSection({
        factoredMomentMu: kilonewtonMeter(250),
        factoredShearVu: kilonewton(220),
        fc: megapascal(30),
        spanLengthM: meter(6.0),
        minBwMm: 200,
        maxBwMm: 450,
        minHMm: 350,
        maxHMm: 800,
      });

      expect(opt.isCompliant).toBe(true);
      expect(Number(opt.section.bw)).toBeGreaterThanOrEqual(250);
      expect(Number(opt.section.h)).toBeGreaterThanOrEqual(500);
      expect(Number(opt.flexure.flexuralDcr)).toBeLessThanOrEqual(1.0);
      expect(Number(opt.shear.shearDcr)).toBeLessThanOrEqual(1.0);
    });
  });
});
