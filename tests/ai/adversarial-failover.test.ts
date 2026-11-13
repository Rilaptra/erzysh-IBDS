/**
 * @file adversarial-failover.test.ts
 * @description In-depth adversarial stress tests and empirical bug-hunting harness
 * for Google Gemini API multi-key failover, quote stripping, credential sanitization,
 * error classification, progressive backoff, and concurrent request handling.
 */

import { beforeEach, describe, expect, it } from "bun:test";

import { appConfig, stripSurroundingQuotes } from "@/config/app-config";
import {
  clearApiKeyCooldowns,
  DEFAULT_KEY_COOLDOWN_MS,
  executeGeminiWithFailover,
  type FetchFunction,
  getApiKeyCooldownRemainingMs,
  getKeyFailureCount,
  isApiKeyOnCooldown,
  isQuotaOrAuthError,
  isQuotaOrRateLimitError,
  markApiKeyRateLimited,
  maskApiKey,
  prioritizeApiKeys,
  resetApiKeyFailures,
} from "@/lib/gemini-api-failover";

describe("Adversarial Stress Harness: Multi-Key Failover & Security", () => {
  beforeEach(() => {
    clearApiKeyCooldowns();
  });

  // ==========================================================================
  // 1. Quote Stripping & Input Sanitization
  // ==========================================================================
  describe("1. Bizarre Input Formats & Quote Stripping", () => {
    it("handles empty strings and whitespace variations safely", () => {
      expect(stripSurroundingQuotes("")).toBe("");
      expect(stripSurroundingQuotes("   ")).toBe("");
      expect(stripSurroundingQuotes("\t\r\n  \t")).toBe("");
      expect(stripSurroundingQuotes("\n\n")).toBe("");
    });

    it("strips isolated quote characters without infinite loops", () => {
      expect(stripSurroundingQuotes('"')).toBe("");
      expect(stripSurroundingQuotes("'")).toBe("");
      expect(stripSurroundingQuotes('""')).toBe("");
      expect(stripSurroundingQuotes("''")).toBe("");
      expect(stripSurroundingQuotes('"""')).toBe("");
      expect(stripSurroundingQuotes("'''")).toBe("");
      expect(stripSurroundingQuotes('"' + "'")).toBe("");
      expect(stripSurroundingQuotes("'" + '"')).toBe("");
    });

    it("strips deeply nested and alternating quotes when properly paired", () => {
      const key = "AIzaSyD-AdversarialTestKey123456";
      expect(stripSurroundingQuotes(`"${key}"`)).toBe(key);
      expect(stripSurroundingQuotes(`'${key}'`)).toBe(key);
      expect(stripSurroundingQuotes(`'\"${key}\"'`)).toBe(key);
      expect(stripSurroundingQuotes(`\"'${key}'\"`)).toBe(key);
      expect(stripSurroundingQuotes(`\"\"\"${key}\"\"\"`)).toBe(key);
      expect(stripSurroundingQuotes(`'''${key}'''`)).toBe(key);
      expect(stripSurroundingQuotes(`\"'\"${key}\"'\"`)).toBe(key);
      expect(stripSurroundingQuotes(`'\"'${key}'\"'`)).toBe(key);
    });

    it("observes behavior on heavily asymmetric / unclosed alternating quotes", () => {
      const key = "AIzaSyD-AdversarialTestKey123456";
      // When start and end quotes are of different quote types and length differs,
      // stripSurroundingQuotes peels the outermost single characters via replace(/^["']|["']$/g, "")
      const asymmetric = `\"'\"'\"${key}\"'\"'`;
      const cleaned = stripSurroundingQuotes(asymmetric);
      // Documents exact behavior: peels 1 leading double-quote and 1 trailing single-quote
      expect(cleaned).toBe(`'\"'\"${key}\"'\"`);
    });

    it("handles unmatched / asymmetric quotes safely", () => {
      const key = "AIzaSyD-AdversarialTestKey123456";
      expect(stripSurroundingQuotes(`"${key}`)).toBe(key);
      expect(stripSurroundingQuotes(`'${key}`)).toBe(key);
      expect(stripSurroundingQuotes(`${key}"`)).toBe(key);
      expect(stripSurroundingQuotes(`${key}'`)).toBe(key);
      expect(stripSurroundingQuotes(`"${key}'`)).toBe(key);
      expect(stripSurroundingQuotes(`'${key}"`)).toBe(key);
    });

    it("preserves legitimate non-quote characters inside key tokens", () => {
      const tokenWithDashes = "AIzaSyD-abc_123-XYZ";
      expect(stripSurroundingQuotes(` "${tokenWithDashes}" `)).toBe(tokenWithDashes);
    });

    it("sanitizes CRLF line endings from Windows .env inputs", () => {
      const key = "AIzaSyD-WindowsCRLFTest123456";
      expect(stripSurroundingQuotes(`\r\n"${key}"\r\n`)).toBe(key);
      expect(stripSurroundingQuotes(`${key}\r`)).toBe(key);
    });
  });

  // ==========================================================================
  // 2. Error Classification & Discrimination
  // ==========================================================================
  describe("2. Error Classification (isQuotaOrAuthError & isQuotaOrRateLimitError)", () => {
    it("correctly identifies all variations of 429 / quota messages", () => {
      expect(isQuotaOrRateLimitError(429)).toBe(true);
      expect(isQuotaOrRateLimitError(429, "Too Many Requests")).toBe(true);
      expect(isQuotaOrRateLimitError(200, "RESOURCE_EXHAUSTED")).toBe(true);
      expect(isQuotaOrRateLimitError(400, "quota exceeded for quota group")).toBe(true);
      expect(isQuotaOrRateLimitError(403, "rate limit reached")).toBe(true);
      expect(isQuotaOrRateLimitError(400, "exceeded your current quota")).toBe(true);
      expect(isQuotaOrRateLimitError(500, "Resource has been exhausted")).toBe(true);
    });

    it("identifies authentication failures: 400 (API_KEY_INVALID), 401, 403", () => {
      expect(isQuotaOrAuthError(401)).toBe(true);
      expect(isQuotaOrAuthError(403)).toBe(true);
      expect(isQuotaOrAuthError(400, '{"error":{"message":"API_KEY_INVALID"}}')).toBe(true);
      expect(
        isQuotaOrAuthError(
          400,
          '{"error":{"message":"API key not valid. Please pass a valid API key."}}',
        ),
      ).toBe(true);
      expect(isQuotaOrAuthError(400, "PERMISSION_DENIED")).toBe(true);
      expect(
        isQuotaOrAuthError(400, "Request had invalid authentication credentials. unauthenticated"),
      ).toBe(true);
    });

    it("does NOT classify normal application errors or prompt syntax errors as quota/auth errors", () => {
      // 400 Invalid argument (e.g. prompt syntax or contents missing) should NOT invalidate the key
      expect(isQuotaOrAuthError(400, "INVALID_ARGUMENT: contents is required")).toBe(false);
      expect(isQuotaOrAuthError(400, "field generationConfig.temperature is out of range")).toBe(
        false,
      );
      expect(isQuotaOrAuthError(404, "models/gemini-invalid not found")).toBe(false);
      expect(isQuotaOrAuthError(500, "Internal Server Error")).toBe(false);
      expect(isQuotaOrAuthError(502, "Bad Gateway")).toBe(false);
      expect(isQuotaOrAuthError(503, "Service Unavailable")).toBe(false);
      expect(isQuotaOrAuthError(504, "Gateway Timeout")).toBe(false);
    });

    it("handles null, undefined, or empty body gracefully without throwing", () => {
      expect(isQuotaOrAuthError(200, undefined)).toBe(false);
      expect(isQuotaOrAuthError(400, undefined)).toBe(false);
      expect(isQuotaOrAuthError(429, undefined)).toBe(true);
      expect(isQuotaOrAuthError(401, undefined)).toBe(true);
      expect(isQuotaOrAuthError(403, undefined)).toBe(true);
      expect(isQuotaOrAuthError(500, "")).toBe(false);
    });
  });

  // ==========================================================================
  // 3. Failover Execution Against Simulated Faults
  // ==========================================================================
  describe("3. Failover Execution Fault Injection (executeGeminiWithFailover)", () => {
    const key1 = "AIzaSyD-Key1-Primary11111111111";
    const key2 = "AIzaSyD-Key2-Backup222222222222";
    const key3 = "AIzaSyD-Key3-Tertiary3333333333";

    it("rotates immediately on HTTP 400 API_KEY_INVALID without retrying 3 models", async () => {
      let callCount = 0;
      const calledModels: string[] = [];
      const calledKeys: string[] = [];

      const mockFetch: FetchFunction = async (_url, init) => {
        callCount++;
        const key = (init?.headers as Record<string, string>)?.["x-goog-api-key"] ?? "";
        calledKeys.push(key);
        const urlStr = String(_url);
        const modelMatch = urlStr.match(/models\/([^:]+):/);
        if (modelMatch?.[1]) calledModels.push(modelMatch[1]);

        if (key === key1) {
          return new Response(
            JSON.stringify({
              error: {
                code: 400,
                message: "API key not valid. Please pass a valid API key.",
                status: "INVALID_ARGUMENT",
                details: [{ reason: "API_KEY_INVALID" }],
              },
            }),
            { status: 400, statusText: "Bad Request" },
          );
        }

        return new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: "Backup key response OK" }] } }],
          }),
          { status: 200, statusText: "OK" },
        );
      };

      const result = await executeGeminiWithFailover({
        candidateKeys: [key1, key2],
        candidateModels: ["gemini-model-A", "gemini-model-B", "gemini-model-C"],
        contents: [{ parts: [{ text: "test prompt" }] }],
        fetchFn: mockFetch,
      });

      expect(result).not.toBeNull();
      expect(result?.text).toBe("Backup key response OK");
      expect(result?.usedKey).toBe(key2);
      // Key1 should only be attempted ONCE, then break model loop immediately!
      // Key2 should then succeed on model-A. Total calls = 2.
      expect(callCount).toBe(2);
      expect(calledKeys).toEqual([key1, key2]);
      expect(isApiKeyOnCooldown(key1)).toBe(true);
      expect(isApiKeyOnCooldown(key2)).toBe(false);
    });

    it("survives network timeout and falls through to next candidate model", async () => {
      let attempt = 0;
      const mockFetch: FetchFunction = async () => {
        attempt++;
        if (attempt === 1) {
          // Simulate timeout rejection
          const timeoutErr = new Error("The operation was aborted due to timeout");
          timeoutErr.name = "TimeoutError";
          throw timeoutErr;
        }
        return new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: "Success after timeout" }] } }],
          }),
          { status: 200 },
        );
      };

      const result = await executeGeminiWithFailover({
        candidateKeys: [key1],
        candidateModels: ["model-slow", "model-fast"],
        contents: [{ parts: [{ text: "prompt" }] }],
        fetchFn: mockFetch,
      });

      expect(result?.text).toBe("Success after timeout");
      expect(attempt).toBe(2);
    });

    it("survives network connection drop (ECONNRESET) and proceeds cleanly", async () => {
      let attempt = 0;
      const mockFetch: FetchFunction = async () => {
        attempt++;
        if (attempt === 1) {
          throw new TypeError("fetch failed: ECONNRESET");
        }
        return new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: "Recovered from socket reset" }] } }],
          }),
          { status: 200 },
        );
      };

      const result = await executeGeminiWithFailover({
        candidateKeys: [key1],
        candidateModels: ["model-1", "model-2"],
        contents: [{ parts: [{ text: "prompt" }] }],
        fetchFn: mockFetch,
      });

      expect(result?.text).toBe("Recovered from socket reset");
      expect(attempt).toBe(2);
    });

    it("handles malformed non-JSON HTTP 200 responses without crashing", async () => {
      let attempt = 0;
      const mockFetch: FetchFunction = async () => {
        attempt++;
        if (attempt === 1) {
          // Returning HTML captive portal or proxy error with 200 status
          return new Response("<html><body>Captive Portal Login</body></html>", {
            status: 200,
            headers: { "Content-Type": "text/html" },
          });
        }
        return new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: "Valid JSON recovery" }] } }],
          }),
          { status: 200 },
        );
      };

      const result = await executeGeminiWithFailover({
        candidateKeys: [key1],
        candidateModels: ["model-html", "model-json"],
        contents: [{ parts: [{ text: "prompt" }] }],
        fetchFn: mockFetch,
      });

      expect(result?.text).toBe("Valid JSON recovery");
      expect(attempt).toBe(2);
    });

    it("handles empty candidates array (safety block) by falling through to next model", async () => {
      let attempt = 0;
      const mockFetch: FetchFunction = async () => {
        attempt++;
        if (attempt === 1) {
          return new Response(
            JSON.stringify({
              candidates: [],
              promptFeedback: { blockReason: "SAFETY" },
            }),
            { status: 200 },
          );
        }
        return new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: "Permitted response" }] } }],
          }),
          { status: 200 },
        );
      };

      const result = await executeGeminiWithFailover({
        candidateKeys: [key1],
        candidateModels: ["model-strict", "model-lenient"],
        contents: [{ parts: [{ text: "prompt" }] }],
        fetchFn: mockFetch,
      });

      expect(result?.text).toBe("Permitted response");
      expect(attempt).toBe(2);
    });

    it("exhausts 3 keys sequentially when all return 429 and returns null cleanly", async () => {
      let callCount = 0;
      const mockFetch: FetchFunction = async () => {
        callCount++;
        return new Response(
          JSON.stringify({
            error: {
              code: 429,
              message: "Resource has been exhausted (e.g. check quota).",
              status: "RESOURCE_EXHAUSTED",
            },
          }),
          { status: 429 },
        );
      };

      const result = await executeGeminiWithFailover({
        candidateKeys: [key1, key2, key3],
        candidateModels: ["m1", "m2"],
        contents: [{ parts: [{ text: "prompt" }] }],
        fetchFn: mockFetch,
      });

      expect(result).toBeNull();
      // Each key tried once on m1, broke model loop immediately: 3 calls total
      expect(callCount).toBe(3);
      expect(isApiKeyOnCooldown(key1)).toBe(true);
      expect(isApiKeyOnCooldown(key2)).toBe(true);
      expect(isApiKeyOnCooldown(key3)).toBe(true);
    });
  });

  // ==========================================================================
  // 4. Concurrency & Shared Cooldown Map
  // ==========================================================================
  describe("4. Concurrency Stress & Cooldown Map Consistency", () => {
    const keyA = "AIzaSyD-ConcurrentKeyA-111111111";
    const keyB = "AIzaSyD-ConcurrentKeyB-222222222";

    it("handles 20 concurrent requests without race conditions, failing over cleanly to backup key", async () => {
      let keyACalls = 0;
      let keyBCalls = 0;

      const mockFetch: FetchFunction = async (_url, init) => {
        const key = (init?.headers as Record<string, string>)?.["x-goog-api-key"];
        if (key === keyA) {
          keyACalls++;
          // Simulate slight network latency
          await Bun.sleep(5);
          return new Response(
            JSON.stringify({ error: { code: 429, message: "RESOURCE_EXHAUSTED" } }),
            { status: 429 },
          );
        }

        keyBCalls++;
        await Bun.sleep(2);
        return new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: "Concurrent response OK" }] } }],
          }),
          { status: 200 },
        );
      };

      const requestCount = 20;
      const promises = Array.from({ length: requestCount }, () =>
        executeGeminiWithFailover({
          candidateKeys: [keyA, keyB],
          candidateModels: ["gemini-model"],
          contents: [{ parts: [{ text: "concurrent prompt" }] }],
          fetchFn: mockFetch,
        }),
      );

      const results = await Promise.all(promises);

      // All 20 requests must have resolved successfully using Key B
      expect(results.length).toBe(requestCount);
      for (const res of results) {
        expect(res).not.toBeNull();
        expect(res?.text).toBe("Concurrent response OK");
        expect(res?.usedKey).toBe(keyB);
      }

      // Key A should be on cooldown, Key B healthy
      expect(isApiKeyOnCooldown(keyA)).toBe(true);
      expect(isApiKeyOnCooldown(keyB)).toBe(false);
      expect(getKeyFailureCount(keyA)).toBeGreaterThan(0);
      expect(getKeyFailureCount(keyB)).toBe(0);
    });

    it("subsequent requests immediately prioritize healthy key without trying throttled key", async () => {
      // Step 1: Throttle keyA
      markApiKeyRateLimited(keyA);
      expect(isApiKeyOnCooldown(keyA)).toBe(true);

      let keyACalls = 0;
      let keyBCalls = 0;

      const mockFetch: FetchFunction = async (_url, init) => {
        const key = (init?.headers as Record<string, string>)?.["x-goog-api-key"];
        if (key === keyA) {
          keyACalls++;
          return new Response("", { status: 429 });
        }
        keyBCalls++;
        return new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: "Immediate backup result" }] } }],
          }),
          { status: 200 },
        );
      };

      // Execute request with prioritized keys
      const result = await executeGeminiWithFailover({
        candidateKeys: [keyA, keyB],
        contents: [{ parts: [{ text: "test" }] }],
        fetchFn: mockFetch,
      });

      expect(result?.text).toBe("Immediate backup result");
      expect(result?.usedKey).toBe(keyB);
      // Key A was already on cooldown, so prioritizeApiKeys put keyB first!
      // Key A should NOT have been fetched at all!
      expect(keyACalls).toBe(0);
      expect(keyBCalls).toBe(1);
    });

    it("scales cooldown backoff properly up to max multiplier (15x) without NaN", () => {
      const testKey = "AIzaSyD-ExponentialScaleTestKey";

      for (let i = 1; i <= 20; i++) {
        markApiKeyRateLimited(testKey);
        const count = getKeyFailureCount(testKey);
        expect(count).toBe(i);

        const remaining = getApiKeyCooldownRemainingMs(testKey);
        expect(remaining).toBeGreaterThan(0);
        expect(Number.isFinite(remaining)).toBe(true);

        // Max multiplier is 15 -> 15 * 60,000 = 900,000ms
        expect(remaining).toBeLessThanOrEqual(DEFAULT_KEY_COOLDOWN_MS * 15 + 100);
      }

      // Successful reset clears count and cooldown
      resetApiKeyFailures(testKey);
      expect(getKeyFailureCount(testKey)).toBe(0);
      expect(getApiKeyCooldownRemainingMs(testKey)).toBe(0);
      expect(isApiKeyOnCooldown(testKey)).toBe(false);
    });
  });

  // ==========================================================================
  // 5. Security & Secret Leakage Auditing
  // ==========================================================================
  describe("5. Security & Secret Leakage Auditing", () => {
    const rawSecretKey = "AIzaSyD-CRITICAL_SECRET_KEY_1234567890abcdef";

    it("never includes the raw API key in the HTTP request URL", async () => {
      let interceptedUrl = "";
      const mockFetch: FetchFunction = async (url) => {
        interceptedUrl = String(url);
        return new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: "OK" }] } }],
          }),
          { status: 200 },
        );
      };

      await executeGeminiWithFailover({
        candidateKeys: [rawSecretKey],
        contents: [{ parts: [{ text: "test" }] }],
        fetchFn: mockFetch,
      });

      expect(interceptedUrl).not.toContain("?key=");
      expect(interceptedUrl).not.toContain(rawSecretKey);
      expect(interceptedUrl).toBe(
        `https://generativelanguage.googleapis.com/v1beta/models/${appConfig.ai.intentModel}:generateContent`,
      );
    });

    it("never leaks raw API keys in console.warn logs during failover", async () => {
      const secretPrimary = "AIzaSyD-PRIMARY_SECRET_KEY_9999999999";
      const secretBackup = "AIzaSyD-BACKUP_SECRET_KEY_8888888888";

      const capturedWarns: string[] = [];
      const originalWarn = console.warn;
      console.warn = (...args: unknown[]) => {
        capturedWarns.push(args.map(String).join(" "));
      };

      try {
        const mockFetch: FetchFunction = async (_url, init) => {
          const key = (init?.headers as Record<string, string>)?.["x-goog-api-key"];
          if (key === secretPrimary) {
            return new Response('{"error":"quota exceeded"}', { status: 429 });
          }
          return new Response(
            JSON.stringify({
              candidates: [{ content: { parts: [{ text: "OK" }] } }],
            }),
            { status: 200 },
          );
        };

        await executeGeminiWithFailover({
          candidateKeys: [secretPrimary, secretBackup],
          contents: [{ parts: [{ text: "test" }] }],
          fetchFn: mockFetch,
        });

        expect(capturedWarns.length).toBeGreaterThan(0);
        for (const logLine of capturedWarns) {
          // MUST NOT contain the unmasked secret keys
          expect(logLine).not.toContain(secretPrimary);
          expect(logLine).not.toContain(secretBackup);
          // MUST contain safely masked keys
          expect(logLine).toContain(maskApiKey(secretPrimary));
          expect(logLine).toContain(maskApiKey(secretBackup));
        }
      } finally {
        console.warn = originalWarn;
      }
    });

    it("maskApiKey never leaks sensitive middle characters regardless of length", () => {
      const sensitiveKeys = [
        "AIzaSyD-ABC123XYZ456SecretCredentialString999",
        "shortkey",
        "12345678",
        "123456789",
        "extremelyLongKeyExceedingFiftyCharactersLength1234567890abcdefghijklmnopqrstuvwxyz",
      ];

      for (const k of sensitiveKeys) {
        const masked = maskApiKey(k);
        if (k.length <= 8) {
          expect(masked).toBe("***");
        } else {
          expect(masked.startsWith(k.slice(0, 4))).toBe(true);
          expect(masked.endsWith(k.slice(-4))).toBe(true);
          expect(masked).toContain("...");
          // Middle content should not appear verbatim if key is longer than 12 chars
          if (k.length > 12) {
            const middle = k.slice(5, -5);
            expect(masked).not.toContain(middle);
          }
        }
      }
    });
  });

  // ==========================================================================
  // 6. Advanced Edge Cases & Response Variations
  // ==========================================================================
  describe("6. Advanced Response Variations & Payload Fidelity", () => {
    const key = "AIzaSyD-PayloadTestKey12345678";

    it("passes systemInstruction and generationConfig in request payload properly", async () => {
      let capturedPayload: Record<string, unknown> | null = null;

      const mockFetch: FetchFunction = async (_url, init) => {
        capturedPayload = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: "Config validated" }] } }],
          }),
          { status: 200 },
        );
      };

      await executeGeminiWithFailover({
        candidateKeys: [key],
        systemInstruction: "You are an expert Indonesian civil structural engineer.",
        generationConfig: { temperature: 0.1, maxOutputTokens: 500 },
        contents: [{ parts: [{ text: "Hitung momen lentur balok" }] }],
        fetchFn: mockFetch,
      });

      expect(capturedPayload).not.toBeNull();
      const payloadObj = (capturedPayload ?? {}) as Record<string, unknown>;
      expect(payloadObj.systemInstruction).toEqual({
        parts: [{ text: "You are an expert Indonesian civil structural engineer." }],
      });
      expect(payloadObj.generationConfig).toEqual({
        temperature: 0.1,
        maxOutputTokens: 500,
      });
    });

    it("filters out thinking parts while preserving actual response tokens in Gemini 2.5", async () => {
      const mockFetch: FetchFunction = async () => {
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    { thought: true, text: "Internal reasoning: user asked for beam formula..." },
                    { text: "Mu = 1/8 * q * L^2" },
                  ],
                },
              },
            ],
          }),
          { status: 200 },
        );
      };

      const result = await executeGeminiWithFailover({
        candidateKeys: [key],
        contents: [{ parts: [{ text: "Rumus momen beban merata" }] }],
        fetchFn: mockFetch,
      });

      expect(result?.text).toBe("Mu = 1/8 * q * L^2");
      expect(result?.text).not.toContain("Internal reasoning");
    });

    it("gracefully falls back to thought parts if model returned ONLY thought parts", async () => {
      const mockFetch: FetchFunction = async () => {
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ thought: true, text: "Only thought output available" }],
                },
              },
            ],
          }),
          { status: 200 },
        );
      };

      const result = await executeGeminiWithFailover({
        candidateKeys: [key],
        contents: [{ parts: [{ text: "test" }] }],
        fetchFn: mockFetch,
      });

      expect(result?.text).toBe("Only thought output available");
    });

    it("returns null cleanly when given only empty or whitespace candidate keys", async () => {
      const result = await executeGeminiWithFailover({
        candidateKeys: ["", "   ", "\t"],
        contents: [{ parts: [{ text: "test" }] }],
      });
      expect(result).toBeNull();
    });

    it("normalizes keys with surrounding whitespace in cooldown tracking", () => {
      const unnormalizedKey = "   AIzaSyD-WhitespaceKey123456   ";
      const normalized = "AIzaSyD-WhitespaceKey123456";

      markApiKeyRateLimited(unnormalizedKey);
      expect(isApiKeyOnCooldown(normalized)).toBe(true);
      expect(isApiKeyOnCooldown(unnormalizedKey)).toBe(true);

      resetApiKeyFailures(normalized);
      expect(isApiKeyOnCooldown(unnormalizedKey)).toBe(false);
      expect(isApiKeyOnCooldown(normalized)).toBe(false);
    });
  });
});
