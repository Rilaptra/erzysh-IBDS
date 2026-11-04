/**
 * @file iwf-geometric-properties.ts
 * @description Exact cross-sectional geometry engine for structural steel profiles
 * (Wide Flange / IWF and Hollow Structural Sections / BOX / PSR) according to
 * Indonesian National Standard SNI 1729:2020 (AISC 360-16 equivalent),
 * JIS G 3192 / SNI 07-2054, and JIS G 3466.
 *
 * Implements exact fillet spandrel integration (af, c, If0) and calculates all primary
 * and derived properties: A, W, Ix, Iy, rx, ry, Sx, Sy, Zx, Zy, h0, hc, J, Cw, rts, and C.
 */

import {
  type Millimeter,
  millimeter,
  type MillimeterCubed,
  type MillimeterSquared,
  type MillimeterToFourth,
} from "../../types/branded-units";
import {
  type BoxPrimaryDimensions,
  type IwfPrimaryDimensions,
  SteelDesignError,
  type SteelSectionProperties,
} from "../../types/steel-sni1729-types";

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Geometric constants for a single corner fillet (spandrel quadrant) of an IWF profile.
 */
export interface IwfCornerFilletConstants {
  /** Fillet root radius in centimeters (rc = r / 10). */
  readonly rcCm: number;
  /** Area of a single corner fillet in cm²: af = (1 - π/4) * rc². */
  readonly af: number;
  /** Distance from straight web/flange face to fillet centroid in cm: c = ((10 - 3π)/(12 - 3π)) * rc. */
  readonly c: number;
  /** Self second moment of area of a single fillet about its centroidal axis in cm⁴: If0. */
  readonly If0: number;
}

/**
 * Calculation configuration options for IWF section property computation.
 */
export interface IwfCalculationOptions {
  /**
   * If true, includes the 4 corner fillets' contribution in plastic section modulus (Zx, Zy).
   * Default: false (matches standard JIS G 3192 / AISC handbook tabulated rectangular segments).
   */
  readonly exactPlasticModulus?: boolean;
}

/**
 * Extended steel section properties for closed hollow structural sections (BOX / PSR),
 * including the torsional constant C per SNI 1729:2020 User Note Chapter H3.1.
 */
export interface BoxSectionProperties extends SteelSectionProperties {
  /** HSS torsional section parameter C in mm³ per SNI 1729:2020 Eq. (H3-1). */
  readonly C: MillimeterCubed;
}

// ============================================================================
// Mathematical Helper Constants
// ============================================================================

/** Nominal steel mass density in kg/m³ per JIS G 3192 / SNI 1729. */
const STEEL_DENSITY_KG_PER_M3 = 7850;

/** Conversion factor from area in cm² to unit weight in kg/m: rho * 1 m * (1e-4 m²/cm²) = 0.785. */
const CM2_TO_KG_PER_M = STEEL_DENSITY_KG_PER_M3 / 10000;

// ============================================================================
// Fillet Constants Calculation
// ============================================================================

/**
 * Computes exact geometric constants for a single circular fillet arc (quadrant spandrel)
 * located at the junction of the web and flange of a hot-rolled IWF beam.
 *
 * Mathematical formulas:
 * 1. Area of 1 fillet arc:
 *    af = (1 - π / 4) * rc²
 * 2. Distance from straight edge to fillet centroid:
 *    c = ((10 - 3π) / (12 - 3π)) * rc
 * 3. Self moment of inertia of 1 fillet about its centroidal axis:
 *    If0 = [1 - 5π / 16 - (1 - π / 4) * ((10 - 3π) / (12 - 3π))²] * rc⁴
 *
 * @param rcMm Root fillet radius r in millimeters (mm).
 * @returns Object containing fillet radius in cm, area `af` (cm²), centroid offset `c` (cm), and `If0` (cm⁴).
 * @throws {SteelDesignError} When root radius is negative or non-finite.
 *
 * @example
 * ```ts
 * const fillet = computeIwfCornerFilletConstants(10.0);
 * console.log(fillet.af); // ~0.2146 cm²
 * console.log(fillet.c);  // ~0.2234 cm
 * console.log(fillet.If0); // ~0.00754 cm⁴
 * ```
 */
export function computeIwfCornerFilletConstants(rcMm: number): IwfCornerFilletConstants {
  if (typeof rcMm !== "number" || !Number.isFinite(rcMm) || rcMm < 0) {
    throw new SteelDesignError(
      "UNKNOWN",
      "computeIwfCornerFilletConstants",
      `Root fillet radius must be a finite non-negative number in mm. Received: ${String(rcMm)}`,
    );
  }

  // Convert mm to cm for stable numerical conditioning
  const rcCm = rcMm / 10;

  if (rcCm === 0) {
    return { rcCm: 0, af: 0, c: 0, If0: 0 };
  }

  // af = (1 - π/4) * rc²
  const af = (1 - Math.PI / 4) * rcCm ** 2;

  // c = ((10 - 3π) / (12 - 3π)) * rc
  const cFactor = (10 - 3 * Math.PI) / (12 - 3 * Math.PI);
  const c = cFactor * rcCm;

  // If0 = [1 - 5π/16 - (1 - π/4) * cFactor²] * rc⁴
  const if0Factor = 1 - (5 * Math.PI) / 16 - (1 - Math.PI / 4) * cFactor ** 2;
  const If0 = if0Factor * rcCm ** 4;

  return { rcCm, af, c, If0 };
}

// ============================================================================
// IWF Section Properties Calculation
// ============================================================================

/**
 * Computes complete derived cross-sectional and torsional properties for an IWF / Wide Flange
 * profile from its 5 primary dimensions (H, B, tw, tf, r) according to SNI 1729:2020 and JIS G 3192.
 *
 * Calculations are performed internally in centimeter units (cm, cm², cm³, cm⁴, cm⁶)
 * matching official structural steel manual references, and converted into standard SI branded units
 * (mm², mm⁴, mm³, mm, kg/m) for output.
 *
 * @param input Primary dimensions container containing name, H, B, tw, tf, and r (all in mm).
 * @param options Optional calculation flags (e.g. exact plastic modulus inclusion).
 * @returns Exhaustive geometric properties matching `SteelSectionProperties`.
 * @throws {SteelDesignError} When dimensions are non-positive, physically invalid, or non-finite.
 *
 * @example
 * ```ts
 * const props = computeIwfSectionProperties({
 *   name: "WF 100 x 100 x 17.2",
 *   H: millimeter(100),
 *   B: millimeter(100),
 *   tw: millimeter(6.0),
 *   tf: millimeter(8.0),
 *   r: millimeter(10.0),
 * });
 * console.log(props.area); // 2189.84 mm² (~21.9 cm²)
 * console.log(props.unitWeightKgPerM); // ~17.19 kg/m
 * console.log(props.Ix); // 3826530 mm⁴ (~382.65 cm⁴)
 * ```
 */
export function computeIwfSectionProperties(
  input: IwfPrimaryDimensions,
  options?: IwfCalculationOptions,
): SteelSectionProperties {
  const { name, H, B, tw, tf, r } = input;

  // Input validation: assert finite positive numbers
  if (!Number.isFinite(H) || H <= 0) {
    throw new SteelDesignError(
      name,
      "computeIwfSectionProperties",
      `Depth H must be > 0. Received: ${H}`,
    );
  }
  if (!Number.isFinite(B) || B <= 0) {
    throw new SteelDesignError(
      name,
      "computeIwfSectionProperties",
      `Flange width B must be > 0. Received: ${B}`,
    );
  }
  if (!Number.isFinite(tw) || tw <= 0) {
    throw new SteelDesignError(
      name,
      "computeIwfSectionProperties",
      `Web thickness tw must be > 0. Received: ${tw}`,
    );
  }
  if (!Number.isFinite(tf) || tf <= 0) {
    throw new SteelDesignError(
      name,
      "computeIwfSectionProperties",
      `Flange thickness tf must be > 0. Received: ${tf}`,
    );
  }
  if (!Number.isFinite(r) || r < 0) {
    throw new SteelDesignError(
      name,
      "computeIwfSectionProperties",
      `Fillet radius r must be >= 0. Received: ${r}`,
    );
  }

  // Physical geometry consistency checks
  if (H <= 2 * tf) {
    throw new SteelDesignError(
      name,
      "computeIwfSectionProperties",
      `Total depth H (${H} mm) must be greater than twice flange thickness 2*tf (${2 * tf} mm).`,
    );
  }
  if (B <= tw) {
    throw new SteelDesignError(
      name,
      "computeIwfSectionProperties",
      `Flange width B (${B} mm) must be greater than web thickness tw (${tw} mm).`,
    );
  }
  const clearWebMm = H - 2 * tf - 2 * r;
  if (clearWebMm < 0) {
    throw new SteelDesignError(
      name,
      "computeIwfSectionProperties",
      `Clear web height hc = H - 2*tf - 2*r cannot be negative (${clearWebMm} mm).`,
    );
  }

  // Convert primary dimensions from mm to cm for numerical consistency with handbook tables
  const h = H / 10;
  const b = B / 10;
  const twCm = tw / 10;
  const tfCm = tf / 10;
  const rcCm = r / 10;

  // Fillet constants for 1 corner
  const { af, c, If0 } = computeIwfCornerFilletConstants(r);

  // 1. Cross-sectional Area A (cm²)
  // A = 2 * b * tf + (h - 2*tf) * tw + 4 * af
  const areaCm2 = 2 * b * tfCm + (h - 2 * tfCm) * twCm + 4 * af;

  // 2. Unit Weight W (kg/m) based on 7850 kg/m³
  const unitWeightKgPerM = areaCm2 * CM2_TO_KG_PER_M;

  // 3. Strong-axis Moment of Inertia Ix (cm⁴) via Parallel Axis (Steiner) Theorem
  // Rectangular components: 2 flanges + 1 web plate
  const ixRect = (b * Math.pow(h, 3) - (b - twCm) * Math.pow(h - 2 * tfCm, 3)) / 12;
  // 4 corner fillets contribution: 4 * [If0 + af * (h/2 - tf - c)²]
  const dFilletX = h / 2 - tfCm - c;
  const ixFillets = 4 * (If0 + af * Math.pow(dFilletX, 2));
  const ixCm4 = ixRect + ixFillets;

  // 4. Weak-axis Moment of Inertia Iy (cm⁴)
  // Rectangular components: 2 flanges + 1 web plate
  const iyRect = (2 * tfCm * Math.pow(b, 3) + (h - 2 * tfCm) * Math.pow(twCm, 3)) / 12;
  // 4 corner fillets contribution: 4 * [If0 + af * (tw/2 + c)²]
  const dFilletY = twCm / 2 + c;
  const iyFillets = 4 * (If0 + af * Math.pow(dFilletY, 2));
  const iyCm4 = iyRect + iyFillets;

  // 5. Radii of Gyration rx, ry (cm)
  const rxCm = Math.sqrt(ixCm4 / areaCm2);
  const ryCm = Math.sqrt(iyCm4 / areaCm2);

  // 6. Elastic Section Moduli Sx, Sy (cm³)
  const sxCm3 = ixCm4 / (h / 2);
  const syCm3 = iyCm4 / (b / 2);

  // 7. Plastic Section Moduli Zx, Zy (cm³)
  // Primary rectangular segments:
  // Zx = b * tf * (h - tf) + 0.25 * tw * (h - 2*tf)²
  // Zy = 0.5 * tf * b² + 0.25 * (h - 2*tf) * tw²
  const zxStdCm3 = b * tfCm * (h - tfCm) + 0.25 * twCm * Math.pow(h - 2 * tfCm, 2);
  const zyStdCm3 = 0.5 * tfCm * Math.pow(b, 2) + 0.25 * (h - 2 * tfCm) * Math.pow(twCm, 2);

  let zxCm3 = zxStdCm3;
  let zyCm3 = zyStdCm3;

  if (options?.exactPlasticModulus) {
    // Add 4 corner fillets plastic contribution
    zxCm3 += 4 * af * dFilletX;
    zyCm3 += 4 * af * dFilletY;
  }

  // 8. Distance between flange centroids h0 and clear distance between web fillets hc (mm)
  const h0Mm = H - tf;
  const hcMm = H - 2 * tf - 2 * r;

  // 9. St. Venant Torsional Constant J (cm⁴) - Standard thin-walled approximation
  // J = [2 * b * tf³ + (h - 2*tf) * tw³] / 3
  const jCm4 = (2 * b * Math.pow(tfCm, 3) + (h - 2 * tfCm) * Math.pow(twCm, 3)) / 3;

  // 10. Warping Torsional Constant Cw (cm⁶)
  // Cw = (Iy * h0²) / 4 per SNI 1729:2020 Chapter F2 / AISC DG9 Eq. C.3-2
  const h0Cm = h - tfCm;
  const cwCm6 = (iyCm4 * Math.pow(h0Cm, 2)) / 4;

  // 11. Effective Radius of Gyration for Lateral-Torsional Buckling rts (cm)
  // rts = sqrt( (Iy * h0) / (2 * Sx) ) per SNI 1729:2020 Eq. (F2-7)
  const rtsCm = Math.sqrt((iyCm4 * h0Cm) / (2 * sxCm3));

  // Convert cm-based properties to standard mm-based branded types:
  // Area: cm² * 100 -> mm²
  // Inertia: cm⁴ * 10000 -> mm⁴
  // Modulus: cm³ * 1000 -> mm³
  // Length: cm * 10 -> mm
  // Cw: cm⁶ * 1000000 -> mm⁶
  return {
    name,
    profileType: "IWF",
    area: (areaCm2 * 100) as MillimeterSquared,
    unitWeightKgPerM,
    Ix: (ixCm4 * 10000) as MillimeterToFourth,
    Iy: (iyCm4 * 10000) as MillimeterToFourth,
    rx: millimeter(rxCm * 10),
    ry: millimeter(ryCm * 10),
    Sx: (sxCm3 * 1000) as MillimeterCubed,
    Sy: (syCm3 * 1000) as MillimeterCubed,
    Zx: (zxCm3 * 1000) as MillimeterCubed,
    Zy: (zyCm3 * 1000) as MillimeterCubed,
    h0: millimeter(h0Mm),
    hc: millimeter(hcMm),
    J: (jCm4 * 10000) as MillimeterToFourth,
    Cw: cwCm6 * 1_000_000,
    rts: millimeter(rtsCm * 10),
  };
}

// ============================================================================
// BOX / PSR Section Properties Calculation
// ============================================================================

/**
 * Computes derived cross-sectional and torsional properties for a closed hollow structural
 * section (BOX / SHS / RHS) from its primary dimensions (H, B, t, shapeType) according to
 * JIS G 3466 and SNI 1729:2020 (Chapters B4, F7, and H3).
 *
 * Implements standard corner fillet reduction (r_out = 2*t, r_in = t) for gross area,
 * St. Venant torsional constant J using Bredt's first formula, and the HSS torsional
 * section property C per SNI 1729:2020 Eq. (H3-1).
 *
 * @param input Primary dimensions container containing name, H, B, t, and shapeType.
 * @returns Exhaustive geometric properties matching `BoxSectionProperties`.
 * @throws {SteelDesignError} When dimensions are non-positive, physically invalid, or non-finite.
 *
 * @example
 * ```ts
 * const box = computeBoxSectionProperties({
 *   name: "BOX 100 x 100 x 4.5",
 *   H: millimeter(100),
 *   B: millimeter(100),
 *   t: millimeter(4.5),
 *   shapeType: "SQUARE",
 * });
 * console.log(box.area); // ~1666.85 mm²
 * console.log(box.unitWeightKgPerM); // ~13.08 kg/m
 * console.log(box.J); // ~3919500 mm⁴
 * console.log(box.C); // ~81730 mm³
 * ```
 */
export function computeBoxSectionProperties(input: BoxPrimaryDimensions): BoxSectionProperties {
  const { name, H, B, t } = input;

  // Input validation: assert finite positive numbers
  if (!Number.isFinite(H) || H <= 0) {
    throw new SteelDesignError(
      name,
      "computeBoxSectionProperties",
      `Depth H must be > 0. Received: ${H}`,
    );
  }
  if (!Number.isFinite(B) || B <= 0) {
    throw new SteelDesignError(
      name,
      "computeBoxSectionProperties",
      `Width B must be > 0. Received: ${B}`,
    );
  }
  if (!Number.isFinite(t) || t <= 0) {
    throw new SteelDesignError(
      name,
      "computeBoxSectionProperties",
      `Wall thickness t must be > 0. Received: ${t}`,
    );
  }

  // Physical geometry consistency checks
  if (H <= 2 * t) {
    throw new SteelDesignError(
      name,
      "computeBoxSectionProperties",
      `Total depth H (${H} mm) must be greater than twice wall thickness 2*t (${2 * t} mm).`,
    );
  }
  if (B <= 2 * t) {
    throw new SteelDesignError(
      name,
      "computeBoxSectionProperties",
      `Total width B (${B} mm) must be greater than twice wall thickness 2*t (${2 * t} mm).`,
    );
  }
  if (H <= 3 * t || B <= 3 * t) {
    throw new SteelDesignError(
      name,
      "computeBoxSectionProperties",
      `Dimensions H and B must exceed 3*t (${3 * t} mm) to allow flat wall classification per SNI 1729 Table B4.1b.`,
    );
  }

  // Convert mm to cm for calculation stability
  const h = H / 10;
  const b = B / 10;
  const tw = t / 10;

  // 1. Cross-sectional Area A (cm²) with standard corner curvature (rout = 2*tw, rin = tw)
  // A = 2 * tw * (b + h - 2*tw) - (4 - π)*(rout² - rin²)
  // rout² - rin² = (2*tw)² - tw² = 3 * tw²
  const areaCm2 = 2 * tw * (b + h - 2 * tw) - 3 * (4 - Math.PI) * Math.pow(tw, 2);

  // 2. Unit Weight W (kg/m)
  const unitWeightKgPerM = areaCm2 * CM2_TO_KG_PER_M;

  // 3. Strong-axis and Weak-axis Moments of Inertia Ix, Iy (cm⁴)
  // Outer rectangle minus inner void rectangle
  const ixCm4 = (b * Math.pow(h, 3) - (b - 2 * tw) * Math.pow(h - 2 * tw, 3)) / 12;
  const iyCm4 = (h * Math.pow(b, 3) - (h - 2 * tw) * Math.pow(b - 2 * tw, 3)) / 12;

  // 4. Radii of Gyration rx, ry (cm)
  const rxCm = Math.sqrt(ixCm4 / areaCm2);
  const ryCm = Math.sqrt(iyCm4 / areaCm2);

  // 5. Elastic Section Moduli Sx, Sy (cm³)
  const sxCm3 = ixCm4 / (h / 2);
  const syCm3 = iyCm4 / (b / 2);

  // 6. Plastic Section Moduli Zx, Zy (cm³) per Section 4.2
  // Zx = [b*h² - (b - 2*tw)*(h - 2*tw)²] / 4
  // Zy = [h*b² - (h - 2*tw)*(b - 2*tw)²] / 4
  const zxCm3 = (b * Math.pow(h, 2) - (b - 2 * tw) * Math.pow(h - 2 * tw, 2)) / 4;
  const zyCm3 = (h * Math.pow(b, 2) - (h - 2 * tw) * Math.pow(b - 2 * tw, 2)) / 4;

  // 7. Flange centroid distance h0 and clear flat web height hc (mm)
  // h0 = H - t (distance between flange centerlines)
  // hc = H - 3*t (clear flat width per SNI 1729 Table B4.1b Note d)
  const h0Mm = H - t;
  const hcMm = H - 3 * t;

  // 8. St. Venant Torsional Constant J (cm⁴) per Bredt's first formula (Section 4.3)
  // J = [2 * tw * (b - tw)² * (h - tw)²] / (b + h - 2*tw)
  const jCm4 = (2 * tw * Math.pow(b - tw, 2) * Math.pow(h - tw, 2)) / (b + h - 2 * tw);

  // 9. HSS Torsional Constant C (cm³) per SNI 1729:2020 Chapter H3.1 Eq. (H3-1)
  // C = 2 * (b - tw) * (h - tw) * tw - 4.5 * (4 - π) * tw³
  const cCm3 = 2 * (b - tw) * (h - tw) * tw - 4.5 * (4 - Math.PI) * Math.pow(tw, 3);

  // 10. Warping constant Cw for closed hollow sections is negligible (Cw ≈ 0)
  const cw = 0;

  // 11. Effective radius of gyration rts: closed sections resist torsion via St. Venant shear.
  // Weak-axis radius of gyration ry represents the governing lateral stability dimension.
  const rtsMm = ryCm * 10;

  return {
    name,
    profileType: "BOX",
    area: (areaCm2 * 100) as MillimeterSquared,
    unitWeightKgPerM,
    Ix: (ixCm4 * 10000) as MillimeterToFourth,
    Iy: (iyCm4 * 10000) as MillimeterToFourth,
    rx: millimeter(rxCm * 10),
    ry: millimeter(ryCm * 10),
    Sx: (sxCm3 * 1000) as MillimeterCubed,
    Sy: (syCm3 * 1000) as MillimeterCubed,
    Zx: (zxCm3 * 1000) as MillimeterCubed,
    Zy: (zyCm3 * 1000) as MillimeterCubed,
    h0: millimeter(h0Mm),
    hc: millimeter(hcMm),
    J: (jCm4 * 10000) as MillimeterToFourth,
    Cw: cw,
    rts: millimeter(rtsMm),
    C: (cCm3 * 1000) as MillimeterCubed,
  };
}
