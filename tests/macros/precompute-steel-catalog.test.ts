/**
 * @file precompute-steel-catalog.test.ts
 * @description Unit tests verifying Bun macro pre-computation and sorting of steel catalogs.
 */

import { describe, expect, it } from "bun:test";

import {
  getPrecomputedSortedBoxCatalog,
  getPrecomputedSortedIwfCatalog,
} from "../../src/macros/precompute-steel-catalog.macro";

describe("precompute-steel-catalog.macro", () => {
  it("pre-computes and sorts all 89 IWF profiles ascending by Zx", () => {
    const catalog = getPrecomputedSortedIwfCatalog();

    // Verify profile count (table in spec has 90 rows from WF 100 to WF 1008)
    expect(catalog.length).toBeGreaterThanOrEqual(89);

    // Verify ascending order by Zx for O(log N) binary search
    for (let i = 1; i < catalog.length; i++) {
      const prev = catalog[i - 1]!;
      const curr = catalog[i]!;
      expect(curr.Zx).toBeGreaterThanOrEqual(prev.Zx);
    }

    // Verify sample profile WF 100 x 100 x 17.2 is computed properly
    const wf100 = catalog.find((p) => p.name === "WF 100 x 100 x 17.2");
    expect(wf100).toBeDefined();
    expect(wf100!.area / 100).toBeCloseTo(21.898, 2);
    expect(wf100!.unitWeightKgPerM).toBeCloseTo(17.19, 1);
    expect(wf100!.Zx / 1000).toBeCloseTo(84.18, 1);
  });

  it("pre-computes and sorts all 23 BOX profiles ascending by Zx", () => {
    const catalog = getPrecomputedSortedBoxCatalog();

    // Verify profile count
    expect(catalog.length).toBe(23);

    // Verify ascending order by Zx for O(log N) binary search
    for (let i = 1; i < catalog.length; i++) {
      const prev = catalog[i - 1]!;
      const curr = catalog[i]!;
      expect(curr.Zx).toBeGreaterThanOrEqual(prev.Zx);
    }

    // Verify sample profile BOX 100 x 100 x 4.5 is computed properly
    const box100 = catalog.find((p) => p.name === "BOX 100 x 100 x 4.5");
    expect(box100).toBeDefined();
    expect(box100!.profileType).toBe("BOX");
    expect(box100!.area / 100).toBeCloseTo(16.67, 1);
    expect(box100!.unitWeightKgPerM).toBeCloseTo(13.08, 1);
    expect(box100!.Zx / 1000).toBeCloseTo(61.61, 1);
    expect((box100 as { C?: number })?.C! / 1000).toBeCloseTo(81.73, 0);
  });
});
