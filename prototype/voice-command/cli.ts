import { stdin as input, stdout as output } from "node:process";
import * as readline from "node:readline/promises";

import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("❌ GEMINI_API_KEY environment variable is missing.");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });
let currentModel = "gemini-2.5-flash";

interface ChatTurn {
  role: "user" | "model";
  parts: [{ text: string }];
}

const chatHistory: ChatTurn[] = [];

console.clear();
console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║           🌟 GEMINI LIVE STREAMING CLI (Bun + TS)            ║");
console.log("╚══════════════════════════════════════════════════════════════╝");
console.log(`🤖 Model: \x1b[36m${currentModel}\x1b[0m`);
console.log(
  `🔑 Key:   \x1b[33m${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}\x1b[0m`,
);
console.log(
  "\nKetik pesan dan tekan [Enter]. Ketik '/help' untuk bantuan, '/exit' untuk keluar.\n",
);

const rl = readline.createInterface({ input, output });

async function main() {
  while (true) {
    const userInput = await rl.question("\x1b[32mYou > \x1b[0m");
    const trimmed = userInput.trim();

    if (!trimmed) continue;

    if (trimmed.toLowerCase() === "/exit" || trimmed.toLowerCase() === "exit") {
      console.log("\n👋 Sampai jumpa!");
      break;
    }

    if (trimmed.toLowerCase() === "/clear") {
      chatHistory.length = 0;
      console.clear();
      console.log("🧹 Riwayat percakapan dibersihkan.\n");
      continue;
    }

    if (trimmed.toLowerCase() === "/help") {
      console.log("\nPerintah yang tersedia:");
      console.log("  /exit          - Keluar dari CLI");
      console.log("  /clear         - Bersihkan riwayat percakapan");
      console.log("  /model <name>  - Ganti model (misal: /model gemini-2.5-pro)");
      console.log("  /models        - Lihat daftar model populer\n");
      continue;
    }

    if (trimmed.startsWith("/model ")) {
      const newModel = trimmed.substring(7).trim();
      currentModel = newModel;
      console.log(`🔄 Model diganti menjadi: \x1b[36m${currentModel}\x1b[0m\n`);
      continue;
    }

    if (trimmed.toLowerCase() === "/models") {
      console.log("\nRekomendasi model:");
      console.log("  • gemini-2.5-flash        (Sangat cepat, multimodal, default)");
      console.log("  • gemini-2.5-pro          (Kemampuan reasoning tinggi)");
      console.log("  • gemini-2.5-flash-lite   (Paling ringan & hemat token)");
      console.log("  • gemini-3.5-flash        (Next-gen flash)\n");
      continue;
    }

    // Add user turn to history
    chatHistory.push({
      role: "user",
      parts: [{ text: trimmed }],
    });

    process.stdout.write("\x1b[35mGemini Live > \x1b[0m");

    const startTime = Date.now();
    let responseText = "";

    try {
      const responseStream = await ai.models.generateContentStream({
        model: currentModel,
        contents: chatHistory as any,
      });

      for await (const chunk of responseStream) {
        const text = chunk.text || "";
        process.stdout.write(text);
        responseText += text;
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      process.stdout.write(`\n\x1b[90m[${elapsed}s | ${responseText.length} chars]\x1b[0m\n\n`);

      // Add model turn to history
      chatHistory.push({
        role: "model",
        parts: [{ text: responseText }],
      });
    } catch (err: any) {
      console.error(`\n❌ Error streaming: ${err.message || err}\n`);
      // Remove failed user turn
      chatHistory.pop();
    }
  }

  rl.close();
  process.exit(0);
}

main();
