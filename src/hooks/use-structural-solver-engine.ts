/**
 * @file use-structural-solver-engine.ts
 * @description Master reactive hook linking simulator store inputs to the Rust WASM
 * mechanics engine and TypeScript SNI 2847 (Concrete) & SNI 1729 (Steel) optimizers.
 * Provides zero-copy 3D mesh views and diagram station arrays.
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
import { optimizeSteelSection } from "@/core/steel/steel-section-optimizer";
import type { SteelOptimizationResult } from "@/core/steel/steel-section-optimizer";
import {
  beamSimulatorActions,
  type GoverningInternalForces,
  useBeamSimulatorStore,
} from "@/state/beam-simulator-store";
import type { ExternalLoadsModeAConfig } from "@/types/beam-loading-modes";
import { kilonewton, kilonewtonMeter, meter } from "@/types/branded-units";
import type { ConcreteOptimizationResult } from "@/types/concrete-sni2847-types";

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
 * Core reactive engine hook.
 */
export function useStructuralSolverEngine(): StructuralSolverEngineResult {
  const store = useBeamSimulatorStore();

  const [meshViews, setMeshViews] = useState<ZeroCopyMesh3DViews | null>(null);
  const [rebarCageViews, setRebarCageViews] = useState<ZeroCopyRebarCage3DViews | null>(null);
  const [stationViews, setStationViews] = useState<ZeroCopyStationViews | null>(null);
  const [compliance, setCompliance] = useState<DeflectionEvaluationResult | null>(null);

  // Trigger solver whenever core physical inputs change
  useEffect(() => {
    try {
      beamSimulatorActions.setIsSolving(true);

      const isSteel = store.materialKind === "STEEL";
      const isModeA = store.loadingMode === "MODE_A_EXTERNAL_LOADS";

      // 1. Resolve Elastic Modulus (E) & Moment of Inertia (I) for mechanics solver
      let E_Mpa = 200_000;
      let I_Mm4 = 100_000_000;

      if (!isSteel) {
        // Concrete Ec = 4700 * sqrt(fc')
        const fcVal = store.concreteCubeGrade
          ? Number(convertCubeToCylinderMpa(store.concreteCubeGrade))
          : Number(store.concreteFcMpa);
        E_Mpa = 4700 * Math.sqrt(Math.max(fcVal, 17));
        const bw = Number(store.concreteBwMm);
        const h = Number(store.concreteHMm);
        I_Mm4 = (bw * h ** 3) / 12;
      }

      let maxDefl = 0;
      let maxDeflStation = 0;
      let govForces: GoverningInternalForces = {
        maxPositiveMux: 0,
        maxNegativeMux: 0,
        absoluteMaxMux: 0,
        absoluteMaxVu: 0,
        absoluteMaxPu: 0,
        absoluteMaxTu: 0,
      };

      let activeSpanM = Number(store.spanLengthM);

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

        // Determine 3D extrusion cross section
        let crossSection: ExtrusionCrossSectionInput;
        if (isSteel) {
          if (store.steelProfileType === "BOX") {
            crossSection = {
              kind: "BOX",
              hMm: 200,
              bMm: 200,
              tMm: 8,
            };
          } else {
            crossSection = {
              kind: "IWF",
              dMm: 300,
              bfMm: 150,
              twMm: 6.5,
              tfMm: 9.0,
              rMm: 13.0,
            };
          }
        } else {
          crossSection = {
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
        }

        const solveRes = solveEulerBernoulliDeflection({
          loadingConfig: modeAConfig,
          elasticModulusMpa: E_Mpa,
          momentOfInertiaMm4: I_Mm4,
          crossSection,
          visualScale: 15.0,
          coordinateMode: store.coordinateMode,
        });

        maxDefl = solveRes.maxDeflectionMm;
        maxDeflStation = solveRes.maxDeflectionStationM;

        govForces = {
          maxPositiveMux: solveRes.diagrams.maxPositiveMomentKnm,
          maxNegativeMux: solveRes.diagrams.maxNegativeMomentKnm,
          absoluteMaxMux: Math.max(
            Math.abs(solveRes.diagrams.maxPositiveMomentKnm),
            Math.abs(solveRes.diagrams.maxNegativeMomentKnm),
          ),
          absoluteMaxVu: solveRes.diagrams.maxShearAbsKn,
          absoluteMaxPu: solveRes.diagrams.reactions.raAxialKn,
          absoluteMaxTu: 0,
        };

        setMeshViews(solveRes.mesh3D);
        setRebarCageViews(solveRes.rebarCage3D);
        setStationViews(getZeroCopyStationViews());
      } else {
        // Mode B: Direct Internal Forces
        activeSpanM = Number(store.directSpanLengthM);
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
        });

        maxDefl = modeBRes.maxDeflectionMm;
        maxDeflStation = modeBRes.maxDeflectionStationM;

        govForces = {
          maxPositiveMux: Math.max(0, Number(store.directMomentMuxKnm)),
          maxNegativeMux: Math.min(0, Number(store.directMomentMuxKnm)),
          absoluteMaxMux: Math.abs(Number(store.directMomentMuxKnm)),
          absoluteMaxVu: Math.abs(Number(store.directShearVuKn)),
          absoluteMaxPu: Math.abs(Number(store.directAxialPuKn)),
          absoluteMaxTu: Math.abs(Number(store.directTorsionTuKnm)),
        };

        setMeshViews(null);
        setRebarCageViews(null);
        setStationViews(null);
      }

      // 2. Run SNI Concrete or Steel Section Optimization
      let concOptResult: ConcreteOptimizationResult | null = null;
      let steelOptResult: SteelOptimizationResult | null = null;

      if (!isSteel) {
        const fcVal = store.concreteCubeGrade
          ? Number(convertCubeToCylinderMpa(store.concreteCubeGrade))
          : Number(store.concreteFcMpa);

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
        steelOptResult = optimizeSteelSection({
          factoredMomentMux: kilonewtonMeter(govForces.absoluteMaxMux),
          factoredMomentMuy: kilonewtonMeter(0),
          factoredShearVu: kilonewton(govForces.absoluteMaxVu),
          factoredAxialPu: kilonewton(govForces.absoluteMaxPu),
          factoredTorsionTu: kilonewtonMeter(govForces.absoluteMaxTu),
          unbracedLengthLbM: meter(activeSpanM),
          profileType: store.steelProfileType,
          steelGrade: store.steelGrade,
          maxDepthMm: store.steelMaxHeightMm ? Number(store.steelMaxHeightMm) : undefined,
          maxWidthMm: store.steelMaxWidthMm ? Number(store.steelMaxWidthMm) : undefined,
        });
      }

      // 3. Evaluate Deflection Serviceability Compliance
      const limitKey = `L_${store.deflectionLimitDenominator}` as const;
      const isCantilever = store.supportOrientation.startsWith("CANTILEVER");
      const compRes = evaluateDeflectionCompliance(
        maxDefl,
        meter(activeSpanM),
        limitKey,
        isCantilever,
      );
      setCompliance(compRes);

      // 4. Update Simulator Store
      beamSimulatorActions.setSolverResults({
        maxDeflectionMm: maxDefl,
        maxDeflectionStationM: maxDeflStation,
        governingForces: govForces,
        concreteOptimizationResult: concOptResult,
        steelOptimizationResult: steelOptResult,
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
