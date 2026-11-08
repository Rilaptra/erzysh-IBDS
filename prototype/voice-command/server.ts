import { existsSync } from "node:fs";
import { join } from "node:path";

import { GoogleGenAI } from "@google/genai";

const PORT = Number(process.env.PORT || 3000);
const apiKey = process.env.GEMINI_API_KEY || "";

if (!apiKey) {
  console.warn("⚠️ Warning: GEMINI_API_KEY is not set in environment or .env!");
}

const ai = new GoogleGenAI({ apiKey });
const publicDir = join(import.meta.dir, "public");

interface ProxySession {
  geminiWs: WebSocket;
  queue: string[];
  isOpen: boolean;
}

const activeSessions = new Map<any, ProxySession>();

const server = Bun.serve({
  port: PORT,

  async fetch(req, server) {
    const url = new URL(req.url);

    // 1. Upgrade WebSocket for Gemini Live proxy
    if (url.pathname === "/ws/live") {
      const upgraded = server.upgrade(req);
      if (upgraded) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    // 2. Health & Config
    if (url.pathname === "/api/config") {
      const maskedKey = apiKey
        ? `${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`
        : "Not configured";
      return Response.json({
        hasKey: Boolean(apiKey),
        maskedKey,
        defaultModel: "gemini-3.8-live",
        liveModels: [
          {
            id: "gemini-3.8-live",
            name: "Gemini 3.8 Live (Audio-to-Audio Native)",
            default: true,
          },
          {
            id: "gemini-3.8-live-extended-thinking",
            name: "Gemini 3.8 Live Extended Thinking",
          },
          {
            id: "gemini-2.5-flash-native-audio-preview-12-2025",
            name: "Gemini 2.5 Flash Native Audio Dialog",
          },
          {
            id: "gemini-3.5-transcribe-live",
            name: "Gemini 3.5 Transcribe Live (Text output)",
          },
          {
            id: "gemini-2.5-flash",
            name: "Gemini 2.5 Flash (Standard Stream)",
          },
        ],
      });
    }

    // 3. Server-Sent Events Streaming Generation (for text-based models fallback)
    if (url.pathname === "/api/stream" && req.method === "POST") {
      try {
        const body = await req.json();
        const { prompt, model = "gemini-2.5-flash", systemPrompt, history = [] } = body;

        const actualModel = model.includes("live") ? "gemini-2.5-flash" : model;

        const contents = [
          ...history,
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ];

        const config: any = {};
        if (systemPrompt) {
          config.systemInstruction = systemPrompt;
        }

        const responseStream = await ai.models.generateContentStream({
          model: actualModel,
          contents,
          config,
        });

        const stream = new ReadableStream({
          async start(controller) {
            const encoder = new TextEncoder();
            try {
              for await (const chunk of responseStream) {
                const text = chunk.text || "";
                if (text) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
                }
              }
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
            } catch (streamErr: any) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ error: streamErr.message })}\n\n`),
              );
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      } catch (err: any) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    }

    // 4. Static Files
    let filePath = join(publicDir, url.pathname === "/" ? "index.html" : url.pathname);
    if (!existsSync(filePath)) {
      filePath = join(publicDir, "index.html");
    }

    if (existsSync(filePath)) {
      const file = Bun.file(filePath);
      return new Response(file);
    }

    return new Response("Not Found", { status: 404 });
  },

  websocket: {
    open(ws) {
      console.log("🌐 Browser client connected to /ws/live");
      const targetUri = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;

      try {
        const geminiWs = new WebSocket(targetUri);
        const session: ProxySession = {
          geminiWs,
          queue: [],
          isOpen: false,
        };
        activeSessions.set(ws, session);

        geminiWs.onopen = () => {
          console.log("🟢 Gemini Live upstream socket opened successfully!");
          session.isOpen = true;
          ws.send(
            JSON.stringify({
              type: "connection_status",
              status: "connected_to_gemini",
            }),
          );

          // Flush all queued messages immediately
          while (session.queue.length > 0) {
            const queuedMsg = session.queue.shift();
            console.log("📤 Sending queued message to Gemini upstream...");
            geminiWs.send(queuedMsg);
          }
        };

        geminiWs.onmessage = (event) => {
          // ALWAYS forward as a clean UTF-8 string to prevent Blob parsing errors in browser!
          let text = "";
          if (typeof event.data === "string") {
            text = event.data;
          } else if (Buffer.isBuffer(event.data)) {
            text = event.data.toString("utf-8");
          } else if (event.data instanceof ArrayBuffer) {
            text = new TextDecoder("utf-8").decode(event.data);
          }

          try {
            ws.send(text);
          } catch (e) {
            console.error("Error forwarding message to client:", e);
          }
        };

        geminiWs.onerror = (err: any) => {
          console.error("❌ Gemini Live socket error:", err.message || err);
          ws.send(
            JSON.stringify({
              type: "gemini_error",
              error: err.message || "WebSocket error",
            }),
          );
        };

        geminiWs.onclose = (event) => {
          console.log(
            `🔴 Gemini Live socket closed (Code: ${event.code}, Reason: "${event.reason}")`,
          );
          session.isOpen = false;
          ws.send(
            JSON.stringify({
              type: "gemini_closed",
              code: event.code,
              reason: event.reason,
            }),
          );
        };
      } catch (err: any) {
        console.error("Exception opening Gemini WebSocket:", err);
        ws.send(JSON.stringify({ type: "proxy_error", error: err.message }));
      }
    },

    message(ws, message) {
      const session = activeSessions.get(ws);
      if (!session) return;

      const strMessage = typeof message === "string" ? message : message.toString();

      if (session.isOpen && session.geminiWs.readyState === WebSocket.OPEN) {
        session.geminiWs.send(strMessage);
      } else {
        // Queue message until upstream socket is open
        console.log("⏳ Upstream Gemini socket still handshaking... Queued message.");
        session.queue.push(strMessage);
      }
    },

    close(ws) {
      console.log("🔌 Browser client disconnected from /ws/live");
      const session = activeSessions.get(ws);
      if (session) {
        try {
          session.geminiWs.close();
        } catch {}
        activeSessions.delete(ws);
      }
    },
  },
});

console.log("\n=================================================");
console.log(`✨ Gemini Live Test App running on http://localhost:${PORT}`);
console.log(
  `🔑 Using API Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`,
);
console.log(`🎙️ Supported Live Models:`);
console.log(`   • Gemini 3.8 Live (models/gemini-3.8-live)`);
console.log(`   • Gemini 3.8 Live Extended Thinking`);
console.log(`   • Gemini 2.5 Flash Native Audio Dialog`);
console.log(`   • Gemini 3.5 Transcribe Live`);
console.log("=================================================\n");
