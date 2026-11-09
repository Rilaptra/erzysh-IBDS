/**
 * @file hand-gesture-cursor-types.ts
 * @description Type definitions for Google MediaPipe Hand Landmarker (21 landmarks),
 * knuckle-anchored virtual cursor mapping, and the 5 discrete gesture cursor modes.
 */

// ============================================================================
// MediaPipe 21 Hand Landmarks Index Definitions
// ============================================================================

/**
 * 21 Landmark indices defined by Google MediaPipe HandLandmarker.
 */
export const HAND_LANDMARK_INDICES = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_FINGER_MCP: 5,
  INDEX_FINGER_PIP: 6,
  INDEX_FINGER_DIP: 7,
  INDEX_FINGER_TIP: 8,
  MIDDLE_FINGER_MCP: 9,
  MIDDLE_FINGER_PIP: 10,
  MIDDLE_FINGER_DIP: 11,
  MIDDLE_FINGER_TIP: 12,
  RING_FINGER_MCP: 13,
  RING_FINGER_PIP: 14,
  RING_FINGER_DIP: 15,
  RING_FINGER_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
} as const;

export type HandLandmarkIndex = (typeof HAND_LANDMARK_INDICES)[keyof typeof HAND_LANDMARK_INDICES];

/**
 * Normalized 3D landmark coordinate from MediaPipe (coordinates between 0.0 and 1.0).
 */
export interface NormalizedLandmark {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly visibility?: number;
}

// ============================================================================
// 5 Discrete Hand Gesture States & Virtual Cursor Symbols
// ============================================================================

/**
 * 5 Discrete gestural interaction types supported by the simulator.
 */
export type HandGestureType =
  | "OPEN_PALM" // Free pointer & 3D camera orbit (Symbol: ◎)
  | "PINCH_CLICK" // Locked click without dip (Symbol: ⌖)
  | "FIST_LOAD" // Adjust load position and magnitude (Symbol: ▼)
  | "POINT_PRECISION" // Snap to nearest beam curve node (Symbol: ▸)
  | "TWO_FINGER_GRAB" // Translate draggable floating window (Symbol: ▣)
  | "NONE"; // Hand not detected or confidence below threshold

/**
 * Visual cursor symbol mapping for the active gesture.
 */
export const GESTURE_SYMBOLS: Record<HandGestureType, string> = {
  OPEN_PALM: "◎",
  PINCH_CLICK: "⌖",
  FIST_LOAD: "▼",
  POINT_PRECISION: "▸",
  TWO_FINGER_GRAB: "▣",
  NONE: "",
};

/**
 * Human-readable labels describing gesture functions.
 */
export const GESTURE_LABELS: Record<HandGestureType, string> = {
  OPEN_PALM: "Pointer (Navigasi Bebas)",
  PINCH_CLICK: "Pinch (Klik Tombol UI)",
  FIST_LOAD: "Fist (Atur Beban Balok)",
  POINT_PRECISION: "Point (Inspeksi Titik Eksak)",
  TWO_FINGER_GRAB: "Two-Finger (Geser Jendela Melayang)",
  NONE: "Tidak Ada Tangan Terdeteksi",
};

// ============================================================================
// Runtime Hand Tracking State
// ============================================================================

/**
 * Real-time state of the hand tracking pipeline.
 */
export interface HandTrackingState {
  /** Whether the webcam stream and MediaPipe pipeline are actively running. */
  readonly isRunning: boolean;
  /** Handedness detected by the model. */
  readonly handedness: "Left" | "Right" | "None";
  /** Currently classified gesture. */
  readonly activeGesture: HandGestureType;
  /** Active visual cursor symbol (e.g. ◎, ⌖, ▼, ▸, ▣). */
  readonly cursorSymbol: string;
  /** Screen pixel coordinates (x, y) calibrated to viewport. */
  readonly screenCoordinates: { readonly x: number; readonly y: number };
  /** Normalized viewport coordinates in range [0, 1]. */
  readonly normalizedCoordinates: { readonly x: number; readonly y: number };
  /** Whether the index-thumb pinch threshold is currently triggered. */
  readonly isPinching: boolean;
  /** Normalized 3D Euclidean distance between thumb tip and index tip. */
  readonly pinchDistance: number;
  /** Current camera inference frame rate (throttled to 16 FPS in eco-mode). */
  readonly fps: number;
  /** Whether thermal eco-mode (< 45°C) is active. */
  readonly isEcoMode: boolean;
}

// ============================================================================
// Knuckle-Anchored Algorithm Tuning Parameters
// ============================================================================

/**
 * Tuning parameters for the knuckle-anchored virtual cursor algorithm
 * to prevent cursor drop during pinch clicks (zero pinch-dip).
 */
export interface KnuckleAnchorConfig {
  /** Distance threshold to enter pre-pinch freeze zone (default: 0.068). */
  readonly prePinchFreezeThreshold: number;
  /** Distance threshold to register discrete click (default: 0.052). */
  readonly clickPinchThreshold: number;
  /** Distance threshold to release click (default: 0.068). */
  readonly clickReleaseThreshold: number;
  /** Weight of Index MCP (landmark 5) vs Middle MCP (landmark 9) for anchor point (default: 0.5). */
  readonly anchorBlendWeight: number;
  /** Exponential moving average smoothing factor alpha (0.0 to 1.0, default: 0.35). */
  readonly smoothingAlpha: number;
}

/** Default configuration values for knuckle-anchored cursor tracking. */
export const DEFAULT_KNUCKLE_ANCHOR_CONFIG: KnuckleAnchorConfig = {
  prePinchFreezeThreshold: 0.068,
  clickPinchThreshold: 0.052,
  clickReleaseThreshold: 0.068,
  anchorBlendWeight: 0.5,
  smoothingAlpha: 0.35,
};

// ============================================================================
// Custom Error Hierarchy
// ============================================================================

/**
 * Custom error thrown when hand tracking initialization or landmark processing fails.
 */
export class HandTrackingError extends Error {
  public readonly context: string;

  constructor(context: string, message: string) {
    super(`[HandTrackingError] Context '${context}': ${message}`);
    this.name = "HandTrackingError";
    this.context = context;
  }
}
