/**
 * @file route.ts
 * @description Indonesian Structural Engineering AI Consultant API route.
 * Follows SNI 2847:2019 (Reinforced Concrete) and SNI 1729:2020 (Structural Steel).
 * Injects real-time beam analysis context (span L, active profile, DCR ratio, deflection Delta_max)
 * into Google Gemini LLM, with complete deterministic civil engineering heuristic fallback.
 */

import { appConfig } from "@/config/app-config";
import type { BeamSimulatorState } from "@/state/beam-simulator-store";

/**
 * Request payload contract for `/api/ai/structural-consultant`.
 */
export interface StructuralConsultantRequestBody {
  readonly prompt?: string;
  readonly messages?: Array<{ role: string; content: string }>;
  readonly simulatorState?: Partial<BeamSimulatorState> & {
    readonly steelProfileName?: string | null;
    readonly governingForces?: {
      readonly absoluteMaxMu?: number;
      readonly absoluteMaxVu?: number;
      readonly absoluteMaxTu?: number;
      readonly absoluteMaxPu?: number;
    };
    readonly maxDeflectionMm?: number;
    readonly deflectionLimitDenominator?: number;
    readonly concreteFcMpa?: number;
    readonly steelGrade?: string;
  };
}

/**
 * Standard structured consultation response.
 */
export interface StructuralConsultantResponse {
  readonly reply: string;
  readonly text: string;
  readonly response: string;
  readonly message: string;
  readonly sources: readonly string[];
  readonly codeCompliance: {
    readonly standardConcrete: "SNI 2847:2019";
    readonly standardSteel: "SNI 1729:2020";
    readonly deflectionCompliant: boolean;
    readonly dcrEstimated?: number;
  };
}

// ============================================================================
// Deterministic Civil Engineering Heuristic Response Generator
// ============================================================================

/**
 * Generates an expert civil engineering advisory response adhering to SNI codes
 * when offline or without an external AI provider API key.
 *
 * @param {string} userQuery Spoken or typed engineer query.
 * @param {StructuralConsultantRequestBody["simulatorState"]} state Current beam state snapshot.
 * @returns {StructuralConsultantResponse} Structured consultation output.
 */
export function generateDeterministicConsultantAdvice(
  userQuery: string,
  state?: StructuralConsultantRequestBody["simulatorState"],
): StructuralConsultantResponse {
  const query = userQuery.toLowerCase();
  const span = state?.spanLengthM ? Number(state.spanLengthM) : 6.0;
  const defl = Math.abs(state?.maxDeflectionMm ?? 0);
  const denom = state?.deflectionLimitDenominator ?? 360;
  const allowDefl = (span * 1000) / denom;
  const deflPass = defl <= allowDefl;
  const mu = state?.governingForces?.absoluteMaxMu ?? 120;
  const vu = state?.governingForces?.absoluteMaxVu ?? 65;
  const tu = state?.governingForces?.absoluteMaxTu ?? 0;
  const profileName = state?.steelProfileName ?? "IWF 300x150x6.5x9";
  const material = state?.materialKind ?? "STEEL";

  // 1. Comparison of IWF vs BOX / Hollow Profiles
  if (
    query.includes("iwf") ||
    query.includes("box") ||
    query.includes("bandingkan") ||
    query.includes("hollow") ||
    query.includes("compare")
  ) {
    const text = [
      `📊 **Kajian Perbandingan Profil Baja SNI 1729:2020 (Bentang L = ${span.toFixed(1)} m):**`,
      `1. **Profil IWF (Wide Flange):**`,
      `   - **Kelebihan:** Memiliki modulus penampang lentur sumbu kuat ($Z_x$) dan inersia ($I_x$) tertinggi per kilogram berat profil, menjadikannya pilihan paling ekonomis untuk balok lentur murni.`,
      `   - **Kelemahan:** Konstanta puntir torsi St. Venant ($J$) sangat rendah. Sangat rentan terhadap fenomena **Tekuk Torsi Lateral (*Lateral-Torsional Buckling / LTB*)** jika panjang tak terkekang lateral $L_b > L_p$.`,
      `2. **Profil Hollow / BOX (SHS / RHS):**`,
      `   - **Kelebihan:** Penampang tertutup memiliki konstanta torsi ($J$) hingga ratusan kali lebih besar dibanding IWF, serta radius girasi sumbu lemah ($r_y$) yang jauh lebih tinggi. Sangat unggul saat memikul momen puntir ($T_u = ${tu.toFixed(1)}\\text{ kNm}$) atau bentang panjang tanpa pengaku lateral.`,
      `   - **Kelemahan:** Biaya fabrikasi dan sambungan baut/las internal lebih kompleks.`,
      `💡 **Rekomendasi Desain:** Gunakan profil **IWF** jika flens atas tertahan oleh pelat komposit/lantai. Gunakan profil **BOX** jika balok menerima beban eksentris (torsi) atau berfungsi sebagai balok tepi/kanopi terbuka.`,
    ].join("\n\n");

    return {
      reply: text,
      text,
      response: text,
      message: text,
      sources: ["SNI 1729:2020 Bab F (Desain Komponen Struktur untuk Lentur)"],
      codeCompliance: {
        standardConcrete: "SNI 2847:2019",
        standardSteel: "SNI 1729:2020",
        deflectionCompliant: deflPass,
      },
    };
  }

  // 2. Stirrups & Shear Evaluation
  if (
    query.includes("geser") ||
    query.includes("sengkang") ||
    query.includes("stirrup") ||
    query.includes("shear")
  ) {
    const text = [
      `🔩 **Evaluasi Penulangan Geser Balok (SNI 2847:2019 Pasal 22.5):**`,
      `- Gaya geser terfaktor desain: $V_u = ${vu.toFixed(1)}\\text{ kN}$.`,
      `- Syarat batas kuat geser nominal terfaktor: $\\phi V_n = \\phi (V_c + V_s) \\ge V_u$ dengan $\\phi = 0.75$.`,
      `- Batas kekuatan geser sumbangan tulangan maksimum (*Web Crushing Limit*):`,
      `  $$V_{s,\\max} = 0.66 \\sqrt{f'_c} b_w d$$`,
      `  Jika $V_u / \\phi - V_c > V_{s,\\max}$, dimensi balok $b_w \\times h$ harus diperbesar karena beton akan mengalami kehancuran diagonal tekan sebelum tulangan leleh.`,
      `- Ketentuan spasi sengkang maksimum per Pasal 9.7.6.2.2:`,
      `  $$s_{\\max} = \\min(d/2, 600\\text{ mm})$$`,
      `  Bila $V_s > 0.33 \\sqrt{f'_c} b_w d$, spasi diperketat menjadi $s_{\\max} = \\min(d/4, 300\\text{ mm})$.`,
      `💡 **Rekomendasi Detailing:** Gunakan sengkang 2 kaki $\\varnothing 10\\text{ mm}$ dengan spasi $100\\text{ mm}$ di daerah sendi plastis ($2h$ dari tumpuan) dan $150\\text{ mm}$ pada lapangan.`,
    ].join("\n\n");

    return {
      reply: text,
      text,
      response: text,
      message: text,
      sources: [
        "SNI 2847:2019 Pasal 22.5 (Kekuatan Geser Satu Arah)",
        "SNI 2847:2019 Pasal 9.7.6 (Penulangan Geser Balok)",
      ],
      codeCompliance: {
        standardConcrete: "SNI 2847:2019",
        standardSteel: "SNI 1729:2020",
        deflectionCompliant: deflPass,
      },
    };
  }

  // 3. Deflection / Serviceability Evaluation (L/360)
  if (
    query.includes("lendutan") ||
    query.includes("defleksi") ||
    query.includes("360") ||
    query.includes("240") ||
    query.includes("deflection")
  ) {
    const ratioPercent = (defl / Math.max(allowDefl, 0.001)) * 100;
    const text = [
      `📏 **Pemeriksaan Batas Lendutan Layan Balok (SNI 2847:2019 Tabel 24.2.2 / SNI 1729:2020):**`,
      `- Panjang bentang balok: $L = ${span.toFixed(2)}\\text{ m}$.`,
      `- Lendutan elastis maksimum terhitung: $\\Delta_{\\max} = -${defl.toFixed(2)}\\text{ mm}$.`,
      `- Batas izin lendutan ($L/${denom}$): $\\Delta_{\\text{allow}} = ${allowDefl.toFixed(2)}\\text{ mm}$.`,
      `- Rasio pemanfaatan lendutan: **${ratioPercent.toFixed(1)}\\%**`,
      deflPass
        ? `✅ **MEMENUHI SYARAT (PASS):** Lendutan balok berada di bawah batas izin, tidak menimbulkan kerusakan retak pada partisi plesteran atau langit-langit.`
        : `⚠️ **MELEBIHI BATAS IZIN (FAIL):** Terjadi defleksi berlebih (${ratioPercent.toFixed(1)}\\% dari izin). Disarankan menambah kekakuan lentur $EI$ dengan memperbesar tinggi profil atau memberikan pra-kelengkungan (*camber*).`,
    ].join("\n\n");

    return {
      reply: text,
      text,
      response: text,
      message: text,
      sources: [
        "SNI 2847:2019 Tabel 24.2.2 (Lendutan Izin Maksimum Komponen Struktur)",
        "SNI 1729:2020 Bab L (Desain untuk Kelayanan)",
      ],
      codeCompliance: {
        standardConcrete: "SNI 2847:2019",
        standardSteel: "SNI 1729:2020",
        deflectionCompliant: deflPass,
      },
    };
  }

  // 4. Default Comprehensive Structural Advice
  const text = [
    `📐 **Ringkasan Analisis Rekayasa Balok IBDS (SNI 2847:2019 / SNI 1729:2020):**`,
    `- **Material Aktif:** ${material === "CONCRETE" ? "Beton Bertulang (SNI 2847:2019)" : `Baja Struktural ${profileName} (SNI 1729:2020)`}`,
    `- **Bentang Bersih:** $L = ${span.toFixed(2)}\\text{ m}$.`,
    `- **Beban Terfaktor Dominan:** $M_u = ${mu.toFixed(1)}\\text{ kNm}$, $V_u = ${vu.toFixed(1)}\\text{ kN}$.`,
    `- **Lendutan Maksimum:** $\\Delta_{\\max} = -${defl.toFixed(2)}\\text{ mm}$ (Batas $L/${denom} = ${allowDefl.toFixed(2)}\\text{ mm}$, Status: **${deflPass ? "AMAN" : "OVERDEFLECTION"}**).`,
    `💡 Silakan ajukan pertanyaan spesifik seperti *"Bandingkan IWF vs BOX"*, *"Rekomendasi tulangan geser"*, atau *"Periksa batas lendutan L/360"*.`,
  ].join("\n\n");

  return {
    reply: text,
    text,
    response: text,
    message: text,
    sources: ["SNI 2847:2019", "SNI 1729:2020"],
    codeCompliance: {
      standardConcrete: "SNI 2847:2019",
      standardSteel: "SNI 1729:2020",
      deflectionCompliant: deflPass,
    },
  };
}

// ============================================================================
// Google Gemini Multimodal Live API Integration
// ============================================================================

/**
 * Invokes Google Gemini API with civil engineering system instructions and beam telemetry.
 *
 * @param {string} prompt Engineer user prompt.
 * @param {Array<{ role: string; content: string }>} history Conversation history.
 * @param {StructuralConsultantRequestBody["simulatorState"]} state Simulator snapshot.
 * @param {string} apiKey Valid Google Gemini API Key.
 * @returns {Promise<string | null>} Model text response or null on network error.
 */
async function callGeminiConsultant(
  prompt: string,
  history: Array<{ role: string; content: string }>,
  state: StructuralConsultantRequestBody["simulatorState"] | undefined,
  apiKey: string,
): Promise<string | null> {
  const model = appConfig.ai.consultantModel;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const span = state?.spanLengthM ? Number(state.spanLengthM) : 6.0;
  const defl = Math.abs(state?.maxDeflectionMm ?? 0);
  const denom = state?.deflectionLimitDenominator ?? 360;
  const mu = state?.governingForces?.absoluteMaxMu ?? 0;
  const vu = state?.governingForces?.absoluteMaxVu ?? 0;
  const material = state?.materialKind ?? "STEEL";
  const profileName = state?.steelProfileName ?? "IWF 300x150";

  const systemInstruction = `You are the Lead Structural Engineering Consultant for IBDS (Interactive Beam Deflection Simulator).
You are an expert in Indonesian National Standards:
- SNI 2847:2019 (Persyaratan Beton Struktural untuk Bangunan Gedung)
- SNI 1729:2020 (Spesifikasi untuk Bangunan Gedung Baja Struktural)

CURRENT BEAM SIMULATOR TELEMETRY:
- Material: ${material}
- Active Profile: ${profileName}
- Span Length L: ${span.toFixed(2)} m
- Factored Design Moment Mu: ${mu.toFixed(2)} kNm
- Factored Design Shear Vu: ${vu.toFixed(2)} kN
- Maximum Deflection -Delta_max: -${defl.toFixed(2)} mm
- Deflection Limit (L/${denom}): ${((span * 1000) / denom).toFixed(2)} mm

Provide precise, technically rigorous, professional engineering guidance in Indonesian.
Use LaTeX math format ($...$ and $$...$$) for formulas. Give clear conclusions (AMAN / PERLU REVISI).`;

  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

  // Append history
  for (const h of history) {
    contents.push({
      role: h.role === "assistant" ? "model" : "user",
      parts: [{ text: h.content }],
    });
  }

  // Append current prompt
  contents.push({
    role: "user",
    parts: [{ text: prompt }],
  });

  const payload = {
    contents,
    systemInstruction: {
      parts: [{ text: systemInstruction }],
    },
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1200,
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(2500),
    });

    if (!response.ok) return null;

    const result = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    return result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
  } catch {
    return null;
  }
}

// ============================================================================
// Next.js Route Handler (POST /api/ai/structural-consultant)
// ============================================================================

/**
 * POST endpoint for the Structural Engineering AI Consultant.
 *
 * @param {Request} req HTTP Request.
 * @returns {Promise<Response>} JSON Response returning `StructuralConsultantResponse`.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as StructuralConsultantRequestBody;
    const prompt =
      body.prompt?.trim() ||
      body.messages?.[body.messages.length - 1]?.content?.trim() ||
      "Berikan rekomendasi desain balok";

    const history = body.messages ? body.messages.slice(0, -1) : [];

    // 1. Attempt Gemini call if API key configured
    const apiKey =
      appConfig.ai.apiKey ||
      Bun.env.AI_PROVIDER_API_KEY?.trim() ||
      Bun.env.GEMINI_API_KEY?.trim() ||
      process.env.AI_PROVIDER_API_KEY?.trim() ||
      process.env.GEMINI_API_KEY?.trim();
    if (apiKey && apiKey !== "your_gemini_api_key_here") {
      try {
        const geminiReply = await callGeminiConsultant(
          prompt,
          history,
          body.simulatorState,
          apiKey,
        );
        if (geminiReply) {
          const resp: StructuralConsultantResponse = {
            reply: geminiReply,
            text: geminiReply,
            response: geminiReply,
            message: geminiReply,
            sources: ["SNI 2847:2019", "SNI 1729:2020", "Gemini 2.5 Flash"],
            codeCompliance: {
              standardConcrete: "SNI 2847:2019",
              standardSteel: "SNI 1729:2020",
              deflectionCompliant:
                Math.abs(body.simulatorState?.maxDeflectionMm ?? 0) <=
                ((body.simulatorState?.spanLengthM ? Number(body.simulatorState.spanLengthM) : 6) *
                  1000) /
                  (body.simulatorState?.deflectionLimitDenominator ?? 360),
            },
          };
          return Response.json(resp, { status: 200 });
        }
      } catch {
        // Fall through to deterministic advice
      }
    }

    // 2. Deterministic SNI rule-based response
    const heuristicAdvice = generateDeterministicConsultantAdvice(prompt, body.simulatorState);
    return Response.json(heuristicAdvice, { status: 200 });
  } catch (error) {
    return Response.json(
      {
        error: `Consultant route error: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 },
    );
  }
}
