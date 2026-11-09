/**
 * @file route.ts
 * @description Natural language command intent router & dynamic AI suggestion engine.
 * Maps voice or text transcripts in Indonesian & English to discrete simulator CommandId
 * and typed parameters covering ALL application buttons, windows, and parameters.
 * Uses Google Gemini API (gemini-2.5-flash) to generate fluid, context-aware suggestions,
 * multi-command compound executions, and natural speech confirmations, falling back gracefully
 * to a high-speed deterministic matching engine.
 */

import { appConfig } from "@/config/app-config";
import { generateContextualSuggestions, matchRuleBasedIntent } from "@/lib/command-matcher";
import type {
  CommandId,
  IntentActionItem,
  IntentRouterResult,
} from "@/types/command-registry-types";

// Re-export matching utilities for consumers & tests
export { generateContextualSuggestions, matchRuleBasedIntent };

// ============================================================================
// Google Gemini Multimodal Intent & Dynamic Suggestion Classifier
// ============================================================================

/**
 * Classifies transcript using Google Gemini API structured output and returns
 * both the classified commands (single or multi-action array) and fluid, context-aware next-action suggestions.
 */
async function classifyIntentViaGemini(
  transcript: string,
  apiKey: string,
  currentState?: Record<string, unknown>,
): Promise<IntentRouterResult | null> {
  const preferredModel = appConfig.ai.intentModel;
  const candidateModels = [preferredModel];

  const systemInstruction = `Kamu adalah AI Natural Language Intent Router & Suggestion Generator untuk simulator struktur teknik sipil IBDS (Interactive Beam Deflection Simulator).
Pengguna dapat mengontrol SEMUA tombol, kontrol tampilan, parameter, beban, dan jendela di aplikasi menggunakan perintah suara santai atau formal dalam Bahasa Indonesia / Inggris.

DAFTAR COMMAND ID YANG TERSEDIA:
- MATERIAL: SWITCH_MATERIAL_CONCRETE, SWITCH_MATERIAL_STEEL
- VIEWPORT & KAMERA:
  * SET_VIEW_ISOMETRIC (tampilan 3D isometrik)
  * SET_VIEW_FRONT (tampak depan 2D ortogonal)
  * FIT_CAMERA_VIEW (fit / fokuskan balok / zoom fit)
  * SET_CONCRETE_VIEW_SOLID (mode solid + potongan ujung beton)
  * SET_CONCRETE_VIEW_WIREFRAME (mode wireframe tulangan rebar cage)
  * SET_COORDINATE_Z_UP (sumbu Z ke atas standar sipil)
  * SET_COORDINATE_Y_UP (sumbu Y ke atas standar CAD)
- PROFIL & FILTER BAJA:
  * FILTER_STEEL_IWF, FILTER_STEEL_BOX, FILTER_STEEL_ALL
  * SELECT_STEEL_PROFILE (params: profileName: string, misal "IWF 300x150")
  * SET_STEEL_GRADE (params: steelGrade: "BJ_34"|"BJ_37"|"BJ_41"|"BJ_50"|"BJ_55")
- BETON BERTULANG:
  * SET_CONCRETE_FC (params: fcMpa: number)
  * SET_CONCRETE_DIMENSIONS (params: bwMm: number, hMm: number)
- DIAGRAM GAYA DALAM:
  * TOGGLE_DIAGRAM_BMD, TOGGLE_DIAGRAM_SFD, TOGGLE_DIAGRAM_NFD, TOGGLE_DIAGRAM_TFD
  * SET_DIAGRAM_MODE_IN_PLACE, SET_DIAGRAM_MODE_STACKED, SET_DIAGRAM_MODE_WINDOW
- TUMPUAN:
  * SET_SUPPORT_PINNED_ROLLER (sendi-rol), SET_SUPPORT_FIXED_ROLLER (jepit-rol), SET_SUPPORT_FIXED_FIXED (jepit-jepit), SET_SUPPORT_FIXED_PINNED (jepit-sendi), SET_SUPPORT_CANTILEVER (kantilever)
- BEBAN & PARADIGMA:
  * SWITCH_MODE_EXTERNAL_LOADS, SWITCH_MODE_DIRECT_FORCES
  * SET_SPAN_LENGTH (params: spanLengthM: number)
  * ADD_POINT_LOAD (params: magnitudeKn: number, positionM?: number)
  * REMOVE_POINT_LOAD
  * ADD_DISTRIBUTED_LOAD (params: magnitudeKnPerM: number)
  * REMOVE_DISTRIBUTED_LOAD
  * CLEAR_ALL_LOADS
  * TOGGLE_SELF_WEIGHT
  * SET_DEFLECTION_LIMIT (params: denominator: 180|240|360|480)
- EKSPOR:
  * EXPORT_DXF, EXPORT_SAP2000, EXPORT_IFC, EXPORT_IDEA_STATICA, EXPORT_SOLIDWORKS_STEP, TOGGLE_EXPORT_MODAL
- JENDELA & KONTROL UI:
  * OPEN_WINDOW (params: target: "MATERIAL_LOAD_MODE"|"REALTIME_LOAD_INPUT"|"SNI_DESIGN_PARAMETERS"|"OPTIMIZATION_RESULTS"|"INTERNAL_FORCE_DIAGRAMS"|"GESTURE_AI_ASSISTANT")
  * CLOSE_WINDOW (params: target: ...)
  * OPEN_ALL_WINDOWS, CLOSE_ALL_WINDOWS, RESET_WINDOWS_LAYOUT
  * TOGGLE_CAMERA_PREVIEW (params: action: "START"|"STOP"|"TOGGLE")
  * TOGGLE_ECO_MODE, TOGGLE_AI_ASSISTANT
  * MUTE_VOICE_COMMAND, UNMUTE_VOICE_COMMAND
- TINDAKAN:
  * RUN_OPTIMIZATION, RESET_SIMULATION

TUGAS ANDA:
1. Identifikasi maksud pengguna dan petakan ke CommandId yang paling cocok.
2. DUKUNGAN MULTI-COMMAND (SANGAT PENTING): JIKA pengguna meminta BEBERAPA perintah sekaligus dalam satu kalimat (misal: "ganti ke beton dan munculkan jendela untuk mengatur dimensi dan gaya dalam" atau "ubah ke baja lalu set bentang 8 meter"), masukkan SEMUA aksi tersebut secara berurutan ke dalam array "actions" [{ "commandId": "...", "extractedParameters": { ... }, "label": "..." }].
   Nilai "commandId" utama diisi dengan perintah pertama.
3. Buat "spokenConfirmation": 1 kalimat padat, natural, ramah dalam Bahasa Indonesia yang merangkum SEMUA aksi yang dijalankan.
4. Buat "suggestions": TEPAT 3 sampai 4 rekomendasi perintah lanjutan yang fluid, cerdas, kontekstual, dan bervariasi dalam Bahasa Indonesia agar pengguna tinggal klik tanpa perlu menghafal perintah.

OUTPUT FORMAT JSON SAJA:
{
  "commandId": "COMMAND_ID_UTAMA",
  "confidence": 0.95,
  "extractedParameters": {},
  "actions": [
    {
      "commandId": "COMMAND_ID_1",
      "extractedParameters": {},
      "label": "Ringkasan aksi 1"
    },
    {
      "commandId": "COMMAND_ID_2",
      "extractedParameters": {},
      "label": "Ringkasan aksi 2"
    }
  ],
  "spokenConfirmation": "Kalimat konfirmasi padat ramah merangkum semua aksi...",
  "suggestions": [
    "Saran aksi cerdas 1",
    "Saran aksi cerdas 2",
    "Saran aksi cerdas 3",
    "Saran aksi cerdas 4"
  ]
}`;

  const promptContent = `State Saat Ini: ${JSON.stringify(currentState || {})}
Transkrip Pengguna: "${transcript}"`;

  const payload = {
    contents: [
      {
        parts: [{ text: systemInstruction }, { text: promptContent }],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      maxOutputTokens: 600,
    },
  };

  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(2200),
      });

      if (!response.ok) {
        continue;
      }

      const result = (await response.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
      };

      const text = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!text) continue;

      const parsed = JSON.parse(text) as {
        commandId: CommandId;
        confidence: number;
        extractedParameters?: Record<string, unknown>;
        actions?: Array<{
          commandId: CommandId;
          extractedParameters?: Record<string, unknown>;
          label?: string;
        }>;
        spokenConfirmation?: string;
        suggestions?: string[];
      };

      if (parsed.commandId) {
        const suggestions =
          Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0
            ? parsed.suggestions.slice(0, 4)
            : Array.from(
                generateContextualSuggestions(parsed.commandId, parsed.extractedParameters),
              );

        // Sanitize multi-command actions array
        const actions: IntentActionItem[] =
          Array.isArray(parsed.actions) && parsed.actions.length > 0
            ? parsed.actions.map((act) => ({
                commandId: act.commandId,
                extractedParameters: act.extractedParameters ?? {},
                label: act.label,
              }))
            : [
                {
                  commandId: parsed.commandId,
                  extractedParameters: parsed.extractedParameters ?? {},
                },
              ];

        return {
          commandId: parsed.commandId,
          confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.92,
          extractedParameters: parsed.extractedParameters ?? {},
          actions,
          rawTranscript: transcript,
          spokenConfirmation: parsed.spokenConfirmation,
          suggestions,
        };
      }
    } catch {
      // Try next candidate model
    }
  }

  return null;
}

// ============================================================================
// Next.js Route Handler (POST /api/ai/intent-router)
// ============================================================================

/**
 * Handles POST requests to classify natural language commands and generate AI suggestions.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as {
      transcript?: string;
      currentState?: Record<string, unknown>;
    };

    const transcript = body?.transcript?.trim();
    if (!transcript) {
      return Response.json(
        { error: "Missing or empty 'transcript' property in request body." },
        { status: 400 },
      );
    }

    // 1. If Gemini API key is configured, invoke LLM for high-intelligence natural routing + fluid suggestions
    const apiKey =
      appConfig.ai.apiKey ||
      Bun.env.AI_PROVIDER_API_KEY?.trim() ||
      Bun.env.GEMINI_API_KEY?.trim() ||
      process.env.AI_PROVIDER_API_KEY?.trim() ||
      process.env.GEMINI_API_KEY?.trim();
    if (apiKey && apiKey !== "your_gemini_api_key_here") {
      try {
        const geminiResult = await classifyIntentViaGemini(transcript, apiKey, body.currentState);
        if (geminiResult && geminiResult.confidence >= 0.75) {
          return Response.json(geminiResult, { status: 200 });
        }
      } catch {
        // Fall through to deterministic rule matching
      }
    }

    // 2. Deterministic high-speed rule matching engine (with compound multi-command support)
    const ruleResult = matchRuleBasedIntent(transcript);
    if (ruleResult) {
      return Response.json(ruleResult, { status: 200 });
    }

    // 3. Fallback for unrecognized intent: generate smart next-action suggestions
    const fallbackSuggestions = [
      "Ganti material ke beton",
      "Lihat tampak depan 2D",
      "Tampilkan diagram momen BMD",
      "Ekspor ke AutoCAD DXF",
    ];

    return Response.json(
      {
        commandId: null,
        confidence: 0,
        extractedParameters: {},
        rawTranscript: transcript,
        spokenConfirmation: null,
        suggestions: fallbackSuggestions,
        message: "Perintah belum dapat dikenali oleh Intent Router.",
      },
      { status: 200 },
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal Intent Router Error";
    return Response.json({ error: errorMsg }, { status: 500 });
  }
}
