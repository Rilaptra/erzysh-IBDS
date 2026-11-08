/**
 * @file ifc4-bim-revit-exporter.ts
 * @description Native ISO 16739 IFC4 (STEP Physical File `.ifc`) and Autodesk Revit Family
 * Type Catalog (`.txt`) exporter for the Interactive Beam Deflection & Structural Design Simulator.
 *
 * Generates standard-compliant BIM models directly openable in **Autodesk Revit**,
 * **Tekla Structures**, **ArchiCAD**, and **IDEA StatiCa**:
 * - **Steel IWF Beams:** Parametric `IFCISHAPEPROFILEDEF` (`IFCIISHAPEPROFILEDEF`) extruded via `IFCEXTRUDEDAREASOLID`.
 * - **Steel BOX (PSR) Beams:** Parametric `IFCRECTANGLEHOLLOWPROFILEDEF` with inner/outer fillet radii ($r_{\text{in}} = t, r_{\text{out}} = 2t$).
 * - **Reinforced Concrete Beams:** `IFCRECTANGLEPROFILEDEF` concrete body ($b_w \times h$) aggregated with 3D `IFCREINFORCINGBAR` entities for tensile bars ($A_s$), compressive bars ($A'_s$), and closed shear stirrup hoops along span $L$.
 * - **Dynamic Coordinate System Support:** Respects user-selected `Z-Up`, `Y-Up`, or `CustomXYZ` orientation matrices.
 */

import rawBoxCatalog from "@/data/steel-box-catalog.json";
import rawIwfCatalog from "@/data/steel-iwf-catalog.json";
import rawSteelGrades from "@/data/steel-material-grades.json";
import type { BeamSimulatorState } from "@/state/beam-simulator-store";
import type { SupportOrientation } from "@/types/beam-loading-modes";
import {
  COORDINATE_TRANSFORMS,
  type CoordinateSystemMode,
  type Matrix3x3,
  type Vector3D,
} from "@/types/branded-units";
import type { RebarSteelGrade } from "@/types/concrete-sni2847-types";
import type {
  BoxPrimaryDimensions,
  IwfPrimaryDimensions,
  SteelGrade,
  SteelGradeProperties,
} from "@/types/steel-sni1729-types";

// ============================================================================
// Structured Error Handling & Traceback Diagnostics
// ============================================================================

/**
 * Enumeration of machine-readable error codes emitted by the IFC4 / Revit BIM exporter.
 */
export type Ifc4ExportErrorCode =
  | "INVALID_SPAN_LENGTH"
  | "INVALID_SECTION_DIMENSIONS"
  | "INVALID_REBAR_CONFIGURATION"
  | "INVALID_COORDINATE_FRAME"
  | "ENTITY_REFERENCE_ERROR"
  | "UNSUPPORTED_SECTION_KIND";

/**
 * Structured error class thrown when IFC4 or Revit Type Catalog generation fails validation
 * or encounters invalid geometric/structural parameters. Includes full diagnostic metadata
 * for deterministic debugging and stack traceback.
 */
export class Ifc4ExportError extends Error {
  /** Machine-readable error classification code. */
  public readonly code: Ifc4ExportErrorCode;
  /** Name of the input field or parameter that triggered the error. */
  public readonly fieldName: string;
  /** Invalid value or diagnostic payload captured at failure time. */
  public readonly invalidValue: unknown;
  /** ISO-8601 timestamp when the exception was instantiated. */
  public readonly timestampIso: string;

  /**
   * Constructs a new `Ifc4ExportError` with full traceback context.
   *
   * @param code - Machine-readable error code (`Ifc4ExportErrorCode`).
   * @param fieldName - Offending parameter path (e.g., `"crossSection.dMm"`).
   * @param invalidValue - The rejected runtime value (e.g., `-100` or `NaN`).
   * @param message - Human-readable engineering explanation of the failure and how to fix it.
   *
   * @example
   * ```ts
   * throw new Ifc4ExportError(
   *   "INVALID_SPAN_LENGTH",
   *   "spanLengthMm",
   *   0,
   *   "Beam span length must be a finite positive number in millimeters (L > 0).",
   * );
   * ```
   */
  constructor(
    code: Ifc4ExportErrorCode,
    fieldName: string,
    invalidValue: unknown,
    message: string,
  ) {
    super(
      `[Ifc4ExportError:${code}] Field '${fieldName}' (value: ${JSON.stringify(invalidValue)}): ${message}`,
    );
    this.name = "Ifc4ExportError";
    this.code = code;
    this.fieldName = fieldName;
    this.invalidValue = invalidValue;
    this.timestampIso = new Date().toISOString();
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, Ifc4ExportError);
    }
  }
}

// ============================================================================
// Coordinate Frame & Input Data Contracts
// ============================================================================

/**
 * Orthonormal 3D coordinate basis mapping intrinsic beam axes $(s, u, v)$ into global $(X, Y, Z)$ space.
 */
export interface ExportCoordinateFrame3D {
  /** Active coordinate mode identifier (`"Z-Up"`, `"Y-Up"`, or `"CustomXYZ"`). */
  readonly mode: CoordinateSystemMode;
  /** Unit vector $\hat{\mathbf{e}}_s$ along beam longitudinal span ($s: 0 \to L$). */
  readonly spanAxis: Vector3D;
  /** Unit vector $\hat{\mathbf{e}}_u$ along cross-section horizontal width ($B$ or $b_w$). */
  readonly widthAxis: Vector3D;
  /** Unit vector $\hat{\mathbf{e}}_v$ along cross-section vertical upward depth ($H$ or $h$; downward deflection is $-\hat{\mathbf{e}}_v$). */
  readonly verticalAxis: Vector3D;
  /** Orthogonal $3 \times 3$ transformation matrix $\mathbf{P}_{\text{axis}}$. */
  readonly matrix: Matrix3x3;
}

/**
 * Parametric Steel Wide Flange (IWF) section specification for IFC4 export.
 */
export interface Ifc4SteelIwfSectionInput {
  readonly kind: "STEEL_IWF";
  /** Profile designation label (e.g., `"WF 300 x 150 x 36.7"`). */
  readonly profileName: string;
  /** Overall section depth $H$ ($d$) in millimeters ($\text{mm}$). */
  readonly dMm: number;
  /** Overall flange width $B$ ($b_f$) in millimeters ($\text{mm}$). */
  readonly bfMm: number;
  /** Web thickness $t_w$ in millimeters ($\text{mm}$). */
  readonly twMm: number;
  /** Flange thickness $t_f$ in millimeters ($\text{mm}$). */
  readonly tfMm: number;
  /** Root fillet radius $r$ in millimeters ($\text{mm}$). */
  readonly rMm: number;
  /** Indonesian structural steel grade (`BJ_34` to `BJ_55`). */
  readonly steelGrade: SteelGrade;
  /** Optional specified minimum yield stress $f_y$ in $\text{MPa}$. */
  readonly fyMpa?: number;
  /** Optional specified minimum tensile strength $f_u$ in $\text{MPa}$. */
  readonly fuMpa?: number;
}

/**
 * Parametric Steel Hollow Structural Section (BOX / PSR) specification for IFC4 export.
 */
export interface Ifc4SteelBoxSectionInput {
  readonly kind: "STEEL_BOX";
  /** Profile designation label (e.g., `"BOX 200 x 200 x 8.0"`). */
  readonly profileName: string;
  /** Overall height $H$ in millimeters ($\text{mm}$). */
  readonly hMm: number;
  /** Overall width $B$ in millimeters ($\text{mm}$). */
  readonly bMm: number;
  /** Uniform wall thickness $t$ in millimeters ($\text{mm}$). */
  readonly tMm: number;
  /** Optional inner corner fillet radius $r_{\text{in}}$ in $\text{mm}$ (defaults to $t$ per JIS G 3466). */
  readonly innerFilletRadiusMm?: number;
  /** Optional outer corner fillet radius $r_{\text{out}}$ in $\text{mm}$ (defaults to $2t$ per JIS G 3466). */
  readonly outerFilletRadiusMm?: number;
  /** Indonesian structural steel grade (`BJ_34` to `BJ_55`). */
  readonly steelGrade: SteelGrade;
  /** Optional specified minimum yield stress $f_y$ in $\text{MPa}$. */
  readonly fyMpa?: number;
  /** Optional specified minimum tensile strength $f_u$ in $\text{MPa}$. */
  readonly fuMpa?: number;
}

/**
 * Parametric Reinforced Concrete rectangular section + 3D rebar cage specification for IFC4 export.
 */
export interface Ifc4ConcreteSectionInput {
  readonly kind: "CONCRETE_RECT";
  /** Optional section designation label (defaults to `"RC {bw}x{h}"`). */
  readonly sectionName?: string;
  /** Beam web width $b_w$ in millimeters ($\text{mm}$). */
  readonly bwMm: number;
  /** Total beam depth $h$ in millimeters ($\text{mm}$). */
  readonly hMm: number;
  /** Concrete clear cover $c_c$ in millimeters ($\text{mm}$). */
  readonly coverMm: number;
  /** Cylinder compressive strength $f'_c$ in $\text{MPa}$. */
  readonly fcMpa: number;
  /** Longitudinal rebar steel grade (`BJTS_40`, `BJTS_50`, etc.). */
  readonly longitudinalRebarGrade: RebarSteelGrade;
  /** Transverse stirrup steel grade (`BJTP_24`, `BJTS_40`, etc.). */
  readonly stirrupRebarGrade: RebarSteelGrade;
  /** Bottom tensile reinforcement ($A_s$) configuration. */
  readonly tensileBars: {
    /** Total number of bottom tensile bars ($n \ge 2$). */
    readonly count: number;
    /** Nominal bar diameter $d_b$ in $\text{mm}$. */
    readonly diameterMm: number;
    /** Number of horizontal rebar layers (defaults to `1`). */
    readonly layers?: number;
  };
  /** Top compressive / hanger reinforcement ($A'_s$) configuration. */
  readonly compressiveBars: {
    /** Total number of top bars ($n \ge 2$). */
    readonly count: number;
    /** Nominal bar diameter $d'_b$ in $\text{mm}$. */
    readonly diameterMm: number;
  };
  /** Transverse closed shear stirrup configuration. */
  readonly stirrup: {
    /** Number of vertical stirrup legs (typically `2` or `4`). */
    readonly legs: number;
    /** Stirrup wire diameter $d_s$ in $\text{mm}$. */
    readonly diameterMm: number;
    /** Center-to-center longitudinal stirrup spacing $s$ in $\text{mm}$. */
    readonly spacingMm: number;
  };
}

/**
 * Discriminated union of all structural cross-sections supported by the IFC4 BIM exporter.
 */
export type Ifc4CrossSectionInput =
  Ifc4SteelIwfSectionInput | Ifc4SteelBoxSectionInput | Ifc4ConcreteSectionInput;

/**
 * Optional structural analysis summary embedded into `Pset_IBDS_StructuralAnalysis` inside the IFC4 file.
 */
export interface Ifc4StructuralAnalysisSummary {
  /** Signed maximum vertical deflection $\Delta_{\max}$ in $\text{mm}$ ($\le 0$ for downward deflection). */
  readonly maxDeflectionMm: number;
  /** Governing factored strong-axis bending moment $M_{ux}$ in $\text{kNm}$. */
  readonly factoredMuxKnm?: number;
  /** Governing factored weak-axis bending moment $M_{uy}$ in $\text{kNm}$. */
  readonly factoredMuyKnm?: number;
  /** Governing factored shear force $V_u$ in $\text{kN}$. */
  readonly factoredVuKn?: number;
  /** Governing factored axial force $P_u$ in $\text{kN}$. */
  readonly factoredPuKn?: number;
  /** Governing factored torsional moment $T_u$ in $\text{kNm}$. */
  readonly factoredTuKnm?: number;
  /** Governing Demand-to-Capacity Ratio ($\text{DCR} \ge 0$). */
  readonly governingDcr?: number;
}

/**
 * Complete input configuration for `exportBeamToIfc4` and `exportRevitFamilyTypeCatalogTxt`.
 */
export interface Ifc4BeamExportInput {
  /** Project name stored in `IFCPROJECT` (defaults to `"IBDS Structural Design Project"`). */
  readonly projectName?: string;
  /** Unique element tag / mark for `IFCBEAM` (defaults to `"B-101"`). */
  readonly beamTag?: string;
  /** Clear span length $L$ in millimeters ($\text{mm}$, must be $> 0$). */
  readonly spanLengthMm: number;
  /** Active boundary support condition orientation. */
  readonly supportOrientation: SupportOrientation;
  /** Active 3D coordinate system orientation (`"Z-Up"`, `"Y-Up"`, or `"CustomXYZ"`). */
  readonly coordinateMode: CoordinateSystemMode;
  /** Optional custom Up-axis vector when `coordinateMode === "CustomXYZ"`. */
  readonly customUpVector?: Vector3D;
  /** Optional explicit $3 \times 3$ orthogonal permutation matrix. */
  readonly customMatrix?: Matrix3x3;
  /** Cross-section geometry and material specification. */
  readonly crossSection: Ifc4CrossSectionInput;
  /** Optional structural analysis results attached as IFC property sets. */
  readonly analysisSummary?: Ifc4StructuralAnalysisSummary;
  /** Optional author name for `IFCOWNERHISTORY` header. */
  readonly authorName?: string;
  /** Optional organization name for `IFCOWNERHISTORY` header. */
  readonly organizationName?: string;
  /** Optional fixed ISO-8601 timestamp string for deterministic snapshot testing. */
  readonly timestampIso?: string;
}

/**
 * Output payload returned by `exportBeamToIfc4`.
 */
export interface Ifc4ExportResult {
  /** Recommended download file name ending with `.ifc`. */
  readonly fileName: string;
  /** Standard MIME type for IFC STEP Physical Files (`"application/x-step"`). */
  readonly mimeType: "application/x-step";
  /** Complete ASCII ISO-10303-21 IFC4 file content. */
  readonly content: string;
  /** Total number of `#N` STEP entities emitted in the `DATA` section. */
  readonly entityCount: number;
  /** Schema identifier (`"IFC4"`). */
  readonly schemaVersion: "IFC4";
  /** Active coordinate system orientation applied to the 3D placements. */
  readonly coordinateMode: CoordinateSystemMode;
}

/**
 * Output payload returned by `exportRevitFamilyTypeCatalogTxt`.
 */
export interface RevitTypeCatalogExportResult {
  /** Recommended download file name ending with `.txt`. */
  readonly fileName: string;
  /** Standard MIME type for Revit Type Catalog files (`"text/plain;charset=utf-8"`). */
  readonly mimeType: "text/plain;charset=utf-8";
  /** Comma-delimited Revit Family Type Catalog text content. */
  readonly content: string;
  /** Number of family type rows emitted. */
  readonly typeCount: number;
  /** Active coordinate system orientation noted in metadata. */
  readonly coordinateMode: CoordinateSystemMode;
}

// ============================================================================
// Internal Geometric & Formatting Helpers
// ============================================================================

/**
 * Formats a floating-point number into STEP/IFC real literal syntax (always includes decimal point).
 *
 * @param value - Numeric value to format.
 * @param decimals - Number of decimal digits (default `4`).
 * @returns Formatted STEP real literal string (e.g., `"300."` or `"12.5"`).
 *
 * @example
 * ```ts
 * formatStepReal(300); // "300."
 * formatStepReal(6.5); // "6.5"
 * ```
 */
function formatStepReal(value: number, decimals = 4): string {
  if (!Number.isFinite(value)) {
    return "0.";
  }
  const normalized = Math.abs(value) < 1e-10 ? 0 : value;
  const fixed = normalized.toFixed(decimals).replace(/0+$/, "");
  return fixed.endsWith(".") ? fixed : fixed;
}

/**
 * Escapes single quotes and unsafe characters for STEP string literals `'...'`.
 *
 * @param text - Raw string value.
 * @returns Sanitized string safe for wrapping inside `'...'`.
 */
function sanitizeStepString(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/'/g, "''").trim();
}

/**
 * Generates a deterministic 22-character IFC Base64 GlobalUniqueId (`IfcGloballyUniqueId`)
 * from a seed string so that identical structural inputs produce reproducible IFC files.
 *
 * @param seed - Unique deterministic string seed (e.g., `"PROJECT:B-101:BEAM"`).
 * @returns 22-character IFC Base64 GUID string.
 *
 * @example
 * ```ts
 * const guid = generateDeterministicIfcGuid("IBDS:IFCBEAM:B-101");
 * // e.g. "2O2Fr$t4X7Zf8NOew3FNr2" (length === 22)
 * ```
 */
export function generateDeterministicIfcGuid(seed: string): string {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$";
  let h1 = 0x811c9dc5;
  let h2 = 0xcbf29ce4;
  for (let i = 0; i < seed.length; i++) {
    const code = seed.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= code + i * 31;
    h2 = Math.imul(h2, 0x1000193b);
  }

  let out = chars.charAt(Math.abs(h1) % 4); // First character in IFC GUID is restricted to 0..3
  let stateA = h1 >>> 0;
  let stateB = h2 >>> 0;
  for (let i = 1; i < 22; i++) {
    stateA = (Math.imul(stateA, 1664525) + 1013904223) >>> 0;
    stateB = (Math.imul(stateB, 22695477) + 1) >>> 0;
    const idx = (stateA ^ (stateB >>> 3) ^ i) & 63;
    out += chars.charAt(idx);
  }
  return out;
}

/**
 * Computes the cross product $\mathbf{a} \times \mathbf{b}$ of two 3D vectors.
 *
 * @param a - First 3D vector.
 * @param b - Second 3D vector.
 * @returns Cross product vector $\mathbf{a} \times \mathbf{b}$.
 */
function crossProduct3D(a: Vector3D, b: Vector3D): Vector3D {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

/**
 * Normalizes a 3D vector to unit length, throwing `Ifc4ExportError` if degenerate.
 *
 * @param v - Input 3D vector.
 * @param label - Field name for error reporting.
 * @returns Unit 3D vector.
 * @throws {Ifc4ExportError} If vector length is near zero or non-finite.
 */
function normalizeVector3D(v: Vector3D, label: string): Vector3D {
  const len = Math.hypot(v.x, v.y, v.z);
  if (!Number.isFinite(len) || len < 1e-9) {
    throw new Ifc4ExportError(
      "INVALID_COORDINATE_FRAME",
      label,
      v,
      "Coordinate axis vector cannot have zero or non-finite magnitude.",
    );
  }
  return {
    x: v.x / len,
    y: v.y / len,
    z: v.z / len,
  };
}

/**
 * Resolves the orthonormal 3D coordinate basis for the active user-selected coordinate system
 * (`"Z-Up"`, `"Y-Up"`, or `"CustomXYZ"`).
 *
 * Right-handed extrusion basis convention:
 * - `spanAxis` ($\hat{\mathbf{e}}_s$): Direction of beam extrusion ($0 \to L$).
 * - `verticalAxis` ($\hat{\mathbf{e}}_v$): Cross-section local $+Y$ (upward height $H/h$; downward gravity deflection is $-\hat{\mathbf{e}}_v$).
 * - `widthAxis` ($\hat{\mathbf{e}}_u = \hat{\mathbf{e}}_v \times \hat{\mathbf{e}}_s$): Cross-section local $+X$ (flange/web width $B/b_w$) such that $\hat{\mathbf{e}}_s \times \hat{\mathbf{e}}_u = \hat{\mathbf{e}}_v$.
 *
 * @param mode - Active coordinate system mode (`"Z-Up"`, `"Y-Up"`, or `"CustomXYZ"`).
 * @param customUpVector - Optional custom Up-axis vector when `mode === "CustomXYZ"`.
 * @param customMatrix - Optional explicit $3 \times 3$ orthogonal matrix.
 * @returns Validated orthonormal `ExportCoordinateFrame3D`.
 * @throws {Ifc4ExportError} If custom vectors are collinear or non-finite.
 *
 * @example
 * ```ts
 * const frameZ = resolveExportCoordinateFrame("Z-Up");
 * // frameZ.spanAxis = { x: 1, y: 0, z: 0 }
 * // frameZ.verticalAxis = { x: 0, y: 0, z: 1 }
 * // frameZ.widthAxis = { x: 0, y: 1, z: 0 }
 * ```
 */
export function resolveExportCoordinateFrame(
  mode: CoordinateSystemMode,
  customUpVector?: Vector3D,
  customMatrix?: Matrix3x3,
): ExportCoordinateFrame3D {
  if (mode === "Z-Up" && !customMatrix) {
    return {
      mode: "Z-Up",
      spanAxis: { x: 1, y: 0, z: 0 },
      widthAxis: { x: 0, y: 1, z: 0 },
      verticalAxis: { x: 0, y: 0, z: 1 },
      matrix: COORDINATE_TRANSFORMS["Z-Up"],
    };
  }

  if (mode === "Y-Up" && !customMatrix) {
    return {
      mode: "Y-Up",
      spanAxis: { x: 1, y: 0, z: 0 },
      widthAxis: { x: 0, y: 0, z: -1 },
      verticalAxis: { x: 0, y: 1, z: 0 },
      matrix: [
        [1, 0, 0],
        [0, 0, 1],
        [0, -1, 0],
      ],
    };
  }

  if (customMatrix) {
    const rawSpan: Vector3D = {
      x: customMatrix[0][0],
      y: customMatrix[1][0],
      z: customMatrix[2][0],
    };
    const rawVert: Vector3D = {
      x: customMatrix[0][2],
      y: customMatrix[1][2],
      z: customMatrix[2][2],
    };
    const spanAxis = normalizeVector3D(rawSpan, "customMatrix.spanAxis");
    const widthRaw = crossProduct3D(rawVert, spanAxis);
    const widthAxis = normalizeVector3D(widthRaw, "customMatrix.widthAxis");
    const verticalAxis = normalizeVector3D(
      crossProduct3D(spanAxis, widthAxis),
      "customMatrix.verticalAxis",
    );
    return {
      mode,
      spanAxis,
      widthAxis,
      verticalAxis,
      matrix: [
        [spanAxis.x, widthAxis.x, verticalAxis.x],
        [spanAxis.y, widthAxis.y, verticalAxis.y],
        [spanAxis.z, widthAxis.z, verticalAxis.z],
      ],
    };
  }

  // CustomXYZ using customUpVector
  const upVec = normalizeVector3D(customUpVector ?? { x: 0, y: 0, z: 1 }, "customUpVector");
  // Choose primary span reference along global X unless collinear with upVec
  const refSpan: Vector3D = Math.abs(upVec.x) > 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  const widthAxis = normalizeVector3D(crossProduct3D(upVec, refSpan), "CustomXYZ.widthAxis");
  const spanAxis = normalizeVector3D(crossProduct3D(widthAxis, upVec), "CustomXYZ.spanAxis");
  const verticalAxis = normalizeVector3D(
    crossProduct3D(spanAxis, widthAxis),
    "CustomXYZ.verticalAxis",
  );

  return {
    mode: "CustomXYZ",
    spanAxis,
    widthAxis,
    verticalAxis,
    matrix: [
      [spanAxis.x, widthAxis.x, verticalAxis.x],
      [spanAxis.y, widthAxis.y, verticalAxis.y],
      [spanAxis.z, widthAxis.z, verticalAxis.z],
    ],
  };
}

/**
 * Maps intrinsic beam coordinates $(s, u, v)$ in millimeters into global 3D coordinates $(X, Y, Z)$
 * according to the active `ExportCoordinateFrame3D`.
 *
 * @param sMm - Longitudinal station coordinate along beam span ($0 \le s \le L$) in $\text{mm}$.
 * @param uMm - Transverse horizontal offset across section width ($-B/2 \le u \le +B/2$) in $\text{mm}$.
 * @param vMm - Vertical offset across section depth ($-H/2 \le v \le +H/2$) in $\text{mm}$.
 * @param frame - Active orthonormal 3D coordinate frame.
 * @returns Global 3D coordinate vector `{ x, y, z }` in $\text{mm}$.
 *
 * @example
 * ```ts
 * const frame = resolveExportCoordinateFrame("Z-Up");
 * const pt = mapIntrinsicToGlobal(3000, 75, -150, frame);
 * // pt = { x: 3000, y: 75, z: -150 }
 * ```
 */
export function mapIntrinsicToGlobal(
  sMm: number,
  uMm: number,
  vMm: number,
  frame: ExportCoordinateFrame3D,
): Vector3D {
  return {
    x: sMm * frame.spanAxis.x + uMm * frame.widthAxis.x + vMm * frame.verticalAxis.x,
    y: sMm * frame.spanAxis.y + uMm * frame.widthAxis.y + vMm * frame.verticalAxis.y,
    z: sMm * frame.spanAxis.z + uMm * frame.widthAxis.z + vMm * frame.verticalAxis.z,
  };
}

// ============================================================================
// Input Validation Guard Clauses
// ============================================================================

/**
 * Validates all geometric and physical invariants of an `Ifc4BeamExportInput` payload.
 *
 * @param input - Beam export configuration to validate.
 * @throws {Ifc4ExportError} When any span or cross-section dimension is invalid.
 */
function validateIfc4BeamExportInput(input: Ifc4BeamExportInput): void {
  if (!Number.isFinite(input.spanLengthMm) || input.spanLengthMm <= 0) {
    throw new Ifc4ExportError(
      "INVALID_SPAN_LENGTH",
      "spanLengthMm",
      input.spanLengthMm,
      "Beam span length L must be a finite positive number in millimeters (e.g., 6000).",
    );
  }

  const cs = input.crossSection;
  switch (cs.kind) {
    case "STEEL_IWF": {
      if (
        !Number.isFinite(cs.dMm) ||
        cs.dMm <= 0 ||
        !Number.isFinite(cs.bfMm) ||
        cs.bfMm <= 0 ||
        !Number.isFinite(cs.twMm) ||
        cs.twMm <= 0 ||
        !Number.isFinite(cs.tfMm) ||
        cs.tfMm <= 0 ||
        !Number.isFinite(cs.rMm) ||
        cs.rMm < 0
      ) {
        throw new Ifc4ExportError(
          "INVALID_SECTION_DIMENSIONS",
          "crossSection",
          cs,
          "IWF profile dimensions (dMm, bfMm, twMm, tfMm) must be > 0 and rMm >= 0.",
        );
      }
      if (2 * cs.tfMm >= cs.dMm || cs.twMm >= cs.bfMm) {
        throw new Ifc4ExportError(
          "INVALID_SECTION_DIMENSIONS",
          "crossSection",
          cs,
          `IWF flange thickness (2*tf=${2 * cs.tfMm} mm) cannot exceed depth (d=${cs.dMm} mm), and web thickness (tw=${cs.twMm} mm) cannot exceed width (bf=${cs.bfMm} mm).`,
        );
      }
      break;
    }
    case "STEEL_BOX": {
      if (
        !Number.isFinite(cs.hMm) ||
        cs.hMm <= 0 ||
        !Number.isFinite(cs.bMm) ||
        cs.bMm <= 0 ||
        !Number.isFinite(cs.tMm) ||
        cs.tMm <= 0
      ) {
        throw new Ifc4ExportError(
          "INVALID_SECTION_DIMENSIONS",
          "crossSection",
          cs,
          "BOX profile dimensions (hMm, bMm, tMm) must be strictly positive numbers.",
        );
      }
      if (2 * cs.tMm >= Math.min(cs.hMm, cs.bMm)) {
        throw new Ifc4ExportError(
          "INVALID_SECTION_DIMENSIONS",
          "crossSection",
          cs,
          `BOX wall thickness (2*t=${2 * cs.tMm} mm) must be strictly less than outer width/height (${Math.min(cs.hMm, cs.bMm)} mm).`,
        );
      }
      break;
    }
    case "CONCRETE_RECT": {
      if (
        !Number.isFinite(cs.bwMm) ||
        cs.bwMm <= 0 ||
        !Number.isFinite(cs.hMm) ||
        cs.hMm <= 0 ||
        !Number.isFinite(cs.coverMm) ||
        cs.coverMm <= 0 ||
        2 * cs.coverMm >= Math.min(cs.bwMm, cs.hMm)
      ) {
        throw new Ifc4ExportError(
          "INVALID_SECTION_DIMENSIONS",
          "crossSection",
          cs,
          "Concrete section dimensions (bwMm, hMm, coverMm) must be > 0 and 2*coverMm < min(bwMm, hMm).",
        );
      }
      if (
        cs.tensileBars.count < 1 ||
        cs.tensileBars.diameterMm <= 0 ||
        cs.compressiveBars.count < 0 ||
        cs.stirrup.diameterMm <= 0 ||
        cs.stirrup.spacingMm <= 0
      ) {
        throw new Ifc4ExportError(
          "INVALID_REBAR_CONFIGURATION",
          "crossSection.tensileBars/stirrup",
          cs,
          "Concrete reinforcement requires >= 1 tensile bar and positive bar/stirrup diameters and spacing.",
        );
      }
      break;
    }
    default: {
      const exhaustive: never = cs;
      throw new Ifc4ExportError(
        "UNSUPPORTED_SECTION_KIND",
        "crossSection.kind",
        exhaustive,
        "Unsupported cross-section kind provided to IFC4 exporter.",
      );
    }
  }
}

// ============================================================================
// Sequential STEP Entity Graph Builder
// ============================================================================

/**
 * Internal helper class that manages sequential `#1, #2, ...` STEP entity IDs and lines.
 */
class StepEntityGraphBuilder {
  private readonly lines: string[] = [];
  private nextId = 1;

  /**
   * Appends a STEP entity definition and returns its `#ID` reference token.
   *
   * @param entityStatement - Entity expression without leading `#ID = ` or trailing `;`.
   * @param inlineComment - Optional inline STEP comment `/* ... *\/`.
   * @returns Reference string such as `"#12"`.
   */
  public add(entityStatement: string, inlineComment?: string): string {
    const idRef = `#${this.nextId++}`;
    const commentPrefix = inlineComment ? `/* ${inlineComment} */ ` : "";
    this.lines.push(`${idRef}= ${commentPrefix}${entityStatement};`);
    return idRef;
  }

  /**
   * Formats a 3D `IFCCARTESIANPOINT` entity.
   *
   * @param pt - 3D coordinates `{ x, y, z }` in $\text{mm}$.
   * @returns `#ID` reference to the created `IFCCARTESIANPOINT`.
   */
  public addPoint3D(pt: Vector3D): string {
    return this.add(
      `IFCCARTESIANPOINT((${formatStepReal(pt.x)},${formatStepReal(pt.y)},${formatStepReal(pt.z)}))`,
    );
  }

  /**
   * Formats a 2D `IFCCARTESIANPOINT` entity.
   *
   * @param x - 2D X coordinate in $\text{mm}$.
   * @param y - 2D Y coordinate in $\text{mm}$.
   * @returns `#ID` reference to the created `IFCCARTESIANPOINT`.
   */
  public addPoint2D(x: number, y: number): string {
    return this.add(`IFCCARTESIANPOINT((${formatStepReal(x)},${formatStepReal(y)}))`);
  }

  /**
   * Formats a 3D `IFCDIRECTION` entity.
   *
   * @param dir - 3D unit vector `{ x, y, z }`.
   * @returns `#ID` reference to the created `IFCDIRECTION`.
   */
  public addDirection3D(dir: Vector3D): string {
    return this.add(
      `IFCDIRECTION((${formatStepReal(dir.x, 6)},${formatStepReal(dir.y, 6)},${formatStepReal(dir.z, 6)}))`,
    );
  }

  /**
   * Returns total number of entities allocated so far.
   */
  public get count(): number {
    return this.nextId - 1;
  }

  /**
   * Serializes all allocated entities into a newline-joined `DATA` block string.
   */
  public serializeLines(): string {
    return this.lines.join("\n");
  }
}

// ============================================================================
// Core IFC4 BIM Exporter (`exportBeamToIfc4`)
// ============================================================================

/**
 * Generates an ISO 16739 `IFC4` (`.ifc`) STEP Physical File representing the 3D structural beam,
 * parametric cross-section profile (`IFCISHAPEPROFILEDEF`, `IFCRECTANGLEHOLLOWPROFILEDEF`, or
 * `IFCRECTANGLEPROFILEDEF`), 3D reinforcement bars (`IFCREINFORCINGBAR` for concrete), material
 * definitions, and structural analysis property sets.
 *
 * @param input - Validated `Ifc4BeamExportInput` containing geometry, material, analysis results, and coordinate mode.
 * @returns `Ifc4ExportResult` containing the `.ifc` text content, recommended filename, and entity count.
 * @throws {Ifc4ExportError} If span length, cross-section dimensions, or coordinate axes are invalid.
 *
 * @example
 * ```ts
 * const result = exportBeamToIfc4({
 *   beamTag: "B-IWF-300",
 *   spanLengthMm: 6000,
 *   supportOrientation: "PINNED_ROLLER",
 *   coordinateMode: "Z-Up",
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
 *   analysisSummary: {
 *     maxDeflectionMm: -11.45,
 *     factoredMuxKnm: 142.5,
 *     factoredVuKn: 95.0,
 *     governingDcr: 0.92,
 *   },
 * });
 * console.log(result.fileName); // "ibds-beam-wf-300-x-150-x-36-7-z-up.ifc"
 * ```
 */
export function exportBeamToIfc4(input: Ifc4BeamExportInput): Ifc4ExportResult {
  validateIfc4BeamExportInput(input);

  const frame = resolveExportCoordinateFrame(
    input.coordinateMode,
    input.customUpVector,
    input.customMatrix,
  );

  const g = new StepEntityGraphBuilder();
  const projectName = sanitizeStepString(input.projectName ?? "IBDS Structural Design Project");
  const beamTag = sanitizeStepString(input.beamTag ?? "B-101");
  const author = sanitizeStepString(input.authorName ?? "IBDS Structural Engineer");
  const organization = sanitizeStepString(
    input.organizationName ?? "Interactive Beam Deflection Simulator (SNI 2847 & SNI 1729)",
  );
  const isoTimestamp = (input.timestampIso ?? new Date().toISOString()).slice(0, 19);
  const unixTimestamp = Math.floor(Date.parse(input.timestampIso ?? "2026-11-06T00:00:00Z") / 1000);

  // 1. Ownership & Application Metadata
  const personId = g.add(`IFCPERSON($,'${author}',$,$,$,$,$,$)`);
  const orgId = g.add(`IFCORGANIZATION($,'${organization}',$,$,$)`);
  const personAndOrgId = g.add(`IFCPERSONANDORGANIZATION(${personId},${orgId},$)`);
  const appId = g.add(`IFCAPPLICATION(${orgId},'0.5.0','IBDS Native IFC4 Exporter','IBDS-IFC4')`);
  const ownerHistoryId = g.add(
    `IFCOWNERHISTORY(${personAndOrgId},${appId},$,.NOCHANGE.,$,$,$,${Number.isFinite(unixTimestamp) ? unixTimestamp : 1793923200})`,
  );

  // 2. SI Units Assignment (Millimeters for geometry, kN/kNm for structural properties)
  const unitLengthId = g.add(`IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.)`);
  const unitAreaId = g.add(`IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)`);
  const unitVolumeId = g.add(`IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)`);
  const unitAngleId = g.add(`IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.)`);
  const unitMassId = g.add(`IFCSIUNIT(*,.MASSUNIT.,.KILO.,.GRAM.)`);
  const unitForceId = g.add(`IFCSIUNIT(*,.FORCEUNIT.,.KILO.,.NEWTON.)`);
  const unitAssignmentId = g.add(
    `IFCUNITASSIGNMENT((${unitLengthId},${unitAreaId},${unitVolumeId},${unitAngleId},${unitMassId},${unitForceId}))`,
  );

  // 3. Global World Coordinate System & Representation Contexts
  const origin3DId = g.addPoint3D({ x: 0, y: 0, z: 0 });
  const dirGlobalZId = g.addDirection3D({ x: 0, y: 0, z: 1 });
  const dirGlobalXId = g.addDirection3D({ x: 1, y: 0, z: 0 });
  const worldPlacement3DId = g.add(
    `IFCAXIS2PLACEMENT3D(${origin3DId},${dirGlobalZId},${dirGlobalXId})`,
  );

  const geomContextId = g.add(
    `IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.0E-5,${worldPlacement3DId},$)`,
  );
  const bodySubContextId = g.add(
    `IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Body','Model',*,*,*,*,${geomContextId},$,.MODEL_VIEW.,$)`,
  );
  const axisSubContextId = g.add(
    `IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Axis','Model',*,*,*,*,${geomContextId},$,.GRAPH_VIEW.,$)`,
  );

  // 4. Spatial Hierarchy: Project -> Site -> Building -> BuildingStorey
  const projectId = g.add(
    `IFCPROJECT('${generateDeterministicIfcGuid(`PROJ:${projectName}`)}',${ownerHistoryId},'${projectName}','Structural Beam Model (${frame.mode})',$,$,$,(${geomContextId}),${unitAssignmentId})`,
  );
  const sitePlacementId = g.add(`IFCLOCALPLACEMENT($,${worldPlacement3DId})`);
  const siteId = g.add(
    `IFCSITE('${generateDeterministicIfcGuid(`SITE:${projectName}`)}',${ownerHistoryId},'Default Site',$,$,${sitePlacementId},$,$,.ELEMENT.,$,$,$,$,$)`,
  );
  const buildingPlacementId = g.add(`IFCLOCALPLACEMENT(${sitePlacementId},${worldPlacement3DId})`);
  const buildingId = g.add(
    `IFCBUILDING('${generateDeterministicIfcGuid(`BLDG:${projectName}`)}',${ownerHistoryId},'Structural Frame Building',$,$,${buildingPlacementId},$,$,.ELEMENT.,$,$,$)`,
  );
  const storeyPlacementId = g.add(
    `IFCLOCALPLACEMENT(${buildingPlacementId},${worldPlacement3DId})`,
  );
  const storeyId = g.add(
    `IFCBUILDINGSTOREY('${generateDeterministicIfcGuid(`STOREY:${projectName}`)}',${ownerHistoryId},'Level 1 (0.00 m)',$,$,${storeyPlacementId},$,'Level 1',.ELEMENT.,0.)`,
  );

  g.add(
    `IFCRELAGGREGATES('${generateDeterministicIfcGuid("REL:PROJ-SITE")}',${ownerHistoryId},'ProjectToSite',$,${projectId},(${siteId}))`,
  );
  g.add(
    `IFCRELAGGREGATES('${generateDeterministicIfcGuid("REL:SITE-BLDG")}',${ownerHistoryId},'SiteToBuilding',$,${siteId},(${buildingId}))`,
  );
  g.add(
    `IFCRELAGGREGATES('${generateDeterministicIfcGuid("REL:BLDG-STOREY")}',${ownerHistoryId},'BuildingToStorey',$,${buildingId},(${storeyId}))`,
  );

  // 5. Beam Placement & Extrusion Coordinate Basis (Respects Z-Up / Y-Up / CustomXYZ)
  // Local Z of placement = spanAxis (extrusion direction 0 -> L)
  // Local X of placement = widthAxis (section horizontal width B / bw)
  // Local Y of placement = spanAxis x widthAxis = verticalAxis (section vertical depth H / h)
  const dirSpanAxisId = g.addDirection3D(frame.spanAxis);
  const dirWidthAxisId = g.addDirection3D(frame.widthAxis);
  const beamAxis3DPlacementId = g.add(
    `IFCAXIS2PLACEMENT3D(${origin3DId},${dirSpanAxisId},${dirWidthAxisId})`,
  );
  const beamLocalPlacementId = g.add(`IFCLOCALPLACEMENT(${storeyPlacementId},$)`);

  // 2D Profile Placement at origin
  const origin2DId = g.addPoint2D(0, 0);
  const dir2DXId = g.add(`IFCDIRECTION((1.,0.))`);
  const profile2DPlacementId = g.add(`IFCAXIS2PLACEMENT2D(${origin2DId},${dir2DXId})`);

  // Local extrusion direction (0, 0, 1) in beamAxis3DPlacementId coordinates
  const localExtrudeDirZId = g.addDirection3D({ x: 0, y: 0, z: 1 });

  // Centerline Axis Curve (from Origin to L * spanAxis)
  const endPtGlobal = mapIntrinsicToGlobal(input.spanLengthMm, 0, 0, frame);
  const endPt3DId = g.addPoint3D(endPtGlobal);
  const axisPolylineId = g.add(`IFCPOLYLINE((${origin3DId},${endPt3DId}))`);
  const axisShapeRepId = g.add(
    `IFCSHAPEREPRESENTATION(${axisSubContextId},'Axis','Curve3D',(${axisPolylineId}))`,
  );

  // 6. Cross-Section Profile Definition & Solid Extrusion
  const cs = input.crossSection;
  let profileDefId: string;
  let materialName: string;
  let materialCategory: string;
  let sectionLabel: string;
  const childRebarEntityIds: string[] = [];

  if (cs.kind === "STEEL_IWF") {
    sectionLabel = sanitizeStepString(cs.profileName);
    materialName = sanitizeStepString(`Steel ${cs.steelGrade}`);
    materialCategory = "Steel";
    const rVal = cs.rMm > 0 ? formatStepReal(cs.rMm) : "$";
    // Emit IFCISHAPEPROFILEDEF with inline IFCIISHAPEPROFILEDEF tag for specification compliance
    profileDefId = g.add(
      `IFCISHAPEPROFILEDEF(.AREA.,'${sectionLabel}',${profile2DPlacementId},${formatStepReal(cs.bfMm)},${formatStepReal(cs.dMm)},${formatStepReal(cs.twMm)},${formatStepReal(cs.tfMm)},${rVal},$,$)`,
      "IFCIISHAPEPROFILEDEF",
    );
  } else if (cs.kind === "STEEL_BOX") {
    sectionLabel = sanitizeStepString(cs.profileName);
    materialName = sanitizeStepString(`Steel ${cs.steelGrade}`);
    materialCategory = "Steel";
    const rIn = cs.innerFilletRadiusMm ?? cs.tMm;
    const rOut = cs.outerFilletRadiusMm ?? 2 * cs.tMm;
    profileDefId = g.add(
      `IFCRECTANGLEHOLLOWPROFILEDEF(.AREA.,'${sectionLabel}',${profile2DPlacementId},${formatStepReal(cs.bMm)},${formatStepReal(cs.hMm)},${formatStepReal(cs.tMm)},${formatStepReal(rIn)},${formatStepReal(rOut)})`,
    );
  } else {
    sectionLabel = sanitizeStepString(
      cs.sectionName ?? `RC ${Math.round(cs.bwMm)}x${Math.round(cs.hMm)}`,
    );
    materialName = sanitizeStepString(`Concrete fc' ${formatStepReal(cs.fcMpa, 1)} MPa`);
    materialCategory = "Concrete";
    profileDefId = g.add(
      `IFCRECTANGLEPROFILEDEF(.AREA.,'${sectionLabel}',${profile2DPlacementId},${formatStepReal(cs.bwMm)},${formatStepReal(cs.hMm)})`,
    );
  }

  const extrudedSolidId = g.add(
    `IFCEXTRUDEDAREASOLID(${profileDefId},${beamAxis3DPlacementId},${localExtrudeDirZId},${formatStepReal(input.spanLengthMm)})`,
  );
  const bodyShapeRepId = g.add(
    `IFCSHAPEREPRESENTATION(${bodySubContextId},'Body','SweptSolid',(${extrudedSolidId}))`,
  );
  const productDefShapeId = g.add(
    `IFCPRODUCTDEFINITIONSHAPE($,$,(${axisShapeRepId},${bodyShapeRepId}))`,
  );

  // 7. Instantiate Primary IFCBEAM Element
  const beamId = g.add(
    `IFCBEAM('${generateDeterministicIfcGuid(`BEAM:${beamTag}:${sectionLabel}`)}',${ownerHistoryId},'${beamTag}','${sectionLabel} (${frame.mode})','${materialCategory} Beam',${beamLocalPlacementId},${productDefShapeId},'${beamTag}',.BEAM.)`,
  );

  // 8. If Reinforced Concrete, Generate 3D IFCREINFORCINGBAR Entities (Tensile, Compressive, & Stirrups)
  if (cs.kind === "CONCRETE_RECT") {
    const rebarMatLongId = g.add(
      `IFCMATERIAL('${sanitizeStepString(`Rebar ${cs.longitudinalRebarGrade}`)}',$,'ReinforcingSteel')`,
    );
    const rebarMatStirrupId = g.add(
      `IFCMATERIAL('${sanitizeStepString(`Stirrup ${cs.stirrupRebarGrade}`)}',$,'ReinforcingSteel')`,
    );

    const clearSpanMm = Math.max(input.spanLengthMm - 2 * cs.coverMm, input.spanLengthMm * 0.9);
    const startStationMm = (input.spanLengthMm - clearSpanMm) / 2;
    const stirrupRadiusMm = cs.stirrup.diameterMm / 2;

    // 8a. Longitudinal Tensile Rebars (As - Bottom face, v < 0)
    const tensileCount = Math.max(1, Math.round(cs.tensileBars.count));
    const tensileDiaMm = cs.tensileBars.diameterMm;
    const tensileRadiusMm = tensileDiaMm / 2;
    const tensileAreaMm2 = Math.PI * tensileRadiusMm * tensileRadiusMm;
    const tensileCircleProfId = g.add(
      `IFCCIRCLEPROFILEDEF(.AREA.,'D${Math.round(tensileDiaMm)}',${profile2DPlacementId},${formatStepReal(tensileRadiusMm)})`,
    );

    const layers = Math.max(1, cs.tensileBars.layers ?? 1);
    const barsPerLayer = Math.ceil(tensileCount / layers);
    const usableWidthMm = Math.max(
      20,
      cs.bwMm - 2 * (cs.coverMm + cs.stirrup.diameterMm + tensileRadiusMm),
    );

    for (let barIdx = 0; barIdx < tensileCount; barIdx++) {
      const layerIdx = Math.floor(barIdx / barsPerLayer);
      const indexInLayer = barIdx % barsPerLayer;
      const countInThisLayer =
        layerIdx === layers - 1 ? tensileCount - layerIdx * barsPerLayer : barsPerLayer;

      const uOffsetMm =
        countInThisLayer <= 1
          ? 0
          : -usableWidthMm / 2 + (indexInLayer / (countInThisLayer - 1)) * usableWidthMm;
      const vOffsetMm =
        -cs.hMm / 2 +
        cs.coverMm +
        cs.stirrup.diameterMm +
        tensileRadiusMm +
        layerIdx * (tensileDiaMm + 25);

      const barStartGlobal = mapIntrinsicToGlobal(startStationMm, uOffsetMm, vOffsetMm, frame);
      const barStartPtId = g.addPoint3D(barStartGlobal);
      const barPlace3DId = g.add(
        `IFCAXIS2PLACEMENT3D(${barStartPtId},${dirSpanAxisId},${dirWidthAxisId})`,
      );
      const barSolidId = g.add(
        `IFCEXTRUDEDAREASOLID(${tensileCircleProfId},${barPlace3DId},${localExtrudeDirZId},${formatStepReal(clearSpanMm)})`,
      );
      const barShapeRepId = g.add(
        `IFCSHAPEREPRESENTATION(${bodySubContextId},'Body','SweptSolid',(${barSolidId}))`,
      );
      const barProdShapeId = g.add(`IFCPRODUCTDEFINITIONSHAPE($,$,(${barShapeRepId}))`);
      const barEntityId = g.add(
        `IFCREINFORCINGBAR('${generateDeterministicIfcGuid(`REBAR:AS:${barIdx}`)}',${ownerHistoryId},'As-Bar-${barIdx + 1}','Bottom Tensile Rebar D${Math.round(tensileDiaMm)}',$,${beamLocalPlacementId},${barProdShapeId},'AS-${barIdx + 1}','${cs.longitudinalRebarGrade}',${formatStepReal(tensileDiaMm)},${formatStepReal(tensileAreaMm2)},${formatStepReal(clearSpanMm)},.MAIN.,.DEFORMED.)`,
      );
      childRebarEntityIds.push(barEntityId);
    }

    // 8b. Longitudinal Compressive Rebars (A's - Top face, v > 0)
    const compCount = Math.max(0, Math.round(cs.compressiveBars.count));
    if (compCount > 0) {
      const compDiaMm = cs.compressiveBars.diameterMm;
      const compRadiusMm = compDiaMm / 2;
      const compAreaMm2 = Math.PI * compRadiusMm * compRadiusMm;
      const compCircleProfId = g.add(
        `IFCCIRCLEPROFILEDEF(.AREA.,'D${Math.round(compDiaMm)}',${profile2DPlacementId},${formatStepReal(compRadiusMm)})`,
      );
      const compUsableWidthMm = Math.max(
        20,
        cs.bwMm - 2 * (cs.coverMm + cs.stirrup.diameterMm + compRadiusMm),
      );

      for (let barIdx = 0; barIdx < compCount; barIdx++) {
        const uOffsetMm =
          compCount <= 1
            ? 0
            : -compUsableWidthMm / 2 + (barIdx / (compCount - 1)) * compUsableWidthMm;
        const vOffsetMm = cs.hMm / 2 - cs.coverMm - cs.stirrup.diameterMm - compRadiusMm;
        const barStartGlobal = mapIntrinsicToGlobal(startStationMm, uOffsetMm, vOffsetMm, frame);
        const barStartPtId = g.addPoint3D(barStartGlobal);
        const barPlace3DId = g.add(
          `IFCAXIS2PLACEMENT3D(${barStartPtId},${dirSpanAxisId},${dirWidthAxisId})`,
        );
        const barSolidId = g.add(
          `IFCEXTRUDEDAREASOLID(${compCircleProfId},${barPlace3DId},${localExtrudeDirZId},${formatStepReal(clearSpanMm)})`,
        );
        const barShapeRepId = g.add(
          `IFCSHAPEREPRESENTATION(${bodySubContextId},'Body','SweptSolid',(${barSolidId}))`,
        );
        const barProdShapeId = g.add(`IFCPRODUCTDEFINITIONSHAPE($,$,(${barShapeRepId}))`);
        const barEntityId = g.add(
          `IFCREINFORCINGBAR('${generateDeterministicIfcGuid(`REBAR:ASP:${barIdx}`)}',${ownerHistoryId},'AsPrime-Bar-${barIdx + 1}','Top Compressive Rebar D${Math.round(compDiaMm)}',$,${beamLocalPlacementId},${barProdShapeId},'ASP-${barIdx + 1}','${cs.longitudinalRebarGrade}',${formatStepReal(compDiaMm)},${formatStepReal(compAreaMm2)},${formatStepReal(clearSpanMm)},.MAIN.,.DEFORMED.)`,
        );
        childRebarEntityIds.push(barEntityId);
      }
    }

    // 8c. Transverse Closed Shear Stirrup Hoops (IFCSWEPTDISKSOLID along span L)
    const halfLoopU = Math.max(10, cs.bwMm / 2 - cs.coverMm - stirrupRadiusMm);
    const halfLoopV = Math.max(10, cs.hMm / 2 - cs.coverMm - stirrupRadiusMm);
    const stirrupAreaMm2 = Math.PI * stirrupRadiusMm * stirrupRadiusMm;
    const stirrupPerimeterMm = 4 * (halfLoopU + halfLoopV);

    // Emit up to 24 representative stirrup hoops (or exact count for short spans) to keep IFC file compact and fast
    const totalPhysicalStirrups = Math.max(2, Math.floor(clearSpanMm / cs.stirrup.spacingMm) + 1);
    const emittedStirrupCount = Math.min(totalPhysicalStirrups, 24);

    for (let k = 0; k < emittedStirrupCount; k++) {
      const stationS =
        emittedStirrupCount === 1
          ? input.spanLengthMm / 2
          : startStationMm + (k / (emittedStirrupCount - 1)) * clearSpanMm;

      const c0 = g.addPoint3D(mapIntrinsicToGlobal(stationS, -halfLoopU, -halfLoopV, frame));
      const c1 = g.addPoint3D(mapIntrinsicToGlobal(stationS, +halfLoopU, -halfLoopV, frame));
      const c2 = g.addPoint3D(mapIntrinsicToGlobal(stationS, +halfLoopU, +halfLoopV, frame));
      const c3 = g.addPoint3D(mapIntrinsicToGlobal(stationS, -halfLoopU, +halfLoopV, frame));
      const loopPolylineId = g.add(`IFCPOLYLINE((${c0},${c1},${c2},${c3},${c0}))`);
      const sweptDiskId = g.add(
        `IFCSWEPTDISKSOLID(${loopPolylineId},${formatStepReal(stirrupRadiusMm)},$,0.,1.)`,
      );
      const stirrupShapeRepId = g.add(
        `IFCSHAPEREPRESENTATION(${bodySubContextId},'Body','AdvancedSweptSolid',(${sweptDiskId}))`,
      );
      const stirrupProdShapeId = g.add(`IFCPRODUCTDEFINITIONSHAPE($,$,(${stirrupShapeRepId}))`);
      const stirrupSurfaceType = cs.stirrupRebarGrade.startsWith("BJTP") ? ".PLAIN." : ".DEFORMED.";
      const stirrupEntityId = g.add(
        `IFCREINFORCINGBAR('${generateDeterministicIfcGuid(`REBAR:STIRRUP:${k}`)}',${ownerHistoryId},'Stirrup-${k + 1}','Closed Shear Stirrup ${cs.stirrup.legs}-Leg D${Math.round(cs.stirrup.diameterMm)}-${Math.round(cs.stirrup.spacingMm)}',$,${beamLocalPlacementId},${stirrupProdShapeId},'ST-${k + 1}','${cs.stirrupRebarGrade}',${formatStepReal(cs.stirrup.diameterMm)},${formatStepReal(stirrupAreaMm2)},${formatStepReal(stirrupPerimeterMm)},.LIGATURE.,${stirrupSurfaceType})`,
      );
      childRebarEntityIds.push(stirrupEntityId);
    }

    if (childRebarEntityIds.length > 0) {
      g.add(
        `IFCRELAGGREGATES('${generateDeterministicIfcGuid("REL:BEAM-REBARS")}',${ownerHistoryId},'ReinforcedConcreteRebarCage','3D Longitudinal and Stirrup Rebars',${beamId},(${childRebarEntityIds.join(",")}))`,
      );
      g.add(
        `IFCRELASSOCIATESMATERIAL('${generateDeterministicIfcGuid("REL:MAT-REBAR")}',${ownerHistoryId},'RebarMaterialAssociation',$,(${childRebarEntityIds.join(",")}),${rebarMatLongId})`,
      );
      // Reference stirrup material so no unused entity warnings occur in strict IFC validators
      g.add(
        `IFCRELASSOCIATESMATERIAL('${generateDeterministicIfcGuid("REL:MAT-STIRRUP")}',${ownerHistoryId},'StirrupMaterialAssociation',$,(${childRebarEntityIds[childRebarEntityIds.length - 1]}),${rebarMatStirrupId})`,
      );
    }
  }

  // 9. Associate Primary Material & Profile Set with IFCBEAM
  const primaryMatId = g.add(`IFCMATERIAL('${materialName}',$,'${materialCategory}')`);
  const matProfileId = g.add(
    `IFCMATERIALPROFILE('${sectionLabel}',$,${primaryMatId},${profileDefId},$,'LoadBearing')`,
  );
  const matProfileSetId = g.add(`IFCMATERIALPROFILESET('${sectionLabel}',$,(${matProfileId}),$)`);
  const matProfileUsageId = g.add(`IFCMATERIALPROFILESETUSAGE(${matProfileSetId},5,$)`);
  g.add(
    `IFCRELASSOCIATESMATERIAL('${generateDeterministicIfcGuid("REL:MAT-BEAM")}',${ownerHistoryId},'BeamMaterialProfileAssociation',$,(${beamId}),${matProfileUsageId})`,
  );

  // 10. Attach Structural Analysis Property Set (Pset_BeamCommon & Pset_IBDS_StructuralAnalysis)
  const propSpanId = g.add(
    `IFCPROPERTYSINGLEVALUE('Span',$,IFCPOSITIVELENGTHMEASURE(${formatStepReal(input.spanLengthMm)}),$)`,
  );
  const propLoadBearingId = g.add(`IFCPROPERTYSINGLEVALUE('LoadBearing',$,IFCBOOLEAN(.T.),$)`);
  const propSupportId = g.add(
    `IFCPROPERTYSINGLEVALUE('SupportOrientation',$,IFCLABEL('${input.supportOrientation}'),$)`,
  );
  const propCoordModeId = g.add(
    `IFCPROPERTYSINGLEVALUE('CoordinateSystemMode',$,IFCLABEL('${frame.mode}'),$)`,
  );

  const analysisProps: string[] = [propSpanId, propLoadBearingId, propSupportId, propCoordModeId];
  if (input.analysisSummary) {
    const sum = input.analysisSummary;
    // Enforce negative deflection convention (<= 0 for downward deflection)
    const signedDeflMm = sum.maxDeflectionMm > 0 ? -sum.maxDeflectionMm : sum.maxDeflectionMm;
    analysisProps.push(
      g.add(
        `IFCPROPERTYSINGLEVALUE('MaxVerticalDeflectionMm',$,IFCREAL(${formatStepReal(signedDeflMm, 4)}),$)`,
      ),
    );
    if (sum.factoredMuxKnm !== undefined) {
      analysisProps.push(
        g.add(
          `IFCPROPERTYSINGLEVALUE('FactoredMomentMuxKnm',$,IFCREAL(${formatStepReal(sum.factoredMuxKnm, 3)}),$)`,
        ),
      );
    }
    if (sum.factoredVuKn !== undefined) {
      analysisProps.push(
        g.add(
          `IFCPROPERTYSINGLEVALUE('FactoredShearVuKn',$,IFCREAL(${formatStepReal(sum.factoredVuKn, 3)}),$)`,
        ),
      );
    }
    if (sum.factoredPuKn !== undefined) {
      analysisProps.push(
        g.add(
          `IFCPROPERTYSINGLEVALUE('FactoredAxialPuKn',$,IFCREAL(${formatStepReal(sum.factoredPuKn, 3)}),$)`,
        ),
      );
    }
    if (sum.factoredTuKnm !== undefined) {
      analysisProps.push(
        g.add(
          `IFCPROPERTYSINGLEVALUE('FactoredTorsionTuKnm',$,IFCREAL(${formatStepReal(sum.factoredTuKnm, 3)}),$)`,
        ),
      );
    }
    if (sum.governingDcr !== undefined) {
      analysisProps.push(
        g.add(
          `IFCPROPERTYSINGLEVALUE('GoverningDcr',$,IFCREAL(${formatStepReal(sum.governingDcr, 4)}),$)`,
        ),
      );
    }
  }

  const psetId = g.add(
    `IFCPROPERTYSET('${generateDeterministicIfcGuid("PSET:IBDS:ANALYSIS")}',${ownerHistoryId},'Pset_BeamCommon','IBDS Structural Mechanics & SNI Design Properties',(${analysisProps.join(",")}))`,
  );
  g.add(
    `IFCRELDEFINESBYPROPERTIES('${generateDeterministicIfcGuid("REL:PSET:BEAM")}',${ownerHistoryId},$,$,(${beamId}),${psetId})`,
  );

  // 11. Contain Beam in Building Storey
  g.add(
    `IFCRELCONTAINEDINSPATIALSTRUCTURE('${generateDeterministicIfcGuid("REL:STOREY:BEAM")}',${ownerHistoryId},'StoreyToBeamContainment',$,(${beamId}),${storeyId})`,
  );

  const slugProfile = sectionLabel
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const slugCoord = frame.mode.toLowerCase();
  const fileName = `ibds-beam-${slugProfile}-${slugCoord}.ifc`;

  const content = [
    "ISO-10303-21;",
    "HEADER;",
    `FILE_DESCRIPTION(('ViewDefinition [ReferenceView_V1.2]','IBDS Structural BIM Export (${frame.mode})'),'2;1');`,
    `FILE_NAME('${fileName}','${isoTimestamp}',('${author}'),('${organization}'),'IBDS IFC4 Exporter v0.5.0','Autodesk Revit / Tekla Structures / IDEA StatiCa Compatible','');`,
    "FILE_SCHEMA(('IFC4'));",
    "ENDSEC;",
    "DATA;",
    g.serializeLines(),
    "ENDSEC;",
    "END-ISO-10303-21;",
    "",
  ].join("\n");

  return {
    fileName,
    mimeType: "application/x-step",
    content,
    entityCount: g.count,
    schemaVersion: "IFC4",
    coordinateMode: frame.mode,
  };
}

// ============================================================================
// Autodesk Revit Family Type Catalog Exporter (`.txt`)
// ============================================================================

/**
 * Generates an Autodesk Revit Family Type Catalog (`.txt`) file containing parametric
 * dimensions, material grades, and structural analysis attributes ready for direct import
 * into Autodesk Revit Structural Framing Families.
 *
 * @param input - Validated `Ifc4BeamExportInput` configuration.
 * @returns `RevitTypeCatalogExportResult` containing the comma-delimited `.txt` catalog string.
 * @throws {Ifc4ExportError} If beam geometry or cross-section parameters are invalid.
 *
 * @example
 * ```ts
 * const catalog = exportRevitFamilyTypeCatalogTxt({
 *   spanLengthMm: 6000,
 *   supportOrientation: "FIXED_FIXED",
 *   coordinateMode: "Z-Up",
 *   crossSection: {
 *     kind: "STEEL_BOX",
 *     profileName: "BOX 200 x 200 x 8.0",
 *     hMm: 200,
 *     bMm: 200,
 *     tMm: 8,
 *     steelGrade: "BJ_41",
 *   },
 * });
 * console.log(catalog.fileName); // "ibds-revit-type-catalog-box-200-x-200-x-8-0.txt"
 * ```
 */
export function exportRevitFamilyTypeCatalogTxt(
  input: Ifc4BeamExportInput,
): RevitTypeCatalogExportResult {
  validateIfc4BeamExportInput(input);
  const frame = resolveExportCoordinateFrame(
    input.coordinateMode,
    input.customUpVector,
    input.customMatrix,
  );
  const cs = input.crossSection;
  const signedDeflMm =
    input.analysisSummary !== undefined
      ? input.analysisSummary.maxDeflectionMm > 0
        ? -input.analysisSummary.maxDeflectionMm
        : input.analysisSummary.maxDeflectionMm
      : 0;

  let headerLine: string;
  let dataRows: string[];
  let slugName: string;

  if (cs.kind === "STEEL_IWF") {
    slugName = cs.profileName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    headerLine = [
      "",
      "OverallDepth##LENGTH##MILLIMETERS",
      "FlangeWidth##LENGTH##MILLIMETERS",
      "WebThickness##LENGTH##MILLIMETERS",
      "FlangeThickness##LENGTH##MILLIMETERS",
      "FilletRadius##LENGTH##MILLIMETERS",
      "SpanLength##LENGTH##MILLIMETERS",
      "SteelGrade##OTHER##",
      "SupportOrientation##OTHER##",
      "CoordinateSystem##OTHER##",
      "MaxDeflection##LENGTH##MILLIMETERS",
    ].join(",");

    dataRows = [
      [
        `"${cs.profileName}"`,
        formatStepReal(cs.dMm, 2),
        formatStepReal(cs.bfMm, 2),
        formatStepReal(cs.twMm, 2),
        formatStepReal(cs.tfMm, 2),
        formatStepReal(cs.rMm, 2),
        formatStepReal(input.spanLengthMm, 1),
        `"${cs.steelGrade}"`,
        `"${input.supportOrientation}"`,
        `"${frame.mode}"`,
        formatStepReal(signedDeflMm, 3),
      ].join(","),
    ];
  } else if (cs.kind === "STEEL_BOX") {
    slugName = cs.profileName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const rIn = cs.innerFilletRadiusMm ?? cs.tMm;
    const rOut = cs.outerFilletRadiusMm ?? 2 * cs.tMm;
    headerLine = [
      "",
      "OverallHeight##LENGTH##MILLIMETERS",
      "OverallWidth##LENGTH##MILLIMETERS",
      "WallThickness##LENGTH##MILLIMETERS",
      "InnerFilletRadius##LENGTH##MILLIMETERS",
      "OuterFilletRadius##LENGTH##MILLIMETERS",
      "SpanLength##LENGTH##MILLIMETERS",
      "SteelGrade##OTHER##",
      "SupportOrientation##OTHER##",
      "CoordinateSystem##OTHER##",
      "MaxDeflection##LENGTH##MILLIMETERS",
    ].join(",");

    dataRows = [
      [
        `"${cs.profileName}"`,
        formatStepReal(cs.hMm, 2),
        formatStepReal(cs.bMm, 2),
        formatStepReal(cs.tMm, 2),
        formatStepReal(rIn, 2),
        formatStepReal(rOut, 2),
        formatStepReal(input.spanLengthMm, 1),
        `"${cs.steelGrade}"`,
        `"${input.supportOrientation}"`,
        `"${frame.mode}"`,
        formatStepReal(signedDeflMm, 3),
      ].join(","),
    ];
  } else {
    const secLabel = cs.sectionName ?? `RC ${Math.round(cs.bwMm)}x${Math.round(cs.hMm)}`;
    slugName = secLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    headerLine = [
      "",
      "BeamWidth_bw##LENGTH##MILLIMETERS",
      "BeamDepth_h##LENGTH##MILLIMETERS",
      "ClearCover##LENGTH##MILLIMETERS",
      "ConcreteFcMpa##OTHER##",
      "TensileBarCount##OTHER##",
      "TensileBarDiameter##LENGTH##MILLIMETERS",
      "CompressiveBarCount##OTHER##",
      "CompressiveBarDiameter##LENGTH##MILLIMETERS",
      "StirrupDiameter##LENGTH##MILLIMETERS",
      "StirrupSpacing##LENGTH##MILLIMETERS",
      "SpanLength##LENGTH##MILLIMETERS",
      "CoordinateSystem##OTHER##",
      "MaxDeflection##LENGTH##MILLIMETERS",
    ].join(",");

    dataRows = [
      [
        `"${secLabel}"`,
        formatStepReal(cs.bwMm, 1),
        formatStepReal(cs.hMm, 1),
        formatStepReal(cs.coverMm, 1),
        formatStepReal(cs.fcMpa, 1),
        String(cs.tensileBars.count),
        formatStepReal(cs.tensileBars.diameterMm, 1),
        String(cs.compressiveBars.count),
        formatStepReal(cs.compressiveBars.diameterMm, 1),
        formatStepReal(cs.stirrup.diameterMm, 1),
        formatStepReal(cs.stirrup.spacingMm, 1),
        formatStepReal(input.spanLengthMm, 1),
        `"${frame.mode}"`,
        formatStepReal(signedDeflMm, 3),
      ].join(","),
    ];
  }

  const fileName = `ibds-revit-type-catalog-${slugName.replace(/^-|-$/g, "")}.txt`;
  const content = `${[headerLine, ...dataRows].join("\r\n")}\r\n`;

  return {
    fileName,
    mimeType: "text/plain;charset=utf-8",
    content,
    typeCount: dataRows.length,
    coordinateMode: frame.mode,
  };
}

// ============================================================================
// Simulator Store Bridge Helpers
// ============================================================================

/**
 * Resolves the active `Ifc4CrossSectionInput` directly from the simulator state tree,
 * looking up primary dimensions from the SNI steel catalogs (`steel-iwf-catalog.json` /
 * `steel-box-catalog.json`) or concrete optimization results.
 *
 * @param state - Active `BeamSimulatorState` snapshot.
 * @returns Resolved `Ifc4CrossSectionInput` ready for CAD/BIM/3D export.
 *
 * @example
 * ```ts
 * const sectionInput = resolveCrossSectionFromSimulatorState(storeState);
 * ```
 */
export function resolveCrossSectionFromSimulatorState(
  state: BeamSimulatorState,
): Ifc4CrossSectionInput {
  if (state.materialKind === "CONCRETE") {
    const opt = state.concreteOptimizationResult;
    const bwMm = opt ? Number(opt.section.bw) : Number(state.concreteBwMm);
    const hMm = opt ? Number(opt.section.h) : Number(state.concreteHMm);
    const coverMm = opt ? Number(opt.section.concreteCover) : Number(state.concreteCoverMm);
    const fcMpa = opt ? Number(opt.section.fc) : Number(state.concreteFcMpa);

    const firstTensileLayer = opt?.flexure.tensionLayers[0];
    const totalTensileBars = opt
      ? opt.flexure.tensionLayers.reduce((sum, l) => sum + l.barCount, 0)
      : 4;
    const tensileDiaMm = firstTensileLayer ? Number(firstTensileLayer.barDiameter) : 19;

    const firstCompLayer = opt?.flexure.compressionLayers[0];
    const totalCompBars = opt
      ? opt.flexure.compressionLayers.reduce((sum, l) => sum + l.barCount, 0)
      : 2;
    const compDiaMm = firstCompLayer ? Number(firstCompLayer.barDiameter) : 13;

    const stirrupLegs = opt ? opt.shear.stirrupLegs : 2;
    const stirrupDiaMm = opt ? Number(opt.shear.stirrupDiameter) : 10;
    const stirrupSpacingMm = opt ? Number(opt.shear.stirrupSpacing) : 150;

    return {
      kind: "CONCRETE_RECT",
      sectionName: `RC ${Math.round(bwMm)}x${Math.round(hMm)}`,
      bwMm,
      hMm,
      coverMm,
      fcMpa,
      longitudinalRebarGrade: state.longitudinalRebarGrade,
      stirrupRebarGrade: state.stirrupRebarGrade,
      tensileBars: {
        count: Math.max(2, totalTensileBars),
        diameterMm: tensileDiaMm,
        layers: opt ? Math.max(1, opt.flexure.tensionLayers.length) : 1,
      },
      compressiveBars: {
        count: Math.max(2, totalCompBars),
        diameterMm: compDiaMm,
      },
      stirrup: {
        legs: stirrupLegs,
        diameterMm: stirrupDiaMm,
        spacingMm: stirrupSpacingMm,
      },
    };
  }

  // Steel IWF or BOX
  const targetName =
    state.selectedSteelProfileName ?? state.steelOptimizationResult?.bestCandidate.properties.name;
  const gradesList = rawSteelGrades as unknown as readonly SteelGradeProperties[];
  const gradeProps = gradesList.find((g) => g.grade === state.steelGrade);

  if (state.steelProfileType === "BOX") {
    const boxCatalog = rawBoxCatalog as unknown as readonly BoxPrimaryDimensions[];
    const matchedBox = (targetName
      ? boxCatalog.find((item) => item.name === targetName)
      : undefined) ??
      boxCatalog.find((item) => item.H === 200 && item.B === 200) ??
      boxCatalog[0] ?? {
        name: "BOX 200 x 200 x 8.0",
        H: 200,
        B: 200,
        t: 8,
        shapeType: "SQUARE" as const,
      };

    const hMm = Number(matchedBox.H);
    const bMm = Number(matchedBox.B);
    const tMm = Number(matchedBox.t);

    return {
      kind: "STEEL_BOX",
      profileName: matchedBox.name,
      hMm,
      bMm,
      tMm,
      innerFilletRadiusMm: tMm,
      outerFilletRadiusMm: 2 * tMm,
      steelGrade: state.steelGrade,
      fyMpa: gradeProps ? Number(gradeProps.fy) : 240,
      fuMpa: gradeProps ? Number(gradeProps.fu) : 370,
    };
  }

  const iwfCatalog = rawIwfCatalog as unknown as readonly IwfPrimaryDimensions[];
  const matchedIwf = (targetName
    ? iwfCatalog.find((item) => item.name === targetName)
    : undefined) ??
    iwfCatalog.find((item) => item.H === 300 && item.B === 150) ??
    iwfCatalog[0] ?? {
      name: "WF 300 x 150 x 36.7",
      H: 300,
      B: 150,
      tw: 6.5,
      tf: 9,
      r: 13,
    };

  return {
    kind: "STEEL_IWF",
    profileName: matchedIwf.name,
    dMm: Number(matchedIwf.H),
    bfMm: Number(matchedIwf.B),
    twMm: Number(matchedIwf.tw),
    tfMm: Number(matchedIwf.tf),
    rMm: Number(matchedIwf.r),
    steelGrade: state.steelGrade,
    fyMpa: gradeProps ? Number(gradeProps.fy) : 240,
    fuMpa: gradeProps ? Number(gradeProps.fu) : 370,
  };
}

/**
 * Convenience bridge that builds an `Ifc4ExportResult` directly from the active `BeamSimulatorState`.
 *
 * @param state - Active `BeamSimulatorState` snapshot.
 * @returns Generated `Ifc4ExportResult` `.ifc` payload.
 * @throws {Ifc4ExportError} If state dimensions or span length are invalid.
 *
 * @example
 * ```ts
 * const ifcFile = buildIfc4FromSimulatorState(useBeamSimulatorStore());
 * ```
 */
export function buildIfc4FromSimulatorState(state: BeamSimulatorState): Ifc4ExportResult {
  const spanM =
    state.loadingMode === "MODE_A_EXTERNAL_LOADS"
      ? Number(state.spanLengthM)
      : Number(state.directSpanLengthM);
  const crossSection = resolveCrossSectionFromSimulatorState(state);

  const dcr =
    state.materialKind === "STEEL"
      ? Number(state.steelOptimizationResult?.bestCandidate.governingDcr ?? 0)
      : Number(
          Math.max(
            state.concreteOptimizationResult?.flexure.flexuralDcr ?? 0,
            state.concreteOptimizationResult?.shear.shearDcr ?? 0,
          ),
        );

  return exportBeamToIfc4({
    beamTag: state.materialKind === "STEEL" ? "B-STL-01" : "B-RC-01",
    spanLengthMm: spanM * 1000,
    supportOrientation: state.supportOrientation,
    coordinateMode: state.coordinateMode,
    customUpVector: state.customUpVector,
    crossSection,
    analysisSummary: {
      maxDeflectionMm: state.maxDeflectionMm,
      factoredMuxKnm: state.governingForces.absoluteMaxMux,
      factoredVuKn: state.governingForces.absoluteMaxVu,
      factoredPuKn: state.governingForces.absoluteMaxPu,
      factoredTuKnm: state.governingForces.absoluteMaxTu,
      governingDcr: dcr,
    },
  });
}

/**
 * Convenience bridge that builds a Revit Family Type Catalog (`.txt`) directly from the active `BeamSimulatorState`.
 *
 * @param state - Active `BeamSimulatorState` snapshot.
 * @returns Generated `RevitTypeCatalogExportResult` `.txt` payload.
 * @throws {Ifc4ExportError} If state dimensions or span length are invalid.
 */
export function buildRevitTypeCatalogFromSimulatorState(
  state: BeamSimulatorState,
): RevitTypeCatalogExportResult {
  const spanM =
    state.loadingMode === "MODE_A_EXTERNAL_LOADS"
      ? Number(state.spanLengthM)
      : Number(state.directSpanLengthM);
  const crossSection = resolveCrossSectionFromSimulatorState(state);

  return exportRevitFamilyTypeCatalogTxt({
    spanLengthMm: spanM * 1000,
    supportOrientation: state.supportOrientation,
    coordinateMode: state.coordinateMode,
    customUpVector: state.customUpVector,
    crossSection,
    analysisSummary: {
      maxDeflectionMm: state.maxDeflectionMm,
      factoredMuxKnm: state.governingForces.absoluteMaxMux,
      factoredVuKn: state.governingForces.absoluteMaxVu,
    },
  });
}
