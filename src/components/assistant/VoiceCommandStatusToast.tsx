/**
 * @file VoiceCommandStatusToast.tsx
 * @description Floating toast notification UI anchored at the bottom of the viewport.
 * Features:
 * - Live microphone status pill with pulsating red/cyan audio listening wave.
 * - Real-time display of recognized speech transcript and instant execution feedback.
 * - Elegant glassmorphic dark CAD surface matching the Erzysh Dark Void theme.
 * - Quick mic mute/unmute action button and dismiss control.
 */

"use client";

import React, { type ReactElement, useState } from "react";

import type { CommandExecutionResult } from "@/types/command-registry-types";

/**
 * Props for `VoiceCommandStatusToast`.
 */
export interface VoiceCommandStatusToastProps {
  /** Whether the microphone recognition engine is actively listening. */
  readonly isListening: boolean;
  /** Whether the microphone is muted by user choice. */
  readonly isMuted?: boolean;
  /** Whether the browser supports the Web Speech API. */
  readonly isSupported: boolean;
  /** Most recent speech transcription recognized from the user. */
  readonly transcript: string;
  /** Human-readable status or execution feedback message. */
  readonly feedbackMessage: string;
  /** Last executed command result payload. */
  readonly lastExecution?: CommandExecutionResult | null;
  /** Optional error message. */
  readonly error?: string | null;
  /** Callback to toggle microphone listening state. */
  readonly onToggleListening: () => void;
  /** Optional callback to trigger an audio chime test. */
  readonly onTestAudio?: () => void;
  /** Optional custom CSS class name. */
  readonly className?: string;
}

/**
 * Floating voice command status HUD toast.
 *
 * @param props {@link VoiceCommandStatusToastProps}
 * @returns ReactElement
 * @example
 * <VoiceCommandStatusToast
 *   isListening={voice.isListening}
 *   isMuted={voice.isMuted}
 *   isSupported={voice.isSupported}
 *   transcript={voice.transcript}
 *   feedbackMessage={voice.feedbackMessage}
 *   lastExecution={voice.lastExecution}
 *   onToggleListening={voice.toggleListening}
 *   onTestAudio={voice.testAudioTone}
 * />
 */
export function VoiceCommandStatusToast({
  isListening,
  isMuted,
  isSupported,
  transcript,
  feedbackMessage,
  lastExecution,
  error,
  onToggleListening,
  onTestAudio,
  className,
}: VoiceCommandStatusToastProps): ReactElement | null {
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  // If not supported or dismissed when idle, render minimal trigger or null
  if (!isSupported) {
    return null;
  }

  // Derive mute status with fallback to !isListening
  const isMutedState = isMuted !== undefined ? isMuted : !isListening;

  // Auto restore visibility if new speech or active listening occurs
  const isVisible = !isDismissed || !isMutedState || isListening || Boolean(transcript);

  if (!isVisible) {
    return null;
  }

  const isSuccess = lastExecution ? lastExecution.success : true;
  const accentColor = error
    ? "#EF4444"
    : isMutedState
      ? "#64748B"
      : isListening
        ? "#38BDF8"
        : isSuccess
          ? "#10B981"
          : "#F59E0B";

  return (
    <div
      className={className}
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9998,
        maxWidth: "90vw",
        width: 520,
        background: "rgba(15, 23, 42, 0.88)",
        backdropFilter: "blur(16px)",
        border: `1px solid ${accentColor}40`,
        borderRadius: 12,
        padding: "10px 14px",
        boxShadow: `0 12px 32px rgba(0, 0, 0, 0.45), 0 0 16px ${accentColor}25`,
        color: "#F8FAFC",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        transition: "all 200ms ease",
      }}
      role="status"
      aria-live="polite"
    >
      <style>{`
        @keyframes micPulseGlow {
          0% {
            box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.6);
            transform: scale(0.98);
          }
          70% {
            box-shadow: 0 0 0 8px rgba(56, 189, 248, 0);
            transform: scale(1.05);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(56, 189, 248, 0);
            transform: scale(0.98);
          }
        }
      `}</style>

      {/* Mic Status & Icon Toggle */}
      <button
        type="button"
        onClick={onToggleListening}
        title={
          isMutedState
            ? "Klik untuk mulai mendengarkan (Unmute)"
            : "Klik untuk menjeda mikrofon (Mute)"
        }
        style={{
          width: 38,
          height: 38,
          borderRadius: "50%",
          border: `1.5px solid ${accentColor}`,
          background: !isMutedState
            ? "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)"
            : "rgba(30, 41, 59, 0.8)",
          color: "#FFFFFF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          fontSize: 16,
          flexShrink: 0,
          animation: !isMutedState && isListening ? "micPulseGlow 1.4s infinite" : "none",
          transition: "transform 150ms ease",
        }}
      >
        {!isMutedState ? "🎙️" : "🎤"}
      </button>

      {/* Transcript & Execution Message Content */}
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1, gap: 2 }}>
        {/* Status Title & Transcript */}
        <div
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700 }}
        >
          <span
            style={{
              color: accentColor,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            {isMutedState ? "Mikrofon Dijeda" : isListening ? "Mendengarkan..." : "Voice Command"}
          </span>
          {transcript && (
            <span
              style={{
                color: "#94A3B8",
                fontWeight: 500,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              "{transcript}"
            </span>
          )}
        </div>

        {/* Execution Feedback Action Text */}
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.35,
            color: error ? "#FCA5A5" : "#E2E8F0",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {error ? `⚠️ ${error}` : feedbackMessage}
        </div>
      </div>

      {/* Action & Dismiss Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {onTestAudio && (
          <button
            type="button"
            onClick={onTestAudio}
            title="Klik untuk menguji bunyi audio speaker"
            style={{
              padding: "4px 8px",
              borderRadius: 6,
              border: "1px solid rgba(16, 185, 129, 0.3)",
              background: "rgba(16, 185, 129, 0.15)",
              color: "#34D399",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            🔊 Uji Audio
          </button>
        )}

        <button
          type="button"
          onClick={onToggleListening}
          title={isMutedState ? "Aktifkan Mikrofon (Listen)" : "Bisukan Mikrofon (Mute)"}
          style={{
            padding: "4px 8px",
            borderRadius: 6,
            border: "1px solid rgba(148, 163, 184, 0.2)",
            background: isMutedState ? "rgba(6, 182, 212, 0.15)" : "rgba(239, 68, 68, 0.2)",
            color: isMutedState ? "#38BDF8" : "#FCA5A5",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {isMutedState ? "Listen" : "Mute"}
        </button>

        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          title="Tutup Toast"
          style={{
            background: "transparent",
            border: "none",
            color: "#64748B",
            cursor: "pointer",
            fontSize: 14,
            padding: "2px 4px",
            lineHeight: 1,
            borderRadius: 4,
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default VoiceCommandStatusToast;
