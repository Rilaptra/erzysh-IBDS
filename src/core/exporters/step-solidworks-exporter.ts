/**
 * @file step-solidworks-exporter.ts
 * @description Native ISO 10303-21 `AP214` (`.step` / `.stp` B-Rep Solid) and Tessellated 3D Mesh
 * (`.stl` ASCII & Binary) exporter for **SolidWorks**, **Autodesk Inventor**, **Fusion 360**,
 * **ANSYS**, and 3D Printing workflows.
 *
 * Architectural Highlights:
 * 1. **STEP AP214 Analytical Solid (`exportBeamToStepAp214`):**
 *    - Constructs exact closed `COMPOSITE_CURVE` contours (combining `LINE` and `CIRCLE` entities
 *      for hot-rolled root fillets $r$ and hollow box corners $r_{\text{out}}, r_{\text{in}}$) on the
 *      End-A cross-section plane ($s = 0$).
 *    - Bounds the cross-section plane via `EDGE_LOOP`, `FACE_OUTER_BOUND` (plus `FACE_BOUND` for
 *      hollow BOX profiles), and `ADVANCED_FACE` / `CURVE_BOUNDED_SURFACE`.
 *    - Sweeps the planar area into a 3D analytical solid via `EXTRUDED_AREA_SOLID` along the
 *      active longitudinal span vector $\hat{\mathbf{e}}_s$ (`Z-Up`, `Y-Up`, or `CustomXYZ`).
 *    - For Reinforced Concrete beams, includes analytical cylindrical `EXTRUDED_AREA_SOLID`
 *      bodies for longitudinal tensile ($A_s$) and compressive ($A'_s$) reinforcement bars.
 * 2. **Deflected 3D Mesh STL (`exportDeflectedMeshToAsciiStl` & `exportDeflectedMeshToBinaryStl`):**
 *    - Directly converts zero-copy `Float32Array` vertex positions and `Uint32Array` triangle
 *      indices from the Rust WASM linear memory buffer into ASCII or IEEE-754 Binary `.stl`,
 *      preserving downward Euler-Bernoulli curvature ($\Delta < 0$) and optional 3D rebar cage tubes.
 */

import {
  type ExtrusionCrossSectionInput,
  solveEulerBernoulliDeflection,
} from "@/core/mechanics/euler-bernoulli-deflection-solver";
import type {
  ZeroCopyMesh3DViews,
  ZeroCopyRebarCage3DViews,
} from "@/core/mechanics/wasm-mechanics-bridge";
import type { BeamSimulatorState } from "@/state/beam-simulator-store";
import type { ExternalLoadsModeAConfig } from "@/types/beam-loading-modes";
import {
  type CoordinateSystemMode,
  kilonewtonPerMeter,
  type Matrix3x3,
  meter,
  type Vector3D,
} from "@/types/branded-units";

import {
  type ExportCoordinateFrame3D,
  type Ifc4CrossSectionInput,
  mapIntrinsicToGlobal,
  resolveCrossSectionFromSimulatorState,
  resolveExportCoordinateFrame,
} from "./ifc4-bim-revit-exporter";

// ============================================================================
// Structured Error Handling & Traceback Diagnostics
// ============================================================================

/**
 * Enumeration of machine-readable error codes emitted by the STEP AP214 & STL exporter.
 */
export type StepSolidWorksExportErrorCode =
  | "INVALID_SPAN_LENGTH"
  | "INVALID_SECTION_DIMENSIONS"
  | "INVALID_MESH_BUFFERS"
  | "EMPTY_TRIANGLE_MESH"
  | "INVALID_COORDINATE_FRAME";

/**
 * Structured error class thrown when STEP AP214 or STL 3D mesh generation fails validation.
 * Captures offending parameter names, runtime values, and stack trace for rapid debugging.
 */
export class StepSolidWorksExportError extends Error {
  /** Machine-readable error code classification. */
  public readonly code: StepSolidWorksExportErrorCode;
  /** Offending input parameter or buffer field name. */
  public readonly fieldName: string;
  /** Rejected runtime value captured at failure time. */
  public readonly invalidValue: unknown;
  /** ISO-8601 timestamp when the error occurred. */
  public readonly timestampIso: string;

  /**
   * Constructs a new `StepSolidWorksExportError` with full diagnostic traceback metadata.
   *
   * @param code - Machine-readable error code (`StepSolidWorksExportErrorCode`).
   * @param fieldName - Offending field identifier (e.g., `"positionsF32"` or `"spanLengthMm"`).
   * @param invalidValue - Rejected runtime value.
   * @param message - Clear explanation of the failure cause and remediation steps.
   *
   * @example
   * ```ts
   * throw new StepSolidWorksExportError(
   *   "INVALID_SPAN_LENGTH",
   *   "spanLengthMm",
   *   -500,
   *   "Extrusion span length must be strictly positive (L > 0 mm).",
   * );
   * ```
   */
  constructor(
    code: StepSolidWorksExportErrorCode,
    fieldName: string,
    invalidValue: unknown,
    message: string,
  ) {
    super(
      `[StepSolidWorksExportError:${code}] Field '${fieldName}' (value: ${JSON.stringify(invalidValue)}): ${message}`,
    );
    this.name = "StepSolidWorksExportError";
    this.code = code;
    this.fieldName = fieldName;
    this.invalidValue = invalidValue;
    this.timestampIso = new Date().toISOString();
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, StepSolidWorksExportError);
    }
  }
}

// ============================================================================
// Data Contracts & Interfaces
// ============================================================================

/**
 * Cross-section input union shared with the BIM exporter (`STEEL_IWF`, `STEEL_BOX`, `CONCRETE_RECT`).
 */
export type StepCrossSectionInput = Ifc4CrossSectionInput;

/**
 * Input configuration for `exportBeamToStepAp214`.
 */
export interface StepBeamExportInput {
  /** Part / solid name embedded into `PRODUCT` entity (defaults to profile designation). */
  readonly partName?: string;
  /** Clear extrusion span length $L$ in millimeters ($\text{mm}$, must be $> 0$). */
  readonly spanLengthMm: number;
  /** Active 3D coordinate system orientation (`"Z-Up"`, `"Y-Up"`, or `"CustomXYZ"`). */
  readonly coordinateMode: CoordinateSystemMode;
  /** Optional custom Up-axis vector when `coordinateMode === "CustomXYZ"`. */
  readonly customUpVector?: Vector3D;
  /** Optional explicit $3 \times 3$ orthogonal transformation matrix. */
  readonly customMatrix?: Matrix3x3;
  /** Parametric cross-section geometry (`STEEL_IWF`, `STEEL_BOX`, or `CONCRETE_RECT`). */
  readonly crossSection: StepCrossSectionInput;
  /** Whether to include 3D cylindrical solid bodies for concrete rebars ($A_s, A'_s$). Default: `true`. */
  readonly includeConcreteRebars?: boolean;
  /** Optional author name for STEP header. */
  readonly authorName?: string;
  /** Optional organization name for STEP header. */
  readonly organizationName?: string;
  /** Optional fixed ISO-8601 timestamp for deterministic test snapshots. */
  readonly timestampIso?: string;
}

/**
 * Output payload returned by `exportBeamToStepAp214`.
 */
export interface StepExportResult {
  /** Recommended download file name ending with `.step`. */
  readonly fileName: string;
  /** Standard MIME type for ISO 10303-21 STEP files (`"application/step"`). */
  readonly mimeType: "application/step";
  /** Complete ASCII ISO-10303-21 `AP214` file content. */
  readonly content: string;
  /** Total number of `#N` STEP entities emitted in the `DATA` section. */
  readonly entityCount: number;
  /** Schema identifier (`"AUTOMOTIVE_DESIGN_AP214"`). */
  readonly schema: "AUTOMOTIVE_DESIGN_AP214";
  /** Active coordinate system orientation applied to the 3D solid. */
  readonly coordinateMode: CoordinateSystemMode;
}

/**
 * Input configuration for deflected 3D mesh STL exporters (`exportDeflectedMeshToAsciiStl`
 * and `exportDeflectedMeshToBinaryStl`).
 */
export interface StlMeshExportInput {
  /** Solid identifier name written into the STL header (defaults to `"IBDS_Deflected_Beam"`). */
  readonly solidName?: string;
  /** Interleaved 3D vertex positions `[x0, y0, z0, x1, y1, z1, ...]` in $\text{mm}$ from Rust WASM. */
  readonly positionsF32: Float32Array;
  /** Counter-Clockwise (CCW) triangle vertex indices `[i0, i1, i2, ...]` from Rust WASM. */
  readonly indicesU32: Uint32Array;
  /** Optional interleaved 3D line vertex positions `[x0, y0, z0, ...]` for concrete rebar cage wireframe. */
  readonly rebarCagePositionsF32?: Float32Array;
  /** Optional line segment index pairs `[a0, b0, a1, b1, ...]` for concrete rebar cage wireframe. */
  readonly rebarCageIndicesU32?: Uint32Array;
  /** Radius in $\text{mm}$ used when tessellating rebar wireframe segments into 3D tubular prisms (default `6.0`). */
  readonly rebarTubeRadiusMm?: number;
  /** Active 3D coordinate system orientation (`"Z-Up"`, `"Y-Up"`, or `"CustomXYZ"`). */
  readonly coordinateMode: CoordinateSystemMode;
  /** Optional signed maximum downward deflection $\Delta_{\max}$ in $\text{mm}$ ($\le 0$) recorded in metadata. */
  readonly maxDeflectionMm?: number;
}

/**
 * Output payload returned by `exportDeflectedMeshToAsciiStl`.
 */
export interface StlAsciiExportResult {
  /** Recommended download file name ending with `.stl`. */
  readonly fileName: string;
  /** Standard MIME type for STL 3D mesh files (`"model/stl"`). */
  readonly mimeType: "model/stl";
  /** Complete ASCII STL string (`solid ... facet normal ... endsolid`). */
  readonly content: string;
  /** Total number of triangular facets emitted. */
  readonly facetCount: number;
  /** Active coordinate system orientation. */
  readonly coordinateMode: CoordinateSystemMode;
}

/**
 * Output payload returned by `exportDeflectedMeshToBinaryStl`.
 */
export interface StlBinaryExportResult {
  /** Recommended download file name ending with `.stl`. */
  readonly fileName: string;
  /** Standard MIME type for STL 3D mesh files (`"model/stl"`). */
  readonly mimeType: "model/stl";
  /** Raw IEEE-754 little-endian binary STL buffer (`80 + 4 + 50 * facetCount` bytes). */
  readonly bytes: Uint8Array;
  /** Total number of triangular facets written. */
  readonly facetCount: number;
  /** Active coordinate system orientation. */
  readonly coordinateMode: CoordinateSystemMode;
}

// ============================================================================
// Internal STEP Entity Graph Builder & Geometric Primitives
// ============================================================================

/**
 * Formats a floating-point number as a valid STEP real literal with guaranteed decimal point.
 *
 * @param val - Numeric value.
 * @param decimals - Decimal precision (default `4`).
 * @returns STEP real literal string.
 */
function fmtReal(val: number, decimals = 4): string {
  if (!Number.isFinite(val)) {
    return "0.";
  }
  const clean = Math.abs(val) < 1e-10 ? 0 : val;
  const str = clean.toFixed(decimals).replace(/0+$/, "");
  return str.endsWith(".") ? str : str;
}

/**
 * Sanitizes string literals for STEP `'...'` fields.
 *
 * @param raw - Input text.
 * @returns Escaped string.
 */
function escStepStr(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/'/g, "''").trim();
}

/**
 * 2D cross-section point in intrinsic $(u, v)$ section coordinates ($\text{mm}$).
 */
interface Point2DUV {
  readonly u: number;
  readonly v: number;
}

/**
 * Segment descriptor for constructing closed `COMPOSITE_CURVE` and `EDGE_LOOP` contours.
 */
type ContourSegment2D =
  | {
      readonly type: "LINE";
      readonly start: Point2DUV;
      readonly end: Point2DUV;
    }
  | {
      readonly type: "ARC";
      readonly start: Point2DUV;
      readonly end: Point2DUV;
      readonly center: Point2DUV;
      readonly radius: number;
      /** `true` if arc sweeps Counter-Clockwise in local $(u, v)$ plane, `false` if Clockwise. */
      readonly ccw: boolean;
    };

/**
 * Sequential entity builder for ISO-10303-21 AP214 files.
 */
class StepAp214Builder {
  private readonly lines: string[] = [];
  private nextId = 1;

  /**
   * Appends a STEP entity definition and returns its `#N` identifier.
   *
   * @param expr - Entity definition expression without `#N=` or `;`.
   * @returns Entity reference string `#N`.
   */
  public add(expr: string): string {
    const ref = `#${this.nextId++}`;
    this.lines.push(`${ref}= ${expr};`);
    return ref;
  }

  /**
   * Adds a 3D `CARTESIAN_POINT` mapped from intrinsic $(s, u, v)$ via the active coordinate frame.
   *
   * @param s - Longitudinal coordinate $s$ in $\text{mm}$.
   * @param u - Lateral width coordinate $u$ in $\text{mm}$.
   * @param v - Vertical height coordinate $v$ in $\text{mm}$.
   * @param frame - Active 3D coordinate frame.
   * @param label - Optional STEP entity label.
   * @returns `#N` reference to `CARTESIAN_POINT`.
   */
  public addMappedPoint3D(
    s: number,
    u: number,
    v: number,
    frame: ExportCoordinateFrame3D,
    label = "",
  ): string {
    const pt = mapIntrinsicToGlobal(s, u, v, frame);
    return this.add(
      `CARTESIAN_POINT('${escStepStr(label)}',(${fmtReal(pt.x)},${fmtReal(pt.y)},${fmtReal(pt.z)}))`,
    );
  }

  /**
   * Adds a 3D `DIRECTION` entity.
   *
   * @param dir - Unit direction vector.
   * @param label - Optional STEP entity label.
   * @returns `#N` reference to `DIRECTION`.
   */
  public addDirection3D(dir: Vector3D, label = ""): string {
    return this.add(
      `DIRECTION('${escStepStr(label)}',(${fmtReal(dir.x, 6)},${fmtReal(dir.y, 6)},${fmtReal(dir.z, 6)}))`,
    );
  }

  /**
   * Total number of STEP entities created.
   */
  public get count(): number {
    return this.nextId - 1;
  }

  /**
   * Joins all entity lines into the `DATA` section body.
   */
  public serialize(): string {
    return this.lines.join("\n");
  }
}

// ============================================================================
// 2D Cross-Section Contour Generators (IWF, BOX, Concrete)
// ============================================================================

/**
 * Builds the exact 16-segment Counter-Clockwise (CCW) closed contour for a hot-rolled
 * Wide Flange (IWF) section in local $(u, v)$ coordinates, consisting of 12 `LINE` segments
 * and 4 `CIRCLE` fillet arcs of radius $r$ at the web-to-flange junctions.
 *
 * @param bfMm - Flange width $B$ in $\text{mm}$.
 * @param dMm - Overall depth $H$ in $\text{mm}$.
 * @param twMm - Web thickness $t_w$ in $\text{mm}$.
 * @param tfMm - Flange thickness $t_f$ in $\text{mm}$.
 * @param rMm - Root fillet radius $r$ in $\text{mm}$.
 * @returns Array of `ContourSegment2D` forming a closed CCW loop.
 */
function buildIwfContourSegments2D(
  bfMm: number,
  dMm: number,
  twMm: number,
  tfMm: number,
  rMm: number,
): ContourSegment2D[] {
  const xFlange = bfMm / 2;
  const xWeb = twMm / 2;
  const yTop = dMm / 2;
  const yFlangeInner = dMm / 2 - tfMm;

  // Clamp fillet radius safely to physical space between web and flange edge
  const maxSafeR = Math.min((bfMm - twMm) / 2 - 0.1, (dMm - 2 * tfMm) / 2 - 0.1);
  const r = Math.max(0, Math.min(rMm, maxSafeR));

  if (r <= 1e-4) {
    // 12-point straight I-shape polygon without fillets
    const pts: Point2DUV[] = [
      { u: +xFlange, v: -yTop },
      { u: +xFlange, v: -yFlangeInner },
      { u: +xWeb, v: -yFlangeInner },
      { u: +xWeb, v: +yFlangeInner },
      { u: +xFlange, v: +yFlangeInner },
      { u: +xFlange, v: +yTop },
      { u: -xFlange, v: +yTop },
      { u: -xFlange, v: +yFlangeInner },
      { u: -xWeb, v: +yFlangeInner },
      { u: -xWeb, v: -yFlangeInner },
      { u: -xFlange, v: -yFlangeInner },
      { u: -xFlange, v: -yTop },
    ];
    return pts.map((pt, idx) => ({
      type: "LINE" as const,
      start: pt,
      end: pts[(idx + 1) % pts.length] ?? pt,
    }));
  }

  const xFillet = xWeb + r;
  const yFillet = yFlangeInner - r;

  const p0: Point2DUV = { u: +xFlange, v: -yTop };
  const p1: Point2DUV = { u: +xFlange, v: -yFlangeInner };
  const p2: Point2DUV = { u: +xFillet, v: -yFlangeInner };
  const p3: Point2DUV = { u: +xWeb, v: -yFillet };
  const p4: Point2DUV = { u: +xWeb, v: +yFillet };
  const p5: Point2DUV = { u: +xFillet, v: +yFlangeInner };
  const p6: Point2DUV = { u: +xFlange, v: +yFlangeInner };
  const p7: Point2DUV = { u: +xFlange, v: +yTop };
  const p8: Point2DUV = { u: -xFlange, v: +yTop };
  const p9: Point2DUV = { u: -xFlange, v: +yFlangeInner };
  const p10: Point2DUV = { u: -xFillet, v: +yFlangeInner };
  const p11: Point2DUV = { u: -xWeb, v: +yFillet };
  const p12: Point2DUV = { u: -xWeb, v: -yFillet };
  const p13: Point2DUV = { u: -xFillet, v: -yFlangeInner };
  const p14: Point2DUV = { u: -xFlange, v: -yFlangeInner };
  const p15: Point2DUV = { u: -xFlange, v: -yTop };

  return [
    { type: "LINE", start: p0, end: p1 },
    { type: "LINE", start: p1, end: p2 },
    // Bottom-right root fillet arc (sweeps clockwise inward from -90 deg to 180 deg)
    {
      type: "ARC",
      start: p2,
      end: p3,
      center: { u: +xFillet, v: -yFillet },
      radius: r,
      ccw: false,
    },
    { type: "LINE", start: p3, end: p4 },
    // Top-right root fillet arc (sweeps clockwise from 180 deg to 90 deg)
    {
      type: "ARC",
      start: p4,
      end: p5,
      center: { u: +xFillet, v: +yFillet },
      radius: r,
      ccw: false,
    },
    { type: "LINE", start: p5, end: p6 },
    { type: "LINE", start: p6, end: p7 },
    { type: "LINE", start: p7, end: p8 },
    { type: "LINE", start: p8, end: p9 },
    { type: "LINE", start: p9, end: p10 },
    // Top-left root fillet arc (sweeps clockwise from 90 deg to 0 deg)
    {
      type: "ARC",
      start: p10,
      end: p11,
      center: { u: -xFillet, v: +yFillet },
      radius: r,
      ccw: false,
    },
    { type: "LINE", start: p11, end: p12 },
    // Bottom-left root fillet arc (sweeps clockwise from 0 deg to -90 deg)
    {
      type: "ARC",
      start: p12,
      end: p13,
      center: { u: -xFillet, v: -yFillet },
      radius: r,
      ccw: false,
    },
    { type: "LINE", start: p13, end: p14 },
    { type: "LINE", start: p14, end: p15 },
    { type: "LINE", start: p15, end: p0 },
  ];
}

/**
 * Builds a rounded rectangle closed contour in local $(u, v)$ coordinates with 4 `LINE`
 * segments and 4 corner `CIRCLE` arcs of radius $r_c$.
 *
 * @param widthMm - Total rectangle width in $\text{mm}$.
 * @param heightMm - Total rectangle height in $\text{mm}$.
 * @param cornerRadiusMm - Corner fillet radius $r_c$ in $\text{mm}$.
 * @param clockwise - If `true`, reverses orientation for inner void loops (`FACE_BOUND`).
 * @returns Array of `ContourSegment2D` forming a closed loop.
 */
function buildRoundedRectContourSegments2D(
  widthMm: number,
  heightMm: number,
  cornerRadiusMm: number,
  clockwise = false,
): ContourSegment2D[] {
  const hw = widthMm / 2;
  const hh = heightMm / 2;
  const r = Math.max(0, Math.min(cornerRadiusMm, Math.min(hw, hh) - 0.1));

  if (r <= 1e-4) {
    const ccwPts: Point2DUV[] = [
      { u: +hw, v: -hh },
      { u: +hw, v: +hh },
      { u: -hw, v: +hh },
      { u: -hw, v: -hh },
    ];
    const pts = clockwise ? [...ccwPts].reverse() : ccwPts;
    return pts.map((pt, i) => ({
      type: "LINE" as const,
      start: pt,
      end: pts[(i + 1) % pts.length] ?? pt,
    }));
  }

  const uc = hw - r;
  const vc = hh - r;

  const ccwSegments: ContourSegment2D[] = [
    // Bottom edge (left to right)
    { type: "LINE", start: { u: -uc, v: -hh }, end: { u: +uc, v: -hh } },
    // Bottom-right corner arc
    {
      type: "ARC",
      start: { u: +uc, v: -hh },
      end: { u: +hw, v: -vc },
      center: { u: +uc, v: -vc },
      radius: r,
      ccw: true,
    },
    // Right edge (bottom to top)
    { type: "LINE", start: { u: +hw, v: -vc }, end: { u: +hw, v: +vc } },
    // Top-right corner arc
    {
      type: "ARC",
      start: { u: +hw, v: +vc },
      end: { u: +uc, v: +hh },
      center: { u: +uc, v: +vc },
      radius: r,
      ccw: true,
    },
    // Top edge (right to left)
    { type: "LINE", start: { u: +uc, v: +hh }, end: { u: -uc, v: +hh } },
    // Top-left corner arc
    {
      type: "ARC",
      start: { u: -uc, v: +hh },
      end: { u: -hw, v: +vc },
      center: { u: -uc, v: +vc },
      radius: r,
      ccw: true,
    },
    // Left edge (top to bottom)
    { type: "LINE", start: { u: -hw, v: +vc }, end: { u: -hw, v: -vc } },
    // Bottom-left corner arc
    {
      type: "ARC",
      start: { u: -hw, v: -vc },
      end: { u: -uc, v: -hh },
      center: { u: -uc, v: -vc },
      radius: r,
      ccw: true,
    },
  ];

  if (!clockwise) {
    return ccwSegments;
  }

  // Reverse loop direction for inner cavity boundary
  return [...ccwSegments].reverse().map((seg) =>
    seg.type === "LINE"
      ? { type: "LINE", start: seg.end, end: seg.start }
      : {
          type: "ARC",
          start: seg.end,
          end: seg.start,
          center: seg.center,
          radius: seg.radius,
          ccw: !seg.ccw,
        },
  );
}

/**
 * Emits STEP AP214 entities (`COMPOSITE_CURVE`, `COMPOSITE_CURVE_SEGMENT`, `TRIMMED_CURVE`,
 * `LINE`, `CIRCLE`, `VERTEX_POINT`, `EDGE_CURVE`, `ORIENTED_EDGE`, and `EDGE_LOOP`) for a
 * closed 2D cross-section contour at longitudinal station $s = 0$.
 *
 * @param b - Active `StepAp214Builder`.
 * @param segments - Closed array of `ContourSegment2D`.
 * @param frame - Active 3D coordinate frame.
 * @param dirSpanId - `#ID` of `DIRECTION` along $+\hat{\mathbf{e}}_s$.
 * @param dirNegSpanId - `#ID` of `DIRECTION` along $-\hat{\mathbf{e}}_s$.
 * @param dirWidthId - `#ID` of `DIRECTION` along $+\hat{\mathbf{e}}_u$.
 * @param loopName - Descriptive STEP name for the contour.
 * @returns Object containing `compositeCurveId` and `edgeLoopId`.
 */
function emitClosedContourStepEntities(
  b: StepAp214Builder,
  segments: readonly ContourSegment2D[],
  frame: ExportCoordinateFrame3D,
  dirSpanId: string,
  dirNegSpanId: string,
  dirWidthId: string,
  loopName: string,
): { readonly compositeCurveId: string; readonly edgeLoopId: string } {
  const n = segments.length;
  const cartesianPtIds: string[] = [];
  const vertexPtIds: string[] = [];

  for (let i = 0; i < n; i++) {
    const seg = segments[i];
    if (!seg) continue;
    const pt = seg.start;
    const cpId = b.addMappedPoint3D(0, pt.u, pt.v, frame, `${loopName}_PT_${i}`);
    const vpId = b.add(`VERTEX_POINT('${loopName}_V_${i}',${cpId})`);
    cartesianPtIds.push(cpId);
    vertexPtIds.push(vpId);
  }

  const compositeSegIds: string[] = [];
  const orientedEdgeIds: string[] = [];

  for (let i = 0; i < n; i++) {
    const seg = segments[i];
    if (!seg) continue;
    const nextIdx = (i + 1) % n;
    const startCpId = cartesianPtIds[i] ?? "#1";
    const endCpId = cartesianPtIds[nextIdx] ?? "#1";
    const startVpId = vertexPtIds[i] ?? "#1";
    const endVpId = vertexPtIds[nextIdx] ?? "#1";

    if (seg.type === "LINE") {
      const du = seg.end.u - seg.start.u;
      const dv = seg.end.v - seg.start.v;
      const len = Math.hypot(du, dv) || 1;
      const globalDir = mapIntrinsicToGlobal(0, du / len, dv / len, frame);
      const dirId = b.addDirection3D(globalDir, `${loopName}_LDIR_${i}`);
      const vecId = b.add(`VECTOR('${loopName}_VEC_${i}',${dirId},1.)`);
      const lineId = b.add(`LINE('${loopName}_LINE_${i}',${startCpId},${vecId})`);
      const trimmedId = b.add(
        `TRIMMED_CURVE('${loopName}_TRIM_${i}',${lineId},(${startCpId}),(${endCpId}),.T.,.CARTESIAN.)`,
      );
      const compSegId = b.add(`COMPOSITE_CURVE_SEGMENT(.CONTINUOUS.,.T.,${trimmedId})`);
      const edgeCurveId = b.add(
        `EDGE_CURVE('${loopName}_EDGE_${i}',${startVpId},${endVpId},${lineId},.T.)`,
      );
      const orientedEdgeId = b.add(`ORIENTED_EDGE('',*,*,${edgeCurveId},.T.)`);

      compositeSegIds.push(compSegId);
      orientedEdgeIds.push(orientedEdgeId);
    } else {
      // Circular fillet arc
      const centerCpId = b.addMappedPoint3D(
        0,
        seg.center.u,
        seg.center.v,
        frame,
        `${loopName}_ARC_CTR_${i}`,
      );
      const axisDirId = seg.ccw ? dirSpanId : dirNegSpanId;
      const circlePlaceId = b.add(
        `AXIS2_PLACEMENT_3D('${loopName}_ARC_AX_${i}',${centerCpId},${axisDirId},${dirWidthId})`,
      );
      const circleId = b.add(
        `CIRCLE('${loopName}_CIRCLE_${i}',${circlePlaceId},${fmtReal(seg.radius)})`,
      );
      const trimmedId = b.add(
        `TRIMMED_CURVE('${loopName}_ARC_TRIM_${i}',${circleId},(${startCpId}),(${endCpId}),.T.,.CARTESIAN.)`,
      );
      const compSegId = b.add(`COMPOSITE_CURVE_SEGMENT(.CONTINUOUS.,.T.,${trimmedId})`);
      const edgeCurveId = b.add(
        `EDGE_CURVE('${loopName}_ARC_EDGE_${i}',${startVpId},${endVpId},${circleId},.T.)`,
      );
      const orientedEdgeId = b.add(`ORIENTED_EDGE('',*,*,${edgeCurveId},.T.)`);

      compositeSegIds.push(compSegId);
      orientedEdgeIds.push(orientedEdgeId);
    }
  }

  const compositeCurveId = b.add(
    `COMPOSITE_CURVE('${loopName}_COMPOSITE_CURVE',(${compositeSegIds.join(",")}),.F.)`,
  );
  const edgeLoopId = b.add(`EDGE_LOOP('${loopName}_EDGE_LOOP',(${orientedEdgeIds.join(",")}))`);

  return { compositeCurveId, edgeLoopId };
}

// ============================================================================
// Core STEP AP214 Solid Exporter (`exportBeamToStepAp214`)
// ============================================================================

/**
 * Generates an ISO 10303-21 `AP214` (`.step`) 3D Solid CAD model of the structural beam.
 *
 * Builds an analytical `COMPOSITE_CURVE` & `ADVANCED_FACE` cross-section at End A ($s = 0$)
 * featuring exact `LINE` segments and `CIRCLE` arcs for IWF root fillets ($r$) or BOX corners
 * ($r_{\text{out}} = 2t, r_{\text{in}} = t$), and sweeps it via `EXTRUDED_AREA_SOLID` along
 * the active longitudinal axis (`Z-Up`, `Y-Up`, or `CustomXYZ`) for span length $L$.
 *
 * @param input - Validated `StepBeamExportInput` configuration.
 * @returns `StepExportResult` containing the `.step` file text, recommended filename, and entity count.
 * @throws {StepSolidWorksExportError} If span length or cross-section dimensions are invalid.
 *
 * @example
 * ```ts
 * const stepResult = exportBeamToStepAp214({
 *   spanLengthMm: 6000,
 *   coordinateMode: "Y-Up",
 *   crossSection: {
 *     kind: "STEEL_IWF",
 *     profileName: "WF 300 x 150 x 36.7",
 *     dMm: 300,
 *     bfMm: 150,
 *     twMm: 6.5,
 *     tfMm: 9.0,
 *     rMm: 13.0,
 *     steelGrade: "BJ_37",
 *   },
 * });
 * console.log(stepResult.fileName); // "ibds-solid-wf-300-x-150-x-36-7-y-up.step"
 * ```
 */
export function exportBeamToStepAp214(input: StepBeamExportInput): StepExportResult {
  if (!Number.isFinite(input.spanLengthMm) || input.spanLengthMm <= 0) {
    throw new StepSolidWorksExportError(
      "INVALID_SPAN_LENGTH",
      "spanLengthMm",
      input.spanLengthMm,
      "Beam extrusion span length L must be a finite positive number in millimeters.",
    );
  }

  let frame: ExportCoordinateFrame3D;
  try {
    frame = resolveExportCoordinateFrame(
      input.coordinateMode,
      input.customUpVector,
      input.customMatrix,
    );
  } catch (err) {
    throw new StepSolidWorksExportError(
      "INVALID_COORDINATE_FRAME",
      "coordinateMode",
      input.coordinateMode,
      err instanceof Error ? err.message : "Failed to resolve 3D coordinate frame.",
    );
  }

  const cs = input.crossSection;
  // Validate cross-section geometry
  if (cs.kind === "STEEL_IWF") {
    if (
      cs.dMm <= 0 ||
      cs.bfMm <= 0 ||
      cs.twMm <= 0 ||
      cs.tfMm <= 0 ||
      cs.rMm < 0 ||
      2 * cs.tfMm >= cs.dMm ||
      cs.twMm >= cs.bfMm
    ) {
      throw new StepSolidWorksExportError(
        "INVALID_SECTION_DIMENSIONS",
        "crossSection",
        cs,
        "Invalid IWF dimensions for STEP AP214 solid generation.",
      );
    }
  } else if (cs.kind === "STEEL_BOX") {
    if (cs.hMm <= 0 || cs.bMm <= 0 || cs.tMm <= 0 || 2 * cs.tMm >= Math.min(cs.hMm, cs.bMm)) {
      throw new StepSolidWorksExportError(
        "INVALID_SECTION_DIMENSIONS",
        "crossSection",
        cs,
        "Invalid BOX dimensions for STEP AP214 solid generation.",
      );
    }
  } else {
    if (
      cs.bwMm <= 0 ||
      cs.hMm <= 0 ||
      cs.coverMm <= 0 ||
      2 * cs.coverMm >= Math.min(cs.bwMm, cs.hMm)
    ) {
      throw new StepSolidWorksExportError(
        "INVALID_SECTION_DIMENSIONS",
        "crossSection",
        cs,
        "Invalid Reinforced Concrete dimensions for STEP AP214 solid generation.",
      );
    }
  }

  const b = new StepAp214Builder();
  const partLabel = escStepStr(
    input.partName ??
      (cs.kind === "CONCRETE_RECT"
        ? (cs.sectionName ?? `RC_${Math.round(cs.bwMm)}x${Math.round(cs.hMm)}`)
        : cs.profileName),
  );
  const author = escStepStr(input.authorName ?? "IBDS Structural Engineer");
  const organization = escStepStr(
    input.organizationName ?? "Interactive Beam Deflection Simulator",
  );
  const isoTimestamp = (input.timestampIso ?? new Date().toISOString()).slice(0, 19);

  // 1. AP214 Application Protocol & Product Definition Header Entities
  const appCtxId = b.add(
    `APPLICATION_CONTEXT('core data for automotive mechanical design processes')`,
  );
  b.add(
    `APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2000,${appCtxId})`,
  );
  const prodCtxId = b.add(`PRODUCT_CONTEXT('',#${appCtxId.slice(1)},'mechanical')`);
  const productId = b.add(
    `PRODUCT('${partLabel}','${partLabel}','IBDS 3D Beam Solid (${frame.mode})',(${prodCtxId}))`,
  );
  const pdfId = b.add(
    `PRODUCT_DEFINITION_FORMATION_WITH_SPECIFIED_SOURCE('1','Initial Release',${productId},.MADE.)`,
  );
  const pdCtxId = b.add(`PRODUCT_DEFINITION_CONTEXT('part definition',${appCtxId},'design')`);
  const prodDefId = b.add(`PRODUCT_DEFINITION('design','',${pdfId},${pdCtxId})`);
  const prodDefShapeId = b.add(
    `PRODUCT_DEFINITION_SHAPE('','Shape for ${partLabel}',${prodDefId})`,
  );

  // 2. Units & Geometric Representation Context (Millimeters & Radians)
  const lenUnitId = b.add(`(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.))`);
  const angUnitId = b.add(`(NAMED_UNIT(*)PLANE_ANGLE_UNIT()SI_UNIT($,.RADIAN.))`);
  const solidAngUnitId = b.add(`(NAMED_UNIT(*)SI_UNIT($,.STERADIAN.)SOLID_ANGLE_UNIT())`);
  const uncertId = b.add(
    `UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.0E-4),${lenUnitId},'distance_accuracy_value','confusion accuracy')`,
  );
  const geomRepCtxId = b.add(
    `(GEOMETRIC_REPRESENTATION_CONTEXT(3)GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((${uncertId}))GLOBAL_UNIT_ASSIGNED_CONTEXT((${lenUnitId},${angUnitId},${solidAngUnitId}))REPRESENTATION_CONTEXT('Context3D','3D Solid Context (${frame.mode})'))`,
  );

  // 3. Coordinate Basis Vectors in Active Coordinate System (Z-Up / Y-Up / CustomXYZ)
  const origin3DId = b.addMappedPoint3D(0, 0, 0, frame, "ORIGIN");
  const dirSpanId = b.addDirection3D(frame.spanAxis, "SPAN_AXIS");
  const dirNegSpanId = b.addDirection3D(
    { x: -frame.spanAxis.x, y: -frame.spanAxis.y, z: -frame.spanAxis.z },
    "NEG_SPAN_AXIS",
  );
  const dirWidthId = b.addDirection3D(frame.widthAxis, "WIDTH_AXIS");
  const localExtrudeDirZId = b.addDirection3D({ x: 0, y: 0, z: 1 }, "LOCAL_EXTRUDE_Z");

  const endAPlacement3DId = b.add(
    `AXIS2_PLACEMENT_3D('END_A_PLANE_AXES',${origin3DId},${dirSpanId},${dirWidthId})`,
  );
  const endAPlaneId = b.add(`PLANE('END_A_SECTION_PLANE',${endAPlacement3DId})`);

  const solidRepresentationItems: string[] = [endAPlacement3DId];

  // 4. Build Cross-Section COMPOSITE_CURVE, ADVANCED_FACE, and EXTRUDED_AREA_SOLID
  if (cs.kind === "STEEL_IWF") {
    const iwfSegments = buildIwfContourSegments2D(cs.bfMm, cs.dMm, cs.twMm, cs.tfMm, cs.rMm);
    const { compositeCurveId, edgeLoopId } = emitClosedContourStepEntities(
      b,
      iwfSegments,
      frame,
      dirSpanId,
      dirNegSpanId,
      dirWidthId,
      "IWF_OUTER",
    );
    const outerBoundId = b.add(`FACE_OUTER_BOUND('IWF_OUTER_BOUND',${edgeLoopId},.T.)`);
    const baseFaceId = b.add(
      `ADVANCED_FACE('IWF_SECTION_FACE',(${outerBoundId}),${endAPlaneId},.T.)`,
    );
    const extrudedSolidId = b.add(
      `EXTRUDED_AREA_SOLID('${partLabel}_SOLID',${baseFaceId},${localExtrudeDirZId},${fmtReal(input.spanLengthMm)})`,
    );
    solidRepresentationItems.push(compositeCurveId, extrudedSolidId);
  } else if (cs.kind === "STEEL_BOX") {
    const rOut = cs.outerFilletRadiusMm ?? 2 * cs.tMm;
    const rIn = cs.innerFilletRadiusMm ?? cs.tMm;

    const outerSegments = buildRoundedRectContourSegments2D(cs.bMm, cs.hMm, rOut, false);
    const innerSegments = buildRoundedRectContourSegments2D(
      cs.bMm - 2 * cs.tMm,
      cs.hMm - 2 * cs.tMm,
      rIn,
      true,
    );

    const outerContour = emitClosedContourStepEntities(
      b,
      outerSegments,
      frame,
      dirSpanId,
      dirNegSpanId,
      dirWidthId,
      "BOX_OUTER",
    );
    const innerContour = emitClosedContourStepEntities(
      b,
      innerSegments,
      frame,
      dirSpanId,
      dirNegSpanId,
      dirWidthId,
      "BOX_INNER_VOID",
    );

    const outerBoundId = b.add(
      `FACE_OUTER_BOUND('BOX_OUTER_BOUND',${outerContour.edgeLoopId},.T.)`,
    );
    const innerBoundId = b.add(
      `FACE_BOUND('BOX_HOLLOW_VOID_BOUND',${innerContour.edgeLoopId},.T.)`,
    );
    const baseFaceId = b.add(
      `ADVANCED_FACE('BOX_HOLLOW_SECTION_FACE',(${outerBoundId},${innerBoundId}),${endAPlaneId},.T.)`,
    );
    const extrudedSolidId = b.add(
      `EXTRUDED_AREA_SOLID('${partLabel}_SOLID',${baseFaceId},${localExtrudeDirZId},${fmtReal(input.spanLengthMm)})`,
    );
    solidRepresentationItems.push(
      outerContour.compositeCurveId,
      innerContour.compositeCurveId,
      extrudedSolidId,
    );
  } else {
    // CONCRETE_RECT: Rectangular concrete matrix + 3D cylindrical rebar solids
    const rectSegments = buildRoundedRectContourSegments2D(cs.bwMm, cs.hMm, 0, false);
    const rectContour = emitClosedContourStepEntities(
      b,
      rectSegments,
      frame,
      dirSpanId,
      dirNegSpanId,
      dirWidthId,
      "RC_CONCRETE",
    );
    const outerBoundId = b.add(`FACE_OUTER_BOUND('RC_OUTER_BOUND',${rectContour.edgeLoopId},.T.)`);
    const baseFaceId = b.add(
      `ADVANCED_FACE('RC_CONCRETE_FACE',(${outerBoundId}),${endAPlaneId},.T.)`,
    );
    const concreteSolidId = b.add(
      `EXTRUDED_AREA_SOLID('${partLabel}_CONCRETE_BODY',${baseFaceId},${localExtrudeDirZId},${fmtReal(input.spanLengthMm)})`,
    );
    solidRepresentationItems.push(rectContour.compositeCurveId, concreteSolidId);

    // Optional 3D cylindrical solids for longitudinal rebars (As & A's)
    if (input.includeConcreteRebars !== false) {
      const clearSpanMm = Math.max(input.spanLengthMm - 2 * cs.coverMm, input.spanLengthMm * 0.9);
      const startStationMm = (input.spanLengthMm - clearSpanMm) / 2;

      const emitRebarCylinderSolid = (
        barLabel: string,
        uMm: number,
        vMm: number,
        radiusMm: number,
      ): string => {
        const ctrPtId = b.addMappedPoint3D(startStationMm, uMm, vMm, frame, `${barLabel}_CTR`);
        const edgePtId = b.addMappedPoint3D(
          startStationMm,
          uMm + radiusMm,
          vMm,
          frame,
          `${barLabel}_RIM`,
        );
        const rimVpId = b.add(`VERTEX_POINT('${barLabel}_V',${edgePtId})`);
        const barAxId = b.add(
          `AXIS2_PLACEMENT_3D('${barLabel}_AX',${ctrPtId},${dirSpanId},${dirWidthId})`,
        );
        const barPlaneId = b.add(`PLANE('${barLabel}_PLANE',${barAxId})`);
        const circleId = b.add(`CIRCLE('${barLabel}_CIRC',${barAxId},${fmtReal(radiusMm)})`);
        const edgeCurveId = b.add(
          `EDGE_CURVE('${barLabel}_EC',${rimVpId},${rimVpId},${circleId},.T.)`,
        );
        const orientedEdgeId = b.add(`ORIENTED_EDGE('',*,*,${edgeCurveId},.T.)`);
        const loopId = b.add(`EDGE_LOOP('${barLabel}_LOOP',(${orientedEdgeId}))`);
        const boundId = b.add(`FACE_OUTER_BOUND('${barLabel}_BOUND',${loopId},.T.)`);
        const discFaceId = b.add(
          `ADVANCED_FACE('${barLabel}_FACE',(${boundId}),${barPlaneId},.T.)`,
        );
        return b.add(
          `EXTRUDED_AREA_SOLID('${barLabel}_SOLID',${discFaceId},${localExtrudeDirZId},${fmtReal(clearSpanMm)})`,
        );
      };

      // Bottom Tensile Rebars (As)
      const tCount = Math.max(1, Math.round(cs.tensileBars.count));
      const tRad = cs.tensileBars.diameterMm / 2;
      const usableW = Math.max(20, cs.bwMm - 2 * (cs.coverMm + cs.stirrup.diameterMm + tRad));
      const vBottom = -cs.hMm / 2 + cs.coverMm + cs.stirrup.diameterMm + tRad;
      for (let i = 0; i < tCount; i++) {
        const uPos = tCount <= 1 ? 0 : -usableW / 2 + (i / (tCount - 1)) * usableW;
        solidRepresentationItems.push(
          emitRebarCylinderSolid(`REBAR_AS_${i + 1}`, uPos, vBottom, tRad),
        );
      }

      // Top Compressive Rebars (A's)
      const cCount = Math.max(0, Math.round(cs.compressiveBars.count));
      const cRad = cs.compressiveBars.diameterMm / 2;
      const vTop = cs.hMm / 2 - cs.coverMm - cs.stirrup.diameterMm - cRad;
      for (let i = 0; i < cCount; i++) {
        const uPos = cCount <= 1 ? 0 : -usableW / 2 + (i / (cCount - 1)) * usableW;
        solidRepresentationItems.push(
          emitRebarCylinderSolid(`REBAR_ASP_${i + 1}`, uPos, vTop, cRad),
        );
      }
    }
  }

  // 5. AP214 Visual Colour & Surface Styling
  const rgbColor =
    cs.kind === "CONCRETE_RECT"
      ? "0.62,0.66,0.71" // Architectural Concrete Slate
      : "0.23,0.51,0.96"; // Structural Steel Metallic Blue
  const colourId = b.add(`COLOUR_RGB('${partLabel}_COLOR',${rgbColor})`);
  const fillColourId = b.add(`FILL_AREA_STYLE_COLOUR('${partLabel}_FILL_COLOR',${colourId})`);
  const fillStyleId = b.add(`FILL_AREA_STYLE('${partLabel}_FILL_STYLE',(${fillColourId}))`);
  const surfFillId = b.add(`SURFACE_STYLE_FILL_AREA(${fillStyleId})`);
  const surfSideId = b.add(`SURFACE_SIDE_STYLE('${partLabel}_SIDE_STYLE',(${surfFillId}))`);
  const surfUsageId = b.add(`SURFACE_STYLE_USAGE(.BOTH.,${surfSideId})`);
  const presStyleId = b.add(`PRESENTATION_STYLE_ASSIGNMENT((${surfUsageId}))`);
  const primarySolidId = solidRepresentationItems[solidRepresentationItems.length - 1];
  const styledItemId = b.add(`STYLED_ITEM('color',(${presStyleId}),${primarySolidId})`);
  b.add(
    `MECHANICAL_DESIGN_GEOMETRIC_PRESENTATION_REPRESENTATION('',(${styledItemId}),${geomRepCtxId})`,
  );

  // 6. Shape Representation & Product Link
  const shapeRepId = b.add(
    `SHAPE_REPRESENTATION('${partLabel}_SHAPE_REP',(${solidRepresentationItems.join(",")}),${geomRepCtxId})`,
  );
  b.add(`SHAPE_DEFINITION_REPRESENTATION(${prodDefShapeId},${shapeRepId})`);

  const slugPart = partLabel
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const slugCoord = frame.mode.toLowerCase();
  const fileName = `ibds-solid-${slugPart}-${slugCoord}.step`;

  const content = [
    "ISO-10303-21;",
    "HEADER;",
    `FILE_DESCRIPTION(('STEP AP214 Analytical Solid - IBDS Structural Beam (${frame.mode})','CAx-IF Rec.Pracs.---Model Styling and Organization---1.5---2016-08-15'),'2;1');`,
    `FILE_NAME('${fileName}','${isoTimestamp}',('${author}'),('${organization}'),'IBDS STEP AP214 Exporter v0.5.0','SolidWorks / Autodesk Inventor / Fusion 360 / ANSYS','');`,
    "FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));",
    "ENDSEC;",
    "DATA;",
    b.serialize(),
    "ENDSEC;",
    "END-ISO-10303-21;",
    "",
  ].join("\n");

  return {
    fileName,
    mimeType: "application/step",
    content,
    entityCount: b.count,
    schema: "AUTOMOTIVE_DESIGN_AP214",
    coordinateMode: frame.mode,
  };
}

// ============================================================================
// Deflected 3D Mesh STL Exporters (ASCII & IEEE-754 Binary)
// ============================================================================

/**
 * Internal 3D triangle facet structure with computed outward unit normal.
 */
interface StlTriangleFacet {
  readonly nx: number;
  readonly ny: number;
  readonly nz: number;
  readonly v0x: number;
  readonly v0y: number;
  readonly v0z: number;
  readonly v1x: number;
  readonly v1y: number;
  readonly v1z: number;
  readonly v2x: number;
  readonly v2y: number;
  readonly v2z: number;
}

/**
 * Validates and extracts Counter-Clockwise (CCW) 3D triangle facets from the Rust WASM
 * `positionsF32` and `indicesU32` buffers, optionally appending 3D hexagonal tubular
 * prisms for reinforced concrete rebar/stirrup wireframe segments.
 *
 * @param input - `StlMeshExportInput` buffer payload.
 * @returns Non-empty array of validated `StlTriangleFacet` records.
 * @throws {StepSolidWorksExportError} If buffers are malformed, out of bounds, or produce 0 facets.
 */
function extractValidatedStlFacets(input: StlMeshExportInput): StlTriangleFacet[] {
  const { positionsF32, indicesU32 } = input;

  if (
    !(positionsF32 instanceof Float32Array) ||
    positionsF32.length < 9 ||
    positionsF32.length % 3 !== 0
  ) {
    throw new StepSolidWorksExportError(
      "INVALID_MESH_BUFFERS",
      "positionsF32",
      positionsF32?.length ?? null,
      "positionsF32 must be a Float32Array with length >= 9 and divisible by 3.",
    );
  }

  if (
    !(indicesU32 instanceof Uint32Array) ||
    indicesU32.length < 3 ||
    indicesU32.length % 3 !== 0
  ) {
    throw new StepSolidWorksExportError(
      "INVALID_MESH_BUFFERS",
      "indicesU32",
      indicesU32?.length ?? null,
      "indicesU32 must be a Uint32Array with length >= 3 and divisible by 3.",
    );
  }

  const vertexCount = positionsF32.length / 3;
  const facets: StlTriangleFacet[] = [];

  for (let i = 0; i < indicesU32.length; i += 3) {
    const i0 = indicesU32[i] ?? 0;
    const i1 = indicesU32[i + 1] ?? 0;
    const i2 = indicesU32[i + 2] ?? 0;

    if (i0 >= vertexCount || i1 >= vertexCount || i2 >= vertexCount) {
      throw new StepSolidWorksExportError(
        "INVALID_MESH_BUFFERS",
        `indicesU32[${i}]`,
        [i0, i1, i2],
        `Triangle vertex index out of bounds (vertexCount = ${vertexCount}).`,
      );
    }

    const v0x = positionsF32[i0 * 3] ?? 0;
    const v0y = positionsF32[i0 * 3 + 1] ?? 0;
    const v0z = positionsF32[i0 * 3 + 2] ?? 0;

    const v1x = positionsF32[i1 * 3] ?? 0;
    const v1y = positionsF32[i1 * 3 + 1] ?? 0;
    const v1z = positionsF32[i1 * 3 + 2] ?? 0;

    const v2x = positionsF32[i2 * 3] ?? 0;
    const v2y = positionsF32[i2 * 3 + 1] ?? 0;
    const v2z = positionsF32[i2 * 3 + 2] ?? 0;

    const e1x = v1x - v0x;
    const e1y = v1y - v0y;
    const e1z = v1z - v0z;

    const e2x = v2x - v0x;
    const e2y = v2y - v0y;
    const e2z = v2z - v0z;

    const cx = e1y * e2z - e1z * e2y;
    const cy = e1z * e2x - e1x * e2z;
    const cz = e1x * e2y - e1y * e2x;
    const normLen = Math.hypot(cx, cy, cz);

    if (normLen > 1e-9 && Number.isFinite(normLen)) {
      facets.push({
        nx: cx / normLen,
        ny: cy / normLen,
        nz: cz / normLen,
        v0x,
        v0y,
        v0z,
        v1x,
        v1y,
        v1z,
        v2x,
        v2y,
        v2z,
      });
    }
  }

  // Optional: Tessellate 3D rebar cage wireframe lines into 6-sided tubular prisms for 3D printing
  if (
    input.rebarCagePositionsF32 &&
    input.rebarCageIndicesU32 &&
    input.rebarCagePositionsF32.length >= 6 &&
    input.rebarCageIndicesU32.length >= 2
  ) {
    const rbPos = input.rebarCagePositionsF32;
    const rbIdx = input.rebarCageIndicesU32;
    const rbVertexCount = Math.floor(rbPos.length / 3);
    const radius = Math.max(1.0, input.rebarTubeRadiusMm ?? 6.0);
    const sides = 6;

    for (let j = 0; j + 1 < rbIdx.length; j += 2) {
      const a = rbIdx[j] ?? 0;
      const b = rbIdx[j + 1] ?? 0;
      if (a >= rbVertexCount || b >= rbVertexCount) continue;

      const ax = rbPos[a * 3] ?? 0;
      const ay = rbPos[a * 3 + 1] ?? 0;
      const az = rbPos[a * 3 + 2] ?? 0;
      const bx = rbPos[b * 3] ?? 0;
      const by = rbPos[b * 3 + 1] ?? 0;
      const bz = rbPos[b * 3 + 2] ?? 0;

      const dx = bx - ax;
      const dy = by - ay;
      const dz = bz - az;
      const segLen = Math.hypot(dx, dy, dz);
      if (segLen < 1e-3) continue;

      const tx = dx / segLen;
      const ty = dy / segLen;
      const tz = dz / segLen;

      // Construct orthonormal basis (u, v) perpendicular to tangent t
      const refX = Math.abs(tx) > 0.85 ? 0 : 1;
      const refY = Math.abs(tx) > 0.85 ? 1 : 0;
      let ux = ty * 0 - tz * refY;
      let uy = tz * refX - tx * 0;
      let uz = tx * refY - ty * refX;
      const uLen = Math.hypot(ux, uy, uz) || 1;
      ux /= uLen;
      uy /= uLen;
      uz /= uLen;

      const vx = ty * uz - tz * uy;
      const vy = tz * ux - tx * uz;
      const vz = tx * uy - ty * ux;

      for (let s = 0; s < sides; s++) {
        const theta0 = (2 * Math.PI * s) / sides;
        const theta1 = (2 * Math.PI * ((s + 1) % sides)) / sides;

        const c0 = Math.cos(theta0) * radius;
        const s0 = Math.sin(theta0) * radius;
        const c1 = Math.cos(theta1) * radius;
        const s1 = Math.sin(theta1) * radius;

        const n0x = Math.cos(theta0) * ux + Math.sin(theta0) * vx;
        const n0y = Math.cos(theta0) * uy + Math.sin(theta0) * vy;
        const n0z = Math.cos(theta0) * uz + Math.sin(theta0) * vz;

        const p00x = ax + c0 * ux + s0 * vx;
        const p00y = ay + c0 * uy + s0 * vy;
        const p00z = az + c0 * uz + s0 * vz;

        const p01x = ax + c1 * ux + s1 * vx;
        const p01y = ay + c1 * uy + s1 * vy;
        const p01z = az + c1 * uz + s1 * vz;

        const p10x = bx + c0 * ux + s0 * vx;
        const p10y = by + c0 * uy + s0 * vy;
        const p10z = bz + c0 * uz + s0 * vz;

        const p11x = bx + c1 * ux + s1 * vx;
        const p11y = by + c1 * uy + s1 * vy;
        const p11z = bz + c1 * uz + s1 * vz;

        facets.push(
          {
            nx: n0x,
            ny: n0y,
            nz: n0z,
            v0x: p00x,
            v0y: p00y,
            v0z: p00z,
            v1x: p10x,
            v1y: p10y,
            v1z: p10z,
            v2x: p11x,
            v2y: p11y,
            v2z: p11z,
          },
          {
            nx: n0x,
            ny: n0y,
            nz: n0z,
            v0x: p00x,
            v0y: p00y,
            v0z: p00z,
            v1x: p11x,
            v1y: p11y,
            v1z: p11z,
            v2x: p01x,
            v2y: p01y,
            v2z: p01z,
          },
        );
      }
    }
  }

  if (facets.length === 0) {
    throw new StepSolidWorksExportError(
      "EMPTY_TRIANGLE_MESH",
      "indicesU32",
      0,
      "Mesh buffer contained no valid non-degenerate triangles to export.",
    );
  }

  return facets;
}

/**
 * Converts zero-copy `Float32Array` vertex and `Uint32Array` index buffers from the Rust WASM
 * 3D mesh engine directly into a standard **ASCII `.stl`** file, preserving the deflected
 * Euler-Bernoulli beam geometry ($\Delta < 0$) and active coordinate orientation.
 *
 * @param input - `StlMeshExportInput` containing WASM vertex/index buffers and coordinate mode.
 * @returns `StlAsciiExportResult` containing the ASCII `.stl` content and facet count.
 * @throws {StepSolidWorksExportError} If mesh buffers are empty or out of bounds.
 *
 * @example
 * ```ts
 * const stl = exportDeflectedMeshToAsciiStl({
 *   solidName: "IBDS_WF300_Deflected",
 *   positionsF32: meshViews.positionsF32,
 *   indicesU32: meshViews.indicesU32,
 *   coordinateMode: "Z-Up",
 *   maxDeflectionMm: -14.2,
 * });
 * console.log(stl.facetCount); // e.g. 14280
 * ```
 */
export function exportDeflectedMeshToAsciiStl(input: StlMeshExportInput): StlAsciiExportResult {
  const facets = extractValidatedStlFacets(input);
  const rawName = (input.solidName ?? `IBDS_Deflected_Beam_${input.coordinateMode}`).replace(
    /[^A-Za-z0-9_-]+/g,
    "_",
  );

  const lines: string[] = [`solid ${rawName}`];
  for (const f of facets) {
    lines.push(
      `  facet normal ${f.nx.toExponential(6)} ${f.ny.toExponential(6)} ${f.nz.toExponential(6)}`,
      "    outer loop",
      `      vertex ${f.v0x.toExponential(6)} ${f.v0y.toExponential(6)} ${f.v0z.toExponential(6)}`,
      `      vertex ${f.v1x.toExponential(6)} ${f.v1y.toExponential(6)} ${f.v1z.toExponential(6)}`,
      `      vertex ${f.v2x.toExponential(6)} ${f.v2y.toExponential(6)} ${f.v2z.toExponential(6)}`,
      "    endloop",
      "  endfacet",
    );
  }
  lines.push(`endsolid ${rawName}`, "");

  const slug = rawName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return {
    fileName: `${slug}.stl`,
    mimeType: "model/stl",
    content: lines.join("\n"),
    facetCount: facets.length,
    coordinateMode: input.coordinateMode,
  };
}

/**
 * Converts zero-copy `Float32Array` vertex and `Uint32Array` index buffers from the Rust WASM
 * 3D mesh engine into a compact **IEEE-754 Little-Endian Binary `.stl`** buffer (`Uint8Array`).
 *
 * Binary STL Layout:
 * - Bytes `0..79`: 80-byte ASCII metadata header (coordinate system & signed $\Delta_{\max}$).
 * - Bytes `80..83`: `uint32` little-endian triangle count $N_{\text{tri}}$.
 * - Bytes `84..`: $N_{\text{tri}} \times 50$ bytes (12 `float32` values for normal + 3 vertices, plus 2-byte attribute count `0`).
 *
 * @param input - `StlMeshExportInput` containing WASM vertex/index buffers and coordinate mode.
 * @returns `StlBinaryExportResult` containing the `Uint8Array` binary STL payload and facet count.
 * @throws {StepSolidWorksExportError} If mesh buffers are empty or invalid.
 *
 * @example
 * ```ts
 * const binStl = exportDeflectedMeshToBinaryStl({
 *   positionsF32: meshViews.positionsF32,
 *   indicesU32: meshViews.indicesU32,
 *   coordinateMode: "Y-Up",
 * });
 * console.log(binStl.bytes.byteLength); // 84 + 50 * binStl.facetCount
 * ```
 */
export function exportDeflectedMeshToBinaryStl(input: StlMeshExportInput): StlBinaryExportResult {
  const facets = extractValidatedStlFacets(input);
  const totalBytes = 84 + facets.length * 50;
  const buffer = new ArrayBuffer(totalBytes);
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  const deflStr =
    input.maxDeflectionMm !== undefined
      ? `Defl=${(input.maxDeflectionMm > 0 ? -input.maxDeflectionMm : input.maxDeflectionMm).toFixed(2)}mm`
      : "Defl=0.00mm";
  const headerText = `IBDS Binary STL (${input.coordinateMode}) ${deflStr}`.slice(0, 79);
  for (let i = 0; i < headerText.length; i++) {
    bytes[i] = headerText.charCodeAt(i) & 0x7f;
  }

  // Write uint32 triangle count at byte offset 80
  view.setUint32(80, facets.length, true);

  let offset = 84;
  for (const f of facets) {
    view.setFloat32(offset, f.nx, true);
    view.setFloat32(offset + 4, f.ny, true);
    view.setFloat32(offset + 8, f.nz, true);

    view.setFloat32(offset + 12, f.v0x, true);
    view.setFloat32(offset + 16, f.v0y, true);
    view.setFloat32(offset + 20, f.v0z, true);

    view.setFloat32(offset + 24, f.v1x, true);
    view.setFloat32(offset + 28, f.v1y, true);
    view.setFloat32(offset + 32, f.v1z, true);

    view.setFloat32(offset + 36, f.v2x, true);
    view.setFloat32(offset + 40, f.v2y, true);
    view.setFloat32(offset + 44, f.v2z, true);

    // 2-byte attribute byte count = 0
    view.setUint16(offset + 48, 0, true);
    offset += 50;
  }

  const rawName = (input.solidName ?? `ibds-deflected-beam-${input.coordinateMode}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return {
    fileName: `${rawName}.stl`,
    mimeType: "model/stl",
    bytes,
    facetCount: facets.length,
    coordinateMode: input.coordinateMode,
  };
}

// ============================================================================
// Simulator Store Bridge Helpers
// ============================================================================

/**
 * Convenience bridge that builds an ISO 10303-21 `AP214` (`.step`) solid directly from
 * the active `BeamSimulatorState`.
 *
 * @param state - Active `BeamSimulatorState` snapshot.
 * @returns Generated `StepExportResult` `.step` payload.
 * @throws {StepSolidWorksExportError} If state dimensions or span length are invalid.
 *
 * @example
 * ```ts
 * const stepFile = buildStepAp214FromSimulatorState(useBeamSimulatorStore());
 * ```
 */
export function buildStepAp214FromSimulatorState(state: BeamSimulatorState): StepExportResult {
  const spanM =
    state.loadingMode === "MODE_A_EXTERNAL_LOADS"
      ? Number(state.spanLengthM)
      : Number(state.directSpanLengthM);
  const crossSection = resolveCrossSectionFromSimulatorState(state);

  return exportBeamToStepAp214({
    spanLengthMm: spanM * 1000,
    coordinateMode: state.coordinateMode,
    customUpVector: state.customUpVector,
    crossSection,
    includeConcreteRebars: true,
  });
}

/**
 * Convenience bridge that builds a deflected 3D mesh `.stl` file directly from the active
 * `BeamSimulatorState` and optional zero-copy Rust WASM mesh views. If WASM mesh views are not
 * currently cached (e.g., in Mode B), automatically invokes `solveEulerBernoulliDeflection`
 * with an equivalent uniform load so a valid 3D deflected mesh is always generated.
 *
 * @param state - Active `BeamSimulatorState` snapshot.
 * @param meshViews - Optional pre-computed `ZeroCopyMesh3DViews` from the WASM bridge.
 * @param rebarViews - Optional pre-computed `ZeroCopyRebarCage3DViews` from the WASM bridge.
 * @returns Generated `StlAsciiExportResult` `.stl` payload.
 * @throws {StepSolidWorksExportError} If mesh generation or STL conversion fails.
 */
export function buildStlFromSimulatorState(
  state: BeamSimulatorState,
  meshViews?: ZeroCopyMesh3DViews | null,
  rebarViews?: ZeroCopyRebarCage3DViews | null,
): StlAsciiExportResult {
  const cs = resolveCrossSectionFromSimulatorState(state);
  const solidLabel =
    cs.kind === "CONCRETE_RECT"
      ? (cs.sectionName ?? `RC_${Math.round(cs.bwMm)}x${Math.round(cs.hMm)}`)
      : cs.profileName;

  if (meshViews && meshViews.positionsF32.length >= 9 && meshViews.indicesU32.length >= 3) {
    return exportDeflectedMeshToAsciiStl({
      solidName: `${solidLabel}_${state.coordinateMode}`,
      positionsF32: meshViews.positionsF32,
      indicesU32: meshViews.indicesU32,
      rebarCagePositionsF32: rebarViews?.positionsF32,
      rebarCageIndicesU32: rebarViews?.indicesU32,
      coordinateMode: state.coordinateMode,
      maxDeflectionMm: state.maxDeflectionMm,
    });
  }

  // Synthesize 3D mesh on the fly via Rust WASM solver
  const spanM =
    state.loadingMode === "MODE_A_EXTERNAL_LOADS"
      ? Number(state.spanLengthM)
      : Number(state.directSpanLengthM);

  let extrusionCs: ExtrusionCrossSectionInput;
  if (cs.kind === "STEEL_IWF") {
    extrusionCs = {
      kind: "IWF",
      dMm: cs.dMm,
      bfMm: cs.bfMm,
      twMm: cs.twMm,
      tfMm: cs.tfMm,
      rMm: cs.rMm,
    };
  } else if (cs.kind === "STEEL_BOX") {
    extrusionCs = {
      kind: "BOX",
      hMm: cs.hMm,
      bMm: cs.bMm,
      tMm: cs.tMm,
    };
  } else {
    extrusionCs = {
      kind: "CONCRETE_RECT",
      bwMm: cs.bwMm,
      hMm: cs.hMm,
      rebarCage: {
        coverMm: cs.coverMm,
        stirrupDiaMm: cs.stirrup.diameterMm,
        stirrupSpacingMm: cs.stirrup.spacingMm,
        tensileBarCount: cs.tensileBars.count,
        tensileBarDiaMm: cs.tensileBars.diameterMm,
        compressiveBarCount: cs.compressiveBars.count,
        compressiveBarDiaMm: cs.compressiveBars.diameterMm,
      },
    };
  }

  const synthConfig: ExternalLoadsModeAConfig =
    state.loadingMode === "MODE_A_EXTERNAL_LOADS"
      ? {
          mode: "MODE_A_EXTERNAL_LOADS",
          spanLength: meter(spanM),
          supportOrientation: state.supportOrientation,
          includeSelfWeight: state.includeSelfWeight,
          pointLoads: state.pointLoads,
          distributedLoads: state.distributedLoads,
          appliedMoments: [],
        }
      : {
          mode: "MODE_A_EXTERNAL_LOADS",
          spanLength: meter(spanM),
          supportOrientation: state.supportOrientation,
          includeSelfWeight: false,
          pointLoads: [],
          distributedLoads: [
            {
              id: "Q_EQ",
              magnitude: kilonewtonPerMeter(
                Math.max(1, (8 * Math.abs(Number(state.directMomentMuxKnm))) / (spanM * spanM)),
              ),
              startPosition: meter(0),
              endPosition: meter(spanM),
            },
          ],
          appliedMoments: [],
        };

  const solveRes = solveEulerBernoulliDeflection({
    loadingConfig: synthConfig,
    elasticModulusMpa: state.materialKind === "STEEL" ? 200_000 : 4700 * Math.sqrt(25),
    momentOfInertiaMm4: 100_000_000,
    crossSection: extrusionCs,
    visualScale: 15.0,
    coordinateMode: state.coordinateMode,
  });

  if (!solveRes.mesh3D) {
    throw new StepSolidWorksExportError(
      "EMPTY_TRIANGLE_MESH",
      "solveRes.mesh3D",
      null,
      "Rust WASM solver did not return a 3D mesh buffer for STL export.",
    );
  }

  return exportDeflectedMeshToAsciiStl({
    solidName: `${solidLabel}_${state.coordinateMode}`,
    positionsF32: solveRes.mesh3D.positionsF32,
    indicesU32: solveRes.mesh3D.indicesU32,
    rebarCagePositionsF32: solveRes.rebarCage3D?.positionsF32,
    rebarCageIndicesU32: solveRes.rebarCage3D?.indicesU32,
    coordinateMode: state.coordinateMode,
    maxDeflectionMm: solveRes.maxDeflectionMm,
  });
}
