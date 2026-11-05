/**
 * @file internal-force-diagrams-solver.ts
 * @description Evaluator for the 4 internal force diagrams (SFD, NFD, BMD, TFD) across
 * `M = 256` discrete span stations backed by zero-copy `Float64Array` WASM memory views.
 */

import type { ExternalLoadsModeAConfig } from "@/types/beam-loading-modes";
import { kilonewton, kilonewtonMeter, meter } from "@/types/branded-units";
import type { Kilonewton, KilonewtonMeter, KilonewtonPerMeter, Meter } from "@/types/branded-units";

import { solveSupportReactions } from "./support-reactions-solver";
import type { SolvedSupportReactions } from "./support-reactions-solver";
import {
  assertWasmSolverStatus,
  ensureWasmMechanicsInitialized,
  getZeroCopyStationViews,
  resolveWasmSupportCode,
} from "./wasm-mechanics-bridge";

/**
 * Complete solution of internal force diagrams (SFD, NFD, BMD, TFD) across `M = 256` stations.
 */
export interface SolvedInternalForceDiagrams {
  /** Solved boundary reactions and fixed-end moments. */
  readonly reactions: SolvedSupportReactions;
  /** Zero-copy `Float64Array` view of station coordinates `s_m` in meters (`length = 256`). */
  readonly stationsM: Float64Array;
  /** Zero-copy `Float64Array` view of vertical shear force `V(s_m)` in kN (`length = 256`). */
  readonly shearForceKn: Float64Array;
  /** Zero-copy `Float64Array` view of axial normal force `N(s_m)` in kN (`length = 256`). */
  readonly normalForceKn: Float64Array;
  /** Zero-copy `Float64Array` view of strong-axis bending moment `M_major(s_m)` in kNm (`length = 256`). */
  readonly bendingMomentMajorKnm: Float64Array;
  /** Zero-copy `Float64Array` view of weak-axis bending moment `M_minor(s_m)` in kNm (`length = 256`). */
  readonly bendingMomentMinorKnm: Float64Array;
  /** Zero-copy `Float64Array` view of torsional moment `T(s_m)` in kNm (`length = 256`). */
  readonly torsionMomentKnm: Float64Array;
  /** Maximum absolute vertical shear force `|V|_max` in kN. */
  readonly maxShearAbsKn: Kilonewton;
  /** Maximum positive (sagging) bending moment `M_max^+` in kNm (`>= 0`). */
  readonly maxPositiveMomentKnm: KilonewtonMeter;
  /** Minimum negative (hogging) bending moment `M_min^-` in kNm (`<= 0`). */
  readonly maxNegativeMomentKnm: KilonewtonMeter;
  /** Maximum absolute bending moment `|M|_max` in kNm. */
  readonly maxMomentAbsKnm: KilonewtonMeter;
  /** Span station `s` in meters where `|M|_max` occurs. */
  readonly maxMomentStationM: Meter;
  /** Maximum absolute axial force `|N|_max` in kN. */
  readonly maxNormalAbsKn: Kilonewton;
  /** Maximum absolute torsional moment `|T|_max` in kNm. */
  readonly maxTorsionAbsKnm: KilonewtonMeter;
}

/** Optional auxiliary internal forces for 3D combined action in Mode A. */
export interface InternalForceDiagramsOptions {
  /** Self-weight uniform load intensity in kN/m (added when `config.includeSelfWeight` is true). */
  readonly selfWeightKnPerM?: KilonewtonPerMeter;
  /** Constant axial force `N` in kN (positive = tension). */
  readonly axialForceKn?: Kilonewton;
  /** Minor-axis bending moment `M_minor` in kNm. */
  readonly minorMomentKnm?: KilonewtonMeter;
  /** Torsional moment `T` in kNm. */
  readonly torsionKnm?: KilonewtonMeter;
  /** Elastic modulus `E` in MPa (default: `200_000` MPa). */
  readonly elasticModulusMpa?: number;
  /** Moment of inertia `I` in mm^4 (default: `100_000_000` mm^4). */
  readonly momentOfInertiaMm4?: number;
}

/**
 * Evaluates SFD (`V`), NFD (`N`), BMD (`M_major, M_minor`), and TFD (`T`) across all 256 stations
 * in the zero-copy `SolverWorkspace`.
 *
 * @param config Validated Mode A external loading configuration.
 * @param options Optional self-weight, axial force, minor moment, and torsion overrides.
 * @returns Zero-copy `Float64Array` diagram views and peak force extrema.
 * @throws {BeamLoadingValidationError | WasmMechanicsSolverError} If span or load inputs are invalid.
 * @example
 * const diagrams = solveInternalForceDiagrams(modeAConfig);
 * console.log(diagrams.maxMomentAbsKnm, diagrams.bendingMomentMajorKnm.length);
 */
export function solveInternalForceDiagrams(
  config: ExternalLoadsModeAConfig,
  options: InternalForceDiagramsOptions = {},
): SolvedInternalForceDiagrams {
  const reactions = solveSupportReactions(config, options);

  const elasticModulusMpa = options.elasticModulusMpa ?? 200_000;
  const momentOfInertiaMm4 = options.momentOfInertiaMm4 ?? 100_000_000;
  const axialForceKn = options.axialForceKn ?? 0;
  const minorMomentKnm = options.minorMomentKnm ?? 0;
  const torsionKnm = options.torsionKnm ?? 0;

  const { workspace } = ensureWasmMechanicsInitialized();
  const supportCode = resolveWasmSupportCode(config.supportOrientation);

  const status = workspace.solve_mode_a(
    config.spanLength,
    supportCode,
    elasticModulusMpa,
    momentOfInertiaMm4,
    axialForceKn,
    minorMomentKnm,
    torsionKnm,
  );
  assertWasmSolverStatus(status, workspace);

  const views = getZeroCopyStationViews();

  return {
    reactions,
    stationsM: views.stationsM,
    shearForceKn: views.shearForceKn,
    normalForceKn: views.normalForceKn,
    bendingMomentMajorKnm: views.bendingMomentMajorKnm,
    bendingMomentMinorKnm: views.bendingMomentMinorKnm,
    torsionMomentKnm: views.torsionMomentKnm,
    maxShearAbsKn: kilonewton(workspace.max_shear_abs_kn()),
    maxPositiveMomentKnm: kilonewtonMeter(workspace.max_positive_moment_knm()),
    maxNegativeMomentKnm: kilonewtonMeter(workspace.max_negative_moment_knm()),
    maxMomentAbsKnm: kilonewtonMeter(workspace.max_moment_abs_knm()),
    maxMomentStationM: meter(workspace.max_moment_station_m()),
    maxNormalAbsKn: kilonewton(Math.abs(axialForceKn)),
    maxTorsionAbsKnm: kilonewtonMeter(Math.abs(torsionKnm)),
  };
}
