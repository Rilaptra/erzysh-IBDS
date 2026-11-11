/**
 * @file route.ts
 * @description Gemini Live Audio BidiGenerateContent API Endpoint (adapted from prototype/voice-command).
 * Provides:
 * - GET: Returns Gemini Live Bidi WebSocket configuration (models/gemini-3.8-live, voice Aoede).
 * - POST: Connects to Gemini Live BidiGenerateContent WebSocket (models/gemini-3.8-live) and returns
 *   24kHz 16-bit linear PCM audio chunks for natural Indonesian voice responses.
 */

import { NextResponse } from "next/server";

import { appConfig, getGeminiApiKey, getGeminiApiKeys } from "@/config/app-config";
import { markApiKeyRateLimited, maskApiKey, prioritizeApiKeys } from "@/lib/gemini-api-failover";

const GEMINI_LIVE_MODEL = appConfig.ai.liveModel;
const GEMINI_LIVE_VOICE = appConfig.ai.liveVoice;
const BIDI_WS_BASE_URL =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

/**
 * GET /api/ai/live-speech
 * Adapted from prototype/voice-command/server.ts (/api/config).
 * Supplies the client Bidi WebSocket connection parameters for models/gemini-3.8-live.
 */
export async function GET(): Promise<Response> {
  const keys = getGeminiApiKeys();
  const apiKey = getGeminiApiKey();
  const activeKey = prioritizeApiKeys(keys)[0] ?? apiKey;
  if (!activeKey || keys.length === 0) {
    return NextResponse.json(
      { error: "AI_PROVIDER_API_KEY / GEMINI_API_KEY tidak dikonfigurasi." },
      { status: 503 },
    );
  }

  return NextResponse.json({
    apiKey: activeKey,
    totalKeys: keys.length,
    hasBackup: keys.length > 1,
    model: GEMINI_LIVE_MODEL,
    voiceName: GEMINI_LIVE_VOICE,
    wsUrl: `${BIDI_WS_BASE_URL}?key=${activeKey}`,
  });
}

/**
 * Attempts a single Gemini Live WebSocket session for generating 24kHz PCM audio chunks.
 */
async function attemptLiveSpeechAudio(
  apiKey: string,
  text: string,
  voiceName: string,
): Promise<{ chunks: string[]; totalBytes: number }> {
  const wsUrl = `${BIDI_WS_BASE_URL}?key=${apiKey}`;

  return new Promise<{ chunks: string[]; totalBytes: number }>((resolve, reject) => {
    const chunks: string[] = [];
    let totalBytes = 0;
    let settled = false;

    const ws = new WebSocket(wsUrl);

    const timeoutId = setTimeout(() => {
      if (!settled) {
        settled = true;
        try {
          ws.close();
        } catch {
          // Ignore
        }
        if (chunks.length > 0) {
          resolve({ chunks, totalBytes });
        } else {
          reject(new Error("Timeout menunggu respons audio dari Gemini 3.8 Live."));
        }
      }
    }, 9000);

    ws.onopen = () => {
      const setupMsg = {
        setup: {
          model: GEMINI_LIVE_MODEL,
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName,
                },
              },
            },
          },
          systemInstruction: {
            parts: [
              {
                text: "Kamu adalah asisten suara bernama ucuy untuk aplikasi teknik sipil Interactive Beam Deflection & Structural Design Simulator (IBDS). Berikan konfirmasi suara Bahasa Indonesia yang natural, ramah, singkat (1 kalimat padat), dan jelas.",
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
        } else if (ArrayBuffer.isView(event.data)) {
          rawText = new TextDecoder("utf-8").decode(event.data);
        }

        const data = JSON.parse(rawText) as {
          setupComplete?: Record<string, unknown>;
          serverContent?: {
            modelTurn?: {
              parts?: Array<{
                inlineData?: { mimeType?: string; data?: string };
              }>;
            };
            turnComplete?: boolean;
          };
        };

        if (data.setupComplete) {
          const clientTurn = {
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
          };
          ws.send(JSON.stringify(clientTurn));
        }

        if (data.serverContent) {
          const parts = data.serverContent.modelTurn?.parts;
          if (parts) {
            for (const part of parts) {
              if (part.inlineData?.data) {
                chunks.push(part.inlineData.data);
                totalBytes += Math.floor((part.inlineData.data.length * 3) / 4);
              }
            }
          }

          if (data.serverContent.turnComplete) {
            if (!settled) {
              settled = true;
              clearTimeout(timeoutId);
              try {
                ws.close();
              } catch {
                // Ignore
              }
              resolve({ chunks, totalBytes });
            }
          }
        }
      } catch (parseErr) {
        if (!settled) {
          settled = true;
          clearTimeout(timeoutId);
          reject(parseErr instanceof Error ? parseErr : new Error(String(parseErr)));
        }
      }
    };

    ws.onerror = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timeoutId);
        reject(new Error("WebSocket error saat menghubungi Gemini 3.8 Live."));
      }
    };

    ws.onclose = (event: CloseEvent) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeoutId);
        if (chunks.length > 0) {
          resolve({ chunks, totalBytes });
        } else {
          reject(
            new Error(
              `Gemini Live WebSocket ditutup (${event.code}: ${event.reason || "No audio chunks"}).`,
            ),
          );
        }
      }
    };
  });
}

/**
 * POST /api/ai/live-speech
 * Adapted from prototype/voice-command/tests/test-live-38.ts.
 * Opens a BidiGenerateContent WebSocket session to models/gemini-3.8-live with AUDIO modality
 * and streams/collects 24kHz PCM audio chunks with automatic backup API key failover.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as { text?: string; voiceName?: string };
    const text = body.text?.trim();
    const voiceName = body.voiceName?.trim() || GEMINI_LIVE_VOICE;

    if (!text) {
      return NextResponse.json({ error: "Parameter 'text' wajib disertakan." }, { status: 400 });
    }

    const rawKeys = getGeminiApiKeys();
    if (rawKeys.length === 0) {
      return NextResponse.json(
        { error: "AI_PROVIDER_API_KEY / GEMINI_API_KEY tidak dikonfigurasi." },
        { status: 503 },
      );
    }

    const keysToTry = prioritizeApiKeys(rawKeys);

    let result: { chunks: string[]; totalBytes: number } | null = null;
    let lastError: unknown = null;

    for (let keyIdx = 0; keyIdx < keysToTry.length; keyIdx++) {
      const currentKey = keysToTry[keyIdx];
      if (!currentKey) continue;

      try {
        result = await attemptLiveSpeechAudio(currentKey, text, voiceName);
        if (result && result.chunks.length > 0) {
          break;
        }
      } catch (attemptErr) {
        lastError = attemptErr;
        markApiKeyRateLimited(currentKey);

        if (keyIdx + 1 < keysToTry.length) {
          const nextKey = keysToTry[keyIdx + 1];
          console.warn(
            `⚠️ [Live Speech Failover] Kunci API (${maskApiKey(currentKey)}) gagal/limit. Mengalihkan ke kunci cadangan (${maskApiKey(nextKey || "")})...`,
          );
        }
      }
    }

    if (!result || result.chunks.length === 0) {
      const errMsg = lastError instanceof Error ? lastError.message : "Tidak ada audio";
      return NextResponse.json(
        { error: `Gagal menghasilkan audio live dari semua kunci API: ${errMsg}` },
        { status: 502 },
      );
    }

    // Merge all base64 PCM chunks into a single contiguous 16-bit aligned PCM buffer as well
    const decodedArrays: Uint8Array[] = [];
    let combinedLength = 0;
    for (const b64 of result.chunks) {
      const buf = Buffer.from(b64, "base64");
      const aligned = buf.byteLength - (buf.byteLength % 2);
      if (aligned > 0) {
        const slice = new Uint8Array(buf.buffer, buf.byteOffset, aligned);
        decodedArrays.push(slice);
        combinedLength += aligned;
      }
    }

    const merged = new Uint8Array(combinedLength);
    let offset = 0;
    for (const arr of decodedArrays) {
      merged.set(arr, offset);
      offset += arr.byteLength;
    }

    const audioBase64 = Buffer.from(merged).toString("base64");

    return NextResponse.json({
      audioBase64,
      chunks: result.chunks,
      mimeType: "audio/pcm;rate=24000",
      sampleRate: 24000,
      model: GEMINI_LIVE_MODEL,
      voiceName,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
