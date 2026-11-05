/**
 * @file use-platform-capabilities.ts
 * @description React hook that determines current platform tier (Desktop Workstation vs Android Companion)
 * based on user agent heuristics, viewport width, and touch support.
 * Gating prevents loading heavy 3D canvas and camera features on lightweight companion devices.
 */

"use client";

import { useEffect, useState } from "react";

import {
  detectPlatformMode,
  getPlatformCapabilities,
  type PlatformCapabilities,
  type PlatformMode,
} from "@/config/platform-capabilities";

/**
 * Return type of `usePlatformCapabilities`.
 */
export interface UsePlatformCapabilitiesResult {
  /** Active platform tier mode. */
  readonly mode: PlatformMode;
  /** Granular capabilities granted to this mode. */
  readonly capabilities: PlatformCapabilities;
  /** Convenience flag: true when Desktop Workstation is active. */
  readonly isDesktop: boolean;
  /** Convenience flag: true when Android Companion is active. */
  readonly isAndroid: boolean;
  /** Manually override platform mode (useful for testing and responsive previews). */
  readonly setOverrideMode: (mode: PlatformMode | null) => void;
}

/**
 * Hook detecting platform capabilities with responsive window resize tracking.
 * @returns {@link UsePlatformCapabilitiesResult}
 * @example
 * const { isDesktop, capabilities } = usePlatformCapabilities();
 */
export function usePlatformCapabilities(): UsePlatformCapabilitiesResult {
  const [overrideMode, setOverrideMode] = useState<PlatformMode | null>(null);
  const [detectedMode, setDetectedMode] = useState<PlatformMode>("DESKTOP_WORKSTATION");

  useEffect(() => {
    function evaluate(): void {
      const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
      const width = typeof window !== "undefined" ? window.innerWidth : 1200;
      setDetectedMode(detectPlatformMode(ua, width));
    }

    evaluate();

    window.addEventListener("resize", evaluate);
    return () => window.removeEventListener("resize", evaluate);
  }, []);

  const activeMode: PlatformMode = overrideMode ?? detectedMode;
  const capabilities = getPlatformCapabilities(activeMode);

  return {
    mode: activeMode,
    capabilities,
    isDesktop: activeMode === "DESKTOP_WORKSTATION",
    isAndroid: activeMode === "ANDROID_COMPANION",
    setOverrideMode,
  };
}
