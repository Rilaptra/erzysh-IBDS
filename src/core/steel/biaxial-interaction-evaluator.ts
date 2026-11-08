/**
 * @file biaxial-interaction-evaluator.ts
 * @description Combined axial force and biaxial flexure interaction evaluator
 * for structural steel members according to SNI 1729:2020 Chapter H (Pasal H1.1 & H1.2).
 * Implements AISC Equations (H1-1a) and (H1-1b) with rigorous resistance factors.
 */

import { kilonewton, kilonewtonMeter, utilizationRatio } from "@/types/branded-units";
import type { Kilonewton, KilonewtonMeter, UtilizationRatio } from "@/types/branded-units";
import { SteelDesignError } from "@/types/steel-sni1729-types";
import type { BiaxialInteractionResult } from "@/types/steel-sni1729-types";

/** Resistance factor for compression/tension phi_c / phi_t per SNI 1729:2020 Chapter E & D. */
export const PHI_AXIAL = 0.9 as const;

/** Resistance factor for flexure phi_b per SNI 1729:2020 Chapter F. */
export const PHI_FLEXURE = 0.9 as const;

/**
 * Parameters supplied to the Chapter H1 biaxial interaction evaluation.
 */
export interface BiaxialInteractionInput {
  /** Profile identifier for error diagnostics. */
  readonly profileName: string;
  /** Applied factored axial force Pu in kN (positive = tension, negative = compression). */
  readonly factoredAxialPu: Kilonewton | number;
  /** Applied factored strong-axis bending moment Mux in kNm. */
  readonly factoredMomentMux: KilonewtonMeter | number;
  /** Applied factored weak-axis bending moment Muy in kNm. */
  readonly factoredMomentMuy: KilonewtonMeter | number;
  /** Design axial capacity phi_c * Pn (or phi_t * Pn) in kN. */
  readonly designAxialPhiPn: Kilonewton | number;
  /** Design strong-axis flexural capacity phi_b * Mnx in kNm. */
  readonly designFlexuralPhiMnx: KilonewtonMeter | number;
  /** Design weak-axis flexural capacity phi_b * Mny in kNm. */
  readonly designFlexuralPhiMny: KilonewtonMeter | number;
}

/**
 * Evaluates the combined axial force and biaxial bending interaction ratio (DCR)
 * according to SNI 1729:2020 Chapter H1.
 *
 * Let r = |Pu| / (phi_c * Pn):
 * - If r >= 0.20 (Eq. H1-1a):
 *   DCR = r + (8 / 9) * [ |Mux| / (phi_b * Mnx) + |Muy| / (phi_b * Mny) ]
 * - If r < 0.20 (Eq. H1-1b):
 *   DCR = r / 2 + [ |Mux| / (phi_b * Mnx) + |Muy| / (phi_b * Mny) ]
 *
 * @param input Factored loads (Pu, Mux, Muy) and design capacities (phiPn, phiMnx, phiMny).
 * @returns Complete BiaxialInteractionResult with interactionValue and safety status.
 * @throws {SteelDesignError} If capacities are <= 0 or loads are non-finite.
 * @example
 * const res = evaluateBiaxialInteraction({
 *   profileName: "WF 300 x 150 x 36.7",
 *   factoredAxialPu: kilonewton(-50),
 *   factoredMomentMux: kilonewtonMeter(80),
 *   factoredMomentMuy: kilonewtonMeter(10),
 *   designAxialPhiPn: kilonewton(850),
 *   designFlexuralPhiMnx: kilonewtonMeter(120),
 *   designFlexuralPhiMny: kilonewtonMeter(25),
 * });
 * console.log(res.interactionValue, res.isSafe);
 */
export function evaluateBiaxialInteraction(
  input: BiaxialInteractionInput,
): BiaxialInteractionResult {
  const {
    profileName,
    factoredAxialPu,
    factoredMomentMux,
    factoredMomentMuy,
    designAxialPhiPn,
    designFlexuralPhiMnx,
    designFlexuralPhiMny,
  } = input;

  const pu = Number(factoredAxialPu);
  const mux = Math.abs(Number(factoredMomentMux));
  const muy = Math.abs(Number(factoredMomentMuy));
  const phiPn = Number(designAxialPhiPn);
  const phiMnx = Number(designFlexuralPhiMnx);
  const phiMny = Number(designFlexuralPhiMny);

  if (!Number.isFinite(pu)) {
    throw new SteelDesignError(
      profileName,
      "evaluateBiaxialInteraction",
      `Factored axial force Pu must be a finite number. Received: ${pu} kN.`,
    );
  }
  if (!Number.isFinite(mux) || !Number.isFinite(muy)) {
    throw new SteelDesignError(
      profileName,
      "evaluateBiaxialInteraction",
      `Factored moments Mux and Muy must be finite numbers. Received: Mux=${mux}, Muy=${muy} kNm.`,
    );
  }
  if (!Number.isFinite(phiPn) || phiPn <= 0) {
    throw new SteelDesignError(
      profileName,
      "evaluateBiaxialInteraction",
      `Design axial capacity phi*Pn must be strictly positive. Received: ${phiPn} kN.`,
    );
  }
  if (!Number.isFinite(phiMnx) || phiMnx <= 0) {
    throw new SteelDesignError(
      profileName,
      "evaluateBiaxialInteraction",
      `Design flexural capacity phi*Mnx must be strictly positive. Received: ${phiMnx} kNm.`,
    );
  }
  if (!Number.isFinite(phiMny) || phiMny <= 0) {
    throw new SteelDesignError(
      profileName,
      "evaluateBiaxialInteraction",
      `Design flexural capacity phi*Mny must be strictly positive. Received: ${phiMny} kNm.`,
    );
  }

  const axialRatio = Math.abs(pu) / phiPn;
  const momentRatioX = mux / phiMnx;
  const momentRatioY = muy / phiMny;
  const flexuralSum = momentRatioX + momentRatioY;

  let interactionValue: number;
  if (axialRatio >= 0.2) {
    // Eq. (H1-1a)
    interactionValue = axialRatio + (8.0 / 9.0) * flexuralSum;
  } else {
    // Eq. (H1-1b)
    interactionValue = axialRatio / 2.0 + flexuralSum;
  }

  const roundedDcr = Number(interactionValue.toFixed(4));
  const isSafe = roundedDcr <= 1.0;

  return {
    Pu: kilonewton(pu),
    phiPn: kilonewton(Number(phiPn.toFixed(1))),
    axialRatio: Number(axialRatio.toFixed(4)),
    Mux: kilonewtonMeter(Number(mux.toFixed(2))),
    phiMnx: kilonewtonMeter(Number(phiMnx.toFixed(2))),
    Muy: kilonewtonMeter(Number(muy.toFixed(2))),
    phiMny: kilonewtonMeter(Number(phiMny.toFixed(2))),
    interactionValue: utilizationRatio(roundedDcr),
    isSafe,
  };
}
