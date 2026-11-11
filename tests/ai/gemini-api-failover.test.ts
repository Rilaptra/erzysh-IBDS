/**
 * @file gemini-api-failover.test.ts
 * @description Comprehensive unit tests for Gemini API failover and automatic key rotation engine.
 * Validates:
 * 1. Safe API key masking.
 * 2. Rate limit and free-tier quota exhaustion detection (HTTP 429 / RESOURCE_EXHAUSTED).
 * 3. Key health tracking, cooldown expiration, and key prioritization.
 * 4. Automatic failover from primary key to backup key upon receiving HTTP 429.
 * 5. Multi-key exhaustion handling and graceful fallback.
 */

import { beforeEach, describe, expect, it } from "bun:test";

import {
  clearApiKeyCooldowns,
  executeGeminiWithFailover,
  type FetchFunction,
  getApiKeyCooldownRemainingMs,
  getKeyFailureCount,
  getKeyPoolStatus,
  isApiKeyOnCooldown,
  isQuotaOrAuthError,
  isQuotaOrRateLimitError,
  markApiKeyRateLimited,
  maskApiKey,
  prioritizeApiKeys,
  resetApiKeyFailures,
} from "@/lib/gemini-api-failover";

describe("Gemini API Failover & Backup Key Rotation Engine", () => {
  beforeEach(() => {
    clearApiKeyCooldowns();
  });

  describe("API Key Masking (maskApiKey)", () => {
    it("safely masks long Gemini API keys showing only first 4 and last 4 characters", () => {
      const key = "AIzaSyD-ExampleLongGeminiKey123456789";
      const masked = maskApiKey(key);
      expect(masked).toBe("AIza...6789");
      expect(masked.length).toBeLessThan(key.length);
    });

    it("masks short keys with asterisks", () => {
      expect(maskApiKey("short")).toBe("***");
      expect(maskApiKey("12345678")).toBe("***");
    });

    it("returns [none] for empty or whitespace keys", () => {
      expect(maskApiKey("")).toBe("[none]");
      expect(maskApiKey("   ")).toBe("[none]");
    });
  });

  describe("Quota & Rate Limit Error Detection (isQuotaOrRateLimitError)", () => {
    it("identifies HTTP 429 as a quota/rate limit error immediately", () => {
      expect(isQuotaOrRateLimitError(429)).toBe(true);
      expect(isQuotaOrRateLimitError(429, "Too Many Requests")).toBe(true);
    });

    it("identifies error responses containing RESOURCE_EXHAUSTED", () => {
      expect(
        isQuotaOrRateLimitError(
          403,
          JSON.stringify({
            error: {
              code: 429,
              message: "Resource has been exhausted (e.g. check quota).",
              status: "RESOURCE_EXHAUSTED",
            },
          }),
        ),
      ).toBe(true);
    });

    it("identifies error responses with quota exceeded keywords", () => {
      expect(isQuotaOrRateLimitError(400, "User quota exceeded for model")).toBe(true);
      expect(isQuotaOrRateLimitError(500, "Exceeded your current quota")).toBe(true);
    });

    it("does not flag normal status codes or unrelated errors", () => {
      expect(isQuotaOrRateLimitError(200)).toBe(false);
      expect(isQuotaOrRateLimitError(404, "Model not found")).toBe(false);
      expect(isQuotaOrRateLimitError(500, "Internal Server Error")).toBe(false);
    });
  });

  describe("Quota & Auth Error Detection (isQuotaOrAuthError)", () => {
    it("recognizes 429, 401, and 403 status codes as rotation-triggering errors", () => {
      expect(isQuotaOrAuthError(429)).toBe(true);
      expect(isQuotaOrAuthError(401)).toBe(true);
      expect(isQuotaOrAuthError(403)).toBe(true);
    });

    it("recognizes HTTP 400 with API_KEY_INVALID or invalid credential messages", () => {
      expect(
        isQuotaOrAuthError(
          400,
          JSON.stringify({
            error: {
              code: 400,
              message: "API key not valid. Please pass a valid API key.",
              status: "INVALID_ARGUMENT",
              details: [{ reason: "API_KEY_INVALID" }],
            },
          }),
        ),
      ).toBe(true);
    });

    it("recognizes PERMISSION_DENIED and UNAUTHENTICATED error bodies", () => {
      expect(isQuotaOrAuthError(400, "permission_denied")).toBe(true);
      expect(isQuotaOrAuthError(400, "User is unauthenticated")).toBe(true);
    });

    it("does not flag unrelated 400 or 404 client errors", () => {
      expect(isQuotaOrAuthError(404, "Model not found")).toBe(false);
      expect(isQuotaOrAuthError(400, "Invalid JSON body format")).toBe(false);
    });
  });

  describe("Key Cooldown & Prioritization", () => {
    const keyA = "AIzaSy_Primary_Key_AAAAAAAAAAA";
    const keyB = "AIzaSy_Backup_Key_BBBBBBBBBBB";
    const keyC = "AIzaSy_Tertiary_Key_CCCCCCCCCC";

    it("tracks cooldown state and remaining duration for rate-limited keys", () => {
      expect(isApiKeyOnCooldown(keyA)).toBe(false);
      expect(getApiKeyCooldownRemainingMs(keyA)).toBe(0);

      markApiKeyRateLimited(keyA, 10_000);
      expect(isApiKeyOnCooldown(keyA)).toBe(true);
      expect(getApiKeyCooldownRemainingMs(keyA)).toBeGreaterThan(0);
      expect(getApiKeyCooldownRemainingMs(keyA)).toBeLessThanOrEqual(10_000);

      clearApiKeyCooldowns();
      expect(isApiKeyOnCooldown(keyA)).toBe(false);
    });

    it("prioritizes healthy keys ahead of keys currently on cooldown", () => {
      markApiKeyRateLimited(keyA, 30_000); // Key A is rate limited
      markApiKeyRateLimited(keyB, 10_000); // Key B is rate limited with shorter cooldown

      // Key C is completely healthy
      const prioritized = prioritizeApiKeys([keyA, keyB, keyC]);
      expect(prioritized[0]).toBe(keyC); // Healthy key first
      expect(prioritized[1]).toBe(keyB); // Key B expires before Key A
      expect(prioritized[2]).toBe(keyA);
    });

    it("reports diagnostic key pool status with masked representations", () => {
      const status = getKeyPoolStatus();
      expect(Array.isArray(status)).toBe(true);
      status.forEach((item) => {
        expect(typeof item.index).toBe("number");
        expect(typeof item.masked).toBe("string");
        expect(typeof item.isHealthy).toBe("boolean");
        expect(typeof item.cooldownRemainingMs).toBe("number");
      });
    });

    it("scales cooldown progressively with repeated consecutive failures", () => {
      expect(getKeyFailureCount(keyA)).toBe(0);

      // 1st failure: 1x (60,000ms)
      markApiKeyRateLimited(keyA);
      expect(getKeyFailureCount(keyA)).toBe(1);
      const remaining1 = getApiKeyCooldownRemainingMs(keyA);
      expect(remaining1).toBeGreaterThan(50_000);
      expect(remaining1).toBeLessThanOrEqual(60_000);

      // 2nd failure: 2x (120,000ms)
      markApiKeyRateLimited(keyA);
      expect(getKeyFailureCount(keyA)).toBe(2);
      const remaining2 = getApiKeyCooldownRemainingMs(keyA);
      expect(remaining2).toBeGreaterThan(100_000);
      expect(remaining2).toBeLessThanOrEqual(120_000);

      // Success resets failure count
      resetApiKeyFailures(keyA);
      expect(getKeyFailureCount(keyA)).toBe(0);
      expect(isApiKeyOnCooldown(keyA)).toBe(false);
    });
  });

  describe("Failover Execution (executeGeminiWithFailover)", () => {
    const primaryKey = "AIzaSy_PrimaryTestKey_11111111";
    const backupKey = "AIzaSy_BackupTestKey_22222222";

    it("uses x-goog-api-key header and returns successful result on 200 OK without URL query leakage", async () => {
      let capturedHeaderKey: string | undefined;
      let capturedUrl = "";

      const mockFetch: FetchFunction = async (input, init) => {
        capturedUrl = String(input);
        const headers = (init?.headers as Record<string, string>) || {};
        capturedHeaderKey = headers["x-goog-api-key"];

        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: "Halo, ini respon sukses dari model!" }],
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      };

      const result = await executeGeminiWithFailover({
        candidateKeys: [primaryKey, backupKey],
        candidateModels: ["gemini-3.5-flash-lite"],
        contents: [{ parts: [{ text: "Halo AI" }] }],
        fetchFn: mockFetch,
      });

      expect(result).not.toBeNull();
      expect(result?.usedKey).toBe(primaryKey);
      expect(result?.text).toBe("Halo, ini respon sukses dari model!");
      expect(isApiKeyOnCooldown(primaryKey)).toBe(false);

      // Security assertions
      expect(capturedHeaderKey).toBe(primaryKey);
      expect(capturedUrl).not.toContain(primaryKey);
      expect(capturedUrl).not.toContain("?key=");
    });

    it("automatically fails over to backup key when primary key hits HTTP 429", async () => {
      const attemptedKeys: string[] = [];

      const mockFetch: FetchFunction = async (_input, init) => {
        const headers = (init?.headers as Record<string, string>) || {};
        const key = headers["x-goog-api-key"];

        if (key === primaryKey) {
          attemptedKeys.push(primaryKey);
          return new Response(
            JSON.stringify({
              error: {
                code: 429,
                message: "Resource has been exhausted (check quota).",
                status: "RESOURCE_EXHAUSTED",
              },
            }),
            { status: 429, headers: { "Content-Type": "application/json" } },
          );
        }

        if (key === backupKey) {
          attemptedKeys.push(backupKey);
          return new Response(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [{ text: "Respon berhasil dari kunci cadangan!" }],
                  },
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        return new Response("Not found", { status: 404 });
      };

      const result = await executeGeminiWithFailover({
        candidateKeys: [primaryKey, backupKey],
        candidateModels: ["gemini-3.5-flash-lite"],
        contents: [{ parts: [{ text: "Hitung lendutan balok" }] }],
        fetchFn: mockFetch,
        logPrefix: "Test",
      });

      expect(result).not.toBeNull();
      expect(result?.usedKey).toBe(backupKey);
      expect(result?.text).toBe("Respon berhasil dari kunci cadangan!");

      // Verify failover progression
      expect(attemptedKeys).toEqual([primaryKey, backupKey]);

      // Verify primary key is now recorded on cooldown
      expect(isApiKeyOnCooldown(primaryKey)).toBe(true);
      expect(isApiKeyOnCooldown(backupKey)).toBe(false);
    });

    it("immediately rotates to backup key on HTTP 400 API_KEY_INVALID without retrying candidate models", async () => {
      let key1Attempts = 0;
      let key2Attempts = 0;

      const mockFetch: FetchFunction = async (_input, init) => {
        const headers = (init?.headers as Record<string, string>) || {};
        const key = headers["x-goog-api-key"];

        if (key === primaryKey) {
          key1Attempts++;
          return new Response(
            JSON.stringify({
              error: {
                code: 400,
                message: "API key not valid. Please pass a valid API key.",
                status: "INVALID_ARGUMENT",
                details: [{ reason: "API_KEY_INVALID" }],
              },
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        if (key === backupKey) {
          key2Attempts++;
          return new Response(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [{ text: "Sukses dari backup setelah primary key invalid!" }],
                  },
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        return new Response("Not found", { status: 404 });
      };

      const result = await executeGeminiWithFailover({
        candidateKeys: [primaryKey, backupKey],
        // Multiple candidate models
        candidateModels: ["gemini-3.5-flash-lite", "gemini-2.5-flash", "gemini-1.5-flash"],
        contents: [{ parts: [{ text: "Validasi tumpuan jepit" }] }],
        fetchFn: mockFetch,
      });

      expect(result).not.toBeNull();
      expect(result?.usedKey).toBe(backupKey);
      expect(result?.text).toBe("Sukses dari backup setelah primary key invalid!");
      // Key 1 broke the model loop immediately upon 400 API_KEY_INVALID (did NOT retry 3 models!)
      expect(key1Attempts).toBe(1);
      expect(key2Attempts).toBe(1);
      expect(isApiKeyOnCooldown(primaryKey)).toBe(true);
    });

    it("parses multi-part responses and filters out Gemini 2.5 thinking tokens", async () => {
      const mockFetch: FetchFunction = async () => {
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      thought: true,
                      text: "Let me calculate the beam deflection under 20 kN load...",
                    },
                    {
                      text: "Lendutan maksimum balok adalah -14.20 mm di tengah bentang.",
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      };

      const result = await executeGeminiWithFailover({
        candidateKeys: [primaryKey],
        candidateModels: ["gemini-2.5-flash"],
        contents: [{ parts: [{ text: "Berapa lendutannya?" }] }],
        fetchFn: mockFetch,
      });

      expect(result).not.toBeNull();
      expect(result?.text).toBe("Lendutan maksimum balok adalah -14.20 mm di tengah bentang.");
      expect(result?.text.includes("Let me calculate")).toBe(false);
    });

    it("concatenates multi-chunk text parts seamlessly", async () => {
      const mockFetch: FetchFunction = async () => {
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    { text: "Profil IWF 300x150 " },
                    { text: "memenuhi kriteria SNI 1729:2020." },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      };

      const result = await executeGeminiWithFailover({
        candidateKeys: [primaryKey],
        candidateModels: ["gemini-2.5-flash"],
        contents: [{ parts: [{ text: "Rekomendasi profil" }] }],
        fetchFn: mockFetch,
      });

      expect(result).not.toBeNull();
      expect(result?.text).toBe("Profil IWF 300x150 memenuhi kriteria SNI 1729:2020.");
    });

    it("returns null cleanly without throwing when all keys are exhausted by 429", async () => {
      const mockFetch: FetchFunction = async () => {
        return new Response(
          JSON.stringify({
            error: {
              code: 429,
              message: "Quota exceeded",
            },
          }),
          { status: 429, headers: { "Content-Type": "application/json" } },
        );
      };

      const result = await executeGeminiWithFailover({
        candidateKeys: [primaryKey, backupKey],
        candidateModels: ["gemini-3.5-flash-lite"],
        contents: [{ parts: [{ text: "Pertanyaan" }] }],
        fetchFn: mockFetch,
      });

      expect(result).toBeNull();
      expect(isApiKeyOnCooldown(primaryKey)).toBe(true);
      expect(isApiKeyOnCooldown(backupKey)).toBe(true);
    });

    it("returns null immediately when no API keys are provided or configured", async () => {
      const result = await executeGeminiWithFailover({
        candidateKeys: [],
        contents: [{ parts: [{ text: "Hello" }] }],
      });
      expect(result).toBeNull();
    });
  });
});
