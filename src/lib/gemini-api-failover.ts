/**
 * @file gemini-api-failover.ts
 * @description High-resilience failover and automatic key rotation engine for Google Gemini API.
 *
 * Provides:
 * 1. Automatic backup API key rotation upon encountering Free Tier rate limits (HTTP 429 / RESOURCE_EXHAUSTED).
 * 2. Multi-model priority fallback (e.g., gemini-3.5-flash-lite -> gemini-2.5-flash -> gemini-1.5-flash).
 * 3. Key health state tracking with automatic cooldown (60s default) to prevent hammering throttled keys.
 * 4. Safe key masking for logging and diagnostics.
 * 5. Plug-and-play support across Intent Router, Structural Consultant, and developer CLI tools.
 */

import { appConfig, getGeminiApiKeys } from "@/config/app-config";

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface GeminiKeyStatus {
  readonly index: number;
  readonly masked: string;
  readonly isHealthy: boolean;
  readonly cooldownRemainingMs: number;
}

export type FetchFunction = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface GeminiGenerateContentOptions {
  /** Candidate Gemini models to attempt in priority order. */
  readonly candidateModels?: readonly string[];
  /** Candidate API keys to attempt in priority order (defaults to all configured keys). */
  readonly candidateKeys?: readonly string[];
  /** System instruction prompt. */
  readonly systemInstruction?: string;
  /** Conversation parts or user prompt contents. */
  readonly contents: Array<{
    readonly role?: string;
    readonly parts: Array<{ readonly text: string }>;
  }>;
  /** Model generation settings (temperature, responseMimeType, maxOutputTokens, etc). */
  readonly generationConfig?: Record<string, unknown>;
  /** Timeout per HTTP request in milliseconds (default: 4500ms). */
  readonly timeoutMs?: number;
  /** Diagnostic log prefix for console warnings. */
  readonly logPrefix?: string;
  /** Optional injectable fetch for unit testing. */
  readonly fetchFn?: FetchFunction;
}

export interface GeminiGenerateContentResult {
  readonly text: string;
  readonly usedKey: string;
  readonly usedModel: string;
  readonly rawResponse: unknown;
}

// ============================================================================
// Key Health & Cooldown Tracking
// ============================================================================

/** Cooldown duration in milliseconds when a key encounters HTTP 429 or quota limit. */
export const DEFAULT_KEY_COOLDOWN_MS = 60_000;

/** Timestamp map recording when a key's cooldown will expire. */
const keyCooldownMap = new Map<string, number>();

/** Map tracking consecutive failure counts per key for progressive cooldown backoff. */
const keyFailureCountMap = new Map<string, number>();

/**
 * Masks an API key for safe display in logs and telemetry.
 * Example: `AIzaSyDummyKeyForDocumentationOnly12345678` -> `AIza...5678`
 */
export function maskApiKey(key: string): string {
  if (!key) return "[none]";
  const trimmed = key.trim();
  if (!trimmed) return "[none]";
  if (trimmed.length <= 8) return "***";
  const start = trimmed.slice(0, 4);
  const end = trimmed.slice(-4);
  return `${start}...${end}`;
}

/**
 * Returns consecutive failure count for a given API key.
 */
export function getKeyFailureCount(key: string): number {
  const trimmed = key.trim();
  return keyFailureCountMap.get(trimmed) ?? 0;
}

/**
 * Resets failure count and cooldown state for an API key upon successful request.
 */
export function resetApiKeyFailures(key: string): void {
  const trimmed = key.trim();
  keyFailureCountMap.delete(trimmed);
  keyCooldownMap.delete(trimmed);
}

/**
 * Marks an API key as rate-limited or quota-exhausted for a set duration.
 * Scales cooldown duration progressively on repeated consecutive failures:
 * 1st failure: 1x (60s), 2nd failure: 2x (120s), 3rd: 4x (240s), up to 15x (900s max).
 */
export function markApiKeyRateLimited(key: string, cooldownMs?: number): void {
  const trimmed = key.trim();
  if (!trimmed) return;

  const failures = (keyFailureCountMap.get(trimmed) ?? 0) + 1;
  keyFailureCountMap.set(trimmed, failures);

  const multiplier = Math.min(Math.pow(2, failures - 1), 15);
  const duration = cooldownMs !== undefined ? cooldownMs : DEFAULT_KEY_COOLDOWN_MS * multiplier;
  const expiry = Date.now() + duration;
  keyCooldownMap.set(trimmed, expiry);
}

/**
 * Checks whether an API key is currently in cooldown due to quota exhaustion.
 */
export function isApiKeyOnCooldown(key: string): boolean {
  const trimmed = key.trim();
  const expiry = keyCooldownMap.get(trimmed);
  if (!expiry) return false;
  if (Date.now() >= expiry) {
    keyCooldownMap.delete(trimmed);
    return false;
  }
  return true;
}

/**
 * Returns remaining cooldown duration in milliseconds (0 if healthy).
 */
export function getApiKeyCooldownRemainingMs(key: string): number {
  const trimmed = key.trim();
  const expiry = keyCooldownMap.get(trimmed);
  if (!expiry) return 0;
  const remaining = expiry - Date.now();
  if (remaining <= 0) {
    keyCooldownMap.delete(trimmed);
    return 0;
  }
  return remaining;
}

/**
 * Clears all key cooldown states and failure counters (primarily for testing or manual reset).
 */
export function clearApiKeyCooldowns(): void {
  keyCooldownMap.clear();
  keyFailureCountMap.clear();
}

/**
 * Retrieves the diagnostic health status of all configured Gemini API keys.
 */
export function getKeyPoolStatus(): readonly GeminiKeyStatus[] {
  const keys = getGeminiApiKeys();
  return keys.map((key, index) => {
    const remaining = getApiKeyCooldownRemainingMs(key);
    return {
      index,
      masked: maskApiKey(key),
      isHealthy: remaining === 0,
      cooldownRemainingMs: remaining,
    };
  });
}

/**
 * Orders a list of API keys: healthy keys first, followed by cooldown keys sorted by earliest expiration.
 */
export function prioritizeApiKeys(keys: readonly string[]): string[] {
  const healthy: string[] = [];
  const onCooldown: Array<{ key: string; remaining: number }> = [];

  for (const k of keys) {
    const trimmed = k.trim();
    if (!trimmed) continue;
    const remaining = getApiKeyCooldownRemainingMs(trimmed);
    if (remaining === 0) {
      healthy.push(trimmed);
    } else {
      onCooldown.push({ key: trimmed, remaining });
    }
  }

  // Sort cooldown keys so that the one closest to expiry is tried next if all are cooling down
  onCooldown.sort((a, b) => a.remaining - b.remaining);

  return [...healthy, ...onCooldown.map((item) => item.key)];
}

// ============================================================================
// Error Detection
// ============================================================================

/**
 * Inspects HTTP response status and optional body to determine if request failed
 * due to free-tier rate limits (RPM / RPD / TPM) or quota exhaustion.
 */
export function isQuotaOrRateLimitError(status: number, bodyText?: string): boolean {
  if (status === 429) {
    return true;
  }

  if (bodyText) {
    const lower = bodyText.toLowerCase();
    if (
      lower.includes("resource_exhausted") ||
      lower.includes("quota exceeded") ||
      lower.includes("rate limit") ||
      lower.includes("too many requests") ||
      lower.includes("exceeded your current quota") ||
      lower.includes("resource has been exhausted")
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Inspects HTTP response status and optional body to determine if request failed
 * due to quota exhaustion OR authentication/authorization errors (invalid key, permission denied).
 * Recognizes 400 (API_KEY_INVALID), 401 (UNAUTHENTICATED), 403 (PERMISSION_DENIED), and 429.
 */
export function isQuotaOrAuthError(status: number, bodyText?: string): boolean {
  if (isQuotaOrRateLimitError(status, bodyText)) {
    return true;
  }

  if (status === 401) {
    return true;
  }

  if (status === 403) {
    return true;
  }

  if (bodyText) {
    const lower = bodyText.toLowerCase();
    if (
      lower.includes("api_key_invalid") ||
      lower.includes("api key not valid") ||
      lower.includes("permission_denied") ||
      lower.includes("permission denied") ||
      lower.includes("unauthenticated")
    ) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// Core Failover Execution Engine
// ============================================================================

/**
 * Executes a Gemini `generateContent` request with automatic API key rotation and model fallback.
 *
 * If Key #1 hits HTTP 429, quota limit, or authentication error:
 * 1. Key #1 is marked as rate-limited/failed with progressive cooldown backoff.
 * 2. A diagnostic warning is logged.
 * 3. The request is immediately retried using the backup key (Key #2).
 * 4. Candidate models are also tried in priority order if a model is unavailable (404/503).
 *
 * Uses `x-goog-api-key` in HTTP headers to prevent secret key leakage in URLs and error stacks.
 * Handles Gemini 2.5 multi-part and thinking model responses.
 *
 * @param options Request parameters including prompt, models, keys, and generation settings.
 * @returns Result object with text response, used key, and used model, or null if all attempts fail.
 */
export async function executeGeminiWithFailover(
  options: GeminiGenerateContentOptions,
): Promise<GeminiGenerateContentResult | null> {
  const fetcher = options.fetchFn ?? fetch;
  const logPrefix = options.logPrefix ?? "Gemini";
  const timeoutMs = options.timeoutMs ?? 4500;

  // Resolve candidate API keys
  const rawKeys = options.candidateKeys ?? getGeminiApiKeys();
  if (rawKeys.length === 0) {
    return null;
  }

  // Prioritize healthy keys first
  const keysToTry = prioritizeApiKeys(rawKeys);

  // Resolve candidate models
  const primaryModel = appConfig.ai.intentModel;
  const candidateModels = options.candidateModels ?? [primaryModel, ...appConfig.ai.fallbackModels];

  // Construct request payload
  const payload: Record<string, unknown> = {
    contents: options.contents,
  };

  if (options.systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: options.systemInstruction }],
    };
  }

  if (options.generationConfig) {
    payload.generationConfig = options.generationConfig;
  }

  const payloadString = JSON.stringify(payload);

  // Outer loop: Iterate through available API Keys
  for (let keyIdx = 0; keyIdx < keysToTry.length; keyIdx++) {
    const currentKey = keysToTry[keyIdx];
    if (!currentKey) continue;

    const hasBackupKeyAvailable = keyIdx + 1 < keysToTry.length;

    // Inner loop: Iterate through candidate Models for this API Key
    for (const model of candidateModels) {
      try {
        // Security enhancement: Use x-goog-api-key header instead of query parameter
        // to prevent secret credentials leakage in access logs, proxies, and error stack traces.
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

        const response = await fetcher(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": currentKey,
          },
          body: payloadString,
          signal: AbortSignal.timeout(timeoutMs),
        });

        // 1. Check for Rate Limit / Quota Exhaustion / Auth failure (HTTP 400/401/403/429)
        if (!response.ok) {
          let errorBody = "";
          try {
            errorBody = await response.text();
          } catch {
            // Ignore text read error
          }

          if (isQuotaOrAuthError(response.status, errorBody)) {
            markApiKeyRateLimited(currentKey);

            if (hasBackupKeyAvailable) {
              const nextKey = keysToTry[keyIdx + 1];
              console.warn(
                `⚠️ [${logPrefix} Failover] Kunci API (${maskApiKey(currentKey)}) gagal/limit (HTTP ${response.status}). Mengalihkan otomatis ke kunci cadangan (${maskApiKey(nextKey || "")})...`,
              );
            } else {
              console.warn(
                `⚠️ [${logPrefix} Failover] Kunci API (${maskApiKey(currentKey)}) gagal/limit (HTTP ${response.status}), dan tidak ada kunci cadangan tersisa.`,
              );
            }

            // Break model loop immediately to switch to the NEXT API KEY.
            // Retrying the same key with other models will just hit the same quota/auth limit.
            break;
          }

          // If model is not found (404) or temporarily overloaded (503), try next candidate model
          if (response.status === 404 || response.status === 503) {
            continue;
          }

          // Other HTTP errors: continue to next model
          continue;
        }

        // 2. Parse successful response (supports multi-part and Gemini 2.5 thinking output)
        const result = (await response.json()) as {
          candidates?: Array<{
            content?: {
              parts?: Array<{ text?: string; thought?: boolean }>;
            };
          }>;
        };

        const parts = result.candidates?.[0]?.content?.parts ?? [];
        const nonThoughtParts = parts.filter((p) => !p.thought && typeof p.text === "string");
        let extractedText = nonThoughtParts.map((p) => p.text).join("");
        if (!extractedText.trim()) {
          extractedText = parts
            .filter((p) => typeof p.text === "string")
            .map((p) => p.text)
            .join("");
        }

        const text = extractedText.trim();
        if (text) {
          resetApiKeyFailures(currentKey);
          return {
            text,
            usedKey: currentKey,
            usedModel: model,
            rawResponse: result,
          };
        }
      } catch {
        // Network timeout or connection drop: try next candidate model
        continue;
      }
    }
  }

  // All keys and models exhausted
  return null;
}
