const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("❌ Error: GEMINI_API_KEY is not set in environment or .env file.");
  process.exit(1);
}

console.log("=================================================");
console.log("🚀 Testing Gemini Live API Models (Bun + TypeScript)");
console.log(`🔑 Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`);
console.log("=================================================\n");

const liveModels = [
  {
    id: "models/gemini-3.8-live",
    name: "Gemini 3.8 Live",
    modality: ["AUDIO"],
  },
  {
    id: "models/gemini-3.8-live-extended-thinking",
    name: "Gemini 3.8 Live Extended Thinking",
    modality: ["AUDIO"],
    thinking: true,
  },
  {
    id: "models/gemini-2.5-flash-native-audio-preview-12-2025",
    name: "Gemini 2.5 Flash Native Audio Dialog",
    modality: ["AUDIO"],
  },
  {
    id: "models/gemini-3.5-transcribe-live",
    name: "Gemini 3.5 Transcribe Live",
    modality: ["TEXT"],
  },
];

async function runLiveTests() {
  for (const item of liveModels) {
    process.stdout.write(`🎙️ Testing ${item.name} (${item.id})... `);
    const uri = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;

    await new Promise((resolve) => {
      try {
        const ws = new WebSocket(uri);
        const timer = setTimeout(() => {
          console.log("⚠️ TIMEOUT (5s)");
          ws.close();
          resolve(null);
        }, 5000);

        ws.onopen = () => {
          const genConfig: any = { responseModalities: item.modality };
          if (item.thinking) {
            genConfig.thinkingConfig = { thinkingLevel: 1 };
          }
          if (item.modality.includes("AUDIO")) {
            genConfig.speechConfig = {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: "Aoede" },
              },
            };
          }
          ws.send(
            JSON.stringify({
              setup: {
                model: item.id,
                generationConfig: genConfig,
              },
            }),
          );
        };

        ws.onmessage = (e) => {
          clearTimeout(timer);
          console.log("✅ CONNECTED & HANDSHAKE OK!");
          ws.close();
          resolve(null);
        };

        ws.onclose = (e) => {
          clearTimeout(timer);
          if (e.code === 1000) {
            // normal closure
          } else {
            console.log(`❌ FAILED (Code: ${e.code}, Reason: "${e.reason}")`);
          }
          resolve(null);
        };

        ws.onerror = (err) => {
          clearTimeout(timer);
          console.log("❌ ERROR");
          resolve(null);
        };
      } catch (err: any) {
        console.log(`❌ EXCEPTION: ${err.message}`);
        resolve(null);
      }
    });
  }

  console.log("\n=================================================");
  console.log("🎉 All Live Models Tested! Open http://localhost:3000 to interact.");
  console.log("=================================================");
}

runLiveTests();
