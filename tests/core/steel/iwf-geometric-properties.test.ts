/**
 * @file iwf-geometric-properties.test.ts
 * @description Comprehensive unit tests for exact IWF and BOX section property calculation engine
 * according to SNI 1729:2020 / JIS G 3192 / JIS G 3466.
 */

import { describe, expect, it } from "bun:test";

import {
  computeBoxSectionProperties,
  computeIwfCornerFilletConstants,
  computeIwfSectionProperties,
} from "../../../src/core/steel/iwf-geometric-properties";
import { millimeter } from "../../../src/types/branded-units";
import { SteelDesignError } from "../../../src/types/steel-sni1729-types";

describe("computeIwfCornerFilletConstants", () => {
  it("calculates exact fillet spandrel constants for rc = 10 mm", () => {
    const fillet = computeIwfCornerFilletConstants(10);
    expect(fillet.rcCm).toBeCloseTo(1.0, 5);
    // af = (1 - pi/4) * rc^2 approx 0.214602 cm2
    expect(fillet.af).toBeCloseTo(0.214602, 4);
    // c = ((10 - 3*pi) / (12 - 3*pi)) * rc approx 0.223402 cm
    expect(fillet.c).toBeCloseTo(0.223368, 4);
    // If0 approx 0.007542 cm4
    expect(fillet.If0).toBeCloseTo(0.007542, 4);
  });

  it("returns zero constants when root radius rc = 0", () => {
    const fillet = computeIwfCornerFilletConstants(0);
    expect(fillet.rcCm).toBe(0);
    expect(fillet.af).toBe(0);
    expect(fillet.c).toBe(0);
    expect(fillet.If0).toBe(0);
  });

  it("throws SteelDesignError for negative or invalid radius", () => {
    expect(() => computeIwfCornerFilletConstants(-5)).toThrow(SteelDesignError);
    expect(() => computeIwfCornerFilletConstants(NaN)).toThrow(SteelDesignError);
  });
});

describe("computeIwfSectionProperties", () => {
  // Verification against Table 5 in steel_wf_box_section_geometry_spec.md
  // Sample: WF 100 x 100 x 17.2 (H=100, B=100, tw=6, tf=8, r=10)
  const sampleWf100 = {
    name: "WF 100 x 100 x 17.2",
    H: millimeter(100),
    B: millimeter(100),
    tw: millimeter(6),
    tf: millimeter(8),
    r: millimeter(10),
  };

  it("calculates properties for WF 100 x 100 x 17.2 matching official documentation", () => {
    const props = computeIwfSectionProperties(sampleWf100);

    // Cross-sectional Area: A = 21.898 cm2 = 2189.8 mm2
    expect(props.area / 100).toBeCloseTo(21.898, 2);

    // Unit Weight: W = 17.19 kg/m
    expect(props.unitWeightKgPerM).toBeCloseTo(17.19, 1);

    // Strong-axis Moment of Inertia: Ix = 382.58 - 382.65 cm4 = 3,825,800 - 3,826,530 mm4
    expect(props.Ix / 10000).toBeCloseTo(382.65, 0);

    // Weak-axis Moment of Inertia: Iy = 133.72 - 133.75 cm4 = 1,337,200 - 1,337,500 mm4
    expect(props.Iy / 10000).toBeCloseTo(133.75, 0);

    // Radii of gyration: rx = 4.18 cm = 41.8 mm, ry = 2.47 cm = 24.7 mm
    expect(props.rx / 10).toBeCloseTo(4.18, 2);
    expect(props.ry / 10).toBeCloseTo(2.47, 2);

    // Elastic section moduli: Sx = 76.52 cm3 = 76,520 mm3, Sy = 26.74 cm3 = 26,740 mm3
    expect(props.Sx / 1000).toBeCloseTo(76.53, 1);
    expect(props.Sy / 1000).toBeCloseTo(26.75, 1);

    // Plastic section moduli: Zx = 84.18 cm3 = 84,180 mm3, Zy = 40.76 cm3 = 40,760 mm3
    expect(props.Zx / 1000).toBeCloseTo(84.18, 1);
    expect(props.Zy / 1000).toBeCloseTo(40.76, 1);

    // Flange distance: h0 = 92 mm, hc = 64 mm
    expect(props.h0).toBe(millimeter(92));
    expect(props.hc).toBe(millimeter(64));

    // St. Venant torsional constant J = 4.018 cm4 = 40,181 mm4
    expect(props.J / 10000).toBeCloseTo(4.018, 2);

    // Warping constant Cw = 2829.5 cm6 = 2,829,500,000 mm6
    expect(props.Cw / 1_000_000).toBeCloseTo(2830, 0);

    // Effective radius of gyration rts = 2.835 cm = 28.35 mm
    expect(props.rts / 10).toBeCloseTo(2.835, 2);
  });

  it("supports exact plastic section modulus with fillet inclusion", () => {
    const props = computeIwfSectionProperties(sampleWf100, { exactPlasticModulus: true });
    // Exact Zx includes + 4*af*(h/2 - tf - c) = 84.18 + 3.41 = 87.59 cm3
    expect(props.Zx / 1000).toBeCloseTo(87.59, 1);
  });

  it("throws SteelDesignError when primary dimensions are invalid or non-physical", () => {
    // Negative or zero depth
    expect(() => computeIwfSectionProperties({ ...sampleWf100, H: millimeter(0) })).toThrow(
      SteelDesignError,
    );
    expect(() => computeIwfSectionProperties({ ...sampleWf100, H: millimeter(-10) })).toThrow(
      SteelDesignError,
    );
    expect(() => computeIwfSectionProperties({ ...sampleWf100, H: NaN as any })).toThrow(
      SteelDesignError,
    );

    // Non-positive width B
    expect(() => computeIwfSectionProperties({ ...sampleWf100, B: millimeter(0) })).toThrow(
      SteelDesignError,
    );

    // Non-positive web thickness tw
    expect(() => computeIwfSectionProperties({ ...sampleWf100, tw: millimeter(0) })).toThrow(
      SteelDesignError,
    );

    // Non-positive flange thickness tf
    expect(() => computeIwfSectionProperties({ ...sampleWf100, tf: millimeter(0) })).toThrow(
      SteelDesignError,
    );

    // Negative fillet radius r
    expect(() => computeIwfSectionProperties({ ...sampleWf100, r: millimeter(-1) })).toThrow(
      SteelDesignError,
    );

    // Depth less than 2*tf
    expect(() =>
      computeIwfSectionProperties({ ...sampleWf100, H: millimeter(15), tf: millimeter(8) }),
    ).toThrow(SteelDesignError);

    // Width less than tw
    expect(() =>
      computeIwfSectionProperties({ ...sampleWf100, B: millimeter(5), tw: millimeter(6) }),
    ).toThrow(SteelDesignError);

    // Clear web negative (H - 2*tf - 2*r < 0)
    expect(() =>
      computeIwfSectionProperties({
        ...sampleWf100,
        H: millimeter(100),
        tf: millimeter(30),
        r: millimeter(25),
      }),
    ).toThrow(SteelDesignError);
  });
});

describe("computeBoxSectionProperties", () => {
  const sampleBox100 = {
    name: "BOX 100 x 100 x 4.5",
    H: millimeter(100),
    B: millimeter(100),
    t: millimeter(4.5),
    shapeType: "SQUARE" as const,
  };

  it("calculates derived properties for BOX 100 x 100 x 4.5 per JIS G 3466 / SNI 1729", () => {
    const box = computeBoxSectionProperties(sampleBox100);

    expect(box.profileType).toBe("BOX");
    // Area with corner fillet reduction: ~16.67 cm2 = ~1667 mm2
    expect(box.area / 100).toBeCloseTo(16.67, 1);

    // Unit weight: ~13.08 kg/m
    expect(box.unitWeightKgPerM).toBeCloseTo(13.08, 1);

    // Strong-axis and weak-axis moment of inertia (symmetric for square)
    expect(box.Ix / 10000).toBeCloseTo(261.88, 1);
    expect(box.Iy / 10000).toBeCloseTo(261.88, 1);

    // Radii of gyration
    expect(box.rx / 10).toBeCloseTo(3.96, 1);
    expect(box.ry / 10).toBeCloseTo(3.96, 1);

    // Moduli
    expect(box.Sx / 1000).toBeCloseTo(52.38, 1);
    expect(box.Zx / 1000).toBeCloseTo(61.61, 1);

    // Centroid distance and clear web
    expect(box.h0).toBe(millimeter(95.5));
    expect(box.hc).toBe(millimeter(86.5));

    // St. Venant torsional constant J (Bredt formula)
    expect(box.J / 10000).toBeCloseTo(391.95, 0);

    // HSS torsional parameter C
    expect(box.C / 1000).toBeCloseTo(81.73, 0);

    // Warping constant is zero for closed box
    expect(box.Cw).toBe(0);
  });

  it("throws SteelDesignError when box dimensions are invalid or non-physical", () => {
    // Non-positive depth or width
    expect(() => computeBoxSectionProperties({ ...sampleBox100, H: millimeter(0) })).toThrow(
      SteelDesignError,
    );
    expect(() => computeBoxSectionProperties({ ...sampleBox100, B: millimeter(0) })).toThrow(
      SteelDesignError,
    );
    expect(() => computeBoxSectionProperties({ ...sampleBox100, t: millimeter(0) })).toThrow(
      SteelDesignError,
    );

    // Wall thickness exceeds half depth
    expect(() => computeBoxSectionProperties({ ...sampleBox100, t: millimeter(60) })).toThrow(
      SteelDesignError,
    );

    // Wall thickness exceeds half width
    expect(() =>
      computeBoxSectionProperties({
        ...sampleBox100,
        H: millimeter(200),
        B: millimeter(100),
        t: millimeter(55),
      }),
    ).toThrow(SteelDesignError);

    // Wall thickness exceeds one third depth (violates flat wall check)
    expect(() => computeBoxSectionProperties({ ...sampleBox100, t: millimeter(35) })).toThrow(
      SteelDesignError,
    );

    // Wall thickness exceeds one third width
    expect(() =>
      computeBoxSectionProperties({ ...sampleBox100, B: millimeter(90), t: millimeter(32) }),
    ).toThrow(SteelDesignError);
  });
});
