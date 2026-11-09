/**
 * @file command-matcher.ts
 * @description Dual-engine Natural Language Intent Matcher for IBDS (Interactive Beam Deflection Simulator).
 *
 * Supports:
 * 1. Single-Command Matching (Indonesian & English keyword parsing with parameter extraction).
 * 2. Multi-Command Compound Parsing (e.g. "ganti ke beton dan munculkan jendela untuk mengatur dimensi dan gaya dalam").
 * 3. Multi-Window and Multi-Diagram Action batching.
 * 4. Contextual suggestion generation.
 */

import { matchWakeWord } from "@/lib/wake-word-detector";
import type { FloatingWindowId } from "@/state/floating-window-store";
import type {
  CommandId,
  IntentActionItem,
  IntentRouterResult,
} from "@/types/command-registry-types";
import type { SteelGrade, SteelProfileType } from "@/types/steel-sni1729-types";

// ============================================================================
// Context-Aware Dynamic Suggestions Generator
// ============================================================================

/**
 * Generates 3-4 context-aware suggestions based on executed command or state.
 */
export function generateContextualSuggestions(
  commandId: CommandId,
  _params: Record<string, unknown> = {},
): string[] {
  switch (commandId) {
    case "SWITCH_MATERIAL_CONCRETE":
      return [
        "Lihat wireframe tulangan balok",
        "Atur mutu beton fc 35 MPa",
        "Tampilkan tampak depan 2D",
        "Tambahkan beban titik 60 kN",
      ];
    case "SWITCH_MATERIAL_STEEL":
      return [
        "Filter profil IWF baja",
        "Pilih profil IWF 300x150",
        "Optimalkan penampang profil",
        "Ekspor ke AutoCAD DXF",
      ];
    case "SET_VIEW_ISOMETRIC":
    case "SET_VIEW_FRONT":
    case "FIT_CAMERA_VIEW":
      return [
        "Tampilkan diagram momen BMD",
        "Lihat wireframe tulangan",
        "Beralih ke tampilan 3D isometrik",
        "Fit tampilan balok",
      ];
    case "SET_CONCRETE_VIEW_WIREFRAME":
    case "SET_CONCRETE_VIEW_SOLID":
      return [
        "Tampilkan solid potongan",
        "Tampak depan 2D",
        "Ubah mutu beton fc 30 MPa",
        "Ekspor model BIM IFC",
      ];
    case "ADD_POINT_LOAD":
    case "ADD_DISTRIBUTED_LOAD":
    case "CLEAR_ALL_LOADS":
      return [
        "Tampilkan bidang momen BMD",
        "Tampilkan gaya geser SFD",
        "Optimasi penampang profil",
        "Atur tumpuan ke Jepit-Rol",
      ];
    case "TOGGLE_DIAGRAM_BMD":
    case "TOGGLE_DIAGRAM_SFD":
    case "TOGGLE_DIAGRAM_NFD":
    case "TOGGLE_DIAGRAM_TFD":
      return [
        "Mode diagram vertikal stacked",
        "Mode diagram in-place sejajar balok",
        "Buka jendela optimasi",
        "Ekspor file SAP2000",
      ];
    case "SET_SPAN_LENGTH":
      return [
        "Tambah beban titik 50 kN",
        "Tambah beban merata 20 kN/m",
        "Hitung optimasi profil",
        "Tampilkan diagram geser SFD",
      ];
    case "EXPORT_DXF":
    case "EXPORT_SAP2000":
    case "EXPORT_IFC":
      return [
        "Buka modal ekspor CAD",
        "Ekspor model IDEA StatiCa",
        "Ekspor file 3D SolidWorks",
        "Kembali ke 3D isometrik",
      ];
    case "OPEN_WINDOW":
    case "CLOSE_WINDOW":
    case "OPEN_ALL_WINDOWS":
    case "CLOSE_ALL_WINDOWS":
      return [
        "Buka jendela beban",
        "Buka jendela parameter",
        "Tutup semua jendela",
        "Reset posisi jendela",
      ];
    case "TOGGLE_CAMERA_PREVIEW":
      return [
        "Mode hemat eco 16 FPS",
        "Tutup video kamera",
        "Buka jendela asisten AI",
        "Fit tampilan balok",
      ];
    case "AI_CONSULTATION":
      return [
        "Tanya saran optimasi balok",
        "Hitung optimasi profil",
        "Tampilkan diagram momen BMD",
        "Buka jendela dimensi dan parameter",
      ];
    default:
      return [
        "Beralih ke material baja",
        "Tampilkan diagram momen BMD",
        "Atur bentang balok 8 meter",
        "Ekspor ke AutoCAD DXF",
      ];
  }
}

// ============================================================================
// Single Command Matcher (Deterministic High-Speed Rule Engine)
// ============================================================================

/**
 * Matches a single clause against all known structural simulator commands.
 */
export function matchSingleRuleIntent(transcript: string): IntentRouterResult | null {
  const raw = transcript.trim();
  const lower = raw.toLowerCase();

  if (!lower) return null;

  // 0. Wake Words ("halo cuy", "halo ucuy", "ucuy", "oi cuy", dsb.) & Double Clap
  const wakeMatch = matchWakeWord(raw);
  if (wakeMatch.matched) {
    const isUcuy = wakeMatch.wakeWord?.includes("ucuy") ?? false;
    let greetingLabel = isUcuy ? "Halo! Ucuy di sini!" : "Halo cuy!";
    if (wakeMatch.wakeWord === "oi ucuy" || wakeMatch.wakeWord === "oi cuy") {
      greetingLabel = isUcuy ? "Oi! Ucuy siap bantu!" : "Oi cuy!";
    } else if (wakeMatch.wakeWord === "hey ucuy" || wakeMatch.wakeWord === "hey cuy") {
      greetingLabel = isUcuy ? "Hey! Ucuy siap!" : "Hey cuy!";
    } else if (wakeMatch.wakeWord === "woi ucuy" || wakeMatch.wakeWord === "woi cuy") {
      greetingLabel = isUcuy ? "Woi! Ucuy mendengarkan!" : "Woi cuy!";
    } else if (wakeMatch.wakeWord === "ucuy") {
      greetingLabel = "Iya, Ucuy di sini!";
    }

    if (wakeMatch.remainingText) {
      const subIntent = matchSingleRuleIntent(wakeMatch.remainingText);
      if (subIntent) {
        return {
          ...subIntent,
          rawTranscript: raw,
          spokenConfirmation: subIntent.spokenConfirmation
            ? `${greetingLabel} ${subIntent.spokenConfirmation}`
            : `${greetingLabel} Perintah dijalankan.`,
        };
      }
    }

    return {
      commandId: "UNMUTE_VOICE_COMMAND",
      confidence: 0.98,
      extractedParameters: { wakeWord: wakeMatch.wakeWord },
      rawTranscript: raw,
      spokenConfirmation: isUcuy
        ? `${greetingLabel} Siap menerima perintah atau pertanyaan seputar simulasi balok.`
        : `${greetingLabel} Voice command aktif, siap menerima perintah.`,
      suggestions: [
        "Beralih ke material baja",
        "Tampilkan diagram momen BMD",
        "Atur bentang balok 8 meter",
      ],
    };
  }

  // 0b. Persona & App Explanations for Ucuy
  if (
    lower.includes("siapa kamu") ||
    lower.includes("nama kamu") ||
    lower.includes("kamu siapa") ||
    lower.includes("tentang ucuy") ||
    lower === "ucuy"
  ) {
    return {
      commandId: "AI_CONSULTATION",
      confidence: 0.98,
      extractedParameters: { topic: "IDENTITY" },
      rawTranscript: raw,
      spokenConfirmation:
        "Halo! Aku Ucuy, asisten rekayasa struktur cerdas kamu di IBDS. Aku siap bantu simulasi, optimasi balok, dan cek kepatuhan SNI!",
      suggestions: [
        "Jelaskan fitur aplikasi ini",
        "Hitung optimasi profil balok",
        "Tampilkan diagram momen BMD",
        "Buka jendela asisten AI",
      ],
    };
  }

  if (
    lower.includes("jelaskan aplikasi ini") ||
    lower.includes("aplikasi apa ini") ||
    lower.includes("apa itu ibds") ||
    lower.includes("fitur aplikasi") ||
    lower.includes("cara pakai aplikasi") ||
    lower.includes("bisa apa saja") ||
    lower.includes("panduan aplikasi")
  ) {
    return {
      commandId: "AI_CONSULTATION",
      confidence: 0.98,
      extractedParameters: { topic: "APP_EXPLANATION" },
      rawTranscript: raw,
      spokenConfirmation:
        "IBDS adalah simulator interaktif lendutan balok baja dan beton bertulang real-time, lengkap dengan diagram gaya dalam, visual 3D, dan ekspor CAD BIM.",
      suggestions: [
        "Beralih ke material baja",
        "Ubah ke beton bertulang",
        "Lihat tampak depan 2D",
        "Buka jendela asisten AI",
      ],
    };
  }

  if (
    lower.includes("dua kali tepuk") ||
    lower.includes("tepuk dua kali") ||
    lower.includes("tepuk tangan") ||
    lower.includes("double clap")
  ) {
    return {
      commandId: "UNMUTE_VOICE_COMMAND",
      confidence: 0.98,
      extractedParameters: { source: "DOUBLE_CLAP" },
      rawTranscript: raw,
      spokenConfirmation: "Tepuk tangan terdeteksi. Voice command aktif, siap menerima perintah.",
      suggestions: [
        "Beralih ke material baja",
        "Tampilkan diagram momen BMD",
        "Atur bentang balok 8 meter",
      ],
    };
  }

  // 1. Camera & 3D Viewport Controls (All Viewport Toolbar Buttons)
  if (
    lower.includes("isometrik") ||
    lower.includes("isometric") ||
    lower.includes("view 3d") ||
    lower.includes("tampilan 3d")
  ) {
    return {
      commandId: "SET_VIEW_ISOMETRIC",
      confidence: 0.96,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Tampilan viewport dialihkan ke 3D Isometrik.",
      suggestions: generateContextualSuggestions("SET_VIEW_ISOMETRIC"),
    };
  }
  if (
    lower.includes("tampak depan") ||
    lower.includes("view 2d") ||
    lower.includes("tampilan 2d") ||
    lower.includes("front 2d") ||
    lower.includes("pandangan depan")
  ) {
    return {
      commandId: "SET_VIEW_FRONT",
      confidence: 0.96,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Tampilan viewport dialihkan ke Tampak Depan 2D ortogonal.",
      suggestions: generateContextualSuggestions("SET_VIEW_FRONT"),
    };
  }
  if (
    lower.includes("fit view") ||
    lower.includes("fit tampilan") ||
    lower.includes("zoom fit") ||
    lower.includes("fokuskan balok") ||
    lower.includes("reset kamera") ||
    lower.includes("fokus kamera") ||
    lower.includes("center view")
  ) {
    return {
      commandId: "FIT_CAMERA_VIEW",
      confidence: 0.96,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Kamera 3D difokuskan kembali ke seluruh bentang balok.",
      suggestions: generateContextualSuggestions("FIT_CAMERA_VIEW"),
    };
  }

  // 2. Concrete 3D Visualizer Sub-Modes
  if (
    lower.includes("wireframe") ||
    lower.includes("rebar cage") ||
    lower.includes("kerangka tulangan") ||
    lower.includes("tulang balok") ||
    lower.includes("lihat tulangan") ||
    lower.includes("tampilkan tulangan")
  ) {
    return {
      commandId: "SET_CONCRETE_VIEW_WIREFRAME",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Mode visualisasi beton diubah ke Wireframe Kerangka Tulangan.",
      suggestions: generateContextualSuggestions("SET_CONCRETE_VIEW_WIREFRAME"),
    };
  }
  if (
    lower.includes("solid potongan") ||
    lower.includes("beton padat") ||
    lower.includes("solid penampang") ||
    lower.includes("tampilan padat") ||
    lower.includes("solid mode")
  ) {
    return {
      commandId: "SET_CONCRETE_VIEW_SOLID",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Mode visualisasi beton diubah ke Solid + Potongan Ujung.",
      suggestions: generateContextualSuggestions("SET_CONCRETE_VIEW_SOLID"),
    };
  }

  // 3. 3D Coordinate Axis Conventions
  if (
    lower.includes("z-up") ||
    lower.includes("z up") ||
    lower.includes("sumbu z") ||
    lower.includes("standar sipil") ||
    lower.includes("civil coordinate")
  ) {
    return {
      commandId: "SET_COORDINATE_Z_UP",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Sistem koordinat 3D diatur ke Z-Up (Standar Rekayasa Sipil).",
      suggestions: ["Beralih ke Y-Up CAD", "Fit tampilan balok", "Tampak Depan 2D"],
    };
  }
  if (
    lower.includes("y-up") ||
    lower.includes("y up") ||
    lower.includes("sumbu y") ||
    lower.includes("standar cad") ||
    lower.includes("threejs coordinate")
  ) {
    return {
      commandId: "SET_COORDINATE_Y_UP",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Sistem koordinat 3D diatur ke Y-Up (Standar CAD / WebGL).",
      suggestions: ["Beralih ke Z-Up Sipil", "Fit tampilan balok", "Tampilan 3D Isometrik"],
    };
  }

  // 4. Floating Windows Management
  const isClosing =
    lower.includes("tutup") || lower.includes("close") || lower.includes("sembunyikan");

  if (
    lower.includes("buka semua jendela") ||
    lower.includes("tampilkan semua jendela") ||
    lower.includes("open all windows")
  ) {
    return {
      commandId: "OPEN_ALL_WINDOWS",
      confidence: 0.97,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Semua jendela kerja telah dibuka kembali.",
      suggestions: ["Tutup semua jendela", "Reset tata letak jendela", "Fit tampilan balok"],
    };
  }
  if (
    lower.includes("tutup semua jendela") ||
    lower.includes("sembunyikan semua jendela") ||
    lower.includes("close all windows")
  ) {
    return {
      commandId: "CLOSE_ALL_WINDOWS",
      confidence: 0.97,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Semua jendela kerja telah ditutup untuk tampilan balok penuh.",
      suggestions: ["Buka semua jendela", "Reset tata letak jendela", "Buka jendela material"],
    };
  }
  if (
    lower.includes("reset jendela") ||
    lower.includes("reset tata letak") ||
    lower.includes("reset layout") ||
    lower.includes("kembalikan jendela")
  ) {
    return {
      commandId: "RESET_WINDOWS_LAYOUT",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Tata letak posisi jendela kerja telah dikembalikan ke default.",
      suggestions: ["Buka jendela material", "Buka jendela optimasi", "Fit tampilan balok"],
    };
  }

  // Window targeting (Open / Close by window name)
  if (
    lower.includes("jendela material") ||
    lower.includes("window material") ||
    lower.includes("panel material")
  ) {
    return {
      commandId: isClosing ? "CLOSE_WINDOW" : "OPEN_WINDOW",
      confidence: 0.95,
      extractedParameters: { target: "MATERIAL_LOAD_MODE" },
      rawTranscript: raw,
      spokenConfirmation: `Jendela Material & Mode ${isClosing ? "ditutup" : "dibuka"}.`,
      suggestions: ["Ubah ke beton bertulang", "Ganti ke baja struktural", "Mode beban eksternal"],
    };
  }
  if (
    lower.includes("jendela beban") ||
    lower.includes("window beban") ||
    lower.includes("panel beban")
  ) {
    return {
      commandId: isClosing ? "CLOSE_WINDOW" : "OPEN_WINDOW",
      confidence: 0.95,
      extractedParameters: { target: "REALTIME_LOAD_INPUT" },
      rawTranscript: raw,
      spokenConfirmation: `Jendela Beban & Tumpuan ${isClosing ? "ditutup" : "dibuka"}.`,
      suggestions: ["Tambah beban titik 50 kN", "Tambah beban merata 15 kN/m", "Tumpuan sendi rol"],
    };
  }
  if (
    lower.includes("jendela parameter") ||
    lower.includes("window parameter") ||
    lower.includes("jendela dimensi") ||
    lower.includes("window dimensi") ||
    lower.includes("panel dimensi") ||
    lower.includes("mengatur dimensi") ||
    lower.includes("atur dimensi")
  ) {
    return {
      commandId: isClosing ? "CLOSE_WINDOW" : "OPEN_WINDOW",
      confidence: 0.95,
      extractedParameters: { target: "SNI_DESIGN_PARAMETERS" },
      rawTranscript: raw,
      spokenConfirmation: `Jendela Parameter Dimensi & SNI ${isClosing ? "ditutup" : "dibuka"}.`,
      suggestions: ["Mutu baja BJ 50", "Mutu beton fc 35 MPa", "Filter profil IWF"],
    };
  }
  if (
    lower.includes("jendela optimasi") ||
    lower.includes("window optimasi") ||
    lower.includes("jendela hasil") ||
    lower.includes("panel optimasi")
  ) {
    return {
      commandId: isClosing ? "CLOSE_WINDOW" : "OPEN_WINDOW",
      confidence: 0.95,
      extractedParameters: { target: "OPTIMIZATION_RESULTS" },
      rawTranscript: raw,
      spokenConfirmation: `Jendela Hasil Optimasi ${isClosing ? "ditutup" : "dibuka"}.`,
      suggestions: ["Hitung optimasi penampang", "Buka modal ekspor CAD", "Ekspor ke AutoCAD"],
    };
  }
  if (
    lower.includes("jendela diagram") ||
    lower.includes("window diagram") ||
    lower.includes("panel diagram") ||
    lower.includes("jendela gaya dalam") ||
    lower.includes("window gaya dalam") ||
    lower.includes("gaya dalam")
  ) {
    return {
      commandId: isClosing ? "CLOSE_WINDOW" : "OPEN_WINDOW",
      confidence: 0.95,
      extractedParameters: { target: "INTERNAL_FORCE_DIAGRAMS" },
      rawTranscript: raw,
      spokenConfirmation: `Jendela Diagram Gaya Dalam ${isClosing ? "ditutup" : "dibuka"}.`,
      suggestions: ["Tampilkan momen BMD", "Tampilkan geser SFD", "Mode stacked vertikal"],
    };
  }
  if (
    lower.includes("jendela asisten") ||
    lower.includes("jendela ai") ||
    lower.includes("jendela gestur")
  ) {
    return {
      commandId: isClosing ? "CLOSE_WINDOW" : "OPEN_WINDOW",
      confidence: 0.95,
      extractedParameters: { target: "GESTURE_AI_ASSISTANT" },
      rawTranscript: raw,
      spokenConfirmation: `Jendela AI & Gestur Tangan ${isClosing ? "ditutup" : "dibuka"}.`,
      suggestions: ["Nyalakan kamera gestur", "Matikan kamera", "Tanya saran optimasi balok"],
    };
  }

  // 5. Numerical Parameter Adjustments (Span, Loads, Deflection)
  const spanMatch = lower.match(
    /(?:bentang|span|panjang|length)\s*(?:balok\s*)?(?:menjadi|ke|is)?\s*([0-9]+(?:[.,][0-9]+)?)\s*(?:m|meter)?/,
  );
  if (spanMatch && spanMatch[1]) {
    const val = parseFloat(spanMatch[1].replace(",", "."));
    if (!Number.isNaN(val) && val > 0 && val <= 50) {
      return {
        commandId: "SET_SPAN_LENGTH",
        confidence: 0.96,
        extractedParameters: { spanLengthM: val },
        rawTranscript: raw,
        spokenConfirmation: `Panjang bentang balok berhasil diatur ke ${val} meter.`,
        suggestions: generateContextualSuggestions("SET_SPAN_LENGTH"),
      };
    }
  }

  const pointLoadMatch = lower.match(
    /(?:beban titik|point load|beban terpusat)\s*(?:sebesar)?\s*([0-9]+(?:[.,][0-9]+)?)\s*(?:kn)?(?:\s*(?:di|posisi|x\s*=)\s*([0-9]+(?:[.,][0-9]+)?))?/,
  );
  if (pointLoadMatch && pointLoadMatch[1]) {
    const mag = parseFloat(pointLoadMatch[1].replace(",", "."));
    const pos = pointLoadMatch[2] ? parseFloat(pointLoadMatch[2].replace(",", ".")) : undefined;
    return {
      commandId: "ADD_POINT_LOAD",
      confidence: 0.94,
      extractedParameters: { magnitudeKn: mag, positionM: pos },
      rawTranscript: raw,
      spokenConfirmation: `Beban titik terpusat ${mag} kN berhasil ditambahkan.`,
      suggestions: generateContextualSuggestions("ADD_POINT_LOAD"),
    };
  }

  const distLoadMatch = lower.match(
    /(?:beban merata|distributed load|beban terbagi rata)\s*(?:sebesar)?\s*([0-9]+(?:[.,][0-9]+)?)\s*(?:kn\/m|knm|kilonewton)?/,
  );
  if (distLoadMatch && distLoadMatch[1]) {
    const mag = parseFloat(distLoadMatch[1].replace(",", "."));
    return {
      commandId: "ADD_DISTRIBUTED_LOAD",
      confidence: 0.94,
      extractedParameters: { magnitudeKnPerM: mag },
      rawTranscript: raw,
      spokenConfirmation: `Beban merata ${mag} kN/m berhasil ditambahkan.`,
      suggestions: generateContextualSuggestions("ADD_DISTRIBUTED_LOAD"),
    };
  }

  if (
    lower.includes("hapus semua beban") ||
    lower.includes("clear all loads") ||
    lower.includes("hilangkan beban") ||
    lower.includes("reset beban")
  ) {
    return {
      commandId: "CLEAR_ALL_LOADS",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Seluruh beban eksternal telah dihapus.",
      suggestions: [
        "Tambah beban titik 50 kN",
        "Tambah beban merata 15 kN/m",
        "Buka jendela beban",
      ],
    };
  }

  if (
    lower.includes("berat sendiri") ||
    lower.includes("self weight") ||
    lower.includes("beban mati sendiri")
  ) {
    return {
      commandId: "TOGGLE_SELF_WEIGHT",
      confidence: 0.94,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Status perhitungan beban berat sendiri balok berhasil diubah.",
      suggestions: ["Lihat diagram momen BMD", "Hitung optimasi profil", "Ubah bentang balok"],
    };
  }

  const deflLimitMatch = lower.match(
    /(?:batas lendutan|deflection limit|izin lendutan)\s*(?:l\/)?([0-9]{3})/,
  );
  if (deflLimitMatch && deflLimitMatch[1]) {
    const den = parseInt(deflLimitMatch[1], 10);
    if ([180, 240, 360, 480].includes(den)) {
      return {
        commandId: "SET_DEFLECTION_LIMIT",
        confidence: 0.95,
        extractedParameters: { denominator: den },
        rawTranscript: raw,
        spokenConfirmation: `Batas izin lendutan balok diatur ke L/${den}.`,
        suggestions: [
          "Optimasi penampang profil",
          "Tampilkan diagram lendutan",
          "Buka jendela parameter",
        ],
      };
    }
  }

  // 6. Support Boundary Conditions
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
      spokenConfirmation: "Konfigurasi tumpuan diatur ke Jepit-Bebas (Kantilever).",
      suggestions: [
        "Tampilkan diagram momen BMD",
        "Tambah beban di ujung bebas",
        "Atur bentang 4 meter",
      ],
    };
  }
  if (
    lower.includes("jepit jepit") ||
    lower.includes("fixed fixed") ||
    lower.includes("jepit ganda")
  ) {
    return {
      commandId: "SET_SUPPORT_FIXED_FIXED",
      confidence: 0.96,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Konfigurasi tumpuan diatur ke Jepit-Jepit (Fixed-Fixed).",
      suggestions: [
        "Tampilkan momen lapangan dan tumpuan",
        "Optimasi penampang",
        "Mode diagram in-place",
      ],
    };
  }
  if (lower.includes("jepit sendi") || lower.includes("fixed pinned")) {
    return {
      commandId: "SET_SUPPORT_FIXED_PINNED",
      confidence: 0.96,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Konfigurasi tumpuan diatur ke Jepit-Sendi.",
      suggestions: [
        "Tampilkan diagram momen BMD",
        "Tampilkan diagram geser SFD",
        "Buka jendela beban",
      ],
    };
  }
  if (lower.includes("jepit rol") || lower.includes("fixed roller")) {
    return {
      commandId: "SET_SUPPORT_FIXED_ROLLER",
      confidence: 0.96,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Konfigurasi tumpuan diatur ke Jepit-Rol.",
      suggestions: ["Tampilkan diagram geser SFD", "Tambah beban merata", "Optimasi profil"],
    };
  }
  if (
    lower.includes("sendi rol") ||
    lower.includes("sendi-rol") ||
    lower.includes("sendi dan rol") ||
    lower.includes("pinned roller") ||
    lower.includes("simply supported") ||
    lower.includes("sederhana")
  ) {
    return {
      commandId: "SET_SUPPORT_PINNED_ROLLER",
      confidence: 0.96,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Konfigurasi tumpuan diatur ke Sendi-Rol (Simply Supported).",
      suggestions: [
        "Tampilkan momen maksimum lapangan",
        "Tambah beban titik 50 kN",
        "Hitung optimasi",
      ],
    };
  }

  // 7. Loading Paradigm Modes
  if (
    lower.includes("mode beban eksternal") ||
    lower.includes("paradigma beban") ||
    lower.includes("external load mode")
  ) {
    return {
      commandId: "SWITCH_MODE_EXTERNAL_LOADS",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Mode pembebanan dialihkan ke Paradigma A: Beban Eksternal.",
      suggestions: [
        "Tambah beban titik 50 kN",
        "Tambah beban merata 20 kN/m",
        "Buka jendela beban",
      ],
    };
  }
  if (
    lower.includes("mode gaya dalam") ||
    lower.includes("direct forces mode") ||
    lower.includes("input mu vu")
  ) {
    return {
      commandId: "SWITCH_MODE_DIRECT_FORCES",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation:
        "Mode pembebanan dialihkan ke Paradigma B: Gaya Dalam Langsung (Mu, Vu, Pu, Tu).",
      suggestions: ["Buka jendela parameter SNI", "Hitung optimasi profil", "Ubah mutu material"],
    };
  }

  // 8. Internal Force Diagrams
  if (
    lower.includes("diagram momen") ||
    lower.includes("bidang momen") ||
    lower.includes("bmd") ||
    lower.includes("bending moment")
  ) {
    return {
      commandId: "TOGGLE_DIAGRAM_BMD",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Diagram Bidang Momen Lentur (BMD) berhasil ditoggle.",
      suggestions: generateContextualSuggestions("TOGGLE_DIAGRAM_BMD"),
    };
  }
  if (
    lower.includes("diagram geser") ||
    lower.includes("bidang geser") ||
    lower.includes("gaya lintang") ||
    lower.includes("sfd") ||
    lower.includes("shear force")
  ) {
    return {
      commandId: "TOGGLE_DIAGRAM_SFD",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Diagram Bidang Gaya Geser (SFD) berhasil ditoggle.",
      suggestions: generateContextualSuggestions("TOGGLE_DIAGRAM_SFD"),
    };
  }
  if (
    lower.includes("diagram normal") ||
    lower.includes("bidang normal") ||
    lower.includes("gaya aksial") ||
    lower.includes("diagram aksial") ||
    lower.includes("nfd") ||
    lower.includes("axial force")
  ) {
    return {
      commandId: "TOGGLE_DIAGRAM_NFD",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Diagram Bidang Gaya Aksial / Normal (NFD) berhasil ditoggle.",
      suggestions: generateContextualSuggestions("TOGGLE_DIAGRAM_NFD"),
    };
  }
  if (
    lower.includes("momen torsi") ||
    lower.includes("diagram torsi") ||
    lower.includes("tfd") ||
    lower.includes("torsional moment")
  ) {
    return {
      commandId: "TOGGLE_DIAGRAM_TFD",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Diagram Bidang Momen Torsi (TFD) berhasil ditoggle.",
      suggestions: generateContextualSuggestions("TOGGLE_DIAGRAM_TFD"),
    };
  }
  if (
    lower.includes("mode stacked") ||
    lower.includes("diagram vertikal") ||
    lower.includes("tumpuk diagram")
  ) {
    return {
      commandId: "SET_DIAGRAM_MODE_STACKED",
      confidence: 0.94,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Tampilan diagram gaya dalam diatur ke Mode Stacked Vertikal.",
      suggestions: ["Mode in-place 3D", "Tampilkan diagram momen BMD", "Buka jendela diagram"],
    };
  }
  if (
    lower.includes("mode in-place") ||
    lower.includes("in place") ||
    lower.includes("sejajar balok") ||
    lower.includes("sumbu as balok") ||
    lower.includes("as balok")
  ) {
    return {
      commandId: "SET_DIAGRAM_MODE_IN_PLACE",
      confidence: 0.94,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Tampilan diagram gaya dalam diatur sejajar sumbu balok 3D (In-Place).",
      suggestions: ["Mode stacked vertikal", "Tampilan 3D isometrik", "Fit tampilan balok"],
    };
  }

  if (
    lower.includes("jendela terpisah") ||
    lower.includes("diagram window") ||
    lower.includes("floating diagram") ||
    lower.includes("diagram jendela") ||
    lower.includes("jendela floating")
  ) {
    return {
      commandId: "SET_DIAGRAM_MODE_WINDOW",
      confidence: 0.94,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Mode diagram dialihkan ke Jendela Mengambang mandiri.",
      suggestions: ["Diagram vertikal stacked", "Diagram in-place", "Tampilkan momen BMD"],
    };
  }

  // 9. Steel Profile Filtering & Selection
  if (lower.includes("semua profil") || lower.includes("all profiles")) {
    return {
      commandId: "FILTER_STEEL_ALL",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Katalog profil baja disetel menampilkan Seluruh Tipe Penampang.",
      suggestions: ["Pilih profil IWF 300x150", "Filter profil IWF", "Optimasi profil penampang"],
    };
  }
  if (
    lower.includes("profil iwf") ||
    lower.includes("iwf") ||
    lower.includes("profil wf") ||
    lower.includes("h-beam")
  ) {
    return {
      commandId: "FILTER_STEEL_IWF",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Filter profil baja disetel ke Profil IWF / Sayap Lebar.",
      suggestions: [
        "Pilih profil IWF 300x150",
        "Pilih profil IWF 250x125",
        "Hitung optimasi penampang",
      ],
    };
  }
  if (
    lower.includes("profil box") ||
    lower.includes("hollow box") ||
    lower.includes("pipa kotak") ||
    lower.includes("hss")
  ) {
    return {
      commandId: "FILTER_STEEL_BOX",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Filter profil baja disetel ke Penampang Hollow Box.",
      suggestions: ["Filter profil IWF", "Hitung optimasi", "Ekspor ke AutoCAD"],
    };
  }

  const steelGradeMatch = lower.match(
    /(?:mutu\s*baja|grade|baja)\s*(?:bj\s*[_]?\s*)?(34|37|41|50|55)/i,
  );
  if (steelGradeMatch && steelGradeMatch[1]) {
    const rawVal = steelGradeMatch[1].toUpperCase();
    const gradeStr = `BJ_${rawVal}` as SteelGrade;
    return {
      commandId: "SET_STEEL_GRADE",
      confidence: 0.96,
      extractedParameters: { steelGrade: gradeStr },
      rawTranscript: raw,
      spokenConfirmation: `Mutu baja struktural diatur ke BJ ${rawVal}.`,
      suggestions: ["Hitung optimasi profil", "Filter profil IWF", "Buka jendela parameter"],
    };
  }

  const profileMatch = lower.match(
    /(?:pilih|gunakan|select)?\s*(?:profil\s*)?(iwf\s*[0-9]+[xX*][0-9]+)/i,
  );
  if (profileMatch && profileMatch[1]) {
    const profName = profileMatch[1].toUpperCase().replace("*", "x");
    return {
      commandId: "SELECT_STEEL_PROFILE",
      confidence: 0.96,
      extractedParameters: { profileName: profName },
      rawTranscript: raw,
      spokenConfirmation: `Profil penampang baja diganti ke ${profName}.`,
      suggestions: ["Tampilkan diagram momen BMD", "Cek rasio kapasitas DCR", "Hitung optimasi"],
    };
  }

  // 10. Concrete Parameters (fc' and dimensions)
  const kCubeMatch = lower.match(/k\s*[-]?\s*([0-9]{3})/);
  if (kCubeMatch && kCubeMatch[1]) {
    const kVal = parseInt(kCubeMatch[1], 10);
    const fcVal = Math.round(kVal * 0.083 * 10) / 10;
    return {
      commandId: "SET_CONCRETE_FC",
      confidence: 0.94,
      extractedParameters: { fcMpa: fcVal, historicalGrade: `K-${kVal}` },
      rawTranscript: raw,
      spokenConfirmation: `Kuat tekan beton diatur ke fc' ${fcVal} MPa (setara K-${kVal}).`,
      suggestions: [
        "Lihat wireframe tulangan balok",
        "Buka jendela dimensi",
        "Hitung kapasitas momen",
      ],
    };
  }

  const fcMatch = lower.match(
    /(?:mutu\s*beton|kuat\s*tekan|fc[']?|concrete\s*grade)\s*(?:menjadi|ke|sebesar)?\s*([0-9]+(?:[.,][0-9]+)?)\s*(?:mpa)?/,
  );
  if (fcMatch && fcMatch[1]) {
    const fcVal = parseInt(fcMatch[1], 10);
    return {
      commandId: "SET_CONCRETE_FC",
      confidence: 0.95,
      extractedParameters: { fcMpa: fcVal },
      rawTranscript: raw,
      spokenConfirmation: `Kuat tekan beton fc' berhasil diatur ke ${fcVal} MPa.`,
      suggestions: [
        "Lihat wireframe tulangan balok",
        "Buka jendela dimensi",
        "Hitung kapasitas momen",
      ],
    };
  }

  const dimMatch = lower.match(
    /(?:dimensi|ukuran balok|penampang beton)\s*([0-9]+)\s*(?:x|\*|kali)\s*([0-9]+)/,
  );
  if (dimMatch && dimMatch[1] && dimMatch[2]) {
    const bw = parseInt(dimMatch[1], 10);
    const h = parseInt(dimMatch[2], 10);
    return {
      commandId: "SET_CONCRETE_DIMENSIONS",
      confidence: 0.96,
      extractedParameters: { bwMm: bw, hMm: h },
      rawTranscript: raw,
      spokenConfirmation: `Dimensi penampang balok beton diatur ke ${bw} x ${h} mm.`,
      suggestions: ["Lihat wireframe tulangan", "Ubah mutu beton fc 30 MPa", "Fit tampilan balok"],
    };
  }

  // 11. Material Switching (Concrete vs Steel)
  if (lower.includes("beton") || lower.includes("concrete")) {
    return {
      commandId: "SWITCH_MATERIAL_CONCRETE",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Material struktur dialihkan ke Beton Bertulang (SNI 2847:2019).",
      suggestions: generateContextualSuggestions("SWITCH_MATERIAL_CONCRETE"),
    };
  }
  if (lower.includes("baja") || lower.includes("steel")) {
    return {
      commandId: "SWITCH_MATERIAL_STEEL",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Material struktur dialihkan ke Baja Struktural (SNI 1729:2020).",
      suggestions: generateContextualSuggestions("SWITCH_MATERIAL_STEEL"),
    };
  }

  // 12. Optimization & Automation
  if (
    lower.includes("optimasi") ||
    lower.includes("optimize") ||
    lower.includes("optimalkan") ||
    lower.includes("cari profil terhemat") ||
    lower.includes("hitung profil")
  ) {
    return {
      commandId: "RUN_OPTIMIZATION",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Algoritma optimasi profil balok otomatis sedang dijalankan.",
      suggestions: ["Buka jendela optimasi", "Ekspor ke AutoCAD DXF", "Buka modal ekspor CAD"],
    };
  }
  if (
    lower.includes("reset simulasi") ||
    lower.includes("reset kalkulasi") ||
    lower.includes("mulai dari awal")
  ) {
    return {
      commandId: "RESET_SIMULATION",
      confidence: 0.96,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Parameter simulator balok telah dikembalikan ke kondisi awal standar.",
      suggestions: [
        "Buka jendela material",
        "Set bentang balok 6 meter",
        "Tampilkan diagram momen BMD",
      ],
    };
  }

  // 13. Multi-CAD/BIM Exporters
  if (lower.includes("autocad") || lower.includes("dxf") || lower.includes("dwg")) {
    return {
      commandId: "EXPORT_DXF",
      confidence: 0.96,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "File gambar teknik AutoCAD DXF berhasil diunduh.",
      suggestions: generateContextualSuggestions("EXPORT_DXF"),
    };
  }
  if (lower.includes("sap2000") || lower.includes("s2k")) {
    return {
      commandId: "EXPORT_SAP2000",
      confidence: 0.96,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Model analisis SAP2000 .s2k berhasil diekspor.",
      suggestions: generateContextualSuggestions("EXPORT_SAP2000"),
    };
  }
  if (lower.includes("ifc") || lower.includes("revit") || lower.includes("bim")) {
    return {
      commandId: "EXPORT_IFC",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Model BIM 3D Industry Foundation Classes IFC4 berhasil diekspor.",
      suggestions: generateContextualSuggestions("EXPORT_IFC"),
    };
  }
  if (
    lower.includes("idea statica") ||
    lower.includes("sambungan baja") ||
    lower.includes("ideastatica")
  ) {
    return {
      commandId: "EXPORT_IDEA_STATICA",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Model sambungan baja IDEA StatiCa OpenModel XML berhasil diekspor.",
      suggestions: ["Ekspor ke AutoCAD DXF", "Kembali ke 3D isometrik", "Buka jendela optimasi"],
    };
  }
  if (lower.includes("solidworks") || lower.includes("step") || lower.includes("stp")) {
    return {
      commandId: "EXPORT_SOLIDWORKS_STEP",
      confidence: 0.95,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Model CAD 3D STEP AP214 SolidWorks berhasil diekspor.",
      suggestions: ["Ekspor ke AutoCAD DXF", "Fit tampilan balok", "Kembali ke 3D isometrik"],
    };
  }

  // 14. Camera Gestures & Assistant
  if (
    lower.includes("kamera") ||
    lower.includes("camera") ||
    lower.includes("gestur") ||
    lower.includes("gesture") ||
    lower.includes("webcam") ||
    lower.includes("hand tracking")
  ) {
    const isStop =
      lower.includes("matikan") ||
      lower.includes("stop") ||
      lower.includes("tutup") ||
      lower.includes("nonaktif");
    const isStart =
      lower.includes("nyalakan") ||
      lower.includes("start") ||
      lower.includes("buka") ||
      lower.includes("aktif");
    const cameraAction = isStop ? "STOP" : isStart ? "START" : "TOGGLE";

    return {
      commandId: "TOGGLE_CAMERA_PREVIEW",
      confidence: 0.95,
      extractedParameters: { action: cameraAction },
      rawTranscript: raw,
      spokenConfirmation: `Kamera webcam deteksi gestur tangan ${isStop ? "dimatikan" : "diaktifkan"}.`,
      suggestions: generateContextualSuggestions("TOGGLE_CAMERA_PREVIEW"),
    };
  }

  if (lower.includes("mode hemat") || lower.includes("eco mode") || lower.includes("hemat daya")) {
    return {
      commandId: "TOGGLE_ECO_MODE",
      confidence: 0.94,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Mode hemat daya inferensi webcam berhasil ditoggle.",
      suggestions: ["Matikan kamera", "Fit tampilan balok", "Buka jendela beban"],
    };
  }

  if (
    lower.includes("dialog ekspor") ||
    lower.includes("modal ekspor") ||
    lower.includes("dialog export") ||
    lower.includes("menu ekspor") ||
    lower.includes("menu download")
  ) {
    return {
      commandId: "TOGGLE_EXPORT_MODAL",
      confidence: 0.94,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Jendela ekspor format multi-CAD dibuka.",
      suggestions: ["Ekspor ke AutoCAD DXF", "Ekspor SAP2000", "Ekspor BIM IFC"],
    };
  }
  if (lower.includes("asisten ai") || lower.includes("tanya ai") || lower.includes("konsultan")) {
    return {
      commandId: "TOGGLE_AI_ASSISTANT",
      confidence: 0.94,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Panel Asisten Rekayasa AI dibuka.",
      suggestions: ["Nyalakan kamera", "Tanya saran optimasi balok", "Hitung optimasi penampang"],
    };
  }

  // 15. Mic Mute Controls
  if (
    lower.includes("jeda suara") ||
    lower.includes("mute mikrofon") ||
    lower.includes("matikan voice") ||
    lower.includes("matikan suara") ||
    lower.includes("matikan mic") ||
    lower.includes("matikan mikrofon") ||
    lower.includes("matikan audio") ||
    lower.includes("matikan perintah suara") ||
    lower.includes("nonaktifkan suara") ||
    lower.includes("nonaktifkan voice") ||
    lower.includes("nonaktifkan mikrofon") ||
    lower.includes("stop voice") ||
    lower.includes("stop listening") ||
    lower.includes("berhenti mendengarkan") ||
    lower.includes("tutup suara") ||
    lower.includes("tutup mikrofon") ||
    lower === "mute" ||
    lower === "mute voice" ||
    lower === "silent" ||
    lower === "diam"
  ) {
    return {
      commandId: "MUTE_VOICE_COMMAND",
      confidence: 0.96,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation:
        "Mikrofon dijeda. Katakan 'halo cuy', 'oi cuy', 'hey cuy', 'woi cuy' atau tepuk 2x untuk mengaktifkan kembali.",
      suggestions: ["Buka jendela beban", "Tampilkan diagram momen BMD", "Hitung optimasi"],
    };
  }
  if (
    lower.includes("dengarkan suara") ||
    lower.includes("unmute mikrofon") ||
    lower.includes("nyalakan voice") ||
    lower.includes("nyalakan suara") ||
    lower.includes("nyalakan mic") ||
    lower.includes("nyalakan mikrofon") ||
    lower.includes("nyalakan audio") ||
    lower.includes("aktifkan suara") ||
    lower.includes("aktifkan voice") ||
    lower.includes("aktifkan mikrofon") ||
    lower.includes("aktifkan perintah suara") ||
    lower.includes("hidupkan voice") ||
    lower.includes("hidupkan suara") ||
    lower.includes("hidupkan mic") ||
    lower.includes("hidupkan mikrofon") ||
    lower.includes("mulai mendengarkan") ||
    lower === "unmute" ||
    lower === "unmute voice" ||
    lower === "listen" ||
    lower === "start voice"
  ) {
    return {
      commandId: "UNMUTE_VOICE_COMMAND",
      confidence: 0.96,
      extractedParameters: {},
      rawTranscript: raw,
      spokenConfirmation: "Mikrofon aktif mendengarkan perintah.",
      suggestions: ["Buka jendela material", "Fit tampilan balok", "Tampilkan diagram momen BMD"],
    };
  }

  return null;
}

// ============================================================================
// Multi-Command Compound Splitter & Extractors
// ============================================================================

/**
 * Recognizes and extracts multiple window target opening/closing actions in a single clause.
 * e.g. "munculkan jendela untuk mengatur dimensi dan gaya dalam"
 * -> [OPEN_WINDOW SNI_DESIGN_PARAMETERS, OPEN_WINDOW INTERNAL_FORCE_DIAGRAMS]
 */
export function extractMultiWindowActions(
  clause: string,
  inheritedAction?: "OPEN_WINDOW" | "CLOSE_WINDOW",
): IntentActionItem[] {
  const lower = clause.toLowerCase();

  const hasWindowKeyword =
    lower.includes("jendela") || lower.includes("window") || lower.includes("panel");

  if (!hasWindowKeyword && !inheritedAction) return [];

  const isExplicitClosing =
    lower.includes("tutup") || lower.includes("close") || lower.includes("sembunyikan");
  const isExplicitOpening =
    lower.includes("buka") ||
    lower.includes("open") ||
    lower.includes("munculkan") ||
    lower.includes("tampilkan");

  const isClosing = isExplicitClosing || (!isExplicitOpening && inheritedAction === "CLOSE_WINDOW");
  const commandId: CommandId = isClosing ? "CLOSE_WINDOW" : "OPEN_WINDOW";

  const targets: { target: FloatingWindowId; label: string }[] = [];

  if (lower.includes("material") || lower.includes("mode pembebanan")) {
    targets.push({ target: "MATERIAL_LOAD_MODE", label: "Jendela Material & Mode" });
  }
  if (lower.includes("beban") || lower.includes("tumpuan")) {
    targets.push({ target: "REALTIME_LOAD_INPUT", label: "Jendela Beban & Tumpuan" });
  }
  if (
    lower.includes("dimensi") ||
    lower.includes("parameter") ||
    lower.includes("ukuran") ||
    lower.includes("tulangan") ||
    lower.includes("mengatur dimensi") ||
    lower.includes("atur dimensi")
  ) {
    targets.push({ target: "SNI_DESIGN_PARAMETERS", label: "Jendela Dimensi & Parameter SNI" });
  }
  if (
    lower.includes("optimasi") ||
    lower.includes("hasil optimasi") ||
    lower.includes("rekomendasi")
  ) {
    targets.push({ target: "OPTIMIZATION_RESULTS", label: "Jendela Hasil Optimasi" });
  }
  if (
    lower.includes("gaya dalam") ||
    lower.includes("diagram") ||
    lower.includes("momen") ||
    lower.includes("geser")
  ) {
    targets.push({ target: "INTERNAL_FORCE_DIAGRAMS", label: "Jendela Diagram Gaya Dalam" });
  }
  if (lower.includes("asisten") || lower.includes("ai") || lower.includes("gestur")) {
    targets.push({ target: "GESTURE_AI_ASSISTANT", label: "Jendela AI & Gestur Tangan" });
  }

  return targets.map((t) => ({
    commandId,
    extractedParameters: { target: t.target },
    label: `${isClosing ? "Tutup" : "Buka"} ${t.label}`,
  }));
}

/**
 * Splits a compound sentence into separate actionable clauses, preserving protected compound terms.
 */
export function splitCompoundClauses(transcript: string): string[] {
  let text = transcript.trim();
  if (!text) return [];

  // Protect decimal numbers with commas (e.g. 6,5 -> 6.5) so commas are not treated as clause separators
  text = text.replace(/(\d+),(\d+)/g, "$1.$2");

  // Protect multi-word names containing 'dan' or '-' from accidental splits
  text = text.replace(/sendi\s*[-–—]\s*rol/gi, "__SENDI_ROL__");
  text = text.replace(/sendi\s+dan\s+rol/gi, "__SENDI_ROL__");
  text = text.replace(/solid\s*\+\s*potongan/gi, "__SOLID_POTONGAN__");
  text = text.replace(/solid\s+dan\s+potongan/gi, "__SOLID_POTONGAN__");
  text = text.replace(/material\s+dan\s+mode/gi, "__MATERIAL_MODE__");
  text = text.replace(/beban\s+dan\s+tumpuan/gi, "__BEBAN_TUMPUAN__");
  text = text.replace(/ai\s+dan\s+gestur/gi, "__AI_GESTUR__");
  text = text.replace(/gestur\s+dan\s+ai/gi, "__AI_GESTUR__");

  // Protect window conjunction sequences like "dimensi dan gaya dalam"
  text = text.replace(
    /(jendela\s+(?:untuk\s+)?(?:mengatur\s+)?[a-z\s]+)\s+dan\s+(gaya dalam|dimensi|beban|optimasi|diagram|material)/gi,
    "$1 __WINDOW_AND__ $2",
  );

  // Split on clause conjunctions
  const rawParts = text.split(
    /(?:\s*;\s*|\s*,\s*(?:dan\s+|lalu\s+|terus\s+|kemudian\s+|serta\s+)?|\s+dan\s+|\s+lalu\s+|\s+terus\s+|\s+kemudian\s+|\s+serta\s+|\s+habis itu\s+|\s+setelah itu\s+|\s+sekaligus\s+|\s+and\s+|\s+then\s+)/i,
  );

  return rawParts
    .map((part) =>
      part
        .replace(/__SENDI_ROL__/g, "sendi-rol")
        .replace(/__SOLID_POTONGAN__/g, "solid + potongan")
        .replace(/__MATERIAL_MODE__/g, "material dan mode")
        .replace(/__BEBAN_TUMPUAN__/g, "beban dan tumpuan")
        .replace(/__AI_GESTUR__/g, "gestur dan asisten ai")
        .replace(/__WINDOW_AND__/g, "dan")
        .trim(),
    )
    .filter((part) => part.length > 0);
}

// ============================================================================
// Multi-Command Orchestrator (matchRuleBasedIntent)
// ============================================================================

/**
 * Matches natural language transcripts against all known structural commands.
 * Fully supports multi-command execution when the user asks for multiple actions in one sentence.
 *
 * @example
 * ```ts
 * const res = matchRuleBasedIntent("ganti ke beton dan munculkan jendela untuk mengatur dimensi dan gaya dalam");
 * // res.actions contains:
 * // 1. SWITCH_MATERIAL_CONCRETE
 * // 2. OPEN_WINDOW (SNI_DESIGN_PARAMETERS)
 * // 3. OPEN_WINDOW (INTERNAL_FORCE_DIAGRAMS)
 * ```
 */
export function matchRuleBasedIntent(transcript: string): IntentRouterResult | null {
  const raw = transcript.trim();
  if (!raw) return null;

  // Intercept wake word prefix with compound commands, e.g. "halo cuy ubah ke beton dan buka jendela beban"
  const wake = matchWakeWord(raw);
  if (wake.matched && wake.remainingText) {
    const compoundSub = matchRuleBasedIntent(wake.remainingText);
    if (compoundSub) {
      return {
        ...compoundSub,
        rawTranscript: raw,
        spokenConfirmation: compoundSub.spokenConfirmation
          ? `Halo cuy! ${compoundSub.spokenConfirmation}`
          : "Halo cuy! Perintah dijalankan.",
      };
    }
  }

  // 1. Try single-intent match first for completely simple utterances
  const single = matchSingleRuleIntent(raw);

  // Check if utterance contains compound connectors or multiple window targets
  const clauses = splitCompoundClauses(raw);

  // If only 1 clause and single matched, and doesn't contain multiple window targets
  if (clauses.length <= 1) {
    const multiWindows = extractMultiWindowActions(raw);
    const primary = multiWindows[0];
    if (multiWindows.length > 1 && primary) {
      const windowLabels = multiWindows.map((w) => w.label || "Jendela").join(" serta ");
      return {
        commandId: primary.commandId,
        confidence: 0.95,
        extractedParameters: primary.extractedParameters || {},
        rawTranscript: raw,
        actions: multiWindows,
        spokenConfirmation: `${windowLabels} telah dibuka.`,
        suggestions: generateContextualSuggestions(primary.commandId),
      };
    }
    return single;
  }

  // 2. Multi-clause compound processing
  const collectedActions: IntentActionItem[] = [];
  const actionLabels: string[] = [];
  let lastWindowAction: "OPEN_WINDOW" | "CLOSE_WINDOW" | undefined = undefined;

  for (const clause of clauses) {
    // Check if this clause contains multiple window targets
    const multiWindows = extractMultiWindowActions(clause, lastWindowAction);
    if (multiWindows.length > 1) {
      for (const winAct of multiWindows) {
        collectedActions.push(winAct);
        if (winAct.label) actionLabels.push(winAct.label);
        lastWindowAction = winAct.commandId as "OPEN_WINDOW" | "CLOSE_WINDOW";
      }
      continue;
    }

    // Check single window match with inherited action
    if (multiWindows.length === 1 && multiWindows[0]) {
      const winAct = multiWindows[0];
      collectedActions.push(winAct);
      if (winAct.label) actionLabels.push(winAct.label);
      lastWindowAction = winAct.commandId as "OPEN_WINDOW" | "CLOSE_WINDOW";
      continue;
    }

    // Otherwise, match single command in clause
    const clauseMatch = matchSingleRuleIntent(clause);
    if (clauseMatch) {
      const label =
        clauseMatch.spokenConfirmation?.replace(/\.$/, "") || `Perintah ${clauseMatch.commandId}`;
      collectedActions.push({
        commandId: clauseMatch.commandId,
        extractedParameters: clauseMatch.extractedParameters,
        label,
      });
      actionLabels.push(label);
      if (clauseMatch.commandId === "OPEN_WINDOW" || clauseMatch.commandId === "CLOSE_WINDOW") {
        lastWindowAction = clauseMatch.commandId;
      }
    }
  }

  // If no actions matched across clauses, fall back to single or null
  if (collectedActions.length === 0) {
    return single;
  }

  // If only 1 action resolved, return single result
  const act = collectedActions[0];
  if (collectedActions.length === 1 && act) {
    return {
      commandId: act.commandId,
      confidence: 0.95,
      extractedParameters: act.extractedParameters || {},
      rawTranscript: raw,
      actions: collectedActions,
      spokenConfirmation: act.label ? `${act.label}.` : undefined,
      suggestions: generateContextualSuggestions(act.commandId, act.extractedParameters),
    };
  }

  // Multi-actions compound result!
  const primaryAction = collectedActions[0];
  const lastAction = collectedActions[collectedActions.length - 1];
  if (!primaryAction || !lastAction) {
    return single;
  }

  const compoundSpokenConfirmation = `Berhasil menjalankan ${collectedActions.length} perintah: ${actionLabels.join(", serta ")}.`;

  return {
    commandId: primaryAction.commandId,
    confidence: 0.95,
    extractedParameters: primaryAction.extractedParameters || {},
    rawTranscript: raw,
    actions: collectedActions,
    spokenConfirmation: compoundSpokenConfirmation,
    suggestions: generateContextualSuggestions(
      lastAction.commandId,
      lastAction.extractedParameters,
    ),
  };
}

export default matchRuleBasedIntent;
