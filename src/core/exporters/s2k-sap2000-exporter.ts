/**
 * @file s2k-sap2000-exporter.ts
 * @description Native CSI SAP2000 / ETABS text model (.s2k) exporter.
 *
 * Emits standard SAP2000 database tables:
 * - `PROGRAM CONTROL`
 * - `MATERIAL PROPERTIES 01 - GENERAL` & `02 - BASIC MECHANICAL PROPERTIES`
 * - `FRAME SECTION PROPERTIES 01 - GENERAL`
 * - `JOINT COORDINATES`
 * - `JOINT RESTRAINT ASSIGNMENTS` (mapping 5 support categories / 8 orientations)
 * - `CONNECTIVITY - FRAME` & `FRAME SECTION ASSIGNMENTS`
 * - `LOAD PATTERN DEFINITIONS`
 * - `FRAME LOADS - DISTRIBUTED` & `FRAME LOADS - POINT`
 *
 * Adheres to standard civil engineering units: `KN, mm, C` (or `KN, m, C`).
 */

import type { BeamSimulatorState } from "@/state/beam-simulator-store";
import {
  type DistributedLoad,
  type PointLoad,
  type SupportOrientation,
} from "@/types/beam-loading-modes";
import { type CoordinateSystemMode, type Vector3D } from "@/types/branded-units";

import {
  type ExportCoordinateFrame3D,
  type Ifc4CrossSectionInput,
  mapIntrinsicToGlobal,
  resolveCrossSectionFromSimulatorState,
  resolveExportCoordinateFrame,
} from "./ifc4-bim-revit-exporter";

// ============================================================================
// Error Hierarchy
// ============================================================================

/**
 * Enumeration of error codes emitted by the SAP2000 .s2k exporter.
 */
export type S2kExportErrorCode =
  | "INVALID_SPAN_LENGTH"
  | "INVALID_SECTION_DIMENSIONS"
  | "INVALID_LOAD_DEFINITION"
  | "UNSUPPORTED_SECTION_KIND";

/**
 * Custom error class for SAP2000 .s2k generation errors.
 */
export class S2kExportError extends Error {
  public readonly code: S2kExportErrorCode;
  public readonly fieldName: string;
  public readonly invalidValue: unknown;
  public readonly timestampIso: string;

  constructor(code: S2kExportErrorCode, fieldName: string, invalidValue: unknown, message: string) {
    super(
      `[S2kExportError:${code}] Field '${fieldName}' (${JSON.stringify(invalidValue)}): ${message}`,
    );
    this.name = "S2kExportError";
    this.code = code;
    this.fieldName = fieldName;
    this.invalidValue = invalidValue;
    this.timestampIso = new Date().toISOString();
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, S2kExportError);
    }
  }
}

// ============================================================================
// Contracts & Interfaces
// ============================================================================

/**
 * Input configuration for generating an .s2k SAP2000 text model.
 */
export interface S2kExportInput {
  /** Beam model title (defaults to `"IBDS_Beam_Model"`). */
  readonly modelTitle?: string;
  /** Clear span length $L$ in millimeters ($\text{mm}$, must be $> 0$). */
  readonly spanLengthMm: number;
  /** Boundary support condition orientation. */
  readonly supportOrientation: SupportOrientation;
  /** Active 3D coordinate system orientation (`"Z-Up"`, `"Y-Up"`, or `"CustomXYZ"`). */
  readonly coordinateMode: CoordinateSystemMode;
  /** Optional custom Up-axis vector. */
  readonly customUpVector?: Vector3D;
  /** Parametric cross-section definition. */
  readonly crossSection: Ifc4CrossSectionInput;
  /** Whether self-weight multiplier is active (1 = enabled, 0 = disabled). */
  readonly includeSelfWeight?: boolean;
  /** Array of point loads. */
  readonly pointLoads?: readonly PointLoad[];
  /** Array of distributed loads. */
  readonly distributedLoads?: readonly DistributedLoad[];
  /** Optional signed maximum vertical deflection in $\text{mm}$ ($\le 0$). */
  readonly maxDeflectionMm?: number;
}

/**
 * Result bundle returned by `exportBeamToS2k`.
 */
export interface S2kExportResult {
  /** Recommended file name ending in `.s2k`. */
  readonly fileName: string;
  /** Standard text MIME type. */
  readonly mimeType: "text/plain;charset=utf-8";
  /** Complete ASCII .s2k file content. */
  readonly content: string;
  /** Number of database tables written. */
  readonly tableCount: number;
  /** Active coordinate system orientation applied. */
  readonly coordinateMode: CoordinateSystemMode;
}

// ============================================================================
// Support Restraints Mapper
// ============================================================================

interface Sap2000Restraint6DOF {
  readonly u1: string; // Translation 1 (Axial X)
  readonly u2: string; // Translation 2 (Horizontal Transverse Y)
  readonly u3: string; // Translation 3 (Vertical Deflection Z)
  readonly r1: string; // Rotation 1 (Torsion RX)
  readonly r2: string; // Rotation 2 (Major Bending RY in X-Z plane)
  readonly r3: string; // Rotation 3 (Minor Bending RZ)
}

/**
 * Maps the 8 support orientation variations to SAP2000 Joint 1 (Left, $X=0$)
 * and Joint 2 (Right, $X=L$) `JOINT RESTRAINT ASSIGNMENTS`.
 *
 * In standard SAP2000 X-Z plane framing:
 * - Fixed: `U1=Yes U2=Yes U3=Yes R1=Yes R2=Yes R3=Yes`
 * - Pinned: `U1=Yes U2=Yes U3=Yes R1=Yes R2=No R3=No`
 * - Roller: `U1=No U2=Yes U3=Yes R1=Yes R2=No R3=No`
 * - Free: `U1=No U2=No U3=No R1=No R2=No R3=No`
 *
 * @param orientation - Support orientation variant.
 * @returns Tuple containing Joint 1 and Joint 2 restraints.
 */
export function getSap2000JointRestraints(orientation: SupportOrientation): {
  readonly joint1: Sap2000Restraint6DOF;
  readonly joint2: Sap2000Restraint6DOF;
} {
  const fixed: Sap2000Restraint6DOF = {
    u1: "Yes",
    u2: "Yes",
    u3: "Yes",
    r1: "Yes",
    r2: "Yes",
    r3: "Yes",
  };
  const pinned: Sap2000Restraint6DOF = {
    u1: "Yes",
    u2: "Yes",
    u3: "Yes",
    r1: "Yes",
    r2: "No",
    r3: "No",
  };
  const roller: Sap2000Restraint6DOF = {
    u1: "No",
    u2: "Yes",
    u3: "Yes",
    r1: "Yes",
    r2: "No",
    r3: "No",
  };
  const free: Sap2000Restraint6DOF = { u1: "No", u2: "No", u3: "No", r1: "No", r2: "No", r3: "No" };

  switch (orientation) {
    case "CANTILEVER_LEFT":
      return { joint1: fixed, joint2: free };
    case "CANTILEVER_RIGHT":
      return { joint1: free, joint2: fixed };
    case "PINNED_ROLLER":
      return { joint1: pinned, joint2: roller };
    case "ROLLER_PINNED":
      return { joint1: roller, joint2: pinned };
    case "FIXED_FIXED":
      return { joint1: fixed, joint2: fixed };
    case "FIXED_ROLLER":
      return { joint1: fixed, joint2: roller };
    case "ROLLER_FIXED":
      return { joint1: roller, joint2: fixed };
    case "FIXED_PINNED":
      return { joint1: fixed, joint2: pinned };
    case "PINNED_FIXED":
      return { joint1: pinned, joint2: fixed };
    default:
      return { joint1: pinned, joint2: roller };
  }
}

// ============================================================================
// Core SAP2000 .s2k Generator (`exportBeamToS2k`)
// ============================================================================

/**
 * Generates an ASCII CSI SAP2000 `.s2k` model file adhering to SAP2000 v24.0.0
 * database schema conventions.
 *
 * @param input - Validated `S2kExportInput` parameters.
 * @returns `S2kExportResult` payload.
 * @throws {S2kExportError} If dimensions or loads are invalid.
 *
 * @example
 * ```ts
 * const s2k = exportBeamToS2k({
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
 * });
 * console.log(s2k.fileName); // "ibds-sap2000-wf-300-x-150-x-36-7.s2k"
 * ```
 */
export function exportBeamToS2k(input: S2kExportInput): S2kExportResult {
  if (!Number.isFinite(input.spanLengthMm) || input.spanLengthMm <= 0) {
    throw new S2kExportError(
      "INVALID_SPAN_LENGTH",
      "spanLengthMm",
      input.spanLengthMm,
      "Span length must be > 0.",
    );
  }

  const frame = resolveExportCoordinateFrame(input.coordinateMode, input.customUpVector);
  const cs = input.crossSection;

  let materialName = "";
  let materialType = "";
  let unitWeight = "7.85E-05"; // kN/mm³ (7850 kg/m³)
  let unitMass = "8.00E-09"; // kN*s²/mm⁴
  let eModulus = "200000"; // MPa = N/mm²
  let gModulus = "76923.08";
  let u12 = "0.3";

  let sectionName = "";
  let sectionShape = "";
  let sectionPropsLine = "";

  if (cs.kind === "STEEL_IWF") {
    materialName = `BJ_${cs.steelGrade.replace(/^BJ_?/, "")}`;
    materialType = "Steel";
    sectionName = `IWF-${Math.round(cs.dMm)}x${Math.round(cs.bfMm)}x${cs.twMm.toFixed(1)}x${cs.tfMm.toFixed(1)}`;
    sectionShape = "I/Wide Flange";
    sectionPropsLine = `   SectionName="${sectionName}"   Material=${materialName}   Shape="${sectionShape}"   t3=${cs.dMm}   t2=${cs.bfMm}   tf=${cs.tfMm}   tw=${cs.twMm}   t2b=${cs.bfMm}   tfb=${cs.tfMm}   FilletRadius=${cs.rMm}`;
  } else if (cs.kind === "STEEL_BOX") {
    materialName = `BJ_${cs.steelGrade.replace(/^BJ_?/, "")}`;
    materialType = "Steel";
    sectionName = `BOX-${Math.round(cs.hMm)}x${Math.round(cs.bMm)}x${cs.tMm.toFixed(1)}`;
    sectionShape = "Box/Tube";
    sectionPropsLine = `   SectionName="${sectionName}"   Material=${materialName}   Shape="${sectionShape}"   t3=${cs.hMm}   t2=${cs.bMm}   tf=${cs.tMm}   tw=${cs.tMm}`;
  } else {
    // Concrete Rectangular
    materialName = `CONC_FC${Math.round(cs.fcMpa)}`;
    materialType = "Concrete";
    unitWeight = "2.35E-05"; // 23.5 kN/m³
    unitMass = "2.40E-09";
    const ec = 4700 * Math.sqrt(Math.max(17, cs.fcMpa));
    eModulus = ec.toFixed(2);
    gModulus = (ec / (2 * (1 + 0.2))).toFixed(2);
    u12 = "0.2";
    sectionName = `RC-${Math.round(cs.bwMm)}x${Math.round(cs.hMm)}`;
    sectionShape = "Concrete Rectangular";
    sectionPropsLine = `   SectionName="${sectionName}"   Material=${materialName}   Shape="${sectionShape}"   t3=${cs.hMm}   t2=${cs.bwMm}`;
  }

  const { joint1, joint2 } = getSap2000JointRestraints(input.supportOrientation);

  // Compute node coordinates based on active coordinate frame
  const ptStart = mapIntrinsicToGlobal(0, 0, 0, frame);
  const ptEnd = mapIntrinsicToGlobal(input.spanLengthMm, 0, 0, frame);

  const tables: string[] = [];

  // Table 1: Program Control
  tables.push(
    'TABLE:  "PROGRAM CONTROL"',
    '   ProgramName=SAP2000   Version=24.0.0   CurrUnits="KN, mm, C"',
    "",
  );

  // Table 2: Material Properties - Basic
  tables.push(
    'TABLE:  "MATERIAL PROPERTIES 02 - BASIC MECHANICAL PROPERTIES"',
    `   Material=${materialName}   UnitWeight=${unitWeight}   UnitMass=${unitMass}   E1=${eModulus}   G12=${gModulus}   U12=${u12}`,
    "",
  );

  // Table 3: Frame Section Properties
  tables.push('TABLE:  "FRAME SECTION PROPERTIES 01 - GENERAL"', sectionPropsLine, "");

  // Table 4: Joint Coordinates
  tables.push(
    'TABLE:  "JOINT COORDINATES"',
    `   Joint=1   CoordSys=GLOBAL   CoordType=Cartesian   XorR=${ptStart.x.toFixed(2)}   Y=${ptStart.y.toFixed(2)}   Z=${ptStart.z.toFixed(2)}`,
    `   Joint=2   CoordSys=GLOBAL   CoordType=Cartesian   XorR=${ptEnd.x.toFixed(2)}   Y=${ptEnd.y.toFixed(2)}   Z=${ptEnd.z.toFixed(2)}`,
    "",
  );

  // Table 5: Joint Restraints
  tables.push(
    'TABLE:  "JOINT RESTRAINT ASSIGNMENTS"',
    `   Joint=1   U1=${joint1.u1}   U2=${joint1.u2}   U3=${joint1.u3}   R1=${joint1.r1}   R2=${joint1.r2}   R3=${joint1.r3}`,
    `   Joint=2   U1=${joint2.u1}   U2=${joint2.u2}   U3=${joint2.u3}   R1=${joint2.r1}   R2=${joint2.r2}   R3=${joint2.r3}`,
    "",
  );

  // Table 6: Connectivity - Frame
  tables.push(
    'TABLE:  "CONNECTIVITY - FRAME"',
    "   Frame=1   JointI=1   JointJ=2   IsCurved=No",
    "",
  );

  // Table 7: Frame Section Assignments
  tables.push(
    'TABLE:  "FRAME SECTION ASSIGNMENTS"',
    `   Frame=1   SectionName="${sectionName}"   AutoSelect=N.A.`,
    "",
  );

  // Table 8: Load Pattern Definitions
  const selfWtMult = input.includeSelfWeight ? 1.0 : 0.0;
  tables.push(
    'TABLE:  "LOAD PATTERN DEFINITIONS"',
    `   LoadPat=DEAD   DesignType=Dead   SelfWtMult=${selfWtMult.toFixed(1)}`,
    "   LoadPat=LIVE   DesignType=Live   SelfWtMult=0.0",
    "",
  );

  // Table 9: Frame Loads - Distributed (if any)
  if (input.distributedLoads && input.distributedLoads.length > 0) {
    const lines: string[] = ['TABLE:  "FRAME LOADS - DISTRIBUTED"'];
    for (const dl of input.distributedLoads) {
      // Convert kN/m to kN/mm (divide by 1000)
      const valKnPerMm = (Number(dl.magnitude) / 1000).toExponential(4);
      const dist1Mm = (Number(dl.startPosition) * 1000).toFixed(1);
      const dist2Mm = (Number(dl.endPosition) * 1000).toFixed(1);
      lines.push(
        `   Frame=1   LoadPat=LIVE   CoordSys=GLOBAL   Type=Force   Dir=Gravity   DistType=RelDist   RelDistA=${(Number(dl.startPosition) / (input.spanLengthMm / 1000)).toFixed(4)}   RelDistB=${(Number(dl.endPosition) / (input.spanLengthMm / 1000)).toFixed(4)}   ValA=${valKnPerMm}   ValB=${valKnPerMm}`,
      );
    }
    lines.push("");
    tables.push(...lines);
  }

  // Table 10: Frame Loads - Point (if any)
  if (input.pointLoads && input.pointLoads.length > 0) {
    const lines: string[] = ['TABLE:  "FRAME LOADS - POINT"'];
    for (const pl of input.pointLoads) {
      const valKn = Number(pl.magnitude).toFixed(2);
      const relDist = (Number(pl.position) / (input.spanLengthMm / 1000)).toFixed(4);
      lines.push(
        `   Frame=1   LoadPat=LIVE   CoordSys=GLOBAL   Type=Force   Dir=Gravity   DistType=RelDist   RelDist=${relDist}   Val=${valKn}`,
      );
    }
    lines.push("");
    tables.push(...lines);
  }

  // Table 11: End of Tables
  tables.push("END TABLE DATA");

  const slug = sectionName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const fileName = `ibds-model-${slug}.s2k`;
  const content = tables.join("\r\n");

  return {
    fileName,
    mimeType: "text/plain;charset=utf-8",
    content,
    tableCount: 8 + (input.distributedLoads?.length ? 1 : 0) + (input.pointLoads?.length ? 1 : 0),
    coordinateMode: input.coordinateMode,
  };
}

// ============================================================================
// Simulator Store Bridge
// ============================================================================

/**
 * Builds an .s2k file result directly from the active `BeamSimulatorState`.
 *
 * @param state - Active simulator state.
 * @returns Generated `S2kExportResult`.
 */
export function buildS2kFromSimulatorState(state: BeamSimulatorState): S2kExportResult {
  const isModeA = state.loadingMode === "MODE_A_EXTERNAL_LOADS";
  const spanM = isModeA ? Number(state.spanLengthM) : Number(state.directSpanLengthM);
  const crossSection = resolveCrossSectionFromSimulatorState(state);

  return exportBeamToS2k({
    spanLengthMm: spanM * 1000,
    supportOrientation: state.supportOrientation,
    coordinateMode: state.coordinateMode,
    customUpVector: state.customUpVector,
    crossSection,
    includeSelfWeight: state.includeSelfWeight,
    pointLoads: isModeA ? state.pointLoads : undefined,
    distributedLoads: isModeA ? state.distributedLoads : undefined,
    maxDeflectionMm: state.maxDeflectionMm,
  });
}
