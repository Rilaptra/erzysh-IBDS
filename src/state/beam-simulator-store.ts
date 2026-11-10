// src/state/beam-simulator-store.ts
/**
 * @file beam-simulator-store.ts
 * @description Central reactive state store for the beam deflection and design simulator.
 * Built using React's useSyncExternalStore pattern for zero-dependency, ultra-fast,
 * and flicker-free updates across 60 FPS slider interactions.
 */

import { useSyncExternalStore } from "react";

import type {
  BeamMaterialKind,
  ConcreteViewMode,
} from "@/components/canvas/Beam3DExtrudedViewport";
import type { SteelOptimizationResult } from "@/core/steel/steel-section-optimizer";
import type { DistributedLoad, PointLoad, SupportOrientation } from "@/types/beam-loading-modes";
import type {
  CoordinateSystemMode,
  Kilonewton,
  KilonewtonMeter,
  KilonewtonPerMeter,
  Megapascal,
  Meter,
  Millimeter,
  Vector3D,
} from "@/types/branded-units";
import type {
  ConcreteCubeGrade,
  ConcreteOptimizationResult,
  RebarSteelGrade,
} from "@/types/concrete-sni2847-types";
import type { SteelGrade, SteelProfileType } from "@/types/steel-sni1729-types";

/**
 * Supported 2D internal force diagram display layouts.
 */
export type DiagramDisplayMode = "IN_PLACE_BEAM_AXIS" | "STACKED_VERTICAL" | "FLOATING_WINDOW";

/**
 * Diagram layer visibility flags.
 */
export interface DiagramVisibilityFlags {
  readonly sfd: boolean;
  readonly bmd: boolean;
  readonly nfd: boolean;
  readonly tfd: boolean;
}

/**
 * Evaluated governing internal forces across the beam span.
 */
export interface GoverningInternalForces {
  readonly maxPositiveMux: number;
  readonly maxNegativeMux: number;
  readonly absoluteMaxMux: number;
  readonly absoluteMaxMuy: number;
  readonly absoluteMaxVu: number;
  readonly absoluteMaxPu: number;
  readonly absoluteMaxTu: number;
}

/**
 * Complete immutable simulator state tree.
 */
export interface BeamSimulatorState {
  /** Active material family. */
  readonly materialKind: BeamMaterialKind;
  /** Active loading calculation paradigm (Mode A vs Mode B). */
  readonly loadingMode: "MODE_A_EXTERNAL_LOADS" | "MODE_B_DIRECT_INTERNAL_FORCES";

  // Mode A: Interactive External Loads
  readonly spanLengthM: Meter;
  readonly supportOrientation: SupportOrientation;
  readonly includeSelfWeight: boolean;
  readonly pointLoads: readonly PointLoad[];
  readonly distributedLoads: readonly DistributedLoad[];

  // Mode B: Direct Factored Internal Forces
  readonly directSpanLengthM: Meter;
  readonly directAxialPuKn: Kilonewton;
  readonly directMomentMuxKnm: KilonewtonMeter;
  readonly directMomentMuyKnm: KilonewtonMeter;
  readonly directTorsionTuKnm: KilonewtonMeter;
  readonly directShearVuKn: Kilonewton;

  // Concrete design parameters (SNI 2847:2019)
  readonly concreteBwMm: Millimeter;
  readonly concreteHMm: Millimeter;
  readonly concreteCoverMm: Millimeter;
  readonly concreteFcMpa: Megapascal;
  readonly concreteCubeGrade: ConcreteCubeGrade | null;
  readonly longitudinalRebarGrade: RebarSteelGrade;
  readonly stirrupRebarGrade: RebarSteelGrade;
  readonly maxAggregateSizeMm: number;
  readonly concreteViewMode: ConcreteViewMode;

  // Steel design parameters (SNI 1729:2020)
  readonly steelProfileType: SteelProfileType;
  readonly steelGrade: SteelGrade;
  readonly steelUnbracedLengthLbM: Meter;
  readonly steelMaxHeightMm: Millimeter | undefined;
  readonly steelMaxWidthMm: Millimeter | undefined;
  readonly selectedSteelProfileName: string | null;

  // Visual & Canvas Preferences
  readonly coordinateMode: CoordinateSystemMode;
  readonly customUpVector: Vector3D;
  readonly diagramDisplayMode: DiagramDisplayMode;
  readonly visibleDiagrams: DiagramVisibilityFlags;
  readonly deflectionLimitDenominator: 180 | 240 | 360 | 480;

  // Solver Engine Computed Outputs
  readonly isSolving: boolean;
  readonly solverRevision: number;
  readonly solverError: string | null;
  readonly maxDeflectionMm: number;
  readonly maxDeflectionStationM: number;
  readonly governingForces: GoverningInternalForces;
  readonly concreteOptimizationResult: ConcreteOptimizationResult | null;
  readonly steelOptimizationResult: SteelOptimizationResult | null;
}

/** Initial default state satisfying civil engineering best practices. */
const INITIAL_STATE: BeamSimulatorState = {
  materialKind: "STEEL",
  loadingMode: "MODE_A_EXTERNAL_LOADS",

  spanLengthM: 6.0 as Meter,
  supportOrientation: "PINNED_ROLLER",
  includeSelfWeight: false,
  pointLoads: [
    {
      id: "P1",
      magnitude: 50 as Kilonewton,
      position: 3.0 as Meter,
    },
  ],
  distributedLoads: [
    {
      id: "Q1",
      magnitude: 15 as KilonewtonPerMeter,
      startPosition: 0 as Meter,
      endPosition: 6.0 as Meter,
    },
  ],

  directSpanLengthM: 6.0 as Meter,
  directAxialPuKn: 0 as Kilonewton,
  directMomentMuxKnm: 120 as KilonewtonMeter,
  directMomentMuyKnm: 0 as KilonewtonMeter,
  directTorsionTuKnm: 0 as KilonewtonMeter,
  directShearVuKn: 80 as Kilonewton,

  concreteBwMm: 300 as Millimeter,
  concreteHMm: 500 as Millimeter,
  concreteCoverMm: 40 as Millimeter,
  concreteFcMpa: 25 as Megapascal,
  concreteCubeGrade: null,
  longitudinalRebarGrade: "BJTS_40",
  stirrupRebarGrade: "BJTP_24",
  maxAggregateSizeMm: 20,
  concreteViewMode: "SOLID_WITH_END_SECTION",

  steelProfileType: "IWF",
  steelGrade: "BJ_37",
  steelUnbracedLengthLbM: 6.0 as Meter,
  steelMaxHeightMm: undefined,
  steelMaxWidthMm: undefined,
  selectedSteelProfileName: null,

  coordinateMode: "Z-Up",
  customUpVector: { x: 0, y: 0, z: 1 },
  diagramDisplayMode: "IN_PLACE_BEAM_AXIS",
  visibleDiagrams: { sfd: true, bmd: true, nfd: false, tfd: false },
  deflectionLimitDenominator: 360,

  isSolving: false,
  solverRevision: 0,
  solverError: null,
  maxDeflectionMm: 0,
  maxDeflectionStationM: 0,
  governingForces: {
    maxPositiveMux: 0,
    maxNegativeMux: 0,
    absoluteMaxMux: 0,
    absoluteMaxMuy: 0,
    absoluteMaxVu: 0,
    absoluteMaxPu: 0,
    absoluteMaxTu: 0,
  },
  concreteOptimizationResult: null,
  steelOptimizationResult: null,
};

// Subscriber listeners
let currentState = INITIAL_STATE;
const listeners = new Set<() => void>();

/**
 * Notifies all subscribed React components of a state transition.
 */
function emitChange(): void {
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Setter and mutation actions exposed by the simulator store.
 */
export const beamSimulatorActions = {
  setMaterialKind(materialKind: BeamMaterialKind): void {
    currentState = { ...currentState, materialKind };
    emitChange();
  },

  setLoadingMode(loadingMode: "MODE_A_EXTERNAL_LOADS" | "MODE_B_DIRECT_INTERNAL_FORCES"): void {
    currentState = { ...currentState, loadingMode };
    emitChange();
  },

  setSpanLength(spanLengthM: number): void {
    if (spanLengthM > 0 && Number.isFinite(spanLengthM)) {
      currentState = { ...currentState, spanLengthM: spanLengthM as Meter };
      emitChange();
    }
  },

  setSupportOrientation(supportOrientation: SupportOrientation): void {
    currentState = { ...currentState, supportOrientation };
    emitChange();
  },

  setIncludeSelfWeight(includeSelfWeight: boolean): void {
    currentState = { ...currentState, includeSelfWeight };
    emitChange();
  },

  setPointLoads(pointLoads: readonly PointLoad[]): void {
    currentState = { ...currentState, pointLoads };
    emitChange();
  },

  setDistributedLoads(distributedLoads: readonly DistributedLoad[]): void {
    currentState = { ...currentState, distributedLoads };
    emitChange();
  },

  /**
   * Updates Mode B direct internal forces and automatically activates
   * `MODE_B_DIRECT_INTERNAL_FORCES` so the solver engine responds immediately.
   *
   * @param forces Partial set of direct factored internal forces and span length.
   */
  setDirectForces(forces: {
    spanLengthM?: number;
    axialPuKn?: number;
    momentMuxKnm?: number;
    momentMuyKnm?: number;
    torsionTuKnm?: number;
    shearVuKn?: number;
  }): void {
    currentState = {
      ...currentState,
      loadingMode: "MODE_B_DIRECT_INTERNAL_FORCES",
      directSpanLengthM:
        forces.spanLengthM !== undefined
          ? (forces.spanLengthM as Meter)
          : currentState.directSpanLengthM,
      directAxialPuKn:
        forces.axialPuKn !== undefined
          ? (forces.axialPuKn as Kilonewton)
          : currentState.directAxialPuKn,
      directMomentMuxKnm:
        forces.momentMuxKnm !== undefined
          ? (forces.momentMuxKnm as KilonewtonMeter)
          : currentState.directMomentMuxKnm,
      directMomentMuyKnm:
        forces.momentMuyKnm !== undefined
          ? (forces.momentMuyKnm as KilonewtonMeter)
          : currentState.directMomentMuyKnm,
      directTorsionTuKnm:
        forces.torsionTuKnm !== undefined
          ? (forces.torsionTuKnm as KilonewtonMeter)
          : currentState.directTorsionTuKnm,
      directShearVuKn:
        forces.shearVuKn !== undefined
          ? (forces.shearVuKn as Kilonewton)
          : currentState.directShearVuKn,
    };
    emitChange();
  },

  setConcreteParameters(params: {
    bwMm?: number;
    hMm?: number;
    coverMm?: number;
    fcMpa?: number;
    cubeGrade?: ConcreteCubeGrade | null;
    longitudinalGrade?: RebarSteelGrade;
    stirrupGrade?: RebarSteelGrade;
    maxAggregateMm?: number;
  }): void {
    currentState = {
      ...currentState,
      concreteBwMm:
        params.bwMm !== undefined ? (params.bwMm as Millimeter) : currentState.concreteBwMm,
      concreteHMm: params.hMm !== undefined ? (params.hMm as Millimeter) : currentState.concreteHMm,
      concreteCoverMm:
        params.coverMm !== undefined
          ? (params.coverMm as Millimeter)
          : currentState.concreteCoverMm,
      concreteFcMpa:
        params.fcMpa !== undefined ? (params.fcMpa as Megapascal) : currentState.concreteFcMpa,
      concreteCubeGrade:
        params.cubeGrade !== undefined ? params.cubeGrade : currentState.concreteCubeGrade,
      longitudinalRebarGrade: params.longitudinalGrade ?? currentState.longitudinalRebarGrade,
      stirrupRebarGrade: params.stirrupGrade ?? currentState.stirrupRebarGrade,
      maxAggregateSizeMm: params.maxAggregateMm ?? currentState.maxAggregateSizeMm,
    };
    emitChange();
  },

  setConcreteViewMode(concreteViewMode: ConcreteViewMode): void {
    currentState = { ...currentState, concreteViewMode };
    emitChange();
  },

  setSteelParameters(params: {
    profileType?: SteelProfileType;
    grade?: SteelGrade;
    unbracedLengthLbM?: number;
    maxHeightMm?: number;
    maxWidthMm?: number;
    selectedProfileName?: string | null;
  }): void {
    const nextProfileType = params.profileType ?? currentState.steelProfileType;
    const profileTypeChanged = nextProfileType !== currentState.steelProfileType;

    currentState = {
      ...currentState,
      steelProfileType: nextProfileType,
      steelGrade: params.grade ?? currentState.steelGrade,
      steelUnbracedLengthLbM:
        params.unbracedLengthLbM !== undefined
          ? (params.unbracedLengthLbM as Meter)
          : currentState.steelUnbracedLengthLbM,
      steelMaxHeightMm:
        "maxHeightMm" in params
          ? params.maxHeightMm !== undefined
            ? (params.maxHeightMm as Millimeter)
            : undefined
          : currentState.steelMaxHeightMm,
      steelMaxWidthMm:
        "maxWidthMm" in params
          ? params.maxWidthMm !== undefined
            ? (params.maxWidthMm as Millimeter)
            : undefined
          : currentState.steelMaxWidthMm,
      selectedSteelProfileName:
        params.selectedProfileName !== undefined
          ? params.selectedProfileName
          : profileTypeChanged
            ? null
            : currentState.selectedSteelProfileName,
    };
    emitChange();
  },

  setCoordinateMode(coordinateMode: CoordinateSystemMode, customUpVector?: Vector3D): void {
    currentState = {
      ...currentState,
      coordinateMode,
      customUpVector: customUpVector ?? currentState.customUpVector,
    };
    emitChange();
  },

  setDiagramDisplayMode(diagramDisplayMode: DiagramDisplayMode): void {
    currentState = { ...currentState, diagramDisplayMode };
    emitChange();
  },

  toggleDiagramVisibility(diagram: keyof DiagramVisibilityFlags): void {
    currentState = {
      ...currentState,
      visibleDiagrams: {
        ...currentState.visibleDiagrams,
        [diagram]: !currentState.visibleDiagrams[diagram],
      },
    };
    emitChange();
  },

  setDeflectionLimitDenominator(denominator: 180 | 240 | 360 | 480): void {
    currentState = { ...currentState, deflectionLimitDenominator: denominator };
    emitChange();
  },

  setSolverResults(results: {
    maxDeflectionMm: number;
    maxDeflectionStationM: number;
    governingForces: GoverningInternalForces;
    concreteOptimizationResult: ConcreteOptimizationResult | null;
    steelOptimizationResult: SteelOptimizationResult | null;
    solverError?: string | null;
  }): void {
    currentState = {
      ...currentState,
      isSolving: false,
      solverRevision: currentState.solverRevision + 1,
      solverError: results.solverError ?? null,
      maxDeflectionMm: results.maxDeflectionMm,
      maxDeflectionStationM: results.maxDeflectionStationM,
      governingForces: results.governingForces,
      concreteOptimizationResult: results.concreteOptimizationResult,
      steelOptimizationResult: results.steelOptimizationResult,
    };
    emitChange();
  },

  /**
   * Records a solver or design optimization error message so UI components
   * can alert the engineer immediately.
   *
   * @param error Diagnostic error message string.
   */
  setSolverError(error: string): void {
    currentState = {
      ...currentState,
      isSolving: false,
      solverRevision: currentState.solverRevision + 1,
      solverError: error,
    };
    emitChange();
  },

  setIsSolving(isSolving: boolean): void {
    currentState = { ...currentState, isSolving };
    emitChange();
  },
};

/**
 * Direct non-reactive getter for the current simulator state snapshot.
 * Useful for non-React callers, exporters, and automated test suites.
 *
 * @returns Current immutable `BeamSimulatorState`.
 */
export function getBeamSimulatorSnapshot(): BeamSimulatorState {
  return currentState;
}

/**
 * React hook to subscribe to the Beam Simulator state.
 * @returns Current immutable BeamSimulatorState snapshot.
 * @example
 * const { materialKind, spanLengthM } = useBeamSimulatorStore();
 */
export function useBeamSimulatorStore(): BeamSimulatorState {
  return useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    () => currentState,
    () => INITIAL_STATE,
  );
}

useBeamSimulatorStore.getState = getBeamSimulatorSnapshot;
