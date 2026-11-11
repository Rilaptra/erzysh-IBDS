/**
 * @file route.ts
 * @description Indonesian Structural Engineering AI Consultant API route.
 * Follows SNI 2847:2019 (Reinforced Concrete) and SNI 1729:2020 (Structural Steel).
 * Injects real-time beam analysis context (span L, active profile, DCR ratio, deflection Delta_max)
 * into Google Gemini LLM, with complete deterministic civil engineering heuristic fallback.
 */

import { appConfig } from "@/config/app-config";
import { executeGeminiWithFailover } from "@/lib/gemini-api-failover";
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

  // 0. Persona Ucuy & Penjelasan Aplikasi IBDS
  if (
    query.includes("ucuy") ||
    query.includes("siapa kamu") ||
    query.includes("siapa anda") ||
    query.includes("kamu siapa") ||
    query.includes("kenalan") ||
    query.includes("namamu")
  ) {
    const text = [
      `👋 **Halo engineer! Aku Ucuy!**`,
      `Aku adalah asisten rekayasa struktur AI dan pemandu pintar kamu di aplikasi **IBDS (Interactive Beam Deflection Simulator)**. Karakterku ramah, komunikatif, dan siap mendampingi kamu menganalisis balok secara interaktif.`,
      `**Apa saja yang bisa Ucuy bantu?**`,
      `1. **Analisis Struktur & Lendutan:** Memeriksa kesesuaian batas lendutan izin ($L/240$, $L/360$), rasio kapasitas lentur/geser ($DCR$), dan keamanan balok.`,
      `2. **Standar Nasional Indonesia (SNI):** Konsultasi teknis mendalam sesuai **SNI 2847:2019** (Beton Bertulang) dan **SNI 1729:2020** (Baja Struktural).`,
      `3. **Pemandu Fitur IBDS:** Menjelaskan cara kerja 6 jendela kerja, kontrol gestur tangan webcam MediaPipe, perintah suara (*voice commands*), hingga ekspor CAD/BIM.`,
      `Ada yang ingin kamu diskusikan atau tanyakan tentang balok saat ini?`,
    ].join("\n\n");

    return {
      reply: text,
      text,
      response: text,
      message: text,
      sources: ["Asisten Rekayasa AI IBDS - Ucuy"],
      codeCompliance: {
        standardConcrete: "SNI 2847:2019",
        standardSteel: "SNI 1729:2020",
        deflectionCompliant: deflPass,
      },
    };
  }

  if (
    query.includes("aplikasi") ||
    query.includes("ibds") ||
    query.includes("tentang") ||
    query.includes("fitur") ||
    query.includes("cara pakai") ||
    query.includes("simulator")
  ) {
    const text = [
      `🏗️ **Tentang IBDS (Interactive Beam Deflection Simulator):**`,
      `IBDS adalah platform simulasi dan analisis lendutan balok interaktif berbasis web generasi baru yang menggabungkan presisi mekanika rekayasa teknik sipil dengan visualisasi 3D real-time dan kendali AI multimodal.`,
      `**Fitur-Fitur Utama IBDS:**`,
      `1. **Simulasi Lendutan Real-Time:** Menghitung elastisitas kurva lendutan, bidang gaya lintang ($SFD$), momen lentur ($BMD$), dan reaksi tumpuan seketika saat parameter diubah.`,
      `2. **Kesesuaian Standar SNI:** Standar ketat **SNI 2847:2019** (Beton Bertulang) dan **SNI 1729:2020** (Baja Struktural IWF, Box, dll).`,
      `3. **3D Viewport Tiga Dimensi:** Tampilan 3D isometrik, tampak depan 2D, mode solid + potongan beton, serta wireframe tulangan lentur dan sengkang secara detail.`,
      `4. **6 Jendela Kerja Terpadu:** Material & Beban, Tumpuan Balok, Dimensi Penampang & Tulangan, Optimasi Profil, Diagram Gaya Dalam, serta Asisten AI & Gestur.`,
      `5. **Interaksi Multimodal Modern:** Mendukung perintah suara hands-free dengan wake-word *"halo ucuy"*, deteksi tepuk tangan 2x (*double-clap*), dan *Hand Tracking* webcam MediaPipe.`,
      `6. **Ekspor CAD & Rekayasa:** Ekspor seketika ke AutoCAD DXF, SAP2000 (.s2k), Revit IFC4, IDEA StatiCa XML, dan SolidWorks STEP.`,
      `Silakan katakan atau ketik pertanyaan seputar analisis balok atau fitur yang ingin kamu coba!`,
    ].join("\n\n");

    return {
      reply: text,
      text,
      response: text,
      message: text,
      sources: [
        "SNI 2847:2019",
        "SNI 1729:2020",
        "Dokumentasi IBDS (Interactive Beam Deflection Simulator)",
      ],
      codeCompliance: {
        standardConcrete: "SNI 2847:2019",
        standardSteel: "SNI 1729:2020",
        deflectionCompliant: deflPass,
      },
    };
  }

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
  apiKey?: string,
): Promise<string | null> {
  const isTest = process.env.NODE_ENV === "test" || Bun.env?.NODE_ENV === "test";
  if (isTest) {
    return null;
  }

  const primaryModel = appConfig.ai.consultantModel;
  const candidateModels = Array.from(new Set([primaryModel, ...appConfig.ai.fallbackModels]));

  const span = state?.spanLengthM ? Number(state.spanLengthM) : 6.0;
  const defl = Math.abs(state?.maxDeflectionMm ?? 0);
  const denom = state?.deflectionLimitDenominator ?? 360;
  const mu = state?.governingForces?.absoluteMaxMu ?? 0;
  const vu = state?.governingForces?.absoluteMaxVu ?? 0;
  const material = state?.materialKind ?? "STEEL";
  const profileName = state?.steelProfileName ?? "IWF 300x150";

  const systemInstruction = `Kamu adalah Ucuy, Asisten & Konsultan Rekayasa Struktur AI resmi di aplikasi IBDS (Interactive Beam Deflection Simulator).
Nama Kamu: Ucuy.
Karakter: Ramah, komunikatif, bersahabat, santai namun sangat cerdas, teliti, dan berwawasan teknis rekayasa struktur sipil yang mendalam. Kamu adalah rekan diskusi teknik sipil yang solutif bagi mahasiswa, dosen, maupun praktisi perencana struktur.

PENGETAHUAN LENGKAP TENTANG APLIKASI IBDS:
- IBDS adalah platform simulasi dan analisis lendutan balok interaktif berbasis web generasi baru yang mengintegrasikan perhitungan mekanika struktur dengan visualisasi 3D real-time dan kendali AI multimodal.
- Standar Desain Nasional Indonesia:
  1. SNI 2847:2019 (Persyaratan Beton Struktural untuk Bangunan Gedung)
  2. SNI 1729:2020 (Spesifikasi untuk Bangunan Gedung Baja Struktural)
- Fitur-Fitur Utama IBDS yang kamu kuasai secara mendalam:
  1. 3D Viewport Tiga Dimensi Three.js: Tampilan 3D Isometrik, Tampak Depan 2D ortogonal, Beton Solid + Potongan, Wireframe Tulangan 3D lentur dan sengkang, serta sistem koordinat Z-Up (Sipil) dan Y-Up (CAD).
  2. Diagram Gaya Dalam Real-time: Bidang Geser/Lintang (SFD), Bidang Momen Lentur (BMD), Bidang Normal (NFD), dan Bidang Torsi (TFD) dalam mode In-Place 3D atau Stacked.
  3. 6 Jendela Kerja Fleksibel (Floating Windows):
     - Window 1: Material & Mode Pembebanan (Baja SNI 1729:2020 / Beton SNI 2847:2019, Mode A Beban Eksternal / Mode B Gaya Dalam Langsung).
     - Window 2: Beban & Tumpuan Balok (Sendi-Rol, Jepit-Bebas Cantilever, Jepit-Jepit, Jepit-Sendi, Beban Titik P, Beban Merata q).
     - Window 3: Parameter Penampang & Tulangan (Katalog Baja IWF / Box, Mutu BJ 34-55, Dimensi Beton b x h, Mutu fc', Tulangan Tarik/Tekan, Sengkang Av).
     - Window 4: Optimasi Profil Balok Otomatis.
     - Window 5: Diagram Gaya Dalam (SFD, BMD, Kurva Lendutan Defleksi Elastis).
     - Window 6: Gestur Tangan & Asisten Rekayasa AI (MediaPipe Webcam Hand Tracking: pinch pan/zoom/rotasi, Voice Command pintar dengan wake-word "halo ucuy" atau tepukan tangan 2x, dan Chatbot Konsultan Struktur bersama Ucuy).
  4. Ekspor CAD & Rekayasa: AutoCAD DXF, SAP2000 (.s2k), Revit IFC4 BIM, IDEA StatiCa XML, SolidWorks STEP.

TELEMETRI SIMULATOR BALOK SAAT INI:
- Material Aktif: ${material}
- Profil Aktif: ${profileName}
- Panjang Bentang L: ${span.toFixed(2)} m
- Momen Lentur Desain Terfaktor Mu: ${mu.toFixed(2)} kNm
- Gaya Geser Desain Terfaktor Vu: ${vu.toFixed(2)} kN
- Lendutan Terhitung Maksimum: -${defl.toFixed(2)} mm
- Batas Izin Lendutan (L/${denom}): ${((span * 1000) / denom).toFixed(2)} mm

PANDUAN MERESPONS:
1. Sapa pengguna dengan hangat, ramah, dan bersahabat ("Halo engineer!", "Siap, Ucuy bantu ya!").
2. Jika pengguna bertanya tentang siapa kamu atau menyapa, perkenalkan dirimu sebagai Ucuy dengan ceria.
3. Jika pengguna bertanya tentang fitur aplikasi IBDS atau cara kerjanya, jelaskan secara jelas, runtut, dan antusias.
4. Jika pengguna berkonsultasi mengenai teknis struktur atau lendutan, berikan bimbingan teknis yang presisi, mendalam, dan aplikatif sesuai SNI 2847:2019 / SNI 1729:2020.
5. Gunakan format LaTeX ($...$ untuk rumus sebaris dan $$...$$ untuk rumus blok display) untuk setiap formula atau notasi teknis.
6. Berikan kesimpulan status yang tegas dan jelas (AMAN / PERLU REVISI / OVERDEFLECTION) disertai saran optimasi penampang yang konkret.`;

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

  const execResult = await executeGeminiWithFailover({
    candidateModels,
    candidateKeys: apiKey ? [apiKey, ...appConfig.ai.fallbackApiKeys] : undefined,
    systemInstruction,
    contents,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1200,
    },
    timeoutMs: 3500,
    logPrefix: "Structural Consultant",
  });

  return execResult?.text ?? null;
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
    if (appConfig.ai.apiKeys.length > 0) {
      try {
        const geminiReply = await callGeminiConsultant(prompt, history, body.simulatorState);
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
