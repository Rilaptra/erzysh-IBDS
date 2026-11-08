/**
 * @file sni-safety-factors.ts
 * @description Standard strength reduction factors (phi), material densities,
 * and elastic constants codified by SNI 2847:2019 (Beton) and SNI 1729:2020 (Baja).
 */

import { megapascal } from "@/types/branded-units";
import type {
  KilogramPerCubicMeter,
  KilonewtonPerCubicMeter,
  Megapascal,
  UtilizationRatio,
} from "@/types/branded-units";

// ============================================================================
// SNI 2847:2019 Reinforced Concrete Design Constants (Pasal 21.2)
// ============================================================================

/**
 * Strength reduction factors (phi) per SNI 2847:2019 Table 21.2.1.
 */
export const CONCRETE_SNI_2847_FACTORS = {
  /** Tension-controlled flexural sections (epsilon_t >= 0.005). */
  PHI_FLEXURE_TENSION_CONTROLLED: 0.9,

  /** Compression-controlled sections with regular transverse ties/stirrups (epsilon_t <= 0.002). */
  PHI_COMPRESSION_TIED: 0.65,

  /** Compression-controlled sections with spiral reinforcement. */
  PHI_COMPRESSION_SPIRAL: 0.75,

  /** Shear force (Vu) and torsional moment (Tu). */
  PHI_SHEAR_AND_TORSION: 0.75,

  /** Bearing on concrete (Pasal 22.8). */
  PHI_BEARING: 0.65,

  /** Tension-control net tensile strain limit (Pasal 21.2.2). */
  STRAIN_LIMIT_TENSION_CONTROLLED: 0.005,

  /** Compression-control net tensile strain limit for Grade 400 steel. */
  STRAIN_LIMIT_COMPRESSION_CONTROLLED: 0.002,

  /** Default density of plain reinforced concrete in kN/m³. */
  UNIT_WEIGHT_KN_PER_M3: 24.0 as KilonewtonPerCubicMeter,

  /** Default mass density of reinforced concrete in kg/m³. */
  MASS_DENSITY_KG_PER_M3: 2400.0 as KilogramPerCubicMeter,

  /** Lightweight concrete modification factor lambda (1.0 for normal weight concrete). */
  LAMBDA_NORMAL_WEIGHT: 1.0,
} as const;

/**
 * Calculates the interpolated strength reduction factor phi for flexural concrete sections
 * in the transition zone (0.002 <= epsilon_t < 0.005) per SNI 2847:2019 Table 21.2.2.
 *
 * @param netTensileStrain Net tensile steel strain (epsilon_t).
 * @param isSpiral Whether transverse reinforcement consists of continuous spirals.
 * @returns Strength reduction factor phi in range [0.65, 0.90] (or [0.75, 0.90] for spirals).
 * @example
 * calculateConcreteFlexurePhi(0.004, false); // returns ~0.817
 */
export function calculateConcreteFlexurePhi(netTensileStrain: number, isSpiral = false): number {
  if (netTensileStrain >= CONCRETE_SNI_2847_FACTORS.STRAIN_LIMIT_TENSION_CONTROLLED) {
    return CONCRETE_SNI_2847_FACTORS.PHI_FLEXURE_TENSION_CONTROLLED;
  }

  const phiCompression = isSpiral
    ? CONCRETE_SNI_2847_FACTORS.PHI_COMPRESSION_SPIRAL
    : CONCRETE_SNI_2847_FACTORS.PHI_COMPRESSION_TIED;

  if (netTensileStrain <= CONCRETE_SNI_2847_FACTORS.STRAIN_LIMIT_COMPRESSION_CONTROLLED) {
    return phiCompression;
  }

  // Linear interpolation across transition zone
  const deltaStrain =
    CONCRETE_SNI_2847_FACTORS.STRAIN_LIMIT_TENSION_CONTROLLED -
    CONCRETE_SNI_2847_FACTORS.STRAIN_LIMIT_COMPRESSION_CONTROLLED;
  const ratio =
    (netTensileStrain - CONCRETE_SNI_2847_FACTORS.STRAIN_LIMIT_COMPRESSION_CONTROLLED) /
    deltaStrain;

  return (
    phiCompression +
    (CONCRETE_SNI_2847_FACTORS.PHI_FLEXURE_TENSION_CONTROLLED - phiCompression) * ratio
  );
}

// ============================================================================
// SNI 1729:2020 Structural Steel Design Constants
// ============================================================================

/**
 * Resistance factors (phi) and elastic constants per SNI 1729:2020.
 */
export const STEEL_SNI_1729_FACTORS = {
  /** Flexure resistance factor (Chapter F). */
  PHI_FLEXURE: 0.9,

  /** Shear resistance factor for IWF & BOX webs (Chapter G). */
  PHI_SHEAR: 0.9,

  /** Compression resistance factor for axial members (Chapter E). */
  PHI_COMPRESSION: 0.9,

  /** Tension yielding on gross area (Chapter D, Pasal D2a). */
  PHI_TENSION_YIELDING: 0.9,

  /** Tension rupture on net effective area (Chapter D, Pasal D2b). */
  PHI_TENSION_RUPTURE: 0.75,

  /** Torsion resistance factor (Chapter H, Pasal H3). */
  PHI_TORSION: 0.9,

  /** Modulus of elasticity of structural steel E in MPa (Pasal A3.1). */
  MODULUS_OF_ELASTICITY_E: megapascal(200_000),

  /** Shear modulus G in MPa (Pasal A3.1). */
  SHEAR_MODULUS_G: megapascal(77_200),

  /** Poisson's ratio nu. */
  POISSONS_RATIO_NU: 0.3,

  /** Unit weight of structural steel in kN/m³. */
  UNIT_WEIGHT_KN_PER_M3: 78.5 as KilonewtonPerCubicMeter,

  /** Mass density of structural steel in kg/m³. */
  MASS_DENSITY_KG_PER_M3: 7850.0 as KilogramPerCubicMeter,

  /** Economic target lower bound for capacity utilization (DCR >= 90%). */
  TARGET_EFFICIENCY_MIN_RATIO: 0.9 as UtilizationRatio,

  /** Maximum allowable capacity utilization before failure (DCR <= 100%). */
  TARGET_EFFICIENCY_MAX_RATIO: 1.0 as UtilizationRatio,
} as const;
