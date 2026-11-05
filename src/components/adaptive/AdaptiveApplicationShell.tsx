/**
 * @file AdaptiveApplicationShell.tsx
 * @description Master adaptive wrapper detecting user environment:
 * - Desktop Workstation: full 3D extruded WebGL canvas, 6 floating windows, 2D overlays
 * - Android Companion: lightweight single-column field calculator (bypasses heavy 3D canvas)
 */

"use client";

import React, { type ReactElement } from "react";

import { usePlatformCapabilities } from "@/hooks/use-platform-capabilities";

import { AndroidCompanionView } from "./AndroidCompanionView";
import { DesktopWorkstationView } from "./DesktopWorkstationView";

export function AdaptiveApplicationShell(): ReactElement {
  const { isAndroid } = usePlatformCapabilities();

  if (isAndroid) {
    return <AndroidCompanionView />;
  }

  return <DesktopWorkstationView />;
}

export default AdaptiveApplicationShell;
