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
      expect(allCatalog.every((s) => Number(s.r) === 0)).toBe(true);
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
      expect(Number(opt.bestCandidate.properties.r)).toBe(0);
      expect(Number(opt.bestCandidate.governingDcr)).toBeLessThanOrEqual(1.0);
    });
  });
});
