const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("Missing GEMINI_API_KEY");
  process.exit(1);
}

const uri = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;

console.log("==================================================");
console.log("Connecting to Gemini Live WebSocket (gemini-3.8-live Audio-Native)...");
console.log("==================================================");

const ws = new WebSocket(uri);

let audioChunksReceived = 0;
let totalAudioBytes = 0;

ws.onopen = () => {
  console.log(
    "🟢 WebSocket Connected! Sending setup for models/gemini-3.8-live with AUDIO modality...",
  );
  const setupMessage = {
    setup: {
      model: "models/gemini-3.8-live",
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: "Aoede",
            },
          },
        },
      },
      systemInstruction: {
        parts: [
          {
            text: "You are Gemini 3.8 Live. Reply directly with natural audio.",
          },
        ],
      },
    },
  };
  ws.send(JSON.stringify(setupMessage));
};

ws.onmessage = async (event) => {
  let text = "";
  if (typeof event.data === "string") {
    text = event.data;
  } else if (event.data instanceof Blob) {
    text = await event.data.text();
  } else if (Buffer.isBuffer(event.data)) {
    text = event.data.toString("utf-8");
  }

  try {
    const data = JSON.parse(text);
    if (data.setupComplete) {
      console.log("✅ [SetupComplete] Handshake Berhasil! Mengirim input percakapan user...\n");
      const clientMessage = {
        clientContent: {
          turns: [
            {
              role: "user",
              parts: [
                {
                  text: "Halo Gemini! Tolong sebutkan angka satu, dua, tiga dalam bahasa Indonesia.",
                },
              ],
            },
          ],
          turnComplete: true,
        },
      };
      ws.send(JSON.stringify(clientMessage));
      console.log("🎙️ Menunggu streaming audio balasan dari Gemini 3.8 Live...\n");
    }

    if (data.serverContent) {
      const parts = data.serverContent.modelTurn?.parts;
      if (parts) {
        for (const p of parts) {
          if (p.inlineData && p.inlineData.data) {
            audioChunksReceived++;
            const buffer = Buffer.from(p.inlineData.data, "base64");
            totalAudioBytes += buffer.length;
            process.stdout.write(
              `🎵 [Audio Chunk #${audioChunksReceived}: ${buffer.length} bytes PCM (${p.inlineData.mimeType})] `,
            );
          }
          if (p.text) {
            console.log(`\n💬 [Transcript]: ${p.text}`);
          }
        }
      }
      if (data.serverContent.turnComplete) {
        console.log(`\n\n🏁 Turn Selesai!`);
        console.log(`📊 Total Audio Chunks: ${audioChunksReceived}`);
        console.log(`🔊 Total Audio Data: ${totalAudioBytes} bytes (PCM 24kHz)`);
        ws.close();
        process.exit(0);
      }
    }
  } catch (e) {
    console.log("Raw message:", text);
  }
};

ws.onclose = (event) => {
  console.log(`\n🔴 Connection Closed (Code: ${event.code}, Reason: "${event.reason}")`);
};

ws.onerror = (err) => {
  console.error("❌ WebSocket Error:", err);
};

setTimeout(() => {
  console.log("\n⏰ Timeout 20s");
  ws.close();
  process.exit(1);
}, 20000);
