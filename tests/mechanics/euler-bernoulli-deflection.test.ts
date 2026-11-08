/**
 * @file euler-bernoulli-deflection.test.ts
 * @description Comprehensive unit and benchmark tests for Step 3:
 * - 5 support categories (9 orientations) reaction & indeterminate Mohr compatibility solver
 * - Internal force diagrams (SFD, NFD, BMD, TFD) on M = 256 discrete stations
 * - Euler-Bernoulli double numerical integration with negative deflection convention (Delta < 0)
 * - Mode B direct internal force interpolator
 * - Static SolverWorkspace zero-copy linear memory pointer stability (zero per-frame allocation)
 * - 3D mesh extrusion with 4-segment IWF root fillets and guaranteed CCW triangle winding
 * - Guard clauses for E <= 0, I <= 0, and L <= 0
 */

import { describe, expect, test } from "bun:test";

import { interpolateModeBInternalForces } from "@/core/mechanics/direct-internal-force-interpolator";
import { solveEulerBernoulliDeflection } from "@/core/mechanics/euler-bernoulli-deflection-solver";
import { solveInternalForceDiagrams } from "@/core/mechanics/internal-force-diagrams-solver";
import { solveSupportReactions } from "@/core/mechanics/support-reactions-solver";
import {
  getSharedSolverWorkspace,
  initWasmMechanicsBridge,
  WASM_IWF_FILLET_SEGMENTS,
  WASM_IWF_PERIMETER_VERTEX_COUNT,
  WASM_STATION_COUNT,
  WasmMechanicsSolverError,
} from "@/core/mechanics/wasm-mechanics-bridge";
import type {
  DirectInternalForcesModeBConfig,
  ExternalLoadsModeAConfig,
} from "@/types/beam-loading-modes";
import { kilonewton, kilonewtonMeter, kilonewtonPerMeter, meter } from "@/types/branded-units";

const E_STEEL_MPA = 200_000;
const I_MAJOR_MM4 = 100_000_000; // 1e8 mm^4 => EI = 2e13 N*mm^2

describe("Step 3: Rust WASM Mechanics Solver & 3D Extruded Mesh", () => {
  test("initializes WASM SolverWorkspace with M = 256 stations and 4-segment IWF fillets", async () => {
    const ws = await initWasmMechanicsBridge();
    expect(ws.station_count()).toBe(WASM_STATION_COUNT);
    expect(ws.iwf_fillet_segments()).toBe(WASM_IWF_FILLET_SEGMENTS);
    expect(ws.iwf_perimeter_vertex_count()).toBe(WASM_IWF_PERIMETER_VERTEX_COUNT);
  });

  test("Simply Supported (PINNED_ROLLER & ROLLER_PINNED) matches analytical SFD, BMD, and negative deflection", () => {
    const udlConfig: ExternalLoadsModeAConfig = {
      mode: "MODE_A_EXTERNAL_LOADS",
      spanLength: meter(6.0),
      supportOrientation: "PINNED_ROLLER",
      includeSelfWeight: false,
      pointLoads: [],
      distributedLoads: [
        {
          id: "udl-1",
          magnitude: kilonewtonPerMeter(10.0),
          startPosition: meter(0.0),
          endPosition: meter(6.0),
        },
      ],
      appliedMoments: [],
    };

    const res = solveEulerBernoulliDeflection({
      loadingConfig: udlConfig,
      elasticModulusMpa: E_STEEL_MPA,
      momentOfInertiaMm4: I_MAJOR_MM4,
    });

    expect(res.diagrams.reactions.raVerticalKn).toBeCloseTo(30.0, 8);
    expect(res.diagrams.reactions.rbVerticalKn).toBeCloseTo(30.0, 8);
    expect(res.diagrams.reactions.maMomentKnm).toBeCloseTo(0.0, 8);
    expect(res.diagrams.reactions.mbMomentKnm).toBeCloseTo(0.0, 8);
    expect(res.diagrams.maxPositiveMomentKnm).toBeCloseTo(45.0, 8);

    // Analytical Delta_max = -5 * q * L^4 / (384 * E * I) = -8.4375 mm (< 0)
    expect(res.maxDeflectionMm).toBeLessThan(0);
    expect(res.maxDeflectionMm).toBeCloseTo(-8.4375, 6);
    expect(res.maxDeflectionStationM).toBeCloseTo(3.0, 4);

    // Midspan point load P = 60 kN on ROLLER_PINNED
    const pointConfig: ExternalLoadsModeAConfig = {
      ...udlConfig,
      supportOrientation: "ROLLER_PINNED",
      distributedLoads: [],
      pointLoads: [
        {
          id: "pl-1",
          magnitude: kilonewton(60.0),
          position: meter(3.0),
        },
      ],
    };

    const ptRes = solveEulerBernoulliDeflection({
      loadingConfig: pointConfig,
      elasticModulusMpa: E_STEEL_MPA,
      momentOfInertiaMm4: I_MAJOR_MM4,
      axialForceKn: kilonewton(40.0),
    });

    expect(ptRes.diagrams.reactions.raAxialKn).toBeCloseTo(0.0, 8);
    expect(ptRes.diagrams.reactions.rbAxialKn).toBeCloseTo(-40.0, 8);
    expect(ptRes.diagrams.maxPositiveMomentKnm).toBeCloseTo(90.0, 8);
    // Analytical Delta_max = -P * L^3 / (48 * E * I) = -13.5 mm (< 0)
    expect(ptRes.maxDeflectionMm).toBeCloseTo(-13.5, 6);
  });

  test("Cantilever (CANTILEVER_LEFT & CANTILEVER_RIGHT) produces negative tip deflection", () => {
    const leftCantilever: ExternalLoadsModeAConfig = {
      mode: "MODE_A_EXTERNAL_LOADS",
      spanLength: meter(4.0),
      supportOrientation: "CANTILEVER_LEFT",
      includeSelfWeight: false,
      pointLoads: [
        {
          id: "tip-load",
          magnitude: kilonewton(20.0),
          position: meter(4.0),
        },
      ],
      distributedLoads: [],
      appliedMoments: [],
    };

    const leftRes = solveEulerBernoulliDeflection({
      loadingConfig: leftCantilever,
      elasticModulusMpa: E_STEEL_MPA,
      momentOfInertiaMm4: I_MAJOR_MM4,
    });

    const expectedTipDefl = -(20_000 * 4000 ** 3) / (3 * 2e13); // -21.333333 mm
    expect(leftRes.diagrams.reactions.raVerticalKn).toBeCloseTo(20.0, 8);
    expect(leftRes.diagrams.reactions.maMomentKnm).toBeCloseTo(-80.0, 8);
    expect(leftRes.maxDeflectionMm).toBeCloseTo(expectedTipDefl, 5);
    expect(leftRes.maxDeflectionStationM).toBeCloseTo(4.0, 5);

    const rightCantilever: ExternalLoadsModeAConfig = {
      ...leftCantilever,
      supportOrientation: "CANTILEVER_RIGHT",
      pointLoads: [
        {
          id: "tip-load-left",
          magnitude: kilonewton(20.0),
          position: meter(0.0),
        },
      ],
    };

    const rightRes = solveEulerBernoulliDeflection({
      loadingConfig: rightCantilever,
      elasticModulusMpa: E_STEEL_MPA,
      momentOfInertiaMm4: I_MAJOR_MM4,
    });

    expect(rightRes.diagrams.reactions.rbVerticalKn).toBeCloseTo(20.0, 8);
    expect(rightRes.diagrams.reactions.mbMomentKnm).toBeCloseTo(-80.0, 8);
    expect(rightRes.maxDeflectionMm).toBeCloseTo(expectedTipDefl, 5);
    expect(rightRes.maxDeflectionStationM).toBeCloseTo(0.0, 5);
  });

  test("Indeterminate supports (FIXED_FIXED, FIXED_ROLLER, ROLLER_FIXED, FIXED_PINNED, PINNED_FIXED) match analytical formulas", () => {
    const baseUdl: ExternalLoadsModeAConfig = {
      mode: "MODE_A_EXTERNAL_LOADS",
      spanLength: meter(6.0),
      supportOrientation: "FIXED_FIXED",
      includeSelfWeight: false,
      pointLoads: [],
      distributedLoads: [
        {
          id: "udl-12",
          magnitude: kilonewtonPerMeter(12.0),
          startPosition: meter(0.0),
          endPosition: meter(6.0),
        },
      ],
      appliedMoments: [],
    };

    // 1. FIXED_FIXED: M_A = M_B = -qL^2/12 = -36 kNm, M_mid = +qL^2/24 = +18 kNm, Delta_max = -qL^4/(384EI) = -2.025 mm
    const ffRes = solveEulerBernoulliDeflection({
      loadingConfig: baseUdl,
      elasticModulusMpa: E_STEEL_MPA,
      momentOfInertiaMm4: I_MAJOR_MM4,
    });
    expect(ffRes.diagrams.reactions.isStaticallyIndeterminate).toBe(true);
    expect(ffRes.diagrams.reactions.maMomentKnm).toBeCloseTo(-36.0, 8);
    expect(ffRes.diagrams.reactions.mbMomentKnm).toBeCloseTo(-36.0, 8);
    expect(ffRes.diagrams.maxPositiveMomentKnm).toBeCloseTo(18.0, 8);
    expect(ffRes.maxDeflectionMm).toBeCloseTo(-2.025, 6);

    // 2. FIXED_ROLLER & FIXED_PINNED: M_A = -qL^2/8 = -54 kNm, R_A = 45 kN, R_B = 27 kN, M_max^+ = 9/128 qL^2 = 30.375 kNm
    for (const orient of ["FIXED_ROLLER", "FIXED_PINNED"] as const) {
      const frRes = solveEulerBernoulliDeflection({
        loadingConfig: { ...baseUdl, supportOrientation: orient },
        elasticModulusMpa: E_STEEL_MPA,
        momentOfInertiaMm4: I_MAJOR_MM4,
      });
      expect(frRes.diagrams.reactions.maMomentKnm).toBeCloseTo(-54.0, 8);
      expect(frRes.diagrams.reactions.mbMomentKnm).toBeCloseTo(0.0, 8);
      expect(frRes.diagrams.reactions.raVerticalKn).toBeCloseTo(45.0, 8);
      expect(frRes.diagrams.reactions.rbVerticalKn).toBeCloseTo(27.0, 8);
      expect(frRes.diagrams.maxPositiveMomentKnm).toBeCloseTo(30.375, 5);
      expect(frRes.maxDeflectionMm).toBeLessThan(0);
    }

    // 3. ROLLER_FIXED & PINNED_FIXED: mirror symmetry (M_B = -54 kNm, R_A = 27 kN, R_B = 45 kN)
    for (const orient of ["ROLLER_FIXED", "PINNED_FIXED"] as const) {
      const rfRes = solveEulerBernoulliDeflection({
        loadingConfig: { ...baseUdl, supportOrientation: orient },
        elasticModulusMpa: E_STEEL_MPA,
        momentOfInertiaMm4: I_MAJOR_MM4,
      });
      expect(rfRes.diagrams.reactions.maMomentKnm).toBeCloseTo(0.0, 8);
      expect(rfRes.diagrams.reactions.mbMomentKnm).toBeCloseTo(-54.0, 8);
      expect(rfRes.diagrams.reactions.raVerticalKn).toBeCloseTo(27.0, 8);
      expect(rfRes.diagrams.reactions.rbVerticalKn).toBeCloseTo(45.0, 8);
      expect(rfRes.diagrams.maxPositiveMomentKnm).toBeCloseTo(30.375, 5);
      expect(rfRes.maxDeflectionMm).toBeLessThan(0);
    }
  });

  test("Mode B Direct Internal Force Interpolator maps |M_ux| to q_eq and negative analytical deflection", () => {
    const modeBConfig: DirectInternalForcesModeBConfig = {
      mode: "MODE_B_DIRECT_INTERNAL_FORCES",
      spanLength: meter(6.0),
      axialForcePu: kilonewton(-50.0),
      strongAxisMomentMux: kilonewtonMeter(45.0),
      weakAxisMomentMuy: kilonewtonMeter(5.0),
      torsionTu: kilonewtonMeter(2.0),
      shearForceVu: kilonewton(30.0),
    };

    const simpleB = interpolateModeBInternalForces({
      modeBConfig,
      supportOrientation: "PINNED_ROLLER",
      elasticModulusMpa: E_STEEL_MPA,
      momentOfInertiaMm4: I_MAJOR_MM4,
    });

    // q_eq = 8 * 45 / 36 = 10 kN/m => Delta_max = -8.4375 mm
    expect(simpleB.equivalentUniformLoadKnPerM).toBeCloseTo(10.0, 8);
    expect(simpleB.maxDeflectionMm).toBeCloseTo(-8.4375, 6);

    const fixedB = interpolateModeBInternalForces({
      modeBConfig: { ...modeBConfig, strongAxisMomentMux: kilonewtonMeter(36.0) },
      supportOrientation: "FIXED_FIXED",
      elasticModulusMpa: E_STEEL_MPA,
      momentOfInertiaMm4: I_MAJOR_MM4,
    });
    // q_eq = 12 * 36 / 36 = 12 kN/m, analytical peak = -|M_ux|*L^2 / (32*E*I) = -36e6 * 36e6 / (32 * 2e13) = -2.025 mm
    expect(fixedB.equivalentUniformLoadKnPerM).toBeCloseTo(12.0, 8);
    expect(fixedB.maxDeflectionMm).toBeCloseTo(-2.025, 6);
  });

  test("Static SolverWorkspace preserves exact linear memory pointers across 100 slider frames (zero leak)", () => {
    const ws = getSharedSolverWorkspace();
    const initialDeflectionPtr = ws.deflection_ptr();
    const initialPositionsPtr = ws.mesh_positions_ptr();
    const initialNormalsPtr = ws.mesh_normals_ptr();
    const initialColorsPtr = ws.mesh_colors_ptr();
    const initialIndicesPtr = ws.mesh_indices_ptr();

    for (let frame = 1; frame <= 100; frame++) {
      const cfg: ExternalLoadsModeAConfig = {
        mode: "MODE_A_EXTERNAL_LOADS",
        spanLength: meter(6.0),
        supportOrientation: "PINNED_ROLLER",
        includeSelfWeight: false,
        pointLoads: [
          {
            id: "slider-load",
            magnitude: kilonewton(10.0 + frame * 1.5),
            position: meter(1.0 + (frame % 40) * 0.1),
          },
        ],
        distributedLoads: [],
        appliedMoments: [],
      };

      const res = solveEulerBernoulliDeflection({
        loadingConfig: cfg,
        elasticModulusMpa: E_STEEL_MPA,
        momentOfInertiaMm4: I_MAJOR_MM4,
        crossSection: {
          kind: "IWF",
          dMm: 300,
          bfMm: 150,
          twMm: 6.5,
          tfMm: 9.0,
          rMm: 13.0,
        },
        visualScale: 10.0,
      });

      expect(res.deflectionPtr).toBe(initialDeflectionPtr);
      expect(res.mesh3D).not.toBeNull();
      expect(res.mesh3D!.positionsPtr).toBe(initialPositionsPtr);
      expect(res.mesh3D!.normalsPtr).toBe(initialNormalsPtr);
      expect(res.mesh3D!.colorsPtr).toBe(initialColorsPtr);
      expect(res.mesh3D!.indicesPtr).toBe(initialIndicesPtr);
    }
  });

  test("3D extruded mesh enforces CCW winding order across IWF, BOX, and CONCRETE_RECT under Z-Up and Y-Up", () => {
    const cfg: ExternalLoadsModeAConfig = {
      mode: "MODE_A_EXTERNAL_LOADS",
      spanLength: meter(5.0),
      supportOrientation: "PINNED_ROLLER",
      includeSelfWeight: false,
      pointLoads: [{ id: "p1", magnitude: kilonewton(45.0), position: meter(2.5) }],
      distributedLoads: [],
      appliedMoments: [],
    };

    const sections = [
      {
        kind: "IWF" as const,
        dMm: 300,
        bfMm: 150,
        twMm: 6.5,
        tfMm: 9.0,
        rMm: 13.0,
      },
      {
        kind: "BOX" as const,
        hMm: 250,
        bMm: 150,
        tMm: 8.0,
      },
      {
        kind: "CONCRETE_RECT" as const,
        bwMm: 300,
        hMm: 500,
        rebarCage: {
          coverMm: 40,
          stirrupDiaMm: 10,
          stirrupSpacingMm: 150,
          tensileBarCount: 4,
          tensileBarDiaMm: 19,
          compressiveBarCount: 2,
          compressiveBarDiaMm: 16,
        },
      },
    ];

    for (const coordinateMode of ["Z-Up", "Y-Up"] as const) {
      for (const crossSection of sections) {
        const res = solveEulerBernoulliDeflection({
          loadingConfig: cfg,
          elasticModulusMpa: E_STEEL_MPA,
          momentOfInertiaMm4: I_MAJOR_MM4,
          crossSection,
          coordinateMode,
          visualScale: 15.0,
        });

        const mesh = res.mesh3D!;
        expect(mesh.vertexCount).toBeGreaterThan(1000);
        expect(mesh.triangleCount).toBeGreaterThan(2000);

        if (crossSection.kind === "IWF") {
          // 256 stations * 28 perimeter vertices + 2 end-caps * 28 vertices = 7,224 vertices
          expect(mesh.vertexCount).toBe(256 * 28 + 2 * 28);
        }

        if (crossSection.kind === "CONCRETE_RECT") {
          expect(res.rebarCage3D).not.toBeNull();
          expect(res.rebarCage3D!.segmentCount).toBeGreaterThan(500);
        }

        const pos = mesh.positionsF32;
        const norm = mesh.normalsF32;
        const idx = mesh.indicesU32;

        for (let t = 0; t < mesh.triangleCount; t++) {
          const i0 = idx[t * 3]! * 3;
          const i1 = idx[t * 3 + 1]! * 3;
          const i2 = idx[t * 3 + 2]! * 3;

          const e1x = pos[i1]! - pos[i0]!;
          const e1y = pos[i1 + 1]! - pos[i0 + 1]!;
          const e1z = pos[i1 + 2]! - pos[i0 + 2]!;

          const e2x = pos[i2]! - pos[i0]!;
          const e2y = pos[i2 + 1]! - pos[i0 + 1]!;
          const e2z = pos[i2 + 2]! - pos[i0 + 2]!;

          const cx = e1y * e2z - e1z * e2y;
          const cy = e1z * e2x - e1x * e2z;
          const cz = e1x * e2y - e1y * e2x;

          const dot = cx * norm[i0]! + cy * norm[i0 + 1]! + cz * norm[i0 + 2]!;
          expect(dot).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  test("Guard clauses reject E <= 0, I <= 0, and L <= 0 with structured WasmMechanicsSolverError", () => {
    const validCfg: ExternalLoadsModeAConfig = {
      mode: "MODE_A_EXTERNAL_LOADS",
      spanLength: meter(6.0),
      supportOrientation: "PINNED_ROLLER",
      includeSelfWeight: false,
      pointLoads: [{ id: "p1", magnitude: kilonewton(20), position: meter(3.0) }],
      distributedLoads: [],
      appliedMoments: [],
    };

    // L <= 0 => error code 1
    expect(() =>
      solveEulerBernoulliDeflection({
        loadingConfig: { ...validCfg, spanLength: meter(0) },
        elasticModulusMpa: E_STEEL_MPA,
        momentOfInertiaMm4: I_MAJOR_MM4,
      }),
    ).toThrow(WasmMechanicsSolverError);

    // E <= 0 => error code 2
    expect(() =>
      solveEulerBernoulliDeflection({
        loadingConfig: validCfg,
        elasticModulusMpa: 0,
        momentOfInertiaMm4: I_MAJOR_MM4,
      }),
    ).toThrow(WasmMechanicsSolverError);

    // I <= 0 => error code 3
    expect(() =>
      solveEulerBernoulliDeflection({
        loadingConfig: validCfg,
        elasticModulusMpa: E_STEEL_MPA,
        momentOfInertiaMm4: -500,
      }),
    ).toThrow(WasmMechanicsSolverError);

    // Direct reactions & diagrams solver smoke check
    const r = solveSupportReactions(validCfg);
    const d = solveInternalForceDiagrams(validCfg);
    expect(r.raVerticalKn).toBeCloseTo(10.0, 8);
    expect(d.maxPositiveMomentKnm).toBeCloseTo(30.0, 8);
  });
});
