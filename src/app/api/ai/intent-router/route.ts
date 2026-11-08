/**
 * @file route.ts
 * @description Natural language command intent router API.
 * Maps voice or text transcripts in Indonesian & English to discrete simulator CommandId
 * and typed parameters. Uses Google Gemini API (gemini-2.5-flash / gemini-3.5-flash-lite)
 * when configured, falling back deterministically to high-speed regex rule matching.
 */

import type { CommandId, IntentRouterResult } from "@/types/command-registry-types";
import { CommandRegistryError } from "@/types/command-registry-types";
import type { SteelGrade } from "@/types/steel-sni1729-types";

// ============================================================================
// Deterministic Rule-Based Intent Matching Engine
// ============================================================================

/**
 * Matches natural language transcripts against known structural command patterns.
 * Supports Indonesian (id-ID) and English (en-US).
 *
 * @param {string} transcript Spoken or typed user transcript.
 * @returns {IntentRouterResult | null} Resolved command result or null if unmatched.
 *
 * @example
 * const res = matchRuleBasedIntent("ubah bentang balok menjadi 12 meter");
 * // res?.commandId === "SET_SPAN_LENGTH"
 * // res?.extractedParameters === { spanLengthM: 12 }
 */
export function matchRuleBasedIntent(transcript: string): IntentRouterResult | null {
  const raw = transcript.trim();
  const lower = raw.toLowerCase();

  if (!lower) return null;

  // 1. Numerical Parameter Adjustments
  // Span length (e.g., "bentang 12 meter", "span 8.5 m", "panjang 10 meter")
  const spanMatch = lower.match(
    /(?:bentang|span|panjang|length)\s*(?:balok\s*)?(?:menjadi|ke|is)?\s*([0-9]+(?:[.,][0-9]+)?)\s*(?:m|meter)?/,
  );
  if (spanMatch && spanMatch[1]) {
    const val = parseFloat(spanMatch[1].replace(",", "."));
    if (!Number.isNaN(val) && val > 0 && val <= 50) {
      return {
        commandId: "SET_SPAN_LENGTH",
        confidence: 0.95,
        extractedParameters: { spanLengthM: val },
        rawTranscript: raw,
      };
    }
  }

  // Point load (e.g., "beban titik 50 kn", "tambah beban 80", "point load 100")
  const pointLoadMatch = lower.match(
    /(?:beban\s*titik|point\s*load|tambah\s*beban)\s*(?:sebesar)?\s*([0-9]+(?:[.,][0-9]+)?)\s*(?:kn)?/,
  );
  if (pointLoadMatch && pointLoadMatch[1]) {
    const val = parseFloat(pointLoadMatch[1].replace(",", "."));
    if (!Number.isNaN(val) && val > 0) {
      return {
        commandId: "ADD_POINT_LOAD",
        confidence: 0.92,
        extractedParameters: { magnitudeKn: val },
        rawTranscript: raw,
      };
    }
  }

  // Concrete fc' (e.g., "mutu beton 30 mpa", "fc 25", "kuat tekan 35 mpa", "k-300", "k350")
  const kCubeMatch = lower.match(/k\s*[-]?\s*([0-9]{3})/);
  if (kCubeMatch && kCubeMatch[1]) {
    const kVal = parseInt(kCubeMatch[1], 10);
    // Rough cylindrical equivalent: fc' ~= 0.83 * (K / 10)
    const fcVal = Math.round(kVal * 0.083 * 10) / 10;
    return {
      commandId: "SET_CONCRETE_FC",
      confidence: 0.94,
      extractedParameters: { fcMpa: fcVal, historicalGrade: `K-${kVal}` },
      rawTranscript: raw,
    };
  }

  const fcMatch = lower.match(
    /(?:mutu\s*beton|kuat\s*tekan|fc[']?|concrete\s*grade)\s*(?:menjadi|ke)?\s*([0-9]+(?:[.,][0-9]+)?)\s*(?:mpa)?/,
  );
  if (fcMatch && fcMatch[1]) {
    const val = parseFloat(fcMatch[1].replace(",", "."));
    if (!Number.isNaN(val) && val >= 15 && val <= 100) {
      return {
        commandId: "SET_CONCRETE_FC",
        confidence: 0.94,
        extractedParameters: { fcMpa: val },
        rawTranscript: raw,
      };
    }
  }

  // Steel grade (e.g., "mutu baja bj 37", "grade bj 41", "bj 50", "bj 55", "a36")
  const steelGradeMatch = lower.match(
    /(?:mutu\s*baja|grade|baja)\s*(?:bj\s*[_]?\s*)?(34|37|41|50|55)/,
  );
  if (steelGradeMatch && steelGradeMatch[1]) {
    const grade = `BJ_${steelGradeMatch[1]}` as SteelGrade;
    return {
      commandId: "SET_STEEL_GRADE",
      confidence: 0.96,
      extractedParameters: { steelGrade: grade },
      rawTranscript: raw,
    };
  }
  if (lower.includes("a36") || lower.includes("astm a36")) {
    return {
      commandId: "SET_STEEL_GRADE",
      confidence: 0.92,
      extractedParameters: { steelGrade: "BJ_37" as SteelGrade },
      rawTranscript: raw,
    };
  }

  // 2. Material Selection
  if (
    lower.includes("beton bertulang") ||
    lower.includes("material beton") ||
    lower.includes("ubah ke beton") ||
    lower.includes("ganti beton") ||
    lower.includes("switch to concrete")
  ) {
    return {
      commandId: "SWITCH_MATERIAL_CONCRETE",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }
  if (
    lower.includes("struktur baja") ||
    lower.includes("material baja") ||
    lower.includes("ubah ke baja") ||
    lower.includes("ganti baja") ||
    lower.includes("switch to steel")
  ) {
    return {
      commandId: "SWITCH_MATERIAL_STEEL",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }

  // 3. Steel Profile Filtering
  if (
    lower.includes("filter box") ||
    lower.includes("profil box") ||
    lower.includes("hollow") ||
    lower.includes("pipa kotak") ||
    lower.includes("shs") ||
    lower.includes("rhs") ||
    lower.includes("kotak")
  ) {
    return {
      commandId: "FILTER_STEEL_BOX",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }
  if (
    lower.includes("filter iwf") ||
    lower.includes("profil iwf") ||
    lower.includes("wide flange") ||
    /\bprofil\s*h\b/.test(lower) ||
    /\bh[- ]?beam\b/.test(lower) ||
    /\bprofil\s*i\b/.test(lower)
  ) {
    return {
      commandId: "FILTER_STEEL_IWF",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }
  if (
    lower.includes("semua profil") ||
    lower.includes("all steel") ||
    lower.includes("filter all") ||
    lower.includes("reset filter")
  ) {
    return {
      commandId: "FILTER_STEEL_ALL",
      confidence: 0.92,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }

  // 4. Diagram Toggles
  if (
    lower.includes("bmd") ||
    lower.includes("momen lentur") ||
    lower.includes("diagram momen") ||
    lower.includes("bending moment")
  ) {
    return {
      commandId: "TOGGLE_DIAGRAM_BMD",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }
  if (
    lower.includes("sfd") ||
    lower.includes("gaya geser") ||
    lower.includes("gaya lintang") ||
    lower.includes("shear force")
  ) {
    return {
      commandId: "TOGGLE_DIAGRAM_SFD",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }
  if (
    lower.includes("nfd") ||
    lower.includes("gaya aksial") ||
    lower.includes("normal force") ||
    lower.includes("gaya normal")
  ) {
    return {
      commandId: "TOGGLE_DIAGRAM_NFD",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }
  if (
    lower.includes("tfd") ||
    lower.includes("momen torsi") ||
    lower.includes("diagram torsi") ||
    lower.includes("puntir") ||
    lower.includes("torsion")
  ) {
    return {
      commandId: "TOGGLE_DIAGRAM_TFD",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }

  // 5. Diagram Layout Modes
  if (
    lower.includes("in place") ||
    lower.includes("satu bidang") ||
    lower.includes("overlay diagram")
  ) {
    return {
      commandId: "SET_DIAGRAM_MODE_IN_PLACE",
      confidence: 0.94,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }
  if (lower.includes("stacked") || lower.includes("bertumpuk") || lower.includes("mode tumpuk")) {
    return {
      commandId: "SET_DIAGRAM_MODE_STACKED",
      confidence: 0.94,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }
  if (
    lower.includes("jendela terpisah") ||
    lower.includes("diagram window") ||
    lower.includes("floating diagram")
  ) {
    return {
      commandId: "SET_DIAGRAM_MODE_WINDOW",
      confidence: 0.94,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }

  // 6. Support Conditions
  if (
    lower.includes("kantilever") ||
    lower.includes("cantilever") ||
    lower.includes("jepit bebas")
  ) {
    return {
      commandId: "SET_SUPPORT_CANTILEVER",
      confidence: 0.96,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }
  if (
    lower.includes("sendi rol") ||
    lower.includes("pinned roller") ||
    lower.includes("tumpuan sederhana") ||
    lower.includes("simply supported")
  ) {
    return {
      commandId: "SET_SUPPORT_PINNED_ROLLER",
      confidence: 0.96,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }
  if (
    lower.includes("jepit jepit") ||
    lower.includes("fixed fixed") ||
    lower.includes("jepit-jepit")
  ) {
    return {
      commandId: "SET_SUPPORT_FIXED_FIXED",
      confidence: 0.96,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }
  if (
    lower.includes("jepit rol") ||
    lower.includes("fixed roller") ||
    lower.includes("propped cantilever")
  ) {
    return {
      commandId: "SET_SUPPORT_FIXED_ROLLER",
      confidence: 0.96,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }
  if (lower.includes("jepit sendi") || lower.includes("fixed pinned")) {
    return {
      commandId: "SET_SUPPORT_FIXED_PINNED",
      confidence: 0.96,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }

  // 7. Loading Paradigms
  if (
    lower.includes("beban eksternal") ||
    lower.includes("mode a") ||
    lower.includes("external load")
  ) {
    return {
      commandId: "SWITCH_MODE_EXTERNAL_LOADS",
      confidence: 0.94,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }
  if (lower.includes("gaya dalam") || lower.includes("mode b") || lower.includes("direct force")) {
    return {
      commandId: "SWITCH_MODE_DIRECT_FORCES",
      confidence: 0.94,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }

  // 8. Simulation Actions
  if (
    lower.includes("optimasi") ||
    lower.includes("optimize") ||
    lower.includes("cari profil terhemat") ||
    lower.includes("hitung penampang")
  ) {
    return {
      commandId: "RUN_OPTIMIZATION",
      confidence: 0.96,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }
  if (
    lower.includes("reset simulasi") ||
    lower.includes("reset balok") ||
    lower.includes("mulai ulang")
  ) {
    return {
      commandId: "RESET_SIMULATION",
      confidence: 0.96,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }

  // 9. Multi-Format Exporters
  if (
    lower.includes("dxf") ||
    lower.includes("autocad") ||
    (lower.includes("cad") &&
      (lower.includes("ekspor") || lower.includes("export") || lower.includes("download")))
  ) {
    return {
      commandId: "EXPORT_DXF",
      confidence: 0.97,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }
  if (lower.includes("sap2000") || lower.includes("s2k") || lower.includes("etabs")) {
    return {
      commandId: "EXPORT_SAP2000",
      confidence: 0.97,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }
  if (lower.includes("ifc") || lower.includes("revit") || lower.includes("export bim")) {
    return {
      commandId: "EXPORT_IFC",
      confidence: 0.97,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }
  if (lower.includes("idea statica") || lower.includes("ideastatica")) {
    return {
      commandId: "EXPORT_IDEA_STATICA",
      confidence: 0.97,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }
  if (
    lower.includes("solidworks") ||
    lower.includes("step file") ||
    lower.includes("export step")
  ) {
    return {
      commandId: "EXPORT_SOLIDWORKS_STEP",
      confidence: 0.97,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }

  // 10. UI & Floating Windows
  if (lower.includes("kamera") || lower.includes("camera") || lower.includes("preview gesture")) {
    return {
      commandId: "TOGGLE_CAMERA_PREVIEW",
      confidence: 0.94,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }
  if (
    lower.includes("asisten ai") ||
    lower.includes("konsultan ai") ||
    lower.includes("tanya ai") ||
    lower.includes("chat ai")
  ) {
    return {
      commandId: "TOGGLE_AI_ASSISTANT",
      confidence: 0.94,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }
  if (lower.includes("eco mode") || lower.includes("mode hemat") || lower.includes("hemat daya")) {
    return {
      commandId: "TOGGLE_ECO_MODE",
      confidence: 0.94,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }
  if (
    lower.includes("modal ekspor") ||
    lower.includes("dialog export") ||
    lower.includes("menu download")
  ) {
    return {
      commandId: "TOGGLE_EXPORT_MODAL",
      confidence: 0.94,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }

  // Generic fallback keywords
  if (lower.includes("beton")) {
    return {
      commandId: "SWITCH_MATERIAL_CONCRETE",
      confidence: 0.85,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }
  if (lower.includes("baja")) {
    return {
      commandId: "SWITCH_MATERIAL_STEEL",
      confidence: 0.85,
      extractedParameters: {},
      rawTranscript: raw,
    };
  }

  return null;
}

// ============================================================================
// Google Gemini Multimodal Intent Classification
// ============================================================================

/**
 * Classifies transcript using Google Gemini API structured output.
 *
 * @param {string} transcript Spoken transcript.
 * @param {string} apiKey Gemini API key.
 * @returns {Promise<IntentRouterResult | null>} Classified intent or null if failed.
 */
async function classifyIntentViaGemini(
  transcript: string,
  apiKey: string,
): Promise<IntentRouterResult | null> {
  const model = Bun.env.AI_COMMIT_MODEL?.trim() || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const systemInstruction = `You are the Natural Language Intent Router for IBDS (Interactive Beam Deflection Simulator).
Map the user transcript to exactly one of the valid CommandIds:
- SWITCH_MATERIAL_CONCRETE, SWITCH_MATERIAL_STEEL
- FILTER_STEEL_IWF, FILTER_STEEL_BOX, FILTER_STEEL_ALL
- TOGGLE_DIAGRAM_SFD, TOGGLE_DIAGRAM_BMD, TOGGLE_DIAGRAM_NFD, TOGGLE_DIAGRAM_TFD
- SET_DIAGRAM_MODE_IN_PLACE, SET_DIAGRAM_MODE_STACKED, SET_DIAGRAM_MODE_WINDOW
- SET_SUPPORT_CANTILEVER, SET_SUPPORT_PINNED_ROLLER, SET_SUPPORT_FIXED_FIXED, SET_SUPPORT_FIXED_ROLLER, SET_SUPPORT_FIXED_PINNED
- SWITCH_MODE_EXTERNAL_LOADS, SWITCH_MODE_DIRECT_FORCES
- SET_SPAN_LENGTH (params: spanLengthM: number)
- ADD_POINT_LOAD (params: magnitudeKn: number, positionM?: number)
- SET_CONCRETE_FC (params: fcMpa: number)
- SET_STEEL_GRADE (params: steelGrade: "BJ_34"|"BJ_37"|"BJ_41"|"BJ_50"|"BJ_55")
- RUN_OPTIMIZATION, RESET_SIMULATION
- EXPORT_DXF, EXPORT_SAP2000, EXPORT_IFC, EXPORT_IDEA_STATICA, EXPORT_SOLIDWORKS_STEP
- TOGGLE_CAMERA_PREVIEW, TOGGLE_AI_ASSISTANT, TOGGLE_ECO_MODE, TOGGLE_EXPORT_MODAL

Output valid JSON only:
{
  "commandId": "COMMAND_ID_HERE",
  "confidence": 0.95,
  "extractedParameters": {}
}`;

  const payload = {
    contents: [
      {
        parts: [{ text: systemInstruction }, { text: `User Transcript: "${transcript}"` }],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
      maxOutputTokens: 300,
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(2500),
    });

    if (!response.ok) {
      return null;
    }

    const result = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) return null;

    const parsed = JSON.parse(text) as {
      commandId: CommandId;
      confidence: number;
      extractedParameters?: Record<string, unknown>;
    };

    if (parsed.commandId) {
      return {
        commandId: parsed.commandId,
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.9,
        extractedParameters: parsed.extractedParameters ?? {},
        rawTranscript: transcript,
      };
    }
  } catch {
    // Malformed JSON from model, timeout, or network error
  }

  return null;
}

// ============================================================================
// Next.js Route Handler (POST /api/ai/intent-router)
// ============================================================================

/**
 * Handles POST requests to classify natural language commands.
 *
 * @param {Request} req HTTP Request containing `{ transcript: string }`.
 * @returns {Promise<Response>} JSON Response returning `IntentRouterResult`.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as { transcript?: string };
    const transcript = body.transcript?.trim();

    if (!transcript) {
      return Response.json(
        { error: "Missing or empty 'transcript' property in request body." },
        { status: 400 },
      );
    }

    // 1. If Gemini API key is configured, attempt LLM classification
    const apiKey = Bun.env.AI_PROVIDER_API_KEY?.trim();
    if (apiKey && apiKey !== "your_gemini_api_key_here") {
      try {
        const geminiResult = await classifyIntentViaGemini(transcript, apiKey);
        if (geminiResult) {
          return Response.json(geminiResult, { status: 200 });
        }
      } catch {
        // Fall through to deterministic rule matching
      }
    }

    // 2. Deterministic high-speed rule matching engine
    const ruleResult = matchRuleBasedIntent(transcript);
    if (ruleResult) {
      return Response.json(ruleResult, { status: 200 });
    }

    // 3. Fallback when confidence is low or unrecognized
    const fallbackResult: IntentRouterResult = {
      commandId: "RUN_OPTIMIZATION",
      confidence: 0.1,
      extractedParameters: {},
      rawTranscript: transcript,
    };

    return Response.json(fallbackResult, { status: 200 });
  } catch (error) {
    const err = new CommandRegistryError(
      `Intent routing execution failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return Response.json({ error: err.message }, { status: 500 });
  }
}
