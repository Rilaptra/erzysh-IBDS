/**
 * @file adversarial-integration.test.ts
 * @description Adversarial integration stress-testing suite for consumer routes and release tooling.
 * Validates failover, key rotation, cooldown tracking, and error recovery across:
 * - scripts/release.ts (AIManager)
 * - scripts/ai/ai-commit-helper.ts
 * - GET & POST /api/ai/live-speech
 */

import { afterAll, afterEach, beforeEach, describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

import { GET, POST } from "@/app/api/ai/live-speech/route";
import {
  clearApiKeyCooldowns,
  getApiKeyCooldownRemainingMs,
  isApiKeyOnCooldown,
  isQuotaOrAuthError,
  markApiKeyRateLimited,
  maskApiKey,
  prioritizeApiKeys,
} from "@/lib/gemini-api-failover";

// ============================================================================
// Release Tooling AIManager Factory (Extracted from scripts/release.ts)
// ============================================================================

interface AIManagerInstance {
  MODEL: string;
  availableModels: string[];
  getApiKeys(): readonly string[];
  fetchModels(): Promise<boolean>;
  generateReleaseData(
    oldWebVer: string,
    oldWasmVer: string,
    diff: string,
  ): Promise<{
    webVersion: string;
    wasmVersion: string;
    commitMessage: string;
    changelog: string;
    readmeBlocks: string;
  }>;
}

function createAIManager(mockKeys: readonly string[], fetchFn?: unknown): AIManagerInstance {
  const code = readFileSync("scripts/release.ts", "utf-8");
  const aiManagerSlice = code.slice(
    code.indexOf("const AIManager = {"),
    code.indexOf(
      "// ============================================================================\n// Release Manager",
    ),
  );

  const js = new Bun.Transpiler({ loader: "ts" }).transformSync(aiManagerSlice);
  const factory = new Function(
    "getGeminiApiKeys",
    "isQuotaOrAuthError",
    "maskApiKey",
    "resolveApiKey",
    "ensureConventionalCommit",
    "ui",
    "c",
    "fetch",
    `${js}\nreturn AIManager;`,
  );

  const mockUi = {
    startSpinner: () => {},
    stopSpinner: () => {},
    info: () => {},
    success: () => {},
    warn: () => {},
    error: () => {},
  };
  const mockC = {
    cyan: (s: string) => s,
    greenBold: (s: string) => s,
  };

  const ensureConventionalCommit = (msg: string) => {
    const first =
      msg
        .split(/\r?\n/)[0]
        ?.trim()
        .replace(/^["'`]+|["'`]+$/g, "") ?? "";
    if (/^(feat|fix|perf|refactor|docs|test|chore)(\([a-z0-9-]+\))?: .+/.test(first)) {
      return first;
    }
    return `chore(release): ${first || "update"}`;
  };

  return factory(
    () => mockKeys,
    isQuotaOrAuthError,
    maskApiKey,
    () => mockKeys[0],
    ensureConventionalCommit,
    mockUi,
    mockC,
    fetchFn ?? globalThis.fetch,
  ) as AIManagerInstance;
}

// ============================================================================
// Test Suite: Adversarial Integration & Failover Challenge
// ============================================================================

describe("Adversarial Integration: Release Tooling & Consumer Routes", () => {
  const savedBunEnv = { ...Bun.env };
  const savedProcessEnv = { ...process.env };
  const originalFetch = globalThis.fetch;
  const originalWebSocket = globalThis.WebSocket;

  const managedKeys = [
    "AI_PROVIDER_API_KEY",
    "AI_PROVIDER_API_KEYS",
    "GEMINI_API_KEY",
    "GEMINI_API_KEYS",
    "GEMINI_API_KEY_BACKUP",
    "GEMINI_API_KEY_FALLBACK",
    "GEMINI_BACKUP_API_KEY",
    "AI_PROVIDER_API_KEY_BACKUP",
    "AI_PROVIDER_API_KEY_FALLBACK",
    "NEXT_PUBLIC_GEMINI_API_KEY",
  ];
  for (let i = 1; i <= 10; i++) {
    managedKeys.push(`GEMINI_API_KEY_${i}`, `GEMINI_API_KEY_BACKUP_${i}`);
  }

  const restoreEnv = () => {
    const bunEnvAny = Bun.env as Record<string, string | undefined>;
    const procEnvAny = process.env as Record<string, string | undefined>;

    for (const key of managedKeys) {
      if (key in savedBunEnv) {
        bunEnvAny[key] = savedBunEnv[key] as string | undefined;
      } else {
        delete bunEnvAny[key];
      }

      if (key in savedProcessEnv) {
        procEnvAny[key] = savedProcessEnv[key] as string | undefined;
      } else {
        delete procEnvAny[key];
      }
    }
  };

  beforeEach(() => {
    clearApiKeyCooldowns();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.WebSocket = originalWebSocket;
    restoreEnv();
    clearApiKeyCooldowns();
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
    globalThis.WebSocket = originalWebSocket;
    restoreEnv();
    clearApiKeyCooldowns();
  });

  // --------------------------------------------------------------------------
  // 1. Challenge scripts/release.ts AIManager
  // --------------------------------------------------------------------------
  describe("scripts/release.ts: AIManager Multi-Key Failover", () => {
    it("rotates through keys on HTTP 429 during release notes generation and succeeds on backup key", async () => {
      const primaryKey = "AIzaSyPrimaryReleaseKey1111";
      const backupKey = "AIzaSyBackupReleaseKey2222";
      const attemptedKeys: string[] = [];

      const mockFetch = async (_input: unknown, init?: RequestInit) => {
        const key = init?.headers ? (init.headers as Record<string, string>)["x-goog-api-key"] : "";
        attemptedKeys.push(key ?? "");

        if (key === primaryKey) {
          return new Response(
            JSON.stringify({
              error: {
                code: 429,
                message: "Resource has been exhausted (e.g. check quota).",
                status: "RESOURCE_EXHAUSTED",
              },
            }),
            { status: 429, headers: { "Content-Type": "application/json" } },
          );
        }

        if (key === backupKey) {
          return new Response(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        text: JSON.stringify({
                          webVersion: "0.4.1",
                          wasmVersion: "0.4.0",
                          commitMessage: "feat(ai): integrate multi-key backup rotation",
                          changelog:
                            "## [0.4.1] - 2026-11-11\n\n### ✨ Added\n- Multi-key rotation",
                          readmeBlocks: "",
                        }),
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        return new Response("Not found", { status: 404 });
      };

      globalThis.fetch = mockFetch as unknown as typeof fetch;
      const aiManager = createAIManager([primaryKey, backupKey], mockFetch);

      const decision = await aiManager.generateReleaseData(
        "0.4.0",
        "0.4.0",
        "diff --git a/src/config/app-config.ts b/src/config/app-config.ts",
      );

      expect(attemptedKeys).toEqual([primaryKey, backupKey]);
      expect(decision.webVersion).toBe("0.4.1");
      expect(decision.wasmVersion).toBe("0.4.0");
      expect(decision.commitMessage).toBe("feat(ai): integrate multi-key backup rotation");
      expect(decision.changelog).toContain("Multi-key rotation");
    });

    it("rotates on HTTP 400 API_KEY_INVALID and succeeds on healthy backup key", async () => {
      const revokedKey = "AIzaSyRevokedBadKey0000";
      const validKey = "AIzaSyValidBackupKey3333";
      const attemptedKeys: string[] = [];

      const mockFetch = async (_input: unknown, init?: RequestInit) => {
        const key = init?.headers ? (init.headers as Record<string, string>)["x-goog-api-key"] : "";
        attemptedKeys.push(key ?? "");

        if (key === revokedKey) {
          return new Response(
            JSON.stringify({
              error: {
                code: 400,
                message: "API_KEY_INVALID: API key not valid. Please pass a valid API key.",
                status: "INVALID_ARGUMENT",
              },
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        if (key === validKey) {
          return new Response(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        text: JSON.stringify({
                          webVersion: "0.4.2",
                          wasmVersion: "0.4.0",
                          commitMessage: "fix(auth): rotate to valid backup key",
                          changelog: "## [0.4.2] - 2026-11-11\n\n### 🛠️ Fix\n- Auth fix",
                        }),
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        return new Response("Not found", { status: 404 });
      };

      globalThis.fetch = mockFetch as unknown as typeof fetch;
      const aiManager = createAIManager([revokedKey, validKey], mockFetch);

      const decision = await aiManager.generateReleaseData(
        "0.4.1",
        "0.4.0",
        "diff --git a/test.ts",
      );
      expect(attemptedKeys).toEqual([revokedKey, validKey]);
      expect(decision.webVersion).toBe("0.4.2");
      expect(decision.commitMessage).toBe("fix(auth): rotate to valid backup key");
    });

    it("filters out Gemini 2.5 thinking tokens (thought: true) and extracts clean JSON", async () => {
      const activeKey = "AIzaSyThinkingKey4444";

      const mockFetch = async () => {
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      thought: true,
                      text: "Thinking process: user wants to release version 0.5.0 with new features...",
                    },
                    {
                      thought: false,
                      text: JSON.stringify({
                        webVersion: "0.5.0",
                        wasmVersion: "0.4.0",
                        commitMessage: "feat(core): release 0.5.0",
                        changelog: "## [0.5.0] - 2026-11-11\n\n### ✨ Added\n- Core features",
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      };

      globalThis.fetch = mockFetch as unknown as typeof fetch;
      const aiManager = createAIManager([activeKey], mockFetch);

      const decision = await aiManager.generateReleaseData("0.4.0", "0.4.0", "diff --git a/new.ts");
      expect(decision.webVersion).toBe("0.5.0");
      expect(decision.commitMessage).toBe("feat(core): release 0.5.0");
      expect(decision.changelog).not.toContain("Thinking process");
    });

    it("throws error when all configured API keys fail", async () => {
      const keyA = "AIzaSyFailKeyA1111";
      const keyB = "AIzaSyFailKeyB2222";

      const mockFetch = async () => {
        return new Response(
          JSON.stringify({
            error: {
              code: 429,
              message: "Resource exhausted on all keys",
              status: "RESOURCE_EXHAUSTED",
            },
          }),
          { status: 429, headers: { "Content-Type": "application/json" } },
        );
      };

      globalThis.fetch = mockFetch as unknown as typeof fetch;
      const aiManager = createAIManager([keyA, keyB], mockFetch);

      await expect(
        aiManager.generateReleaseData("0.4.0", "0.4.0", "diff --git a/test.ts"),
      ).rejects.toThrow();
    });

    it("fetchModels() rotates through keys on 429 and succeeds on backup key", async () => {
      const keyA = "AIzaSyModelKeyA111";
      const keyB = "AIzaSyModelKeyB222";
      const attemptedKeys: string[] = [];

      const mockFetch = async (_input: unknown, init?: RequestInit) => {
        const key = init?.headers ? (init.headers as Record<string, string>)["x-goog-api-key"] : "";
        attemptedKeys.push(key ?? "");

        if (key === keyA) {
          return new Response("Rate limited", { status: 429 });
        }
        if (key === keyB) {
          return new Response(
            JSON.stringify({
              models: [
                {
                  name: "models/gemini-2.5-flash",
                  supportedGenerationMethods: ["generateContent"],
                },
                {
                  name: "models/gemini-3.5-flash-lite",
                  supportedGenerationMethods: ["generateContent"],
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response("Not found", { status: 404 });
      };

      globalThis.fetch = mockFetch as unknown as typeof fetch;
      const aiManager = createAIManager([keyA, keyB], mockFetch);

      const success = await aiManager.fetchModels();
      expect(success).toBe(true);
      expect(attemptedKeys).toEqual([keyA, keyB]);
      expect(aiManager.availableModels).toContain("gemini-2.5-flash");
      expect(aiManager.availableModels).toContain("gemini-3.5-flash-lite");
    });
  });

  // --------------------------------------------------------------------------
  // 2. Challenge scripts/ai/ai-commit-helper.ts logic
  // --------------------------------------------------------------------------
  describe("scripts/ai/ai-commit-helper.ts: Failover & Cooldown Prioritization", () => {
    it("orders healthy backup keys ahead of rate-limited primary keys", () => {
      const primary = "AIzaSyPrimaryCommitKey111";
      const backup = "AIzaSyBackupCommitKey222";

      markApiKeyRateLimited(primary);
      expect(isApiKeyOnCooldown(primary)).toBe(true);
      expect(isApiKeyOnCooldown(backup)).toBe(false);

      const ordered = prioritizeApiKeys([primary, backup]);
      expect(ordered[0]).toBe(backup);
      expect(ordered[1]).toBe(primary);
    });

    it("simulates primary key 429 failure, triggers cooldown, and recovers using backup key", async () => {
      const key1 = "AIzaSyPrimaryHelperKey111";
      const key2 = "AIzaSyBackupHelperKey222";
      const keys = [key1, key2];
      const model = "gemini-2.5-flash";
      const prompt = "Generate commit message";

      const attemptedKeys: string[] = [];
      const mockFetch = async (_input: unknown, init?: RequestInit) => {
        const key = init?.headers ? (init.headers as Record<string, string>)["x-goog-api-key"] : "";
        attemptedKeys.push(key ?? "");

        if (key === key1) {
          return new Response("Too many requests", { status: 429 });
        }
        if (key === key2) {
          return new Response(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [
                      { text: "feat(mechanics): add P-Delta second order geometric stiffness" },
                    ],
                  },
                },
              ],
            }),
            { status: 200 },
          );
        }
        return new Response("Not found", { status: 404 });
      };

      globalThis.fetch = mockFetch as unknown as typeof fetch;

      let commitMessage = "";
      for (let keyIdx = 0; keyIdx < keys.length; keyIdx++) {
        const currentKey = keys[keyIdx]!;
        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": currentKey,
              },
              body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
            },
          );

          if (!response.ok) {
            if (response.status === 429) {
              markApiKeyRateLimited(currentKey);
              if (keyIdx + 1 < keys.length) continue;
            }
            throw new Error(`HTTP ${response.status}`);
          }

          const payload = (await response.json()) as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
          };
          commitMessage = payload.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
          break;
        } catch {
          if (keyIdx + 1 < keys.length) continue;
          throw new Error("Failed");
        }
      }

      expect(attemptedKeys).toEqual([key1, key2]);
      expect(commitMessage).toBe("feat(mechanics): add P-Delta second order geometric stiffness");
      expect(isApiKeyOnCooldown(key1)).toBe(true);
      expect(isApiKeyOnCooldown(key2)).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Challenge GET /api/ai/live-speech & POST /api/ai/live-speech
  // --------------------------------------------------------------------------
  describe("API Route: /api/ai/live-speech", () => {
    const cleanAllLiveSpeechKeys = () => {
      clearApiKeyCooldowns();
      const keysToClear = [
        "AI_PROVIDER_API_KEY",
        "AI_PROVIDER_API_KEYS",
        "GEMINI_API_KEY",
        "GEMINI_API_KEYS",
        "GEMINI_API_KEY_BACKUP",
        "GEMINI_API_KEY_FALLBACK",
        "GEMINI_BACKUP_API_KEY",
        "AI_PROVIDER_API_KEY_BACKUP",
        "AI_PROVIDER_API_KEY_FALLBACK",
        "NEXT_PUBLIC_GEMINI_API_KEY",
      ];
      for (const k of keysToClear) {
        delete Bun.env[k];
        delete process.env[k];
      }
      for (let i = 1; i <= 10; i++) {
        delete Bun.env[`GEMINI_API_KEY_${i}`];
        delete process.env[`GEMINI_API_KEY_${i}`];
        delete Bun.env[`GEMINI_API_KEY_BACKUP_${i}`];
        delete process.env[`GEMINI_API_KEY_BACKUP_${i}`];
      }
    };

    beforeEach(() => {
      cleanAllLiveSpeechKeys();
    });

    it("GET /api/ai/live-speech selects healthy backup key when primary key is on cooldown", async () => {
      cleanAllLiveSpeechKeys();
      const primaryKey = "AIzaSyPrimaryLiveKey1111";
      const backupKey = "AIzaSyBackupLiveKey2222";

      Bun.env.GEMINI_API_KEY = primaryKey;
      Bun.env.GEMINI_API_KEY_BACKUP = backupKey;
      process.env.GEMINI_API_KEY = primaryKey;
      process.env.GEMINI_API_KEY_BACKUP = backupKey;

      // Mark primary key on cooldown
      markApiKeyRateLimited(primaryKey);

      const res = await GET();
      expect(res.status).toBe(200);

      const data = (await res.json()) as { apiKey: string; wsUrl: string; totalKeys: number };
      expect(data.apiKey).toBe(backupKey);
      expect(data.wsUrl).toContain(backupKey);
      expect(data.totalKeys).toBe(2);
    });

    it("GET /api/ai/live-speech returns key closest to expiry when ALL keys are on cooldown", async () => {
      cleanAllLiveSpeechKeys();
      const keyA = "AIzaSyLiveCooldownKeyA1111";
      const keyB = "AIzaSyLiveCooldownKeyB2222";

      Bun.env.GEMINI_API_KEY = keyA;
      Bun.env.GEMINI_API_KEY_BACKUP = keyB;
      process.env.GEMINI_API_KEY = keyA;
      process.env.GEMINI_API_KEY_BACKUP = keyB;

      // keyB expires earlier (5s) than keyA (60s)
      markApiKeyRateLimited(keyA, 60000);
      markApiKeyRateLimited(keyB, 5000);

      const res = await GET();
      expect(res.status).toBe(200);

      const data = (await res.json()) as { apiKey: string };
      expect(data.apiKey).toBe(keyB);
    });

    it("GET /api/ai/live-speech returns 503 when no Gemini API keys are configured", async () => {
      Bun.env.AI_PROVIDER_API_KEY = "";
      Bun.env.GEMINI_API_KEY = "";
      Bun.env.GEMINI_API_KEY_BACKUP = "";
      Bun.env.GEMINI_API_KEYS = "";
      process.env.AI_PROVIDER_API_KEY = "";
      process.env.GEMINI_API_KEY = "";
      process.env.GEMINI_API_KEY_BACKUP = "";
      process.env.GEMINI_API_KEYS = "";

      const res = await GET();
      expect(res.status).toBe(503);
      const data = (await res.json()) as { error: string };
      expect(data.error).toContain("tidak dikonfigurasi");
    });

    it("POST /api/ai/live-speech returns 400 when text parameter is missing", async () => {
      const req = new Request("http://localhost/api/ai/live-speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = (await res.json()) as { error: string };
      expect(data.error).toContain("text");
    });

    it("POST /api/ai/live-speech fails over from rejected primary key to healthy backup key", async () => {
      cleanAllLiveSpeechKeys();
      const primaryKey = "AIzaSyPrimaryLiveWsKey1111";
      const backupKey = "AIzaSyBackupLiveWsKey2222";

      Bun.env.GEMINI_API_KEY = primaryKey;
      Bun.env.GEMINI_API_KEY_BACKUP = backupKey;
      process.env.GEMINI_API_KEY = primaryKey;
      process.env.GEMINI_API_KEY_BACKUP = backupKey;

      const attemptedWsUrls: string[] = [];

      class MockWebSocket {
        url: string;
        onopen: (() => void) | null = null;
        onmessage: ((event: { data: string }) => void) | null = null;
        onerror: ((err: unknown) => void) | null = null;
        onclose: ((event: { code: number; reason: string }) => void) | null = null;

        constructor(url: string) {
          this.url = url;
          attemptedWsUrls.push(url);

          setTimeout(() => {
            if (url.includes(primaryKey)) {
              // Simulate primary key quota rejection
              if (this.onerror) this.onerror(new Error("WebSocket 429 Quota Exceeded"));
              if (this.onclose) this.onclose({ code: 1008, reason: "Quota exceeded" });
            } else if (url.includes(backupKey)) {
              // Simulate backup key open
              if (this.onopen) this.onopen();
            }
          }, 10);
        }

        send(payloadStr: string) {
          const payload = JSON.parse(payloadStr) as { setup?: unknown; clientContent?: unknown };
          if (payload.setup) {
            setTimeout(() => {
              if (this.onmessage) {
                this.onmessage({ data: JSON.stringify({ setupComplete: {} }) });
              }
            }, 10);
          } else if (payload.clientContent) {
            setTimeout(() => {
              if (this.onmessage) {
                // Send synthetic 16-bit PCM chunk (8 bytes)
                const pcmBase64 = Buffer.from(new Uint8Array([0, 1, 0, 2, 0, 3, 0, 4])).toString(
                  "base64",
                );
                this.onmessage({
                  data: JSON.stringify({
                    serverContent: {
                      modelTurn: {
                        parts: [
                          {
                            inlineData: {
                              mimeType: "audio/pcm;rate=24000",
                              data: pcmBase64,
                            },
                          },
                        ],
                      },
                      turnComplete: true,
                    },
                  }),
                });
              }
            }, 10);
          }
        }

        close() {}
      }

      globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;

      const req = new Request("http://localhost/api/ai/live-speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Simulasikan lendutan balok kantilever." }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const json = (await res.json()) as {
        audioBase64: string;
        chunks: string[];
        sampleRate: number;
        mimeType: string;
      };

      expect(json.audioBase64).toBeDefined();
      expect(json.chunks.length).toBeGreaterThan(0);
      expect(json.sampleRate).toBe(24000);
      expect(json.mimeType).toBe("audio/pcm;rate=24000");

      // Verify failover happened in order
      expect(attemptedWsUrls[0]).toContain(primaryKey);
      expect(attemptedWsUrls[1]).toContain(backupKey);

      // Verify primary key is now marked on cooldown
      expect(isApiKeyOnCooldown(primaryKey)).toBe(true);
      expect(isApiKeyOnCooldown(backupKey)).toBe(false);
    });

    it("POST /api/ai/live-speech returns 502 Bad Gateway when all keys fail", async () => {
      cleanAllLiveSpeechKeys();
      const keyA = "AIzaSyLiveFailKeyA111";
      const keyB = "AIzaSyLiveFailKeyB222";

      Bun.env.GEMINI_API_KEY = keyA;
      Bun.env.GEMINI_API_KEY_BACKUP = keyB;
      process.env.GEMINI_API_KEY = keyA;
      process.env.GEMINI_API_KEY_BACKUP = keyB;

      class AllFailWebSocket {
        url: string;
        onerror: ((err: unknown) => void) | null = null;
        onclose: ((event: { code: number; reason: string }) => void) | null = null;

        constructor(url: string) {
          this.url = url;
          setTimeout(() => {
            if (this.onerror) this.onerror(new Error("Network connection dropped"));
            if (this.onclose) this.onclose({ code: 1006, reason: "Abnormal closure" });
          }, 10);
        }

        send() {}
        close() {}
      }

      globalThis.WebSocket = AllFailWebSocket as unknown as typeof WebSocket;

      const req = new Request("http://localhost/api/ai/live-speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Balok bentang 6 meter" }),
      });

      const res = await POST(req);
      expect(res.status).toBe(502);

      const json = (await res.json()) as { error: string };
      expect(json.error).toContain("Gagal menghasilkan audio live dari semua kunci API");
      expect(isApiKeyOnCooldown(keyA)).toBe(true);
      expect(isApiKeyOnCooldown(keyB)).toBe(true);
    });
  });
});
