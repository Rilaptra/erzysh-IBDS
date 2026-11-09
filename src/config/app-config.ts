/**
 * @file app-config.ts
 * @description Centralized Global Configuration for Interactive Beam Deflection Simulator (IBDS).
 *
 * Provides unified, type-safe access to:
 * 1. AI Models & Voice Persona (Gemini Intent Router, Structural Consultant, Live Audio Speech, Fallback Models).
 * 2. Simulator Initial Defaults (Material, Span, Deflection Limits, Concrete & Steel Specs).
 * 3. Computer Vision & MediaPipe Hand Tracking (Target FPS, Eco Mode).
 * 4. Telemetry & Analytics (GA4 Measurement ID, Service Account, Cache TTL).
 * 5. Server & Runtime Settings (Port, Environment).
 *
 * All settings are driven by `.env` / environment variables with robust, verified fallbacks.
 */

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Valid prebuilt voices supported by Gemini Live Audio BidiGenerateContent.
 */
export type GeminiLiveVoiceName = "Aoede" | "Puck" | "Charon" | "Kore" | "Fenrir";

/**
 * Valid structural beam materials supported by the simulator.
 */
export type BeamMaterialKind = "STEEL" | "CONCRETE";

/**
 * Global AI models and credentials configuration.
 */
export interface AiConfig {
  /** Google Gemini API Key (server-side only, null if unconfigured). */
  readonly apiKey: string | null;
  /** Primary model for Voice Command Intent Router & dynamic suggestion chips. */
  readonly intentModel: string;
  /** Primary model for Civil Engineering AI Assistant & Chatbot. */
  readonly consultantModel: string;
  /** WebSocket model for real-time 24kHz Gemini Live speech generation. */
  readonly liveModel: string;
  /** Persona voice for Gemini Live spoken audio response. */
  readonly liveVoice: GeminiLiveVoiceName;
  /** Array of fallback models in order of priority when primary models are unavailable. */
  readonly fallbackModels: readonly string[];
  /** List of officially supported Gemini models for user reference. */
  readonly supportedModels: readonly {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly recommendedFor: string;
  }[];
  /** List of available Gemini Live voice personalities. */
  readonly availableVoices: readonly {
    readonly name: GeminiLiveVoiceName;
    readonly gender: string;
    readonly tone: string;
  }[];
}

/**
 * Simulator initial defaults configuration.
 */
export interface SimulationConfig {
  /** Initial beam material (STEEL or CONCRETE). */
  readonly defaultMaterial: BeamMaterialKind;
  /** Initial beam span length in meters. */
  readonly defaultSpanM: number;
  /** Initial deflection limit denominator (e.g. 360 for L/360). */
  readonly defaultDeflectionLimitDenominator: number;
  /** Initial steel profile designation (SNI 1729). */
  readonly defaultSteelProfile: string;
  /** Initial steel structural grade (BJ 34, BJ 37, BJ 41, BJ 50, BJ 55). */
  readonly defaultSteelGrade: string;
  /** Initial concrete compressive strength fc' in MPa (SNI 2847). */
  readonly defaultConcreteFcMpa: number;
  /** Initial concrete beam width bw in millimeters. */
  readonly defaultConcreteBwMm: number;
  /** Initial concrete beam height h in millimeters. */
  readonly defaultConcreteHMm: number;
}

/**
 * MediaPipe computer vision hand tracking configuration.
 */
export interface HandTrackingConfig {
  /** Target frame rate for video inference (default: 15 FPS). */
  readonly targetFps: number;
  /** Whether eco mode is enabled by default to conserve CPU/GPU resources. */
  readonly ecoMode: boolean;
  /** Knuckle anchor blend weight between MCP #5 and MCP #9 (Zero-Pinch Dip). */
  readonly knuckleBlendWeight: number;
}

/**
 * Telemetry and Google Analytics 4 configuration.
 */
export interface TelemetryConfig {
  /** Public GA4 Measurement ID (e.g. G-RPPQDPZHZ7). */
  readonly ga4MeasurementId: string;
  /** GA4 numeric Property ID for Data API. */
  readonly ga4PropertyId: string;
  /** Service Account client email for server-side GA4 Data API authentication. */
  readonly serviceAccountEmail: string | null;
  /** Fallback visitor counter when GA4 credentials are not configured. */
  readonly fallbackVisitorCount: number;
  /** Launch epoch date ISO string for visitor badge flex counter. */
  readonly projectStartDateIso: string;
  /** Cache TTL in seconds for GA4 Data API results (default: 900s / 15m). */
  readonly cacheTtlSeconds: number;
}

/**
 * Server and runtime environment configuration.
 */
export interface ServerConfig {
  /** HTTP server listening port. */
  readonly port: number;
  /** Current Node/Bun execution environment. */
  readonly nodeEnv: string;
  /** Whether running in development mode. */
  readonly isDev: boolean;
  /** Whether running in production mode. */
  readonly isProd: boolean;
  /** Whether running in test mode (Bun test / Vitest). */
  readonly isTest: boolean;
}

/**
 * Root Application Configuration Schema.
 */
export interface AppConfig {
  readonly ai: AiConfig;
  readonly simulation: SimulationConfig;
  readonly handTracking: HandTrackingConfig;
  readonly telemetry: TelemetryConfig;
  readonly server: ServerConfig;
}

// ============================================================================
// Environment Resolvers
// ============================================================================

/**
 * Safe accessor for environment variables supporting both Bun.env, process.env, and defaults.
 */
function getEnvVar(key: string, defaultValue = ""): string {
  if (typeof Bun !== "undefined" && Bun.env && Bun.env[key] !== undefined) {
    const val = Bun.env[key]?.trim();
    if (val) return val;
  }
  if (typeof process !== "undefined" && process.env && process.env[key] !== undefined) {
    const val = process.env[key]?.trim();
    if (val) return val;
  }
  return defaultValue;
}

/**
 * Safe accessor for numeric environment variables.
 */
function getEnvNumber(key: string, defaultValue: number): number {
  const raw = getEnvVar(key);
  if (!raw) return defaultValue;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

/**
 * Safe accessor for boolean environment variables.
 */
function getEnvBool(key: string, defaultValue: boolean): boolean {
  const raw = getEnvVar(key).toLowerCase();
  if (!raw) return defaultValue;
  return raw === "true" || raw === "1" || raw === "yes";
}

/**
 * Retrieves the active Google Gemini API Key from environment variables.
 * Returns null if unset, blank, or placeholder.
 */
export function getGeminiApiKey(): string | null {
  const key = getEnvVar("AI_PROVIDER_API_KEY") || getEnvVar("GEMINI_API_KEY");
  if (!key || key === "your_gemini_api_key_here") {
    return null;
  }
  return key;
}

// ============================================================================
// Supported Models & Voice Presets Catalog
// ============================================================================

export const SUPPORTED_GEMINI_MODELS = [
  {
    id: "gemini-3.8-live",
    name: "Gemini 3.8 Live",
    description:
      "Model bidirectional real-time audio WebSocket yang menghasilkan suara 24kHz linear PCM alami tanpa TTS sintetis browser.",
    recommendedFor: "Gemini Live Real-Time Speech Audio",
  },
  {
    id: "gemini-3.5-flash-lite",
    name: "Gemini 3.5 Flash Lite",
    description:
      "Model multimodal ultra-cepat dengan latensi minimal untuk klasifikasi intent perintah suara dan perutean UI cerdas.",
    recommendedFor: "Voice Intent Router & Dynamic Suggestions",
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    description:
      "Model penalaran mendalam dan analisis tingkat lanjut untuk konsultasi optimasi balok dan kepatuhan SNI 1729/2847.",
    recommendedFor: "Structural Engineering Consultant & Complex Calculations",
  },
  {
    id: "gemini-1.5-flash",
    name: "Gemini 1.5 Flash",
    description:
      "Model serbaguna berkecepatan tinggi yang efisien untuk tugas analisis dan asisten umum.",
    recommendedFor: "General Assistant & Fallback Inference",
  },
] as const;

export const AVAILABLE_GEMINI_VOICES = [
  { name: "Aoede", gender: "Wanita", tone: "Hangat, ekspresif, jernih, dan melodis (Default)" },
  { name: "Puck", gender: "Pria", tone: "Santai, energik, dan lugas" },
  { name: "Charon", gender: "Pria", tone: "Formal, berat, dan profesional teknik" },
  { name: "Kore", gender: "Wanita", tone: "Tenang, terstruktur, dan edukatif" },
  { name: "Fenrir", gender: "Pria", tone: "Tegas, kuat, dan stabil" },
] as const;

// ============================================================================
// Global Config Construction
// ============================================================================

/**
 * Resolves the primary intent classification model.
 * Hierarchy: GEMINI_INTENT_MODEL -> AI_COMMIT_MODEL -> "gemini-2.5-flash".
 */
function resolveIntentModel(): string {
  const explicit = getEnvVar("GEMINI_INTENT_MODEL");
  if (explicit) return explicit;
  const legacy = getEnvVar("AI_COMMIT_MODEL");
  if (legacy) return legacy;
  return "gemini-2.5-flash";
}

/**
 * Resolves the structural consultant model.
 * Hierarchy: GEMINI_CONSULTANT_MODEL -> AI_COMMIT_MODEL -> "gemini-2.5-flash".
 */
function resolveConsultantModel(): string {
  const explicit = getEnvVar("GEMINI_CONSULTANT_MODEL");
  if (explicit) return explicit;
  const legacy = getEnvVar("AI_COMMIT_MODEL");
  if (legacy) return legacy;
  return "gemini-2.5-flash";
}

/**
 * Resolves the real-time audio WebSocket model.
 * Default: "models/gemini-3.8-live".
 */
function resolveLiveModel(): string {
  const raw = getEnvVar("GEMINI_LIVE_MODEL", "models/gemini-3.8-live");
  return raw.startsWith("models/") ? raw : `models/${raw}`;
}

/**
 * Resolves the Gemini Live voice personality.
 */
function resolveLiveVoice(): GeminiLiveVoiceName {
  const voice = getEnvVar("GEMINI_LIVE_VOICE", "Aoede");
  const validVoices: readonly string[] = ["Aoede", "Puck", "Charon", "Kore", "Fenrir"];
  return (validVoices.includes(voice) ? voice : "Aoede") as GeminiLiveVoiceName;
}

/**
 * Resolves fallback models list from comma-separated env or defaults.
 */
function resolveFallbackModels(primaryModel: string): readonly string[] {
  const raw = getEnvVar("AI_FALLBACK_MODELS");
  const candidates: string[] = [];
  if (raw) {
    for (const item of raw.split(",")) {
      const trimmed = item.trim();
      if (trimmed && !candidates.includes(trimmed)) {
        candidates.push(trimmed);
      }
    }
  }
  // Ensure default fallbacks are present
  const defaults = ["gemini-3.5-flash-lite", "gemini-1.5-flash"];
  for (const def of defaults) {
    if (!candidates.includes(def) && def !== primaryModel) {
      candidates.push(def);
    }
  }
  return Object.freeze(candidates);
}

/**
 * Creates the frozen application configuration instance.
 */
function createAppConfig(): AppConfig {
  const nodeEnv = getEnvVar("NODE_ENV", "development");
  const isDev = nodeEnv === "development";
  const isProd = nodeEnv === "production";
  const isTest = nodeEnv === "test" || Boolean(getEnvVar("BUN_TEST_ENTRY"));

  const intentModel = resolveIntentModel();
  const consultantModel = resolveConsultantModel();
  const liveModel = resolveLiveModel();
  const liveVoice = resolveLiveVoice();
  const fallbackModels = resolveFallbackModels(intentModel);

  return Object.freeze({
    ai: Object.freeze({
      apiKey: getGeminiApiKey(),
      intentModel,
      consultantModel,
      liveModel,
      liveVoice,
      fallbackModels,
      supportedModels: SUPPORTED_GEMINI_MODELS,
      availableVoices: AVAILABLE_GEMINI_VOICES,
    }),
    simulation: Object.freeze({
      defaultMaterial: (getEnvVar("NEXT_PUBLIC_DEFAULT_MATERIAL", "STEEL").toUpperCase() ===
      "CONCRETE"
        ? "CONCRETE"
        : "STEEL") as BeamMaterialKind,
      defaultSpanM: getEnvNumber("NEXT_PUBLIC_DEFAULT_SPAN_M", 6.0),
      defaultDeflectionLimitDenominator: getEnvNumber(
        "NEXT_PUBLIC_DEFAULT_DEFLECTION_LIMIT_DENOMINATOR",
        360,
      ),
      defaultSteelProfile: getEnvVar("NEXT_PUBLIC_DEFAULT_STEEL_PROFILE", "IWF 300x150"),
      defaultSteelGrade: getEnvVar("NEXT_PUBLIC_DEFAULT_STEEL_GRADE", "BJ_37"),
      defaultConcreteFcMpa: getEnvNumber("NEXT_PUBLIC_DEFAULT_CONCRETE_FC_MPA", 25),
      defaultConcreteBwMm: getEnvNumber("NEXT_PUBLIC_DEFAULT_CONCRETE_BW_MM", 300),
      defaultConcreteHMm: getEnvNumber("NEXT_PUBLIC_DEFAULT_CONCRETE_H_MM", 600),
    }),
    handTracking: Object.freeze({
      targetFps: getEnvNumber("NEXT_PUBLIC_HAND_TRACKING_FPS", 15),
      ecoMode: getEnvBool("NEXT_PUBLIC_HAND_TRACKING_ECO_MODE", true),
      knuckleBlendWeight: 0.5,
    }),
    telemetry: Object.freeze({
      ga4MeasurementId: getEnvVar("NEXT_PUBLIC_GA4_MEASUREMENT_ID", "G-RPPQDPZHZ7"),
      ga4PropertyId: getEnvVar("GA4_PROPERTY_ID", "123456789"),
      serviceAccountEmail: getEnvVar("GA4_SERVICE_ACCOUNT_EMAIL") || null,
      fallbackVisitorCount: getEnvNumber("NEXT_PUBLIC_GA4_FALLBACK_VISITORS", 1420),
      projectStartDateIso: getEnvVar("NEXT_PUBLIC_PROJECT_START_DATE", "2026-11-01T00:00:00.000Z"),
      cacheTtlSeconds: 900,
    }),
    server: Object.freeze({
      port: getEnvNumber("PORT", 3000),
      nodeEnv,
      isDev,
      isProd,
      isTest,
    }),
  });
}

/**
 * Centralized Application Configuration Singleton.
 * Import this anywhere in the codebase for type-safe settings:
 *
 * @example
 * ```ts
 * import { appConfig } from "@/config/app-config";
 *
 * const activeModel = appConfig.ai.intentModel;
 * const voicePersona = appConfig.ai.liveVoice;
 * ```
 */
export const appConfig: AppConfig = createAppConfig();

/**
 * Shorthand alias for AI Configuration.
 */
export const aiConfig = appConfig.ai;

/**
 * Shorthand alias for Simulation Configuration.
 */
export const simulationConfig = appConfig.simulation;

/**
 * Shorthand alias for Telemetry Configuration.
 */
export const telemetryConfig = appConfig.telemetry;

/**
 * Shorthand alias for Hand Tracking Configuration.
 */
export const handTrackingConfig = appConfig.handTracking;

/**
 * Shorthand alias for Server Configuration.
 */
export const serverConfig = appConfig.server;

export default appConfig;
