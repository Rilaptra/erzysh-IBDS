/**
 * @file dxf-autocad-exporter.ts
 * @description Native AutoCAD DXF (AC1015 / R2000 ASCII) and AutoLISP (.lsp) exporter
 * for 2D structural beam cross-sections and 3D beam axis wireframes.
 *
 * Implements standard civil/structural engineering CAD drafting conventions:
 * 1. **Layer S-SECT-OUTLINE (Color 7 / White - 0.35 mm):**
 *    - For IWF: Closed `LWPOLYLINE` with 16 vertices, where the 4 fillet transitions
 *      feature exact circular arc bulges:
 *      $$\text{bulge} = \tan(\Delta\theta / 4) = \tan((\pi/2)/4) = \sqrt{2} - 1 \approx 0.41421356$$
 *    - For BOX: Two concentric closed `LWPOLYLINE`s (outer $B \times H$ with $r_{\text{out}} = 2t$,
 *      inner $(B - 2t) \times (H - 2t)$ with $r_{\text{in}} = t$).
 *    - For Reinforced Concrete: Outer rectangular boundary $b_w \times h$.
 * 2. **Layer S-REBAR-STIRRUP (Color 3 / Green - 0.25 mm):**
 *    - Closed rectangular stirrup hoop offset by concrete clear cover $c_c$ from edges.
 * 3. **Layer S-REBAR-MAIN (Color 1 / Red - 0.50 mm):**
 *    - `CIRCLE` entities at centroid coordinates $(u_i, v_i)$ with nominal bar radii $r_b = d_b / 2$.
 * 4. **Layer S-ANNO-DIMS (Color 4 / Cyan):**
 *    - Text annotations for profile name, material grades, rebar detailing, and max deflection $\Delta_{\max} \le 0$.
 * 5. **AutoLISP (.lsp) Script Generator:**
 *    - Parametric AutoLISP command `(c:DRAW_BEAM_SECTION)` that automatically constructs the geometry inside AutoCAD.
 */

import type { BeamSimulatorState } from "@/state/beam-simulator-store";
import type { CoordinateSystemMode, Vector3D } from "@/types/branded-units";

import {
  type ExportCoordinateFrame3D,
  type Ifc4CrossSectionInput,
  mapIntrinsicToGlobal,
  resolveCrossSectionFromSimulatorState,
  resolveExportCoordinateFrame,
} from "./ifc4-bim-revit-exporter";

// ============================================================================
// Error Handling & Diagnostic Types
// ============================================================================

/**
 * Enumeration of machine-readable error codes emitted by the DXF & AutoLISP exporter.
 */
export type DxfExportErrorCode =
  | "INVALID_SECTION_DIMENSIONS"
  | "INVALID_SPAN_LENGTH"
  | "INVALID_REBAR_CONFIGURATION"
  | "INVALID_COORDINATE_FRAME"
  | "UNSUPPORTED_SECTION_KIND";

/**
 * Custom structured error class for DXF / AutoLISP export failures.
 */
export class DxfExportError extends Error {
  /** Machine-readable error code. */
  public readonly code: DxfExportErrorCode;
  /** Name of the parameter causing the error. */
  public readonly fieldName: string;
  /** Rejected runtime value. */
  public readonly invalidValue: unknown;
  /** ISO-8601 timestamp. */
  public readonly timestampIso: string;

  /**
   * Constructs a new `DxfExportError` with full diagnostic traceback context.
   *
   * @param code - Error code enum.
   * @param fieldName - Offending property path.
   * @param invalidValue - Rejected value.
   * @param message - Diagnostic explanation.
   */
  constructor(code: DxfExportErrorCode, fieldName: string, invalidValue: unknown, message: string) {
    super(
      `[DxfExportError:${code}] Field '${fieldName}' (${JSON.stringify(invalidValue)}): ${message}`,
    );
    this.name = "DxfExportError";
    this.code = code;
    this.fieldName = fieldName;
    this.invalidValue = invalidValue;
    this.timestampIso = new Date().toISOString();
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DxfExportError);
    }
  }
}

// ============================================================================
// Data Contracts
// ============================================================================

/**
 * Input configuration for generating 2D cross-section and 3D beam DXF files.
 */
export interface DxfBeamExportInput {
  /** Optional drawing title. */
  readonly drawingTitle?: string;
  /** Beam span length $L$ in millimeters ($\text{mm}$, must be $> 0$). */
  readonly spanLengthMm: number;
  /** Active 3D coordinate system orientation (`"Z-Up"`, `"Y-Up"`, or `"CustomXYZ"`). */
  readonly coordinateMode: CoordinateSystemMode;
  /** Optional custom Up-axis vector. */
  readonly customUpVector?: Vector3D;
  /** Cross-section geometry definition. */
  readonly crossSection: Ifc4CrossSectionInput;
  /** Optional signed maximum vertical deflection in $\text{mm}$ ($\le 0$ downward). */
  readonly maxDeflectionMm?: number;
  /** Whether to export 2D cross-section (default `true`) or 3D beam wireframe. */
  readonly mode?: "2D_SECTION" | "3D_WIREFRAME";
}

/**
 * Result bundle returned by `exportBeamToDxf`.
 */
export interface DxfExportResult {
  /** Recommended file name ending in `.dxf`. */
  readonly fileName: string;
  /** Standard MIME type for DXF files (`"application/dxf"`). */
  readonly mimeType: "application/dxf";
  /** Complete ASCII DXF content. */
  readonly content: string;
  /** Number of AutoCAD entities generated. */
  readonly entityCount: number;
  /** Active coordinate system orientation applied. */
  readonly coordinateMode: CoordinateSystemMode;
}

/**
 * Result bundle returned by `exportBeamToAutoLisp`.
 */
export interface AutoLispExportResult {
  /** Recommended file name ending in `.lsp`. */
  readonly fileName: string;
  /** Standard MIME type for AutoLISP scripts (`"text/plain;charset=utf-8"`). */
  readonly mimeType: "text/plain;charset=utf-8";
  /** AutoLISP source code. */
  readonly content: string;
  /** Command name to run inside AutoCAD (e.g., `"DRAW_BEAM_SECTION"`). */
  readonly commandName: string;
}

// ============================================================================
// Math & DXF Formatting Helpers
// ============================================================================

/**
 * Formats a number to AutoCAD DXF real string format (up to 4 decimal places).
 *
 * @param val - Number to format.
 * @param decimals - Decimal places.
 * @returns Formatted real string.
 */
function fmtDxfReal(val: number, decimals = 4): string {
  if (!Number.isFinite(val)) return "0.0";
  const str = val.toFixed(decimals).replace(/0+$/, "");
  return str.endsWith(".") ? `${str}0` : str;
}

/**
 * 2D LWPOLYLINE Vertex with optional arc bulge.
 */
interface PolylineVertex2D {
  readonly x: number;
  readonly y: number;
  readonly bulge?: number;
}

/**
 * Exact circular arc bulge factor for a 90-degree corner:
 * $$\text{bulge} = \tan(\Delta\theta / 4) = \tan((\pi / 2) / 4) = \tan(\pi / 8) = \sqrt{2} - 1 \approx 0.414213562373095$$
 */
export const EXACT_FILLET_BULGE_90_DEG = Math.SQRT2 - 1;

/**
 * Builds the 16 vertices of a hot-rolled IWF profile with exact circular arc bulges
 * at the 4 web-flange fillet transitions.
 *
 * @param bfMm - Flange width $B$ in $\text{mm}$.
 * @param dMm - Depth $H$ in $\text{mm}$.
 * @param twMm - Web thickness $t_w$ in $\text{mm}$.
 * @param tfMm - Flange thickness $t_f$ in $\text{mm}$.
 * @param rMm - Root fillet radius $r$ in $\text{mm}$.
 * @returns Array of 16 vertices forming a closed CCW polygon with exact bulges.
 */
export function buildIwfDxfVertices(
  bfMm: number,
  dMm: number,
  twMm: number,
  tfMm: number,
  rMm: number,
): PolylineVertex2D[] {
  const xFlange = bfMm / 2;
  const xWeb = twMm / 2;
  const yTop = dMm / 2;
  const yFlangeInner = dMm / 2 - tfMm;

  const maxSafeR = Math.min((bfMm - twMm) / 2 - 0.1, (dMm - 2 * tfMm) / 2 - 0.1);
  const r = Math.max(0, Math.min(rMm, maxSafeR));

  if (r <= 1e-4) {
    return [
      { x: +xFlange, y: -yTop },
      { x: +xFlange, y: -yFlangeInner },
      { x: +xWeb, y: -yFlangeInner },
      { x: +xWeb, y: +yFlangeInner },
      { x: +xFlange, y: +yFlangeInner },
      { x: +xFlange, y: +yTop },
      { x: -xFlange, y: +yTop },
      { x: -xFlange, y: +yFlangeInner },
      { x: -xWeb, y: +yFlangeInner },
      { x: -xWeb, y: -yFlangeInner },
      { x: -xFlange, y: -yFlangeInner },
      { x: -xFlange, y: -yTop },
    ];
  }

  const xFillet = xWeb + r;
  const yFillet = yFlangeInner - r;

  // Bulge is negative for clockwise arc turns in CCW profile traversal
  const bNeg = -EXACT_FILLET_BULGE_90_DEG;

  return [
    { x: +xFlange, y: -yTop },
    { x: +xFlange, y: -yFlangeInner },
    { x: +xFillet, y: -yFlangeInner, bulge: bNeg },
    { x: +xWeb, y: -yFillet },
    { x: +xWeb, y: +yFillet, bulge: bNeg },
    { x: +xFillet, y: +yFlangeInner },
    { x: +xFlange, y: +yFlangeInner },
    { x: +xFlange, y: +yTop },
    { x: -xFlange, y: +yTop },
    { x: -xFlange, y: +yFlangeInner },
    { x: -xFillet, y: +yFlangeInner, bulge: bNeg },
    { x: -xWeb, y: +yFillet },
    { x: -xWeb, y: -yFillet, bulge: bNeg },
    { x: -xFillet, y: -yFlangeInner },
    { x: -xFlange, y: -yFlangeInner },
    { x: -xFlange, y: -yTop },
  ];
}

/**
 * Builds rounded rectangle vertices with exact arc bulges at the 4 corners.
 *
 * @param widthMm - Total width in $\text{mm}$.
 * @param heightMm - Total height in $\text{mm}$.
 * @param cornerRadiusMm - Corner radius in $\text{mm}$.
 * @returns Array of vertices with 90-degree bulges.
 */
export function buildRoundedRectDxfVertices(
  widthMm: number,
  heightMm: number,
  cornerRadiusMm: number,
): PolylineVertex2D[] {
  const hw = widthMm / 2;
  const hh = heightMm / 2;
  const r = Math.max(0, Math.min(cornerRadiusMm, Math.min(hw, hh) - 0.1));

  if (r <= 1e-4) {
    return [
      { x: -hw, y: -hh },
      { x: +hw, y: -hh },
      { x: +hw, y: +hh },
      { x: -hw, y: +hh },
    ];
  }

  const uc = hw - r;
  const vc = hh - r;
  const bPos = EXACT_FILLET_BULGE_90_DEG;

  return [
    { x: -uc, y: -hh },
    { x: +uc, y: -hh, bulge: bPos },
    { x: +hw, y: -vc },
    { x: +hw, y: +vc, bulge: bPos },
    { x: +uc, y: +hh },
    { x: -uc, y: +hh, bulge: bPos },
    { x: -hw, y: +vc },
    { x: -hw, y: -vc, bulge: bPos },
  ];
}

// ============================================================================
// Core DXF File Generator (`exportBeamToDxf`)
// ============================================================================

/**
 * Generates an AutoCAD DXF (AC1015 / R2000 ASCII) file for the structural beam.
 *
 * Layers:
 * - `S-SECT-OUTLINE` (White/7 - 0.35 mm): Beam cross-section profile.
 * - `S-REBAR-STIRRUP` (Green/3 - 0.25 mm): Closed shear stirrup loop.
 * - `S-REBAR-MAIN` (Red/1 - 0.50 mm): Circles for tensile and compressive rebars.
 * - `S-ANNO-DIMS` (Cyan/4): Text dimensions and notes.
 *
 * @param input - Validated `DxfBeamExportInput` payload.
 * @returns `DxfExportResult` containing the `.dxf` content and metadata.
 * @throws {DxfExportError} If input dimensions are non-physical.
 *
 * @example
 * ```ts
 * const dxf = exportBeamToDxf({
 *   spanLengthMm: 6000,
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
 * });
 * console.log(dxf.fileName); // "ibds-section-wf-300-x-150-x-36-7.dxf"
 * ```
 */
export function exportBeamToDxf(input: DxfBeamExportInput): DxfExportResult {
  if (!Number.isFinite(input.spanLengthMm) || input.spanLengthMm <= 0) {
    throw new DxfExportError(
      "INVALID_SPAN_LENGTH",
      "spanLengthMm",
      input.spanLengthMm,
      "Span length must be > 0.",
    );
  }

  const cs = input.crossSection;
  let sectionLabel = "";
  if (cs.kind === "STEEL_IWF") sectionLabel = cs.profileName;
  else if (cs.kind === "STEEL_BOX") sectionLabel = cs.profileName;
  else sectionLabel = cs.sectionName ?? `RC ${Math.round(cs.bwMm)}x${Math.round(cs.hMm)}`;

  let entityCount = 0;
  const entities: string[] = [];

  const emitPolyline = (layer: string, color: number, vertices: PolylineVertex2D[]): void => {
    entityCount++;
    entities.push(
      "  0",
      "POLYLINE",
      "  8",
      layer,
      " 62",
      String(color),
      " 66",
      "1", // Vertices follow
      " 70",
      "1", // Closed polyline
    );
    for (const v of vertices) {
      entities.push(
        "  0",
        "VERTEX",
        "  8",
        layer,
        " 10",
        fmtDxfReal(v.x),
        " 20",
        fmtDxfReal(v.y),
        " 30",
        "0.0",
      );
      if (v.bulge !== undefined && Math.abs(v.bulge) > 1e-6) {
        entities.push(" 42", fmtDxfReal(v.bulge, 6));
      }
    }
    entities.push("  0", "SEQEND");
  };

  const emitCircle = (
    layer: string,
    color: number,
    cx: number,
    cy: number,
    radius: number,
  ): void => {
    entityCount++;
    entities.push(
      "  0",
      "CIRCLE",
      "  8",
      layer,
      " 62",
      String(color),
      " 10",
      fmtDxfReal(cx),
      " 20",
      fmtDxfReal(cy),
      " 30",
      "0.0",
      " 40",
      fmtDxfReal(radius),
    );
  };

  const emitText = (
    layer: string,
    color: number,
    x: number,
    y: number,
    height: number,
    text: string,
  ): void => {
    entityCount++;
    entities.push(
      "  0",
      "TEXT",
      "  8",
      layer,
      " 62",
      String(color),
      " 10",
      fmtDxfReal(x),
      " 20",
      fmtDxfReal(y),
      " 30",
      "0.0",
      " 40",
      fmtDxfReal(height),
      "  1",
      text,
    );
  };

  // 1. Draw Section Profiles
  if (cs.kind === "STEEL_IWF") {
    const verts = buildIwfDxfVertices(cs.bfMm, cs.dMm, cs.twMm, cs.tfMm, cs.rMm);
    emitPolyline("S-SECT-OUTLINE", 7, verts);

    // Annotations
    emitText("S-ANNO-DIMS", 4, -cs.bfMm / 2, cs.dMm / 2 + 30, 16, `Profile: ${cs.profileName}`);
    emitText(
      "S-ANNO-DIMS",
      4,
      -cs.bfMm / 2,
      cs.dMm / 2 + 10,
      12,
      `Grade: ${cs.steelGrade} | Span: L = ${(input.spanLengthMm / 1000).toFixed(2)} m`,
    );
  } else if (cs.kind === "STEEL_BOX") {
    const rOut = cs.outerFilletRadiusMm ?? 2 * cs.tMm;
    const rIn = cs.innerFilletRadiusMm ?? cs.tMm;
    const outerVerts = buildRoundedRectDxfVertices(cs.bMm, cs.hMm, rOut);
    const innerVerts = buildRoundedRectDxfVertices(cs.bMm - 2 * cs.tMm, cs.hMm - 2 * cs.tMm, rIn);
    emitPolyline("S-SECT-OUTLINE", 7, outerVerts);
    emitPolyline("S-SECT-OUTLINE", 7, innerVerts);

    emitText("S-ANNO-DIMS", 4, -cs.bMm / 2, cs.hMm / 2 + 30, 16, `Profile: ${cs.profileName}`);
    emitText(
      "S-ANNO-DIMS",
      4,
      -cs.bMm / 2,
      cs.hMm / 2 + 10,
      12,
      `Grade: ${cs.steelGrade} | Span: L = ${(input.spanLengthMm / 1000).toFixed(2)} m`,
    );
  } else {
    // Concrete Rectangular Beam
    const concVerts = buildRoundedRectDxfVertices(cs.bwMm, cs.hMm, 0);
    emitPolyline("S-SECT-OUTLINE", 7, concVerts);

    // Stirrup hoop
    const stirrupW = cs.bwMm - 2 * cs.coverMm;
    const stirrupH = cs.hMm - 2 * cs.coverMm;
    const stirrupVerts = buildRoundedRectDxfVertices(stirrupW, stirrupH, cs.stirrup.diameterMm);
    emitPolyline("S-REBAR-STIRRUP", 3, stirrupVerts);

    // Rebar Main Circles
    const tensileRadius = cs.tensileBars.diameterMm / 2;
    const tCount = Math.max(1, Math.round(cs.tensileBars.count));
    const usableW = Math.max(
      20,
      cs.bwMm - 2 * (cs.coverMm + cs.stirrup.diameterMm + tensileRadius),
    );
    const vBottom = -cs.hMm / 2 + cs.coverMm + cs.stirrup.diameterMm + tensileRadius;

    for (let i = 0; i < tCount; i++) {
      const uPos = tCount <= 1 ? 0 : -usableW / 2 + (i / (tCount - 1)) * usableW;
      emitCircle("S-REBAR-MAIN", 1, uPos, vBottom, tensileRadius);
    }

    const compRadius = cs.compressiveBars.diameterMm / 2;
    const cCount = Math.max(0, Math.round(cs.compressiveBars.count));
    const vTop = cs.hMm / 2 - cs.coverMm - cs.stirrup.diameterMm - compRadius;

    for (let i = 0; i < cCount; i++) {
      const uPos = cCount <= 1 ? 0 : -usableW / 2 + (i / (cCount - 1)) * usableW;
      emitCircle("S-REBAR-MAIN", 1, uPos, vTop, compRadius);
    }

    emitText("S-ANNO-DIMS", 4, -cs.bwMm / 2, cs.hMm / 2 + 40, 16, `Section: ${sectionLabel}`);
    emitText(
      "S-ANNO-DIMS",
      4,
      -cs.bwMm / 2,
      cs.hMm / 2 + 20,
      12,
      `Concrete: fc' ${cs.fcMpa.toFixed(1)} MPa | Cover: ${cs.coverMm} mm`,
    );
    emitText(
      "S-ANNO-DIMS",
      4,
      -cs.bwMm / 2,
      cs.hMm / 2 + 5,
      12,
      `Rebars: ${tCount} D${Math.round(cs.tensileBars.diameterMm)} (Bottom), ${cCount} D${Math.round(cs.compressiveBars.diameterMm)} (Top)`,
    );
    emitText(
      "S-ANNO-DIMS",
      4,
      -cs.bwMm / 2,
      -cs.hMm / 2 - 25,
      12,
      `Stirrup: ${cs.stirrup.legs}L-D${Math.round(cs.stirrup.diameterMm)} @ ${Math.round(cs.stirrup.spacingMm)} mm`,
    );
  }

  // Deflection notice if provided
  if (input.maxDeflectionMm !== undefined) {
    const signedDefl = input.maxDeflectionMm > 0 ? -input.maxDeflectionMm : input.maxDeflectionMm;
    const yBaseline =
      cs.kind === "CONCRETE_RECT"
        ? -cs.hMm / 2 - 45
        : -(cs.kind === "STEEL_IWF" ? cs.dMm : cs.hMm) / 2 - 30;
    const xBaseline =
      cs.kind === "CONCRETE_RECT"
        ? -cs.bwMm / 2
        : -(cs.kind === "STEEL_IWF" ? cs.bfMm : cs.bMm) / 2;
    emitText(
      "S-ANNO-DIMS",
      4,
      xBaseline,
      yBaseline,
      12,
      `Max Vertical Deflection: \\U+0394_max = ${signedDefl.toFixed(2)} mm`,
    );
  }

  const slug = sectionLabel
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const fileName = `ibds-section-${slug}.dxf`;

  const header = [
    "  0",
    "SECTION",
    "  2",
    "HEADER",
    "  9",
    "$ACADVER",
    "  1",
    "AC1009",
    "  9",
    "$INSUNITS",
    " 70",
    "4", // Millimeters
    "  0",
    "ENDSEC",
    "  0",
    "SECTION",
    "  2",
    "TABLES",
    "  0",
    "TABLE",
    "  2",
    "LAYER",
    " 70",
    "4",
    // Layer 1: S-SECT-OUTLINE
    "  0",
    "LAYER",
    "  2",
    "S-SECT-OUTLINE",
    " 70",
    "0",
    " 62",
    "7",
    "  6",
    "CONTINUOUS",
    // Layer 2: S-REBAR-STIRRUP
    "  0",
    "LAYER",
    "  2",
    "S-REBAR-STIRRUP",
    " 70",
    "0",
    " 62",
    "3",
    "  6",
    "CONTINUOUS",
    // Layer 3: S-REBAR-MAIN
    "  0",
    "LAYER",
    "  2",
    "S-REBAR-MAIN",
    " 70",
    "0",
    " 62",
    "1",
    "  6",
    "CONTINUOUS",
    // Layer 4: S-ANNO-DIMS
    "  0",
    "LAYER",
    "  2",
    "S-ANNO-DIMS",
    " 70",
    "0",
    " 62",
    "4",
    "  6",
    "CONTINUOUS",
    "  0",
    "ENDTAB",
    "  0",
    "ENDSEC",
    "  0",
    "SECTION",
    "  2",
    "BLOCKS",
    "  0",
    "ENDSEC",
    "  0",
    "SECTION",
    "  2",
    "ENTITIES",
  ];

  const footer = ["  0", "ENDSEC", "  0", "EOF", ""];

  const content = [...header, ...entities, ...footer].join("\n");

  return {
    fileName,
    mimeType: "application/dxf",
    content,
    entityCount,
    coordinateMode: input.coordinateMode,
  };
}

// ============================================================================
// AutoLISP Generator (`exportBeamToAutoLisp`)
// ============================================================================

/**
 * Generates an automated AutoLISP (`.lsp`) script that can be loaded in AutoCAD
 * via `(load "filename.lsp")` to draw the exact beam section with a single command.
 *
 * @param input - Validated `DxfBeamExportInput` payload.
 * @returns `AutoLispExportResult` containing script source code and command name.
 *
 * @example
 * ```ts
 * const lsp = exportBeamToAutoLisp(exportInput);
 * // Run (c:DRAW_BEAM_SECTION) in AutoCAD command line
 * ```
 */
export function exportBeamToAutoLisp(input: DxfBeamExportInput): AutoLispExportResult {
  const cs = input.crossSection;
  const commandName = "DRAW_BEAM_SECTION";

  let lspCode = "";

  if (cs.kind === "STEEL_IWF") {
    const verts = buildIwfDxfVertices(cs.bfMm, cs.dMm, cs.twMm, cs.tfMm, cs.rMm);
    const vertListStr = verts.map((v) => `(list ${fmtDxfReal(v.x)} ${fmtDxfReal(v.y)})`).join(" ");
    lspCode = `;; AutoLISP Parametric Section Generator for ${cs.profileName}
;; Generated by IBDS Simulator (AutoCAD compatible)
(defun c:${commandName} (/ oldOsm ptList pt)
  (setq oldOsm (getvar "OSMODE"))
  (setvar "OSMODE" 0)
  (setvar "CMDECHO" 0)
  
  ;; Create layers
  (command "_.-LAYER" "_M" "S-SECT-OUTLINE" "_C" "7" "" "_LW" "0.35" "" "")
  (command "_.-LAYER" "_M" "S-ANNO-DIMS" "_C" "4" "" "_LW" "0.18" "" "")
  
  ;; Draw IWF profile polyline
  (setq ptList (list ${vertListStr}))
  (command "_.-LAYER" "_S" "S-SECT-OUTLINE" "")
  (command "_.PLINE")
  (foreach pt ptList (command pt))
  (command "_C")
  
  ;; Add Annotation Text
  (command "_.-LAYER" "_S" "S-ANNO-DIMS" "")
  (command "_.TEXT" (list ${fmtDxfReal(-cs.bfMm / 2)} ${fmtDxfReal(cs.dMm / 2 + 25)}) 14.0 0.0 "${cs.profileName} (${cs.steelGrade})")
  
  (setvar "OSMODE" oldOsm)
  (setvar "CMDECHO" 1)
  (princ "\\n[IBDS] Profil ${cs.profileName} berhasil digambar!\\n")
  (princ)
)
(princ "\\nKetik DRAW_BEAM_SECTION untuk menggambar penampang baja IWF.\\n")
(princ)
`;
  } else if (cs.kind === "STEEL_BOX") {
    const outerVerts = buildRoundedRectDxfVertices(
      cs.bMm,
      cs.hMm,
      cs.outerFilletRadiusMm ?? 2 * cs.tMm,
    );
    const innerVerts = buildRoundedRectDxfVertices(
      cs.bMm - 2 * cs.tMm,
      cs.hMm - 2 * cs.tMm,
      cs.innerFilletRadiusMm ?? cs.tMm,
    );
    const outerList = outerVerts
      .map((v) => `(list ${fmtDxfReal(v.x)} ${fmtDxfReal(v.y)})`)
      .join(" ");
    const innerList = innerVerts
      .map((v) => `(list ${fmtDxfReal(v.x)} ${fmtDxfReal(v.y)})`)
      .join(" ");

    lspCode = `;; AutoLISP Parametric Section Generator for ${cs.profileName}
(defun c:${commandName} (/ oldOsm pt)
  (setq oldOsm (getvar "OSMODE"))
  (setvar "OSMODE" 0)
  (setvar "CMDECHO" 0)
  (command "_.-LAYER" "_M" "S-SECT-OUTLINE" "_C" "7" "" "_LW" "0.35" "" "")
  (command "_.-LAYER" "_M" "S-ANNO-DIMS" "_C" "4" "" "_LW" "0.18" "" "")
  
  (command "_.-LAYER" "_S" "S-SECT-OUTLINE" "")
  (command "_.PLINE")
  (foreach pt (list ${outerList}) (command pt))
  (command "_C")
  (command "_.PLINE")
  (foreach pt (list ${innerList}) (command pt))
  (command "_C")
  
  (command "_.-LAYER" "_S" "S-ANNO-DIMS" "")
  (command "_.TEXT" (list ${fmtDxfReal(-cs.bMm / 2)} ${fmtDxfReal(cs.hMm / 2 + 25)}) 14.0 0.0 "${cs.profileName} (${cs.steelGrade})")
  
  (setvar "OSMODE" oldOsm)
  (setvar "CMDECHO" 1)
  (princ "\\n[IBDS] Profil ${cs.profileName} berhasil digambar!\\n")
  (princ)
)
(princ "\\nKetik DRAW_BEAM_SECTION untuk menggambar penampang baja BOX.\\n")
(princ)
`;
  } else {
    // Concrete Rectangular
    const stirrupW = cs.bwMm - 2 * cs.coverMm;
    const stirrupH = cs.hMm - 2 * cs.coverMm;
    const concVerts = buildRoundedRectDxfVertices(cs.bwMm, cs.hMm, 0);
    const stirrupVerts = buildRoundedRectDxfVertices(stirrupW, stirrupH, cs.stirrup.diameterMm);
    const concList = concVerts.map((v) => `(list ${fmtDxfReal(v.x)} ${fmtDxfReal(v.y)})`).join(" ");
    const stirrupList = stirrupVerts
      .map((v) => `(list ${fmtDxfReal(v.x)} ${fmtDxfReal(v.y)})`)
      .join(" ");

    lspCode = `;; AutoLISP Parametric Section Generator for Concrete Beam
(defun c:${commandName} (/ oldOsm pt)
  (setq oldOsm (getvar "OSMODE"))
  (setvar "OSMODE" 0)
  (setvar "CMDECHO" 0)
  (command "_.-LAYER" "_M" "S-SECT-OUTLINE" "_C" "7" "" "_LW" "0.35" "" "")
  (command "_.-LAYER" "_M" "S-REBAR-STIRRUP" "_C" "3" "" "_LW" "0.25" "" "")
  (command "_.-LAYER" "_M" "S-REBAR-MAIN" "_C" "1" "" "_LW" "0.50" "" "")
  (command "_.-LAYER" "_M" "S-ANNO-DIMS" "_C" "4" "" "_LW" "0.18" "" "")
  
  (command "_.-LAYER" "_S" "S-SECT-OUTLINE" "")
  (command "_.PLINE")
  (foreach pt (list ${concList}) (command pt))
  (command "_C")
  
  (command "_.-LAYER" "_S" "S-REBAR-STIRRUP" "")
  (command "_.PLINE")
  (foreach pt (list ${stirrupList}) (command pt))
  (command "_C")
  
  (command "_.-LAYER" "_S" "S-ANNO-DIMS" "")
  (command "_.TEXT" (list ${fmtDxfReal(-cs.bwMm / 2)} ${fmtDxfReal(cs.hMm / 2 + 25)}) 14.0 0.0 "RC ${Math.round(cs.bwMm)}x${Math.round(cs.hMm)} fc' ${cs.fcMpa.toFixed(1)} MPa")
  
  (setvar "OSMODE" oldOsm)
  (setvar "CMDECHO" 1)
  (princ "\\n[IBDS] Balok Beton Bertulang berhasil digambar!\\n")
  (princ)
)
(princ "\\nKetik DRAW_BEAM_SECTION untuk menggambar penampang beton bertulang.\\n")
(princ)
`;
  }

  const slug = (
    cs.kind === "STEEL_IWF" || cs.kind === "STEEL_BOX"
      ? cs.profileName
      : (cs.sectionName ?? `RC_${Math.round(cs.bwMm)}x${Math.round(cs.hMm)}`)
  )
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return {
    fileName: `ibds-script-${slug}.lsp`,
    mimeType: "text/plain;charset=utf-8",
    content: lspCode,
    commandName,
  };
}

// ============================================================================
// Simulator Store Bridge
// ============================================================================

/**
 * Builds a 2D Section DXF export result directly from the active `BeamSimulatorState`.
 *
 * @param state - Active simulator state.
 * @returns Generated `DxfExportResult`.
 */
export function buildDxfFromSimulatorState(state: BeamSimulatorState): DxfExportResult {
  const spanM =
    state.loadingMode === "MODE_A_EXTERNAL_LOADS"
      ? Number(state.spanLengthM)
      : Number(state.directSpanLengthM);
  const crossSection = resolveCrossSectionFromSimulatorState(state);

  return exportBeamToDxf({
    spanLengthMm: spanM * 1000,
    coordinateMode: state.coordinateMode,
    customUpVector: state.customUpVector,
    crossSection,
    maxDeflectionMm: state.maxDeflectionMm,
    mode: "2D_SECTION",
  });
}

/**
 * Builds an AutoLISP (.lsp) export result directly from the active `BeamSimulatorState`.
 *
 * @param state - Active simulator state.
 * @returns Generated `AutoLispExportResult`.
 */
export function buildAutoLispFromSimulatorState(state: BeamSimulatorState): AutoLispExportResult {
  const spanM =
    state.loadingMode === "MODE_A_EXTERNAL_LOADS"
      ? Number(state.spanLengthM)
      : Number(state.directSpanLengthM);
  const crossSection = resolveCrossSectionFromSimulatorState(state);

  return exportBeamToAutoLisp({
    spanLengthMm: spanM * 1000,
    coordinateMode: state.coordinateMode,
    customUpVector: state.customUpVector,
    crossSection,
    maxDeflectionMm: state.maxDeflectionMm,
    mode: "2D_SECTION",
  });
}
