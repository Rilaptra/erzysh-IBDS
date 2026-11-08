/**
 * @file support-reactions-solver.ts
 * @description High-precision support reactions solver for the 5 civil engineering support
 * categories (9 orientation variants) backed by the zero-copy Rust `SolverWorkspace`.
 */

import {
  getBoundaryJointRestraints,
  getSupportCategory,
  validateModeAConfig,
} from "@/types/beam-loading-modes";
import type {
  ExternalLoadsModeAConfig,
  JointRestraint6DOF,
  SupportCategory,
  SupportOrientation,
} from "@/types/beam-loading-modes";
import { kilonewton, kilonewtonMeter } from "@/types/branded-units";
import type { Kilonewton, KilonewtonMeter, KilonewtonPerMeter } from "@/types/branded-units";

import {
  assertWasmSolverStatus,
  ensureWasmMechanicsInitialized,
  resolveWasmSupportCode,
} from "./wasm-mechanics-bridge";

/**
 * Complete support reaction solution at left support A (`s = 0`) and right support B (`s = L`).
 */
export interface SolvedSupportReactions {
  /** Primary support category (`CANTILEVER`, `PINNED_ROLLER`, `FIXED_FIXED`, `FIXED_ROLLER`, `FIXED_PINNED`). */
  readonly supportCategory: SupportCategory;
  /** Exact boundary orientation (`CANTILEVER_LEFT`, `PINNED_ROLLER`, `FIXED_FIXED`, etc.). */
  readonly supportOrientation: SupportOrientation;
  /** 6-DOF boundary restraints at left support A (`s = 0`) and right support B (`s = L`). */
  readonly restraints: {
    readonly left: JointRestraint6DOF;
    readonly right: JointRestraint6DOF;
  };
  /** Upward vertical reaction force `R_A` at left support (`s = 0`) in kN. */
  readonly raVerticalKn: Kilonewton;
  /** Upward vertical reaction force `R_B` at right support (`s = L`) in kN. */
  readonly rbVerticalKn: Kilonewton;
  /** Internal bending moment `M_A` at left support (`s = 0`) in kNm (sagging `+`, hogging `-`). */
  readonly maMomentKnm: KilonewtonMeter;
  /** Internal bending moment `M_B` at right support (`s = L`) in kNm (sagging `+`, hogging `-`). */
  readonly mbMomentKnm: KilonewtonMeter;
  /** Horizontal axial reaction force `R_As` at left support (`s = 0`) in kN. */
  readonly raAxialKn: Kilonewton;
  /** Horizontal axial reaction force `R_Bs` at right support (`s = L`) in kN. */
  readonly rbAxialKn: Kilonewton;
  /** Total downward vertical load sum `F_down` in kN. */
  readonly totalDownwardLoadKn: Kilonewton;
  /** Mohr compatibility rotation integral `Phi_A` in kNm. */
  readonly phiAKnm: KilonewtonMeter;
  /** Mohr compatibility rotation integral `Phi_B` in kNm. */
  readonly phiBKnm: KilonewtonMeter;
  /** Whether the support configuration is statically indeterminate. */
  readonly isStaticallyIndeterminate: boolean;
}

/** Optional extra parameters when solving Mode A support reactions. */
export interface SupportReactionsOptions {
  /** Self-weight uniform load intensity in kN/m (added when `config.includeSelfWeight` is true). */
  readonly selfWeightKnPerM?: KilonewtonPerMeter;
  /** Applied axial force `N` in kN (positive = tension). */
  readonly axialForceKn?: Kilonewton;
  /** Elastic modulus `E` in MPa (default: `200_000` MPa for reaction equilibrium). */
  readonly elasticModulusMpa?: number;
  /** Moment of inertia `I` in mm^4 (default: `100_000_000` mm^4 for reaction equilibrium). */
  readonly momentOfInertiaMm4?: number;
}

/**
 * Solves vertical reactions (`R_A, R_B`), fixed-end moments (`M_A, M_B`), axial reactions
 * (`R_As, R_Bs`), and Mohr compatibility integrals (`Phi_A, Phi_B`) for any Mode A configuration.
 *
 * @param config Validated Mode A external loading configuration.
 * @param options Optional self-weight, axial force, and stiffness overrides.
 * @returns Solved support reactions and boundary condition metadata.
 * @throws {BeamLoadingValidationError | WasmMechanicsSolverError} If span length or loads are invalid.
 * @example
 * const reactions = solveSupportReactions(modeAConfig);
 * console.log(reactions.raVerticalKn, reactions.maMomentKnm);
 */
export function solveSupportReactions(
  config: ExternalLoadsModeAConfig,
  options: SupportReactionsOptions = {},
): SolvedSupportReactions {
  validateModeAConfig(config);

  const elasticModulusMpa = options.elasticModulusMpa ?? 200_000;
  const momentOfInertiaMm4 = options.momentOfInertiaMm4 ?? 100_000_000;
  const axialForceKn = options.axialForceKn ?? 0;
  const selfWeightKnPerM = options.selfWeightKnPerM ?? 0;

  const { workspace } = ensureWasmMechanicsInitialized();
  const supportCode = resolveWasmSupportCode(config.supportOrientation);

  workspace.clear_loads();
  for (const pl of config.pointLoads) {
    workspace.push_point_load(pl.magnitude, pl.position);
  }
  for (const dl of config.distributedLoads) {
    workspace.push_distributed_load(dl.magnitude, dl.startPosition, dl.endPosition);
  }
  if (config.includeSelfWeight && selfWeightKnPerM > 0) {
    workspace.push_distributed_load(selfWeightKnPerM, 0, config.spanLength);
  }
  for (const am of config.appliedMoments) {
    workspace.push_applied_moment(am.magnitude, am.position);
  }

  const status = workspace.solve_mode_a(
    config.spanLength,
    supportCode,
    elasticModulusMpa,
    momentOfInertiaMm4,
    axialForceKn,
    0,
    0,
  );
  assertWasmSolverStatus(status, workspace);

  return {
    supportCategory: getSupportCategory(config.supportOrientation),
    supportOrientation: config.supportOrientation,
    restraints: getBoundaryJointRestraints(config.supportOrientation),
    raVerticalKn: kilonewton(workspace.ra_vertical_kn()),
    rbVerticalKn: kilonewton(workspace.rb_vertical_kn()),
    maMomentKnm: kilonewtonMeter(workspace.ma_moment_knm()),
    mbMomentKnm: kilonewtonMeter(workspace.mb_moment_knm()),
    raAxialKn: kilonewton(workspace.ra_axial_kn()),
    rbAxialKn: kilonewton(workspace.rb_axial_kn()),
    totalDownwardLoadKn: kilonewton(workspace.total_downward_load_kn()),
    phiAKnm: kilonewtonMeter(workspace.phi_a_knm()),
    phiBKnm: kilonewtonMeter(workspace.phi_b_knm()),
    isStaticallyIndeterminate: workspace.is_statically_indeterminate(),
  };
}
