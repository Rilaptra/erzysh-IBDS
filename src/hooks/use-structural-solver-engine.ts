/**
 * @file use-structural-solver-engine.ts
 * @description Master reactive hook linking simulator store inputs to the Rust WASM
 * mechanics engine and TypeScript SNI 2847 (Concrete) & SNI 1729 (Steel) optimizers.
 * Provides zero-copy 3D mesh views and diagram station arrays for both Mode A and Mode B.
 */

"use client";

import { useEffect, useState } from "react";

import {
  type DeflectionEvaluationResult,
  evaluateDeflectionCompliance,
} from "@/config/deflection-limits-config";
import { convertCubeToCylinderMpa } from "@/core/concrete/concrete-grade-converter";
import { optimizeConcreteSection } from "@/core/concrete/concrete-section-optimizer";
import { interpolateModeBInternalForces } from "@/core/mechanics/direct-internal-force-interpolator";
import {
  type ExtrusionCrossSectionInput,
  solveEulerBernoulliDeflection,
} from "@/core/mechanics/euler-bernoulli-deflection-solver";
import {
  getZeroCopyStationViews,
  type ZeroCopyMesh3DViews,
  type ZeroCopyRebarCage3DViews,
  type ZeroCopyStationViews,
} from "@/core/mechanics/wasm-mechanics-bridge";
import type { SteelOptimizationResult } from "@/core/steel/steel-section-optimizer";
import { optimizeSteelSection } from "@/core/steel/steel-section-optimizer";
import {
  beamSimulatorActions,
  type GoverningInternalForces,
  useBeamSimulatorStore,
} from "@/state/beam-simulator-store";
import type { ExternalLoadsModeAConfig } from "@/types/beam-loading-modes";
import { kilonewton, kilonewtonMeter, meter } from "@/types/branded-units";
import type { ConcreteOptimizationResult } from "@/types/concrete-sni2847-types";
import type { SteelProfileType, SteelSectionProperties } from "@/types/steel-sni1729-types";

/**
 * Result bundle returned by `useStructuralSolverEngine`.
 */
export interface StructuralSolverEngineResult {
  readonly isSolving: boolean;
  readonly solverRevision: number;
  readonly solverError: string | null;
  readonly meshViews: ZeroCopyMesh3DViews | null;
  readonly rebarCageViews: ZeroCopyRebarCage3DViews | null;
  readonly stationViews: ZeroCopyStationViews | null;
  readonly maxDeflectionMm: number;
  readonly maxDeflectionStationM: number;
  readonly governingForces: GoverningInternalForces;
  readonly concreteResult: ConcreteOptimizationResult | null;
  readonly steelResult: SteelOptimizationResult | null;
  readonly compliance: DeflectionEvaluationResult | null;
}

/**
 * Builds a 3D extrusion cross-section input from a steel section's primary dimensions,
 * or falls back to default dimensions if no section is available.
 *
 * @param profileType Active steel profile type ("IWF" or "BOX").
 * @param props Optional steel section properties from catalog or parametric optimization.
 * @returns Extrusion cross-section input for the Rust WASM 3D mesh generator.
 */
function buildSteelExtrusionCrossSection(
  profileType: SteelProfileType,
  props?: SteelSectionProperties,
): ExtrusionCrossSectionInput {
  if (profileType === "BOX") {
    const hMm = props ? Number(props.H) : 200;
    const bMm = props ? Number(props.B) : 200;
    const tMm = props ? Number(props.t ?? props.tw) : 8;
    return {
      kind: "BOX",
      hMm,
      bMm,
      tMm,
    };
  }

  const dMm = props ? Number(props.H) : 300;
  const bfMm = props ? Number(props.B) : 150;
  const twMm = props ? Number(props.tw) : 6.5;
  const tfMm = props ? Number(props.tf) : 9.0;
  const rMm = props ? Number(props.r ?? 13.0) : 13.0;
  return {
    kind: "IWF",
    dMm,
    bfMm,
    twMm,
    tfMm,
    rMm,
  };
}

/**
 * Core reactive engine hook that synchronizes Mode A / Mode B structural mechanics,
 * SNI 1729 / SNI 2847 section optimization (including custom parametric BOX sections),
 * 3D WebGL extrusion meshes, and 256-station diagrams.
 *
 * @returns Reactive solver outputs, 3D mesh views, diagram views, and compliance status.
 * @example
 * const { meshViews, stationViews, steelResult, solverError } = useStructuralSolverEngine();
 */
export function useStructuralSolverEngine(): StructuralSolverEngineResult {
  const store = useBeamSimulatorStore();

  const [meshViews, setMeshViews] = useState<ZeroCopyMesh3DViews | null>(null);
  const [rebarCageViews, setRebarCageViews] = useState<ZeroCopyRebarCage3DViews | null>(null);
  const [stationViews, setStationViews] = useState<ZeroCopyStationViews | null>(null);
  const [compliance, setCompliance] = useState<DeflectionEvaluationResult | null>(null);

  useEffect(() => {
    try {
      beamSimulatorActions.setIsSolving(true);

      const isSteel = store.materialKind === "STEEL";
      const isModeA = store.loadingMode === "MODE_A_EXTERNAL_LOADS";
      const limitKey = `L_${store.deflectionLimitDenominator}` as const;

      // 1. Resolve initial Elastic Modulus (E) & Moment of Inertia (I)
      let E_Mpa = 200_000;
      let I_Mm4 = 100_000_000;

      const fcVal = store.concreteCubeGrade
        ? Number(convertCubeToCylinderMpa(store.concreteCubeGrade))
        : Number(store.concreteFcMpa);

      if (!isSteel) {
        E_Mpa = 4700 * Math.sqrt(Math.max(fcVal, 17));
        const bw = Number(store.concreteBwMm);
        const h = Number(store.concreteHMm);
        I_Mm4 = (bw * h ** 3) / 12;
      }

      const activeSpanM = isModeA
        ? Math.max(0.1, Number(store.spanLengthM))
        : Math.max(0.1, Number(store.directSpanLengthM));

      const effectiveLbM =
        Number(store.steelUnbracedLengthLbM) > 0
          ? Number(store.steelUnbracedLengthLbM)
          : activeSpanM;

      let maxDefl = 0;
      let maxDeflStation = 0;
      let govForces: GoverningInternalForces = {
        maxPositiveMux: 0,
        maxNegativeMux: 0,
        absoluteMaxMux: 0,
        absoluteMaxMuy: 0,
        absoluteMaxVu: 0,
        absoluteMaxPu: 0,
        absoluteMaxTu: 0,
      };

      let concOptResult: ConcreteOptimizationResult | null = null;
      let steelOptResult: SteelOptimizationResult | null = null;
      let optimizationErrorMsg: string | null = null;

      if (isModeA) {
        const modeAConfig: ExternalLoadsModeAConfig = {
          mode: "MODE_A_EXTERNAL_LOADS",
          spanLength: store.spanLengthM,
          supportOrientation: store.supportOrientation,
          includeSelfWeight: store.includeSelfWeight,
          pointLoads: store.pointLoads,
          distributedLoads: store.distributedLoads,
          appliedMoments: [],
        };

        // Initial cross-section for reactions & internal force diagram evaluation
        let crossSection: ExtrusionCrossSectionInput = isSteel
          ? buildSteelExtrusionCrossSection(store.steelProfileType)
          : {
              kind: "CONCRETE_RECT",
              bwMm: Number(store.concreteBwMm),
              hMm: Number(store.concreteHMm),
              rebarCage: {
                coverMm: Number(store.concreteCoverMm),
                stirrupDiaMm: 10,
                stirrupSpacingMm: 150,
                tensileBarCount: 4,
                tensileBarDiaMm: 19,
                compressiveBarCount: 2,
                compressiveBarDiaMm: 13,
              },
            };

        const initialSolve = solveEulerBernoulliDeflection({
          loadingConfig: modeAConfig,
          elasticModulusMpa: E_Mpa,
          momentOfInertiaMm4: I_Mm4,
          crossSection,
          visualScale: 15.0,
          coordinateMode: store.coordinateMode,
        });

        govForces = {
          maxPositiveMux: initialSolve.diagrams.maxPositiveMomentKnm,
          maxNegativeMux: initialSolve.diagrams.maxNegativeMomentKnm,
          absoluteMaxMux: Math.max(
            Math.abs(initialSolve.diagrams.maxPositiveMomentKnm),
            Math.abs(initialSolve.diagrams.maxNegativeMomentKnm),
          ),
          absoluteMaxMuy: 0,
          absoluteMaxVu: initialSolve.diagrams.maxShearAbsKn,
          absoluteMaxPu: Math.abs(initialSolve.diagrams.reactions.raAxialKn),
          absoluteMaxTu: 0,
        };

        // Run SNI section optimization using Mode A governing forces
        try {
          if (!isSteel) {
            concOptResult = optimizeConcreteSection({
              factoredMomentMu: kilonewtonMeter(govForces.absoluteMaxMux),
              factoredShearVu: kilonewton(govForces.absoluteMaxVu),
              fc: fcVal,
              spanLengthM: meter(activeSpanM),
              longitudinalRebarGrade: store.longitudinalRebarGrade,
              stirrupRebarGrade: store.stirrupRebarGrade,
              concreteCoverMm: Number(store.concreteCoverMm),
              minBwMm: Number(store.concreteBwMm),
              maxBwMm: Number(store.concreteBwMm) + 100,
              minHMm: Number(store.concreteHMm),
              maxHMm: Number(store.concreteHMm) + 150,
            });
          } else {
            const rawSteelOpt = optimizeSteelSection({
              factoredMomentMux: kilonewtonMeter(govForces.absoluteMaxMux),
              factoredMomentMuy: kilonewtonMeter(0),
              factoredShearVu: kilonewton(govForces.absoluteMaxVu),
              factoredAxialPu: kilonewton(govForces.absoluteMaxPu),
              factoredTorsionTu: kilonewtonMeter(govForces.absoluteMaxTu),
              unbracedLengthLbM: meter(effectiveLbM),
              spanLengthM: meter(activeSpanM),
              deflectionLimitKey: limitKey,
              profileType: store.steelProfileType,
              steelGrade: store.steelGrade,
              maxDepthMm: store.steelMaxHeightMm ? Number(store.steelMaxHeightMm) : undefined,
              maxWidthMm: store.steelMaxWidthMm ? Number(store.steelMaxWidthMm) : undefined,
              customBoxConfig: store.customBoxConfig,
            });

            const userCandidate = store.selectedSteelProfileName
              ? rawSteelOpt.compliantCandidates.find(
                  (c) => c.properties.name === store.selectedSteelProfileName,
                )
              : undefined;

            const activeCandidate = userCandidate ?? rawSteelOpt.bestCandidate;
            steelOptResult = userCandidate
              ? { ...rawSteelOpt, bestCandidate: userCandidate }
              : rawSteelOpt;

            E_Mpa = Number(activeCandidate.grade.E);
            I_Mm4 = Number(activeCandidate.properties.Ix);
            crossSection = buildSteelExtrusionCrossSection(
              store.steelProfileType,
              activeCandidate.properties,
            );
          }
        } catch (optErr) {
          optimizationErrorMsg = optErr instanceof Error ? optErr.message : String(optErr);
        }

        // Re-solve deflection & 3D mesh with exact section stiffness (Ix) and geometry
        const finalSolve = solveEulerBernoulliDeflection({
          loadingConfig: modeAConfig,
          elasticModulusMpa: E_Mpa,
          momentOfInertiaMm4: I_Mm4,
          crossSection,
          visualScale: 15.0,
          coordinateMode: store.coordinateMode,
        });

        maxDefl = finalSolve.maxDeflectionMm;
        maxDeflStation = finalSolve.maxDeflectionStationM;

        setMeshViews(finalSolve.mesh3D);
        setRebarCageViews(finalSolve.rebarCage3D);
        setStationViews(getZeroCopyStationViews());
      } else {
        // Mode B: Direct Factored Internal Forces
        govForces = {
          maxPositiveMux: Math.max(0, Number(store.directMomentMuxKnm)),
          maxNegativeMux: Math.min(0, Number(store.directMomentMuxKnm)),
          absoluteMaxMux: Math.abs(Number(store.directMomentMuxKnm)),
          absoluteMaxMuy: Math.abs(Number(store.directMomentMuyKnm)),
          absoluteMaxVu: Math.abs(Number(store.directShearVuKn)),
          absoluteMaxPu: Math.abs(Number(store.directAxialPuKn)),
          absoluteMaxTu: Math.abs(Number(store.directTorsionTuKnm)),
        };

        let crossSection: ExtrusionCrossSectionInput = isSteel
          ? buildSteelExtrusionCrossSection(store.steelProfileType)
          : {
              kind: "CONCRETE_RECT",
              bwMm: Number(store.concreteBwMm),
              hMm: Number(store.concreteHMm),
              rebarCage: {
                coverMm: Number(store.concreteCoverMm),
                stirrupDiaMm: 10,
                stirrupSpacingMm: 150,
                tensileBarCount: 4,
                tensileBarDiaMm: 19,
                compressiveBarCount: 2,
                compressiveBarDiaMm: 13,
              },
            };

        // Run SNI section optimization first so Mode B uses the true optimized profile stiffness & 3D dimensions
        try {
          if (!isSteel) {
            concOptResult = optimizeConcreteSection({
              factoredMomentMu: kilonewtonMeter(govForces.absoluteMaxMux),
              factoredShearVu: kilonewton(govForces.absoluteMaxVu),
              fc: fcVal,
              spanLengthM: meter(activeSpanM),
              longitudinalRebarGrade: store.longitudinalRebarGrade,
              stirrupRebarGrade: store.stirrupRebarGrade,
              concreteCoverMm: Number(store.concreteCoverMm),
              minBwMm: Number(store.concreteBwMm),
              maxBwMm: Number(store.concreteBwMm) + 100,
              minHMm: Number(store.concreteHMm),
              maxHMm: Number(store.concreteHMm) + 150,
            });
          } else {
            const rawSteelOpt = optimizeSteelSection({
              factoredMomentMux: kilonewtonMeter(govForces.absoluteMaxMux),
              factoredMomentMuy: kilonewtonMeter(govForces.absoluteMaxMuy),
              factoredShearVu: kilonewton(govForces.absoluteMaxVu),
              factoredAxialPu: kilonewton(Number(store.directAxialPuKn)),
              factoredTorsionTu: kilonewtonMeter(govForces.absoluteMaxTu),
              unbracedLengthLbM: meter(effectiveLbM),
              spanLengthM: meter(activeSpanM),
              deflectionLimitKey: limitKey,
              profileType: store.steelProfileType,
              steelGrade: store.steelGrade,
              maxDepthMm: store.steelMaxHeightMm ? Number(store.steelMaxHeightMm) : undefined,
              maxWidthMm: store.steelMaxWidthMm ? Number(store.steelMaxWidthMm) : undefined,
              customBoxConfig: store.customBoxConfig,
            });

            const userCandidate = store.selectedSteelProfileName
              ? rawSteelOpt.compliantCandidates.find(
                  (c) => c.properties.name === store.selectedSteelProfileName,
                )
              : undefined;

            const activeCandidate = userCandidate ?? rawSteelOpt.bestCandidate;
            steelOptResult = userCandidate
              ? { ...rawSteelOpt, bestCandidate: userCandidate }
              : rawSteelOpt;

            E_Mpa = Number(activeCandidate.grade.E);
            I_Mm4 = Number(activeCandidate.properties.Ix);
            crossSection = buildSteelExtrusionCrossSection(
              store.steelProfileType,
              activeCandidate.properties,
            );
          }
        } catch (optErr) {
          optimizationErrorMsg = optErr instanceof Error ? optErr.message : String(optErr);
        }

        // Interpolate Mode B internal forces & generate 3D extruded mesh + 256-node station views
        const modeBRes = interpolateModeBInternalForces({
          modeBConfig: {
            mode: "MODE_B_DIRECT_INTERNAL_FORCES",
            spanLength: store.directSpanLengthM,
            axialForcePu: store.directAxialPuKn,
            strongAxisMomentMux: store.directMomentMuxKnm,
            weakAxisMomentMuy: store.directMomentMuyKnm,
            torsionTu: store.directTorsionTuKnm,
            shearForceVu: store.directShearVuKn,
          },
          supportOrientation: store.supportOrientation,
          elasticModulusMpa: E_Mpa,
          momentOfInertiaMm4: I_Mm4,
          deflectionLimitKey: limitKey,
          crossSection,
          visualScale: 15.0,
          coordinateMode: store.coordinateMode,
        });

        maxDefl = Number(modeBRes.maxDeflectionMm);
        maxDeflStation = Number(modeBRes.maxDeflectionStationM);

        setMeshViews(modeBRes.mesh3D);
        setRebarCageViews(modeBRes.rebarCage3D);
        setStationViews(getZeroCopyStationViews());
      }

      // 3. Evaluate Deflection Serviceability Compliance
      const isCantilever = store.supportOrientation.startsWith("CANTILEVER");
      const compRes = evaluateDeflectionCompliance(
        maxDefl,
        meter(activeSpanM),
        limitKey,
        isCantilever,
      );
      setCompliance(compRes);

      // 4. Commit all computed outputs (and any optimization error) to the central store
      beamSimulatorActions.setSolverResults({
        maxDeflectionMm: maxDefl,
        maxDeflectionStationM: maxDeflStation,
        governingForces: govForces,
        concreteOptimizationResult: concOptResult,
        steelOptimizationResult: steelOptResult,
        solverError: optimizationErrorMsg,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      beamSimulatorActions.setSolverError(msg);
    }
  }, [
    store.materialKind,
    store.loadingMode,
    store.spanLengthM,
    store.supportOrientation,
    store.includeSelfWeight,
    store.pointLoads,
    store.distributedLoads,
    store.directSpanLengthM,
    store.directAxialPuKn,
    store.directMomentMuxKnm,
    store.directMomentMuyKnm,
    store.directTorsionTuKnm,
    store.directShearVuKn,
    store.concreteBwMm,
    store.concreteHMm,
    store.concreteCoverMm,
    store.concreteFcMpa,
    store.concreteCubeGrade,
    store.longitudinalRebarGrade,
    store.stirrupRebarGrade,
    store.maxAggregateSizeMm,
    store.steelProfileType,
    store.steelGrade,
    store.steelUnbracedLengthLbM,
    store.steelMaxHeightMm,
    store.steelMaxWidthMm,
    store.selectedSteelProfileName,
    store.customBoxConfig,
    store.coordinateMode,
    store.deflectionLimitDenominator,
  ]);

  return {
    isSolving: store.isSolving,
    solverRevision: store.solverRevision,
    solverError: store.solverError,
    meshViews,
    rebarCageViews,
    stationViews,
    maxDeflectionMm: store.maxDeflectionMm,
    maxDeflectionStationM: store.maxDeflectionStationM,
    governingForces: store.governingForces,
    concreteResult: store.concreteOptimizationResult,
    steelResult: store.steelOptimizationResult,
    compliance,
  };
}
