/**
 * @file use-web-speech-command.ts
 * @description Production-ready React hook for hands-free Web Speech API recognition
 * and direct structural simulator Command Registry execution.
 * Features:
 * - Dual-language intent parser supporting Bahasa Indonesia (id-ID) & English (en-US).
 * - Full coverage of all CommandId definitions (material, steel profiles, diagrams, supports, spans).
 * - Direct mutation of beamSimulatorStore via beamSimulatorActions.
 * - Procedural Web Audio API sound synthesizer for immediate acoustic acknowledgment.
 * - Graceful fallback and error telemetry when SpeechRecognition is unsupported.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { BrowserClapDetector } from "@/core/audio/clap-detector";
import { buildDxfFromSimulatorState } from "@/core/exporters/dxf-autocad-exporter";
import { buildIdeaOpenModelXmlFromSimulatorState } from "@/core/exporters/ideastatica-exporter";
import { buildIfc4FromSimulatorState } from "@/core/exporters/ifc4-bim-revit-exporter";
import { buildS2kFromSimulatorState } from "@/core/exporters/s2k-sap2000-exporter";
import { buildStepAp214FromSimulatorState } from "@/core/exporters/step-solidworks-exporter";
import { matchRuleBasedIntent } from "@/lib/command-matcher";
import { matchWakeWord } from "@/lib/wake-word-detector";
import { beamSimulatorActions, getBeamSimulatorSnapshot } from "@/state/beam-simulator-store";
import { floatingWindowActions, type FloatingWindowId } from "@/state/floating-window-store";
import type { DistributedLoad } from "@/types/beam-loading-modes";
import type { Kilonewton, KilonewtonPerMeter, Megapascal, Meter } from "@/types/branded-units";
import {
  type CommandExecutionResult,
  type CommandId,
  CommandRegistryError,
  generateContextualSuggestions,
  type IntentRouterResult,
} from "@/types/command-registry-types";
import type { SteelGrade } from "@/types/steel-sni1729-types";

/**
 * Downloads a generated file directly in the browser environment.
 */
function downloadFileBrowser(
  content: string | Uint8Array,
  fileName: string,
  mimeType: string,
): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  try {
    const blob = new Blob([content as BlobPart], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {
    // Ignore in non-browser environment
  }
}

// ============================================================================
// Gemini 3.8 Live 24kHz Linear PCM Audio Engine & Bidi WebSocket Client
// (Directly adapted from prototype/voice-command/public/app.js)
// ============================================================================

let playbackContext: AudioContext | null = null;
let nextPlayTime = 0;

/**
 * Returns or initializes the persistent 24kHz AudioContext for Gemini Live PCM streaming.
 */
function getPlaybackContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;

  if (!playbackContext) {
    playbackContext = new AudioCtx({ sampleRate: 24000 });
  }
  return playbackContext;
}

/**
 * Seamless 24kHz 16-bit linear PCM chunk player with gapless nextPlayTime scheduling.
 * Directly adapted from prototype/voice-command/public/app.js (playPcmChunk).
 */
export function playPcmChunk(base64Data: string): void {
  if (typeof window === "undefined" || !base64Data) return;
  try {
    const ctx = getPlaybackContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      void ctx.resume();
    }

    const binary = window.atob(base64Data);
    const len = binary.length;
    const alignedLen = len - (len % 2);
    if (alignedLen === 0) return;

    const bytes = new Uint8Array(alignedLen);
    for (let i = 0; i < alignedLen; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    // 16-bit linear PCM (little-endian) to Float32 (-1.0 to 1.0)
    const int16 = new Int16Array(bytes.buffer, bytes.byteOffset, alignedLen / 2);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = (int16[i] ?? 0) / 32768.0;
    }

    const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
    audioBuffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    if (nextPlayTime < now) {
      nextPlayTime = now + 0.04; // 40ms jitter buffer
    }
    source.start(nextPlayTime);
    nextPlayTime += audioBuffer.duration;
  } catch {
    // Graceful fallback if audio context is restricted
  }
}

/**
 * Returns true if scheduled 24kHz PCM audio from Gemini Live is still playing or in its 350ms tail.
 */
export function isGeminiAudioCurrentlyPlaying(): boolean {
  if (!playbackContext) return false;
  return playbackContext.currentTime < nextPlayTime + 0.35;
}

/**
 * Waits until all scheduled 24kHz PCM chunks in playbackContext have finished playing out of speakers.
 */
export async function waitForGeminiPlaybackCompletion(): Promise<void> {
  if (!playbackContext) return;
  const remainingSec = nextPlayTime - playbackContext.currentTime;
  if (remainingSec > 0) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, Math.ceil(remainingSec * 1000) + 350);
    });
  } else {
    await new Promise<void>((resolve) => setTimeout(resolve, 250));
  }
}

/**
 * Plays a full or chunked 24kHz PCM payload from Gemini Live using playPcmChunk.
 */
export async function playGeminiLiveAudioPayload(
  base64Data: string,
  _mimeType = "audio/pcm;rate=24000",
  _sampleRate = 24000,
): Promise<void> {
  playPcmChunk(base64Data);
  await waitForGeminiPlaybackCompletion();
}

// Persistent BidiGenerateContent WebSocket state (adapted from prototype/voice-command/public/app.js)
let liveWebSocket: WebSocket | null = null;
let isBidiSetupComplete = false;
let isBidiConnecting = false;
let activeTurnCompleteCallback: (() => void) | null = null;
const pendingBidiQueue: Array<{ text: string; onDone?: () => void }> = [];

/**
 * Connects persistent browser WebSocket to Gemini 3.8 Live BidiGenerateContent
 * (adapted from connectBidiWebSocket in prototype/voice-command/public/app.js).
 */
export async function ensureGeminiLiveBidiWebSocket(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (liveWebSocket && liveWebSocket.readyState === WebSocket.OPEN && isBidiSetupComplete) {
    return true;
  }
  if (isBidiConnecting) {
    return false;
  }

  isBidiConnecting = true;
  try {
    const cfgRes = await fetch("/api/ai/live-speech", { method: "GET" });
    if (!cfgRes.ok) {
      isBidiConnecting = false;
      return false;
    }
    const cfg = (await cfgRes.json()) as {
      wsUrl?: string;
      model?: string;
      voiceName?: string;
    };
    if (!cfg.wsUrl) {
      isBidiConnecting = false;
      return false;
    }

    return await new Promise<boolean>((resolve) => {
      let resolved = false;
      const ws = new WebSocket(cfg.wsUrl!);
      liveWebSocket = ws;
      isBidiSetupComplete = false;

      const connectTimer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          isBidiConnecting = false;
          resolve(false);
        }
      }, 6000);

      ws.onopen = () => {
        const cleanModel = (cfg.model || "models/gemini-3.8-live").startsWith("models/")
          ? cfg.model || "models/gemini-3.8-live"
          : `models/${cfg.model}`;

        const setupMsg = {
          setup: {
            model: cleanModel,
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: cfg.voiceName || "Aoede",
                  },
                },
              },
            },
            systemInstruction: {
              parts: [
                {
                  text: "Kamu adalah asisten suara AI Gemini Live untuk aplikasi teknik sipil Interactive Beam Deflection & Structural Design Simulator (IBDS). Jawab dan konfirmasi setiap aksi dengan suara Bahasa Indonesia yang ramah, natural, jelas, dan ringkas (1 kalimat padat).",
                },
              ],
            },
          },
        };
        ws.send(JSON.stringify(setupMsg));
      };

      ws.onmessage = async (event: MessageEvent) => {
        try {
          let rawText = "";
          if (typeof event.data === "string") {
            rawText = event.data;
          } else if (event.data instanceof Blob) {
            rawText = await event.data.text();
          } else if (event.data instanceof ArrayBuffer) {
            rawText = new TextDecoder("utf-8").decode(event.data);
          }

          const data = JSON.parse(rawText) as {
            setupComplete?: Record<string, unknown>;
            serverContent?: {
              modelTurn?: {
                parts?: Array<{
                  inlineData?: { data?: string; mimeType?: string };
                }>;
              };
              turnComplete?: boolean;
            };
          };

          if (data.setupComplete) {
            isBidiSetupComplete = true;
            isBidiConnecting = false;
            clearTimeout(connectTimer);
            if (!resolved) {
              resolved = true;
              resolve(true);
            }

            while (pendingBidiQueue.length > 0) {
              const item = pendingBidiQueue.shift();
              if (item && ws.readyState === WebSocket.OPEN) {
                activeTurnCompleteCallback = item.onDone ?? null;
                ws.send(
                  JSON.stringify({
                    clientContent: {
                      turns: [
                        {
                          role: "user",
                          parts: [
                            {
                              text: `Konfirmasikan dengan singkat dan natural dalam Bahasa Indonesia: "${item.text}"`,
                            },
                          ],
                        },
                      ],
                      turnComplete: true,
                    },
                  }),
                );
              }
            }
          }

          if (data.serverContent) {
            const parts = data.serverContent.modelTurn?.parts;
            if (parts) {
              for (const p of parts) {
                if (p.inlineData?.data) {
                  playPcmChunk(p.inlineData.data);
                }
              }
            }

            if (data.serverContent.turnComplete) {
              const cb = activeTurnCompleteCallback;
              activeTurnCompleteCallback = null;
              if (cb) {
                void waitForGeminiPlaybackCompletion().then(() => cb());
              }
            }
          }
        } catch {
          // Ignore malformed WS message
        }
      };

      ws.onerror = () => {
        isBidiSetupComplete = false;
        isBidiConnecting = false;
        clearTimeout(connectTimer);
        if (!resolved) {
          resolved = true;
          resolve(false);
        }
      };

      ws.onclose = () => {
        isBidiSetupComplete = false;
        isBidiConnecting = false;
        liveWebSocket = null;
        clearTimeout(connectTimer);
        if (!resolved) {
          resolved = true;
          resolve(false);
        }
        const cb = activeTurnCompleteCallback;
        activeTurnCompleteCallback = null;
        if (cb) cb();
      };
    });
  } catch {
    isBidiConnecting = false;
    return false;
  }
}

/**
 * Checks if a recognized transcript is an acoustic self-echo from the device's own speakers.
 */
export function isSelfFeedbackEcho(transcript: string, lastSpokenText: string): boolean {
  const t = transcript.toLowerCase().trim();
  if (!t) return true;

  if (lastSpokenText) {
    const l = lastSpokenText.toLowerCase().trim();
    if (l.includes(t) || t.includes(l)) return true;
  }

  const echoKeywords = [
    "perintah tidak dikenali",
    "silakan coba",
    "salah satu saran",
    "saran perintah",
    "berhasil diekspor",
    "berhasil diaktifkan",
    "berhasil dimatikan",
    "berhasil ditoggle",
    "berhasil diubah",
    "diperbarui menjadi",
    "mode eco-thermal",
    "kamera webcam",
    "model autocad",
    "simulator struktur",
    "mungkin yang anda maksud",
  ];

  return echoKeywords.some((keyword) => t.includes(keyword));
}

/**
 * Speaks text using Gemini 3.8 Live BidiGenerateContent native 24kHz audio (voice Aoede).
 * Never uses browser window.speechSynthesis.
 */
export async function speakGeminiLiveResponse(
  text: string,
  onStart?: () => void,
  onEnd?: () => void,
): Promise<void> {
  if (typeof window === "undefined" || !text.trim()) return;

  onStart?.();

  try {
    // 1. Try persistent BidiGenerateContent WebSocket first (lowest latency streaming, identical to prototype)
    const wsReady = await ensureGeminiLiveBidiWebSocket();
    if (
      wsReady &&
      liveWebSocket &&
      liveWebSocket.readyState === WebSocket.OPEN &&
      isBidiSetupComplete
    ) {
      await new Promise<void>((resolve) => {
        const safetyTimer = setTimeout(() => {
          if (activeTurnCompleteCallback) {
            activeTurnCompleteCallback = null;
            resolve();
          }
        }, 8000);

        activeTurnCompleteCallback = () => {
          clearTimeout(safetyTimer);
          resolve();
        };

        liveWebSocket!.send(
          JSON.stringify({
            clientContent: {
              turns: [
                {
                  role: "user",
                  parts: [
                    {
                      text: `Konfirmasikan dengan singkat dan natural dalam Bahasa Indonesia: "${text}"`,
                    },
                  ],
                },
              ],
              turnComplete: true,
            },
          }),
        );
      });

      onEnd?.();
      return;
    }

    // 2. Fallback: Server-side BidiGenerateContent WebSocket via POST /api/ai/live-speech
    const res = await fetch("/api/ai/live-speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (res.ok) {
      const data = (await res.json()) as {
        chunks?: string[];
        audioBase64?: string;
      };

      if (Array.isArray(data.chunks) && data.chunks.length > 0) {
        for (const chunk of data.chunks) {
          playPcmChunk(chunk);
        }
        await waitForGeminiPlaybackCompletion();
      } else if (data.audioBase64) {
        playPcmChunk(data.audioBase64);
        await waitForGeminiPlaybackCompletion();
      }
    }
  } catch {
    // Ignore network error quietly; never use robotic window.speechSynthesis
  } finally {
    onEnd?.();
  }
}

/**
 * Curated list of popular voice commands for suggestions and user reference.
 */
export const VOICE_COMMAND_SUGGESTIONS: readonly string[] = [
  "Beralih ke material baja",
  "Ubah ke beton bertulang",
  "Ekspor ke AutoCAD",
  "Ekspor model SAP2000",
  "Ekspor model IFC BIM",
  "Tampilkan diagram momen BMD",
  "Tampilkan bidang geser SFD",
  "Matikan kamera",
  "Nyalakan kamera",
  "Atur panjang balok 6 meter",
  "Buka modal ekspor",
  "Optimasi penampang ekonomis",
];

export function getCommandSuggestions(input: string, maxCount: number = 4): string[] {
  const lower = input.toLowerCase().trim();
  if (!lower) {
    return VOICE_COMMAND_SUGGESTIONS.slice(0, maxCount);
  }

  const scored = VOICE_COMMAND_SUGGESTIONS.map((suggestion) => {
    const sLower = suggestion.toLowerCase();
    let score = 0;
    const words = lower.split(/\s+/);
    for (const word of words) {
      if (word.length >= 2 && sLower.includes(word)) {
        score += word.length;
      }
    }
    return { suggestion, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const matched = scored.filter((s) => s.score > 0).map((s) => s.suggestion);

  const result = [...matched];
  for (const item of VOICE_COMMAND_SUGGESTIONS) {
    if (!result.includes(item)) {
      result.push(item);
    }
    if (result.length >= maxCount) break;
  }
  return result.slice(0, maxCount);
}

// ============================================================================
// Web Audio Synthetic Acoustic Chime Synthesizer
// ============================================================================

/**
 * Supported auditory chime feedback sounds.
 */
export type AudioChimeType = "SUCCESS" | "FAILURE" | "START" | "STOP";

let sharedAudioContext: AudioContext | null = null;

/**
 * Returns or initializes the shared browser AudioContext.
 * @returns Initialized or resumed AudioContext.
 */
function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;

  if (!sharedAudioContext) {
    sharedAudioContext = new AudioCtx();
  }
  if (sharedAudioContext.state === "suspended") {
    void sharedAudioContext.resume();
  }
  return sharedAudioContext;
}

/**
 * Synthesizes procedural Web Audio beeps for hands-free audio confirmation.
 * @param type Sound cue category (SUCCESS, FAILURE, START, STOP).
 * @example
 * synthesizeAudioTone("SUCCESS");
 */
export function synthesizeAudioTone(type: AudioChimeType): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    switch (type) {
      case "START": {
        // High crisp rising tone (Ding)
        osc.type = "sine";
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.start(now);
        osc.stop(now + 0.14);
        break;
      }
      case "SUCCESS": {
        // Cheerful double-tone confirmation arpeggio (C5 to G5)
        osc.type = "triangle";
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.12);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);
        break;
      }
      case "FAILURE": {
        // Descending low buzzer tone (420Hz to 220Hz)
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.18);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
        break;
      }
      case "STOP": {
        // Soft neutral decay tone
        osc.type = "sine";
        osc.frequency.setValueAtTime(329.63, now);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
        break;
      }
    }
  } catch {
    // Ignore audio autoplay restrictions gracefully
  }
}

// ============================================================================
// Natural Language Intent Router & Keyword Matcher
// ============================================================================

/**
 * Natural language rule matching natural spoken phrases in Indonesian & English
 * to discrete simulator CommandId and parsed parameters.
 *
 * @param transcript Spoken transcript string.
 * @returns {@link IntentRouterResult} or null if no command matched.
 * @example
 * const res = routeVoiceTranscriptToCommand("ubah ke material beton bertulang");
 * console.log(res?.commandId); // "SWITCH_MATERIAL_CONCRETE"
 */
export function routeVoiceTranscriptToCommand(transcript: string): IntentRouterResult | null {
  return matchRuleBasedIntent(transcript);
}

function _legacyRouteVoiceTranscriptToCommand(transcript: string): IntentRouterResult | null {
  const raw = transcript.trim();
  const lower = raw.toLowerCase();

  if (!lower) return null;

  // 1. Camera & 3D Viewport Controls (All Viewport Toolbar Buttons)
  if (
    lower.includes("isometrik") ||
    lower.includes("isometric") ||
    lower.includes("view 3d") ||
    lower.includes("tampilan 3d")
  ) {
    return {
      commandId: "SET_VIEW_ISOMETRIC",
      confidence: 0.96,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Tampilan viewport dialihkan ke 3D Isometrik.",
      suggestions: generateContextualSuggestions("SET_VIEW_ISOMETRIC"),
    };
  }
  if (
    lower.includes("tampak depan") ||
    lower.includes("view 2d") ||
    lower.includes("tampilan 2d") ||
    lower.includes("front 2d") ||
    lower.includes("pandangan depan")
  ) {
    return {
      commandId: "SET_VIEW_FRONT",
      confidence: 0.96,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Tampilan viewport dialihkan ke Tampak Depan 2D ortogonal.",
      suggestions: generateContextualSuggestions("SET_VIEW_FRONT"),
    };
  }
  if (
    lower.includes("fit view") ||
    lower.includes("fit tampilan") ||
    lower.includes("zoom fit") ||
    lower.includes("fokuskan balok") ||
    lower.includes("pusatkan kamera") ||
    lower === "fit"
  ) {
    return {
      commandId: "FIT_CAMERA_VIEW",
      confidence: 0.96,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Kamera difokuskan kembali ke seluruh bentang balok.",
      suggestions: generateContextualSuggestions("FIT_CAMERA_VIEW"),
    };
  }

  // 2. Concrete View Modes (Solid vs Wireframe Tulangan)
  if (
    lower.includes("wireframe") ||
    lower.includes("tulangan balok") ||
    lower.includes("lihat tulangan") ||
    lower.includes("tulangannya") ||
    lower.includes("rebar cage")
  ) {
    return {
      commandId: "SET_CONCRETE_VIEW_WIREFRAME",
      confidence: 0.96,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Visualisasi beton dialihkan ke Wireframe Tulangan Lentur dan Sengkang.",
      suggestions: generateContextualSuggestions("SET_CONCRETE_VIEW_WIREFRAME"),
    };
  }
  if (
    lower.includes("solid potongan") ||
    lower.includes("mode solid") ||
    lower.includes("tampilan solid") ||
    lower.includes("potongan ujung")
  ) {
    return {
      commandId: "SET_CONCRETE_VIEW_SOLID",
      confidence: 0.96,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Visualisasi beton dialihkan ke Solid dengan Potongan Ujung.",
      suggestions: generateContextualSuggestions("SET_CONCRETE_VIEW_SOLID"),
    };
  }

  // 3. 3D Coordinate Axis Conventions (Z-Up vs Y-Up)
  if (
    lower.includes("z up") ||
    lower.includes("z-up") ||
    lower.includes("sumbu z") ||
    lower.includes("koordinat z")
  ) {
    return {
      commandId: "SET_COORDINATE_Z_UP",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Sistem koordinat 3D diatur ke Z-Up standar Rekayasa Sipil.",
      suggestions: ["Beralih ke Y-Up", "Fit tampilan balok", "Tampilkan diagram momen BMD"],
    };
  }
  if (
    lower.includes("y up") ||
    lower.includes("y-up") ||
    lower.includes("sumbu y") ||
    lower.includes("koordinat y")
  ) {
    return {
      commandId: "SET_COORDINATE_Y_UP",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Sistem koordinat 3D diatur ke Y-Up standar WebGL dan CAD.",
      suggestions: ["Beralih ke Z-Up", "Fit tampilan balok", "Tampilkan tampak depan 2D"],
    };
  }

  // 4. Floating Windows Management (Buttons 1-6 & Window Controls)
  if (
    lower.includes("tutup semua jendela") ||
    lower.includes("sembunyikan semua window") ||
    lower.includes("bersihkan layar") ||
    lower.includes("close all windows")
  ) {
    return {
      commandId: "CLOSE_ALL_WINDOWS",
      confidence: 0.96,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Semua jendela kerja telah ditutup untuk tampilan balok penuh.",
      suggestions: ["Buka semua jendela", "Buka jendela beban", "Buka jendela diagram"],
    };
  }
  if (
    lower.includes("buka semua jendela") ||
    lower.includes("tampilkan semua window") ||
    lower.includes("open all windows")
  ) {
    return {
      commandId: "OPEN_ALL_WINDOWS",
      confidence: 0.96,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Semua jendela kerja telah dibuka kembali.",
      suggestions: ["Reset tata letak jendela", "Tutup semua jendela", "Hitung optimasi"],
    };
  }
  if (
    lower.includes("reset tata letak") ||
    lower.includes("reset posisi jendela") ||
    lower.includes("reset susunan jendela") ||
    lower.includes("reset layout")
  ) {
    return {
      commandId: "RESET_WINDOWS_LAYOUT",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Tata letak posisi jendela kerja telah dikembalikan ke default.",
      suggestions: ["Buka jendela material", "Buka jendela optimasi", "Fit tampilan balok"],
    };
  }

  // Window targeting (Open / Close by window name)
  const isClosingWindow =
    lower.includes("tutup") || lower.includes("close") || lower.includes("sembunyikan");
  if (lower.includes("jendela material") || lower.includes("window material")) {
    return {
      commandId: isClosingWindow ? "CLOSE_WINDOW" : "OPEN_WINDOW",
      confidence: 0.95,
      extractedParameters: { target: "MATERIAL_LOAD_MODE" },
      rawTranscript: raw,
      spokenConfirmation: `Jendela Material & Mode ${isClosingWindow ? "ditutup" : "dibuka"}.`,
      suggestions: ["Ubah ke beton bertulang", "Ganti ke baja struktural", "Mode beban eksternal"],
    };
  }
  if (lower.includes("jendela beban") || lower.includes("window beban")) {
    return {
      commandId: isClosingWindow ? "CLOSE_WINDOW" : "OPEN_WINDOW",
      confidence: 0.95,
      extractedParameters: { target: "REALTIME_LOAD_INPUT" },
      rawTranscript: raw,
      spokenConfirmation: `Jendela Beban & Tumpuan ${isClosingWindow ? "ditutup" : "dibuka"}.`,
      suggestions: ["Tambah beban titik 50 kN", "Tambah beban merata 15 kN/m", "Tumpuan sendi rol"],
    };
  }
  if (lower.includes("jendela parameter") || lower.includes("window parameter")) {
    return {
      commandId: isClosingWindow ? "CLOSE_WINDOW" : "OPEN_WINDOW",
      confidence: 0.95,
      extractedParameters: { target: "SNI_DESIGN_PARAMETERS" },
      rawTranscript: raw,
      spokenConfirmation: `Jendela Parameter SNI ${isClosingWindow ? "ditutup" : "dibuka"}.`,
      suggestions: ["Mutu baja BJ 50", "Mutu beton fc 35 MPa", "Filter profil IWF"],
    };
  }
  if (
    lower.includes("jendela optimasi") ||
    lower.includes("window optimasi") ||
    lower.includes("jendela hasil")
  ) {
    return {
      commandId: isClosingWindow ? "CLOSE_WINDOW" : "OPEN_WINDOW",
      confidence: 0.95,
      extractedParameters: { target: "OPTIMIZATION_RESULTS" },
      rawTranscript: raw,
      spokenConfirmation: `Jendela Hasil Optimasi ${isClosingWindow ? "ditutup" : "dibuka"}.`,
      suggestions: ["Hitung optimasi penampang", "Buka modal ekspor CAD", "Ekspor ke AutoCAD"],
    };
  }
  if (lower.includes("jendela diagram") || lower.includes("window diagram")) {
    return {
      commandId: isClosingWindow ? "CLOSE_WINDOW" : "OPEN_WINDOW",
      confidence: 0.95,
      extractedParameters: { target: "INTERNAL_FORCE_DIAGRAMS" },
      rawTranscript: raw,
      spokenConfirmation: `Jendela Diagram Gaya Dalam ${isClosingWindow ? "ditutup" : "dibuka"}.`,
      suggestions: ["Tampilkan momen BMD", "Tampilkan geser SFD", "Mode stacked vertikal"],
    };
  }

  // 5. Numerical Parameter Adjustments
  // Span length
  const spanMatch = lower.match(
    /(?:bentang|span|panjang|length)\s*(?:balok\s*)?(?:menjadi|ke|is)?\s*([0-9]+(?:[.,][0-9]+)?)\s*(?:m|meter)?/,
  );
  if (spanMatch && spanMatch[1]) {
    const val = parseFloat(spanMatch[1].replace(",", "."));
    if (!isNaN(val) && val > 0 && val <= 50) {
      return {
        commandId: "SET_SPAN_LENGTH",
        confidence: 0.95,
        extractedParameters: { spanLengthM: val },
        rawTranscript: raw,
        spokenConfirmation: `Panjang bentang balok diperbarui menjadi ${val.toFixed(2)} meter.`,
        suggestions: generateContextualSuggestions("SET_SPAN_LENGTH"),
      };
    }
  }

  // Clear / remove loads
  if (
    lower.includes("hapus semua beban") ||
    lower.includes("bersihkan beban") ||
    lower.includes("reset beban") ||
    lower.includes("clear load") ||
    lower.includes("hapus seluruh beban")
  ) {
    return {
      commandId: "CLEAR_ALL_LOADS",
      confidence: 0.96,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Seluruh beban titik dan beban merata berhasil dibersihkan.",
      suggestions: ["Tambah beban titik 50 kN", "Tambah beban merata 20 kN/m", "Hitung optimasi"],
    };
  }
  if (
    lower.includes("hapus beban merata") ||
    lower.includes("hilangkan beban merata") ||
    lower.includes("hapus q")
  ) {
    return {
      commandId: "REMOVE_DISTRIBUTED_LOAD",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Beban merata terakhir berhasil dihapus.",
      suggestions: ["Tambah beban merata baru", "Lihat diagram momen BMD", "Hitung optimasi"],
    };
  }
  if (
    lower.includes("hapus beban titik") ||
    lower.includes("hilangkan beban titik") ||
    lower.includes("hapus p")
  ) {
    return {
      commandId: "REMOVE_POINT_LOAD",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Beban titik terakhir berhasil dihapus.",
      suggestions: ["Tambah beban titik baru", "Lihat diagram momen BMD", "Hitung optimasi"],
    };
  }

  // Distributed Load q (e.g. "beban merata 15 kn/m", "tambah beban merata 20", "beban q 25")
  const distLoadMatch = lower.match(
    /(?:beban\s*merata|beban\s*terbagi|beban\s*q|distributed\s*load)\s*(?:sebesar)?\s*([0-9]+(?:[.,][0-9]+)?)\s*(?:kn\/m|kn)?/,
  );
  if (distLoadMatch && distLoadMatch[1]) {
    const val = parseFloat(distLoadMatch[1].replace(",", "."));
    if (!isNaN(val) && val > 0) {
      return {
        commandId: "ADD_DISTRIBUTED_LOAD",
        confidence: 0.94,
        extractedParameters: { magnitudeKnPerM: val },
        rawTranscript: raw,
        spokenConfirmation: `Beban merata q = ${val} kN/m berhasil ditambahkan di sepanjang bentang balok.`,
        suggestions: generateContextualSuggestions("ADD_DISTRIBUTED_LOAD"),
      };
    }
  }

  // Point load P
  const pointLoadMatch = lower.match(
    /(?:beban\s*titik|point\s*load|tambah\s*beban)\s*(?:sebesar)?\s*([0-9]+(?:[.,][0-9]+)?)\s*(?:kn)?/,
  );
  if (pointLoadMatch && pointLoadMatch[1]) {
    const val = parseFloat(pointLoadMatch[1].replace(",", "."));
    if (!isNaN(val) && val > 0) {
      return {
        commandId: "ADD_POINT_LOAD",
        confidence: 0.92,
        extractedParameters: { magnitudeKn: val },
        rawTranscript: raw,
        spokenConfirmation: `Beban titik Pu = ${val} kN berhasil ditambahkan di tengah bentang balok.`,
        suggestions: generateContextualSuggestions("ADD_POINT_LOAD"),
      };
    }
  }

  // Self weight
  if (lower.includes("berat sendiri") || lower.includes("self weight")) {
    return {
      commandId: "TOGGLE_SELF_WEIGHT",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Perhitungan berat sendiri balok ditoggle.",
      suggestions: ["Lihat diagram momen BMD", "Tambah beban titik 50 kN", "Hitung optimasi"],
    };
  }

  // Deflection limit denominator (L/180, L/240, L/360, L/480)
  const deflLimitMatch = lower.match(
    /(?:batas\s*lendutan|defleksi\s*izin|lendutan\s*izin)\s*(?:l\/|l\s*)?(180|240|360|480)/,
  );
  if (deflLimitMatch && deflLimitMatch[1]) {
    const denom = parseInt(deflLimitMatch[1], 10) as 180 | 240 | 360 | 480;
    return {
      commandId: "SET_DEFLECTION_LIMIT",
      confidence: 0.95,
      extractedParameters: { denominator: denom },
      rawTranscript: raw,
      spokenConfirmation: `Batas lendutan izin balok diatur ke L/${denom}.`,
      suggestions: ["Hitung optimasi profil", "Lihat lendutan di HUD", "Ubah mutu baja"],
    };
  }

  // Concrete dimensions (b x h, e.g. "lebar 300 tinggi 600", "b 250 h 500")
  const dimMatch = lower.match(
    /(?:lebar|b)\s*([0-9]{2,4})\s*(?:tinggi|dan\s*tinggi|h|x)\s*([0-9]{2,4})/,
  );
  if (dimMatch && dimMatch[1] && dimMatch[2]) {
    const bw = parseInt(dimMatch[1], 10);
    const h = parseInt(dimMatch[2], 10);
    return {
      commandId: "SET_CONCRETE_DIMENSIONS",
      confidence: 0.95,
      extractedParameters: { bwMm: bw, hMm: h },
      rawTranscript: raw,
      spokenConfirmation: `Dimensi penampang beton diubah menjadi lebar ${bw} mm dan tinggi ${h} mm.`,
      suggestions: ["Lihat wireframe tulangan", "Atur mutu beton fc 30 MPa", "Hitung optimasi"],
    };
  }

  // Concrete fc'
  const kCubeMatch = lower.match(/k\s*[-]?\s*([0-9]{3})/);
  if (kCubeMatch && kCubeMatch[1]) {
    const kVal = parseInt(kCubeMatch[1], 10);
    const fcVal = Math.round(kVal * 0.083 * 10) / 10;
    return {
      commandId: "SET_CONCRETE_FC",
      confidence: 0.94,
      extractedParameters: { fcMpa: fcVal, historicalGrade: `K-${kVal}` },
      rawTranscript: raw,
      spokenConfirmation: `Mutu beton K-${kVal} diterapkan (setara kuat tekan f'c = ${fcVal} MPa).`,
      suggestions: ["Lihat wireframe tulangan", "Tambah beban titik 50 kN", "Ekspor BIM IFC"],
    };
  }

  const fcMatch = lower.match(
    /(?:mutu\s*beton|kuat\s*tekan|fc[']?|concrete\s*grade)\s*(?:menjadi|ke)?\s*([0-9]+(?:[.,][0-9]+)?)\s*(?:mpa)?/,
  );
  if (fcMatch && fcMatch[1]) {
    const val = parseFloat(fcMatch[1].replace(",", "."));
    if (!isNaN(val) && val >= 15 && val <= 100) {
      return {
        commandId: "SET_CONCRETE_FC",
        confidence: 0.94,
        extractedParameters: { fcMpa: val },
        rawTranscript: raw,
        spokenConfirmation: `Kuat tekan beton f'c berhasil diatur ke ${val} MPa.`,
        suggestions: ["Lihat wireframe tulangan", "Ubah dimensi balok", "Hitung optimasi"],
      };
    }
  }

  // 6. Steel Profile Filtering & Specific Selection (checked before general material)
  if (
    lower.includes("filter box") ||
    lower.includes("profil box") ||
    lower.includes("hollow") ||
    lower.includes("pipa kotak") ||
    lower.includes("shs") ||
    lower.includes("rhs") ||
    lower.includes("kotak")
  ) {
    return {
      commandId: "FILTER_STEEL_BOX",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Katalog profil dibatasi hanya pada Profil Hollow atau BOX.",
      suggestions: ["Optimalkan profil penampang", "Ganti ke profil IWF", "Ekspor ke AutoCAD"],
    };
  }
  if (
    lower.includes("filter iwf") ||
    lower.includes("profil iwf") ||
    lower.includes("wide flange") ||
    /\bprofil\s*h\b/.test(lower) ||
    /\bh[- ]?beam\b/.test(lower) ||
    /\bprofil\s*i\b/.test(lower)
  ) {
    return {
      commandId: "FILTER_STEEL_IWF",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Katalog profil dibatasi hanya pada Profil IWF / H-Beam.",
      suggestions: ["Optimalkan profil penampang", "Pilih profil IWF 300x150", "Ekspor ke AutoCAD"],
    };
  }
  if (
    lower.includes("semua profil") ||
    lower.includes("all steel") ||
    lower.includes("filter all") ||
    lower.includes("reset filter")
  ) {
    return {
      commandId: "FILTER_STEEL_ALL",
      confidence: 0.92,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Filter profil dinonaktifkan, seluruh profil baja kini dipertimbangkan.",
      suggestions: ["Optimalkan profil penampang", "Tampilkan diagram momen BMD", "Ekspor SAP2000"],
    };
  }

  // Steel specific profile selection (e.g. "pilih profil iwf 300x150", "profil wf 400x200")
  const profileSelectMatch = lower.match(
    /(?:pilih|gunakan|ganti\s*ke)?\s*(?:profil\s*)?(iwf|wf|box)\s*([0-9]{2,4}\s*[xX]\s*[0-9]{2,4}(?:\s*[xX]\s*[0-9]+)?)/,
  );
  if (profileSelectMatch && profileSelectMatch[2]) {
    const profName = `${profileSelectMatch[1]?.toUpperCase() || "IWF"} ${profileSelectMatch[2].replace(/\s+/g, "")}`;
    return {
      commandId: "SELECT_STEEL_PROFILE",
      confidence: 0.95,
      extractedParameters: { profileName: profName },
      rawTranscript: raw,
      spokenConfirmation: `Profil penampang baja berhasil diatur ke ${profName}.`,
      suggestions: [
        "Hitung optimasi profil",
        "Tampilkan diagram momen BMD",
        "Ekspor ke AutoCAD DXF",
      ],
    };
  }

  // Steel grade
  const steelGradeMatch = lower.match(
    /(?:mutu\s*baja|grade|baja)\s*(?:bj\s*[_]?\s*)?(34|37|41|50|55)/,
  );
  if (steelGradeMatch && steelGradeMatch[1]) {
    const grade = `BJ_${steelGradeMatch[1]}` as SteelGrade;
    return {
      commandId: "SET_STEEL_GRADE",
      confidence: 0.96,
      extractedParameters: { steelGrade: grade },
      rawTranscript: raw,
      spokenConfirmation: `Mutu baja struktural diatur ke ${grade} (SNI 1729).`,
      suggestions: ["Optimasi penampang profil", "Filter profil IWF", "Ekspor SAP2000"],
    };
  }
  if (lower.includes("a36") || lower.includes("astm a36")) {
    return {
      commandId: "SET_STEEL_GRADE",
      confidence: 0.92,
      extractedParameters: { steelGrade: "BJ_37" as SteelGrade },
      rawTranscript: raw,
      spokenConfirmation: "Mutu baja ASTM A36 diterapkan (setara BJ 37).",
      suggestions: ["Optimasi penampang profil", "Filter profil IWF", "Ekspor SAP2000"],
    };
  }

  // 7. General Material Selection
  if (lower.includes("beton") || lower.includes("concrete")) {
    return {
      commandId: "SWITCH_MATERIAL_CONCRETE",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Material balok berhasil diubah ke Beton Bertulang (SNI 2847:2019).",
      suggestions: generateContextualSuggestions("SWITCH_MATERIAL_CONCRETE"),
    };
  }
  if (lower.includes("baja") || lower.includes("steel")) {
    return {
      commandId: "SWITCH_MATERIAL_STEEL",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Material balok berhasil diubah ke Baja Struktural (SNI 1729:2020).",
      suggestions: generateContextualSuggestions("SWITCH_MATERIAL_STEEL"),
    };
  }

  // 8. Diagram Toggles
  if (
    lower.includes("bmd") ||
    lower.includes("momen lentur") ||
    lower.includes("diagram momen") ||
    lower.includes("bending moment")
  ) {
    return {
      commandId: "TOGGLE_DIAGRAM_BMD",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Visibilitas Diagram Momen Lentur (BMD) berhasil ditoggle.",
      suggestions: generateContextualSuggestions("TOGGLE_DIAGRAM_BMD"),
    };
  }
  if (
    lower.includes("sfd") ||
    lower.includes("gaya geser") ||
    lower.includes("gaya lintang") ||
    lower.includes("shear force")
  ) {
    return {
      commandId: "TOGGLE_DIAGRAM_SFD",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Visibilitas Diagram Gaya Geser (SFD) berhasil ditoggle.",
      suggestions: generateContextualSuggestions("TOGGLE_DIAGRAM_SFD"),
    };
  }
  if (
    lower.includes("nfd") ||
    lower.includes("gaya aksial") ||
    lower.includes("normal force") ||
    lower.includes("gaya normal") ||
    lower.includes("aksial") ||
    lower.includes("axial")
  ) {
    return {
      commandId: "TOGGLE_DIAGRAM_NFD",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Visibilitas Diagram Gaya Aksial (NFD) berhasil ditoggle.",
      suggestions: generateContextualSuggestions("TOGGLE_DIAGRAM_NFD"),
    };
  }
  if (
    lower.includes("tfd") ||
    lower.includes("momen torsi") ||
    lower.includes("diagram torsi") ||
    lower.includes("puntir") ||
    lower.includes("torsion")
  ) {
    return {
      commandId: "TOGGLE_DIAGRAM_TFD",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Visibilitas Diagram Momen Torsi (TFD) berhasil ditoggle.",
      suggestions: generateContextualSuggestions("TOGGLE_DIAGRAM_TFD"),
    };
  }

  // 9. Diagram Layout Modes
  if (
    lower.includes("in place") ||
    lower.includes("satu bidang") ||
    lower.includes("sejajar as balok") ||
    lower.includes("diagram sumbu")
  ) {
    return {
      commandId: "SET_DIAGRAM_MODE_IN_PLACE",
      confidence: 0.94,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Mode diagram dialihkan ke In-Place sejajar as balok.",
      suggestions: ["Diagram vertikal stacked", "Diagram jendela terpisah", "Tampilkan momen BMD"],
    };
  }
  if (
    lower.includes("stacked") ||
    lower.includes("bertumpuk") ||
    lower.includes("vertikal menurun")
  ) {
    return {
      commandId: "SET_DIAGRAM_MODE_STACKED",
      confidence: 0.94,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Mode diagram dialihkan ke Vertikal Menurun (Stacked).",
      suggestions: [
        "Diagram in-place sejajar as balok",
        "Buka jendela diagram",
        "Tampilkan geser SFD",
      ],
    };
  }
  if (
    lower.includes("jendela terpisah") ||
    lower.includes("diagram window") ||
    lower.includes("floating diagram") ||
    lower.includes("diagram jendela")
  ) {
    return {
      commandId: "SET_DIAGRAM_MODE_WINDOW",
      confidence: 0.94,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Mode diagram dialihkan ke Jendela Mengambang mandiri.",
      suggestions: ["Diagram vertikal stacked", "Diagram in-place", "Tampilkan momen BMD"],
    };
  }

  // 10. Support Conditions
  if (
    lower.includes("kantilever") ||
    lower.includes("cantilever") ||
    lower.includes("jepit bebas")
  ) {
    return {
      commandId: "SET_SUPPORT_CANTILEVER",
      confidence: 0.96,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Tumpuan balok diatur menjadi Kantilever (Jepit Kiri - Bebas Kanan).",
      suggestions: ["Tumpuan sendi rol", "Tumpuan jepit rol", "Lihat diagram momen BMD"],
    };
  }
  if (
    lower.includes("sendi rol") ||
    lower.includes("pinned roller") ||
    lower.includes("sendi-rol") ||
    lower.includes("tumpuan sederhana") ||
    lower.includes("simply supported")
  ) {
    return {
      commandId: "SET_SUPPORT_PINNED_ROLLER",
      confidence: 0.96,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Tumpuan balok diatur menjadi Sederhana (Sendi - Rol).",
      suggestions: ["Tumpuan jepit rol", "Tumpuan jepit jepit", "Tambah beban merata 15 kN/m"],
    };
  }
  if (
    lower.includes("jepit jepit") ||
    lower.includes("fixed fixed") ||
    lower.includes("jepit-jepit")
  ) {
    return {
      commandId: "SET_SUPPORT_FIXED_FIXED",
      confidence: 0.96,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Tumpuan balok diatur menjadi Jepit - Jepit di kedua ujung.",
      suggestions: ["Tumpuan sendi rol", "Tumpuan jepit rol", "Lihat diagram momen BMD"],
    };
  }
  if (
    lower.includes("jepit rol") ||
    lower.includes("fixed roller") ||
    lower.includes("jepit-rol") ||
    lower.includes("propped cantilever")
  ) {
    return {
      commandId: "SET_SUPPORT_FIXED_ROLLER",
      confidence: 0.96,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Tumpuan balok diatur menjadi Jepit - Rol.",
      suggestions: ["Tumpuan sendi rol", "Tumpuan jepit jepit", "Tambah beban titik 50 kN"],
    };
  }
  if (
    lower.includes("jepit sendi") ||
    lower.includes("fixed pinned") ||
    lower.includes("jepit-sendi")
  ) {
    return {
      commandId: "SET_SUPPORT_FIXED_PINNED",
      confidence: 0.96,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Tumpuan balok diatur menjadi Jepit - Sendi.",
      suggestions: ["Tumpuan sendi rol", "Tumpuan jepit jepit", "Tambah beban merata 20 kN/m"],
    };
  }

  // 11. Loading Paradigms
  if (
    lower.includes("beban eksternal") ||
    lower.includes("mode a") ||
    lower.includes("external load")
  ) {
    return {
      commandId: "SWITCH_MODE_EXTERNAL_LOADS",
      confidence: 0.94,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Mode perhitungan dialihkan ke Mode A: Beban Eksternal Nyata.",
      suggestions: ["Tambah beban titik 50 kN", "Tambah beban merata 20 kN/m", "Tumpuan sendi rol"],
    };
  }
  if (lower.includes("gaya dalam") || lower.includes("mode b") || lower.includes("direct force")) {
    return {
      commandId: "SWITCH_MODE_DIRECT_FORCES",
      confidence: 0.94,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Mode perhitungan dialihkan ke Mode B: Gaya Dalam Terfaktor Langsung.",
      suggestions: ["Atur momen Mu 150 kNm", "Atur geser Vu 80 kN", "Optimasi penampang profil"],
    };
  }

  // 12. Simulation Actions
  if (
    lower.includes("optimasi") ||
    lower.includes("optimalkan") ||
    lower.includes("optimize") ||
    lower.includes("cari profil terhemat") ||
    lower.includes("rekomendasi profil") ||
    lower.includes("hitung penampang")
  ) {
    return {
      commandId: "RUN_OPTIMIZATION",
      confidence: 0.96,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Evaluasi optimasi penampang SNI sedang diproses.",
      suggestions: ["Buka modal ekspor CAD", "Pilih profil IWF 300x150", "Ekspor ke AutoCAD DXF"],
    };
  }
  if (
    lower.includes("reset simulasi") ||
    lower.includes("reset balok") ||
    lower.includes("atur ulang simulasi") ||
    lower.includes("mulai ulang")
  ) {
    return {
      commandId: "RESET_SIMULATION",
      confidence: 0.96,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Seluruh parameter simulasi balok dikembalikan ke setelan awal.",
      suggestions: [
        "Ubah bentang balok jadi 8 meter",
        "Ubah ke material beton",
        "Tampilkan diagram momen BMD",
      ],
    };
  }

  // 13. Exporters
  if (
    lower.includes("dxf") ||
    lower.includes("autocad") ||
    lower.includes("dwg") ||
    (lower.includes("cad") &&
      (lower.includes("ekspor") || lower.includes("export") || lower.includes("download")))
  ) {
    return {
      commandId: "EXPORT_DXF",
      confidence: 0.97,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "File AutoCAD DXF berhasil diekspor dan diunduh.",
      suggestions: generateContextualSuggestions("EXPORT_DXF"),
    };
  }
  if (lower.includes("sap2000") || lower.includes("s2k") || lower.includes("etabs")) {
    return {
      commandId: "EXPORT_SAP2000",
      confidence: 0.97,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Model analisis SAP2000 (.s2k) berhasil diekspor dan diunduh.",
      suggestions: generateContextualSuggestions("EXPORT_SAP2000"),
    };
  }
  if (lower.includes("ifc") || lower.includes("revit") || lower.includes("export bim")) {
    return {
      commandId: "EXPORT_IFC",
      confidence: 0.97,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Model BIM IFC4 berhasil diekspor dan diunduh.",
      suggestions: generateContextualSuggestions("EXPORT_IFC"),
    };
  }
  if (
    lower.includes("idea statica") ||
    lower.includes("ideastatica") ||
    lower.includes("sambungan")
  ) {
    return {
      commandId: "EXPORT_IDEA_STATICA",
      confidence: 0.97,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Model IDEA StatiCa OpenModel berhasil diekspor dan diunduh.",
      suggestions: generateContextualSuggestions("EXPORT_IDEA_STATICA"),
    };
  }
  if (
    lower.includes("solidworks") ||
    lower.includes("step file") ||
    lower.includes("export step") ||
    lower.includes("stp")
  ) {
    return {
      commandId: "EXPORT_SOLIDWORKS_STEP",
      confidence: 0.97,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Model 3D STEP AP214 untuk SolidWorks berhasil diekspor dan diunduh.",
      suggestions: generateContextualSuggestions("EXPORT_SOLIDWORKS_STEP"),
    };
  }

  // 14. Camera & Eco Mode Controls
  if (
    lower.includes("matikan kamera") ||
    lower.includes("stop kamera") ||
    lower.includes("tutup kamera") ||
    lower.includes("nonaktifkan kamera") ||
    lower.includes("matikan video") ||
    lower.includes("sembunyikan kamera")
  ) {
    return {
      commandId: "TOGGLE_CAMERA_PREVIEW",
      confidence: 0.96,
      extractedParameters: { action: "STOP" },
      rawTranscript: raw,
      spokenConfirmation: "Kamera webcam pengenal gestur berhasil dimatikan.",
      suggestions: ["Nyalakan kamera", "Fit tampilan balok", "Tampilkan tampak depan 2D"],
    };
  }
  if (
    lower.includes("nyalakan kamera") ||
    lower.includes("buka kamera") ||
    lower.includes("hidupkan kamera") ||
    lower.includes("aktifkan kamera") ||
    lower.includes("mulai kamera") ||
    lower.includes("munculkan video") ||
    lower.includes("munculkan kamera") ||
    lower.includes("tampilkan kamera") ||
    lower.includes("tampilkan video")
  ) {
    return {
      commandId: "TOGGLE_CAMERA_PREVIEW",
      confidence: 0.96,
      extractedParameters: { action: "START" },
      rawTranscript: raw,
      spokenConfirmation: "Kamera webcam berhasil diaktifkan dengan Knuckle-Anchored tracking.",
      suggestions: ["Mode hemat eco 16 FPS", "Matikan kamera", "Fit tampilan balok"],
    };
  }
  if (lower.includes("eco mode") || lower.includes("mode hemat") || lower.includes("hemat daya")) {
    return {
      commandId: "TOGGLE_ECO_MODE",
      confidence: 0.94,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Mode Eco-Thermal ditoggle.",
      suggestions: ["Matikan kamera", "Fit tampilan balok", "Hitung optimasi"],
    };
  }
  if (
    lower.includes("modal ekspor") ||
    lower.includes("dialog export") ||
    lower.includes("menu ekspor") ||
    lower.includes("menu download")
  ) {
    return {
      commandId: "TOGGLE_EXPORT_MODAL",
      confidence: 0.94,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Jendela ekspor format multi-CAD dibuka.",
      suggestions: ["Ekspor ke AutoCAD DXF", "Ekspor SAP2000", "Ekspor BIM IFC"],
    };
  }
  if (lower.includes("asisten ai") || lower.includes("tanya ai") || lower.includes("konsultan")) {
    return {
      commandId: "TOGGLE_AI_ASSISTANT",
      confidence: 0.94,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Panel Asisten Rekayasa AI dibuka.",
      suggestions: ["Nyalakan kamera", "Tanya saran optimasi balok", "Hitung optimasi penampang"],
    };
  }

  // 15. Mic Mute Controls
  if (lower.includes("jeda suara") || lower.includes("mute mikrofon") || lower === "mute") {
    return {
      commandId: "MUTE_VOICE_COMMAND",
      confidence: 0.96,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Mikrofon dijeda. Klik tombol Listen di toast saat ingin bicara kembali.",
      suggestions: ["Buka jendela beban", "Tampilkan diagram momen BMD", "Hitung optimasi"],
    };
  }
  if (
    lower.includes("unmute") ||
    lower.includes("lanjutkan suara") ||
    lower.includes("dengarkan suara") ||
    lower === "listen"
  ) {
    return {
      commandId: "UNMUTE_VOICE_COMMAND",
      confidence: 0.96,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Mikrofon diaktifkan kembali. Siap menerima perintah suara.",
      suggestions: ["Buka jendela material", "Tampilkan diagram momen BMD", "Hitung optimasi"],
    };
  }

  return null;
}

// ============================================================================
// Direct Simulator Command Dispatcher
// ============================================================================

/**
 * Dispatches an identified CommandId directly into the Beam Simulator state actions.
 *
 * @param commandId Unique executable command identifier.
 * @param params Optional extracted arguments.
 * @returns {@link CommandExecutionResult}
 * @throws {@link CommandRegistryError} If the commandId is unknown or unsupported.
 * @example
 * const res = executeRegistryCommand("SWITCH_MATERIAL_CONCRETE");
 * console.log(res.message);
 */
export function executeRegistryCommand(
  commandId: CommandId,
  params: Record<string, unknown> = {},
): CommandExecutionResult {
  const timestamp = Date.now();

  try {
    switch (commandId) {
      // 1. Material
      case "SWITCH_MATERIAL_CONCRETE":
        beamSimulatorActions.setMaterialKind("CONCRETE");
        return {
          success: true,
          commandId,
          message: "Material berhasil diubah ke Beton Bertulang (SNI 2847:2019).",
          timestamp,
        };

      case "SWITCH_MATERIAL_STEEL":
        beamSimulatorActions.setMaterialKind("STEEL");
        return {
          success: true,
          commandId,
          message: "Material berhasil diubah ke Baja Struktural (SNI 1729:2020).",
          timestamp,
        };

      // 2. Steel Profile Filters
      case "FILTER_STEEL_IWF":
        beamSimulatorActions.setSteelParameters({ profileType: "IWF" });
        return {
          success: true,
          commandId,
          message: "Filter profil baja dibatasi hanya Profil IWF.",
          timestamp,
        };

      case "FILTER_STEEL_BOX":
        beamSimulatorActions.setSteelParameters({ profileType: "BOX" });
        return {
          success: true,
          commandId,
          message: "Filter profil baja dibatasi hanya Profil Hollow / BOX.",
          timestamp,
        };

      case "FILTER_STEEL_ALL":
        beamSimulatorActions.setSteelParameters({
          selectedProfileName: null,
          maxHeightMm: undefined,
          maxWidthMm: undefined,
        });
        return {
          success: true,
          commandId,
          message: "Filter profil baja dibersihkan (semua profil dipertimbangkan).",
          timestamp,
        };

      // 3. Diagram Toggles
      case "TOGGLE_DIAGRAM_BMD":
        beamSimulatorActions.toggleDiagramVisibility("bmd");
        return {
          success: true,
          commandId,
          message: "Visibilitas Diagram Momen Lentur (BMD) berhasil ditoggle.",
          timestamp,
        };

      case "TOGGLE_DIAGRAM_SFD":
        beamSimulatorActions.toggleDiagramVisibility("sfd");
        return {
          success: true,
          commandId,
          message: "Visibilitas Diagram Gaya Geser (SFD) berhasil ditoggle.",
          timestamp,
        };

      case "TOGGLE_DIAGRAM_NFD":
        beamSimulatorActions.toggleDiagramVisibility("nfd");
        return {
          success: true,
          commandId,
          message: "Visibilitas Diagram Gaya Aksial (NFD) berhasil ditoggle.",
          timestamp,
        };

      case "TOGGLE_DIAGRAM_TFD":
        beamSimulatorActions.toggleDiagramVisibility("tfd");
        return {
          success: true,
          commandId,
          message: "Visibilitas Diagram Momen Torsi (TFD) berhasil ditoggle.",
          timestamp,
        };

      // 4. Diagram Display Modes
      case "SET_DIAGRAM_MODE_IN_PLACE":
        beamSimulatorActions.setDiagramDisplayMode("IN_PLACE_BEAM_AXIS");
        return {
          success: true,
          commandId,
          message: "Mode diagram diubah ke In-Place (Sejajar As Balok).",
          timestamp,
        };

      case "SET_DIAGRAM_MODE_STACKED":
        beamSimulatorActions.setDiagramDisplayMode("STACKED_VERTICAL");
        return {
          success: true,
          commandId,
          message: "Mode diagram diubah ke Vertikal Menurun (Stacked).",
          timestamp,
        };

      case "SET_DIAGRAM_MODE_WINDOW":
        beamSimulatorActions.setDiagramDisplayMode("FLOATING_WINDOW");
        return {
          success: true,
          commandId,
          message: "Mode diagram dialihkan ke Floating Window tersendiri.",
          timestamp,
        };

      // 5. Supports
      case "SET_SUPPORT_CANTILEVER":
        beamSimulatorActions.setSupportOrientation("CANTILEVER_LEFT");
        return {
          success: true,
          commandId,
          message: "Tumpuan diatur menjadi Balok Kantilever (Jepit Kiri - Bebas Kanan).",
          timestamp,
        };

      case "SET_SUPPORT_PINNED_ROLLER":
        beamSimulatorActions.setSupportOrientation("PINNED_ROLLER");
        return {
          success: true,
          commandId,
          message: "Tumpuan diatur menjadi Sederhana (Sendi - Rol).",
          timestamp,
        };

      case "SET_SUPPORT_FIXED_FIXED":
        beamSimulatorActions.setSupportOrientation("FIXED_FIXED");
        return {
          success: true,
          commandId,
          message: "Tumpuan diatur menjadi Jepit - Jepit.",
          timestamp,
        };

      case "SET_SUPPORT_FIXED_ROLLER":
        beamSimulatorActions.setSupportOrientation("FIXED_ROLLER");
        return {
          success: true,
          commandId,
          message: "Tumpuan diatur menjadi Jepit - Rol.",
          timestamp,
        };

      case "SET_SUPPORT_FIXED_PINNED":
        beamSimulatorActions.setSupportOrientation("FIXED_PINNED");
        return {
          success: true,
          commandId,
          message: "Tumpuan diatur menjadi Jepit - Sendi.",
          timestamp,
        };

      // 6. Loading Modes
      case "SWITCH_MODE_EXTERNAL_LOADS":
        beamSimulatorActions.setLoadingMode("MODE_A_EXTERNAL_LOADS");
        return {
          success: true,
          commandId,
          message: "Mode perhitungan dialihkan ke Mode A (Beban Eksternal Nyata).",
          timestamp,
        };

      case "SWITCH_MODE_DIRECT_FORCES":
        beamSimulatorActions.setLoadingMode("MODE_B_DIRECT_INTERNAL_FORCES");
        return {
          success: true,
          commandId,
          message: "Mode perhitungan dialihkan ke Mode B (Gaya Dalam Terfaktor Langsung).",
          timestamp,
        };

      // 7. Numerical Parameters
      case "SET_SPAN_LENGTH": {
        const span = typeof params.spanLengthM === "number" ? params.spanLengthM : 6.0;
        beamSimulatorActions.setSpanLength(span as Meter);
        return {
          success: true,
          commandId,
          message: `Panjang bentang balok diperbarui menjadi ${span.toFixed(2)} meter.`,
          timestamp,
          payload: { spanLengthM: span },
        };
      }

      case "ADD_POINT_LOAD": {
        const snap = getBeamSimulatorSnapshot();
        const mag = typeof params.magnitudeKn === "number" ? params.magnitudeKn : 50;
        const pos = (snap.spanLengthM / 2) as Meter;
        const newLoad = {
          id: `P${snap.pointLoads.length + 1}`,
          magnitude: mag as Kilonewton,
          position: pos,
        };
        beamSimulatorActions.setPointLoads([...snap.pointLoads, newLoad]);
        return {
          success: true,
          commandId,
          message: `Beban titik Pu = ${mag} kN ditambahkan pada posisi tengah bentang (${pos.toFixed(2)} m).`,
          timestamp,
          payload: newLoad,
        };
      }

      case "SET_CONCRETE_FC": {
        const fc = typeof params.fcMpa === "number" ? params.fcMpa : 25;
        beamSimulatorActions.setConcreteParameters({ fcMpa: fc as Megapascal });
        return {
          success: true,
          commandId,
          message: `Kuat tekan beton f'c diatur ke ${fc} MPa.`,
          timestamp,
          payload: { fcMpa: fc },
        };
      }

      case "SET_STEEL_GRADE": {
        const grade = (params.steelGrade as SteelGrade) || "BJ 37";
        beamSimulatorActions.setSteelParameters({ grade });
        return {
          success: true,
          commandId,
          message: `Mutu baja struktural diatur ke ${grade}.`,
          timestamp,
          payload: { steelGrade: grade },
        };
      }

      // 8. Actions & Windows
      case "RUN_OPTIMIZATION":
        beamSimulatorActions.setIsSolving(true);
        return {
          success: true,
          commandId,
          message: "Optimasi penampang SNI sedang dievaluasi ulang...",
          timestamp,
        };

      case "RESET_SIMULATION":
        beamSimulatorActions.setSpanLength(6.0 as Meter);
        beamSimulatorActions.setSupportOrientation("PINNED_ROLLER");
        beamSimulatorActions.setMaterialKind("STEEL");
        return {
          success: true,
          commandId,
          message: "Parameter simulasi balok berhasil dikembalikan ke default.",
          timestamp,
        };

      case "TOGGLE_AI_ASSISTANT":
        floatingWindowActions.toggleWindow("GESTURE_AI_ASSISTANT");
        return {
          success: true,
          commandId,
          message: "Jendela Asisten AI dan Gestur berhasil ditoggle.",
          timestamp,
        };

      case "TOGGLE_CAMERA_PREVIEW": {
        const action = (params?.action as string) || "TOGGLE";
        if (action === "START" || action === "TOGGLE") {
          floatingWindowActions.openWindow("GESTURE_AI_ASSISTANT");
        }
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("app:camera-control", { detail: { action } }));
        }
        return {
          success: true,
          commandId,
          message:
            action === "STOP"
              ? "Kamera webcam berhasil dimatikan."
              : action === "START"
                ? "Kamera webcam berhasil diaktifkan."
                : "Kamera webcam berhasil ditoggle.",
          timestamp,
        };
      }

      case "TOGGLE_ECO_MODE":
        return {
          success: true,
          commandId,
          message: "Mode Eco-Thermal ditoggle.",
          timestamp,
        };

      case "EXPORT_DXF": {
        const store = getBeamSimulatorSnapshot();
        const res = buildDxfFromSimulatorState(store);
        downloadFileBrowser(res.content, res.fileName, res.mimeType);
        return {
          success: true,
          commandId,
          message: `File AutoCAD DXF (${res.fileName}) berhasil diekspor dan diunduh otomatis!`,
          timestamp,
        };
      }

      case "EXPORT_SAP2000": {
        const store = getBeamSimulatorSnapshot();
        const res = buildS2kFromSimulatorState(store);
        downloadFileBrowser(res.content, res.fileName, res.mimeType);
        return {
          success: true,
          commandId,
          message: `Model SAP2000 (${res.fileName}) berhasil diekspor dan diunduh!`,
          timestamp,
        };
      }

      case "EXPORT_IFC": {
        const store = getBeamSimulatorSnapshot();
        const res = buildIfc4FromSimulatorState(store);
        downloadFileBrowser(res.content, res.fileName, res.mimeType);
        return {
          success: true,
          commandId,
          message: `Model BIM IFC4 (${res.fileName}) berhasil diekspor dan diunduh!`,
          timestamp,
        };
      }

      case "EXPORT_IDEA_STATICA": {
        const store = getBeamSimulatorSnapshot();
        const res = buildIdeaOpenModelXmlFromSimulatorState(store);
        downloadFileBrowser(res.content, res.fileName, res.mimeType);
        return {
          success: true,
          commandId,
          message: `Model IDEA StatiCa (${res.fileName}) berhasil diekspor dan diunduh!`,
          timestamp,
        };
      }

      case "EXPORT_SOLIDWORKS_STEP": {
        const store = getBeamSimulatorSnapshot();
        const res = buildStepAp214FromSimulatorState(store);
        downloadFileBrowser(res.content, res.fileName, res.mimeType);
        return {
          success: true,
          commandId,
          message: `Model 3D STEP SolidWorks (${res.fileName}) berhasil diekspor dan diunduh!`,
          timestamp,
        };
      }

      case "TOGGLE_EXPORT_MODAL":
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("app:toggle-export-modal"));
        }
        return {
          success: true,
          commandId,
          message: "Jendela ekspor CAD dibuka.",
          timestamp,
        };

      // 9. Viewport, Camera & 3D Coordinates
      case "SET_VIEW_ISOMETRIC":
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("app:camera-preset", { detail: { preset: "ISOMETRIC_3D" } }),
          );
        }
        return {
          success: true,
          commandId,
          message: "Tampilan viewport dialihkan ke 3D Isometrik.",
          timestamp,
        };

      case "SET_VIEW_FRONT":
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("app:camera-preset", { detail: { preset: "FRONT_2D" } }),
          );
        }
        return {
          success: true,
          commandId,
          message: "Tampilan viewport dialihkan ke Tampak Depan 2D ortogonal.",
          timestamp,
        };

      case "FIT_CAMERA_VIEW":
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("app:camera-fit"));
        }
        return {
          success: true,
          commandId,
          message: "Kamera difokuskan kembali ke seluruh bentang balok (Fit View).",
          timestamp,
        };

      case "SET_CONCRETE_VIEW_SOLID":
        beamSimulatorActions.setConcreteViewMode("SOLID_WITH_END_SECTION");
        return {
          success: true,
          commandId,
          message: "Visualisasi beton diubah ke Mode Solid dengan potongan ujung.",
          timestamp,
        };

      case "SET_CONCRETE_VIEW_WIREFRAME":
        beamSimulatorActions.setConcreteViewMode("WIREFRAME_REBAR_CAGE");
        return {
          success: true,
          commandId,
          message: "Visualisasi beton diubah ke Mode Wireframe Tulangan (Rebar Cage).",
          timestamp,
        };

      case "SET_COORDINATE_Z_UP":
        beamSimulatorActions.setCoordinateMode("Z-Up", { x: 0, y: 0, z: 1 });
        return {
          success: true,
          commandId,
          message: "Sistem koordinat 3D diatur ke Z-Up (Standar Sipil).",
          timestamp,
        };

      case "SET_COORDINATE_Y_UP":
        beamSimulatorActions.setCoordinateMode("Y-Up", { x: 0, y: 1, z: 0 });
        return {
          success: true,
          commandId,
          message: "Sistem koordinat 3D diatur ke Y-Up (Standar CAD/WebGL).",
          timestamp,
        };

      // 10. Floating Windows Management
      case "OPEN_WINDOW": {
        const target = (params?.target as FloatingWindowId) || "GESTURE_AI_ASSISTANT";
        floatingWindowActions.openWindow(target);
        return {
          success: true,
          commandId,
          message: `Jendela ${target} dibuka.`,
          timestamp,
        };
      }

      case "CLOSE_WINDOW": {
        const target = (params?.target as FloatingWindowId) || "GESTURE_AI_ASSISTANT";
        floatingWindowActions.closeWindow(target);
        return {
          success: true,
          commandId,
          message: `Jendela ${target} ditutup.`,
          timestamp,
        };
      }

      case "OPEN_ALL_WINDOWS":
        floatingWindowActions.openAllWindows();
        return {
          success: true,
          commandId,
          message: "Semua jendela kerja dibuka kembali.",
          timestamp,
        };

      case "CLOSE_ALL_WINDOWS":
        floatingWindowActions.closeAllWindows();
        return {
          success: true,
          commandId,
          message: "Semua jendela kerja ditutup untuk tampilan balok penuh.",
          timestamp,
        };

      case "RESET_WINDOWS_LAYOUT":
        floatingWindowActions.resetLayout();
        return {
          success: true,
          commandId,
          message: "Tata letak posisi jendela kerja dikembalikan ke default.",
          timestamp,
        };

      // 11. Load & Dimension Control Actions
      case "ADD_DISTRIBUTED_LOAD": {
        const snap = getBeamSimulatorSnapshot();
        const mag = typeof params.magnitudeKnPerM === "number" ? params.magnitudeKnPerM : 15;
        const newLoad: DistributedLoad = {
          id: `Q${snap.distributedLoads.length + 1}`,
          magnitude: mag as KilonewtonPerMeter,
          startPosition: 0 as Meter,
          endPosition: snap.spanLengthM,
        };
        beamSimulatorActions.setDistributedLoads([...snap.distributedLoads, newLoad]);
        return {
          success: true,
          commandId,
          message: `Beban merata q = ${mag} kN/m berhasil ditambahkan.`,
          timestamp,
          payload: newLoad,
        };
      }

      case "REMOVE_DISTRIBUTED_LOAD": {
        const snap = getBeamSimulatorSnapshot();
        if (snap.distributedLoads.length > 0) {
          beamSimulatorActions.setDistributedLoads(snap.distributedLoads.slice(0, -1));
          return {
            success: true,
            commandId,
            message: "Beban merata terakhir berhasil dihapus.",
            timestamp,
          };
        }
        return {
          success: true,
          commandId,
          message: "Tidak ada beban merata untuk dihapus.",
          timestamp,
        };
      }

      case "REMOVE_POINT_LOAD": {
        const snap = getBeamSimulatorSnapshot();
        if (snap.pointLoads.length > 0) {
          beamSimulatorActions.setPointLoads(snap.pointLoads.slice(0, -1));
          return {
            success: true,
            commandId,
            message: "Beban titik terakhir berhasil dihapus.",
            timestamp,
          };
        }
        return {
          success: true,
          commandId,
          message: "Tidak ada beban titik untuk dihapus.",
          timestamp,
        };
      }

      case "CLEAR_ALL_LOADS": {
        beamSimulatorActions.setPointLoads([]);
        beamSimulatorActions.setDistributedLoads([]);
        return {
          success: true,
          commandId,
          message: "Seluruh beban balok berhasil dibersihkan.",
          timestamp,
        };
      }

      case "TOGGLE_SELF_WEIGHT": {
        const snap = getBeamSimulatorSnapshot();
        const nextVal = !snap.includeSelfWeight;
        beamSimulatorActions.setIncludeSelfWeight(nextVal);
        return {
          success: true,
          commandId,
          message: `Perhitungan berat sendiri balok ${nextVal ? "diaktifkan" : "dinonaktifkan"}.`,
          timestamp,
        };
      }

      case "SET_DEFLECTION_LIMIT": {
        const denom = (params.denominator as 180 | 240 | 360 | 480) || 360;
        beamSimulatorActions.setDeflectionLimitDenominator(denom);
        return {
          success: true,
          commandId,
          message: `Batas lendutan izin balok diatur ke L/${denom}.`,
          timestamp,
        };
      }

      case "SET_CONCRETE_DIMENSIONS": {
        const bw = typeof params.bwMm === "number" ? params.bwMm : 300;
        const h = typeof params.hMm === "number" ? params.hMm : 500;
        beamSimulatorActions.setConcreteParameters({ bwMm: bw, hMm: h });
        return {
          success: true,
          commandId,
          message: `Dimensi balok beton diubah menjadi lebar ${bw} mm dan tinggi ${h} mm.`,
          timestamp,
        };
      }

      case "SELECT_STEEL_PROFILE": {
        const profileName = (params.profileName as string) || "IWF 300x150";
        beamSimulatorActions.setSteelParameters({ selectedProfileName: profileName });
        return {
          success: true,
          commandId,
          message: `Profil penampang baja diatur ke ${profileName}.`,
          timestamp,
        };
      }

      case "MUTE_VOICE_COMMAND": {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("app:voice-mute", { detail: { muted: true } }));
        }
        return {
          success: true,
          commandId,
          message: "Mikrofon dijeda (Mute).",
          timestamp,
        };
      }

      case "UNMUTE_VOICE_COMMAND": {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("app:voice-mute", { detail: { muted: false } }));
        }
        return {
          success: true,
          commandId,
          message: "Mikrofon diaktifkan kembali. Siap menerima perintah suara.",
          timestamp,
        };
      }

      case "AI_CONSULTATION": {
        const spoken =
          typeof params?.spokenConfirmation === "string"
            ? params.spokenConfirmation
            : typeof params?.message === "string"
              ? params.message
              : "Konsultasi Asisten Rekayasa IBDS.";
        return {
          success: true,
          commandId,
          message: spoken,
          timestamp,
        };
      }

      default:
        throw new CommandRegistryError(`CommandId '${commandId}' tidak dikenali.`, commandId);
    }
  } catch (err) {
    if (err instanceof CommandRegistryError) {
      throw err;
    }
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      commandId,
      message: `Gagal mengeksekusi perintah '${commandId}': ${errorMsg}`,
      timestamp,
    };
  }
}

// ============================================================================
// Hook Return Signature & Interface
// ============================================================================

/**
 * Return signature of `useWebSpeechCommand`.
 */
export interface UseWebSpeechCommandResult {
  /** Whether the microphone recognition is currently actively capturing/processing speech. */
  readonly isListening: boolean;
  /** Whether the voice command feature is muted by user choice. */
  readonly isMuted: boolean;
  /** Whether the current browser supports SpeechRecognition. */
  readonly isSupported: boolean;
  /** Last recognized transcript string. */
  readonly transcript: string;
  /** Last executed CommandExecutionResult or null if none executed yet. */
  readonly lastExecution: CommandExecutionResult | null;
  /** Curated suggestions when a command is unrecognized. */
  readonly suggestions: readonly string[];
  /** Human-readable status or feedback toast message. */
  readonly feedbackMessage: string;
  /** Error message if SpeechRecognition encounters an issue. */
  readonly error: string | null;
  /** Toggles speech recognition mute state on and off. */
  readonly toggleListening: () => void;
  /** Explicitly sets voice command mute state. */
  readonly setMuted: (muted: boolean) => void;
  /** Triggers a procedural Web Audio chime test to verify speaker and audio context. */
  readonly testAudioTone: (type?: AudioChimeType) => void;
  /** Explicit programmatic execution of a CommandId. */
  readonly executeCommand: (
    commandId: CommandId,
    params?: Record<string, unknown>,
  ) => CommandExecutionResult;
  /** Programmatic execution from raw text transcript with auto-speech feedback. */
  readonly executeTranscript: (text: string) => CommandExecutionResult | null;
  /** Helper to trigger Gemini Live speech synthesis feedback directly. */
  readonly speakFeedback: (text: string) => void | Promise<void>;
}

/**
 * Configuration options for `useWebSpeechCommand`.
 */
export interface UseWebSpeechCommandOptions {
  /** Recognition language (default: 'id-ID'). */
  readonly language?: "id-ID" | "en-US";
  /** Whether to play synthesized audio chimes on recognitions (default: true). */
  readonly playAudioFeedback?: boolean;
  /** Callback fired after each command dispatch. */
  readonly onCommandExecuted?: (result: CommandExecutionResult) => void;
  /** Whether to automatically activate listening on mount / user interaction (default: true). */
  readonly autoStart?: boolean;
  /** Whether to continuously auto-restart recognition when it pauses or idles (default: true). */
  readonly continuousListening?: boolean;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * React hook connecting Web Speech API voice dictation to the Structural Simulator Command Registry.
 *
 * @param options Optional hook configuration.
 * @returns {@link UseWebSpeechCommandResult}
 * @example
 * const { isListening, transcript, toggleListening } = useWebSpeechCommand();
 */
export function useWebSpeechCommand(
  options: UseWebSpeechCommandOptions = {},
): UseWebSpeechCommandResult {
  const language = options.language ?? "id-ID";
  const playAudioFeedback = options.playAudioFeedback ?? true;
  const autoStart = options.autoStart ?? true;
  const continuousListening = options.continuousListening ?? true;

  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(!autoStart);
  const [transcript, setTranscript] = useState<string>("");
  const [suggestions, setSuggestions] = useState<readonly string[]>([
    "Lihat tampak depan 2D",
    "Tampilkan wireframe tulangan",
    "Tambah beban merata 20 kN/m",
    "Ekspor ke AutoCAD DXF",
  ]);
  const [lastExecution, setLastExecution] = useState<CommandExecutionResult | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string>(
    autoStart
      ? "🎙️ Selalu Mendengarkan... Siap menerima perintah suara."
      : "Mikrofon dijeda (Mute). Katakan 'halo cuy', 'oi cuy', 'hey cuy', 'woi cuy' atau tepuk 2x untuk mengaktifkan.",
  );
  const [error, setError] = useState<string | null>(null);

  // We type recognition instance loosely as unknown since SpeechRecognition is non-standard across browsers
  const recognitionRef = useRef<unknown>(null);
  const clapDetectorRef = useRef<BrowserClapDetector | null>(null);
  const isMutedRef = useRef<boolean>(!autoStart);
  const isRunningRef = useRef<boolean>(false);
  const isStartingRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const retryCountRef = useRef<number>(0);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listeningGraceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didPlayStopToneRef = useRef<boolean>(false);

  // Acoustic echo loop prevention refs
  const isAcousticOutputActiveRef = useRef<boolean>(false);
  const lastAcousticOutputEndTimeRef = useRef<number>(0);
  const lastSpokenTextRef = useRef<string>("");

  // Store options in a ref so closures always access the freshest callbacks/settings without breaking memoization
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Programmatic command runner - fully memoized with stable deps to prevent effect teardown loops
  const executeCommand = useCallback(
    (commandId: CommandId, params?: Record<string, unknown>): CommandExecutionResult => {
      const result = executeRegistryCommand(commandId, params);
      setLastExecution(result);
      setFeedbackMessage(result.message);

      if (optionsRef.current.playAudioFeedback ?? true) {
        synthesizeAudioTone(result.success ? "SUCCESS" : "FAILURE");
      }

      if (optionsRef.current.onCommandExecuted) {
        optionsRef.current.onCommandExecuted(result);
      }

      return result;
    },
    [],
  );

  // Executes multiple command actions sequentially when user requests multiple tasks in one utterance
  const executeBatch = useCallback((match: IntentRouterResult): CommandExecutionResult => {
    const actions =
      Array.isArray(match.actions) && match.actions.length > 0
        ? match.actions
        : [{ commandId: match.commandId, extractedParameters: match.extractedParameters }];

    const results: CommandExecutionResult[] = [];
    for (const act of actions) {
      const res = executeRegistryCommand(act.commandId, act.extractedParameters);
      results.push(res);
      if (optionsRef.current.onCommandExecuted) {
        optionsRef.current.onCommandExecuted(res);
      }
    }

    const allSuccess = results.every((r) => r.success);
    const lastResult = results[results.length - 1];

    let combinedMessage: string;
    if (actions.length > 1) {
      const successCount = results.filter((r) => r.success).length;
      combinedMessage = `Berhasil menjalankan ${successCount} dari ${actions.length} aksi: ${results.map((r) => r.message).join(" | ")}`;
    } else {
      combinedMessage = lastResult?.message || "Perintah berhasil dijalankan.";
    }

    const compositeResult: CommandExecutionResult = {
      success: allSuccess,
      commandId: lastResult?.commandId || match.commandId,
      message: combinedMessage,
      timestamp: Date.now(),
      payload: { results },
    };

    setLastExecution(compositeResult);
    setFeedbackMessage(combinedMessage);

    if (optionsRef.current.playAudioFeedback ?? true) {
      synthesizeAudioTone(allSuccess ? "SUCCESS" : "FAILURE");
    }

    return compositeResult;
  }, []);

  // Test procedural audio chime helper
  const testAudioTone = useCallback((type: AudioChimeType = "SUCCESS"): void => {
    synthesizeAudioTone(type);
    setFeedbackMessage(
      type === "SUCCESS"
        ? "🔊 Uji Bunyi Audio: Berhasil (Arpeggio C5-G5)!"
        : `🔊 Uji Bunyi Audio: ${type}`,
    );
  }, []);

  // Asynchronously queries Gemini AI to generate fluid, context-aware command suggestions
  const refreshAiSuggestions = useCallback(async (currentTranscript: string) => {
    try {
      const snap = getBeamSimulatorSnapshot();
      const res = await fetch("/api/ai/intent-router", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: currentTranscript,
          currentState: {
            materialKind: snap.materialKind,
            spanLengthM: snap.spanLengthM,
            supportOrientation: snap.supportOrientation,
            pointLoadsCount: snap.pointLoads.length,
            distributedLoadsCount: snap.distributedLoads.length,
            concreteViewMode: snap.concreteViewMode,
            maxDeflectionMm: snap.maxDeflectionMm,
          },
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as IntentRouterResult;
        if (Array.isArray(data?.suggestions) && data.suggestions.length > 0) {
          setSuggestions(data.suggestions);
        }
      }
    } catch {
      // Keep existing suggestions on error
    }
  }, []);

  // Safe starter wrapper avoiding browser race conditions and InvalidStateError
  const safeStart = useCallback((): void => {
    if (!isMountedRef.current) return;
    if (isAcousticOutputActiveRef.current || isGeminiAudioCurrentlyPlaying()) return;
    const rec = recognitionRef.current as { start?: () => void } | null;
    if (!rec || typeof rec.start !== "function") return;

    if (isRunningRef.current || isStartingRef.current) return;

    isStartingRef.current = true;
    try {
      rec.start();
    } catch (err: unknown) {
      isStartingRef.current = false;
      const errorMsg = err instanceof Error ? err.message : String(err);
      const isAlreadyRunning =
        errorMsg.includes("already started") ||
        (err instanceof Error && err.name === "InvalidStateError");

      if (isAlreadyRunning) {
        if (retryCountRef.current < 5) {
          retryCountRef.current++;
          if (retryStartTimerRef.current) clearTimeout(retryStartTimerRef.current);
          retryStartTimerRef.current = setTimeout(() => {
            if (
              !isRunningRef.current &&
              !isStartingRef.current &&
              !isAcousticOutputActiveRef.current &&
              isMountedRef.current
            ) {
              safeStart();
            }
          }, 200);
        }
      }
    }
  }, []);

  // Pause STT while Gemini Live speaks (adapted from stopSttListening in prototype/voice-command/public/app.js)
  const pauseSttForPlayback = useCallback((): void => {
    isAcousticOutputActiveRef.current = true;
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    if (retryStartTimerRef.current) clearTimeout(retryStartTimerRef.current);
    const rec = recognitionRef.current as { abort?: () => void; stop?: () => void } | null;
    if (rec && isRunningRef.current) {
      try {
        if (typeof rec.abort === "function") {
          rec.abort();
        } else if (typeof rec.stop === "function") {
          rec.stop();
        }
      } catch {
        // Ignore abort error
      }
    }
  }, []);

  // Resume STT after Gemini Live 24kHz PCM playback has completely finished
  const resumeSttAfterPlayback = useCallback((): void => {
    isAcousticOutputActiveRef.current = false;
    lastAcousticOutputEndTimeRef.current = Date.now();
    if (isMountedRef.current) {
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      restartTimerRef.current = setTimeout(() => {
        if (!isAcousticOutputActiveRef.current && isMountedRef.current) {
          safeStart();
        }
      }, 350);
    }
  }, [safeStart]);

  // Check browser support and initialize SpeechRecognition
  useEffect(() => {
    isMountedRef.current = true;
    if (typeof window === "undefined") return;

    // Warm up Gemini 3.8 Live BidiGenerateContent WebSocket in background
    void ensureGeminiLiveBidiWebSocket();

    // Browser SpeechRecognition constructor resolution
    const SpeechRec =
      (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;

    if (!SpeechRec) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    type RecInstance = {
      lang: string;
      continuous: boolean;
      interimResults: boolean;
      onstart: () => void;
      onend: () => void;
      onerror: (event: { error: string }) => void;
      onresult: (event: {
        results: { [index: number]: { [index: number]: { transcript: string } }; length: number };
      }) => void;
      start: () => void;
      stop: () => void;
      abort?: () => void;
    };

    let recognition: RecInstance;
    try {
      recognition = new (SpeechRec as new () => RecInstance)();
    } catch (recInitErr) {
      const errMsg = recInitErr instanceof Error ? recInitErr.message : String(recInitErr);
      setError(`Failed to init SpeechRecognition: ${errMsg}`);
      return;
    }

    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onstart = () => {
      if (!isMountedRef.current) return;
      isRunningRef.current = true;
      isStartingRef.current = false;
      retryCountRef.current = 0;

      if (listeningGraceTimerRef.current) {
        clearTimeout(listeningGraceTimerRef.current);
        listeningGraceTimerRef.current = null;
      }

      // If user is in muted/standby mode, keep listening in background for wake words
      if (isMutedRef.current) {
        setIsListening(false);
        return;
      }

      setIsListening(true);
      setError(null);
      setFeedbackMessage("🎙️ Selalu Mendengarkan... Silakan ucapkan perintah.");
    };

    recognition.onend = () => {
      if (!isMountedRef.current) return;
      isRunningRef.current = false;
      isStartingRef.current = false;

      // If continuous listening is disabled, transition to stopped immediately
      if (!continuousListening) {
        setIsListening(false);
        return;
      }

      // Do not restart while Gemini Live audio is actively playing through speakers
      if (isAcousticOutputActiveRef.current || isGeminiAudioCurrentlyPlaying()) {
        return;
      }

      // Continuous loop:
      // Chrome fires onend periodically on pauses in speech and after recognition results.
      // Schedule seamless silent restart in both active and standby wake-word modes.
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      restartTimerRef.current = setTimeout(() => {
        if (!isAcousticOutputActiveRef.current && isMountedRef.current) {
          safeStart();
        }
      }, 150);

      // Grace period fallback: only if recognition fails to restart within 3s, drop isListening to false
      if (listeningGraceTimerRef.current) clearTimeout(listeningGraceTimerRef.current);
      listeningGraceTimerRef.current = setTimeout(() => {
        if (!isRunningRef.current && isMountedRef.current) {
          setIsListening(false);
        }
      }, 3000);
    };

    recognition.onerror = (evt) => {
      if (!isMountedRef.current) return;
      isStartingRef.current = false;

      if (evt.error === "no-speech") {
        // Normal pause in speech in Chrome - continuous loop will restart smoothly via onend
        return;
      }
      if (evt.error === "aborted") {
        // Normal result of calling recognition.abort() during mute or teardown
        return;
      }
      if (evt.error === "not-allowed") {
        isMutedRef.current = true;
        setIsMuted(true);
        isRunningRef.current = false;
        setIsListening(false);
        setError("Akses mikrofon ditolak oleh browser. Izinkan mikrofon di address bar.");
        return;
      }
      if (evt.error === "audio-capture") {
        isMutedRef.current = true;
        setIsMuted(true);
        isRunningRef.current = false;
        setIsListening(false);
        setError("Mikrofon tidak terdeteksi atau sedang digunakan aplikasi lain.");
        return;
      }
      if (evt.error === "service-not-allowed") {
        isMutedRef.current = true;
        setIsMuted(true);
        isRunningRef.current = false;
        setIsListening(false);
        setError("Layanan Web Speech API diblokir oleh browser.");
        return;
      }
      if (evt.error === "network") {
        setError("Layanan pengenalan suara memerlukan koneksi internet aktif.");
        return;
      }

      setError(`Speech error: ${evt.error}`);
    };

    recognition.onresult = (evt) => {
      if (!isMountedRef.current) return;
      const lastIndex = evt.results.length - 1;
      const text = evt.results[lastIndex]?.[0]?.transcript.trim() ?? "";
      if (!text) return;

      // Anti-loop 1: Discard any transcript while Gemini Live audio is actively playing
      if (isAcousticOutputActiveRef.current || isGeminiAudioCurrentlyPlaying()) {
        return;
      }

      // Anti-loop 2: Discard any transcript within acoustic echo cooldown (1500ms after audio playback ends)
      if (Date.now() - lastAcousticOutputEndTimeRef.current < 1500) {
        return;
      }

      // If in standby/muted mode: ONLY listen for wake words ("halo cuy", "oi cuy", "hey cuy", "woi cuy")
      if (isMutedRef.current) {
        const wake = matchWakeWord(text);
        if (wake.matched) {
          isMutedRef.current = false;
          setIsMuted(false);
          setIsListening(true);
          didPlayStopToneRef.current = false;

          if (optionsRef.current.playAudioFeedback ?? true) {
            synthesizeAudioTone("START");
          }

          const wakeWordDisplay = wake.wakeWord ?? "halo cuy";
          const greeting =
            wakeWordDisplay === "oi cuy"
              ? "Oi cuy!"
              : wakeWordDisplay === "hey cuy"
                ? "Hey cuy!"
                : wakeWordDisplay === "woi cuy"
                  ? "Woi cuy!"
                  : "Halo cuy!";

          setTranscript(text);

          // If user uttered a compound instruction with wake word, e.g. "halo cuy ubah ke baja"
          if (wake.remainingText) {
            const remainingMatch = routeVoiceTranscriptToCommand(wake.remainingText);
            if (remainingMatch) {
              setSuggestions(
                remainingMatch.suggestions && remainingMatch.suggestions.length > 0
                  ? remainingMatch.suggestions
                  : generateContextualSuggestions(remainingMatch.commandId),
              );
              const result = executeBatch(remainingMatch);
              const replyText = `${greeting} ${remainingMatch.spokenConfirmation || result.message}`;
              lastSpokenTextRef.current = replyText;
              setFeedbackMessage(`🎙️ ${replyText}`);
              void speakGeminiLiveResponse(replyText, pauseSttForPlayback, resumeSttAfterPlayback);
              void refreshAiSuggestions(wake.remainingText);
              return;
            }
          }

          // Pure wake word activation
          const confirmMsg = `${greeting} Voice command aktif, siap menerima perintah.`;
          lastSpokenTextRef.current = confirmMsg;
          setFeedbackMessage(`🎙️ ${confirmMsg}`);
          void speakGeminiLiveResponse(confirmMsg, pauseSttForPlayback, resumeSttAfterPlayback);
          setSuggestions([
            "Beralih ke material baja",
            "Ubah ke beton bertulang",
            "Tampilkan diagram momen BMD",
            "Atur panjang balok 6 meter",
          ]);
        }
        return;
      }

      setTranscript(text);

      const match = routeVoiceTranscriptToCommand(text);
      if (match) {
        if (match.suggestions && match.suggestions.length > 0) {
          setSuggestions(match.suggestions);
        } else {
          setSuggestions(generateContextualSuggestions(match.commandId));
        }

        const result = executeBatch(match);
        const replyText = match.spokenConfirmation || result.message;
        lastSpokenTextRef.current = replyText;
        void speakGeminiLiveResponse(replyText, pauseSttForPlayback, resumeSttAfterPlayback);

        // Concurrently query Gemini API for next-step fluid AI suggestions
        void refreshAiSuggestions(text);
      } else {
        // Fallback: asynchronously check Gemini intent router API if rule didn't match
        void (async () => {
          try {
            const snap = getBeamSimulatorSnapshot();
            const apiRes = await fetch("/api/ai/intent-router", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                transcript: text,
                currentState: {
                  materialKind: snap.materialKind,
                  spanLengthM: snap.spanLengthM,
                  supportOrientation: snap.supportOrientation,
                  pointLoadsCount: snap.pointLoads.length,
                  distributedLoadsCount: snap.distributedLoads.length,
                  concreteViewMode: snap.concreteViewMode,
                  maxDeflectionMm: snap.maxDeflectionMm,
                },
              }),
            });
            if (apiRes.ok) {
              const apiMatch = (await apiRes.json()) as IntentRouterResult;
              if (
                apiMatch &&
                (apiMatch.confidence > 0.6 ||
                  apiMatch.commandId === "AI_CONSULTATION" ||
                  Boolean(apiMatch.spokenConfirmation))
              ) {
                if (apiMatch.suggestions && apiMatch.suggestions.length > 0) {
                  setSuggestions(apiMatch.suggestions);
                } else if (apiMatch.commandId) {
                  setSuggestions(generateContextualSuggestions(apiMatch.commandId));
                }

                let replyText = apiMatch.spokenConfirmation;
                if (apiMatch.commandId && apiMatch.commandId !== "AI_CONSULTATION") {
                  const result = executeBatch(apiMatch);
                  replyText = apiMatch.spokenConfirmation || result.message;
                } else if (!replyText) {
                  replyText = "Pertanyaan Anda telah dicatat oleh sistem IBDS.";
                }

                lastSpokenTextRef.current = replyText;
                setFeedbackMessage(`💬 ${replyText}`);
                void speakGeminiLiveResponse(
                  replyText,
                  pauseSttForPlayback,
                  resumeSttAfterPlayback,
                );
                return;
              }

              // Conversational/unmatched: update fluid suggestions from Gemini!
              if (apiMatch?.suggestions && apiMatch.suggestions.length > 0) {
                setSuggestions(apiMatch.suggestions);
                setFeedbackMessage(`💬 ${apiMatch.message || text}`);
                return;
              }
            }
          } catch {
            // Ignore fetch error
          }

          // Unrecognized command: Update suggestions on HUD quietly.
          // NEVER speak "perintah tidak dikenali" loudly via speaker, which prevents endless self-echo loops!
          const reco = getCommandSuggestions(text, 4);
          setSuggestions(reco);
          setFeedbackMessage(`Perintah tidak dikenali: "${text}"`);
          if (optionsRef.current.playAudioFeedback ?? true) {
            synthesizeAudioTone("FAILURE");
          }
        })();
      }
    };

    recognitionRef.current = recognition;

    // Initialize Clap Detector for hands-free double clap activation
    const clapDetector = new BrowserClapDetector();
    clapDetectorRef.current = clapDetector;

    const handleDoubleClap = (): void => {
      if (!isMountedRef.current) return;
      if (isAcousticOutputActiveRef.current || isGeminiAudioCurrentlyPlaying()) return;
      if (Date.now() - lastAcousticOutputEndTimeRef.current < 1500) return;

      // When voice command is off/muted: double clap activates it!
      if (isMutedRef.current) {
        isMutedRef.current = false;
        setIsMuted(false);
        setIsListening(true);
        didPlayStopToneRef.current = false;

        if (optionsRef.current.playAudioFeedback ?? true) {
          synthesizeAudioTone("START");
        }

        const confirmMsg =
          "Dua kali tepuk terdeteksi! Voice command aktif, siap menerima perintah.";
        lastSpokenTextRef.current = confirmMsg;
        setTranscript("👏 [Dua kali tepuk]");
        setFeedbackMessage(`👏 ${confirmMsg}`);
        void speakGeminiLiveResponse(confirmMsg, pauseSttForPlayback, resumeSttAfterPlayback);
        setSuggestions([
          "Beralih ke material baja",
          "Ubah ke beton bertulang",
          "Tampilkan diagram momen BMD",
          "Atur bentang balok 8 meter",
        ]);

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("app:voice-mute", { detail: { muted: false } }));
        }
      }
    };

    void clapDetector.start(
      handleDoubleClap,
      () => isAcousticOutputActiveRef.current || isGeminiAudioCurrentlyPlaying(),
    );

    // Gesture fallback listener handlers defined so they can be cleaned up
    const onFirstInteraction = (): void => {
      if (isMountedRef.current) {
        safeStart();
        if (clapDetectorRef.current && !clapDetectorRef.current.isActive) {
          void clapDetectorRef.current.start(
            handleDoubleClap,
            () => isAcousticOutputActiveRef.current || isGeminiAudioCurrentlyPlaying(),
          );
        }
        const ctx = getAudioContext();
        if (ctx && ctx.state === "suspended") {
          void ctx.resume();
        }
        const playCtx = getPlaybackContext();
        if (playCtx && playCtx.state === "suspended") {
          void playCtx.resume();
        }
      }
    };

    // Auto start on mount or interaction
    safeStart();
    window.addEventListener("pointerdown", onFirstInteraction, { once: true });
    window.addEventListener("keydown", onFirstInteraction, { once: true });

    return () => {
      isMountedRef.current = false;
      window.removeEventListener("pointerdown", onFirstInteraction);
      window.removeEventListener("keydown", onFirstInteraction);
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      if (retryStartTimerRef.current) clearTimeout(retryStartTimerRef.current);
      if (listeningGraceTimerRef.current) clearTimeout(listeningGraceTimerRef.current);

      if (clapDetectorRef.current) {
        clapDetectorRef.current.destroy();
        clapDetectorRef.current = null;
      }

      const rec = recognitionRef.current as { abort?: () => void; stop?: () => void } | null;
      if (rec) {
        try {
          if (typeof rec.abort === "function") {
            rec.abort();
          } else if (typeof rec.stop === "function") {
            rec.stop();
          }
        } catch {
          // Ignore error on teardown
        }
      }
    };
  }, [
    autoStart,
    continuousListening,
    executeCommand,
    language,
    pauseSttForPlayback,
    resumeSttAfterPlayback,
    safeStart,
  ]);

  // Set mute state handler with standby wake-word support
  const setMuted = useCallback(
    (muted: boolean): void => {
      if (!isSupported) {
        setError(
          "Web Speech API tidak didukung pada browser ini (gunakan Chromium / Chrome / Edge).",
        );
        return;
      }

      isMutedRef.current = muted;
      setIsMuted(muted);

      if (muted) {
        if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
        if (retryStartTimerRef.current) clearTimeout(retryStartTimerRef.current);
        if (listeningGraceTimerRef.current) clearTimeout(listeningGraceTimerRef.current);

        isStartingRef.current = false;
        isRunningRef.current = false;
        setIsListening(false);

        // Immediate single acoustic cue
        if (optionsRef.current.playAudioFeedback ?? true) {
          synthesizeAudioTone("STOP");
          didPlayStopToneRef.current = true;
        }

        setFeedbackMessage(
          "Mikrofon dijeda (Mute). Katakan 'halo cuy', 'oi cuy', 'hey cuy', 'woi cuy' atau tepuk 2x untuk mengaktifkan.",
        );

        // Keep STT running in background standby mode so it can capture wake words!
        safeStart();
      } else {
        didPlayStopToneRef.current = false;
        if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
        if (retryStartTimerRef.current) clearTimeout(retryStartTimerRef.current);
        if (listeningGraceTimerRef.current) clearTimeout(listeningGraceTimerRef.current);

        if (optionsRef.current.playAudioFeedback ?? true) {
          synthesizeAudioTone("START");
        }

        setIsListening(true);
        setFeedbackMessage("🎙️ Selalu Mendengarkan... Silakan ucapkan perintah.");
        safeStart();
      }
    },
    [isSupported, safeStart],
  );

  // Toggle listening handler
  const toggleListening = useCallback((): void => {
    setMuted(!isMutedRef.current);
  }, [setMuted]);

  // Synchronize external voice-mute events (e.g. from MUTE_VOICE_COMMAND / UNMUTE_VOICE_COMMAND)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleVoiceMute = (e: Event) => {
      const detail = (e as CustomEvent<{ muted: boolean }>).detail;
      if (detail && typeof detail.muted === "boolean") {
        setMuted(detail.muted);
      }
    };
    window.addEventListener("app:voice-mute", handleVoiceMute);
    return () => window.removeEventListener("app:voice-mute", handleVoiceMute);
  }, [setMuted]);

  // Execute command directly from text transcript (e.g. from suggestion chips)
  const executeTranscript = useCallback(
    (text: string): CommandExecutionResult | null => {
      const trimmed = text.trim();
      if (!trimmed) return null;
      setTranscript(trimmed);
      const match = routeVoiceTranscriptToCommand(trimmed);
      if (match) {
        if (match.suggestions && match.suggestions.length > 0) {
          setSuggestions(match.suggestions);
        } else {
          setSuggestions(generateContextualSuggestions(match.commandId));
        }

        const result = executeBatch(match);
        const replyText = match.spokenConfirmation || result.message;
        lastSpokenTextRef.current = replyText;
        void speakGeminiLiveResponse(replyText, pauseSttForPlayback, resumeSttAfterPlayback);

        // Fluid dynamic suggestions refresh with Gemini
        void refreshAiSuggestions(trimmed);
        return result;
      } else {
        void (async () => {
          try {
            const snap = getBeamSimulatorSnapshot();
            const apiRes = await fetch("/api/ai/intent-router", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                transcript: trimmed,
                currentState: {
                  materialKind: snap.materialKind,
                  spanLengthM: snap.spanLengthM,
                  supportOrientation: snap.supportOrientation,
                },
              }),
            });
            if (apiRes.ok) {
              const apiMatch = (await apiRes.json()) as IntentRouterResult;
              if (
                apiMatch &&
                (apiMatch.confidence > 0.6 ||
                  apiMatch.commandId === "AI_CONSULTATION" ||
                  Boolean(apiMatch.spokenConfirmation))
              ) {
                if (apiMatch.suggestions && apiMatch.suggestions.length > 0) {
                  setSuggestions(apiMatch.suggestions);
                } else if (apiMatch.commandId) {
                  setSuggestions(generateContextualSuggestions(apiMatch.commandId));
                }

                let replyText = apiMatch.spokenConfirmation;
                if (apiMatch.commandId && apiMatch.commandId !== "AI_CONSULTATION") {
                  const res = executeBatch(apiMatch);
                  replyText = apiMatch.spokenConfirmation || res.message;
                } else if (!replyText) {
                  replyText = "Pertanyaan Anda telah dicatat oleh sistem IBDS.";
                }

                lastSpokenTextRef.current = replyText;
                setFeedbackMessage(`💬 ${replyText}`);
                void speakGeminiLiveResponse(
                  replyText,
                  pauseSttForPlayback,
                  resumeSttAfterPlayback,
                );
                return;
              }
              if (apiMatch?.suggestions && apiMatch.suggestions.length > 0) {
                setSuggestions(apiMatch.suggestions);
                setFeedbackMessage(`💬 ${apiMatch.message || trimmed}`);
                return;
              }
            }
          } catch {
            const reco = getCommandSuggestions(trimmed, 4);
            setSuggestions(reco);
          }
        })();

        const reco = getCommandSuggestions(trimmed, 4);
        setSuggestions(reco);
        setFeedbackMessage(`Perintah tidak dikenali: "${trimmed}"`);
        if (optionsRef.current.playAudioFeedback ?? true) {
          synthesizeAudioTone("FAILURE");
        }
        return null;
      }
    },
    [executeCommand, pauseSttForPlayback, refreshAiSuggestions, resumeSttAfterPlayback],
  );

  return {
    isListening,
    isMuted,
    isSupported,
    transcript,
    lastExecution,
    feedbackMessage,
    suggestions,
    error,
    toggleListening,
    setMuted,
    testAudioTone,
    executeCommand,
    executeTranscript,
    speakFeedback: speakGeminiLiveResponse,
  };
}

export default useWebSpeechCommand;
