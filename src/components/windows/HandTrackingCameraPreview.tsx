/**
 * @file HandTrackingCameraPreview.tsx
 * @description Compact webcam feed preview component for hand tracking.
 * Features:
 * - 240x180 (4:3) mirrored video frame with absolute overlay 21-landmark skeleton canvas.
 * - Live real-time FPS badge (<45°C thermal indication).
 * - Gesture status chip displaying active symbol and name.
 * - Direct toggle controls for camera stream activation and Thermal Eco-Mode (16 FPS).
 */

"use client";

import React, { type ReactElement, useState } from "react";

import { GESTURE_ACCENT_COLORS } from "@/hooks/use-mediapipe-hand-tracking";
import {
  GESTURE_LABELS,
  GESTURE_SYMBOLS,
  type HandTrackingState,
} from "@/types/hand-gesture-cursor-types";

/**
 * Props for `HandTrackingCameraPreview`.
 */
export interface HandTrackingCameraPreviewProps {
  /** Real-time hand tracking pipeline state. */
  readonly state: HandTrackingState;
  /** Callback to start or stop webcam capture. */
  readonly onToggleRunning: () => Promise<void> | void;
  /** Callback to toggle thermal eco-mode throttling. */
  readonly onToggleEcoMode: () => void;
  /** Video element ref from useMediapipeHandTracking. */
  readonly videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Canvas element ref for drawing skeletal bones and landmarks. */
  readonly canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** Optional error message to display if camera access fails. */
  readonly lastError?: string | null;
  /** Optional custom CSS class. */
  readonly className?: string;
}

/**
 * Interactive camera preview HUD component.
 *
 * @param props {@link HandTrackingCameraPreviewProps}
 * @returns ReactElement rendering the compact webcam feed and tracking telemetry.
 * @example
 * <HandTrackingCameraPreview
 *   state={tracking.state}
 *   onToggleRunning={tracking.toggleRunning}
 *   onToggleEcoMode={tracking.toggleEcoMode}
 *   videoRef={tracking.videoRef}
 *   canvasRef={tracking.canvasRef}
 * />
 */
export function HandTrackingCameraPreview({
  state,
  onToggleRunning,
  onToggleEcoMode,
  videoRef,
  canvasRef,
  lastError,
  className,
}: HandTrackingCameraPreviewProps): ReactElement {
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const { isRunning, isEcoMode, fps, activeGesture, handedness } = state;
  const gestureColor = GESTURE_ACCENT_COLORS[activeGesture] || "#64748B";
  const gestureSymbol = GESTURE_SYMBOLS[activeGesture] || "—";
  const gestureLabel = GESTURE_LABELS[activeGesture] || "Menunggu Deteksi...";

  const handleToggle = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await onToggleRunning();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={className}
      style={{
        background: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(148, 163, 184, 0.16)",
        borderRadius: 10,
        padding: 12,
        color: "#E2E8F0",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        width: 264,
      }}
    >
      {/* Header Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 12,
          fontWeight: 700,
          borderBottom: "1px solid rgba(148, 163, 184, 0.1)",
          paddingBottom: 6,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 14 }}>📷</span>
          <span>Webcam Hand Tracking</span>
        </div>
        <button
          type="button"
          onClick={() => setIsMinimized((prev) => !prev)}
          title={isMinimized ? "Perbesar Preview" : "Perkecil Preview"}
          style={{
            background: "transparent",
            border: "none",
            color: "#94A3B8",
            cursor: "pointer",
            fontSize: 12,
            padding: "2px 6px",
            borderRadius: 4,
          }}
        >
          {isMinimized ? "▲" : "▼"}
        </button>
      </div>

      {/* Collapsible Video & Canvas Viewport */}
      {!isMinimized && (
        <div
          style={{
            position: "relative",
            width: 240,
            height: 180,
            borderRadius: 8,
            overflow: "hidden",
            background: "#050811",
            border: "1px solid rgba(51, 65, 85, 0.6)",
            alignSelf: "center",
          }}
        >
          {/* Mirrored Hidden/Visible Video element */}
          <video
            ref={videoRef}
            playsInline
            muted
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: "scaleX(-1)", // Mirror horizontal for natural human intuition
              opacity: isRunning ? 0.35 : 0,
              transition: "opacity 300ms ease",
            }}
          />

          {/* 21-Landmark Bones Canvas Overlay */}
          <canvas
            ref={canvasRef}
            width={240}
            height={180}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
            }}
          />

          {/* Off-State Placeholder Overlay */}
          {!isRunning && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
                textAlign: "center",
                color: "#64748B",
                fontSize: 11,
                gap: 6,
              }}
            >
              <span style={{ fontSize: 24, opacity: 0.6 }}>🖐️</span>
              <span>Kamera Dinonaktifkan</span>
              <span style={{ fontSize: 9, color: "#475569" }}>
                Aktifkan untuk navigasi kursor tanpa mouse
              </span>
            </div>
          )}

          {/* Telemetry Overlay Badges on Top of Camera */}
          {isRunning && (
            <>
              {/* FPS & Thermal Mode Badge */}
              <div
                style={{
                  position: "absolute",
                  top: 6,
                  left: 6,
                  background: "rgba(10, 15, 20, 0.8)",
                  backdropFilter: "blur(4px)",
                  padding: "2px 6px",
                  borderRadius: 4,
                  fontSize: 10,
                  fontFamily: "monospace",
                  fontWeight: 600,
                  color: isEcoMode ? "#38BDF8" : "#F59E0B",
                  border: `1px solid ${isEcoMode ? "rgba(56, 189, 248, 0.3)" : "rgba(245, 158, 11, 0.3)"}`,
                }}
              >
                {fps} FPS {isEcoMode ? "❄️ ECO" : "⚡ MAX"}
              </div>

              {/* Handedness Badge */}
              {handedness !== "None" && (
                <div
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                    background: "rgba(10, 15, 20, 0.8)",
                    backdropFilter: "blur(4px)",
                    padding: "2px 6px",
                    borderRadius: 4,
                    fontSize: 9,
                    fontWeight: 600,
                    color: "#94A3B8",
                  }}
                >
                  {handedness === "Left" ? "Kiri" : "Kanan"}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Active Gesture Status Pill */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "rgba(30, 41, 59, 0.5)",
          padding: "6px 10px",
          borderRadius: 6,
          border: `1px solid ${isRunning ? gestureColor + "40" : "rgba(148, 163, 184, 0.1)"}`,
        }}
      >
        <span
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: isRunning ? gestureColor : "#64748B",
            minWidth: 18,
            textAlign: "center",
          }}
        >
          {isRunning ? gestureSymbol : "○"}
        </span>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: isRunning ? gestureColor : "#94A3B8",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {isRunning ? gestureLabel : "Siap Dinyalakan"}
          </span>
          <span style={{ fontSize: 9, color: "#64748B" }}>
            {isRunning ? "Zero-Pinch Dip Active" : "Knuckle Anchored"}
          </span>
        </div>
      </div>

      {/* Error Message Alert */}
      {lastError && (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.15)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: 6,
            padding: "4px 8px",
            fontSize: 10,
            color: "#FCA5A5",
          }}
        >
          ⚠️ {lastError}
        </div>
      )}

      {/* Control Buttons */}
      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          onClick={handleToggle}
          disabled={isLoading}
          style={{
            flex: 1,
            padding: "6px 10px",
            borderRadius: 6,
            border: "none",
            fontSize: 11,
            fontWeight: 700,
            cursor: isLoading ? "wait" : "pointer",
            background: isRunning
              ? "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)"
              : "linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%)",
            color: "#FFFFFF",
            transition: "opacity 150ms ease",
            opacity: isLoading ? 0.7 : 1,
          }}
        >
          {isLoading ? "Memproses..." : isRunning ? "Matikan Kamera" : "Nyalakan Kamera"}
        </button>

        <button
          type="button"
          onClick={onToggleEcoMode}
          title={
            isEcoMode
              ? "Eco Mode Aktif: Dibatasi ~16 FPS agar suhu < 45°C. Klik untuk 30+ FPS."
              : "Max FPS Aktif. Klik untuk menyalakan Thermal Eco Mode."
          }
          style={{
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid rgba(148, 163, 184, 0.2)",
            background: isEcoMode ? "rgba(6, 182, 212, 0.15)" : "rgba(30, 41, 59, 0.6)",
            color: isEcoMode ? "#38BDF8" : "#94A3B8",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {isEcoMode ? "❄️ 16 FPS" : "⚡ Max"}
        </button>
      </div>
    </div>
  );
}

export default HandTrackingCameraPreview;
