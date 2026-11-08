/**
 * @file wasm-mechanics-bridge.ts
 * @description Singleton zero-copy WebAssembly bridge managing the Rust `SolverWorkspace`
 * and linear memory TypedArray views (`Float64Array`, `Float32Array`, `Uint32Array`).
 * Prevents per-frame heap allocations during 60 FPS interactive slider drags.
 */

import type { SupportOrientation } from "@/types/beam-loading-modes";
import { BeamLoadingValidationError } from "@/types/beam-loading-modes";
import { COORDINATE_TRANSFORMS } from "@/types/branded-units";
import type { CoordinateSystemMode, Matrix3x3 } from "@/types/branded-units";
import initWasm, { type InitOutput, initSync, SolverWorkspace } from "@/wasm/mechanics_3d_wasm";
import { decodeMechanicsWasmBytes } from "@/wasm/mechanics_3d_wasm_bytes";

/** Fixed number of discrete span stations (`M = 256`) in `SolverWorkspace`. */
export const WASM_STATION_COUNT = 256 as const;

/** Number of angular subdivisions per 90-degree IWF root fillet arc (`4`). */
export const WASM_IWF_FILLET_SEGMENTS = 4 as const;

/** Number of perimeter vertices on an IWF cross-section with 4-segment fillets (`28`). */
export const WASM_IWF_PERIMETER_VERTEX_COUNT = 28 as const;

/** Numeric mapping from TypeScript `SupportOrientation` to Rust `u8` support code (`0..=8`). */
export const SUPPORT_ORIENTATION_TO_WASM_CODE: Record<SupportOrientation, number> = {
  CANTILEVER_LEFT: 0,
  CANTILEVER_RIGHT: 1,
  PINNED_ROLLER: 2,
  ROLLER_PINNED: 3,
  FIXED_FIXED: 4,
  FIXED_ROLLER: 5,
  ROLLER_FIXED: 6,
  FIXED_PINNED: 7,
  PINNED_FIXED: 8,
};

/**
 * Custom error thrown when the Rust WASM mechanics engine rejects inputs via its guard clauses.
 */
export class WasmMechanicsSolverError extends Error {
  public readonly errorCode: number;

  constructor(errorCode: number, message: string) {
    super(message || `[WasmMechanicsSolverError] Solver failed with error code ${errorCode}`);
    this.name = "WasmMechanicsSolverError";
    this.errorCode = errorCode;
  }
}

/** Zero-copy TypedArray views pointing directly into the Rust `SolverWorkspace` linear memory. */
export interface ZeroCopyStationViews {
  /** Pointer address in WASM linear memory for `stationsM`. */
  readonly stationsPtr: number;
  /** Pointer address in WASM linear memory for `deflectionMm`. */
  readonly deflectionPtr: number;
  /** Span station coordinates `s_m` in meters (`length = 256`). */
  readonly stationsM: Float64Array;
  /** Shear force `V(s_m)` in kN (`length = 256`). */
  readonly shearForceKn: Float64Array;
  /** Axial normal force `N(s_m)` in kN (`length = 256`). */
  readonly normalForceKn: Float64Array;
  /** Strong-axis bending moment `M_major(s_m)` in kNm (`length = 256`). */
  readonly bendingMomentMajorKnm: Float64Array;
  /** Weak-axis bending moment `M_minor(s_m)` in kNm (`length = 256`). */
  readonly bendingMomentMinorKnm: Float64Array;
  /** Torsional moment `T(s_m)` in kNm (`length = 256`). */
  readonly torsionMomentKnm: Float64Array;
  /** Curvature `kappa(s_m)` in `mm^-1` (`length = 256`). */
  readonly curvaturePerMm: Float64Array;
  /** Slope rotation `theta(s_m)` in radians (`length = 256`). */
  readonly rotationRad: Float64Array;
  /** Vertical deflection `v(s_m)` in millimeters (`length = 256`, negative `< 0` downward). */
  readonly deflectionMm: Float64Array;
}

/** Zero-copy TypedArray views for the 3D extruded WebGL beam mesh. */
export interface ZeroCopyMesh3DViews {
  /** Raw pointer address of `positionsF32` in WASM linear memory. */
  readonly positionsPtr: number;
  /** Raw pointer address of `normalsF32` in WASM linear memory. */
  readonly normalsPtr: number;
  /** Raw pointer address of `colorsF32` in WASM linear memory. */
  readonly colorsPtr: number;
  /** Raw pointer address of `indicesU32` in WASM linear memory. */
  readonly indicesPtr: number;
  /** Interleaved 3D vertex positions `[x0, y0, z0, ...]` in mm. */
  readonly positionsF32: Float32Array;
  /** Interleaved 3D vertex outward normals `[nx0, ny0, nz0, ...]`. */
  readonly normalsF32: Float32Array;
  /** Interleaved 3D vertex SAP2000 contour colors `[r0, g0, b0, ...]` in `[0, 1]`. */
  readonly colorsF32: Float32Array;
  /** Counter-Clockwise (CCW) triangle vertex indices. */
  readonly indicesU32: Uint32Array;
  /** Total vertex count (`positionsF32.length / 3`). */
  readonly vertexCount: number;
  /** Total triangle count (`indicesU32.length / 3`). */
  readonly triangleCount: number;
}

/** Zero-copy TypedArray views for the 3D reinforced concrete rebar cage wireframe. */
export interface ZeroCopyRebarCage3DViews {
  /** Raw pointer address of `positionsF32` in WASM linear memory. */
  readonly positionsPtr: number;
  /** Raw pointer address of `indicesU32` in WASM linear memory. */
  readonly indicesPtr: number;
  /** Interleaved 3D line vertex positions `[x0, y0, z0, ...]` in mm. */
  readonly positionsF32: Float32Array;
  /** Line segment index pairs `[i0, i1, ...]`. */
  readonly indicesU32: Uint32Array;
  /** Total line segment count (`indicesU32.length / 2`). */
  readonly segmentCount: number;
}

let wasmExports: InitOutput | null = null;
let sharedWorkspace: SolverWorkspace | null = null;

/**
 * Synchronously initializes the Rust WASM mechanics module and allocates the singleton
 * `SolverWorkspace` if not already initialized.
 *
 * @returns Tuple containing the raw `InitOutput` exports and the singleton `SolverWorkspace`.
 */
export function ensureWasmMechanicsInitialized(): {
  readonly exports: InitOutput;
  readonly workspace: SolverWorkspace;
} {
  if (!wasmExports) {
    const bytes = decodeMechanicsWasmBytes();
    wasmExports = initSync({ module: bytes });
  }
  if (!sharedWorkspace) {
    sharedWorkspace = new SolverWorkspace();
  }
  return { exports: wasmExports, workspace: sharedWorkspace };
}

/**
 * Asynchronously initializes the Rust WASM mechanics module (compatible with browser streaming
 * or synchronous fallback) and returns the singleton `SolverWorkspace`.
 *
 * @returns Promise resolving to the singleton `SolverWorkspace`.
 */
export async function initWasmMechanicsBridge(): Promise<SolverWorkspace> {
  if (wasmExports && sharedWorkspace) {
    return sharedWorkspace;
  }
  try {
    const bytes = decodeMechanicsWasmBytes();
    wasmExports = await initWasm({ module_or_path: bytes });
  } catch {
    const bytes = decodeMechanicsWasmBytes();
    wasmExports = initSync({ module: bytes });
  }
  if (!sharedWorkspace) {
    sharedWorkspace = new SolverWorkspace();
  }
  return sharedWorkspace;
}

/**
 * Returns the singleton `SolverWorkspace` instance, initializing WASM synchronously if needed.
 *
 * @returns Active `SolverWorkspace` instance.
 */
export function getSharedSolverWorkspace(): SolverWorkspace {
  return ensureWasmMechanicsInitialized().workspace;
}

/**
 * Returns the active `WebAssembly.Memory` backing the `SolverWorkspace`.
 *
 * @returns WebAssembly linear memory object.
 */
export function getWasmLinearMemory(): WebAssembly.Memory {
  return ensureWasmMechanicsInitialized().exports.memory;
}

/**
 * Converts a `SupportOrientation` string literal into its numeric Rust WASM code (`0..=8`).
 *
 * @param orientation Support boundary condition orientation.
 * @returns Numeric u8 support code (`0..=8`).
 * @throws {BeamLoadingValidationError} If orientation is unrecognized.
 */
export function resolveWasmSupportCode(orientation: SupportOrientation): number {
  const code = SUPPORT_ORIENTATION_TO_WASM_CODE[orientation];
  if (typeof code !== "number") {
    throw new BeamLoadingValidationError(
      "supportOrientation",
      orientation,
      "Unrecognized support orientation.",
    );
  }
  return code;
}

/**
 * Applies a coordinate system mode (`Z-Up`, `Y-Up`, or `CustomXYZ`) or custom 3x3 orthogonal
 * matrix to the singleton `SolverWorkspace`.
 *
 * @param mode Coordinate system mode key.
 * @param customMatrix Optional custom 3x3 orthogonal matrix when `mode === "CustomXYZ"`.
 */
export function configureWorkspaceCoordinateSystem(
  mode: CoordinateSystemMode,
  customMatrix?: Matrix3x3,
): void {
  const { workspace } = ensureWasmMechanicsInitialized();
  const mat = customMatrix ?? COORDINATE_TRANSFORMS[mode] ?? COORDINATE_TRANSFORMS["Z-Up"];
  workspace.set_axis_permutation_matrix(
    mat[0][0],
    mat[0][1],
    mat[0][2],
    mat[1][0],
    mat[1][1],
    mat[1][2],
    mat[2][0],
    mat[2][1],
    mat[2][2],
  );
}

/**
 * Asserts that a Rust `SolverWorkspace` status code is `0` (success), throwing a structured
 * `WasmMechanicsSolverError` if a guard clause failed.
 *
 * @param statusCode Numeric status code returned by `SolverWorkspace`.
 * @param workspace Active `SolverWorkspace` instance.
 * @throws {WasmMechanicsSolverError} When `statusCode !== 0`.
 */
export function assertWasmSolverStatus(statusCode: number, workspace: SolverWorkspace): void {
  if (statusCode !== 0) {
    const msg = workspace.last_error_message();
    throw new WasmMechanicsSolverError(statusCode, msg);
  }
}

/**
 * Creates zero-copy `Float64Array` views directly over the fixed `M = 256` station buffers
 * inside WASM linear memory.
 *
 * @returns `ZeroCopyStationViews` pointing directly to `SolverWorkspace` buffers.
 */
export function getZeroCopyStationViews(): ZeroCopyStationViews {
  const { exports, workspace } = ensureWasmMechanicsInitialized();
  const buf = exports.memory.buffer;
  const n = workspace.station_count();

  const stationsPtr = workspace.stations_ptr();
  const shearPtr = workspace.shear_ptr();
  const normalPtr = workspace.normal_ptr();
  const momentMajorPtr = workspace.moment_major_ptr();
  const momentMinorPtr = workspace.moment_minor_ptr();
  const torsionPtr = workspace.torsion_ptr();
  const curvaturePtr = workspace.curvature_ptr();
  const rotationPtr = workspace.rotation_ptr();
  const deflectionPtr = workspace.deflection_ptr();

  return {
    stationsPtr,
    deflectionPtr,
    stationsM: new Float64Array(buf, stationsPtr, n),
    shearForceKn: new Float64Array(buf, shearPtr, n),
    normalForceKn: new Float64Array(buf, normalPtr, n),
    bendingMomentMajorKnm: new Float64Array(buf, momentMajorPtr, n),
    bendingMomentMinorKnm: new Float64Array(buf, momentMinorPtr, n),
    torsionMomentKnm: new Float64Array(buf, torsionPtr, n),
    curvaturePerMm: new Float64Array(buf, curvaturePtr, n),
    rotationRad: new Float64Array(buf, rotationPtr, n),
    deflectionMm: new Float64Array(buf, deflectionPtr, n),
  };
}

/**
 * Creates zero-copy `Float32Array` and `Uint32Array` views directly over the 3D extruded mesh
 * buffers inside WASM linear memory.
 *
 * @returns `ZeroCopyMesh3DViews` pointing directly to `SolverWorkspace` mesh buffers.
 */
export function getZeroCopyMesh3DViews(): ZeroCopyMesh3DViews {
  const { exports, workspace } = ensureWasmMechanicsInitialized();
  const buf = exports.memory.buffer;

  const positionsPtr = workspace.mesh_positions_ptr();
  const positionsLen = workspace.mesh_positions_len();
  const normalsPtr = workspace.mesh_normals_ptr();
  const normalsLen = workspace.mesh_normals_len();
  const colorsPtr = workspace.mesh_colors_ptr();
  const colorsLen = workspace.mesh_colors_len();
  const indicesPtr = workspace.mesh_indices_ptr();
  const indicesLen = workspace.mesh_indices_len();

  return {
    positionsPtr,
    normalsPtr,
    colorsPtr,
    indicesPtr,
    positionsF32: new Float32Array(buf, positionsPtr, positionsLen),
    normalsF32: new Float32Array(buf, normalsPtr, normalsLen),
    colorsF32: new Float32Array(buf, colorsPtr, colorsLen),
    indicesU32: new Uint32Array(buf, indicesPtr, indicesLen),
    vertexCount: Math.floor(positionsLen / 3),
    triangleCount: Math.floor(indicesLen / 3),
  };
}

/**
 * Creates zero-copy `Float32Array` and `Uint32Array` views directly over the 3D rebar cage
 * wireframe buffers inside WASM linear memory.
 *
 * @returns `ZeroCopyRebarCage3DViews` pointing directly to `SolverWorkspace` rebar buffers.
 */
export function getZeroCopyRebarCage3DViews(): ZeroCopyRebarCage3DViews {
  const { exports, workspace } = ensureWasmMechanicsInitialized();
  const buf = exports.memory.buffer;

  const positionsPtr = workspace.rebar_positions_ptr();
  const positionsLen = workspace.rebar_positions_len();
  const indicesPtr = workspace.rebar_indices_ptr();
  const indicesLen = workspace.rebar_indices_len();

  return {
    positionsPtr,
    indicesPtr,
    positionsF32: new Float32Array(buf, positionsPtr, positionsLen),
    indicesU32: new Uint32Array(buf, indicesPtr, indicesLen),
    segmentCount: Math.floor(indicesLen / 2),
  };
}
