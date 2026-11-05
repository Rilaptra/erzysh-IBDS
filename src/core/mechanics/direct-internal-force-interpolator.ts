/**
 * @file direct-internal-force-interpolator.ts
 * @description Mode B Direct Internal Force Interpolator.
 * Maps factored internal forces (`P_u, M_ux, M_uy, T_u, V_u`) into an equivalent uniform downward
 * load `q_eq` and reconstructs continuous 256-node internal force and negative deflection curves (`Delta < 0`)
 * in the zero-copy Rust `SolverWorkspace`.
 */

import { evaluateDeflectionCompliance } from "@/config/deflection-limits-config";
import type {
  DeflectionEvaluationResult,
  DeflectionLimitKey,
} from "@/config/deflection-limits-config";
import { validateModeBConfig } from "@/types/beam-loading-modes";
import type {
  DirectInternalForcesModeBConfig,
  SupportOrientation,
} from "@/types/beam-loading-modes";
import {
  assertNegativeDeflection,
  kilonewton,
  kilonewtonMeter,
  kilonewtonPerMeter,
  meter,
  millimeter,
} from "@/types/branded-units";
import type {
  CoordinateSystemMode,
  Kilonewton,
  KilonewtonMeter,
  KilonewtonPerMeter,
  Matrix3x3,
  Megapascal,
  Meter,
  Millimeter,
  MillimeterToFourth,
  Radian,
} from "@/types/branded-units";

import type { ExtrusionCrossSectionInput } from "./euler-bernoulli-deflection-solver";
import {
  assertWasmSolverStatus,
  configureWorkspaceCoordinateSystem,
  ensureWasmMechanicsInitialized,
  getZeroCopyMesh3DViews,
  getZeroCopyRebarCage3DViews,
  getZeroCopyStationViews,
  resolveWasmSupportCode,
} from "./wasm-mechanics-bridge";
import type { ZeroCopyMesh3DViews, ZeroCopyRebarCage3DViews } from "./wasm-mechanics-bridge";

/** Input configuration for Mode B Direct Internal Force Interpolation. */
export interface ModeBInterpolatorInput {
  /** Mode B direct factored internal forces (`P_u, M_ux, M_uy, T_u, V_u`) and `spanLength`. */
  readonly modeBConfig: DirectInternalForcesModeBConfig;
  /** Assumed boundary support condition for deflection interpolation (default: `"PINNED_ROLLER"`). */
  readonly supportOrientation?: SupportOrientation;
  /** Young's modulus of elasticity `E` in MPa (`E > 0`). */
  readonly elasticModulusMpa: Megapascal | number;
  /** Strong-axis moment of inertia `I_major` in mm^4 (`I > 0`). */
  readonly momentOfInertiaMm4: MillimeterToFourth | number;
  /** Deflection serviceability limit key (default: `"L_360"`). */
  readonly deflectionLimitKey?: DeflectionLimitKey;
  /** Optional 3D cross-section profile to extrude along the interpolated curve. */
  readonly crossSection?: ExtrusionCrossSectionInput;
  /** Visual magnification scale factor `alpha_scale` (default: `1.0`). */
  readonly visualScale?: number;
  /** Active 3D coordinate system orientation (default: `"Z-Up"`). */
  readonly coordinateMode?: CoordinateSystemMode;
  /** Optional custom 3x3 orthogonal permutation matrix. */
  readonly customCoordinateMatrix?: Matrix3x3;
}

/** Complete output from the Mode B Direct Internal Force Interpolator. */
export interface InterpolatedModeBResult {
  /** Equivalent uniform downward load `q_eq` in kN/m that produces `|M_ux|`. */
  readonly equivalentUniformLoadKnPerM: KilonewtonPerMeter;
  /** Signed peak negative deflection `Delta_max` in mm (`<= 0`). */
  readonly maxDeflectionMm: Millimeter;
  /** Span station `s` in meters where `|Delta_max|` occurs. */
  readonly maxDeflectionStationM: Meter;
  /** Maximum absolute slope rotation `|theta|_max` in radians. */
  readonly maxRotationAbsRad: Radian;
  /** Factored shear force `|V_u|` in kN. */
  readonly designShearKn: Kilonewton;
  /** Factored strong-axis moment `|M_ux|` in kNm. */
  readonly designMomentMajorKnm: KilonewtonMeter;
  /** Zero-copy `Float64Array` view of station coordinates `s_m` in meters (`length = 256`). */
  readonly stationsM: Float64Array;
  /** Zero-copy `Float64Array` view of interpolated shear force `V(s_m)` in kN (`length = 256`). */
  readonly shearForceKn: Float64Array;
  /** Zero-copy `Float64Array` view of axial force `N(s_m)` in kN (`length = 256`). */
  readonly normalForceKn: Float64Array;
  /** Zero-copy `Float64Array` view of interpolated strong-axis moment `M_major(s_m)` in kNm (`length = 256`). */
  readonly bendingMomentMajorKnm: Float64Array;
  /** Zero-copy `Float64Array` view of vertical deflection `v(s_m)` in mm (`length = 256`, negative downward). */
  readonly deflectionMm: Float64Array;
  /** Zero-copy `Float64Array` view of slope rotation `theta(s_m)` in radians (`length = 256`). */
  readonly rotationRad: Float64Array;
  /** SNI serviceability limit evaluation (`L/180`, `L/240`, `L/360`, `L/480`). */
  readonly serviceability: DeflectionEvaluationResult;
  /** Zero-copy 3D extruded mesh views when `crossSection` is provided. */
  readonly mesh3D: ZeroCopyMesh3DViews | null;
  /** Zero-copy 3D rebar cage wireframe views when `crossSection` includes `rebarCage`. */
  readonly rebarCage3D: ZeroCopyRebarCage3DViews | null;
}

/**
 * Interpolates a complete 256-node internal force and negative deflection state (`Delta < 0`)
 * from a Mode B Direct Internal Forces configuration using the Rust `SolverWorkspace`.
 *
 * @param input Mode B configuration, assumed support orientation, and stiffness parameters.
 * @returns Interpolated equivalent load `q_eq`, peak negative deflection, zero-copy buffers, and SNI compliance.
 * @throws {BeamLoadingValidationError | WasmMechanicsSolverError} If `L <= 0`, `E <= 0`, `I <= 0`, or forces are non-finite.
 * @example
 * const res = interpolateModeBInternalForces({
 *   modeBConfig,
 *   supportOrientation: "PINNED_ROLLER",
 *   elasticModulusMpa: 200_000,
 *   momentOfInertiaMm4: 100_000_000,
 * });
 */
export function interpolateModeBInternalForces(
  input: ModeBInterpolatorInput,
): InterpolatedModeBResult {
  const { modeBConfig, elasticModulusMpa, momentOfInertiaMm4 } = input;
  const orientation = input.supportOrientation ?? "PINNED_ROLLER";
  const supportCode = resolveWasmSupportCode(orientation);

  const { workspace } = ensureWasmMechanicsInitialized();

  // Check stiffness guard clauses via Rust WASM first
  if (
    !Number.isFinite(modeBConfig.spanLength) ||
    modeBConfig.spanLength <= 0 ||
    !Number.isFinite(elasticModulusMpa) ||
    elasticModulusMpa <= 0 ||
    !Number.isFinite(momentOfInertiaMm4) ||
    momentOfInertiaMm4 <= 0
  ) {
    const code = workspace.solve_mode_b(
      modeBConfig.spanLength,
      supportCode,
      elasticModulusMpa,
      momentOfInertiaMm4,
      modeBConfig.axialForcePu,
      modeBConfig.strongAxisMomentMux,
      modeBConfig.weakAxisMomentMuy,
      modeBConfig.torsionTu,
      modeBConfig.shearForceVu,
    );
    assertWasmSolverStatus(code, workspace);
  }

  validateModeBConfig(modeBConfig);

  const status = workspace.solve_mode_b(
    modeBConfig.spanLength,
    supportCode,
    elasticModulusMpa,
    momentOfInertiaMm4,
    modeBConfig.axialForcePu,
    modeBConfig.strongAxisMomentMux,
    modeBConfig.weakAxisMomentMuy,
    modeBConfig.torsionTu,
    modeBConfig.shearForceVu,
  );
  assertWasmSolverStatus(status, workspace);

  const maxDefl = workspace.max_deflection_mm();
  if (Math.abs(modeBConfig.strongAxisMomentMux) > 0) {
    assertNegativeDeflection(maxDefl, "modeB.maxDeflectionMm");
  }

  const isCantilever = orientation === "CANTILEVER_LEFT" || orientation === "CANTILEVER_RIGHT";
  const limitKey = input.deflectionLimitKey ?? "L_360";
  const serviceability = evaluateDeflectionCompliance(
    maxDefl,
    modeBConfig.spanLength,
    limitKey,
    isCantilever,
  );

  let mesh3D: ZeroCopyMesh3DViews | null = null;
  let rebarCage3D: ZeroCopyRebarCage3DViews | null = null;

  if (input.crossSection) {
    configureWorkspaceCoordinateSystem(
      input.coordinateMode ?? "Z-Up",
      input.customCoordinateMatrix,
    );
    const visualScale = input.visualScale ?? 1.0;
    const allowMm = serviceability.allowableLimitMm;
    const sec = input.crossSection;

    if (sec.kind === "IWF") {
      const code = workspace.build_iwf_3d_mesh(
        sec.dMm,
        sec.bfMm,
        sec.twMm,
        sec.tfMm,
        sec.rMm,
        allowMm,
        visualScale,
      );
      assertWasmSolverStatus(code, workspace);
      mesh3D = getZeroCopyMesh3DViews();
    } else if (sec.kind === "BOX") {
      const code = workspace.build_box_3d_mesh(sec.hMm, sec.bMm, sec.tMm, allowMm, visualScale);
      assertWasmSolverStatus(code, workspace);
      mesh3D = getZeroCopyMesh3DViews();
    } else if (sec.kind === "CONCRETE_RECT") {
      const code = workspace.build_concrete_3d_mesh(sec.bwMm, sec.hMm, allowMm, visualScale);
      assertWasmSolverStatus(code, workspace);
      mesh3D = getZeroCopyMesh3DViews();

      if (sec.rebarCage) {
        const rc = sec.rebarCage;
        const rebarCode = workspace.build_rebar_cage_3d(
          sec.bwMm,
          sec.hMm,
          rc.coverMm,
          rc.stirrupDiaMm,
          rc.stirrupSpacingMm,
          rc.tensileBarCount,
          rc.tensileBarDiaMm,
          rc.compressiveBarCount,
          rc.compressiveBarDiaMm,
          visualScale,
        );
        assertWasmSolverStatus(rebarCode, workspace);
        rebarCage3D = getZeroCopyRebarCage3DViews();
      }
    }
  }

  const views = getZeroCopyStationViews();

  return {
    equivalentUniformLoadKnPerM: kilonewtonPerMeter(workspace.mode_b_equivalent_q_kn_per_m()),
    maxDeflectionMm: millimeter(maxDefl),
    maxDeflectionStationM: meter(workspace.max_deflection_station_m()),
    maxRotationAbsRad: workspace.max_rotation_abs_rad() as Radian,
    designShearKn: kilonewton(workspace.max_shear_abs_kn()),
    designMomentMajorKnm: kilonewtonMeter(Math.abs(modeBConfig.strongAxisMomentMux)),
    stationsM: views.stationsM,
    shearForceKn: views.shearForceKn,
    normalForceKn: views.normalForceKn,
    bendingMomentMajorKnm: views.bendingMomentMajorKnm,
    deflectionMm: views.deflectionMm,
    rotationRad: views.rotationRad,
    serviceability,
    mesh3D,
    rebarCage3D,
  };
}
