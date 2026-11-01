import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("Missing GEMINI_API_KEY");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

const modelsToTest = [
  "gemini-3.8-live",
  "gemini-3.8-live-extended-thinking",
  "gemini-3-flash-live",
  "gemini-3.5-live-translate",
  "gemini-3.5-transcribe-live",
  "gemini-2.5-flash-native-audio-preview-12-2025",
  "models/gemini-3.8-live",
  "models/gemini-3.8-live-extended-thinking",
  "models/gemini-3-flash-live",
  "models/gemini-3.5-live-translate",
  "models/gemini-3.5-transcribe-live",
  "models/gemini-2.5-flash-native-audio-preview-12-2025",
];

console.log("==================================================");
console.log("Testing Live API Models from Google AI Studio Rate Limit");
console.log("==================================================\n");

// 1. Test WebSocket BidiGenerateContent on v1beta and v1alpha
for (const model of modelsToTest) {
  for (const ver of ["v1beta", "v1alpha"]) {
    const uri = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.${ver}.GenerativeService.BidiGenerateContent?key=${apiKey}`;
    await new Promise((resolve) => {
      try {
        const ws = new WebSocket(uri);
        const timer = setTimeout(() => {
          ws.close();
          resolve(null);
        }, 2500);

        ws.onopen = () => {
          const setup = {
            setup: {
              model: model.startsWith("models/") ? model : `models/${model}`,
              generationConfig: {
                responseModalities: ["AUDIO", "TEXT"],
              },
            },
          };
          ws.send(JSON.stringify(setup));
        };

        ws.onmessage = (event) => {
          clearTimeout(timer);
          console.log(`🎉 [WS BIDI SUCCESS] ver=${ver}, model=${model}`);
          console.log("   Data:", event.data);
          ws.close();
          resolve(null);
        };

        ws.onclose = (e) => {
          clearTimeout(timer);
          if (
            !e.reason.includes("is not found") &&
            !e.reason.includes("is not supported")
          ) {
            console.log(
              `[WS RESULT] ver=${ver}, model=${model}: ${e.code} "${e.reason}"`,
            );
          }
          resolve(null);
        };

        ws.onerror = () => {
          clearTimeout(timer);
          resolve(null);
        };
      } catch {
        resolve(null);
      }
    });
  }
}

// 2. Test generateContentStream with these models
console.log("\nTesting generateContentStream with these models...");
for (const model of [
  "gemini-3.8-live",
  "gemini-3.8-live-extended-thinking",
  "gemini-3-flash-live",
  "gemini-3.5-live-translate",
  "gemini-3.5-transcribe-live",
  "gemini-2.5-flash-native-audio-preview-12-2025",
]) {
  try {
    const res = await ai.models.generateContentStream({
      model,
      contents: [
        { role: "user", parts: [{ text: "Halo tes satu dua tiga." }] },
      ],
    });
    let text = "";
    for await (const chunk of res) {
      text += chunk.text || "";
    }
    console.log(`✅ [STREAM SUCCESS] ${model}: "${text.substring(0, 50)}..."`);
  } catch (err: any) {
    console.log(`❌ [STREAM FAILED] ${model}: ${err.message}`);
  }
}
