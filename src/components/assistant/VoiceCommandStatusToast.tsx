/**
 * @file VoiceCommandStatusToast.tsx
 * @description Floating toast notification UI anchored at the bottom of the viewport.
 * Features:
 * - Live microphone status pill with pulsating red/cyan audio listening wave.
 * - Real-time display of recognized speech transcript and instant execution feedback.
 * - Built with shadcn/ui primitives and Erzysh Dark Void theme.
 * - Quick mic mute/unmute action button, audio test chime trigger, and dismiss control.
 */

"use client";

import { X } from "lucide-react";
import React, { type CSSProperties, type ReactElement, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  /** Optional command suggestions when transcript is unrecognized. */
  readonly suggestions?: readonly string[];
  /** Optional callback when user clicks a suggested command chip. */
  readonly onSelectSuggestion?: (suggestion: string) => void;
  /** Optional custom CSS class name. */
  readonly className?: string;
  /** Optional custom style overrides. */
  readonly style?: CSSProperties;
}

/**
 * Floating voice command status HUD toast refactored with shadcn primitives.
 *
 * @param props {@link VoiceCommandStatusToastProps}
 * @returns ReactElement | null
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
  suggestions,
  onSelectSuggestion,
  className,
  style,
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
      className={cn(
        "fixed bottom-6 left-1/2 z-[9998] flex w-[540px] max-w-[92vw] -translate-x-1/2 flex-col rounded-xl border bg-slate-900/95 p-3 text-slate-100 shadow-2xl backdrop-blur-xl transition-all duration-200",
        className,
      )}
      style={{
        borderColor: `${accentColor}40`,
        boxShadow: `0 12px 32px rgba(0, 0, 0, 0.45), 0 0 16px ${accentColor}25`,
        ...style,
      }}
      role="status"
      aria-live="polite"
    >
      <div className="flex w-full items-center justify-between gap-3">
        {/* Mic Status & Icon Toggle */}
        <button
          type="button"
          onClick={onToggleListening}
          title={
            isMutedState
              ? "Klik untuk mulai mendengarkan (Unmute)"
              : "Klik untuk menjeda mikrofon (Mute)"
          }
          className={cn(
            "flex size-[38px] shrink-0 cursor-pointer items-center justify-center rounded-full text-base transition-transform duration-150 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none",
          )}
          style={{
            border: `1.5px solid ${accentColor}`,
            background: !isMutedState
              ? "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)"
              : "rgba(30, 41, 59, 0.8)",
            color: "#FFFFFF",
            animation: !isMutedState && isListening ? "micPulseGlow 1.4s infinite" : "none",
          }}
        >
          {!isMutedState ? "🎙️" : "🎤"}
        </button>

        {/* Transcript & Execution Message Content */}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          {/* Status Title & Transcript */}
          <div className="flex items-center gap-1.5 text-[11px] font-bold">
            <span className="tracking-wider uppercase" style={{ color: accentColor }}>
              {isMutedState ? "Mikrofon Dijeda" : isListening ? "Mendengarkan..." : "Voice Command"}
            </span>
            {transcript && (
              <span className="truncate font-medium text-slate-400">"{transcript}"</span>
            )}
          </div>

          {/* Execution Feedback Action Text */}
          <div
            className={cn(
              "truncate text-xs leading-tight",
              error ? "text-red-300" : "text-slate-200",
            )}
          >
            {error ? `⚠️ ${error}` : feedbackMessage}
          </div>
        </div>

        {/* Action & Dismiss Controls */}
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={onToggleListening}
            title={isMutedState ? "Aktifkan Mikrofon (Listen)" : "Bisukan Mikrofon (Mute)"}
            className={cn(
              "font-semibold",
              isMutedState
                ? "border-cyan-500/30 bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 hover:text-cyan-200"
                : "border-red-500/30 bg-red-500/20 text-red-200 hover:bg-red-500/30 hover:text-red-100",
            )}
          >
            {isMutedState ? "Listen" : "Mute"}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => setIsDismissed(true)}
            title="Tutup Toast"
            className="text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            <X className="size-3.5" />
            <span className="sr-only">Tutup</span>
          </Button>
        </div>
      </div>

      {/* Suggested Commands Reference */}
      {suggestions && suggestions.length > 0 && (
        <div className="mt-2.5 flex w-full flex-col gap-1.5 border-t border-slate-700/60 pt-2">
          <span className="text-[11px] font-semibold text-amber-300">
            💡 Mungkin yang Anda maksud:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onSelectSuggestion?.(suggestion)}
                className="cursor-pointer rounded-md border border-cyan-500/30 bg-cyan-950/50 px-2 py-0.5 text-[11px] font-medium text-cyan-200 transition-colors hover:border-cyan-400 hover:bg-cyan-900/70 hover:text-white"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default VoiceCommandStatusToast;
