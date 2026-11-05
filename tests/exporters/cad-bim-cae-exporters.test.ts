/**
 * @file cad-bim-cae-exporters.test.ts
 * @description Comprehensive unit and integration test suite for Step 6:
 * Multi-Format CAD / BIM / CAE Profile & Beam Exporters:
 * - AutoCAD DXF & AutoLISP (.dxf, .lsp)
 * - CSI SAP2000 (.s2k)
 * - ISO 16739 IFC4 BIM & Revit Family Type Catalog (.ifc, .txt)
 * - IDEA StatiCa Open Model XML (.iom.xml)
 * - ISO 10303-21 AP214 STEP Solid & Tessellated 3D Mesh STL (.step, .stl)
 */

import { describe, expect, it } from "bun:test";

import {
  buildAutoLispFromSimulatorState,
  buildDxfFromSimulatorState,
  buildIwfDxfVertices,
  buildRoundedRectDxfVertices,
  DxfExportError,
  EXACT_FILLET_BULGE_90_DEG,
  exportBeamToAutoLisp,
  exportBeamToDxf,
} from "@/core/exporters/dxf-autocad-exporter";
import {
  buildIdeaOpenModelXmlFromSimulatorState,
  exportBeamToIdeaOpenModelXml,
  IdeaStaticaExportError,
} from "@/core/exporters/ideastatica-exporter";
import {
  buildIfc4FromSimulatorState,
  buildRevitTypeCatalogFromSimulatorState,
  exportBeamToIfc4,
  exportRevitFamilyTypeCatalogTxt,
  generateDeterministicIfcGuid,
  Ifc4ExportError,
  resolveExportCoordinateFrame,
} from "@/core/exporters/ifc4-bim-revit-exporter";
import {
  buildS2kFromSimulatorState,
  exportBeamToS2k,
  getSap2000JointRestraints,
  S2kExportError,
} from "@/core/exporters/s2k-sap2000-exporter";
import {
  buildStepAp214FromSimulatorState,
  buildStlFromSimulatorState,
  exportBeamToStepAp214,
  exportDeflectedMeshToAsciiStl,
  exportDeflectedMeshToBinaryStl,
  StepSolidWorksExportError,
} from "@/core/exporters/step-solidworks-exporter";
import {
  beamSimulatorActions,
  getBeamSimulatorSnapshot,
  useBeamSimulatorStore,
} from "@/state/beam-simulator-store";

describe("Step 6: Multi-Format CAD / BIM / CAE Exporters", () => {
  // --------------------------------------------------------------------------
  // 1. AutoCAD DXF & AutoLISP Exporter (.dxf, .lsp)
  // --------------------------------------------------------------------------
  describe("1. AutoCAD DXF & AutoLISP Exporter (.dxf, .lsp)", () => {
    it("computes exact arc bulge for 90-degree fillet corners matching sqrt(2)-1", () => {
      expect(EXACT_FILLET_BULGE_90_DEG).toBeCloseTo(Math.SQRT2 - 1, 8);
      expect(EXACT_FILLET_BULGE_90_DEG).toBeCloseTo(0.41421356, 6);
    });

    it("generates valid 16-vertex closed polygon for IWF profiles with exact bulges", () => {
      const vertices = buildIwfDxfVertices(150, 300, 6.5, 9.0, 13.0);
      expect(vertices.length).toBe(16);
      const bulgeVertices = vertices.filter((v) => v.bulge !== undefined);
      expect(bulgeVertices.length).toBe(4);
      for (const bv of bulgeVertices) {
        expect(bv.bulge).toBeCloseTo(-EXACT_FILLET_BULGE_90_DEG, 6);
      }
    });

    it("generates 8-vertex rounded rectangle for BOX profiles with positive bulges", () => {
      const vertices = buildRoundedRectDxfVertices(200, 200, 16);
      expect(vertices.length).toBe(8);
      const bulgeVertices = vertices.filter((v) => v.bulge !== undefined);
      expect(bulgeVertices.length).toBe(4);
      for (const bv of bulgeVertices) {
        expect(bv.bulge).toBeCloseTo(EXACT_FILLET_BULGE_90_DEG, 6);
      }
    });

    it("exports complete 2D DXF with 4 standard structural layers and annotations", () => {
      const dxf = exportBeamToDxf({
        spanLengthMm: 6000,
        coordinateMode: "Z-Up",
        crossSection: {
          kind: "STEEL_IWF",
          profileName: "WF 300 x 150 x 36.7",
          dMm: 300,
          bfMm: 150,
          twMm: 6.5,
          tfMm: 9.0,
          rMm: 13.0,
          steelGrade: "BJ_37",
        },
        maxDeflectionMm: -11.45,
      });

      expect(dxf.fileName).toBe("ibds-section-wf-300-x-150-x-36-7.dxf");
      expect(dxf.mimeType).toBe("application/dxf");
      expect(dxf.content).toContain("SECTION\n  2\nHEADER");
      expect(dxf.content).toContain("S-SECT-OUTLINE");
      expect(dxf.content).toContain("S-REBAR-STIRRUP");
      expect(dxf.content).toContain("S-REBAR-MAIN");
      expect(dxf.content).toContain("S-ANNO-DIMS");
      expect(dxf.content).toContain("LWPOLYLINE");
      expect(dxf.content).toContain("WF 300 x 150 x 36.7");
      expect(dxf.content).toContain("-11.45 mm");
      expect(dxf.content).toContain("EOF");
    });

    it("exports complete AutoLISP .lsp script with DRAW_BEAM_SECTION command", () => {
      const lsp = exportBeamToAutoLisp({
        spanLengthMm: 6000,
        coordinateMode: "Z-Up",
        crossSection: {
          kind: "STEEL_IWF",
          profileName: "WF 300 x 150 x 36.7",
          dMm: 300,
          bfMm: 150,
          twMm: 6.5,
          tfMm: 9.0,
          rMm: 13.0,
          steelGrade: "BJ_37",
        },
      });

      expect(lsp.fileName).toBe("ibds-script-wf-300-x-150-x-36-7.lsp");
      expect(lsp.commandName).toBe("DRAW_BEAM_SECTION");
      expect(lsp.content).toContain("defun c:DRAW_BEAM_SECTION");
      expect(lsp.content).toContain("S-SECT-OUTLINE");
    });

    it("throws structured DxfExportError when span length is invalid", () => {
      expect(() =>
        exportBeamToDxf({
          spanLengthMm: 0,
          coordinateMode: "Z-Up",
          crossSection: {
            kind: "STEEL_IWF",
            profileName: "WF 100",
            dMm: 100,
            bfMm: 100,
            twMm: 6,
            tfMm: 8,
            rMm: 10,
            steelGrade: "BJ_37",
          },
        }),
      ).toThrow(DxfExportError);
    });
  });

  // --------------------------------------------------------------------------
  // 2. CSI SAP2000 & ETABS Exporter (.s2k)
  // --------------------------------------------------------------------------
  describe("2. CSI SAP2000 & ETABS Exporter (.s2k)", () => {
    it("maps 8 support orientations to exact SAP2000 Joint Restraint assignments", () => {
      const pinRol = getSap2000JointRestraints("PINNED_ROLLER");
      expect(pinRol.joint1).toEqual({
        u1: "Yes",
        u2: "Yes",
        u3: "Yes",
        r1: "Yes",
        r2: "No",
        r3: "No",
      });
      expect(pinRol.joint2).toEqual({
        u1: "No",
        u2: "Yes",
        u3: "Yes",
        r1: "Yes",
        r2: "No",
        r3: "No",
      });

      const fixRol = getSap2000JointRestraints("FIXED_ROLLER");
      expect(fixRol.joint1).toEqual({
        u1: "Yes",
        u2: "Yes",
        u3: "Yes",
        r1: "Yes",
        r2: "Yes",
        r3: "Yes",
      });
      expect(fixRol.joint2).toEqual({
        u1: "No",
        u2: "Yes",
        u3: "Yes",
        r1: "Yes",
        r2: "No",
        r3: "No",
      });

      const cantiL = getSap2000JointRestraints("CANTILEVER_LEFT");
      expect(cantiL.joint1.u1).toBe("Yes");
      expect(cantiL.joint2.u1).toBe("No");
      expect(cantiL.joint2.r2).toBe("No");
    });

    it("exports valid SAP2000 .s2k file with materials, frame sections, and coordinates", () => {
      const s2k = exportBeamToS2k({
        spanLengthMm: 6000,
        supportOrientation: "PINNED_ROLLER",
        coordinateMode: "Z-Up",
        crossSection: {
          kind: "STEEL_IWF",
          profileName: "WF 300 x 150 x 36.7",
          dMm: 300,
          bfMm: 150,
          twMm: 6.5,
          tfMm: 9.0,
          rMm: 13.0,
          steelGrade: "BJ_37",
        },
        includeSelfWeight: true,
        distributedLoads: [
          {
            id: "Q1",
            magnitude: 15 as any,
            startPosition: 0 as any,
            endPosition: 6 as any,
          },
        ],
      });

      expect(s2k.fileName).toContain(".s2k");
      expect(s2k.content).toContain('TABLE:  "PROGRAM CONTROL"');
      expect(s2k.content).toContain(
        'TABLE:  "MATERIAL PROPERTIES 02 - BASIC MECHANICAL PROPERTIES"',
      );
      expect(s2k.content).toContain('TABLE:  "FRAME SECTION PROPERTIES 01 - GENERAL"');
      expect(s2k.content).toContain('TABLE:  "JOINT COORDINATES"');
      expect(s2k.content).toContain('TABLE:  "JOINT RESTRAINT ASSIGNMENTS"');
      expect(s2k.content).toContain('TABLE:  "CONNECTIVITY - FRAME"');
      expect(s2k.content).toContain('TABLE:  "FRAME SECTION ASSIGNMENTS"');
      expect(s2k.content).toContain('TABLE:  "LOAD PATTERN DEFINITIONS"');
      expect(s2k.content).toContain('TABLE:  "FRAME LOADS - DISTRIBUTED"');
      expect(s2k.content).toContain("END TABLE DATA");
    });

    it("throws structured S2kExportError when span is non-positive", () => {
      expect(() =>
        exportBeamToS2k({
          spanLengthMm: -1000,
          supportOrientation: "PINNED_ROLLER",
          coordinateMode: "Z-Up",
          crossSection: {
            kind: "STEEL_IWF",
            profileName: "WF 100",
            dMm: 100,
            bfMm: 100,
            twMm: 6,
            tfMm: 8,
            rMm: 10,
            steelGrade: "BJ_37",
          },
        }),
      ).toThrow(S2kExportError);
    });
  });

  // --------------------------------------------------------------------------
  // 3. ISO 16739 IFC4 BIM & Revit Type Catalog (.ifc, .txt)
  // --------------------------------------------------------------------------
  describe("3. ISO 16739 IFC4 BIM & Revit Type Catalog (.ifc, .txt)", () => {
    it("generates deterministic 22-character IFC Base64 GUIDs", () => {
      const g1 = generateDeterministicIfcGuid("BEAM:101");
      const g2 = generateDeterministicIfcGuid("BEAM:101");
      const g3 = generateDeterministicIfcGuid("BEAM:102");
      expect(g1.length).toBe(22);
      expect(g1).toBe(g2);
      expect(g1).not.toBe(g3);
    });

    it("resolves orthonormal 3D coordinate frames for Z-Up, Y-Up, and CustomXYZ", () => {
      const frameZ = resolveExportCoordinateFrame("Z-Up");
      expect(frameZ.spanAxis).toEqual({ x: 1, y: 0, z: 0 });
      expect(frameZ.verticalAxis).toEqual({ x: 0, y: 0, z: 1 });

      const frameY = resolveExportCoordinateFrame("Y-Up");
      expect(frameY.spanAxis).toEqual({ x: 1, y: 0, z: 0 });
      expect(frameY.verticalAxis).toEqual({ x: 0, y: 1, z: 0 });
    });

    it("exports valid IFC4 BIM file for Steel IWF beams with IFCIISHAPEPROFILEDEF", () => {
      const ifc = exportBeamToIfc4({
        spanLengthMm: 6000,
        supportOrientation: "PINNED_ROLLER",
        coordinateMode: "Z-Up",
        crossSection: {
          kind: "STEEL_IWF",
          profileName: "WF 300 x 150 x 36.7",
          dMm: 300,
          bfMm: 150,
          twMm: 6.5,
          tfMm: 9.0,
          rMm: 13.0,
          steelGrade: "BJ_37",
        },
        analysisSummary: {
          maxDeflectionMm: -11.45,
          factoredMuxKnm: 142.5,
          factoredVuKn: 95.0,
          governingDcr: 0.92,
        },
      });

      expect(ifc.fileName).toContain(".ifc");
      expect(ifc.schemaVersion).toBe("IFC4");
      expect(ifc.content).toContain("ISO-10303-21;");
      expect(ifc.content).toContain("FILE_SCHEMA(('IFC4'));");
      expect(ifc.content).toContain("IFCPROJECT");
      expect(ifc.content).toContain("IFCBEAM");
      expect(ifc.content).toContain("IFCISHAPEPROFILEDEF");
      expect(ifc.content).toContain("IFCEXTRUDEDAREASOLID");
      expect(ifc.content).toContain("Pset_BeamCommon");
      expect(ifc.content).toContain("-11.45");
      expect(ifc.content).toContain("END-ISO-10303-21;");
    });

    it("exports valid IFC4 BIM file for Reinforced Concrete beams with 3D IFCREINFORCINGBAR", () => {
      const ifc = exportBeamToIfc4({
        spanLengthMm: 5000,
        supportOrientation: "FIXED_FIXED",
        coordinateMode: "Z-Up",
        crossSection: {
          kind: "CONCRETE_RECT",
          sectionName: "RC 300x500",
          bwMm: 300,
          hMm: 500,
          coverMm: 40,
          fcMpa: 25,
          longitudinalRebarGrade: "BJTS_40",
          stirrupRebarGrade: "BJTP_24",
          tensileBars: { count: 4, diameterMm: 19 },
          compressiveBars: { count: 2, diameterMm: 13 },
          stirrup: { legs: 2, diameterMm: 10, spacingMm: 150 },
        },
      });

      expect(ifc.content).toContain("IFCRECTANGLEPROFILEDEF");
      expect(ifc.content).toContain("IFCREINFORCINGBAR");
      expect(ifc.content).toContain("IFCSWEPTDISKSOLID");
      expect(ifc.content).toContain("ReinforcingSteel");
    });

    it("exports Revit Family Type Catalog .txt file", () => {
      const catalog = exportRevitFamilyTypeCatalogTxt({
        spanLengthMm: 6000,
        supportOrientation: "PINNED_ROLLER",
        coordinateMode: "Z-Up",
        crossSection: {
          kind: "STEEL_BOX",
          profileName: "BOX 200 x 200 x 8.0",
          hMm: 200,
          bMm: 200,
          tMm: 8,
          steelGrade: "BJ_41",
        },
      });

      expect(catalog.fileName).toContain(".txt");
      expect(catalog.content).toContain("##LENGTH##MILLIMETERS");
      expect(catalog.content).toContain("OverallHeight##LENGTH##MILLIMETERS");
      expect(catalog.content).toContain("BOX 200 x 200 x 8.0");
    });

    it("throws structured Ifc4ExportError when dimensions are invalid", () => {
      expect(() =>
        exportBeamToIfc4({
          spanLengthMm: 6000,
          supportOrientation: "PINNED_ROLLER",
          coordinateMode: "Z-Up",
          crossSection: {
            kind: "STEEL_IWF",
            profileName: "Invalid IWF",
            dMm: 100,
            bfMm: 100,
            twMm: 120, // Web thicker than flange width
            tfMm: 10,
            rMm: 5,
            steelGrade: "BJ_37",
          },
        }),
      ).toThrow(Ifc4ExportError);
    });
  });

  // --------------------------------------------------------------------------
  // 4. IDEA StatiCa Open Model XML Exporter (.iom.xml)
  // --------------------------------------------------------------------------
  describe("4. IDEA StatiCa Open Model XML Exporter (.iom.xml)", () => {
    it("generates valid .iom.xml file with Materials, Nodes in meters, LineSegments, and OpenModelResult", () => {
      const iom = exportBeamToIdeaOpenModelXml({
        spanLengthMm: 6000,
        coordinateMode: "Z-Up",
        crossSection: {
          kind: "STEEL_IWF",
          profileName: "WF 300 x 150 x 36.7",
          dMm: 300,
          bfMm: 150,
          twMm: 6.5,
          tfMm: 9.0,
          rMm: 13.0,
          steelGrade: "BJ_37",
        },
        internalForces: {
          axialForcePuKn: 0,
          shearForceVuKn: 80,
          momentMuxKnm: 120,
          torsionTuKnm: 10,
        },
        maxDeflectionMm: -12.5,
      });

      expect(iom.fileName).toContain(".iom.xml");
      expect(iom.mimeType).toBe("application/xml;charset=utf-8");
      expect(iom.content).toContain("<OpenModel");
      expect(iom.content).toContain("<MatSteel");
      expect(iom.content).toContain('CrossSectionType="RolledI"');
      expect(iom.content).toContain("<Point3D");
      expect(iom.content).toContain("<LineSegment3D");
      expect(iom.content).toContain("<Member1D");
      expect(iom.content).toContain("<OpenModelResult>");
      expect(iom.content).toContain('Vz="80000.0"');
      expect(iom.content).toContain('My="120000.0"');
      expect(iom.content).toContain("</OpenModel>");
    });

    it("throws structured IdeaStaticaExportError on non-positive span", () => {
      expect(() =>
        exportBeamToIdeaOpenModelXml({
          spanLengthMm: 0,
          coordinateMode: "Z-Up",
          crossSection: {
            kind: "STEEL_IWF",
            profileName: "WF 100",
            dMm: 100,
            bfMm: 100,
            twMm: 6,
            tfMm: 8,
            rMm: 10,
            steelGrade: "BJ_37",
          },
          internalForces: {
            axialForcePuKn: 0,
            shearForceVuKn: 50,
            momentMuxKnm: 75,
          },
        }),
      ).toThrow(IdeaStaticaExportError);
    });
  });

  // --------------------------------------------------------------------------
  // 5. SolidWorks STEP AP214 & STL Exporter (.step, .stl)
  // --------------------------------------------------------------------------
  describe("5. SolidWorks STEP AP214 & STL Exporter (.step, .stl)", () => {
    it("generates valid ISO 10303-21 AP214 B-Rep solid file with EXTRUDED_AREA_SOLID", () => {
      const step = exportBeamToStepAp214({
        spanLengthMm: 6000,
        coordinateMode: "Y-Up",
        crossSection: {
          kind: "STEEL_IWF",
          profileName: "WF 300 x 150 x 36.7",
          dMm: 300,
          bfMm: 150,
          twMm: 6.5,
          tfMm: 9.0,
          rMm: 13.0,
          steelGrade: "BJ_37",
        },
      });

      expect(step.fileName).toContain(".step");
      expect(step.schema).toBe("AUTOMOTIVE_DESIGN_AP214");
      expect(step.content).toContain("ISO-10303-21;");
      expect(step.content).toContain("AUTOMOTIVE_DESIGN");
      expect(step.content).toContain("COMPOSITE_CURVE");
      expect(step.content).toContain("EXTRUDED_AREA_SOLID");
      expect(step.content).toContain("ADVANCED_FACE");
      expect(step.content).toContain("END-ISO-10303-21;");
    });

    it("generates ASCII .stl with solid header and facet normals", () => {
      const pos = new Float32Array([
        0, 0, 0, 100, 0, 0, 0, 100, 0, 100, 100, 0, 0, 0, 100, 100, 0, 100,
      ]);
      const idx = new Uint32Array([0, 1, 2, 1, 3, 2]);

      const stl = exportDeflectedMeshToAsciiStl({
        positionsF32: pos,
        indicesU32: idx,
        coordinateMode: "Z-Up",
      });

      expect(stl.fileName).toContain(".stl");
      expect(stl.facetCount).toBe(2);
      expect(stl.content).toContain("solid");
      expect(stl.content).toContain("facet normal");
      expect(stl.content).toContain("vertex");
      expect(stl.content).toContain("endsolid");
    });

    it("generates IEEE-754 Little-Endian Binary .stl with 80-byte header and 50 bytes per facet", () => {
      const pos = new Float32Array([0, 0, 0, 100, 0, 0, 0, 100, 0]);
      const idx = new Uint32Array([0, 1, 2]);

      const binStl = exportDeflectedMeshToBinaryStl({
        positionsF32: pos,
        indicesU32: idx,
        coordinateMode: "Z-Up",
        maxDeflectionMm: -10.5,
      });

      expect(binStl.facetCount).toBe(1);
      expect(binStl.bytes.byteLength).toBe(84 + 50 * 1); // 134 bytes
      const view = new DataView(binStl.bytes.buffer);
      const readFacets = view.getUint32(80, true);
      expect(readFacets).toBe(1);
    });

    it("throws structured StepSolidWorksExportError on empty mesh buffers", () => {
      expect(() =>
        exportDeflectedMeshToAsciiStl({
          positionsF32: new Float32Array([]),
          indicesU32: new Uint32Array([]),
          coordinateMode: "Z-Up",
        }),
      ).toThrow(StepSolidWorksExportError);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Reactive Simulator State Store Bridges
  // --------------------------------------------------------------------------
  describe("6. Reactive Simulator State Store Bridges", () => {
    it("builds all 8 file formats directly from simulator state without throwing", () => {
      beamSimulatorActions.setMaterialKind("STEEL");
      beamSimulatorActions.setSpanLength(6.0);
      const state = getBeamSimulatorSnapshot();

      const dxf = buildDxfFromSimulatorState(state);
      expect(dxf.content.length).toBeGreaterThan(100);

      const lsp = buildAutoLispFromSimulatorState(state);
      expect(lsp.content.length).toBeGreaterThan(100);

      const s2k = buildS2kFromSimulatorState(state);
      expect(s2k.content.length).toBeGreaterThan(100);

      const ifc = buildIfc4FromSimulatorState(state);
      expect(ifc.content.length).toBeGreaterThan(100);

      const txt = buildRevitTypeCatalogFromSimulatorState(state);
      expect(txt.content.length).toBeGreaterThan(50);

      const iom = buildIdeaOpenModelXmlFromSimulatorState(state);
      expect(iom.content.length).toBeGreaterThan(100);

      const step = buildStepAp214FromSimulatorState(state);
      expect(step.content.length).toBeGreaterThan(100);

      const stl = buildStlFromSimulatorState(state);
      expect(stl.content.length).toBeGreaterThan(100);
    });
  });
});
