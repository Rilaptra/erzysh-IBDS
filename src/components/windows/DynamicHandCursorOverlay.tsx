/**
 * @file DynamicHandCursorOverlay.tsx
 * @description Fixed full-screen overlay rendering the knuckle-anchored virtual hand cursor.
 * Features:
 * - High z-index (9999) with pointer-events-none to prevent blocking DOM event bubbling.
 * - Glowing radial halo (Teal/Amber/Emerald/Purple/Yellow) tied to active gesture state.
 * - Dynamic gesture icon (◎, ⌖, ▼, ▸, ▣) rendered inside the central cursor ring.
 * - Expanding ripple wave animation when PINCH_CLICK is executed.
 * - Micro tooltip badge displaying human-readable gesture action label.
 */

"use client";

import React, { type ReactElement } from "react";

import { GESTURE_ACCENT_COLORS } from "@/hooks/use-mediapipe-hand-tracking";
import { GESTURE_LABELS, type HandTrackingState } from "@/types/hand-gesture-cursor-types";

/**
 * Props for `DynamicHandCursorOverlay`.
 */
export interface DynamicHandCursorOverlayProps {
  /** Live state of the MediaPipe hand tracking pipeline. */
  readonly state: HandTrackingState;
  /** Optional custom CSS class name. */
  readonly className?: string;
}

/**
 * Full-screen cursor overlay component.
 *
 * @param props {@link DynamicHandCursorOverlayProps}
 * @returns ReactElement or null when tracking is inactive or hand is absent.
 * @example
 * const { state } = useMediapipeHandTracking();
 * return <DynamicHandCursorOverlay state={state} />;
 */
export function DynamicHandCursorOverlay({
  state,
  className,
}: DynamicHandCursorOverlayProps): ReactElement | null {
  const { isRunning, activeGesture, cursorSymbol, screenCoordinates, isPinching } = state;

  // Hide overlay if tracking is turned off or no hand is currently in frame
  if (!isRunning || activeGesture === "NONE") {
    return null;
  }

  const { x, y } = screenCoordinates;
  const accentColor = GESTURE_ACCENT_COLORS[activeGesture] || "#06B6D4";
  const label = GESTURE_LABELS[activeGesture] || "";
  const cursorRadius = 24; // 48px diameter

  return (
    <div
      className={className}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 9999,
        overflow: "hidden",
      }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes pinchRipplePulse {
          0% {
            transform: scale(0.8);
            opacity: 0.9;
          }
          100% {
            transform: scale(2.4);
            opacity: 0;
          }
        }
        @keyframes cursorHaloBreath {
          0%, 100% {
            box-shadow: 0 0 14px 2px var(--halo-color, rgba(6, 182, 212, 0.45));
          }
          50% {
            box-shadow: 0 0 24px 6px var(--halo-color, rgba(6, 182, 212, 0.75));
          }
        }
      `}</style>

      {/* Primary Knuckle-Anchored Virtual Cursor Element */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: cursorRadius * 2,
          height: cursorRadius * 2,
          transform: `translate3d(${x - cursorRadius}px, ${y - cursorRadius}px, 0)`,
          transition: "transform 40ms cubic-bezier(0.1, 0.9, 0.2, 1.0)",
          willChange: "transform",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Pinch Click Expanding Ripple Effect */}
        {(isPinching || activeGesture === "PINCH_CLICK") && (
          <div
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              border: `2px solid ${accentColor}`,
              animation: "pinchRipplePulse 0.5s ease-out infinite",
              pointerEvents: "none",
            }}
          />
        )}

        {/* Central Glowing Reticle Ring */}
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            border: `2.5px solid ${accentColor}`,
            background: "rgba(10, 15, 20, 0.75)",
            backdropFilter: "blur(6px)",
            boxShadow: `0 0 16px ${accentColor}80, inset 0 0 8px ${accentColor}30`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: accentColor,
            fontSize: 20,
            fontWeight: 800,
            userSelect: "none",
            transform: isPinching ? "scale(0.88)" : "scale(1.0)",
            transition: "transform 100ms ease, border-color 200ms ease",
          }}
        >
          {cursorSymbol}
        </div>

        {/* Minimal Tooltip Action Tag Floating Under Cursor */}
        <div
          style={{
            position: "absolute",
            top: cursorRadius * 2 + 6,
            left: "50%",
            transform: "translateX(-50%)",
            whiteSpace: "nowrap",
            padding: "2px 8px",
            borderRadius: 4,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.02em",
            color: "#F8FAFC",
            background: isPinching ? "rgba(16, 185, 129, 0.95)" : "rgba(15, 23, 42, 0.88)",
            border: `1px solid ${isPinching ? "#10B981" : `${accentColor}60`}`,
            boxShadow: isPinching
              ? "0 0 12px rgba(16, 185, 129, 0.6)"
              : "0 4px 12px rgba(0, 0, 0, 0.4)",
            pointerEvents: "none",
            transition: "all 150ms ease",
          }}
        >
          {isPinching ? "KLIK! ⌖" : label}
        </div>
      </div>
    </div>
  );
}

export default DynamicHandCursorOverlay;
