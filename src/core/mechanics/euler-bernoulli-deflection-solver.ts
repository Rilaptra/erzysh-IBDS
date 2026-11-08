/**
 * @file euler-bernoulli-deflection-solver.ts
 * @description Euler-Bernoulli double numerical deflection integrator (`Delta < 0` downward convention),
 * serviceability compliance evaluator (SNI 1729:2020 & SNI 2847:2019), and 3D WebGL mesh/rebar extruder.
 */

import { evaluateDeflectionCompliance } from "@/config/deflection-limits-config";
import type {
  DeflectionEvaluationResult,
  DeflectionLimitKey,
} from "@/config/deflection-limits-config";
import { validateModeAConfig } from "@/types/beam-loading-modes";
import type { ExternalLoadsModeAConfig } from "@/types/beam-loading-modes";
import { assertNegativeDeflection, meter, millimeter } from "@/types/branded-units";
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

import { solveInternalForceDiagrams } from "./internal-force-diagrams-solver";
import type { SolvedInternalForceDiagrams } from "./internal-force-diagrams-solver";
import {
  assertWasmSolverStatus,
  configureWorkspaceCoordinateSystem,
  ensureWasmMechanicsInitialized,
  getZeroCopyMesh3DViews,
  getZeroCopyRebarCage3DViews,
  getZeroCopyStationViews,
  resolveWasmSupportCode,
  WasmMechanicsSolverError,
} from "./wasm-mechanics-bridge";
import type { ZeroCopyMesh3DViews, ZeroCopyRebarCage3DViews } from "./wasm-mechanics-bridge";

/** Cross-section geometry descriptor for 3D WebGL extrusion. */
export type ExtrusionCrossSectionInput =
  | {
      readonly kind: "IWF";
      readonly dMm: number;
      readonly bfMm: number;
      readonly twMm: number;
      readonly tfMm: number;
      readonly rMm: number;
    }
  | {
      readonly kind: "BOX";
      readonly hMm: number;
      readonly bMm: number;
      readonly tMm: number;
    }
  | {
      readonly kind: "CONCRETE_RECT";
      readonly bwMm: number;
      readonly hMm: number;
      readonly rebarCage?: {
        readonly coverMm: number;
        readonly stirrupDiaMm: number;
        readonly stirrupSpacingMm: number;
        readonly tensileBarCount: number;
        readonly tensileBarDiaMm: number;
        readonly compressiveBarCount: number;
        readonly compressiveBarDiaMm: number;
      };
    };

/** Input parameters for the Euler-Bernoulli deflection and 3D mesh solver. */
export interface EulerBernoulliSolverInput {
  /** Validated Mode A external loading configuration. */
  readonly loadingConfig: ExternalLoadsModeAConfig;
  /** Young's modulus of elasticity `E` in MPa (`E > 0`). */
  readonly elasticModulusMpa: Megapascal | number;
  /** Strong-axis moment of inertia `I_major` in mm^4 (`I > 0`). */
  readonly momentOfInertiaMm4: MillimeterToFourth | number;
  /** Deflection serviceability limit key (default: `"L_360"`). */
  readonly deflectionLimitKey?: DeflectionLimitKey;
  /** Self-weight intensity in kN/m when `loadingConfig.includeSelfWeight` is true. */
  readonly selfWeightKnPerM?: KilonewtonPerMeter;
  /** Optional axial force `N` in kN. */
  readonly axialForceKn?: Kilonewton;
  /** Optional minor-axis moment `M_minor` in kNm. */
  readonly minorMomentKnm?: KilonewtonMeter;
  /** Optional torsional moment `T` in kNm. */
  readonly torsionKnm?: KilonewtonMeter;
  /** Optional 3D cross-section profile to extrude along the deflected elastic curve. */
  readonly crossSection?: ExtrusionCrossSectionInput;
  /** Visual magnification scale factor `alpha_scale` for 3D deflection (default: `1.0`). */
  readonly visualScale?: number;
  /** Active 3D coordinate system orientation (default: `"Z-Up"`). */
  readonly coordinateMode?: CoordinateSystemMode;
  /** Optional custom 3x3 orthogonal permutation matrix when `coordinateMode === "CustomXYZ"`. */
  readonly customCoordinateMatrix?: Matrix3x3;
}

/** Complete output from the Euler-Bernoulli deflection and 3D extrusion solver. */
export interface SolvedEulerBernoulliDeflection {
  /** Solved internal force diagrams and boundary reactions. */
  readonly diagrams: SolvedInternalForceDiagrams;
  /** Zero-copy `Float64Array` view of curvature `kappa(s_m)` in `mm^-1` (`length = 256`). */
  readonly curvaturePerMm: Float64Array;
  /** Zero-copy `Float64Array` view of slope rotation `theta(s_m)` in radians (`length = 256`). */
  readonly rotationRad: Float64Array;
  /** Zero-copy `Float64Array` view of vertical deflection `v(s_m)` in mm (`length = 256`, negative downward). */
  readonly deflectionMm: Float64Array;
  /** Raw WASM linear memory address of `deflectionMm` (`*const f64`) for zero-copy verification. */
  readonly deflectionPtr: number;
  /** Signed peak deflection `Delta_max` in mm (strictly negative `< 0` under downward gravity loads). */
  readonly maxDeflectionMm: Millimeter;
  /** Span station `s` in meters where `|Delta_max|` occurs. */
  readonly maxDeflectionStationM: Meter;
  /** Maximum absolute slope rotation `|theta|_max` in radians. */
  readonly maxRotationAbsRad: Radian;
  /** End slope rotation at left support A (`s = 0`) in radians. */
  readonly rotationLeftRad: Radian;
  /** End slope rotation at right support B (`s = L`) in radians. */
  readonly rotationRightRad: Radian;
  /** SNI serviceability limit evaluation (`L/180`, `L/240`, `L/360`, `L/480`). */
  readonly serviceability: DeflectionEvaluationResult;
  /** Zero-copy 3D extruded mesh views when `crossSection` is provided. */
  readonly mesh3D: ZeroCopyMesh3DViews | null;
  /** Zero-copy 3D rebar cage wireframe views when `crossSection.kind === "CONCRETE_RECT"` and `rebarCage` is provided. */
  readonly rebarCage3D: ZeroCopyRebarCage3DViews | null;
}

/**
 * Executes the Rust WASM Euler-Bernoulli double numerical integration (`O(M)` on `M = 256` stations),
 * enforces the negative gravity deflection convention (`Delta < 0`), evaluates SNI serviceability,
 * and optionally extrudes the 3D cross-section mesh and rebar cage in place.
 *
 * @param input Solver input parameters including Mode A loads, `E`, `I`, and optional 3D section.
 * @returns Zero-copy deflection curves, scalar extrema, SNI compliance, and 3D WebGL buffer views.
 * @throws {WasmMechanicsSolverError | BeamLoadingValidationError} When `E <= 0`, `I <= 0`, `L <= 0`, or loads are invalid.
 * @example
 * const result = solveEulerBernoulliDeflection({
 *   loadingConfig: modeAConfig,
 *   elasticModulusMpa: 200_000,
 *   momentOfInertiaMm4: 100_000_000,
 * });
 */
export function solveEulerBernoulliDeflection(
  input: EulerBernoulliSolverInput,
): SolvedEulerBernoulliDeflection {
  const { loadingConfig, elasticModulusMpa, momentOfInertiaMm4 } = input;

  const { workspace } = ensureWasmMechanicsInitialized();

  // Validate stiffness guard clauses via Rust WASM first so E <= 0, I <= 0, L <= 0 return structured errors
  if (
    !Number.isFinite(loadingConfig.spanLength) ||
    loadingConfig.spanLength <= 0 ||
    !Number.isFinite(elasticModulusMpa) ||
    elasticModulusMpa <= 0 ||
    !Number.isFinite(momentOfInertiaMm4) ||
    momentOfInertiaMm4 <= 0
  ) {
    const code = workspace.solve_mode_a(
      loadingConfig.spanLength,
      resolveWasmSupportCode(loadingConfig.supportOrientation),
      elasticModulusMpa,
      momentOfInertiaMm4,
      0,
      0,
      0,
    );
    assertWasmSolverStatus(code, workspace);
  }

  validateModeAConfig(loadingConfig);

  const diagrams = solveInternalForceDiagrams(loadingConfig, {
    selfWeightKnPerM: input.selfWeightKnPerM,
    axialForceKn: input.axialForceKn,
    minorMomentKnm: input.minorMomentKnm,
    torsionKnm: input.torsionKnm,
    elasticModulusMpa,
    momentOfInertiaMm4,
  });

  const views = getZeroCopyStationViews();
  const maxDeflectionRaw = workspace.max_deflection_mm();

  // If total downward load is positive and no upward counter-loads dominate, verify Delta <= 0
  if (diagrams.reactions.totalDownwardLoadKn > 0 && loadingConfig.appliedMoments.length === 0) {
    const allDownward =
      loadingConfig.pointLoads.every((p) => p.magnitude >= 0) &&
      loadingConfig.distributedLoads.every((d) => d.magnitude >= 0);
    if (allDownward && maxDeflectionRaw > 1e-9) {
      assertNegativeDeflection(maxDeflectionRaw, "maxDeflectionMm");
    }
  }

  const isCantilever =
    loadingConfig.supportOrientation === "CANTILEVER_LEFT" ||
    loadingConfig.supportOrientation === "CANTILEVER_RIGHT";
  const limitKey = input.deflectionLimitKey ?? "L_360";
  const serviceability = evaluateDeflectionCompliance(
    maxDeflectionRaw,
    loadingConfig.spanLength,
    limitKey,
    isCantilever,
  );

  let mesh3D: ZeroCopyMesh3DViews | null = null;
  let rebarCage3D: ZeroCopyRebarCage3DViews | null = null;

  if (input.crossSection) {
    const coordMode = input.coordinateMode ?? "Z-Up";
    configureWorkspaceCoordinateSystem(coordMode, input.customCoordinateMatrix);
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
    } else {
      const exhaustive: never = sec;
      throw new WasmMechanicsSolverError(6, `Unsupported crossSection kind: ${String(exhaustive)}`);
    }
  }

  return {
    diagrams,
    curvaturePerMm: views.curvaturePerMm,
    rotationRad: views.rotationRad,
    deflectionMm: views.deflectionMm,
    deflectionPtr: views.deflectionPtr,
    maxDeflectionMm: millimeter(maxDeflectionRaw),
    maxDeflectionStationM: meter(workspace.max_deflection_station_m()),
    maxRotationAbsRad: workspace.max_rotation_abs_rad() as Radian,
    rotationLeftRad: workspace.rotation_left_rad() as Radian,
    rotationRightRad: workspace.rotation_right_rad() as Radian,
    serviceability,
    mesh3D,
    rebarCage3D,
  };
}
