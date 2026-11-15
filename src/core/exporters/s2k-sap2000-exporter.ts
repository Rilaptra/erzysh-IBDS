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
 * In standard SAP2000 Joint Restraints (Fast Restraints):
 * - Fixed (Jepit): `U1=Yes U2=Yes U3=Yes R1=Yes R2=Yes R3=Yes`
 * - Pinned (Sendi): `U1=Yes U2=Yes U3=Yes R1=No R2=No R3=No`
 * - Roller (Rol): `U1=No U2=No U3=Yes R1=No R2=No R3=No`
 * - Free (Bebas): `U1=No U2=No U3=No R1=No R2=No R3=No`
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
    r1: "No",
    r2: "No",
    r3: "No",
  };
  const roller: Sap2000Restraint6DOF = {
    u1: "No",
    u2: "No",
    u3: "Yes",
    r1: "No",
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
 * Resolves SNI 1729 steel yield ($F_y$) and ultimate ($F_u$) strengths in $\text{MPa}$.
 */
function resolveSteelStrengthMpa(
  steelGrade: string,
  fyOverride?: number,
  fuOverride?: number,
): { readonly fyMpa: number; readonly fuMpa: number } {
  const gradeTable: Record<string, { fy: number; fu: number }> = {
    BJ_34: { fy: 210, fu: 340 },
    BJ_37: { fy: 240, fu: 370 },
    BJ_41: { fy: 250, fu: 410 },
    BJ_50: { fy: 290, fu: 500 },
    BJ_55: { fy: 410, fu: 550 },
  };
  const defaults = gradeTable[steelGrade] ?? { fy: 240, fu: 370 };
  return {
    fyMpa: fyOverride && Number.isFinite(fyOverride) && fyOverride > 0 ? fyOverride : defaults.fy,
    fuMpa: fuOverride && Number.isFinite(fuOverride) && fuOverride > 0 ? fuOverride : defaults.fu,
  };
}

/**
 * Formats a numeric value cleanly for SAP2000 .s2k tables without trailing zeros.
 */
function fmtS2kNum(value: number, decimals = 6): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Number(value.toFixed(decimals));
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

/**
 * Generates an ASCII CSI SAP2000 `.s2k` model file compatible with SAP2000 v22.2.0+
 * database table conventions (`CurrUnits="KN, mm, C"`).
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
 * console.log(s2k.fileName); // "ibds-model-iwf-300x150x6-5x9-0.s2k"
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

  const spanMm = input.spanLengthMm;
  const spanM = spanMm / 1000;
  const frame = resolveExportCoordinateFrame(input.coordinateMode, input.customUpVector);
  const cs = input.crossSection;

  let materialName = "";
  let materialType: "Steel" | "Concrete" = "Steel";
  let materialColor = "Green";
  // Units in "KN, mm, C": kN/mm³, kN*s²/mm⁴, kN/mm² (= GPa)
  let unitWeight = "7.69822E-08"; // 7850 kg/m³ * 9.80665 m/s² -> kN/mm³
  let unitMass = "7.85E-12"; // 7850 kg/m³ -> kN*s²/mm⁴
  let eModulus = "200"; // 200,000 MPa = 200 kN/mm²
  let gModulus = "76.923077";
  let u12 = "0.3";
  let alpha1 = "1.17E-05";
  let materialDetailTableTitle = "";
  let materialDetailLine = "";

  let sectionName = "";
  let sectionShape = "";
  let sectionPropsLine = "";

  if (cs.kind === "STEEL_IWF") {
    materialName = `BJ${cs.steelGrade.replace(/^BJ_?/, "")}`;
    materialType = "Steel";
    materialColor = "Green";
    const { fyMpa, fuMpa } = resolveSteelStrengthMpa(cs.steelGrade, cs.fyMpa, cs.fuMpa);
    const fyKnMm2 = fmtS2kNum(fyMpa / 1000);
    const fuKnMm2 = fmtS2kNum(fuMpa / 1000);
    const effFyKnMm2 = fmtS2kNum((fyMpa * 1.1) / 1000);
    const effFuKnMm2 = fmtS2kNum((fuMpa * 1.1) / 1000);
    materialDetailTableTitle = 'TABLE:  "MATERIAL PROPERTIES 03A - STEEL DATA"';
    materialDetailLine = `   Material=${materialName}   Fy=${fyKnMm2}   Fu=${fuKnMm2}   EffFy=${effFyKnMm2}   EffFu=${effFuKnMm2}   SSCurveOpt=Simple   SSHysType=Kinematic   SHard=0.015   SMax=0.11   SRup=0.17   FinalSlope=-0.1   CoupModType="Von Mises"`;

    sectionName = `IWF-${Math.round(cs.dMm)}x${Math.round(cs.bfMm)}x${cs.twMm.toFixed(1)}x${cs.tfMm.toFixed(1)}`;
    sectionShape = "I/Wide Flange";
    const t3 = fmtS2kNum(cs.dMm);
    const t2 = fmtS2kNum(cs.bfMm);
    const tf = fmtS2kNum(cs.tfMm);
    const tw = fmtS2kNum(cs.twMm);
    sectionPropsLine = `   SectionName="${sectionName}"   Material=${materialName}   Shape="${sectionShape}"   t3=${t3}   t2=${t2}   tf=${tf}   tw=${tw}   t2b=${t2}   tfb=${tf}   ConcCol=No   ConcBeam=No   Color=Blue   FromFile=No   AMod=1   A2Mod=1   A3Mod=1   JMod=1   I2Mod=1   I3Mod=1   MMod=1   WMod=1`;
  } else if (cs.kind === "STEEL_BOX") {
    materialName = `BJ${cs.steelGrade.replace(/^BJ_?/, "")}`;
    materialType = "Steel";
    materialColor = "Green";
    const { fyMpa, fuMpa } = resolveSteelStrengthMpa(cs.steelGrade, cs.fyMpa, cs.fuMpa);
    const fyKnMm2 = fmtS2kNum(fyMpa / 1000);
    const fuKnMm2 = fmtS2kNum(fuMpa / 1000);
    const effFyKnMm2 = fmtS2kNum((fyMpa * 1.1) / 1000);
    const effFuKnMm2 = fmtS2kNum((fuMpa * 1.1) / 1000);
    materialDetailTableTitle = 'TABLE:  "MATERIAL PROPERTIES 03A - STEEL DATA"';
    materialDetailLine = `   Material=${materialName}   Fy=${fyKnMm2}   Fu=${fuKnMm2}   EffFy=${effFyKnMm2}   EffFu=${effFuKnMm2}   SSCurveOpt=Simple   SSHysType=Kinematic   SHard=0.015   SMax=0.11   SRup=0.17   FinalSlope=-0.1   CoupModType="Von Mises"`;

    sectionName = `BOX-${Math.round(cs.hMm)}x${Math.round(cs.bMm)}x${cs.tMm.toFixed(1)}`;
    sectionShape = "Box/Tube";
    const t3 = fmtS2kNum(cs.hMm);
    const t2 = fmtS2kNum(cs.bMm);
    const tWall = fmtS2kNum(cs.tMm);
    sectionPropsLine = `   SectionName="${sectionName}"   Material=${materialName}   Shape="${sectionShape}"   t3=${t3}   t2=${t2}   tf=${tWall}   tw=${tWall}   ConcCol=No   ConcBeam=No   Color=Blue   FromFile=No   AMod=1   A2Mod=1   A3Mod=1   JMod=1   I2Mod=1   I3Mod=1   MMod=1   WMod=1`;
  } else {
    // Concrete Rectangular
    materialName = `CONC_FC${Math.round(cs.fcMpa)}`;
    materialType = "Concrete";
    materialColor = "Yellow";
    unitWeight = "2.35631E-08"; // 2400 kg/m³ * 9.80665 m/s² -> kN/mm³
    unitMass = "2.4028E-12";
    const ecMpa = 4700 * Math.sqrt(Math.max(17, cs.fcMpa));
    const ecKnMm2 = ecMpa / 1000;
    eModulus = fmtS2kNum(ecKnMm2, 6);
    gModulus = fmtS2kNum(ecKnMm2 / (2 * (1 + 0.2)), 6);
    u12 = "0.2";
    alpha1 = "9.9E-06";
    const fcKnMm2 = fmtS2kNum(cs.fcMpa / 1000);
    materialDetailTableTitle = 'TABLE:  "MATERIAL PROPERTIES 03B - CONCRETE DATA"';
    materialDetailLine = `   Material=${materialName}   Fc=${fcKnMm2}   eFc=${fcKnMm2}   LtWtConc=No   SSCurveOpt=Mander   SSHysType=Takeda   SFc=0.00221914   SCap=0.005   FinalSlope=-0.1   FAngle=0   DAngle=0   CoupModType="Modified Darwin-Pecknold"`;

    sectionName = `RC-${Math.round(cs.bwMm)}x${Math.round(cs.hMm)}`;
    sectionShape = "Rectangular";
    const t3 = fmtS2kNum(cs.hMm);
    const t2 = fmtS2kNum(cs.bwMm);
    sectionPropsLine = `   SectionName="${sectionName}"   Material=${materialName}   Shape="${sectionShape}"   t3=${t3}   t2=${t2}   ConcCol=No   ConcBeam=Yes   Color=Yellow   FromFile=No   AMod=1   A2Mod=1   A3Mod=1   JMod=1   I2Mod=1   I3Mod=1   MMod=1   WMod=1`;
  }

  const { joint1, joint2 } = getSap2000JointRestraints(input.supportOrientation);

  // Compute node coordinates in mm based on active coordinate frame
  const ptStart = mapIntrinsicToGlobal(0, 0, 0, frame);
  const ptEnd = mapIntrinsicToGlobal(spanMm, 0, 0, frame);

  const slug = sectionName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const fileName = `ibds-model-${slug}.s2k`;

  const tables: string[] = [];

  // Header line (SAP2000 .s2k standard)
  tables.push(`File ${fileName} was saved on 1/1/26 at 0:00:00`, "");

  // Table 1: Program Control
  tables.push(
    'TABLE:  "PROGRAM CONTROL"',
    '   ProgramName=SAP2000   Version=22.2.0   CurrUnits="KN, mm, C"   SteelCode="AISC 360-16"   ConcCode="ACI 318-14"   RegenHinge=Yes',
    "",
  );

  // Table 2: Active Degrees of Freedom (Default Plane Frame XZ for Z-Up/Y-Up gravity models; full 3D 6-DOF only for CustomXYZ)
  const dofRow =
    input.coordinateMode === "CustomXYZ"
      ? "   UX=Yes   UY=Yes   UZ=Yes   RX=Yes   RY=Yes   RZ=Yes"
      : "   UX=Yes   UY=No   UZ=Yes   RX=No   RY=Yes   RZ=No";
  tables.push('TABLE:  "ACTIVE DEGREES OF FREEDOM"', dofRow, "");

  // Table 3: Coordinate Systems
  tables.push(
    'TABLE:  "COORDINATE SYSTEMS"',
    "   Name=GLOBAL   Type=Cartesian   X=0   Y=0   Z=0   AboutZ=0   AboutY=0   AboutX=0",
    "",
  );

  // Table 4: Grid Lines (with explicit BubbleSize in mm so SAP2000 auto-zoom frames the span properly)
  const bubbleSizeMm = fmtS2kNum(Math.max(500, Math.min(2500, spanMm * 0.15)), 0);
  tables.push(
    'TABLE:  "GRID LINES"',
    `   CoordSys=GLOBAL   AxisDir=X   XRYZCoord=0   LineType=Primary   LineColor=Gray8Dark   Visible=Yes   BubbleLoc=End   AllVisible=Yes   BubbleSize=${bubbleSizeMm}`,
    `   CoordSys=GLOBAL   AxisDir=X   XRYZCoord=${fmtS2kNum(spanMm)}   LineType=Primary   LineColor=Gray8Dark   Visible=Yes   BubbleLoc=End   AllVisible=Yes`,
    "   CoordSys=GLOBAL   AxisDir=Y   XRYZCoord=0   LineType=Primary   LineColor=Gray8Dark   Visible=Yes   BubbleLoc=Start   AllVisible=Yes",
    "   CoordSys=GLOBAL   AxisDir=Z   XRYZCoord=0   LineType=Primary   LineColor=Gray8Dark   Visible=Yes   BubbleLoc=End   AllVisible=Yes",
    "",
  );

  // Table 5: Material Properties 01 - General (MUST precede 02 - Basic Mechanical Properties)
  tables.push(
    'TABLE:  "MATERIAL PROPERTIES 01 - GENERAL"',
    `   Material=${materialName}   Type=${materialType}   SymType=Isotropic   TempDepend=No   Color=${materialColor}`,
    "",
  );

  // Table 6: Material Properties 02 - Basic Mechanical Properties
  tables.push(
    'TABLE:  "MATERIAL PROPERTIES 02 - BASIC MECHANICAL PROPERTIES"',
    `   Material=${materialName}   UnitWeight=${unitWeight}   UnitMass=${unitMass}   E1=${eModulus}   G12=${gModulus}   U12=${u12}   A1=${alpha1}`,
    "",
  );

  // Table 7: Material Properties 03A / 03B - Steel or Concrete Data
  tables.push(materialDetailTableTitle, materialDetailLine, "");

  // Table 8: Material Properties 06 - Damping Parameters
  tables.push(
    'TABLE:  "MATERIAL PROPERTIES 06 - DAMPING PARAMETERS"',
    `   Material=${materialName}   ModalRatio=0   VisMass=0   VisStiff=0   HysMass=0   HysStiff=0`,
    "",
  );

  // Table 9: Frame Section Properties 01 - General
  tables.push('TABLE:  "FRAME SECTION PROPERTIES 01 - GENERAL"', sectionPropsLine, "");

  // Table 10: Load Pattern Definitions
  const selfWtMult = input.includeSelfWeight ? 1 : 0;
  tables.push(
    'TABLE:  "LOAD PATTERN DEFINITIONS"',
    `   LoadPat=DEAD   DesignType=Dead   SelfWtMult=${selfWtMult}`,
    "   LoadPat=LIVE   DesignType=Live   SelfWtMult=0",
    "",
  );

  // Table 11: Load Case Definitions
  tables.push(
    'TABLE:  "LOAD CASE DEFINITIONS"',
    '   Case=DEAD   Type=LinStatic   InitialCond=Zero   DesTypeOpt="Prog Det"   DesignType=Dead   DesActOpt="Prog Det"   DesignAct=Non-Composite   AutoType=None   RunCase=Yes',
    '   Case=LIVE   Type=LinStatic   InitialCond=Zero   DesTypeOpt="Prog Det"   DesignType=Live   DesActOpt="Prog Det"   DesignAct=Non-Composite   AutoType=None   RunCase=Yes',
    "",
  );

  // Table 12: Case - Static 1 - Load Assignments
  tables.push(
    'TABLE:  "CASE - STATIC 1 - LOAD ASSIGNMENTS"',
    '   Case=DEAD   LoadType="Load pattern"   LoadName=DEAD   LoadSF=1',
    '   Case=LIVE   LoadType="Load pattern"   LoadName=LIVE   LoadSF=1',
    "",
  );

  // Table 13: Disable code auto-generated load combinations (e.g., 1.2D + 1.6L DSTL2) so SAP2000
  // evaluates the website's already-factored input loads (1.0x) instead of double-factoring LIVE by 1.6x.
  const isSteelSection =
    input.crossSection.kind === "STEEL_IWF" || input.crossSection.kind === "STEEL_BOX";
  tables.push(
    'TABLE:  "AUTO COMBINATION OPTION DATA 01 - GENERAL"',
    "   DesignType=Steel   AutoGen=No",
    "   DesignType=Concrete   AutoGen=No",
    "",
    'TABLE:  "COMBINATION DEFINITIONS"',
    `   ComboName=IBDS_ULT   ComboType="Linear Add"   AutoDesign=No   CaseName=DEAD   ScaleFactor=1   SteelDesign=${isSteelSection ? "Strength" : "None"}   ConcDesign=${isSteelSection ? "None" : "Strength"}   AlumDesign=None   ColdDesign=None   Notes="IBDS Factored Ultimate (1.0x)"`,
    "   ComboName=IBDS_ULT   CaseName=LIVE   ScaleFactor=1",
    "",
  );

  // Table 13: Joint Coordinates
  tables.push(
    'TABLE:  "JOINT COORDINATES"',
    `   Joint=1   CoordSys=GLOBAL   CoordType=Cartesian   XorR=${fmtS2kNum(ptStart.x)}   Y=${fmtS2kNum(ptStart.y)}   Z=${fmtS2kNum(ptStart.z)}   SpecialJt=No`,
    `   Joint=2   CoordSys=GLOBAL   CoordType=Cartesian   XorR=${fmtS2kNum(ptEnd.x)}   Y=${fmtS2kNum(ptEnd.y)}   Z=${fmtS2kNum(ptEnd.z)}   SpecialJt=No`,
    "",
  );

  // Table 14: Connectivity - Frame
  tables.push(
    'TABLE:  "CONNECTIVITY - FRAME"',
    "   Frame=1   JointI=1   JointJ=2   IsCurved=No",
    "",
  );

  // Table 15: Joint Restraints
  tables.push(
    'TABLE:  "JOINT RESTRAINT ASSIGNMENTS"',
    `   Joint=1   U1=${joint1.u1}   U2=${joint1.u2}   U3=${joint1.u3}   R1=${joint1.r1}   R2=${joint1.r2}   R3=${joint1.r3}`,
    `   Joint=2   U1=${joint2.u1}   U2=${joint2.u2}   U3=${joint2.u3}   R1=${joint2.r1}   R2=${joint2.r2}   R3=${joint2.r3}`,
    "",
  );

  // Table 16: Frame Section Assignments (AnalSect & DesignSect, NOT SectionName)
  tables.push(
    'TABLE:  "FRAME SECTION ASSIGNMENTS"',
    `   Frame=1   SectionType="${sectionShape}"   AutoSelect=N.A.   AnalSect="${sectionName}"   DesignSect="${sectionName}"   MatProp=Default`,
    "",
  );

  // Table 17: Frame Output Station & Auto Mesh & Load Transfer
  tables.push(
    'TABLE:  "FRAME OUTPUT STATION ASSIGNMENTS"',
    "   Frame=1   StationType=MaxStaSpcg   MaxStaSpcg=500   AddAtElmInt=Yes   AddAtPtLoad=Yes",
    "",
    'TABLE:  "FRAME AUTO MESH ASSIGNMENTS"',
    "   Frame=1   AutoMesh=Yes   AtJoints=Yes   AtFrames=No   NumSegments=0   MaxLength=0   MaxDegrees=0",
    "",
    'TABLE:  "FRAME LOAD TRANSFER OPTIONS"',
    "   Frame=1   Transfer=Yes",
    "",
  );

  // Table 18: Frame Loads - Point (uses Force=..., AbsDist in mm)
  if (input.pointLoads && input.pointLoads.length > 0) {
    const lines: string[] = ['TABLE:  "FRAME LOADS - POINT"'];
    for (const pl of input.pointLoads) {
      const absDistM = Math.max(0, Math.min(spanM, Number(pl.position)));
      const absDistMm = absDistM * 1000;
      const relDist = Math.max(0, Math.min(1, absDistM / spanM));
      const forceKn = fmtS2kNum(Number(pl.magnitude), 4);
      lines.push(
        `   Frame=1   LoadPat=LIVE   CoordSys=GLOBAL   Type=Force   Dir=Gravity   DistType=RelDist   RelDist=${fmtS2kNum(relDist)}   AbsDist=${fmtS2kNum(absDistMm)}   Force=${forceKn}`,
      );
    }
    lines.push("");
    tables.push(...lines);
  }

  // Table 19: Frame Loads - Distributed (uses FOverLA/FOverLB in kN/mm, AbsDistA/B in mm)
  if (input.distributedLoads && input.distributedLoads.length > 0) {
    const lines: string[] = ['TABLE:  "FRAME LOADS - DISTRIBUTED"'];
    for (const dl of input.distributedLoads) {
      const rawA = Number(dl.startPosition);
      const rawB = Number(dl.endPosition);
      const absDistAM = Math.max(0, Math.min(spanM, Math.min(rawA, rawB)));
      const absDistBM = Math.max(0, Math.min(spanM, Math.max(rawA, rawB)));
      const absDistAMm = absDistAM * 1000;
      const absDistBMm = absDistBM * 1000;
      const relDistA = Math.max(0, Math.min(1, absDistAM / spanM));
      const relDistB = Math.max(0, Math.min(1, absDistBM / spanM));
      const fOverLKnPerMm = fmtS2kNum(Number(dl.magnitude) / 1000, 6);
      lines.push(
        `   Frame=1   LoadPat=LIVE   CoordSys=GLOBAL   Type=Force   Dir=Gravity   DistType=RelDist   RelDistA=${fmtS2kNum(relDistA)}   RelDistB=${fmtS2kNum(relDistB)}   AbsDistA=${fmtS2kNum(absDistAMm)}   AbsDistB=${fmtS2kNum(absDistBMm)}   FOverLA=${fOverLKnPerMm}   FOverLB=${fOverLKnPerMm}`,
      );
    }
    lines.push("");
    tables.push(...lines);
  }

  // Table 20: Dimensional Preferences & Database Format Types
  tables.push(
    'TABLE:  "PREFERENCES - DIMENSIONAL"',
    "   MergeTol=1   FineGrid=250   Nudge=250   SelectTol=3   SnapTol=12   SLineThick=2   PLineThick=4   MaxFont=8   MinFont=3   AutoZoom=10   ShrinkFact=70   TextFileLen=240",
    "",
    'TABLE:  "DATABASE FORMAT TYPES"',
    "   UnitsCurr=Yes   OverrideE=No",
    "",
  );

  // End of Tables
  tables.push("END TABLE DATA");

  const content = tables.join("\r\n");
  const tableCount = tables.filter((line) => line.startsWith("TABLE:")).length;

  return {
    fileName,
    mimeType: "text/plain;charset=utf-8",
    content,
    tableCount,
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
