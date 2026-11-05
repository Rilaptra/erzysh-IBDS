/**
 * @file ideastatica-exporter.ts
 * @description Native IDEA StatiCa Open Model XML (.iom.xml) exporter for structural steel
 * connection design and member buckling analysis in IDEA StatiCa Connection & Member.
 *
 * Emits complete IDEA Open Model schema:
 * - `Materials` (`MatSteel` with $f_y, f_u, E, G, \nu$, or `MatConcrete` with $f'_c, E_c$).
 * - `CrossSections` (`CrossSectionParameter` for `RolledI`, `RolledRHS`, or `Rectangular`).
 * - `Nodes` (`Point3D` in meters $(X, Y, Z)$ transformed by active coordinate frame).
 * - `LineSegments` (`LineSegment3D` linking Node 1 to Node 2).
 * - `Elements1D` & `Members1D` (`ModelElement1D` definition).
 * - `ConnectionPoints` (Start connection and End connection).
 * - `OpenModelResult` with governing internal forces ($N = P_u, V_z = V_u, M_y = M_{ux}, M_z = M_{uy}, T_x = T_u$).
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
// Error Hierarchy
// ============================================================================

/**
 * Enumeration of error codes emitted by the IDEA StatiCa exporter.
 */
export type IdeaStaticaExportErrorCode =
  | "INVALID_SPAN_LENGTH"
  | "INVALID_SECTION_DIMENSIONS"
  | "INVALID_INTERNAL_FORCES"
  | "UNSUPPORTED_SECTION_KIND";

/**
 * Custom error class for IDEA StatiCa export exceptions.
 */
export class IdeaStaticaExportError extends Error {
  public readonly code: IdeaStaticaExportErrorCode;
  public readonly fieldName: string;
  public readonly invalidValue: unknown;
  public readonly timestampIso: string;

  constructor(
    code: IdeaStaticaExportErrorCode,
    fieldName: string,
    invalidValue: unknown,
    message: string,
  ) {
    super(
      `[IdeaStaticaExportError:${code}] Field '${fieldName}' (${JSON.stringify(invalidValue)}): ${message}`,
    );
    this.name = "IdeaStaticaExportError";
    this.code = code;
    this.fieldName = fieldName;
    this.invalidValue = invalidValue;
    this.timestampIso = new Date().toISOString();
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, IdeaStaticaExportError);
    }
  }
}

// ============================================================================
// Data Contracts
// ============================================================================

/**
 * Factored internal forces set for IDEA StatiCa connection loading.
 */
export interface IdeaStaticaInternalForcesInput {
  /** Factored axial force $N$ ($P_u$) in $\text{kN}$ (Tension positive, Compression negative). */
  readonly axialForcePuKn: number;
  /** Factored shear force $V_z$ ($V_u$) in $\text{kN}$. */
  readonly shearForceVuKn: number;
  /** Factored transverse shear force $V_y$ in $\text{kN}$ (default `0`). */
  readonly shearForceVyKn?: number;
  /** Factored strong-axis bending moment $M_y$ ($M_{ux}$) in $\text{kNm}$. */
  readonly momentMuxKnm: number;
  /** Factored weak-axis bending moment $M_z$ ($M_{uy}$) in $\text{kNm}$ (default `0`). */
  readonly momentMuyKnm?: number;
  /** Factored torsional moment $T_x$ ($T_u$) in $\text{kNm}$ (default `0`). */
  readonly torsionTuKnm?: number;
}

/**
 * Complete input configuration for `exportBeamToIdeaOpenModelXml`.
 */
export interface IdeaStaticaExportInput {
  /** Model / project name. */
  readonly modelName?: string;
  /** Clear span length $L$ in millimeters ($\text{mm}$, must be $> 0$). */
  readonly spanLengthMm: number;
  /** Active 3D coordinate system orientation (`"Z-Up"`, `"Y-Up"`, or `"CustomXYZ"`). */
  readonly coordinateMode: CoordinateSystemMode;
  /** Optional custom Up-axis vector. */
  readonly customUpVector?: Vector3D;
  /** Parametric cross-section definition. */
  readonly crossSection: Ifc4CrossSectionInput;
  /** Factored internal forces applied at critical design points. */
  readonly internalForces: IdeaStaticaInternalForcesInput;
  /** Optional signed maximum vertical deflection in $\text{mm}$ ($\le 0$). */
  readonly maxDeflectionMm?: number;
}

/**
 * Output payload returned by `exportBeamToIdeaOpenModelXml`.
 */
export interface IdeaStaticaExportResult {
  /** Recommended file name ending in `.iom.xml`. */
  readonly fileName: string;
  /** Standard XML MIME type. */
  readonly mimeType: "application/xml;charset=utf-8";
  /** Complete XML string. */
  readonly content: string;
  /** Active coordinate mode. */
  readonly coordinateMode: CoordinateSystemMode;
}

// ============================================================================
// XML Helper
// ============================================================================

function escXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ============================================================================
// Core IDEA Open Model Generator (`exportBeamToIdeaOpenModelXml`)
// ============================================================================

/**
 * Generates an IDEA Open Model XML (`.iom.xml`) file adhering to the IDEA StatiCa
 * Open Model specification (SI Units: Meters, Newtons, Pascal, Newton-Meters).
 *
 * @param input - Validated `IdeaStaticaExportInput` configuration.
 * @returns `IdeaStaticaExportResult` containing the `.iom.xml` content.
 * @throws {IdeaStaticaExportError} If parameters are non-physical or invalid.
 *
 * @example
 * ```ts
 * const iom = exportBeamToIdeaOpenModelXml({
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
 *   internalForces: {
 *     axialForcePuKn: 0,
 *     shearForceVuKn: 80,
 *     momentMuxKnm: 120,
 *   },
 * });
 * console.log(iom.fileName); // "ibds-ideastatica-wf-300-x-150-x-36-7.iom.xml"
 * ```
 */
export function exportBeamToIdeaOpenModelXml(
  input: IdeaStaticaExportInput,
): IdeaStaticaExportResult {
  if (!Number.isFinite(input.spanLengthMm) || input.spanLengthMm <= 0) {
    throw new IdeaStaticaExportError(
      "INVALID_SPAN_LENGTH",
      "spanLengthMm",
      input.spanLengthMm,
      "Span length must be > 0.",
    );
  }

  const frame = resolveExportCoordinateFrame(input.coordinateMode, input.customUpVector);
  const cs = input.crossSection;
  const spanM = input.spanLengthMm / 1000;

  // Transform coordinates to global meters (SI standard for IOM)
  const ptStartMm = mapIntrinsicToGlobal(0, 0, 0, frame);
  const ptEndMm = mapIntrinsicToGlobal(input.spanLengthMm, 0, 0, frame);
  const p1 = { x: ptStartMm.x / 1000, y: ptStartMm.y / 1000, z: ptStartMm.z / 1000 };
  const p2 = { x: ptEndMm.x / 1000, y: ptEndMm.y / 1000, z: ptEndMm.z / 1000 };

  // Convert internal forces to SI (N and Nm)
  const forces = input.internalForces;
  const nSI = forces.axialForcePuKn * 1000; // N
  const vzSI = forces.shearForceVuKn * 1000; // N
  const vySI = (forces.shearForceVyKn ?? 0) * 1000; // N
  const mySI = forces.momentMuxKnm * 1000; // Nm
  const mzSI = (forces.momentMuyKnm ?? 0) * 1000; // Nm
  const mxSI = (forces.torsionTuKnm ?? 0) * 1000; // Nm

  let materialXml = "";
  let crossSectionXml = "";
  let sectionLabel = "";

  if (cs.kind === "STEEL_IWF") {
    sectionLabel = cs.profileName;
    const fyPa = (cs.fyMpa ?? 240) * 1e6;
    const fuPa = (cs.fuMpa ?? 370) * 1e6;
    materialXml = `    <MatSteel Id="1" Name="${escXml(`Steel ${cs.steelGrade}`)}">
      <E>200000000000</E>
      <G>76923076923</G>
      <Poisson>0.3</Poisson>
      <UnitMass>7850</UnitMass>
      <SpecificResistance>0</SpecificResistance>
      <ThermalExpansion>0.000012</ThermalExpansion>
      <YieldStrength>${fyPa.toFixed(0)}</YieldStrength>
      <UltimateStrength>${fuPa.toFixed(0)}</UltimateStrength>
    </MatSteel>`;

    crossSectionXml = `    <CrossSectionParameter Id="1" Name="${escXml(cs.profileName)}" Material="1" CrossSectionType="RolledI">
      <Parameters>
        <Parameter Name="Height" Value="${(cs.dMm / 1000).toFixed(4)}" />
        <Parameter Name="Width" Value="${(cs.bfMm / 1000).toFixed(4)}" />
        <Parameter Name="WebThickness" Value="${(cs.twMm / 1000).toFixed(5)}" />
        <Parameter Name="FlangeThickness" Value="${(cs.tfMm / 1000).toFixed(5)}" />
        <Parameter Name="Radius" Value="${(cs.rMm / 1000).toFixed(5)}" />
      </Parameters>
    </CrossSectionParameter>`;
  } else if (cs.kind === "STEEL_BOX") {
    sectionLabel = cs.profileName;
    const fyPa = (cs.fyMpa ?? 240) * 1e6;
    const fuPa = (cs.fuMpa ?? 370) * 1e6;
    materialXml = `    <MatSteel Id="1" Name="${escXml(`Steel ${cs.steelGrade}`)}">
      <E>200000000000</E>
      <G>76923076923</G>
      <Poisson>0.3</Poisson>
      <UnitMass>7850</UnitMass>
      <SpecificResistance>0</SpecificResistance>
      <ThermalExpansion>0.000012</ThermalExpansion>
      <YieldStrength>${fyPa.toFixed(0)}</YieldStrength>
      <UltimateStrength>${fuPa.toFixed(0)}</UltimateStrength>
    </MatSteel>`;

    crossSectionXml = `    <CrossSectionParameter Id="1" Name="${escXml(cs.profileName)}" Material="1" CrossSectionType="RolledRHS">
      <Parameters>
        <Parameter Name="Height" Value="${(cs.hMm / 1000).toFixed(4)}" />
        <Parameter Name="Width" Value="${(cs.bMm / 1000).toFixed(4)}" />
        <Parameter Name="Thickness" Value="${(cs.tMm / 1000).toFixed(5)}" />
        <Parameter Name="InnerRadius" Value="${((cs.innerFilletRadiusMm ?? cs.tMm) / 1000).toFixed(5)}" />
        <Parameter Name="OuterRadius" Value="${((cs.outerFilletRadiusMm ?? 2 * cs.tMm) / 1000).toFixed(5)}" />
      </Parameters>
    </CrossSectionParameter>`;
  } else {
    // Concrete Rectangular
    sectionLabel = cs.sectionName ?? `RC ${Math.round(cs.bwMm)}x${Math.round(cs.hMm)}`;
    const fckPa = cs.fcMpa * 1e6;
    const ecPa = 4700 * Math.sqrt(Math.max(17, cs.fcMpa)) * 1e6;
    materialXml = `    <MatConcrete Id="1" Name="${escXml(`Concrete fc' ${cs.fcMpa.toFixed(1)} MPa`)}">
      <E>${ecPa.toFixed(0)}</E>
      <Poisson>0.2</Poisson>
      <UnitMass>2400</UnitMass>
      <Fck>${fckPa.toFixed(0)}</Fck>
    </MatConcrete>`;

    crossSectionXml = `    <CrossSectionParameter Id="1" Name="${escXml(sectionLabel)}" Material="1" CrossSectionType="Rectangular">
      <Parameters>
        <Parameter Name="Height" Value="${(cs.hMm / 1000).toFixed(4)}" />
        <Parameter Name="Width" Value="${(cs.bwMm / 1000).toFixed(4)}" />
      </Parameters>
    </CrossSectionParameter>`;
  }

  const modelName = escXml(input.modelName ?? `IBDS_${sectionLabel}_${frame.mode}`);

  const xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<OpenModel xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <ProjectInfo Name="${modelName}" Date="${new Date().toISOString()}" Application="IBDS Structural Simulator v0.5.0" CoordinateMode="${frame.mode}" />
  <Materials>
${materialXml}
  </Materials>
  <CrossSections>
${crossSectionXml}
  </CrossSections>
  <Nodes>
    <Point3D Id="1" Name="Node_Start" X="${p1.x.toFixed(4)}" Y="${p1.y.toFixed(4)}" Z="${p1.z.toFixed(4)}" />
    <Point3D Id="2" Name="Node_End" X="${p2.x.toFixed(4)}" Y="${p2.y.toFixed(4)}" Z="${p2.z.toFixed(4)}" />
  </Nodes>
  <LineSegments>
    <LineSegment3D Id="1" StartPoint="1" EndPoint="2" />
  </LineSegments>
  <Elements1D>
    <Element1D Id="1" Name="Elem_1" Segment="1" StartCrossSection="1" EndCrossSection="1" />
  </Elements1D>
  <Members1D>
    <Member1D Id="1" Name="Beam_1">
      <Elements1D>
        <Element1D Id="1" />
      </Elements1D>
    </Member1D>
  </Members1D>
  <ConnectionPoints>
    <ConnectionPoint Id="1" Node="1" Name="CP_Start" />
    <ConnectionPoint Id="2" Node="2" Name="CP_End" />
  </ConnectionPoints>
  <OpenModelResult>
    <ResultOnMembers>
      <ResultOnMember Member="1">
        <ResultOnSections>
          <ResultOnSection Position="0.0">
            <InternalForces Case="1" N="${nSI.toFixed(1)}" Vy="${vySI.toFixed(1)}" Vz="${vzSI.toFixed(1)}" Mx="${mxSI.toFixed(1)}" My="${mySI.toFixed(1)}" Mz="${mzSI.toFixed(1)}" />
          </ResultOnSection>
          <ResultOnSection Position="${(spanM / 2).toFixed(4)}">
            <InternalForces Case="1" N="${nSI.toFixed(1)}" Vy="0.0" Vz="0.0" Mx="${mxSI.toFixed(1)}" My="${mySI.toFixed(1)}" Mz="${mzSI.toFixed(1)}" />
          </ResultOnSection>
          <ResultOnSection Position="${spanM.toFixed(4)}">
            <InternalForces Case="1" N="${nSI.toFixed(1)}" Vy="${vySI.toFixed(1)}" Vz="${(-vzSI).toFixed(1)}" Mx="${mxSI.toFixed(1)}" My="0.0" Mz="${mzSI.toFixed(1)}" />
          </ResultOnSection>
        </ResultOnSections>
      </ResultOnMember>
    </ResultOnMembers>
  </OpenModelResult>
</OpenModel>
`;

  const slug = sectionLabel
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const fileName = `ibds-ideastatica-${slug}.iom.xml`;

  return {
    fileName,
    mimeType: "application/xml;charset=utf-8",
    content: xmlContent,
    coordinateMode: input.coordinateMode,
  };
}

// ============================================================================
// Simulator Store Bridge
// ============================================================================

/**
 * Builds an IDEA Open Model XML (.iom.xml) export result directly from `BeamSimulatorState`.
 *
 * @param state - Active simulator state.
 * @returns Generated `IdeaStaticaExportResult`.
 */
export function buildIdeaOpenModelXmlFromSimulatorState(
  state: BeamSimulatorState,
): IdeaStaticaExportResult {
  const isModeA = state.loadingMode === "MODE_A_EXTERNAL_LOADS";
  const spanM = isModeA ? Number(state.spanLengthM) : Number(state.directSpanLengthM);
  const crossSection = resolveCrossSectionFromSimulatorState(state);

  return exportBeamToIdeaOpenModelXml({
    spanLengthMm: spanM * 1000,
    coordinateMode: state.coordinateMode,
    customUpVector: state.customUpVector,
    crossSection,
    internalForces: {
      axialForcePuKn: state.governingForces.absoluteMaxPu,
      shearForceVuKn: state.governingForces.absoluteMaxVu,
      momentMuxKnm: state.governingForces.absoluteMaxMux,
      torsionTuKnm: state.governingForces.absoluteMaxTu,
    },
    maxDeflectionMm: state.maxDeflectionMm,
  });
}
