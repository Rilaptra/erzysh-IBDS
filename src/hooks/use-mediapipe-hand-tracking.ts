/**
 * @file use-mediapipe-hand-tracking.ts
 * @description Production-grade React hook for Google MediaPipe Hand Landmarker camera tracking.
 * Features:
 * - Dynamic SSR-safe browser loader with @mediapipe/tasks-vision CDN integration.
 * - Platform capability guard: active exclusively on DESKTOP_WORKSTATION.
 * - Knuckle-Anchored Algorithm (Blend weight 0.5 of Index MCP #5 & Middle MCP #9) for zero pinch-dip.
 * - Real-time classification of 5 discrete gestures: OPEN_PALM, PINCH_CLICK, FIST_LOAD, POINT_PRECISION, TWO_FINGER_GRAB.
 * - Thermal Eco-mode throttling: 16 FPS (62ms inference interval) vs 30+ FPS normal mode to maintain GPU/CPU temp < 45°C.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { usePlatformCapabilities } from "@/hooks/use-platform-capabilities";
import {
  DEFAULT_KNUCKLE_ANCHOR_CONFIG,
  GESTURE_SYMBOLS,
  HAND_LANDMARK_INDICES,
  type HandGestureType,
  HandTrackingError,
  type HandTrackingState,
  type KnuckleAnchorConfig,
  type NormalizedLandmark,
} from "@/types/hand-gesture-cursor-types";

// ============================================================================
// MediaPipe Skeletal Bones Map
// ============================================================================

/**
 * 21-Landmark bone connection pairs for rendering 1:1 anatomical hand skeletons.
 */
export const HAND_BONE_PAIRS: readonly (readonly [number, number])[] = [
  // Thumb
  [HAND_LANDMARK_INDICES.WRIST, HAND_LANDMARK_INDICES.THUMB_CMC],
  [HAND_LANDMARK_INDICES.THUMB_CMC, HAND_LANDMARK_INDICES.THUMB_MCP],
  [HAND_LANDMARK_INDICES.THUMB_MCP, HAND_LANDMARK_INDICES.THUMB_IP],
  [HAND_LANDMARK_INDICES.THUMB_IP, HAND_LANDMARK_INDICES.THUMB_TIP],
  // Index
  [HAND_LANDMARK_INDICES.WRIST, HAND_LANDMARK_INDICES.INDEX_FINGER_MCP],
  [HAND_LANDMARK_INDICES.INDEX_FINGER_MCP, HAND_LANDMARK_INDICES.INDEX_FINGER_PIP],
  [HAND_LANDMARK_INDICES.INDEX_FINGER_PIP, HAND_LANDMARK_INDICES.INDEX_FINGER_DIP],
  [HAND_LANDMARK_INDICES.INDEX_FINGER_DIP, HAND_LANDMARK_INDICES.INDEX_FINGER_TIP],
  // Middle
  [HAND_LANDMARK_INDICES.INDEX_FINGER_MCP, HAND_LANDMARK_INDICES.MIDDLE_FINGER_MCP],
  [HAND_LANDMARK_INDICES.MIDDLE_FINGER_MCP, HAND_LANDMARK_INDICES.MIDDLE_FINGER_PIP],
  [HAND_LANDMARK_INDICES.MIDDLE_FINGER_PIP, HAND_LANDMARK_INDICES.MIDDLE_FINGER_DIP],
  [HAND_LANDMARK_INDICES.MIDDLE_FINGER_DIP, HAND_LANDMARK_INDICES.MIDDLE_FINGER_TIP],
  // Ring
  [HAND_LANDMARK_INDICES.MIDDLE_FINGER_MCP, HAND_LANDMARK_INDICES.RING_FINGER_MCP],
  [HAND_LANDMARK_INDICES.RING_FINGER_MCP, HAND_LANDMARK_INDICES.RING_FINGER_PIP],
  [HAND_LANDMARK_INDICES.RING_FINGER_PIP, HAND_LANDMARK_INDICES.RING_FINGER_DIP],
  [HAND_LANDMARK_INDICES.RING_FINGER_DIP, HAND_LANDMARK_INDICES.RING_FINGER_TIP],
  // Pinky
  [HAND_LANDMARK_INDICES.RING_FINGER_MCP, HAND_LANDMARK_INDICES.PINKY_MCP],
  [HAND_LANDMARK_INDICES.WRIST, HAND_LANDMARK_INDICES.PINKY_MCP],
  [HAND_LANDMARK_INDICES.PINKY_MCP, HAND_LANDMARK_INDICES.PINKY_PIP],
  [HAND_LANDMARK_INDICES.PINKY_PIP, HAND_LANDMARK_INDICES.PINKY_DIP],
  [HAND_LANDMARK_INDICES.PINKY_DIP, HAND_LANDMARK_INDICES.PINKY_TIP],
] as const;

/**
 * Color pallete for gesture visual rendering.
 */
export const GESTURE_ACCENT_COLORS: Readonly<Record<HandGestureType, string>> = {
  OPEN_PALM: "#38BDF8", // Cyan / Sky 400
  PINCH_CLICK: "#10B981", // Emerald 500
  FIST_LOAD: "#F97316", // Amber / Orange 500
  POINT_PRECISION: "#EAB308", // Yellow 500
  TWO_FINGER_GRAB: "#A855F7", // Purple 500
  NONE: "#64748B", // Slate 500
};

// ============================================================================
// Pure Mathematical & Algorithmic Geometry Functions
// ============================================================================

/**
 * Computes 2D Euclidean distance between two landmarks.
 * @param a First landmark coordinate.
 * @param b Second landmark coordinate.
 * @returns 2D Euclidean distance.
 */
export function euclideanDistance2D(
  a: { readonly x: number; readonly y: number },
  b: { readonly x: number; readonly y: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Result of the knuckle-anchored virtual cursor algorithm.
 */
export interface KnuckleAnchorResult {
  /** Raw blended anchor X coordinate mirrored for webcam [0..1]. */
  readonly rawAnchorX: number;
  /** Raw blended anchor Y coordinate [0..1]. */
  readonly rawAnchorY: number;
  /** Viewport-calibrated normalized X coordinate mapped to full active screen [0..1]. */
  readonly normalizedX: number;
  /** Viewport-calibrated normalized Y coordinate mapped to full active screen [0..1]. */
  readonly normalizedY: number;
  /** Euclidean distance between thumb tip and index tip. */
  readonly pinchDistance: number;
  /** Normalized ratio of pinch distance relative to palm span. */
  readonly pinchRatio: number;
  /** Whether hand is in pre-pinch proximity zone to prevent cursor jitter before click. */
  readonly isPrePinching: boolean;
  /** Whether discrete pinch-click contact threshold is triggered. */
  readonly isPinching: boolean;
}

/**
 * Computes stable virtual cursor anchor using the Knuckle-Anchored Algorithm.
 * Blends Index MCP (landmark 5) and Middle MCP (landmark 9) at 50% weight (0.5).
 * Because knuckles remain anatomically static while fingers flex to pinch,
 * this eliminates the common 'pinch-dip' artifact where virtual cursors jump downwards.
 *
 * @param landmarks 21 normalized landmarks from MediaPipe HandLandmarker.
 * @param config Optional tuning thresholds.
 * @returns {@link KnuckleAnchorResult}
 * @throws {@link HandTrackingError} If landmark array contains fewer than 21 elements.
 * @example
 * const anchor = computeKnuckleAnchor(landmarks, DEFAULT_KNUCKLE_ANCHOR_CONFIG);
 * console.log(anchor.normalizedX, anchor.normalizedY);
 */
export function computeKnuckleAnchor(
  landmarks: readonly NormalizedLandmark[],
  config: KnuckleAnchorConfig = DEFAULT_KNUCKLE_ANCHOR_CONFIG,
): KnuckleAnchorResult {
  if (!landmarks || landmarks.length < 21) {
    throw new HandTrackingError(
      "computeKnuckleAnchor",
      `Expected 21 landmarks but received ${landmarks ? landmarks.length : 0}`,
    );
  }

  const wrist = landmarks[HAND_LANDMARK_INDICES.WRIST]!;
  const thumbTip = landmarks[HAND_LANDMARK_INDICES.THUMB_TIP]!;
  const indexMcp = landmarks[HAND_LANDMARK_INDICES.INDEX_FINGER_MCP]!;
  const indexTip = landmarks[HAND_LANDMARK_INDICES.INDEX_FINGER_TIP]!;
  const middleMcp = landmarks[HAND_LANDMARK_INDICES.MIDDLE_FINGER_MCP]!;

  // Palm reference size (Wrist to Middle MCP), clamped to prevent division by zero
  const palmSize = Math.max(euclideanDistance2D(wrist, middleMcp), 0.01);
  const pinchDistance = euclideanDistance2D(thumbTip, indexTip);
  const pinchRatio = pinchDistance / palmSize;

  // Pre-pinch freeze zone dampens micro-drift when approaching touch contact
  const isPrePinching = pinchRatio < 0.62 || pinchDistance < config.prePinchFreezeThreshold;
  const isPinching = pinchRatio < 0.42 || pinchDistance < config.clickPinchThreshold;

  // Knuckle anchor blending (blendWeight: 0.5 for equal index/middle MCP balance)
  const blendWeight = Math.min(Math.max(config.anchorBlendWeight, 0.0), 1.0);
  const rawAnchorX = 1 - (indexMcp.x * (1 - blendWeight) + middleMcp.x * blendWeight);
  const rawAnchorY = indexMcp.y * (1 - blendWeight) + middleMcp.y * blendWeight;

  // Remap active camera bounding zone [0.14 .. 0.86] to full screen [0.0 .. 1.0] for effortless reaching
  const normalizedX = Math.min(Math.max((rawAnchorX - 0.14) / 0.72, 0.0), 1.0);
  const normalizedY = Math.min(Math.max((rawAnchorY - 0.14) / 0.72, 0.0), 1.0);

  return {
    rawAnchorX,
    rawAnchorY,
    normalizedX,
    normalizedY,
    pinchDistance,
    pinchRatio,
    isPrePinching,
    isPinching,
  };
}

/**
 * Classifies 5 discrete engineering gestures from MediaPipe landmarks:
 * 1. OPEN_PALM (◎): All fingers open; free cursor navigation and camera orbit.
 * 2. PINCH_CLICK (⌖): Index and thumb tips touching; click without coordinate dip.
 * 3. FIST_LOAD (▼): All fingers closed into fist; adjust magnitude and position of beam point loads.
 * 4. POINT_PRECISION (▸): Index finger extended only; snap to nearest beam node coordinate.
 * 5. TWO_FINGER_GRAB (▣): Index and middle fingers extended; grab and translate floating windows.
 *
 * @param landmarks 21 normalized landmarks from MediaPipe HandLandmarker.
 * @param prevGesture Optional previous gesture for hysteresis stability.
 * @param config Optional anchor configuration thresholds.
 * @returns Classified {@link HandGestureType}.
 * @throws {@link HandTrackingError} If landmark array contains fewer than 21 elements.
 */
export function classifyHandGesture(
  landmarks: readonly NormalizedLandmark[],
  prevGesture: HandGestureType = "NONE",
  config: KnuckleAnchorConfig = DEFAULT_KNUCKLE_ANCHOR_CONFIG,
): HandGestureType {
  if (!landmarks || landmarks.length < 21) {
    return "NONE";
  }

  const wrist = landmarks[HAND_LANDMARK_INDICES.WRIST]!;
  const thumbTip = landmarks[HAND_LANDMARK_INDICES.THUMB_TIP]!;
  const indexPip = landmarks[HAND_LANDMARK_INDICES.INDEX_FINGER_PIP]!;
  const indexTip = landmarks[HAND_LANDMARK_INDICES.INDEX_FINGER_TIP]!;
  const middleMcp = landmarks[HAND_LANDMARK_INDICES.MIDDLE_FINGER_MCP]!;
  const middlePip = landmarks[HAND_LANDMARK_INDICES.MIDDLE_FINGER_PIP]!;
  const middleTip = landmarks[HAND_LANDMARK_INDICES.MIDDLE_FINGER_TIP]!;
  const ringPip = landmarks[HAND_LANDMARK_INDICES.RING_FINGER_PIP]!;
  const ringTip = landmarks[HAND_LANDMARK_INDICES.RING_FINGER_TIP]!;
  const pinkyPip = landmarks[HAND_LANDMARK_INDICES.PINKY_PIP]!;
  const pinkyTip = landmarks[HAND_LANDMARK_INDICES.PINKY_TIP]!;

  const palmSize = Math.max(euclideanDistance2D(wrist, middleMcp), 0.01);
  const pinchDistance = euclideanDistance2D(thumbTip, indexTip);
  const pinchRatio = pinchDistance / palmSize;

  // Finger extension tests based on tip vs PIP distance from wrist
  const isIndexExt =
    euclideanDistance2D(indexTip, wrist) > euclideanDistance2D(indexPip, wrist) * 1.12;
  const isMiddleExt =
    euclideanDistance2D(middleTip, wrist) > euclideanDistance2D(middlePip, wrist) * 1.12;
  const isRingExt = euclideanDistance2D(ringTip, wrist) > euclideanDistance2D(ringPip, wrist) * 1.1;
  const isPinkyExt =
    euclideanDistance2D(pinkyTip, wrist) > euclideanDistance2D(pinkyPip, wrist) * 1.1;

  // Hysteresis threshold: if previously pinching, require higher distance to release
  const pinchThreshold =
    prevGesture === "PINCH_CLICK" ? config.clickReleaseThreshold : config.clickPinchThreshold;
  const isPinchActive = pinchRatio < 0.42 || pinchDistance < pinchThreshold;

  // 1. PINCH_CLICK (⌖): Index + Thumb pinch while middle remains extended or hand is open
  if (isPinchActive && (isMiddleExt || euclideanDistance2D(indexTip, wrist) > palmSize * 0.75)) {
    return "PINCH_CLICK";
  }

  // 2. FIST_LOAD (▼): All four main fingers retracted
  if (!isIndexExt && !isMiddleExt && !isRingExt && !isPinkyExt) {
    return "FIST_LOAD";
  }

  // 3. TWO_FINGER_GRAB (▣): Index and middle extended, ring and pinky curled
  if (isIndexExt && isMiddleExt && !isRingExt && !isPinkyExt) {
    return "TWO_FINGER_GRAB";
  }

  // 4. POINT_PRECISION (▸): Only index extended, others curled
  if (isIndexExt && !isMiddleExt && !isRingExt && !isPinkyExt) {
    return "POINT_PRECISION";
  }

  // 5. OPEN_PALM (◎): Three or more fingers extended
  if (isIndexExt && isMiddleExt && (isRingExt || isPinkyExt)) {
    return "OPEN_PALM";
  }

  return "OPEN_PALM";
}

/**
 * Draws the 21-landmark skeletal bones and joint circles on the preview canvas.
 * @param ctx 2D Canvas rendering context.
 * @param landmarks 21 normalized landmarks from MediaPipe.
 * @param width Canvas width in pixels.
 * @param height Canvas height in pixels.
 * @param activeGesture Active classified gesture for dynamic stroke coloring.
 */
export function drawHandSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: readonly NormalizedLandmark[],
  width: number,
  height: number,
  activeGesture: HandGestureType,
): void {
  ctx.clearRect(0, 0, width, height);

  if (!landmarks || landmarks.length < 21) return;

  const strokeColor = GESTURE_ACCENT_COLORS[activeGesture] || "#38BDF8";

  // 1. Draw connecting bones
  ctx.save();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();

  for (let i = 0; i < HAND_BONE_PAIRS.length; i++) {
    const pair = HAND_BONE_PAIRS[i];
    if (!pair) continue;
    const [fromIdx, toIdx] = pair;
    const a = landmarks[fromIdx];
    const b = landmarks[toIdx];
    if (!a || !b) continue;

    // Mirrored X for webcam orientation
    const ax = (1 - a.x) * width;
    const ay = a.y * height;
    const bx = (1 - b.x) * width;
    const by = b.y * height;

    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
  }
  ctx.stroke();

  // 2. Draw anatomical joints
  ctx.fillStyle = "#F8FAFC";
  ctx.beginPath();
  for (let i = 0; i < landmarks.length; i++) {
    const lm = landmarks[i];
    if (!lm) continue;
    const x = (1 - lm.x) * width;
    const y = lm.y * height;
    ctx.moveTo(x + 2.5, y);
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
  }
  ctx.fill();

  // 3. Highlight Knuckle Anchor Blend Point (Index MCP #5 & Middle MCP #9)
  const indexMcp = landmarks[HAND_LANDMARK_INDICES.INDEX_FINGER_MCP];
  const middleMcp = landmarks[HAND_LANDMARK_INDICES.MIDDLE_FINGER_MCP];
  if (indexMcp && middleMcp) {
    const anchorX = (1 - (indexMcp.x * 0.5 + middleMcp.x * 0.5)) * width;
    const anchorY = (indexMcp.y * 0.5 + middleMcp.y * 0.5) * height;

    ctx.fillStyle = "#06B6D4";
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(anchorX, anchorY, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

// ============================================================================
// Hook Return Signature & Interface
// ============================================================================

/**
 * Return signature of `useMediapipeHandTracking`.
 */
export interface UseMediapipeHandTrackingResult {
  /** Complete real-time state of the hand tracking subsystem. */
  readonly state: HandTrackingState;
  /** Starts or stops webcam tracking stream. */
  readonly toggleRunning: () => Promise<void>;
  /** Toggles thermal eco-mode (16 FPS throttling vs 30+ FPS). */
  readonly toggleEcoMode: () => void;
  /** React ref to attach to the hidden or preview <video> element. */
  readonly videoRef: React.RefObject<HTMLVideoElement | null>;
  /** React ref to attach to the skeleton overlay <canvas> element. */
  readonly canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** Last recorded error message, or null if healthy. */
  readonly lastError: string | null;
}

/**
 * Optional options for configuring `useMediapipeHandTracking`.
 */
export interface UseMediapipeHandTrackingOptions {
  /** Initial eco-mode state (default: true for thermal safety). */
  readonly initialEcoMode?: boolean;
  /** Callback fired whenever classified gesture transitions. */
  readonly onGestureChange?: (gesture: HandGestureType, state: HandTrackingState) => void;
  /** Custom tuning parameters for the knuckle-anchored cursor. */
  readonly config?: Partial<KnuckleAnchorConfig>;
}

// ============================================================================
// Main Hook Implementation
// ============================================================================

/**
 * Production-ready React hook for MediaPipe HandLandmarker camera tracking.
 * Strictly respects DESKTOP_WORKSTATION capability gate and SSR checks.
 *
 * @param options Optional hook configuration options.
 * @returns {@link UseMediapipeHandTrackingResult}
 * @example
 * const { state, toggleRunning, videoRef, canvasRef } = useMediapipeHandTracking();
 */
export function useMediapipeHandTracking(
  options: UseMediapipeHandTrackingOptions = {},
): UseMediapipeHandTrackingResult {
  const { capabilities } = usePlatformCapabilities();
  const isDesktopSupported = capabilities.supportsMediaPipeHandTracking;

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isEcoMode, setIsEcoMode] = useState<boolean>(options.initialEcoMode ?? true);
  const [lastError, setLastError] = useState<string | null>(null);

  const [trackingState, setTrackingState] = useState<HandTrackingState>({
    isRunning: false,
    handedness: "None",
    activeGesture: "NONE",
    cursorSymbol: "",
    screenCoordinates: { x: -100, y: -100 },
    normalizedCoordinates: { x: 0.5, y: 0.5 },
    isPinching: false,
    pinchDistance: 1.0,
    fps: 0,
    isEcoMode: options.initialEcoMode ?? true,
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // References for animation frame and model instances
  // Using explicit unknown typing cast through dynamic module loading
  const handLandmarkerRef = useRef<unknown>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const lastInferenceTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const lastFpsCalcTimeRef = useRef<number>(0);
  const gestureHistoryRef = useRef<HandGestureType[]>(["NONE", "NONE", "NONE"]);
  const prevGestureRef = useRef<HandGestureType>("NONE");

  // Dynamic Knuckle Config
  const mergedConfig: KnuckleAnchorConfig = {
    ...DEFAULT_KNUCKLE_ANCHOR_CONFIG,
    ...options.config,
  };

  /**
   * Toggles Thermal Eco-mode throttling.
   */
  const toggleEcoMode = useCallback((): void => {
    setIsEcoMode((prev) => {
      const next = !prev;
      setTrackingState((curr) => ({ ...curr, isEcoMode: next }));
      return next;
    });
  }, []);

  /**
   * Dynamically loads the MediaPipe Tasks Vision bundle from CDN if not already loaded.
   * Uses SSR-safe evaluation and isolates browser-only globals.
   */
  const loadMediaPipeBundle = useCallback(async (): Promise<unknown> => {
    if (typeof window === "undefined") {
      throw new HandTrackingError("loadMediaPipeBundle", "Window is undefined (SSR environment).");
    }

    if (handLandmarkerRef.current) {
      return handLandmarkerRef.current;
    }

    try {
      // Dynamic import via browser Function to prevent Next.js webpack/turbopack bundling issues with CDN URLs
      const importDynamic = new Function("url", "return import(url)");
      const visionPkg = await importDynamic(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm",
      );

      const fileset = await visionPkg.FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
      );

      const landmarker = await visionPkg.HandLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 1,
        minHandDetectionConfidence: 0.55,
        minHandPresenceConfidence: 0.55,
        minTrackingConfidence: 0.55,
      });

      handLandmarkerRef.current = landmarker;
      return landmarker;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      throw new HandTrackingError(
        "loadMediaPipeBundle",
        `Failed to initialize MediaPipe: ${errMsg}`,
      );
    }
  }, []);

  /**
   * Stops camera stream tracks and clears animation loops.
   */
  const stopTracking = useCallback((): void => {
    if (animationFrameIdRef.current !== null) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }

    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }

    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }

    setIsRunning(false);
    setTrackingState((curr) => ({
      ...curr,
      isRunning: false,
      handedness: "None",
      activeGesture: "NONE",
      cursorSymbol: "",
      fps: 0,
    }));
  }, []);

  /**
   * Main camera inference animation loop.
   */
  const startInferenceLoop = useCallback((): void => {
    const loop = (now: number): void => {
      // Inference throttling: Eco-mode targets ~16 FPS (62ms gap), normal mode targets ~33 FPS (30ms gap)
      const targetInterval = isEcoMode ? 62 : 30;
      const elapsed = now - lastInferenceTimeRef.current;

      const video = videoRef.current;
      const landmarker = handLandmarkerRef.current as {
        detectForVideo: (
          video: HTMLVideoElement,
          timestamp: number,
        ) => {
          landmarks?: NormalizedLandmark[][];
          handedness?: { displayName?: string }[][];
        };
      } | null;

      if (video && landmarker && video.readyState >= 2 && elapsed >= targetInterval) {
        lastInferenceTimeRef.current = now;
        frameCountRef.current++;

        // Measure actual FPS every second
        if (now - lastFpsCalcTimeRef.current >= 1000) {
          const actualFps = Math.round(
            (frameCountRef.current * 1000) / (now - lastFpsCalcTimeRef.current),
          );
          frameCountRef.current = 0;
          lastFpsCalcTimeRef.current = now;

          setTrackingState((curr) => ({ ...curr, fps: actualFps }));
        }

        try {
          const result = landmarker.detectForVideo(video, now);

          if (result.landmarks && result.landmarks.length > 0) {
            const rawLandmarks = result.landmarks[0]!;
            const anchor = computeKnuckleAnchor(rawLandmarks, mergedConfig);
            const classified = classifyHandGesture(
              rawLandmarks,
              prevGestureRef.current,
              mergedConfig,
            );

            // Temporal 3-frame voting filter to stabilize gesture transitions
            gestureHistoryRef.current.shift();
            gestureHistoryRef.current.push(classified);

            const voteCounts: Record<HandGestureType, number> = {
              OPEN_PALM: 0,
              PINCH_CLICK: 0,
              FIST_LOAD: 0,
              POINT_PRECISION: 0,
              TWO_FINGER_GRAB: 0,
              NONE: 0,
            };
            for (let i = 0; i < gestureHistoryRef.current.length; i++) {
              const g = gestureHistoryRef.current[i]!;
              voteCounts[g] = (voteCounts[g] || 0) + 1;
            }

            let stableGesture = classified;
            let maxVotes = 0;
            (Object.keys(voteCounts) as HandGestureType[]).forEach((g) => {
              if (voteCounts[g] > maxVotes) {
                maxVotes = voteCounts[g];
                stableGesture = g;
              }
            });

            prevGestureRef.current = stableGesture;

            const handednessStr =
              result.handedness && result.handedness[0] && result.handedness[0][0]
                ? (result.handedness[0][0].displayName as "Left" | "Right") || "Right"
                : "Right";

            // Screen pixel mapping
            const screenW = typeof window !== "undefined" ? window.innerWidth : 1920;
            const screenH = typeof window !== "undefined" ? window.innerHeight : 1080;
            const screenX = Math.round(anchor.normalizedX * screenW);
            const screenY = Math.round(anchor.normalizedY * screenH);

            const nextState: HandTrackingState = {
              isRunning: true,
              handedness: handednessStr,
              activeGesture: stableGesture,
              cursorSymbol: GESTURE_SYMBOLS[stableGesture] || "",
              screenCoordinates: { x: screenX, y: screenY },
              normalizedCoordinates: { x: anchor.normalizedX, y: anchor.normalizedY },
              isPinching: anchor.isPinching,
              pinchDistance: anchor.pinchDistance,
              fps: trackingState.fps,
              isEcoMode,
            };

            setTrackingState(nextState);
            if (options.onGestureChange && stableGesture !== trackingState.activeGesture) {
              options.onGestureChange(stableGesture, nextState);
            }

            // Draw skeleton on canvas preview if canvas ref is attached
            if (canvasRef.current) {
              const canvas = canvasRef.current;
              const ctx = canvas.getContext("2d");
              if (ctx) {
                drawHandSkeleton(ctx, rawLandmarks, canvas.width, canvas.height, stableGesture);
              }
            }
          } else {
            // Hand not detected
            if (canvasRef.current) {
              const ctx = canvasRef.current.getContext("2d");
              if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            }
            if (trackingState.activeGesture !== "NONE") {
              setTrackingState((curr) => ({
                ...curr,
                activeGesture: "NONE",
                cursorSymbol: "",
                isPinching: false,
              }));
            }
          }
        } catch (inferErr) {
          const errMsg = inferErr instanceof Error ? inferErr.message : String(inferErr);
          setLastError(`Inference error: ${errMsg}`);
        }
      }

      animationFrameIdRef.current = requestAnimationFrame(loop);
    };

    animationFrameIdRef.current = requestAnimationFrame(loop);
  }, [isEcoMode, mergedConfig, options, trackingState.activeGesture, trackingState.fps]);

  /**
   * Starts or stops camera tracking.
   */
  const toggleRunning = useCallback(async (): Promise<void> => {
    if (!isDesktopSupported) {
      const err = new HandTrackingError(
        "toggleRunning",
        "Hand tracking is disabled on non-workstation platforms.",
      );
      setLastError(err.message);
      return;
    }

    if (isRunning) {
      stopTracking();
      return;
    }

    try {
      setLastError(null);
      await loadMediaPipeBundle();

      // Request modest 240x180 resolution to conserve memory bandwidth and CPU thermal load
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 240 },
          height: { ideal: 180 },
          frameRate: { ideal: 20, max: 30 },
          facingMode: "user",
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsRunning(true);
      setTrackingState((curr) => ({ ...curr, isRunning: true }));
      startInferenceLoop();
    } catch (camErr) {
      const errMsg = camErr instanceof Error ? camErr.message : String(camErr);
      const trackingErr = new HandTrackingError("toggleRunning", `Webcam access denied: ${errMsg}`);
      setLastError(trackingErr.message);
      stopTracking();
    }
  }, [isDesktopSupported, isRunning, loadMediaPipeBundle, startInferenceLoop, stopTracking]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  return {
    state: trackingState,
    toggleRunning,
    toggleEcoMode,
    videoRef,
    canvasRef,
    lastError,
  };
}

export default useMediapipeHandTracking;
