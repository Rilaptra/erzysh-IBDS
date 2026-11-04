/**
 * @file platform-capabilities.ts
 * @description Capability gating matrix and environment detector distinguishing
 * Desktop Workstation Mode (Full 3D, Hand Tracking, 6 Floating Windows) from
 * Android Field Companion Mode (Lightweight Mode B, SNI Optimizers, AI Chat).
 */

/**
 * Operating mode tier for the application shell.
 */
export type PlatformMode = "DESKTOP_WORKSTATION" | "ANDROID_COMPANION";

/**
 * Granular capability permissions granted to the active platform tier.
 */
export interface PlatformCapabilities {
  /** Mode identifier. */
  readonly mode: PlatformMode;
  /** Whether 3D WebGL extruded beam rendering is enabled. */
  readonly supports3dExtrudedViewport: boolean;
  /** Whether MediaPipe HandLandmarker camera tracking is loaded. */
  readonly supportsMediaPipeHandTracking: boolean;
  /** Whether multi-window draggable floating UI is enabled. */
  readonly supportsDraggableFloatingWindows: boolean;
  /** Whether 3-mode 2D internal force diagram overlays are fully enabled. */
  readonly supportsMultiModeDiagramOverlay: boolean;
  /** Whether Mode A (Interactive External Load modeling) is available. */
  readonly supportsExternalLoadsModeA: boolean;
  /** Whether Mode B (Direct Factored Internal Forces) is available. */
  readonly supportsDirectInternalForcesModeB: boolean;
  /** Whether SNI 2847:2019 reinforced concrete flexural & shear optimizer is active. */
  readonly supportsSniConcreteOptimization: boolean;
  /** Whether SNI 1729:2020 steel IWF & BOX optimizer is active. */
  readonly supportsSniSteelOptimization: boolean;
  /** Whether Web Speech API and AI Voice Assistant are active. */
  readonly supportsVoiceAssistant: boolean;
  /** Whether multi-software CAD/BIM/CAE export generation is available. */
  readonly supportsCadExporters: boolean;
  /** Whether Markdown calculation sheet generation is available. */
  readonly supportsCalculationSheetReport: boolean;
}

/**
 * Feature matrix definition for Desktop Workstation Mode.
 */
export const DESKTOP_WORKSTATION_CAPABILITIES: PlatformCapabilities = {
  mode: "DESKTOP_WORKSTATION",
  supports3dExtrudedViewport: true,
  supportsMediaPipeHandTracking: true,
  supportsDraggableFloatingWindows: true,
  supportsMultiModeDiagramOverlay: true,
  supportsExternalLoadsModeA: true,
  supportsDirectInternalForcesModeB: true,
  supportsSniConcreteOptimization: true,
  supportsSniSteelOptimization: true,
  supportsVoiceAssistant: true,
  supportsCadExporters: true,
  supportsCalculationSheetReport: true,
};

/**
 * Feature matrix definition for Android Companion Mode (Lightweight Field Calculator).
 * Omits heavy 3D canvas and webcam processing to preserve battery life and eliminate thermal throttling.
 */
export const ANDROID_COMPANION_CAPABILITIES: PlatformCapabilities = {
  mode: "ANDROID_COMPANION",
  supports3dExtrudedViewport: false,
  supportsMediaPipeHandTracking: false,
  supportsDraggableFloatingWindows: false,
  supportsMultiModeDiagramOverlay: false,
  supportsExternalLoadsModeA: false,
  supportsDirectInternalForcesModeB: true,
  supportsSniConcreteOptimization: true,
  supportsSniSteelOptimization: true,
  supportsVoiceAssistant: true,
  supportsCadExporters: false,
  supportsCalculationSheetReport: true,
};

/**
 * Detects the platform mode based on user agent string and screen width.
 * @param userAgent Optional user agent string (e.g. from request headers or navigator.userAgent).
 * @param screenWidth Optional screen width in pixels.
 * @returns Classified PlatformMode ("DESKTOP_WORKSTATION" or "ANDROID_COMPANION").
 * @example
 * const mode = detectPlatformMode("Mozilla/5.0 (Linux; Android 13; SM-A205F)", 412);
 * // returns "ANDROID_COMPANION"
 */
export function detectPlatformMode(userAgent?: string, screenWidth?: number): PlatformMode {
  const ua = (userAgent ?? "").toLowerCase();

  const isAndroid = ua.includes("android");
  const isMobileUa =
    isAndroid || ua.includes("iphone") || ua.includes("ipad") || ua.includes("mobile");

  // Screen threshold: devices <= 768px wide are gated to companion mode
  const isNarrowScreen = typeof screenWidth === "number" && screenWidth > 0 && screenWidth <= 768;

  if (isAndroid || (isMobileUa && isNarrowScreen)) {
    return "ANDROID_COMPANION";
  }

  return "DESKTOP_WORKSTATION";
}

/**
 * Retrieves the full capability matrix for a specified platform mode.
 * @param mode Platform mode identifier.
 * @returns Frozen PlatformCapabilities object.
 * @throws {Error} If an unsupported platform mode string is supplied.
 */
export function getPlatformCapabilities(mode: PlatformMode): PlatformCapabilities {
  switch (mode) {
    case "DESKTOP_WORKSTATION":
      return DESKTOP_WORKSTATION_CAPABILITIES;
    case "ANDROID_COMPANION":
      return ANDROID_COMPANION_CAPABILITIES;
    default: {
      const exhaustiveCheck: never = mode;
      throw new Error(
        `[PlatformCapabilities] Unrecognized platform mode: ${String(exhaustiveCheck)}`,
      );
    }
  }
}
