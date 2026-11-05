"use client";

/**
 * @file Beam3DExtrudedViewport.tsx
 * @description Client-only native WebGL2 viewport that renders the 3D extruded beam mesh produced by
 * the Rust WASM `SolverWorkspace` (zero-copy `Float32Array` / `Uint32Array` views) without any heavy
 * 3D dependency (no three.js). Supports:
 *
 * - Steel IWF / BOX profiles swept from end A (`s = 0`) to end B (`s = L`) along the deflected elastic
 *   curve with SAP2000 contour vertex colors and CAD-style crease (feature) edges.
 * - Reinforced concrete sub-mode 1 (`SOLID_WITH_END_SECTION`): solid envelope + end cross-section
 *   rebar/stirrup drawing on the end cap facing the camera (+ optional React overlay slot per end).
 * - Reinforced concrete sub-mode 2 (`WIREFRAME_REBAR_CAGE`): semi-transparent envelope
 *   (`opacity 0.18`, edges `#64748B`) exposing the longitudinal bars and stirrup ring cage.
 * - Interactive orbit / pan / zoom camera (mouse, touch pinch, keyboard) plus `ISOMETRIC_3D` and
 *   orthographic `FRONT_2D` presets so 2D SVG overlays (supports, diagrams) align 1:1.
 * - Dynamic vertical axis (`Z-Up`, `Y-Up`, `CustomXYZ`).
 *
 * IMPORTANT (SSR isolation): this module touches `window`/WebGL only inside effects, but it must still be
 * loaded through `next/dynamic` with `{ ssr: false }` so the canvas never participates in Next.js
 * server rendering / hydration:
 *
 * @example
 * ```tsx
 * import dynamic from "next/dynamic";
 *
 * const Beam3DExtrudedViewport = dynamic(
 *   () => import("@/components/canvas/Beam3DExtrudedViewport"),
 *   { ssr: false },
 * );
 *
 * <Beam3DExtrudedViewport
 *   mesh={meshViews}              // ZeroCopyMesh3DViews from wasm-mechanics-bridge
 *   meshRevision={solveCounter}   // increment after every WASM solve (views keep the same identity)
 *   materialKind="STEEL"
 *   coordinateMode="Z-Up"
 * />
 * ```
 */

import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import type { ZeroCopyMesh3DViews } from "@/core/mechanics/wasm-mechanics-bridge";
import type { CoordinateSystemMode, Vector3D } from "@/types/branded-units";

// ============================================================================
// Public Types
// ============================================================================

/** Structural material family rendered by the viewport. */
export type BeamMaterialKind = "STEEL" | "CONCRETE";

/** Reinforced concrete 3D visualization sub-mode. */
export type ConcreteViewMode = "SOLID_WITH_END_SECTION" | "WIREFRAME_REBAR_CAGE";

/** Camera presets. `FREE_ORBIT` is entered automatically when the user orbits away from a preset. */
export type CameraPreset = "ISOMETRIC_3D" | "FRONT_2D" | "FREE_ORBIT";

/** Beam end identifier: `A` at `s = 0`, `B` at `s = L`. */
export type BeamEnd = "A" | "B";

/** Immutable 3-component tuple used by the internal camera math. */
export type Vec3Tuple = readonly [number, number, number];

/**
 * Minimal mesh contract consumed by the viewport. Structurally satisfied by `ZeroCopyMesh3DViews`
 * returned from `wasm-mechanics-bridge.ts`.
 */
export type BeamMeshBufferInput = Pick<
  ZeroCopyMesh3DViews,
  "positionsF32" | "normalsF32" | "colorsF32" | "indicesU32"
>;

/**
 * Line-list wireframe buffers for the 3D reinforced concrete rebar cage
 * (longitudinal bars + stirrup rings).
 */
export interface RebarCageWireframeInput {
  /** Interleaved vertex positions `[x0, y0, z0, ...]` in mm (same space as the beam mesh). */
  readonly positionsF32: Float32Array;
  /** Line segment vertex index pairs `[a0, b0, a1, b1, ...]`. */
  readonly indicesU32: Uint32Array;
  /** Optional interleaved per-vertex colors `[r0, g0, b0, ...]` in `[0, 1]`. */
  readonly colorsF32?: Float32Array | null;
}

/** Screen-space projection of a world point (CSS pixels, origin at top-left of the canvas). */
export interface ScreenProjection {
  /** Horizontal CSS pixel coordinate. */
  readonly x: number;
  /** Vertical CSS pixel coordinate. */
  readonly y: number;
  /** Normalized device depth in `[-1, 1]` (smaller = closer). */
  readonly depth: number;
  /** Whether the point lies inside the view frustum. */
  readonly insideFrustum: boolean;
}

/**
 * Camera projection snapshot emitted whenever the view changes, enabling 2D SVG overlays
 * (`SupportSymbols2DOverlay`, `MultiModeDiagram2DOverlay`) to lock onto the 3D beam.
 */
export interface ViewportProjectionSnapshot {
  /** Column-major 4x4 view-projection matrix (copy, safe to retain). */
  readonly viewProjection: Float32Array;
  /** Canvas width in CSS pixels. */
  readonly widthCss: number;
  /** Canvas height in CSS pixels. */
  readonly heightCss: number;
  /** `true` while the orthographic `FRONT_2D` projection is active. */
  readonly isOrthographic: boolean;
  /** World millimeters represented by one CSS pixel at the camera target depth. */
  readonly worldUnitsPerPixel: number;
  /** Active camera preset. */
  readonly cameraPreset: CameraPreset;
  /** Screen projection of the end A cross-section centroid (`null` without a mesh). */
  readonly endAScreen: ScreenProjection | null;
  /** Screen projection of the end B cross-section centroid (`null` without a mesh). */
  readonly endBScreen: ScreenProjection | null;
}

/** Props of {@link Beam3DExtrudedViewport}. */
export interface Beam3DExtrudedViewportProps {
  /**
   * 3D extruded beam mesh (mm). `null` renders an empty stage with a waiting hint.
   * @example meshViews // ZeroCopyMesh3DViews from the WASM bridge
   */
  readonly mesh: BeamMeshBufferInput | null;
  /**
   * Monotonic counter incremented after every WASM solve. Required because zero-copy views keep the
   * same object identity while their memory content changes.
   * @example 42
   */
  readonly meshRevision?: number;
  /** Optional rebar cage wireframe (only drawn when `materialKind === "CONCRETE"`). */
  readonly rebarCage?: RebarCageWireframeInput | null;
  /** Material family (`"STEEL"` or `"CONCRETE"`). */
  readonly materialKind: BeamMaterialKind;
  /** Concrete sub-mode (default `"SOLID_WITH_END_SECTION"`). */
  readonly concreteViewMode?: ConcreteViewMode;
  /** Called when the user toggles the concrete sub-mode in the toolbar (toggle hidden if omitted). */
  readonly onConcreteViewModeChange?: (mode: ConcreteViewMode) => void;
  /** Active vertical axis convention (default `"Z-Up"`). */
  readonly coordinateMode?: CoordinateSystemMode;
  /** Up vector used when `coordinateMode === "CustomXYZ"` (default `{ x: 0, y: 0, z: 1 }`). */
  readonly customUpVector?: Vector3D;
  /** Beam span direction in world space (default `{ x: 1, y: 0, z: 0 }`). */
  readonly spanAxis?: Vector3D;
  /** Controlled camera preset request; applied whenever the value changes. */
  readonly cameraPreset?: CameraPreset;
  /** Called when the camera preset changes through user interaction. */
  readonly onCameraPresetChange?: (preset: CameraPreset) => void;
  /** Use SAP2000 contour vertex colors on solid surfaces (default `true`). */
  readonly useContourColors?: boolean;
  /** Axial depth (mm) from each beam end used to extract the end cross-section cage (default `120`). */
  readonly endSectionDepthMm?: number;
  /**
   * Optional React overlay rendered at the projected end-cap centroid in concrete solid mode
   * (e.g. `<ConcreteCrossSectionSvg />`). Only displayed while that end cap faces the camera.
   */
  readonly renderEndSection?: (end: BeamEnd) => ReactNode;
  /** Receives camera projection snapshots for 2D overlay synchronization. */
  readonly onProjectionChange?: (snapshot: ViewportProjectionSnapshot) => void;
  /** Receives every structured viewport error (also logged with `console.error`). */
  readonly onError?: (error: Beam3DViewportError) => void;
  /** Show the built-in camera toolbar (default `true`). */
  readonly showToolbar?: boolean;
  /** Extra class name on the root container. */
  readonly className?: string;
  /** Extra inline style on the root container. */
  readonly style?: CSSProperties;
  /** Accessible description of the canvas. */
  readonly ariaLabel?: string;
}

// ============================================================================
// Error Handling
// ============================================================================

/** Machine-readable viewport error codes for fast traceback. */
export type Beam3DViewportErrorCode =
  | "WEBGL2_UNAVAILABLE"
  | "SHADER_COMPILE_FAILED"
  | "PROGRAM_LINK_FAILED"
  | "GPU_RESOURCE_ALLOCATION_FAILED"
  | "INVALID_MESH_BUFFERS"
  | "INVALID_REBAR_CAGE_BUFFERS"
  | "INVALID_CAMERA_CONFIGURATION"
  | "INVALID_COLOR_TOKEN"
  | "WEBGL_CONTEXT_LOST"
  | "RENDER_FRAME_FAILED";

/**
 * Structured error raised by the 3D viewport.
 *
 * @example
 * ```ts
 * throw new Beam3DViewportError("INVALID_MESH_BUFFERS", "normals length mismatch", { expected: 30, actual: 27 });
 * ```
 */
export class Beam3DViewportError extends Error {
  /** Machine-readable error code. */
  public readonly code: Beam3DViewportErrorCode;
  /** Diagnostic payload (lengths, indices, GLSL logs, ...). */
  public readonly details: Readonly<Record<string, unknown>>;
  /** Whether the viewport can recover automatically without a page reload. */
  public readonly recoverable: boolean;

  /**
   * @param code Machine-readable error code.
   * @param message Human-readable message.
   * @param details Diagnostic payload for traceback.
   * @param options Optional `cause` and `recoverable` flag (default `false`).
   */
  constructor(
    code: Beam3DViewportErrorCode,
    message: string,
    details: Readonly<Record<string, unknown>> = {},
    options: { readonly cause?: unknown; readonly recoverable?: boolean } = {},
  ) {
    super(`[Beam3DViewportError:${code}] ${message}`, { cause: options.cause });
    this.name = "Beam3DViewportError";
    this.code = code;
    this.details = details;
    this.recoverable = options.recoverable ?? false;
  }
}

/** Indonesian user-facing remediation hints per error code. */
const ERROR_HINTS: Record<Beam3DViewportErrorCode, string> = {
  WEBGL2_UNAVAILABLE:
    "Browser/GPU tidak mendukung WebGL2. Aktifkan akselerasi hardware atau gunakan Chrome/Edge/Firefox terbaru.",
  SHADER_COMPILE_FAILED:
    "Driver GPU menolak shader. Perbarui driver grafis; log GLSL lengkap tersedia di console.",
  PROGRAM_LINK_FAILED:
    "Driver GPU gagal me-link program shader. Perbarui driver grafis lalu muat ulang halaman.",
  GPU_RESOURCE_ALLOCATION_FAILED:
    "Memori GPU tidak mencukupi. Tutup tab berat lain lalu muat ulang halaman.",
  INVALID_MESH_BUFFERS:
    "Buffer mesh dari solver WASM tidak konsisten. Periksa output wasm-mechanics-bridge (panjang/indeks/NaN).",
  INVALID_REBAR_CAGE_BUFFERS:
    "Buffer wireframe tulangan tidak konsisten. Periksa output rebar cage dari solver WASM.",
  INVALID_CAMERA_CONFIGURATION:
    "Vektor sumbu kustom tidak valid (nol/NaN/sejajar bentang). Viewport kembali memakai Z-Up.",
  INVALID_COLOR_TOKEN: "Token warna internal tidak valid. Periksa konstanta VIEWPORT_COLORS.",
  WEBGL_CONTEXT_LOST: "Konteks WebGL hilang (GPU reset). Viewport akan pulih otomatis.",
  RENDER_FRAME_FAILED: "Gagal merender frame. Detail stack trace tersedia di console.",
};

/** Error codes caused by input data (auto-cleared on the next successful upload). */
const DATA_ERROR_CODES: ReadonlySet<Beam3DViewportErrorCode> = new Set([
  "INVALID_MESH_BUFFERS",
  "INVALID_REBAR_CAGE_BUFFERS",
  "WEBGL_CONTEXT_LOST",
  "RENDER_FRAME_FAILED",
]);

/**
 * Normalizes any thrown value into a {@link Beam3DViewportError}.
 * @param error Thrown value.
 * @param fallbackCode Code used when `error` is not already a viewport error.
 * @param details Extra diagnostic payload merged into the wrapper.
 * @returns Structured viewport error preserving the original as `cause`.
 * @example normalizeViewportError(new Error("boom"), "RENDER_FRAME_FAILED").code // "RENDER_FRAME_FAILED"
 */
export function normalizeViewportError(
  error: unknown,
  fallbackCode: Beam3DViewportErrorCode,
  details: Readonly<Record<string, unknown>> = {},
): Beam3DViewportError {
  if (error instanceof Beam3DViewportError) return error;
  const message = error instanceof Error ? error.message : String(error);
  return new Beam3DViewportError(fallbackCode, message, details, { cause: error });
}

// ============================================================================
// Constants & Design Tokens
// ============================================================================

const CAMERA_FIELD_OF_VIEW_RAD = (35 * Math.PI) / 180;
const MAX_DEVICE_PIXEL_RATIO = 2;
const PITCH_LIMIT_RAD = (89 * Math.PI) / 180;
const ORBIT_SENSITIVITY_RAD_PER_PX = 0.0075;
const KEYBOARD_ORBIT_STEP_RAD = 0.06;
const WHEEL_ZOOM_SENSITIVITY = 0.0015;
const DEFAULT_SCENE_RADIUS_MM = 1_000;
const FIT_MARGIN = 1.08;
const DEFAULT_CREASE_ANGLE_DEG = 30;
const DEFAULT_END_SECTION_DEPTH_MM = 120;
const END_CAP_FACING_THRESHOLD = 0.12;
const EDGE_DEPTH_BIAS = 0.0004;
const WIREFRAME_ENVELOPE_OPACITY = 0.18;

/** Hex design tokens (Erzysh Dark Void Theme). */
const VIEWPORT_COLORS = {
  steelBase: "#94A3B8",
  concreteBase: "#A8A29E",
  wireEnvelope: "#64748B",
  rebar: "#F59E0B",
  featureEdge: "#020617",
} as const;

/** Camera orientation per fixed preset. */
const CAMERA_PRESET_ORIENTATION: Record<
  Exclude<CameraPreset, "FREE_ORBIT">,
  { readonly yaw: number; readonly pitch: number; readonly orthographic: boolean }
> = {
  ISOMETRIC_3D: { yaw: -0.62, pitch: 0.42, orthographic: false },
  FRONT_2D: { yaw: 0, pitch: 0, orthographic: true },
};

/**
 * Parses a `#RRGGBB` hex token into normalized RGB.
 * @param hex Hex color (e.g. `"#64748B"`).
 * @returns RGB tuple in `[0, 1]`.
 * @throws {Beam3DViewportError} `INVALID_COLOR_TOKEN` when the token is malformed.
 * @example hexToRgb01("#FF0000") // [1, 0, 0]
 */
export function hexToRgb01(hex: string): Vec3Tuple {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const digits = match?.[1];
  if (digits === undefined) {
    throw new Beam3DViewportError("INVALID_COLOR_TOKEN", `Malformed hex color token "${hex}".`, {
      hex,
    });
  }
  const value = Number.parseInt(digits, 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

const RGB = {
  steelBase: hexToRgb01(VIEWPORT_COLORS.steelBase),
  concreteBase: hexToRgb01(VIEWPORT_COLORS.concreteBase),
  wireEnvelope: hexToRgb01(VIEWPORT_COLORS.wireEnvelope),
  rebar: hexToRgb01(VIEWPORT_COLORS.rebar),
  featureEdge: hexToRgb01(VIEWPORT_COLORS.featureEdge),
} as const;

// ============================================================================
// Vector & Matrix Math (column-major, allocation-light)
// ============================================================================

function add3(a: Vec3Tuple, b: Vec3Tuple): Vec3Tuple {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function sub3(a: Vec3Tuple, b: Vec3Tuple): Vec3Tuple {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale3(a: Vec3Tuple, s: number): Vec3Tuple {
  return [a[0] * s, a[1] * s, a[2] * s];
}

function dot3(a: Vec3Tuple, b: Vec3Tuple): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross3(a: Vec3Tuple, b: Vec3Tuple): Vec3Tuple {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function normalize3(a: Vec3Tuple): Vec3Tuple | null {
  const length = Math.hypot(a[0], a[1], a[2]);
  if (!Number.isFinite(length) || length < 1e-12) return null;
  return [a[0] / length, a[1] / length, a[2] / length];
}

function toTuple(v: Vector3D): Vec3Tuple {
  return [v.x, v.y, v.z];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Returns any unit vector orthogonal to `axis` (used when a cross product degenerates). */
function orthogonalFallback(axis: Vec3Tuple): Vec3Tuple {
  const helper: Vec3Tuple = Math.abs(axis[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  return normalize3(cross3(helper, axis)) ?? [0, 1, 0];
}

function mat4Perspective(
  out: Float32Array,
  fovY: number,
  aspect: number,
  near: number,
  far: number,
): void {
  const f = 1 / Math.tan(fovY / 2);
  const rangeInverse = 1 / (near - far);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) * rangeInverse;
  out[11] = -1;
  out[14] = 2 * far * near * rangeInverse;
}

function mat4Orthographic(
  out: Float32Array,
  left: number,
  right: number,
  bottom: number,
  top: number,
  near: number,
  far: number,
): void {
  out.fill(0);
  out[0] = 2 / (right - left);
  out[5] = 2 / (top - bottom);
  out[10] = -2 / (far - near);
  out[12] = -(right + left) / (right - left);
  out[13] = -(top + bottom) / (top - bottom);
  out[14] = -(far + near) / (far - near);
  out[15] = 1;
}

function mat4LookAt(out: Float32Array, eye: Vec3Tuple, target: Vec3Tuple, up: Vec3Tuple): void {
  const zAxis = normalize3(sub3(eye, target)) ?? [0, 0, 1];
  const xAxis = normalize3(cross3(up, zAxis)) ?? orthogonalFallback(zAxis);
  const yAxis = cross3(zAxis, xAxis);
  out[0] = xAxis[0];
  out[1] = yAxis[0];
  out[2] = zAxis[0];
  out[3] = 0;
  out[4] = xAxis[1];
  out[5] = yAxis[1];
  out[6] = zAxis[1];
  out[7] = 0;
  out[8] = xAxis[2];
  out[9] = yAxis[2];
  out[10] = zAxis[2];
  out[11] = 0;
  out[12] = -dot3(xAxis, eye);
  out[13] = -dot3(yAxis, eye);
  out[14] = -dot3(zAxis, eye);
  out[15] = 1;
}

const MULTIPLY_SCRATCH = new Float32Array(16);

function mat4Multiply(out: Float32Array, a: Float32Array, b: Float32Array): void {
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row]! * b[column * 4 + k]!;
      MULTIPLY_SCRATCH[column * 4 + row] = sum;
    }
  }
  out.set(MULTIPLY_SCRATCH);
}

// ============================================================================
// Camera Model
// ============================================================================

/** Orthonormal world basis driving the orbit camera. */
export interface OrbitCameraBasis {
  /** Unit vertical axis (Z for `Z-Up`, Y for `Y-Up`). */
  readonly up: Vec3Tuple;
  /** Unit beam span axis orthogonalized against `up`. */
  readonly span: Vec3Tuple;
  /** Unit front direction `span x up`; the `FRONT_2D` camera sits along this axis. */
  readonly front: Vec3Tuple;
}

/** Mutable orbit camera state (spherical coordinates around `target`). */
export interface OrbitCameraState {
  /** Orbit pivot in world mm. */
  target: Vec3Tuple;
  /** Eye-to-target distance in mm. */
  distance: number;
  /** Azimuth in radians around `up` (0 = front view). */
  yaw: number;
  /** Elevation in radians, clamped to `±89°`. */
  pitch: number;
  /** Orthographic projection flag. */
  orthographic: boolean;
  /** Active preset. */
  preset: CameraPreset;
}

/**
 * Resolves the world up vector from the coordinate system mode.
 * @param mode `"Z-Up"`, `"Y-Up"`, or `"CustomXYZ"`.
 * @param customUpVector Up vector for `"CustomXYZ"` (any non-zero length).
 * @returns Unit up vector.
 * @throws {Beam3DViewportError} `INVALID_CAMERA_CONFIGURATION` for zero/NaN custom vectors.
 * @example resolveUpVector("Y-Up") // [0, 1, 0]
 */
export function resolveUpVector(mode: CoordinateSystemMode, customUpVector?: Vector3D): Vec3Tuple {
  switch (mode) {
    case "Z-Up":
      return [0, 0, 1];
    case "Y-Up":
      return [0, 1, 0];
    case "CustomXYZ": {
      const custom = normalize3(toTuple(customUpVector ?? { x: 0, y: 0, z: 1 }));
      if (!custom) {
        throw new Beam3DViewportError(
          "INVALID_CAMERA_CONFIGURATION",
          "customUpVector must be a finite non-zero vector.",
          { customUpVector },
        );
      }
      return custom;
    }
    default: {
      const exhaustive: never = mode;
      throw new Beam3DViewportError(
        "INVALID_CAMERA_CONFIGURATION",
        `Unknown coordinate mode "${String(exhaustive)}".`,
        { mode: exhaustive },
      );
    }
  }
}

/**
 * Builds the orthonormal orbit basis from the up vector and beam span axis.
 * @param up Up vector (normalized internally).
 * @param spanAxis Beam span direction (default `[1, 0, 0]`).
 * @returns Orthonormal `{ up, span, front }` basis.
 * @throws {Beam3DViewportError} `INVALID_CAMERA_CONFIGURATION` when vectors are degenerate or parallel.
 * @example computeOrbitCameraBasis([0, 0, 1]).front // [0, -1, 0] (SAP2000 XZ front view)
 */
export function computeOrbitCameraBasis(
  up: Vec3Tuple,
  spanAxis: Vec3Tuple = [1, 0, 0],
): OrbitCameraBasis {
  const unitUp = normalize3(up);
  const unitSpan = normalize3(spanAxis);
  if (!unitUp || !unitSpan) {
    throw new Beam3DViewportError(
      "INVALID_CAMERA_CONFIGURATION",
      "Up and span axes must be finite non-zero vectors.",
      { up, spanAxis },
    );
  }
  // Gram-Schmidt: remove the vertical component from the span axis.
  const span = normalize3(sub3(unitSpan, scale3(unitUp, dot3(unitSpan, unitUp))));
  if (!span) {
    throw new Beam3DViewportError(
      "INVALID_CAMERA_CONFIGURATION",
      "Span axis is parallel to the up axis; the beam cannot be vertical.",
      { up, spanAxis },
    );
  }
  return { up: unitUp, span, front: cross3(span, unitUp) };
}

/**
 * Computes the camera eye position from spherical orbit coordinates.
 * @param camera Orbit camera state.
 * @param basis Orbit basis.
 * @returns Eye position in world mm.
 * @example computeCameraEye({ target: [0,0,0], distance: 10, yaw: 0, pitch: 0, orthographic: true, preset: "FRONT_2D" }, basis)
 */
export function computeCameraEye(camera: OrbitCameraState, basis: OrbitCameraBasis): Vec3Tuple {
  const cosPitch = Math.cos(camera.pitch);
  const direction = add3(
    add3(
      scale3(basis.front, cosPitch * Math.cos(camera.yaw)),
      scale3(basis.span, cosPitch * Math.sin(camera.yaw)),
    ),
    scale3(basis.up, Math.sin(camera.pitch)),
  );
  return add3(camera.target, scale3(direction, camera.distance));
}

/** Pre-allocated camera matrices reused every frame. */
interface CameraMatrices {
  readonly view: Float32Array;
  readonly projection: Float32Array;
  readonly viewProjection: Float32Array;
}

/**
 * Writes view, projection, and view-projection matrices for the current camera.
 * @param camera Orbit camera state.
 * @param basis Orbit basis.
 * @param aspect Viewport width / height.
 * @param sceneRadius Bounding sphere radius in mm (clip plane sizing).
 * @param out Pre-allocated matrices (mutated).
 * @returns Eye position and half visible height (mm) at the target depth.
 */
export function buildCameraMatrices(
  camera: OrbitCameraState,
  basis: OrbitCameraBasis,
  aspect: number,
  sceneRadius: number,
  out: CameraMatrices,
): { readonly eye: Vec3Tuple; readonly halfHeight: number } {
  const eye = computeCameraEye(camera, basis);
  mat4LookAt(out.view, eye, camera.target, basis.up);
  const halfHeight = camera.distance * Math.tan(CAMERA_FIELD_OF_VIEW_RAD / 2);
  const radius = Math.max(sceneRadius, 1);
  if (camera.orthographic) {
    mat4Orthographic(
      out.projection,
      -halfHeight * aspect,
      halfHeight * aspect,
      -halfHeight,
      halfHeight,
      camera.distance - radius * 4,
      camera.distance + radius * 4,
    );
  } else {
    const near = Math.max(camera.distance - radius * 2, camera.distance * 0.01, 0.1);
    mat4Perspective(
      out.projection,
      CAMERA_FIELD_OF_VIEW_RAD,
      aspect,
      near,
      camera.distance + radius * 4,
    );
  }
  mat4Multiply(out.viewProjection, out.projection, out.view);
  return { eye, halfHeight };
}

/**
 * Projects a world point to CSS-pixel screen coordinates.
 * @param viewProjection Column-major view-projection matrix.
 * @param point World point in mm.
 * @param widthCss Canvas width in CSS px.
 * @param heightCss Canvas height in CSS px.
 * @returns Screen projection, or `null` when the point is behind the camera.
 * @example projectWorldToScreen(snapshot.viewProjection, [3000, 0, 0], 1280, 720)
 */
export function projectWorldToScreen(
  viewProjection: Float32Array,
  point: Vec3Tuple,
  widthCss: number,
  heightCss: number,
): ScreenProjection | null {
  const m = viewProjection;
  const [x, y, z] = point;
  const clipX = m[0]! * x + m[4]! * y + m[8]! * z + m[12]!;
  const clipY = m[1]! * x + m[5]! * y + m[9]! * z + m[13]!;
  const clipZ = m[2]! * x + m[6]! * y + m[10]! * z + m[14]!;
  const clipW = m[3]! * x + m[7]! * y + m[11]! * z + m[15]!;
  if (!(clipW > 1e-9)) return null;
  const ndcX = clipX / clipW;
  const ndcY = clipY / clipW;
  const ndcZ = clipZ / clipW;
  return {
    x: (ndcX * 0.5 + 0.5) * widthCss,
    y: (1 - (ndcY * 0.5 + 0.5)) * heightCss,
    depth: ndcZ,
    insideFrustum: Math.abs(ndcX) <= 1 && Math.abs(ndcY) <= 1 && Math.abs(ndcZ) <= 1,
  };
}

function createInitialCamera(preset: CameraPreset): OrbitCameraState {
  const orientation = CAMERA_PRESET_ORIENTATION[preset === "FREE_ORBIT" ? "ISOMETRIC_3D" : preset];
  return {
    target: [0, 0, 0],
    distance: 5_000,
    yaw: orientation.yaw,
    pitch: orientation.pitch,
    orthographic: orientation.orthographic,
    preset,
  };
}

function applyPresetToCamera(camera: OrbitCameraState, preset: CameraPreset): void {
  camera.preset = preset;
  if (preset === "FREE_ORBIT") {
    camera.orthographic = false;
    return;
  }
  const orientation = CAMERA_PRESET_ORIENTATION[preset];
  camera.yaw = orientation.yaw;
  camera.pitch = orientation.pitch;
  camera.orthographic = orientation.orthographic;
}

function orbitCamera(camera: OrbitCameraState, deltaYaw: number, deltaPitch: number): void {
  camera.yaw -= deltaYaw;
  camera.pitch = clamp(camera.pitch + deltaPitch, -PITCH_LIMIT_RAD, PITCH_LIMIT_RAD);
}

function panCamera(
  camera: OrbitCameraState,
  basis: OrbitCameraBasis,
  deltaXPx: number,
  deltaYPx: number,
  heightCss: number,
): void {
  const eye = computeCameraEye(camera, basis);
  const forward = normalize3(sub3(camera.target, eye)) ?? scale3(basis.front, -1);
  const right = normalize3(cross3(forward, basis.up)) ?? basis.span;
  const cameraUp = cross3(right, forward);
  // World mm per CSS pixel at the target depth (identical for perspective and orthographic).
  const worldPerPixel =
    (2 * camera.distance * Math.tan(CAMERA_FIELD_OF_VIEW_RAD / 2)) / Math.max(heightCss, 1);
  camera.target = add3(
    camera.target,
    add3(scale3(right, -deltaXPx * worldPerPixel), scale3(cameraUp, deltaYPx * worldPerPixel)),
  );
}

function zoomCamera(camera: OrbitCameraState, factor: number, sceneRadius: number): void {
  if (!Number.isFinite(factor) || factor <= 0) return;
  const radius = Math.max(sceneRadius, 1);
  camera.distance = clamp(camera.distance * factor, radius * 0.02, radius * 60);
}

// ============================================================================
// Mesh Validation & Geometry Preprocessing
// ============================================================================

/** Axis-aligned scene bounds in world mm. */
export interface SceneBounds {
  readonly min: Vec3Tuple;
  readonly max: Vec3Tuple;
  readonly center: Vec3Tuple;
  /** Bounding sphere radius (half diagonal, minimum 1 mm). */
  readonly radius: number;
}

/**
 * Validates mesh buffers coming from the WASM bridge before GPU upload.
 * @param mesh Mesh buffers.
 * @returns Vertex and triangle counts.
 * @throws {Beam3DViewportError} `INVALID_MESH_BUFFERS` with the first offending component/index.
 * @example validateBeamMeshBuffers(meshViews) // { vertexCount: 7168, triangleCount: 14336 }
 */
export function validateBeamMeshBuffers(mesh: BeamMeshBufferInput): {
  readonly vertexCount: number;
  readonly triangleCount: number;
} {
  const { positionsF32, normalsF32, colorsF32, indicesU32 } = mesh;
  if (
    !(positionsF32 instanceof Float32Array) ||
    !(normalsF32 instanceof Float32Array) ||
    !(colorsF32 instanceof Float32Array) ||
    !(indicesU32 instanceof Uint32Array)
  ) {
    throw new Beam3DViewportError(
      "INVALID_MESH_BUFFERS",
      "Mesh buffers must be Float32Array (positions/normals/colors) and Uint32Array (indices).",
    );
  }
  if (positionsF32.length === 0 || positionsF32.length % 3 !== 0) {
    throw new Beam3DViewportError(
      "INVALID_MESH_BUFFERS",
      `positionsF32 length (${positionsF32.length}) must be a positive multiple of 3.`,
      { positionsLength: positionsF32.length },
    );
  }
  if (normalsF32.length !== positionsF32.length || colorsF32.length !== positionsF32.length) {
    throw new Beam3DViewportError(
      "INVALID_MESH_BUFFERS",
      "normalsF32 and colorsF32 lengths must equal positionsF32 length.",
      {
        positionsLength: positionsF32.length,
        normalsLength: normalsF32.length,
        colorsLength: colorsF32.length,
      },
    );
  }
  if (indicesU32.length === 0 || indicesU32.length % 3 !== 0) {
    throw new Beam3DViewportError(
      "INVALID_MESH_BUFFERS",
      `indicesU32 length (${indicesU32.length}) must be a positive multiple of 3.`,
      { indicesLength: indicesU32.length },
    );
  }
  const vertexCount = positionsF32.length / 3;
  for (let i = 0; i < positionsF32.length; i++) {
    if (!Number.isFinite(positionsF32[i]!)) {
      throw new Beam3DViewportError(
        "INVALID_MESH_BUFFERS",
        `Non-finite position component at index ${i} (vertex ${Math.floor(i / 3)}).`,
        { componentIndex: i, vertexIndex: Math.floor(i / 3), value: positionsF32[i] },
      );
    }
  }
  for (let i = 0; i < indicesU32.length; i++) {
    if (indicesU32[i]! >= vertexCount) {
      throw new Beam3DViewportError(
        "INVALID_MESH_BUFFERS",
        `Triangle index ${indicesU32[i]} at position ${i} exceeds vertex count ${vertexCount}.`,
        { indexPosition: i, indexValue: indicesU32[i], vertexCount },
      );
    }
  }
  return { vertexCount, triangleCount: indicesU32.length / 3 };
}

/**
 * Validates rebar cage line-list buffers.
 * @param cage Rebar cage buffers.
 * @returns Vertex and segment counts.
 * @throws {Beam3DViewportError} `INVALID_REBAR_CAGE_BUFFERS` with the offending component/index.
 * @example validateRebarCageBuffers(cage) // { vertexCount: 512, segmentCount: 780 }
 */
export function validateRebarCageBuffers(cage: RebarCageWireframeInput): {
  readonly vertexCount: number;
  readonly segmentCount: number;
} {
  const { positionsF32, indicesU32, colorsF32 } = cage;
  if (!(positionsF32 instanceof Float32Array) || !(indicesU32 instanceof Uint32Array)) {
    throw new Beam3DViewportError(
      "INVALID_REBAR_CAGE_BUFFERS",
      "Rebar cage buffers must be Float32Array (positions) and Uint32Array (indices).",
    );
  }
  if (positionsF32.length === 0 || positionsF32.length % 3 !== 0) {
    throw new Beam3DViewportError(
      "INVALID_REBAR_CAGE_BUFFERS",
      `Rebar positionsF32 length (${positionsF32.length}) must be a positive multiple of 3.`,
      { positionsLength: positionsF32.length },
    );
  }
  if (colorsF32 && colorsF32.length !== positionsF32.length) {
    throw new Beam3DViewportError(
      "INVALID_REBAR_CAGE_BUFFERS",
      "Rebar colorsF32 length must equal positionsF32 length.",
      { positionsLength: positionsF32.length, colorsLength: colorsF32.length },
    );
  }
  if (indicesU32.length % 2 !== 0) {
    throw new Beam3DViewportError(
      "INVALID_REBAR_CAGE_BUFFERS",
      `Rebar indicesU32 length (${indicesU32.length}) must be even (line pairs).`,
      { indicesLength: indicesU32.length },
    );
  }
  const vertexCount = positionsF32.length / 3;
  for (let i = 0; i < positionsF32.length; i++) {
    if (!Number.isFinite(positionsF32[i]!)) {
      throw new Beam3DViewportError(
        "INVALID_REBAR_CAGE_BUFFERS",
        `Non-finite rebar position component at index ${i}.`,
        { componentIndex: i, value: positionsF32[i] },
      );
    }
  }
  for (let i = 0; i < indicesU32.length; i++) {
    if (indicesU32[i]! >= vertexCount) {
      throw new Beam3DViewportError(
        "INVALID_REBAR_CAGE_BUFFERS",
        `Rebar index ${indicesU32[i]} at position ${i} exceeds vertex count ${vertexCount}.`,
        { indexPosition: i, indexValue: indicesU32[i], vertexCount },
      );
    }
  }
  return { vertexCount, segmentCount: indicesU32.length / 2 };
}

/**
 * Computes axis-aligned bounds and bounding sphere radius of interleaved positions.
 * @param positions Interleaved `[x, y, z, ...]` positions in mm.
 * @returns Scene bounds.
 * @example computeSceneBounds(new Float32Array([0,0,0, 6000,300,150])).center // [3000, 150, 75]
 */
export function computeSceneBounds(positions: Float32Array): SceneBounds {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (let i = 0; i + 2 < positions.length; i += 3) {
    const x = positions[i]!;
    const y = positions[i + 1]!;
    const z = positions[i + 2]!;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }
  if (!Number.isFinite(minX)) {
    return { min: [0, 0, 0], max: [0, 0, 0], center: [0, 0, 0], radius: DEFAULT_SCENE_RADIUS_MM };
  }
  const min: Vec3Tuple = [minX, minY, minZ];
  const max: Vec3Tuple = [maxX, maxY, maxZ];
  return {
    min,
    max,
    center: scale3(add3(min, max), 0.5),
    radius: Math.max(0.5 * Math.hypot(maxX - minX, maxY - minY, maxZ - minZ), 1),
  };
}

function computeSpanExtent(
  positions: Float32Array,
  axis: Vec3Tuple,
): { readonly minS: number; readonly maxS: number } {
  let minS = Number.POSITIVE_INFINITY;
  let maxS = Number.NEGATIVE_INFINITY;
  for (let i = 0; i + 2 < positions.length; i += 3) {
    const s = positions[i]! * axis[0] + positions[i + 1]! * axis[1] + positions[i + 2]! * axis[2];
    if (s < minS) minS = s;
    if (s > maxS) maxS = s;
  }
  return Number.isFinite(minS) ? { minS, maxS } : { minS: 0, maxS: 0 };
}

/**
 * Extracts CAD-style crease and boundary edges from a CCW triangle mesh. Coincident vertices are
 * welded first so hard-edge duplicated vertices still share adjacency; coplanar quad diagonals and
 * station ring edges on flat faces are discarded.
 *
 * @param positions Interleaved positions in mm.
 * @param indices CCW triangle indices.
 * @param creaseAngleDeg Dihedral angle threshold in degrees (default `30`, range `(0, 180)`).
 * @returns Line-list index pairs referencing the original vertices.
 * @throws {Beam3DViewportError} `INVALID_MESH_BUFFERS` when the threshold is out of range.
 * @example extractFeatureEdges(mesh.positionsF32, mesh.indicesU32).length / 2 // edge count
 */
export function extractFeatureEdges(
  positions: Float32Array,
  indices: Uint32Array,
  creaseAngleDeg: number = DEFAULT_CREASE_ANGLE_DEG,
): Uint32Array {
  if (!(creaseAngleDeg > 0 && creaseAngleDeg < 180)) {
    throw new Beam3DViewportError(
      "INVALID_MESH_BUFFERS",
      `creaseAngleDeg must be within (0, 180). Received ${creaseAngleDeg}.`,
      { creaseAngleDeg },
    );
  }
  const vertexCount = Math.floor(positions.length / 3);
  const triangleCount = Math.floor(indices.length / 3);

  // Weld at 0.001 mm resolution.
  const canonical = new Uint32Array(vertexCount);
  const weldMap = new Map<string, number>();
  for (let v = 0; v < vertexCount; v++) {
    const key = `${Math.round(positions[v * 3]! * 1000)}|${Math.round(positions[v * 3 + 1]! * 1000)}|${Math.round(positions[v * 3 + 2]! * 1000)}`;
    const existing = weldMap.get(key);
    if (existing === undefined) {
      weldMap.set(key, v);
      canonical[v] = v;
    } else {
      canonical[v] = existing;
    }
  }

  const faceNormals = new Float32Array(triangleCount * 3);
  const validFace = new Uint8Array(triangleCount);
  for (let t = 0; t < triangleCount; t++) {
    const a = indices[t * 3]! * 3;
    const b = indices[t * 3 + 1]! * 3;
    const c = indices[t * 3 + 2]! * 3;
    const normal = normalize3(
      cross3(
        [
          positions[b]! - positions[a]!,
          positions[b + 1]! - positions[a + 1]!,
          positions[b + 2]! - positions[a + 2]!,
        ],
        [
          positions[c]! - positions[a]!,
          positions[c + 1]! - positions[a + 1]!,
          positions[c + 2]! - positions[a + 2]!,
        ],
      ),
    );
    if (normal) {
      faceNormals[t * 3] = normal[0];
      faceNormals[t * 3 + 1] = normal[1];
      faceNormals[t * 3 + 2] = normal[2];
      validFace[t] = 1;
    }
  }

  const cosThreshold = Math.cos((creaseAngleDeg * Math.PI) / 180);
  const edgeOwner = new Map<number, number>();
  const edgeFirstPair = new Map<number, number>();
  const output: number[] = [];

  for (let t = 0; t < triangleCount; t++) {
    if (validFace[t] === 0) continue;
    for (let e = 0; e < 3; e++) {
      const originalA = indices[t * 3 + e]!;
      const originalB = indices[t * 3 + ((e + 1) % 3)]!;
      const canonicalA = canonical[originalA]!;
      const canonicalB = canonical[originalB]!;
      if (canonicalA === canonicalB) continue;
      const key = Math.min(canonicalA, canonicalB) * vertexCount + Math.max(canonicalA, canonicalB);
      const owner = edgeOwner.get(key);
      if (owner === undefined) {
        edgeOwner.set(key, t);
        edgeFirstPair.set(key, originalA * vertexCount + originalB);
      } else if (owner >= 0) {
        const cosine =
          faceNormals[owner * 3]! * faceNormals[t * 3]! +
          faceNormals[owner * 3 + 1]! * faceNormals[t * 3 + 1]! +
          faceNormals[owner * 3 + 2]! * faceNormals[t * 3 + 2]!;
        if (cosine < cosThreshold) output.push(originalA, originalB);
        edgeOwner.set(key, -1);
      }
    }
  }
  for (const [key, owner] of edgeOwner) {
    if (owner < 0) continue;
    const packed = edgeFirstPair.get(key);
    if (packed === undefined) continue;
    output.push(Math.floor(packed / vertexCount), packed % vertexCount);
  }
  return Uint32Array.from(output);
}

/**
 * Splits rebar cage segments lying within `depthMm` of each beam end (end cross-section drawing).
 * @param positions Rebar cage positions in mm.
 * @param indices Line-list index pairs.
 * @param spanAxis Unit span axis.
 * @param minS Span coordinate of end A (mm).
 * @param maxS Span coordinate of end B (mm).
 * @param depthMm Axial extraction depth from each end (mm, > 0).
 * @returns Index pairs for end A and end B.
 * @example partitionEndSectionSegments(cage.positionsF32, cage.indicesU32, [1,0,0], 0, 6000, 120)
 */
export function partitionEndSectionSegments(
  positions: Float32Array,
  indices: Uint32Array,
  spanAxis: Vec3Tuple,
  minS: number,
  maxS: number,
  depthMm: number,
): { readonly endA: Uint32Array; readonly endB: Uint32Array } {
  const depth = Number.isFinite(depthMm) && depthMm > 0 ? depthMm : DEFAULT_END_SECTION_DEPTH_MM;
  const endA: number[] = [];
  const endB: number[] = [];
  const spanOf = (vertex: number): number =>
    positions[vertex * 3]! * spanAxis[0] +
    positions[vertex * 3 + 1]! * spanAxis[1] +
    positions[vertex * 3 + 2]! * spanAxis[2];
  for (let i = 0; i + 1 < indices.length; i += 2) {
    const a = indices[i]!;
    const b = indices[i + 1]!;
    const sa = spanOf(a);
    const sb = spanOf(b);
    if (sa - minS <= depth && sb - minS <= depth) endA.push(a, b);
    else if (maxS - sa <= depth && maxS - sb <= depth) endB.push(a, b);
  }
  return { endA: Uint32Array.from(endA), endB: Uint32Array.from(endB) };
}

function computeTopologyKey(indices: Uint32Array, vertexCount: number): string {
  let hash = 2166136261;
  const samples = Math.min(indices.length, 64);
  for (let k = 0; k < samples; k++) {
    const position = Math.floor((k * (indices.length - 1)) / Math.max(samples - 1, 1));
    hash = Math.imul(hash ^ indices[position]!, 16777619) >>> 0;
  }
  return `${vertexCount}:${indices.length}:${hash}`;
}

// ============================================================================
// GLSL Shaders (WebGL2 / GLSL ES 3.00)
// ============================================================================

const MESH_VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec3 aColor;
uniform mat4 uViewProjection;
out vec3 vWorldPosition;
out vec3 vNormal;
out vec3 vColor;
void main() {
  vWorldPosition = aPosition;
  vNormal = aNormal;
  vColor = aColor;
  gl_Position = uViewProjection * vec4(aPosition, 1.0);
}`;

const MESH_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec3 vWorldPosition;
in vec3 vNormal;
in vec3 vColor;
uniform vec3 uEyePosition;
uniform vec3 uKeyLightDirection;
uniform vec3 uBaseColor;
uniform float uUseVertexColor;
uniform float uOpacity;
out vec4 outColor;
void main() {
  vec3 viewDirection = normalize(uEyePosition - vWorldPosition);
  float normalLength = length(vNormal);
  vec3 n = normalLength > 1e-6 ? vNormal / normalLength : viewDirection;
  if (!gl_FrontFacing) n = -n;
  float keyLight = max(dot(n, uKeyLightDirection), 0.0);
  float fillLight = max(dot(n, viewDirection), 0.0);
  float specular = pow(max(dot(n, normalize(uKeyLightDirection + viewDirection)), 0.0), 48.0);
  vec3 albedo = mix(uBaseColor, vColor, uUseVertexColor);
  vec3 shaded = albedo * (0.34 + 0.52 * keyLight + 0.22 * fillLight) + vec3(0.10) * specular;
  outColor = vec4(shaded * uOpacity, uOpacity);
}`;

const LINE_VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec3 aPosition;
layout(location = 2) in vec3 aColor;
uniform mat4 uViewProjection;
uniform float uDepthBias;
out vec3 vColor;
void main() {
  vColor = aColor;
  vec4 clip = uViewProjection * vec4(aPosition, 1.0);
  clip.z -= uDepthBias * clip.w;
  gl_Position = clip;
}`;

const LINE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec3 vColor;
uniform vec4 uColor;
uniform float uUseVertexColor;
out vec4 outColor;
void main() {
  vec3 rgb = mix(uColor.rgb, vColor, uUseVertexColor);
  outColor = vec4(rgb * uColor.a, uColor.a);
}`;

const ATTRIBUTE_POSITION = 0;
const ATTRIBUTE_NORMAL = 1;
const ATTRIBUTE_COLOR = 2;

// ============================================================================
// GPU Resource Management
// ============================================================================

const MESH_UNIFORM_NAMES = [
  "uViewProjection",
  "uEyePosition",
  "uKeyLightDirection",
  "uBaseColor",
  "uUseVertexColor",
  "uOpacity",
] as const;
const LINE_UNIFORM_NAMES = ["uViewProjection", "uDepthBias", "uColor", "uUseVertexColor"] as const;

type UniformMap<K extends string> = Readonly<Record<K, WebGLUniformLocation | null>>;

interface GpuResources {
  readonly meshProgram: WebGLProgram;
  readonly meshUniforms: UniformMap<(typeof MESH_UNIFORM_NAMES)[number]>;
  readonly lineProgram: WebGLProgram;
  readonly lineUniforms: UniformMap<(typeof LINE_UNIFORM_NAMES)[number]>;
  readonly meshVao: WebGLVertexArrayObject;
  readonly edgeVao: WebGLVertexArrayObject;
  readonly cageVao: WebGLVertexArrayObject;
  readonly meshPositionBuffer: WebGLBuffer;
  readonly meshNormalBuffer: WebGLBuffer;
  readonly meshColorBuffer: WebGLBuffer;
  readonly meshIndexBuffer: WebGLBuffer;
  readonly edgeIndexBuffer: WebGLBuffer;
  readonly cagePositionBuffer: WebGLBuffer;
  readonly cageColorBuffer: WebGLBuffer;
  readonly cageIndexBuffer: WebGLBuffer;
  /** Allocated byte size per buffer (enables `bufferSubData` reuse without reallocation). */
  readonly allocatedBytes: Map<WebGLBuffer, number>;
}

function compileShader(
  gl: WebGL2RenderingContext,
  stage: "VERTEX" | "FRAGMENT",
  source: string,
  label: string,
): WebGLShader {
  const shader = gl.createShader(stage === "VERTEX" ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER);
  if (!shader) {
    throw new Beam3DViewportError(
      "GPU_RESOURCE_ALLOCATION_FAILED",
      `gl.createShader returned null (${label}/${stage}).`,
      { label, stage },
    );
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    const log = gl.getShaderInfoLog(shader) ?? "(empty info log)";
    gl.deleteShader(shader);
    throw new Beam3DViewportError(
      "SHADER_COMPILE_FAILED",
      `${label} ${stage} shader failed to compile: ${log}`,
      { label, stage, log },
    );
  }
  return shader;
}

function linkProgram(
  gl: WebGL2RenderingContext,
  label: string,
  vertexSource: string,
  fragmentSource: string,
): WebGLProgram {
  const vertexShader = compileShader(gl, "VERTEX", vertexSource, label);
  let fragmentShader: WebGLShader;
  try {
    fragmentShader = compileShader(gl, "FRAGMENT", fragmentSource, label);
  } catch (error) {
    gl.deleteShader(vertexShader);
    throw error;
  }
  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    throw new Beam3DViewportError(
      "GPU_RESOURCE_ALLOCATION_FAILED",
      `gl.createProgram returned null (${label}).`,
      { label },
    );
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.detachShader(program, vertexShader);
  gl.detachShader(program, fragmentShader);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost()) {
    const log = gl.getProgramInfoLog(program) ?? "(empty info log)";
    gl.deleteProgram(program);
    throw new Beam3DViewportError(
      "PROGRAM_LINK_FAILED",
      `${label} program failed to link: ${log}`,
      { label, log },
    );
  }
  return program;
}

function getUniforms<K extends string>(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  names: readonly K[],
): UniformMap<K> {
  const uniforms = {} as Record<K, WebGLUniformLocation | null>;
  for (const name of names) uniforms[name] = gl.getUniformLocation(program, name);
  return uniforms;
}

function bindVec3Attribute(
  gl: WebGL2RenderingContext,
  location: number,
  buffer: WebGLBuffer,
): void {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, 3, gl.FLOAT, false, 0, 0);
}

/**
 * Compiles shaders and allocates every buffer/VAO used by the viewport.
 * @param gl WebGL2 context.
 * @returns GPU resource bundle.
 * @throws {Beam3DViewportError} On shader compile/link or allocation failure (partial resources are released).
 */
function createGpuResources(gl: WebGL2RenderingContext): GpuResources {
  const releasers: Array<() => void> = [];
  const requireBuffer = (label: string): WebGLBuffer => {
    const buffer = gl.createBuffer();
    if (!buffer) {
      throw new Beam3DViewportError(
        "GPU_RESOURCE_ALLOCATION_FAILED",
        `gl.createBuffer returned null (${label}).`,
        { label },
      );
    }
    releasers.push(() => gl.deleteBuffer(buffer));
    return buffer;
  };
  const requireVao = (label: string): WebGLVertexArrayObject => {
    const vao = gl.createVertexArray();
    if (!vao) {
      throw new Beam3DViewportError(
        "GPU_RESOURCE_ALLOCATION_FAILED",
        `gl.createVertexArray returned null (${label}).`,
        { label },
      );
    }
    releasers.push(() => gl.deleteVertexArray(vao));
    return vao;
  };

  try {
    const meshProgram = linkProgram(gl, "BeamMesh", MESH_VERTEX_SHADER, MESH_FRAGMENT_SHADER);
    releasers.push(() => gl.deleteProgram(meshProgram));
    const lineProgram = linkProgram(gl, "BeamLines", LINE_VERTEX_SHADER, LINE_FRAGMENT_SHADER);
    releasers.push(() => gl.deleteProgram(lineProgram));

    const meshPositionBuffer = requireBuffer("meshPosition");
    const meshNormalBuffer = requireBuffer("meshNormal");
    const meshColorBuffer = requireBuffer("meshColor");
    const meshIndexBuffer = requireBuffer("meshIndex");
    const edgeIndexBuffer = requireBuffer("edgeIndex");
    const cagePositionBuffer = requireBuffer("cagePosition");
    const cageColorBuffer = requireBuffer("cageColor");
    const cageIndexBuffer = requireBuffer("cageIndex");

    const meshVao = requireVao("mesh");
    gl.bindVertexArray(meshVao);
    bindVec3Attribute(gl, ATTRIBUTE_POSITION, meshPositionBuffer);
    bindVec3Attribute(gl, ATTRIBUTE_NORMAL, meshNormalBuffer);
    bindVec3Attribute(gl, ATTRIBUTE_COLOR, meshColorBuffer);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, meshIndexBuffer);

    const edgeVao = requireVao("edge");
    gl.bindVertexArray(edgeVao);
    bindVec3Attribute(gl, ATTRIBUTE_POSITION, meshPositionBuffer);
    gl.disableVertexAttribArray(ATTRIBUTE_COLOR);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, edgeIndexBuffer);

    const cageVao = requireVao("cage");
    gl.bindVertexArray(cageVao);
    bindVec3Attribute(gl, ATTRIBUTE_POSITION, cagePositionBuffer);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cageIndexBuffer);

    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    return {
      meshProgram,
      meshUniforms: getUniforms(gl, meshProgram, MESH_UNIFORM_NAMES),
      lineProgram,
      lineUniforms: getUniforms(gl, lineProgram, LINE_UNIFORM_NAMES),
      meshVao,
      edgeVao,
      cageVao,
      meshPositionBuffer,
      meshNormalBuffer,
      meshColorBuffer,
      meshIndexBuffer,
      edgeIndexBuffer,
      cagePositionBuffer,
      cageColorBuffer,
      cageIndexBuffer,
      allocatedBytes: new Map(),
    };
  } catch (error) {
    gl.bindVertexArray(null);
    for (const release of releasers.reverse()) release();
    throw error;
  }
}

function disposeGpuResources(gl: WebGL2RenderingContext, resources: GpuResources): void {
  gl.bindVertexArray(null);
  gl.deleteVertexArray(resources.meshVao);
  gl.deleteVertexArray(resources.edgeVao);
  gl.deleteVertexArray(resources.cageVao);
  for (const buffer of [
    resources.meshPositionBuffer,
    resources.meshNormalBuffer,
    resources.meshColorBuffer,
    resources.meshIndexBuffer,
    resources.edgeIndexBuffer,
    resources.cagePositionBuffer,
    resources.cageColorBuffer,
    resources.cageIndexBuffer,
  ]) {
    gl.deleteBuffer(buffer);
  }
  gl.deleteProgram(resources.meshProgram);
  gl.deleteProgram(resources.lineProgram);
  resources.allocatedBytes.clear();
}

/** Uploads a typed array, reusing the existing GPU allocation when the byte size is unchanged. */
function uploadTypedArray(
  gl: WebGL2RenderingContext,
  resources: GpuResources,
  target: GLenum,
  buffer: WebGLBuffer,
  data: Float32Array | Uint32Array,
): void {
  gl.bindBuffer(target, buffer);
  if (resources.allocatedBytes.get(buffer) === data.byteLength) {
    gl.bufferSubData(target, 0, data);
  } else {
    gl.bufferData(target, data, gl.DYNAMIC_DRAW);
    resources.allocatedBytes.set(buffer, data.byteLength);
  }
}

// ============================================================================
// Scene Synchronization
// ============================================================================

interface SceneDrawState {
  meshIndexCount: number;
  edgeIndexCount: number;
  cageIndexCount: number;
  cageEndAOffsetBytes: number;
  cageEndACount: number;
  cageEndBOffsetBytes: number;
  cageEndBCount: number;
  cageHasVertexColors: boolean;
  topologyKey: string;
  bounds: SceneBounds | null;
  endAnchors: { readonly a: Vec3Tuple; readonly b: Vec3Tuple } | null;
}

function createEmptyScene(): SceneDrawState {
  return {
    meshIndexCount: 0,
    edgeIndexCount: 0,
    cageIndexCount: 0,
    cageEndAOffsetBytes: 0,
    cageEndACount: 0,
    cageEndBOffsetBytes: 0,
    cageEndBCount: 0,
    cageHasVertexColors: false,
    topologyKey: "",
    bounds: null,
    endAnchors: null,
  };
}

interface RendererRuntime {
  readonly gl: WebGL2RenderingContext;
  readonly canvas: HTMLCanvasElement;
  resources: GpuResources | null;
  scene: SceneDrawState;
  camera: OrbitCameraState;
  basis: OrbitCameraBasis;
  basisKey: string;
  frameHandle: number;
  disposed: boolean;
  contextLost: boolean;
  needsFit: boolean;
  readonly matrices: CameraMatrices;
  readonly lastSnapshotMatrix: Float32Array;
  lastSnapshotWidth: number;
  lastSnapshotHeight: number;
  lastSnapshotPreset: CameraPreset | null;
  lastRenderErrorMessage: string;
  requestRender: () => void;
}

const FALLBACK_BASIS = computeOrbitCameraBasis([0, 0, 1], [1, 0, 0]);

function computeBasisKey(props: Beam3DExtrudedViewportProps): string {
  const up = props.customUpVector;
  const span = props.spanAxis;
  return `${props.coordinateMode ?? "Z-Up"}|${up?.x},${up?.y},${up?.z}|${span?.x},${span?.y},${span?.z}`;
}

/** Resolves the orbit basis, falling back to `Z-Up` on invalid configuration. */
function resolveBasisSafely(props: Beam3DExtrudedViewportProps): {
  readonly basis: OrbitCameraBasis;
  readonly key: string;
  readonly error: Beam3DViewportError | null;
} {
  const key = computeBasisKey(props);
  try {
    const up = resolveUpVector(props.coordinateMode ?? "Z-Up", props.customUpVector);
    const span = props.spanAxis ? toTuple(props.spanAxis) : ([1, 0, 0] as const);
    return { basis: computeOrbitCameraBasis(up, span), key, error: null };
  } catch (error) {
    return {
      basis: FALLBACK_BASIS,
      key,
      error: normalizeViewportError(error, "INVALID_CAMERA_CONFIGURATION", { key }),
    };
  }
}

/**
 * Validates and uploads mesh, feature edge, and rebar cage buffers for the current props.
 * @param rt Renderer runtime.
 * @param props Current component props.
 * @throws {Beam3DViewportError} `INVALID_MESH_BUFFERS` / `INVALID_REBAR_CAGE_BUFFERS` before any upload.
 */
function syncSceneBuffers(rt: RendererRuntime, props: Beam3DExtrudedViewportProps): void {
  const { gl, resources, scene } = rt;
  if (!resources || rt.contextLost) return;

  const mesh = props.mesh;
  if (!mesh) {
    scene.meshIndexCount = 0;
    scene.edgeIndexCount = 0;
    scene.cageIndexCount = 0;
    scene.cageEndACount = 0;
    scene.cageEndBCount = 0;
    scene.bounds = null;
    scene.endAnchors = null;
    return;
  }

  const { vertexCount } = validateBeamMeshBuffers(mesh);
  const cage = props.materialKind === "CONCRETE" ? (props.rebarCage ?? null) : null;
  if (cage) validateRebarCageBuffers(cage);

  gl.bindVertexArray(null);
  uploadTypedArray(gl, resources, gl.ARRAY_BUFFER, resources.meshPositionBuffer, mesh.positionsF32);
  uploadTypedArray(gl, resources, gl.ARRAY_BUFFER, resources.meshNormalBuffer, mesh.normalsF32);
  uploadTypedArray(gl, resources, gl.ARRAY_BUFFER, resources.meshColorBuffer, mesh.colorsF32);
  uploadTypedArray(
    gl,
    resources,
    gl.ELEMENT_ARRAY_BUFFER,
    resources.meshIndexBuffer,
    mesh.indicesU32,
  );
  scene.meshIndexCount = mesh.indicesU32.length;

  // Topology (profile shape & station count) is stable while sliders move; edges only change with it.
  const topologyKey = computeTopologyKey(mesh.indicesU32, vertexCount);
  if (topologyKey !== scene.topologyKey) {
    const edges = extractFeatureEdges(mesh.positionsF32, mesh.indicesU32);
    uploadTypedArray(gl, resources, gl.ELEMENT_ARRAY_BUFFER, resources.edgeIndexBuffer, edges);
    scene.edgeIndexCount = edges.length;
    if (scene.topologyKey !== "") rt.needsFit = true;
    scene.topologyKey = topologyKey;
  }

  const bounds = computeSceneBounds(mesh.positionsF32);
  scene.bounds = bounds;
  const { minS, maxS } = computeSpanExtent(mesh.positionsF32, rt.basis.span);
  const centerS = dot3(bounds.center, rt.basis.span);
  scene.endAnchors = {
    a: add3(bounds.center, scale3(rt.basis.span, minS - centerS)),
    b: add3(bounds.center, scale3(rt.basis.span, maxS - centerS)),
  };

  if (!cage || cage.indicesU32.length === 0) {
    scene.cageIndexCount = 0;
    scene.cageEndACount = 0;
    scene.cageEndBCount = 0;
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return;
  }

  uploadTypedArray(gl, resources, gl.ARRAY_BUFFER, resources.cagePositionBuffer, cage.positionsF32);
  scene.cageHasVertexColors = Boolean(cage.colorsF32);
  if (cage.colorsF32) {
    uploadTypedArray(gl, resources, gl.ARRAY_BUFFER, resources.cageColorBuffer, cage.colorsF32);
  }
  gl.bindVertexArray(resources.cageVao);
  if (cage.colorsF32) {
    bindVec3Attribute(gl, ATTRIBUTE_COLOR, resources.cageColorBuffer);
  } else {
    gl.disableVertexAttribArray(ATTRIBUTE_COLOR);
  }
  gl.bindVertexArray(null);

  const { endA, endB } = partitionEndSectionSegments(
    cage.positionsF32,
    cage.indicesU32,
    rt.basis.span,
    minS,
    maxS,
    props.endSectionDepthMm ?? DEFAULT_END_SECTION_DEPTH_MM,
  );
  // Layout: [full cage | end A | end B] in one element buffer, drawn with byte offsets.
  const combined = new Uint32Array(cage.indicesU32.length + endA.length + endB.length);
  combined.set(cage.indicesU32, 0);
  combined.set(endA, cage.indicesU32.length);
  combined.set(endB, cage.indicesU32.length + endA.length);
  uploadTypedArray(gl, resources, gl.ELEMENT_ARRAY_BUFFER, resources.cageIndexBuffer, combined);
  scene.cageIndexCount = cage.indicesU32.length;
  scene.cageEndAOffsetBytes = cage.indicesU32.length * Uint32Array.BYTES_PER_ELEMENT;
  scene.cageEndACount = endA.length;
  scene.cageEndBOffsetBytes =
    (cage.indicesU32.length + endA.length) * Uint32Array.BYTES_PER_ELEMENT;
  scene.cageEndBCount = endB.length;
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
}

function fitCameraToBounds(camera: OrbitCameraState, bounds: SceneBounds, aspect: number): void {
  const halfFov = CAMERA_FIELD_OF_VIEW_RAD / 2;
  camera.target = bounds.center;
  // Bounding-sphere fit; narrow viewports scale by aspect to keep the full span visible.
  camera.distance =
    (bounds.radius / (Math.sin(halfFov) * Math.min(1, Math.max(aspect, 1e-3)))) * FIT_MARGIN;
}

// ============================================================================
// Frame Rendering
// ============================================================================

interface MeshPassOptions {
  readonly baseColor: Vec3Tuple;
  readonly useVertexColor: boolean;
  readonly opacity: number;
}

function drawMeshPass(
  gl: WebGL2RenderingContext,
  resources: GpuResources,
  indexCount: number,
  viewProjection: Float32Array,
  eye: Vec3Tuple,
  keyLight: Vec3Tuple,
  options: MeshPassOptions,
): void {
  const u = resources.meshUniforms;
  gl.useProgram(resources.meshProgram);
  gl.uniformMatrix4fv(u.uViewProjection, false, viewProjection);
  gl.uniform3f(u.uEyePosition, eye[0], eye[1], eye[2]);
  gl.uniform3f(u.uKeyLightDirection, keyLight[0], keyLight[1], keyLight[2]);
  gl.uniform3f(u.uBaseColor, options.baseColor[0], options.baseColor[1], options.baseColor[2]);
  gl.uniform1f(u.uUseVertexColor, options.useVertexColor ? 1 : 0);
  gl.uniform1f(u.uOpacity, options.opacity);
  gl.bindVertexArray(resources.meshVao);
  gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_INT, 0);
}

function drawLinePass(
  gl: WebGL2RenderingContext,
  resources: GpuResources,
  vao: WebGLVertexArrayObject,
  indexCount: number,
  offsetBytes: number,
  viewProjection: Float32Array,
  color: Vec3Tuple,
  alpha: number,
  useVertexColor: boolean,
  depthBias: number,
): void {
  if (indexCount <= 0) return;
  const u = resources.lineUniforms;
  gl.useProgram(resources.lineProgram);
  gl.uniformMatrix4fv(u.uViewProjection, false, viewProjection);
  gl.uniform1f(u.uDepthBias, depthBias);
  gl.uniform4f(u.uColor, color[0], color[1], color[2], alpha);
  gl.uniform1f(u.uUseVertexColor, useVertexColor ? 1 : 0);
  gl.vertexAttrib3f(ATTRIBUTE_COLOR, color[0], color[1], color[2]);
  gl.bindVertexArray(vao);
  gl.drawElements(gl.LINES, indexCount, gl.UNSIGNED_INT, offsetBytes);
}

function isEndCapFacing(
  anchor: Vec3Tuple,
  outwardNormal: Vec3Tuple,
  eye: Vec3Tuple,
  viewDirection: Vec3Tuple,
  orthographic: boolean,
): boolean {
  const toCamera = orthographic ? viewDirection : (normalize3(sub3(eye, anchor)) ?? viewDirection);
  return dot3(toCamera, outwardNormal) > END_CAP_FACING_THRESHOLD;
}

function positionEndOverlay(
  element: HTMLDivElement | null,
  visible: boolean,
  screen: ScreenProjection | null,
): void {
  if (!element) return;
  if (!visible || !screen || !screen.insideFrustum) {
    element.style.display = "none";
    return;
  }
  element.style.display = "block";
  element.style.transform = `translate(${screen.x.toFixed(1)}px, ${screen.y.toFixed(1)}px) translate(-50%, -50%)`;
}

/**
 * Renders one frame: resizes the drawing buffer, updates camera matrices, draws all passes,
 * repositions end-section overlays, and emits projection snapshots.
 */
function renderFrame(
  rt: RendererRuntime,
  props: Beam3DExtrudedViewportProps,
  endAElement: HTMLDivElement | null,
  endBElement: HTMLDivElement | null,
): void {
  const { gl, canvas, resources, scene, camera, basis } = rt;
  if (!resources || rt.contextLost) return;

  const widthCss = canvas.clientWidth;
  const heightCss = canvas.clientHeight;
  if (widthCss <= 0 || heightCss <= 0) return;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
  const widthPx = Math.max(1, Math.round(widthCss * pixelRatio));
  const heightPx = Math.max(1, Math.round(heightCss * pixelRatio));
  if (canvas.width !== widthPx) canvas.width = widthPx;
  if (canvas.height !== heightPx) canvas.height = heightPx;
  const aspect = widthCss / heightCss;

  if (rt.needsFit && scene.bounds) {
    fitCameraToBounds(camera, scene.bounds, aspect);
    rt.needsFit = false;
  }

  const sceneRadius = scene.bounds?.radius ?? DEFAULT_SCENE_RADIUS_MM;
  const { eye, halfHeight } = buildCameraMatrices(camera, basis, aspect, sceneRadius, rt.matrices);
  const viewProjection = rt.matrices.viewProjection;
  const viewDirection = normalize3(sub3(eye, camera.target)) ?? basis.front;

  gl.viewport(0, 0, widthPx, heightPx);
  gl.clearColor(0, 0, 0, 0);
  gl.clearDepth(1);
  gl.depthMask(true);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  const isConcrete = props.materialKind === "CONCRETE";
  const concreteMode = props.concreteViewMode ?? "SOLID_WITH_END_SECTION";
  const isWireframe = isConcrete && concreteMode === "WIREFRAME_REBAR_CAGE";
  const isConcreteSolid = isConcrete && concreteMode === "SOLID_WITH_END_SECTION";
  const anchors = scene.endAnchors;
  const endAFacing =
    anchors !== null &&
    isEndCapFacing(anchors.a, scale3(basis.span, -1), eye, viewDirection, camera.orthographic);
  const endBFacing =
    anchors !== null &&
    isEndCapFacing(anchors.b, basis.span, eye, viewDirection, camera.orthographic);

  if (scene.meshIndexCount > 0) {
    const right = normalize3(cross3(scale3(viewDirection, -1), basis.up)) ?? basis.span;
    const keyLight =
      normalize3(
        add3(add3(scale3(viewDirection, 0.55), scale3(basis.up, 0.75)), scale3(right, 0.35)),
      ) ?? basis.up;

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.frontFace(gl.CCW);

    if (isWireframe) {
      gl.disable(gl.BLEND);
      gl.depthMask(true);
      drawLinePass(
        gl,
        resources,
        resources.cageVao,
        scene.cageIndexCount,
        0,
        viewProjection,
        RGB.rebar,
        1,
        scene.cageHasVertexColors,
        0,
      );
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      drawMeshPass(gl, resources, scene.meshIndexCount, viewProjection, eye, keyLight, {
        baseColor: RGB.wireEnvelope,
        useVertexColor: false,
        opacity: WIREFRAME_ENVELOPE_OPACITY,
      });
      gl.disable(gl.CULL_FACE);
      drawLinePass(
        gl,
        resources,
        resources.edgeVao,
        scene.edgeIndexCount,
        0,
        viewProjection,
        RGB.wireEnvelope,
        0.9,
        false,
        EDGE_DEPTH_BIAS,
      );
    } else {
      gl.disable(gl.BLEND);
      gl.depthMask(true);
      drawMeshPass(gl, resources, scene.meshIndexCount, viewProjection, eye, keyLight, {
        baseColor: isConcrete ? RGB.concreteBase : RGB.steelBase,
        useVertexColor: props.useContourColors ?? true,
        opacity: 1,
      });
      gl.disable(gl.CULL_FACE);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      drawLinePass(
        gl,
        resources,
        resources.edgeVao,
        scene.edgeIndexCount,
        0,
        viewProjection,
        RGB.featureEdge,
        0.55,
        false,
        EDGE_DEPTH_BIAS,
      );
      if (isConcreteSolid) {
        // End cross-section drawing is overlaid on the cap facing the camera (section-view style).
        gl.disable(gl.DEPTH_TEST);
        if (endAFacing) {
          drawLinePass(
            gl,
            resources,
            resources.cageVao,
            scene.cageEndACount,
            scene.cageEndAOffsetBytes,
            viewProjection,
            RGB.rebar,
            1,
            scene.cageHasVertexColors,
            0,
          );
        }
        if (endBFacing) {
          drawLinePass(
            gl,
            resources,
            resources.cageVao,
            scene.cageEndBCount,
            scene.cageEndBOffsetBytes,
            viewProjection,
            RGB.rebar,
            1,
            scene.cageHasVertexColors,
            0,
          );
        }
      }
    }
    gl.bindVertexArray(null);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  const endAScreen = anchors
    ? projectWorldToScreen(viewProjection, anchors.a, widthCss, heightCss)
    : null;
  const endBScreen = anchors
    ? projectWorldToScreen(viewProjection, anchors.b, widthCss, heightCss)
    : null;
  positionEndOverlay(endAElement, isConcreteSolid && endAFacing, endAScreen);
  positionEndOverlay(endBElement, isConcreteSolid && endBFacing, endBScreen);

  emitProjectionSnapshot(rt, props, widthCss, heightCss, halfHeight, endAScreen, endBScreen);
}

function emitProjectionSnapshot(
  rt: RendererRuntime,
  props: Beam3DExtrudedViewportProps,
  widthCss: number,
  heightCss: number,
  halfHeight: number,
  endAScreen: ScreenProjection | null,
  endBScreen: ScreenProjection | null,
): void {
  const callback = props.onProjectionChange;
  if (!callback) return;
  const viewProjection = rt.matrices.viewProjection;
  let changed =
    widthCss !== rt.lastSnapshotWidth ||
    heightCss !== rt.lastSnapshotHeight ||
    rt.lastSnapshotPreset !== rt.camera.preset;
  for (let i = 0; !changed && i < 16; i++) {
    if (viewProjection[i] !== rt.lastSnapshotMatrix[i]) changed = true;
  }
  if (!changed) return;
  rt.lastSnapshotMatrix.set(viewProjection);
  rt.lastSnapshotWidth = widthCss;
  rt.lastSnapshotHeight = heightCss;
  rt.lastSnapshotPreset = rt.camera.preset;
  try {
    callback({
      viewProjection: new Float32Array(viewProjection),
      widthCss,
      heightCss,
      isOrthographic: rt.camera.orthographic,
      worldUnitsPerPixel: (2 * halfHeight) / heightCss,
      cameraPreset: rt.camera.preset,
      endAScreen,
      endBScreen,
    });
  } catch (callbackError) {
    console.error("[Beam3DExtrudedViewport] onProjectionChange callback threw:", callbackError);
  }
}

// ============================================================================
// UI Styles (Erzysh Dark Void Theme tokens)
// ============================================================================

const SURFACE_STYLE: CSSProperties = {
  background: "rgba(15, 20, 22, 0.86)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  border: "1px solid rgba(148, 163, 184, 0.14)",
  borderRadius: 10,
  color: "#CBD5E1",
  fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
  fontSize: 12,
};

const TOOLBAR_STYLE: CSSProperties = {
  ...SURFACE_STYLE,
  position: "absolute",
  top: 12,
  left: "50%",
  transform: "translateX(-50%)",
  display: "flex",
  gap: 4,
  padding: 4,
  alignItems: "center",
  userSelect: "none",
  zIndex: 2,
};

const END_OVERLAY_STYLE: CSSProperties = {
  position: "absolute",
  left: 0,
  top: 0,
  display: "none",
  pointerEvents: "none",
  willChange: "transform",
  zIndex: 1,
};

const EMPTY_STATE_STYLE: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#64748B",
  fontFamily: SURFACE_STYLE.fontFamily,
  fontSize: 13,
  letterSpacing: 0.3,
  pointerEvents: "none",
};

const ERROR_CARD_STYLE: CSSProperties = {
  ...SURFACE_STYLE,
  position: "absolute",
  top: 56,
  left: "50%",
  transform: "translateX(-50%)",
  maxWidth: 460,
  padding: "12px 14px",
  border: "1px solid rgba(239, 68, 68, 0.45)",
  zIndex: 3,
};

/** Stops pointer events so toolbar/overlay clicks never orbit the camera or drag loads behind. */
function stopPointerPropagation(event: ReactPointerEvent<HTMLElement>): void {
  event.stopPropagation();
}

// ============================================================================
// Internal UI Sub-Components
// ============================================================================

/**
 * Compact toolbar button.
 * @param props.label Visible label.
 * @param props.title Tooltip text.
 * @param props.active Highlights with the accent gradient.
 * @param props.disabled Disables interaction.
 * @param props.onClick Click handler.
 */
function ToolbarButton(props: {
  readonly label: string;
  readonly title: string;
  readonly active?: boolean;
  readonly disabled?: boolean;
  readonly onClick: () => void;
}): ReactElement {
  const { label, title, active = false, disabled = false, onClick } = props;
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      style={{
        border: "none",
        borderRadius: 7,
        padding: "5px 10px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        color: active ? "#F8FAFC" : "#CBD5E1",
        fontSize: 12,
        fontWeight: active ? 600 : 500,
        background: active
          ? "linear-gradient(90deg, #06B6D4 0%, #3B82F6 50%, #8B5CF6 100%)"
          : "transparent",
      }}
    >
      {label}
    </button>
  );
}

/**
 * Camera & concrete sub-mode toolbar.
 * @param props.activePreset Highlighted camera preset.
 * @param props.onPreset Applies a camera preset.
 * @param props.onFit Re-frames the beam.
 * @param props.materialKind Shows the concrete toggle for `"CONCRETE"`.
 * @param props.concreteViewMode Active concrete sub-mode.
 * @param props.onConcreteViewModeChange Concrete sub-mode change handler (toggle hidden if absent).
 */
function ViewportToolbar(props: {
  readonly activePreset: CameraPreset;
  readonly onPreset: (preset: CameraPreset) => void;
  readonly onFit: () => void;
  readonly materialKind: BeamMaterialKind;
  readonly concreteViewMode: ConcreteViewMode;
  readonly onConcreteViewModeChange?: (mode: ConcreteViewMode) => void;
}): ReactElement {
  const {
    activePreset,
    onPreset,
    onFit,
    materialKind,
    concreteViewMode,
    onConcreteViewModeChange,
  } = props;
  return (
    <div
      role="toolbar"
      aria-label="Kontrol kamera balok 3D"
      style={TOOLBAR_STYLE}
      onPointerDown={stopPointerPropagation}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <ToolbarButton
        label="3D Isometrik"
        title="Kamera perspektif isometrik (tombol 3)"
        active={activePreset === "ISOMETRIC_3D"}
        onClick={() => onPreset("ISOMETRIC_3D")}
      />
      <ToolbarButton
        label="Tampak Depan 2D"
        title="Proyeksi ortografis tampak depan, sejajar overlay 2D (tombol 1)"
        active={activePreset === "FRONT_2D"}
        onClick={() => onPreset("FRONT_2D")}
      />
      <ToolbarButton
        label="Fit"
        title="Pusatkan balok ke layar (tombol F / klik ganda)"
        onClick={onFit}
      />
      {materialKind === "CONCRETE" && onConcreteViewModeChange ? (
        <>
          <span
            aria-hidden
            style={{
              width: 1,
              height: 18,
              background: "rgba(148, 163, 184, 0.2)",
              margin: "0 4px",
            }}
          />
          <ToolbarButton
            label="Solid + Potongan"
            title="Beton solid dengan gambar potongan ujung"
            active={concreteViewMode === "SOLID_WITH_END_SECTION"}
            onClick={() => onConcreteViewModeChange("SOLID_WITH_END_SECTION")}
          />
          <ToolbarButton
            label="Wireframe Tulangan"
            title="Selubung transparan dengan tulangan pokok & cincin sengkang"
            active={concreteViewMode === "WIREFRAME_REBAR_CAGE"}
            onClick={() => onConcreteViewModeChange("WIREFRAME_REBAR_CAGE")}
          />
        </>
      ) : null}
    </div>
  );
}

/**
 * Error card showing the error code, message, and Indonesian remediation hint.
 * @param props.error Structured viewport error.
 * @param props.onDismiss Dismiss handler.
 */
function ViewportErrorCard(props: {
  readonly error: Beam3DViewportError;
  readonly onDismiss: () => void;
}): ReactElement {
  const { error, onDismiss } = props;
  return (
    <div role="alert" style={ERROR_CARD_STYLE} onPointerDown={stopPointerPropagation}>
      <div
        style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}
      >
        <strong style={{ color: "#FCA5A5", fontSize: 12, letterSpacing: 0.4 }}>{error.code}</strong>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Tutup pesan error"
          style={{
            border: "none",
            background: "transparent",
            color: "#94A3B8",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          ✕
        </button>
      </div>
      <p style={{ margin: "6px 0 4px", color: "#E2E8F0", lineHeight: 1.45 }}>
        {ERROR_HINTS[error.code]}
      </p>
      <code style={{ display: "block", color: "#64748B", fontSize: 11, wordBreak: "break-word" }}>
        {error.message}
      </code>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Interactive WebGL2 3D extruded beam viewport (client-only; load via `next/dynamic` `{ ssr: false }`).
 *
 * Interaction: left-drag orbit, right/middle/Shift-drag pan, wheel or pinch zoom, double-click fit,
 * keyboard `F` fit, `1` front 2D, `3` isometric, arrows orbit, `+`/`-` zoom.
 *
 * @param props See {@link Beam3DExtrudedViewportProps}.
 * @returns Root container with the canvas, toolbar, end-section overlays, and error card.
 * @example
 * ```tsx
 * <Beam3DExtrudedViewport
 *   mesh={meshViews}
 *   meshRevision={revision}
 *   rebarCage={cageViews}
 *   materialKind="CONCRETE"
 *   concreteViewMode={mode}
 *   onConcreteViewModeChange={setMode}
 *   coordinateMode="Z-Up"
 *   onProjectionChange={setProjection}
 *   renderEndSection={() => <ConcreteCrossSectionSvg design={design} />}
 * />
 * ```
 */
export function Beam3DExtrudedViewport(props: Beam3DExtrudedViewportProps): ReactElement {
  const {
    mesh,
    meshRevision = 0,
    rebarCage = null,
    materialKind,
    concreteViewMode = "SOLID_WITH_END_SECTION",
    onConcreteViewModeChange,
    coordinateMode = "Z-Up",
    customUpVector,
    spanAxis,
    cameraPreset,
    useContourColors = true,
    endSectionDepthMm = DEFAULT_END_SECTION_DEPTH_MM,
    renderEndSection,
    showToolbar = true,
    className,
    style,
    ariaLabel,
  } = props;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const endARef = useRef<HTMLDivElement>(null);
  const endBRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<RendererRuntime | null>(null);
  const propsRef = useRef<Beam3DExtrudedViewportProps>(props);
  propsRef.current = props;

  const [viewportError, setViewportError] = useState<Beam3DViewportError | null>(null);
  const [activePreset, setActivePreset] = useState<CameraPreset>(cameraPreset ?? "ISOMETRIC_3D");

  const reportError = useCallback(
    (
      error: unknown,
      fallbackCode: Beam3DViewportErrorCode,
      details: Readonly<Record<string, unknown>> = {},
    ): void => {
      const normalized = normalizeViewportError(error, fallbackCode, details);
      console.error(normalized, normalized.details);
      setViewportError(normalized);
      try {
        propsRef.current.onError?.(normalized);
      } catch (callbackError) {
        console.error("[Beam3DExtrudedViewport] onError callback threw:", callbackError);
      }
    },
    [],
  );

  const clearDataError = useCallback((): void => {
    setViewportError((previous) =>
      previous && DATA_ERROR_CODES.has(previous.code) ? null : previous,
    );
  }, []);

  const commitPreset = useCallback((preset: CameraPreset, notify: boolean): void => {
    setActivePreset(preset);
    if (!notify) return;
    try {
      propsRef.current.onCameraPresetChange?.(preset);
    } catch (callbackError) {
      console.error("[Beam3DExtrudedViewport] onCameraPresetChange callback threw:", callbackError);
    }
  }, []);

  const applyPreset = useCallback(
    (preset: CameraPreset, notify: boolean): void => {
      const rt = rendererRef.current;
      if (rt) {
        applyPresetToCamera(rt.camera, preset);
        rt.requestRender();
      }
      commitPreset(preset, notify);
    },
    [commitPreset],
  );

  const fitToScene = useCallback((): void => {
    const rt = rendererRef.current;
    if (!rt) return;
    rt.needsFit = true;
    rt.requestRender();
  }, []);

  // WebGL2 lifecycle, input listeners, resize observer, and context loss recovery.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let context: WebGL2RenderingContext | null = null;
    try {
      context = canvas.getContext("webgl2", {
        alpha: true,
        antialias: true,
        premultipliedAlpha: true,
        preserveDrawingBuffer: false,
        powerPreference: "high-performance",
      });
    } catch (error) {
      reportError(error, "WEBGL2_UNAVAILABLE");
      return;
    }
    if (!context) {
      reportError(
        new Beam3DViewportError(
          "WEBGL2_UNAVAILABLE",
          "canvas.getContext('webgl2') returned null.",
          { userAgent: navigator.userAgent },
        ),
        "WEBGL2_UNAVAILABLE",
      );
      return;
    }
    const gl: WebGL2RenderingContext = context;

    const initialProps = propsRef.current;
    const basisResolution = resolveBasisSafely(initialProps);
    if (basisResolution.error) reportError(basisResolution.error, "INVALID_CAMERA_CONFIGURATION");

    const rt: RendererRuntime = {
      gl,
      canvas,
      resources: null,
      scene: createEmptyScene(),
      camera: createInitialCamera(initialProps.cameraPreset ?? "ISOMETRIC_3D"),
      basis: basisResolution.basis,
      basisKey: basisResolution.key,
      frameHandle: 0,
      disposed: false,
      contextLost: false,
      needsFit: true,
      matrices: {
        view: new Float32Array(16),
        projection: new Float32Array(16),
        viewProjection: new Float32Array(16),
      },
      lastSnapshotMatrix: new Float32Array(16),
      lastSnapshotWidth: -1,
      lastSnapshotHeight: -1,
      lastSnapshotPreset: null,
      lastRenderErrorMessage: "",
      requestRender: () => undefined,
    };

    rt.requestRender = () => {
      if (rt.disposed || rt.contextLost || rt.frameHandle !== 0) return;
      rt.frameHandle = requestAnimationFrame(() => {
        rt.frameHandle = 0;
        if (rt.disposed) return;
        try {
          renderFrame(rt, propsRef.current, endARef.current, endBRef.current);
          rt.lastRenderErrorMessage = "";
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (message !== rt.lastRenderErrorMessage) {
            rt.lastRenderErrorMessage = message;
            reportError(error, "RENDER_FRAME_FAILED");
          }
        }
      });
    };

    try {
      rt.resources = createGpuResources(gl);
    } catch (error) {
      reportError(error, "GPU_RESOURCE_ALLOCATION_FAILED");
    }
    rendererRef.current = rt;

    const sceneRadius = (): number => rt.scene.bounds?.radius ?? DEFAULT_SCENE_RADIUS_MM;
    const leaveFixedPresetOnOrbit = (): void => {
      if (rt.camera.preset === "FREE_ORBIT") return;
      applyPresetToCamera(rt.camera, "FREE_ORBIT");
      commitPreset("FREE_ORBIT", true);
    };

    type GestureMode = "NONE" | "ORBIT" | "PAN" | "PINCH";
    const activePointers = new Map<number, { x: number; y: number }>();
    let gesture: GestureMode = "NONE";
    let pinchStartSpacing = 1;
    let pinchStartDistance = rt.camera.distance;
    let pinchLastMidpoint = { x: 0, y: 0 };

    const pinchMetrics = (): { spacing: number; midpoint: { x: number; y: number } } | null => {
      const points = [...activePointers.values()];
      const first = points[0];
      const second = points[1];
      if (!first || !second) return null;
      return {
        spacing: Math.max(Math.hypot(second.x - first.x, second.y - first.y), 1),
        midpoint: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
      };
    };

    const onPointerDown = (event: PointerEvent): void => {
      if (event.pointerType === "mouse" && event.button > 2) return;
      event.preventDefault();
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // Capture can fail for synthetic events; dragging still works without it.
      }
      canvas.focus({ preventScroll: true });
      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (activePointers.size === 1) {
        gesture = event.button === 1 || event.button === 2 || event.shiftKey ? "PAN" : "ORBIT";
        canvas.style.cursor = "grabbing";
      } else if (activePointers.size === 2) {
        const metrics = pinchMetrics();
        if (metrics) {
          gesture = "PINCH";
          pinchStartSpacing = metrics.spacing;
          pinchStartDistance = rt.camera.distance;
          pinchLastMidpoint = metrics.midpoint;
        }
      }
    };

    const onPointerMove = (event: PointerEvent): void => {
      const previous = activePointers.get(event.pointerId);
      if (!previous) return;
      const deltaX = event.clientX - previous.x;
      const deltaY = event.clientY - previous.y;
      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (gesture === "ORBIT") {
        leaveFixedPresetOnOrbit();
        orbitCamera(
          rt.camera,
          deltaX * ORBIT_SENSITIVITY_RAD_PER_PX,
          deltaY * ORBIT_SENSITIVITY_RAD_PER_PX,
        );
      } else if (gesture === "PAN") {
        panCamera(rt.camera, rt.basis, deltaX, deltaY, canvas.clientHeight);
      } else if (gesture === "PINCH") {
        const metrics = pinchMetrics();
        if (!metrics) return;
        const radius = Math.max(sceneRadius(), 1);
        rt.camera.distance = clamp(
          pinchStartDistance * (pinchStartSpacing / metrics.spacing),
          radius * 0.02,
          radius * 60,
        );
        panCamera(
          rt.camera,
          rt.basis,
          metrics.midpoint.x - pinchLastMidpoint.x,
          metrics.midpoint.y - pinchLastMidpoint.y,
          canvas.clientHeight,
        );
        pinchLastMidpoint = metrics.midpoint;
      } else {
        return;
      }
      rt.requestRender();
    };

    const onPointerEnd = (event: PointerEvent): void => {
      activePointers.delete(event.pointerId);
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      // After a pinch, wait until every finger lifts to avoid a sudden orbit jump.
      if (activePointers.size === 0 || gesture === "PINCH") gesture = "NONE";
      if (activePointers.size === 0) canvas.style.cursor = "grab";
    };

    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      const lineScale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1;
      zoomCamera(
        rt.camera,
        Math.exp(event.deltaY * lineScale * WHEEL_ZOOM_SENSITIVITY),
        sceneRadius(),
      );
      rt.requestRender();
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      let handled = true;
      switch (event.key) {
        case "f":
        case "F":
          rt.needsFit = true;
          break;
        case "1":
          applyPresetToCamera(rt.camera, "FRONT_2D");
          commitPreset("FRONT_2D", true);
          break;
        case "3":
          applyPresetToCamera(rt.camera, "ISOMETRIC_3D");
          commitPreset("ISOMETRIC_3D", true);
          break;
        case "ArrowLeft":
          leaveFixedPresetOnOrbit();
          orbitCamera(rt.camera, -KEYBOARD_ORBIT_STEP_RAD, 0);
          break;
        case "ArrowRight":
          leaveFixedPresetOnOrbit();
          orbitCamera(rt.camera, KEYBOARD_ORBIT_STEP_RAD, 0);
          break;
        case "ArrowUp":
          leaveFixedPresetOnOrbit();
          orbitCamera(rt.camera, 0, KEYBOARD_ORBIT_STEP_RAD);
          break;
        case "ArrowDown":
          leaveFixedPresetOnOrbit();
          orbitCamera(rt.camera, 0, -KEYBOARD_ORBIT_STEP_RAD);
          break;
        case "+":
        case "=":
          zoomCamera(rt.camera, 0.88, sceneRadius());
          break;
        case "-":
        case "_":
          zoomCamera(rt.camera, 1 / 0.88, sceneRadius());
          break;
        default:
          handled = false;
      }
      if (!handled) return;
      event.preventDefault();
      rt.requestRender();
    };

    const onDoubleClick = (): void => {
      rt.needsFit = true;
      rt.requestRender();
    };

    const onContextMenu = (event: Event): void => event.preventDefault();

    const onContextLost = (event: Event): void => {
      event.preventDefault();
      rt.contextLost = true;
      rt.resources = null;
      if (rt.frameHandle !== 0) {
        cancelAnimationFrame(rt.frameHandle);
        rt.frameHandle = 0;
      }
      reportError(
        new Beam3DViewportError(
          "WEBGL_CONTEXT_LOST",
          "WebGL2 context lost; waiting for the browser to restore it.",
          {},
          { recoverable: true },
        ),
        "WEBGL_CONTEXT_LOST",
      );
    };

    const onContextRestored = (): void => {
      rt.contextLost = false;
      rt.scene = createEmptyScene();
      try {
        rt.resources = createGpuResources(gl);
        syncSceneBuffers(rt, propsRef.current);
        clearDataError();
      } catch (error) {
        reportError(error, "GPU_RESOURCE_ALLOCATION_FAILED", { phase: "contextRestored" });
      }
      rt.requestRender();
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerEnd);
    canvas.addEventListener("pointercancel", onPointerEnd);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("keydown", onKeyDown);
    canvas.addEventListener("dblclick", onDoubleClick);
    canvas.addEventListener("contextmenu", onContextMenu);
    canvas.addEventListener("webglcontextlost", onContextLost);
    canvas.addEventListener("webglcontextrestored", onContextRestored);

    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => rt.requestRender()) : null;
    if (resizeObserver) resizeObserver.observe(canvas);
    else window.addEventListener("resize", rt.requestRender);

    rt.requestRender();

    return () => {
      rt.disposed = true;
      if (rt.frameHandle !== 0) cancelAnimationFrame(rt.frameHandle);
      rt.frameHandle = 0;
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerEnd);
      canvas.removeEventListener("pointercancel", onPointerEnd);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("keydown", onKeyDown);
      canvas.removeEventListener("dblclick", onDoubleClick);
      canvas.removeEventListener("contextmenu", onContextMenu);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      if (resizeObserver) resizeObserver.disconnect();
      else window.removeEventListener("resize", rt.requestRender);
      // The context is intentionally not force-lost: React Strict Mode remounts reuse the same canvas.
      if (rt.resources && !gl.isContextLost()) disposeGpuResources(gl, rt.resources);
      rt.resources = null;
      if (rendererRef.current === rt) rendererRef.current = null;
    };
  }, [clearDataError, commitPreset, reportError]);

  // Re-upload buffers whenever the solver output, material mode, or axis convention changes.
  useEffect(() => {
    const rt = rendererRef.current;
    if (!rt) return;
    const currentProps = propsRef.current;
    const basisKey = computeBasisKey(currentProps);
    if (basisKey !== rt.basisKey) {
      const resolution = resolveBasisSafely(currentProps);
      if (resolution.error) reportError(resolution.error, "INVALID_CAMERA_CONFIGURATION");
      rt.basis = resolution.basis;
      rt.basisKey = resolution.key;
      rt.needsFit = true;
    }
    try {
      syncSceneBuffers(rt, currentProps);
      clearDataError();
    } catch (error) {
      reportError(error, "INVALID_MESH_BUFFERS", { meshRevision });
    }
    rt.requestRender();
  }, [
    mesh,
    meshRevision,
    rebarCage,
    materialKind,
    concreteViewMode,
    endSectionDepthMm,
    useContourColors,
    coordinateMode,
    customUpVector?.x,
    customUpVector?.y,
    customUpVector?.z,
    spanAxis?.x,
    spanAxis?.y,
    spanAxis?.z,
    clearDataError,
    reportError,
  ]);

  // Controlled preset requests from the parent (no echo through onCameraPresetChange).
  useEffect(() => {
    if (cameraPreset === undefined) return;
    const rt = rendererRef.current;
    if (rt && rt.camera.preset === cameraPreset) return;
    applyPreset(cameraPreset, false);
  }, [cameraPreset, applyPreset]);

  const isConcreteSolid =
    materialKind === "CONCRETE" && concreteViewMode === "SOLID_WITH_END_SECTION";

  return (
    <div
      className={className}
      data-component="Beam3DExtrudedViewport"
      style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", ...style }}
    >
      <canvas
        ref={canvasRef}
        role="img"
        tabIndex={0}
        aria-label={
          ariaLabel ??
          `Viewport 3D balok ${materialKind === "STEEL" ? "baja" : "beton bertulang"} melendut. Seret untuk memutar, roda mouse untuk zoom.`
        }
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          touchAction: "none",
          outline: "none",
          cursor: "grab",
        }}
      />
      {isConcreteSolid && renderEndSection ? (
        <>
          <div ref={endARef} style={END_OVERLAY_STYLE} data-beam-end="A">
            {renderEndSection("A")}
          </div>
          <div ref={endBRef} style={END_OVERLAY_STYLE} data-beam-end="B">
            {renderEndSection("B")}
          </div>
        </>
      ) : null}
      {mesh === null && viewportError === null ? (
        <div style={EMPTY_STATE_STYLE}>Menunggu hasil solver mekanika WASM…</div>
      ) : null}
      {showToolbar ? (
        <ViewportToolbar
          activePreset={activePreset}
          onPreset={(preset) => applyPreset(preset, true)}
          onFit={fitToScene}
          materialKind={materialKind}
          concreteViewMode={concreteViewMode}
          onConcreteViewModeChange={onConcreteViewModeChange}
        />
      ) : null}
      {viewportError ? (
        <ViewportErrorCard error={viewportError} onDismiss={() => setViewportError(null)} />
      ) : null}
    </div>
  );
}

export default Beam3DExtrudedViewport;
