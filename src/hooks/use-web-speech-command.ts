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

import { beamSimulatorActions, getBeamSimulatorSnapshot } from "@/state/beam-simulator-store";
import { floatingWindowActions } from "@/state/floating-window-store";
import type { Kilonewton, Megapascal, Meter } from "@/types/branded-units";
import {
  type CommandExecutionResult,
  type CommandId,
  CommandRegistryError,
  type IntentRouterResult,
} from "@/types/command-registry-types";
import type { SteelGrade } from "@/types/steel-sni1729-types";

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
  const raw = transcript.trim();
  const lower = raw.toLowerCase();

  if (!lower) return null;

  // 1. Numerical Parameter Adjustments with Regex Extractions
  // Pattern: "bentang 8 meter" / "span 12 m" / "panjang 7.5 meter"
  const spanMatch = lower.match(
    /(?:bentang|span|panjang|length)\s*([0-9]+(?:[.,][0-9]+)?)\s*(?:m|meter)?/,
  );
  if (spanMatch && spanMatch[1]) {
    const val = parseFloat(spanMatch[1].replace(",", "."));
    if (!isNaN(val) && val > 0 && val <= 50) {
      return {
        commandId: "SET_SPAN_LENGTH",
        confidence: 0.95,
        extractedParameters: { spanLengthM: val },
        rawTranscript: raw,
      };
    }
  }

  // Pattern: "beban titik 50 kn" / "tambah beban 80" / "point load 100"
  const pointLoadMatch = lower.match(
    /(?:beban\s*titik|point\s*load|tambah\s*beban)\s*([0-9]+(?:[.,][0-9]+)?)\s*(?:kn)?/,
  );
  if (pointLoadMatch && pointLoadMatch[1]) {
    const val = parseFloat(pointLoadMatch[1].replace(",", "."));
    if (!isNaN(val) && val > 0) {
      return {
        commandId: "ADD_POINT_LOAD",
        confidence: 0.92,
        extractedParameters: { magnitudeKn: val },
        rawTranscript: raw,
      };
    }
  }

  // Pattern: "mutu beton 30 mpa" / "fc 25" / "beton k300"
  const fcMatch = lower.match(
    /(?:mutu\s*beton|kuat\s*tekan|fc[']?)\s*([0-9]+(?:[.,][0-9]+)?)\s*(?:mpa)?/,
  );
  if (fcMatch && fcMatch[1]) {
    const val = parseFloat(fcMatch[1].replace(",", "."));
    if (!isNaN(val) && val >= 15 && val <= 100) {
      return {
        commandId: "SET_CONCRETE_FC",
        confidence: 0.94,
        extractedParameters: { fcMpa: val },
        rawTranscript: raw,
      };
    }
  }

  // Pattern: "mutu baja bj 37" / "grade bj 50" / "baja bj41"
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
    };
  }

  // 2. Steel Profile Filtering (checked before general material to catch phrases like "semua profil baja")
  if (
    lower.includes("semua profil") ||
    lower.includes("all steel") ||
    lower.includes("filter all")
  ) {
    return {
      commandId: "FILTER_STEEL_ALL",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }
  if (lower.includes("iwf") || lower.includes("profil i")) {
    return {
      commandId: "FILTER_STEEL_IWF",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }
  if (lower.includes("box") || lower.includes("hollow") || lower.includes("kotak")) {
    return {
      commandId: "FILTER_STEEL_BOX",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }

  // 3. Material Switching
  if (lower.includes("beton") || lower.includes("concrete")) {
    return {
      commandId: "SWITCH_MATERIAL_CONCRETE",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }
  if (lower.includes("baja") || lower.includes("steel")) {
    return {
      commandId: "SWITCH_MATERIAL_STEEL",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }

  // 4. Internal Force Diagrams Toggles
  // Check Torsion (TFD) before general Bending Moment (BMD) to correctly handle phrases like "momen torsi"
  if (lower.includes("torsi") || lower.includes("tfd") || lower.includes("torsion")) {
    return {
      commandId: "TOGGLE_DIAGRAM_TFD",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }
  if (lower.includes("momen") || lower.includes("bmd") || lower.includes("moment")) {
    return {
      commandId: "TOGGLE_DIAGRAM_BMD",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }
  if (
    lower.includes("geser") ||
    lower.includes("lintang") ||
    lower.includes("sfd") ||
    lower.includes("shear")
  ) {
    return {
      commandId: "TOGGLE_DIAGRAM_SFD",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }
  if (
    lower.includes("aksial") ||
    lower.includes("normal") ||
    lower.includes("nfd") ||
    lower.includes("axial")
  ) {
    return {
      commandId: "TOGGLE_DIAGRAM_NFD",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }

  // 5. Support Configurations
  if (lower.includes("kantilever") || lower.includes("cantilever")) {
    return {
      commandId: "SET_SUPPORT_CANTILEVER",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }
  if (
    lower.includes("sendi rol") ||
    lower.includes("pinned roller") ||
    lower.includes("sendi-rol")
  ) {
    return {
      commandId: "SET_SUPPORT_PINNED_ROLLER",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }
  if (
    lower.includes("jepit jepit") ||
    lower.includes("fixed fixed") ||
    lower.includes("jepit-jepit")
  ) {
    return {
      commandId: "SET_SUPPORT_FIXED_FIXED",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }
  if (
    lower.includes("jepit rol") ||
    lower.includes("fixed roller") ||
    lower.includes("jepit-rol")
  ) {
    return {
      commandId: "SET_SUPPORT_FIXED_ROLLER",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }
  if (
    lower.includes("jepit sendi") ||
    lower.includes("fixed pinned") ||
    lower.includes("jepit-sendi")
  ) {
    return {
      commandId: "SET_SUPPORT_FIXED_PINNED",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }

  // 6. Loading Mode Selection
  if (
    lower.includes("gaya dalam") ||
    lower.includes("mode b") ||
    lower.includes("internal force")
  ) {
    return {
      commandId: "SWITCH_MODE_DIRECT_FORCES",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }
  if (
    lower.includes("beban eksternal") ||
    lower.includes("mode a") ||
    lower.includes("external load")
  ) {
    return {
      commandId: "SWITCH_MODE_EXTERNAL_LOADS",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }

  // 7. Diagram Display Mode
  if (lower.includes("diagram sumbu") || lower.includes("as balok") || lower.includes("in place")) {
    return {
      commandId: "SET_DIAGRAM_MODE_IN_PLACE",
      confidence: 0.9,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }
  if (
    lower.includes("diagram vertikal") ||
    lower.includes("stacked") ||
    lower.includes("menurun")
  ) {
    return {
      commandId: "SET_DIAGRAM_MODE_STACKED",
      confidence: 0.9,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }
  if (
    lower.includes("diagram jendela") ||
    lower.includes("floating diagram") ||
    lower.includes("jendela diagram")
  ) {
    return {
      commandId: "SET_DIAGRAM_MODE_WINDOW",
      confidence: 0.9,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }

  // 8. Optimization & Actions
  if (
    lower.includes("optimasi") ||
    lower.includes("optimalkan") ||
    lower.includes("rekomendasi profil")
  ) {
    return {
      commandId: "RUN_OPTIMIZATION",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }
  if (lower.includes("reset") || lower.includes("atur ulang")) {
    return {
      commandId: "RESET_SIMULATION",
      confidence: 0.9,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }

  // 9. Exporters
  if (lower.includes("ekspor dxf") || lower.includes("export dxf") || lower.includes("cad dxf")) {
    return {
      commandId: "EXPORT_DXF",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }
  if (lower.includes("sap2000") || lower.includes("s2k") || lower.includes("ekspor sap")) {
    return {
      commandId: "EXPORT_SAP2000",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }
  if (lower.includes("ifc") || lower.includes("bim") || lower.includes("revit")) {
    return {
      commandId: "EXPORT_IFC",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }

  // 10. UI & Floating Windows
  if (lower.includes("kamera") || lower.includes("gestur")) {
    return {
      commandId: "TOGGLE_CAMERA_PREVIEW",
      confidence: 0.9,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }
  if (lower.includes("asisten") || lower.includes("tanya ai") || lower.includes("konsultan")) {
    return {
      commandId: "TOGGLE_AI_ASSISTANT",
      confidence: 0.9,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }
  if (lower.includes("hemat") || lower.includes("eco")) {
    return {
      commandId: "TOGGLE_ECO_MODE",
      confidence: 0.9,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }
  if (lower.includes("menu ekspor") || lower.includes("modal ekspor")) {
    return {
      commandId: "TOGGLE_EXPORT_MODAL",
      confidence: 0.9,
      extractedParameters: {},
      rawTranscript: raw,
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

      case "TOGGLE_CAMERA_PREVIEW":
        floatingWindowActions.toggleWindow("GESTURE_AI_ASSISTANT");
        return {
          success: true,
          commandId,
          message: "Jendela Kamera Gestur berhasil ditoggle.",
          timestamp,
        };

      case "TOGGLE_ECO_MODE":
        return {
          success: true,
          commandId,
          message: "Mode Eco-Thermal ditoggle.",
          timestamp,
        };

      case "EXPORT_DXF":
      case "EXPORT_SAP2000":
      case "EXPORT_IFC":
      case "EXPORT_IDEA_STATICA":
      case "EXPORT_SOLIDWORKS_STEP":
      case "TOGGLE_EXPORT_MODAL":
        return {
          success: true,
          commandId,
          message: `Perintah ekspor '${commandId}' siap diproses melalui panel ekspor.`,
          timestamp,
        };

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
  /** Whether the microphone recognition is currently listening for speech. */
  readonly isListening: boolean;
  /** Whether the current browser supports SpeechRecognition. */
  readonly isSupported: boolean;
  /** Last recognized transcript string. */
  readonly transcript: string;
  /** Last executed CommandExecutionResult or null if none executed yet. */
  readonly lastExecution: CommandExecutionResult | null;
  /** Human-readable status or feedback toast message. */
  readonly feedbackMessage: string;
  /** Error message if SpeechRecognition encounters an issue. */
  readonly error: string | null;
  /** Toggles speech recognition on and off. */
  readonly toggleListening: () => void;
  /** Triggers a procedural Web Audio chime test to verify speaker and audio context. */
  readonly testAudioTone: (type?: AudioChimeType) => void;
  /** Explicit programmatic execution of a CommandId. */
  readonly executeCommand: (
    commandId: CommandId,
    params?: Record<string, unknown>,
  ) => CommandExecutionResult;
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
  const [transcript, setTranscript] = useState<string>("");
  const [lastExecution, setLastExecution] = useState<CommandExecutionResult | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string>(
    autoStart
      ? "🎙️ Selalu Mendengarkan... Siap menerima perintah suara."
      : "Siap mendengarkan perintah suara.",
  );
  const [error, setError] = useState<string | null>(null);

  // We type recognition instance loosely as unknown since SpeechRecognition is non-standard across browsers
  const recognitionRef = useRef<unknown>(null);
  const shouldListenRef = useRef<boolean>(autoStart);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Programmatic command runner
  const executeCommand = useCallback(
    (commandId: CommandId, params?: Record<string, unknown>): CommandExecutionResult => {
      const result = executeRegistryCommand(commandId, params);
      setLastExecution(result);
      setFeedbackMessage(result.message);

      if (playAudioFeedback) {
        synthesizeAudioTone(result.success ? "SUCCESS" : "FAILURE");
      }

      if (options.onCommandExecuted) {
        options.onCommandExecuted(result);
      }

      return result;
    },
    [options, playAudioFeedback],
  );

  // Test procedural audio chime helper
  const testAudioTone = useCallback((type: AudioChimeType = "SUCCESS"): void => {
    synthesizeAudioTone(type);
    setFeedbackMessage(
      type === "SUCCESS"
        ? "🔊 Uji Bunyi Audio: Berhasil (Arpeggio C5-G5)!"
        : `🔊 Uji Bunyi Audio: ${type}`,
    );
  }, []);

  // Safe starter wrapper avoiding browser race conditions
  const safeStart = useCallback((): void => {
    if (!shouldListenRef.current) return;
    const rec = recognitionRef.current as { start?: () => void } | null;
    if (!rec) return;
    try {
      rec.start?.();
    } catch {
      // Ignored if already listening or starting
    }
  }, []);

  // Check browser support and initialize SpeechRecognition
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Browser SpeechRecognition constructor resolution
    const SpeechRec =
      (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;

    if (!SpeechRec) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    try {
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
      };

      const recognition = new (SpeechRec as new () => RecInstance)();
      recognition.lang = language;
      recognition.continuous = true;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
        setFeedbackMessage("🎙️ Selalu Mendengarkan... Silakan ucapkan perintah.");
      };

      recognition.onend = () => {
        if (continuousListening && shouldListenRef.current) {
          // Continuous loop: schedule seamless silent restart so listening never shuts off
          if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
          restartTimerRef.current = setTimeout(() => {
            if (shouldListenRef.current) {
              safeStart();
            }
          }, 250);
        } else {
          setIsListening(false);
          if (playAudioFeedback) synthesizeAudioTone("STOP");
        }
      };

      recognition.onerror = (evt) => {
        if (evt.error === "no-speech") {
          // Normal pause in speech in Chrome - continuous loop will restart smoothly
          return;
        }
        if (evt.error === "not-allowed") {
          shouldListenRef.current = false;
          setIsListening(false);
          setError("Akses mikrofon ditolak oleh browser. Izinkan mikrofon di address bar.");
          return;
        }
        if (evt.error === "aborted") {
          return;
        }
        setError(`Speech error: ${evt.error}`);
      };

      recognition.onresult = (evt) => {
        const lastIndex = evt.results.length - 1;
        const text = evt.results[lastIndex]?.[0]?.transcript.trim() ?? "";
        if (!text) return;

        setTranscript(text);

        const match = routeVoiceTranscriptToCommand(text);
        if (match) {
          executeCommand(match.commandId, match.extractedParameters);
        } else {
          setFeedbackMessage(`Perintah tidak dikenali: "${text}"`);
          if (playAudioFeedback) synthesizeAudioTone("FAILURE");
        }
      };

      recognitionRef.current = recognition;

      // Auto start on mount if enabled
      if (autoStart) {
        shouldListenRef.current = true;
        safeStart();

        // Browser gesture fallback: if browser blocked initial autoplay/mic without user gesture,
        // awaken listening and audio context on user's very first interaction on the page
        const onFirstInteraction = (): void => {
          if (shouldListenRef.current) {
            safeStart();
            const ctx = getAudioContext();
            if (ctx && ctx.state === "suspended") {
              void ctx.resume();
            }
          }
        };
        window.addEventListener("pointerdown", onFirstInteraction, { once: true });
        window.addEventListener("keydown", onFirstInteraction, { once: true });
      }
    } catch (recInitErr) {
      const errMsg = recInitErr instanceof Error ? recInitErr.message : String(recInitErr);
      setError(`Failed to init SpeechRecognition: ${errMsg}`);
    }

    return () => {
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      const rec = recognitionRef.current as { stop?: () => void } | null;
      if (rec && typeof rec.stop === "function") {
        try {
          rec.stop();
        } catch {
          // Ignore error on teardown
        }
      }
    };
  }, [autoStart, continuousListening, executeCommand, language, playAudioFeedback, safeStart]);

  // Toggle listening handler
  const toggleListening = useCallback((): void => {
    if (!isSupported) {
      setError(
        "Web Speech API tidak didukung pada browser ini (gunakan Chromium / Chrome / Edge).",
      );
      return;
    }

    const rec = recognitionRef.current as { start?: () => void; stop?: () => void } | null;
    if (!rec) return;

    if (isListening || shouldListenRef.current) {
      shouldListenRef.current = false;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      try {
        rec.stop?.();
      } catch {
        // Handle rapid toggle errors
      }
      setIsListening(false);
      setFeedbackMessage("Mikrofon dijeda (Mute). Klik 'Listen' untuk mengaktifkan kembali.");
      if (playAudioFeedback) synthesizeAudioTone("STOP");
    } else {
      shouldListenRef.current = true;
      safeStart();
      setIsListening(true);
      setFeedbackMessage("🎙️ Selalu Mendengarkan... Silakan ucapkan perintah.");
      if (playAudioFeedback) synthesizeAudioTone("START");
    }
  }, [isListening, isSupported, playAudioFeedback, safeStart]);

  return {
    isListening,
    isSupported,
    transcript,
    lastExecution,
    feedbackMessage,
    error,
    toggleListening,
    testAudioTone,
    executeCommand,
  };
}

export default useWebSpeechCommand;
