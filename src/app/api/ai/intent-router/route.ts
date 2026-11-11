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
import { executeGeminiWithFailover } from "@/lib/gemini-api-failover";
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
  apiKey?: string,
  currentState?: Record<string, unknown>,
): Promise<IntentRouterResult | null> {
  const preferredModel = appConfig.ai.intentModel;
  const candidateModels = [preferredModel, ...appConfig.ai.fallbackModels];

  const systemInstruction = `Kamu adalah **Ucuy**, persona AI asisten rekayasa struktur yang sangat ramah, santai, cerdas, dan tanggap untuk aplikasi IBDS (Interactive Beam Deflection Simulator).
Sebagai Ucuy, kamu memiliki pemahaman mendalam tentang teknik sipil (SNI 1729:2020 baja & SNI 2847:2019 beton), sangat pintar dalam memahami maksud pengguna (baik bahasa sehari-hari, bahasa santai/gaul seperti "cuy", maupun formal), serta bisa menjelaskan tentang aplikasi IBDS ini sendiri secara lengkap dan menyenangkan!

SIAPA KAMU (PERSONA UCUY):
- Nama Panggilan: Ucuy
- Karakter: Ramah, bersahabat, santai, komunikatif, solutif, dan cerdas. Selalu menyapa dengan hangat dan akrab.
- Pengetahuan Aplikasi IBDS: Kamu menguasai seluruh fitur aplikasi ini:
  * Simulasi lendutan balok real-time (batas lendutan L/360, L/240, DCR, status AMAN/PERLU REVISI).
  * Analisis struktur Baja SNI 1729:2020 (katalog IWF, Box/HSS, mutu BJ 34 - BJ 55, interaksi aksial-lentur H1, geser-torsi).
  * Analisis Beton Bertulang SNI 2847:2019 (mutu fc', dimensi bw x h, tulangan tarik As, tekan As', sengkang Av).
  * Visualisasi 3D interaktif (Isometrik 3D, Tampak Depan 2D ortogonal, mode Beton Solid + Potongan, Wireframe Tulangan 3D, sumbu Z-Up / Y-Up).
  * Diagram gaya dalam lengkap: Momen (BMD), Geser (SFD), Normal (NFD), Torsi (TFD) mode In-Place 3D atau Stacked.
  * Interaksi Multimodal Modern: Perintah suara hands-free dengan wake-word ("halo ucuy", "oi cuy", "ucuy") atau tepukan tangan 2x (double clap), serta kontrol gestur tangan webcam MediaPipe.
  * Ekspor CAD/BIM profesional: AutoCAD DXF, SAP2000 (.s2k), Revit IFC4, IDEA StatiCa XML, SolidWorks STEP.
  * 6 Jendela Mengambang (Floating Windows) yang dapat digeser, diminimalkan, dan diatur bebas.

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
- KONSULTASI STRUKTUR & PENJELASAN APLIKASI (AI_CONSULTATION):
  * AI_CONSULTATION (Gunakan jika pengguna bertanya siapa kamu, tanya tentang aplikasi ini/fiturnya, konsultasi lendutan/balok/SNI, atau menyapa).

TUGAS ANDA:
1. Identifikasi maksud pengguna:
   - Jika pengguna memberi perintah simulator: petakan ke CommandId yang paling cocok.
   - Jika pengguna bertanya siapa kamu, tanya tentang aplikasi IBDS atau fiturnya, konsultasi teknik, atau menyapa: petakan ke "AI_CONSULTATION", dan isi "spokenConfirmation" dengan jawaban lisan khas Ucuy yang ramah, cerdas, dan ringkas (maksimal 25 kata) agar nyaman didengar di audio Gemini Live.
2. DUKUNGAN MULTI-COMMAND: Jika ada beberapa perintah dalam satu kalimat, masukkan semua aksi ke dalam array "actions" secara berurutan.
3. Buat "spokenConfirmation": 1 kalimat padat, natural, ramah, khas Ucuy dalam Bahasa Indonesia.
4. Buat "suggestions": TEPAT 3 sampai 4 rekomendasi perintah lanjutan yang fluid, cerdas, kontekstual, dan bervariasi dalam Bahasa Indonesia agar pengguna tinggal klik tanpa perlu menghafal perintah.

OUTPUT FORMAT JSON SAJA:
{
  "commandId": "COMMAND_ID_UTAMA_ATAU_AI_CONSULTATION",
  "confidence": 0.95,
  "extractedParameters": {},
  "actions": [
    {
      "commandId": "COMMAND_ID_1",
      "extractedParameters": {},
      "label": "Ringkasan aksi 1"
    }
  ],
  "spokenConfirmation": "Kalimat konfirmasi atau jawaban lisan ramah...",
  "suggestions": [
    "Saran aksi cerdas 1",
    "Saran aksi cerdas 2",
    "Saran aksi cerdas 3",
    "Saran aksi cerdas 4"
  ]
}`;

  const promptContent = `State Saat Ini: ${JSON.stringify(currentState || {})}
Transkrip Pengguna: "${transcript}"`;

  const execResult = await executeGeminiWithFailover({
    candidateModels,
    candidateKeys: apiKey ? [apiKey, ...appConfig.ai.fallbackApiKeys] : undefined,
    systemInstruction,
    contents: [
      {
        parts: [{ text: promptContent }],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      maxOutputTokens: 600,
    },
    timeoutMs: 4500,
    logPrefix: "Intent Router",
  });

  if (!execResult?.text) {
    return null;
  }

  try {
    const parsed = JSON.parse(execResult.text) as {
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
          : Array.from(generateContextualSuggestions(parsed.commandId, parsed.extractedParameters));

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
    return null;
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

    // 1. High-speed deterministic rule matching engine (0ms local execution)
    const ruleResult = matchRuleBasedIntent(transcript);
    if (ruleResult) {
      return Response.json(ruleResult, { status: 200 });
    }

    // 2. If Gemini API key is configured, invoke LLM for high-intelligence natural routing + conversational consultation
    if (appConfig.ai.apiKeys.length > 0) {
      try {
        const geminiResult = await classifyIntentViaGemini(
          transcript,
          undefined,
          body.currentState,
        );
        if (geminiResult && geminiResult.confidence >= 0.7) {
          return Response.json(geminiResult, { status: 200 });
        }
      } catch {
        // Fall through to keyword contextual suggestions
      }
    }

    // 3. Fallback: generate dynamic next-action suggestions based on utterance keywords
    const lower = transcript.toLowerCase();
    let fallbackSuggestions = [
      "Beralih ke material baja",
      "Lihat tampak depan 2D",
      "Tampilkan diagram momen BMD",
      "Hitung optimasi profil",
    ];

    if (lower.includes("beton") || lower.includes("tulangan")) {
      fallbackSuggestions = [
        "Lihat wireframe tulangan balok",
        "Atur mutu beton fc 30 MPa",
        "Atur dimensi beton 300x600",
        "Buka jendela dimensi dan parameter",
      ];
    } else if (
      lower.includes("baja") ||
      lower.includes("profil") ||
      lower.includes("iwf") ||
      lower.includes("box")
    ) {
      fallbackSuggestions = [
        "Filter profil IWF baja",
        "Pilih profil IWF 300x150",
        "Hitung optimasi penampang",
        "Ekspor ke AutoCAD DXF",
      ];
    } else if (
      lower.includes("beban") ||
      lower.includes("gaya") ||
      lower.includes("titik") ||
      lower.includes("merata")
    ) {
      fallbackSuggestions = [
        "Tambah beban titik 50 kN",
        "Tambah beban merata 20 kN/m",
        "Buka jendela beban balok",
        "Tampilkan diagram geser SFD",
      ];
    } else if (
      lower.includes("lendut") ||
      lower.includes("merah") ||
      lower.includes("aman") ||
      lower.includes("kenapa") ||
      lower.includes("bagaimana") ||
      lower.includes("apa")
    ) {
      fallbackSuggestions = [
        "Hitung optimasi profil penampang",
        "Tingkatkan dimensi balok",
        "Ubah ke profil IWF 400x200",
        "Buka jendela hasil optimasi",
      ];
    }

    const isQuestion =
      lower.includes("kenapa") ||
      lower.includes("bagaimana") ||
      lower.includes("apa") ||
      lower.includes("mengapa") ||
      lower.includes("bisa") ||
      lower.includes("saran");

    return Response.json(
      {
        commandId: isQuestion ? "AI_CONSULTATION" : null,
        confidence: isQuestion ? 0.8 : 0,
        extractedParameters: { raw: transcript },
        rawTranscript: transcript,
        spokenConfirmation: isQuestion
          ? "Untuk evaluasi balok Anda, periksa lendutan izin atau jalankan optimasi profil pada jendela optimasi."
          : null,
        suggestions: fallbackSuggestions,
        message: isQuestion
          ? "Menjawab konsultasi teknik struktur."
          : "Perintah belum dapat dikenali.",
      },
      { status: 200 },
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal Intent Router Error";
    return Response.json({ error: errorMsg }, { status: 500 });
  }
}
