/**
 * @file HandTrackingCameraPreview.tsx
 * @description Compact webcam feed preview component for hand tracking.
 * Features:
 * - 240x180 (4:3) mirrored video frame with absolute overlay 21-landmark skeleton canvas.
 * - Live real-time FPS badge (<45°C thermal indication).
 * - Gesture status chip displaying active symbol and name.
 * - Direct toggle controls for camera stream activation and Thermal Eco-Mode (16 FPS).
 * - Refactored with shadcn/ui primitives while preserving hardware lifecycle state machine.
 */

"use client";

import { AlertCircle, Camera, ChevronDown, ChevronUp } from "lucide-react";
import React, { type CSSProperties, type ReactElement, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { GESTURE_ACCENT_COLORS } from "@/hooks/use-mediapipe-hand-tracking";
import { cn } from "@/lib/utils";
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
  /** Optional custom style overrides. */
  readonly style?: CSSProperties;
}

/**
 * Interactive camera preview HUD component refactored with shadcn/ui.
 *
 * @param props {@link HandTrackingCameraPreviewProps}
 * @returns ReactElement rendering the compact webcam feed and tracking telemetry.
 */
export function HandTrackingCameraPreview({
  state,
  onToggleRunning,
  onToggleEcoMode,
  videoRef,
  canvasRef,
  lastError,
  className,
  style,
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
    <Card
      className={cn(
        "flex w-[264px] flex-col gap-2.5 rounded-xl border-slate-700/60 bg-slate-900/85 p-3 text-slate-200 shadow-xl backdrop-blur-md",
        className,
      )}
      style={style}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-slate-700/60 pb-1.5 text-xs font-bold">
        <div className="flex items-center gap-1.5">
          <Camera className="size-4 text-cyan-400" />
          <span>Webcam Hand Tracking</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => setIsMinimized((prev) => !prev)}
          title={isMinimized ? "Perbesar Preview" : "Perkecil Preview"}
          className="text-slate-400 hover:bg-slate-800 hover:text-slate-200"
        >
          {isMinimized ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          <span className="sr-only">{isMinimized ? "Perbesar Preview" : "Perkecil Preview"}</span>
        </Button>
      </div>

      {/* Collapsible Video & Canvas Viewport - Persistent DOM elements to preserve ref integrity */}
      <div
        style={{
          display: isMinimized ? "none" : "block",
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
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-4 text-center text-xs text-slate-500">
            <span className="text-2xl opacity-60">🖐️</span>
            <span className="font-medium text-slate-400">Kamera Dinonaktifkan</span>
            <span className="text-[9px] text-slate-500">
              Aktifkan untuk navigasi kursor tanpa mouse
            </span>
          </div>
        )}

        {/* Telemetry Overlay Badges on Top of Camera */}
        {isRunning && (
          <>
            {/* FPS & Thermal Mode Badge */}
            <div className="absolute top-1.5 left-1.5">
              <Badge
                variant="outline"
                className={cn(
                  "bg-slate-950/80 px-1.5 py-0.5 font-mono text-[10px] font-semibold backdrop-blur-sm",
                  isEcoMode
                    ? "border-cyan-400/30 text-cyan-400"
                    : "border-amber-400/30 text-amber-400",
                )}
              >
                {fps} FPS {isEcoMode ? "❄️ ECO" : "⚡ MAX"}
              </Badge>
            </div>

            {/* Handedness Badge */}
            {handedness !== "None" && (
              <div className="absolute top-1.5 right-1.5">
                <Badge
                  variant="outline"
                  className="border-slate-700/60 bg-slate-950/80 px-1.5 py-0.5 text-[9px] font-medium text-slate-400 backdrop-blur-sm"
                >
                  {handedness === "Left" ? "Kiri" : "Kanan"}
                </Badge>
              </div>
            )}
          </>
        )}
      </div>

      {/* Active Gesture Status Pill */}
      <div
        className="flex items-center gap-2 rounded-md border bg-slate-800/50 px-2.5 py-1.5"
        style={{
          borderColor: isRunning ? `${gestureColor}40` : "rgba(148, 163, 184, 0.1)",
        }}
      >
        <span
          className="min-w-[18px] text-center text-base font-extrabold"
          style={{ color: isRunning ? gestureColor : "#64748B" }}
        >
          {isRunning ? gestureSymbol : "○"}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span
            className="truncate text-[11px] font-semibold"
            style={{ color: isRunning ? gestureColor : "#94A3B8" }}
          >
            {isRunning ? gestureLabel : "Siap Dinyalakan"}
          </span>
          <span className="text-[9px] text-slate-500">
            {isRunning ? "Zero-Pinch Dip Active" : "Knuckle Anchored"}
          </span>
        </div>
      </div>

      {/* Error Message Alert */}
      {lastError && (
        <Alert variant="destructive" className="px-2 py-1 text-[10px]">
          <AlertCircle className="size-3" data-icon="inline-start" />
          <AlertDescription>⚠️ {lastError}</AlertDescription>
        </Alert>
      )}

      {/* Control Buttons */}
      <div className="flex gap-1.5">
        <Button
          type="button"
          onClick={handleToggle}
          disabled={isLoading}
          size="sm"
          className={cn(
            "h-7 flex-1 text-xs font-bold",
            isRunning
              ? "border-none bg-red-600 text-white hover:bg-red-700"
              : "border-none bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-600 hover:to-blue-700",
          )}
        >
          {isLoading ? (
            <>
              <Spinner className="size-3" data-icon="inline-start" />
              Memproses...
            </>
          ) : isRunning ? (
            "Matikan Kamera"
          ) : (
            "Nyalakan Kamera"
          )}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onToggleEcoMode}
          title={
            isEcoMode
              ? "Eco Mode Aktif: Dibatasi ~16 FPS agar suhu < 45°C. Klik untuk 30+ FPS."
              : "Max FPS Aktif. Klik untuk menyalakan Thermal Eco Mode."
          }
          className={cn(
            "h-7 px-2.5 text-xs font-semibold",
            isEcoMode
              ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 hover:text-cyan-200"
              : "border-slate-700/60 bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-slate-100",
          )}
        >
          {isEcoMode ? "❄️ 16 FPS" : "⚡ Max"}
        </Button>
      </div>
    </Card>
  );
}

export default HandTrackingCameraPreview;
