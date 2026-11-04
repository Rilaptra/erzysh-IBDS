/**
 * @file precompute-steel-catalog.macro.ts
 * @description Bun compile-time macro (`with { type: "macro" }`) that evaluates
 * derived sectional and torsional properties for JIS G 3192 / SNI IWF profiles and
 * JIS G 3466 BOX profiles from raw primary dimension JSON files.
 *
 * Pre-computes and sorts catalogs ascending by plastic section modulus Zx at build time
 * to enable zero-runtime-cost O(log N) binary search profile optimization.
 */

import {
  type BoxSectionProperties,
  computeBoxSectionProperties,
  computeIwfSectionProperties,
} from "../core/steel/iwf-geometric-properties";
import rawBoxCatalog from "../data/steel-box-catalog.json";
import rawIwfCatalog from "../data/steel-iwf-catalog.json";
import type {
  BoxPrimaryDimensions,
  IwfPrimaryDimensions,
  SteelSectionProperties,
} from "../types/steel-sni1729-types";

/**
 * Pre-computes all derived geometric and torsional properties for the standard JIS G 3192 / SNI
 * Wide Flange (IWF) catalog at compile time, sorted ascending by plastic section modulus Zx.
 *
 * @returns Array of fully derived `SteelSectionProperties` sorted ascending by Zx.
 *
 * @example
 * ```ts
 * import { getPrecomputedSortedIwfCatalog } from "./precompute-steel-catalog.macro" with { type: "macro" };
 * const iwfCatalog = getPrecomputedSortedIwfCatalog();
 * console.log(iwfCatalog.length); // 89
 * console.log(iwfCatalog[0].name); // Smallest Zx profile
 * ```
 */
export function getPrecomputedSortedIwfCatalog(): SteelSectionProperties[] {
  return (rawIwfCatalog as unknown as readonly IwfPrimaryDimensions[])
    .map((dim) => computeIwfSectionProperties(dim))
    .sort((a, b) => a.Zx - b.Zx);
}

/**
 * Pre-computes all derived geometric and torsional properties for the standard JIS G 3466
 * Hollow Structural Section (BOX / PSR) catalog at compile time, sorted ascending by Zx.
 *
 * @returns Array of fully derived `BoxSectionProperties` sorted ascending by Zx.
 *
 * @example
 * ```ts
 * import { getPrecomputedSortedBoxCatalog } from "./precompute-steel-catalog.macro" with { type: "macro" };
 * const boxCatalog = getPrecomputedSortedBoxCatalog();
 * console.log(boxCatalog.length); // 23
 * ```
 */
export function getPrecomputedSortedBoxCatalog(): BoxSectionProperties[] {
  return (rawBoxCatalog as unknown as readonly BoxPrimaryDimensions[])
    .map((dim) => computeBoxSectionProperties(dim))
    .sort((a, b) => a.Zx - b.Zx);
}
