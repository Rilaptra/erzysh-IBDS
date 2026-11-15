/**
 * @file AdaptiveApplicationShell.tsx
 * @description Master adaptive wrapper detecting user environment:
 * - Desktop Workstation: full 3D extruded WebGL canvas, 6 floating windows, 2D overlays
 * - Android Companion: lightweight single-column field calculator (bypasses heavy 3D canvas)
 */

"use client";

import { useSearchParams } from "next/navigation";
import React, { type ReactElement, Suspense, useEffect } from "react";

import { usePlatformCapabilities } from "@/hooks/use-platform-capabilities";
import { beamSimulatorActions } from "@/state/beam-simulator-store";
import { tutorialTourActions } from "@/state/tutorial-tour-store";

import { AndroidCompanionView } from "./AndroidCompanionView";
import { DesktopWorkstationView } from "./DesktopWorkstationView";

function isValidLoadingMode(
  value: string | null,
): value is "MODE_A_EXTERNAL_LOADS" | "MODE_B_DIRECT_INTERNAL_FORCES" {
  return value === "MODE_A_EXTERNAL_LOADS" || value === "MODE_B_DIRECT_INTERNAL_FORCES";
}

export function parseTutorialQueryParam(value: string | null): {
  readonly shouldForceStart: boolean;
  readonly stepIndex: number;
} {
  if (!value) {
    return { shouldForceStart: false, stepIndex: 0 };
  }
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "true") {
    return { shouldForceStart: true, stepIndex: 0 };
  }
  if (/^\d+$/.test(trimmed)) {
    const stepNumber = Number.parseInt(trimmed, 10);
    if (stepNumber >= 1) {
      return { shouldForceStart: true, stepIndex: stepNumber - 1 };
    }
  }
  return { shouldForceStart: false, stepIndex: 0 };
}

function SimulatorModeQuerySync(): null {
  const searchParams = useSearchParams();
  const modeParam = searchParams.get("mode");
  const tutorialParam = searchParams.get("tutorial");

  useEffect(() => {
    if (isValidLoadingMode(modeParam)) {
      beamSimulatorActions.setLoadingMode(modeParam);
    }
  }, [modeParam]);

  useEffect(() => {
    const { shouldForceStart, stepIndex } = parseTutorialQueryParam(tutorialParam);
    tutorialTourActions.initFirstVisitCheck(shouldForceStart, stepIndex);
  }, [tutorialParam]);

  return null;
}

export function AdaptiveApplicationShell(): ReactElement {
  const { isAndroid } = usePlatformCapabilities();

  return (
    <>
      <Suspense fallback={null}>
        <SimulatorModeQuerySync />
      </Suspense>
      {isAndroid ? <AndroidCompanionView /> : <DesktopWorkstationView />}
    </>
  );
}

export default AdaptiveApplicationShell;
