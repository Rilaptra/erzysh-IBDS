const apiKey = process.env.GEMINI_API_KEY;

const models = [
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
    id: "models/gemini-3.5-transcribe-live",
    name: "Gemini 3.5 Transcribe Live",
    modality: ["TEXT"],
  },
  {
    id: "models/gemini-2.5-flash-native-audio-preview-12-2025",
    name: "Gemini 2.5 Flash Native Audio Dialog",
    modality: ["AUDIO"],
  },
];

for (const m of models) {
  const uri = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;
  await new Promise((resolve) => {
    try {
      const ws = new WebSocket(uri);
      const timer = setTimeout(() => {
        console.log(`⏱️ [TIMEOUT] ${m.name}`);
        ws.close();
        resolve(null);
      }, 3500);

      ws.onopen = () => {
        const genConfig: any = { responseModalities: m.modality };
        if (m.thinking) {
          genConfig.thinkingConfig = { thinkingLevel: 1 };
        }
        ws.send(
          JSON.stringify({
            setup: {
              model: m.id,
              generationConfig: genConfig,
            },
          }),
        );
      };

      ws.onmessage = (e) => {
        clearTimeout(timer);
        console.log(
          `✅ [SUCCESS] ${m.name} (${m.id}) -> Setup Complete! Modality: ${JSON.stringify(m.modality)}`,
        );
        ws.close();
        resolve(null);
      };

      ws.onclose = (e) => {
        clearTimeout(timer);
        console.log(`❌ [CLOSED] ${m.name} (${m.id}): code=${e.code}, reason="${e.reason}"`);
        resolve(null);
      };

      ws.onerror = (e) => {
        clearTimeout(timer);
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}
