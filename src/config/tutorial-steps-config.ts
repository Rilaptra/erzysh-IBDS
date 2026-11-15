/**
 * @file tutorial-steps-config.ts
 * @description Konfigurasi 9 misi interaktif ("IBDS Engineer Quest") dipandu maskot AI Ucuy,
 * mencakup kendali UI, suara langsung (Live Voice Input), gestur kamera, serta ekspor dan
 * panduan penggunaan file AutoCAD DXF.
 */

import type { FloatingWindowId } from "@/state/floating-window-store";
import type { CommandId } from "@/types/command-registry-types";

export type TutorialMobileTab = "RESULTS" | "INPUT" | "PARAMETERS";

export type TutorialQuestKind = "STANDARD" | "EXPORT_DXF" | "AUTOCAD_GUIDE";

export interface TutorialQuestStep {
  /** ID unik langkah tutorial. */
  readonly id: string;
  /** Nomor urut langkah (1-9). */
  readonly stepNumber: number;
  /** Judul misi ringkas. */
  readonly title: string;
  /** Label fase atau kategori misi. */
  readonly badgeLabel: string;
  /** Dialog pemandu bergaya asisten rekayasa "Ucuy". */
  readonly ucuyDialogue: string;
  /** Ringkasan target aksi agar misi selesai. */
  readonly missionTitle: string;
  /** Penjelasan teknis dan cara menyelesaikan misi (mouse atau suara). */
  readonly missionDescription: string;
  /** Contoh kalimat perintah suara yang dikenali command-matcher. */
  readonly voiceCommandExample: string;
  /** Teks narasi suara opsional yang dibacakan oleh Ucuy (TTS). */
  readonly voiceNarration: string;
  /** Daftar CommandId yang otomatis menuntaskan misi saat dieksekusi via suara/UI. */
  readonly acceptedCommandIds: readonly CommandId[];
  /** Jendela mengambang desktop yang otomatis dibuka saat masuk ke misi ini. */
  readonly targetWindowId?: FloatingWindowId;
  /** Selektor DOM untuk sorotan spotlight target pada workstation desktop. */
  readonly targetSelector?: string;
  /** Tab pendamping mobile yang aktif otomatis saat masuk ke misi ini. */
  readonly mobileTab?: TutorialMobileTab;
  /** Jenis kartu khusus (standar, aksi ekspor DXF langsung, atau panduan AutoCAD DXF). */
  readonly questKind?: TutorialQuestKind;
}

export const TUTORIAL_QUEST_STEPS: readonly TutorialQuestStep[] = [
  {
    id: "quest-1-material",
    stepNumber: 1,
    title: "Pilih Material & Mode Beban",
    badgeLabel: "Misi 1 • Dasar Struktur",
    ucuyDialogue:
      "Halo Engineer! Saya Ucuy, asisten strukturmu. Langkah pertama, pilih material balok (Baja atau Beton Bertulang) lalu tentukan mode input beban.",
    missionTitle: "Ubah material balok atau mode input beban",
    missionDescription:
      "Klik pilihan material (Baja / Beton) atau mode beban pada panel Kontrol Material & Mode, atau gunakan perintah suara langsung.",
    voiceCommandExample: "Beralih ke material baja",
    voiceNarration:
      "Misi satu, pilih material dan mode beban. Klik material baja atau beton bertulang, atau ucapkan beralih ke material baja.",
    acceptedCommandIds: [
      "SWITCH_MATERIAL_STEEL",
      "SWITCH_MATERIAL_CONCRETE",
      "SWITCH_MODE_EXTERNAL_LOADS",
      "SWITCH_MODE_DIRECT_FORCES",
    ],
    targetWindowId: "MATERIAL_LOAD_MODE",
    targetSelector: "[data-window-id='MATERIAL_LOAD_MODE']",
    mobileTab: "INPUT",
    questKind: "STANDARD",
  },
  {
    id: "quest-2-loads",
    stepNumber: 2,
    title: "Atur Bentang, Tumpuan & Beban",
    badgeLabel: "Misi 2 • Kondisi Batas",
    ucuyDialogue:
      "Mantap! Sekarang tentukan panjang bentang (L), jenis tumpuan (misal Sendi-Rol atau Kantilever), lalu tambahkan beban titik atau beban merata.",
    missionTitle: "Ubah bentang, tumpuan, atau tambah/ubah beban",
    missionDescription:
      "Geser slider panjang bentang, pilih jenis tumpuan, atau tambah beban pada panel Input Beban Eksternal (atau ucapkan perintah suara).",
    voiceCommandExample: "Tambah beban titik 50 kN",
    voiceNarration:
      "Misi dua, atur bentang, tumpuan, dan beban. Tambahkan beban titik atau ubah panjang bentang pada panel beban.",
    acceptedCommandIds: [
      "ADD_POINT_LOAD",
      "REMOVE_POINT_LOAD",
      "ADD_DISTRIBUTED_LOAD",
      "REMOVE_DISTRIBUTED_LOAD",
      "CLEAR_ALL_LOADS",
      "SET_SPAN_LENGTH",
      "SET_SUPPORT_CANTILEVER",
      "SET_SUPPORT_PINNED_ROLLER",
      "SET_SUPPORT_FIXED_FIXED",
      "SET_SUPPORT_FIXED_ROLLER",
      "SET_SUPPORT_FIXED_PINNED",
      "TOGGLE_SELF_WEIGHT",
      "SET_DIRECT_FORCES",
    ],
    targetWindowId: "REALTIME_LOAD_INPUT",
    targetSelector: "[data-window-id='REALTIME_LOAD_INPUT']",
    mobileTab: "INPUT",
    questKind: "STANDARD",
  },
  {
    id: "quest-3-sni",
    stepNumber: 3,
    title: "Sesuaikan Parameter Desain SNI",
    badgeLabel: "Misi 3 • Standar SNI",
    ucuyDialogue:
      "Setiap struktur wajib patuh standar SNI! Atur mutu beton (f'c) dan tulangan atau mutu baja (BJ) serta batas izin lendutan.",
    missionTitle: "Ubah salah satu parameter desain SNI",
    missionDescription:
      "Sesuaikan mutu material, dimensi penampang, panjang tak terkekang (Lb), atau batas lendutan L/n di panel Parameter SNI.",
    voiceCommandExample: "Atur mutu beton fc 35 MPa",
    voiceNarration:
      "Misi tiga, sesuaikan parameter desain SNI seperti mutu beton, mutu baja, atau batas lendutan.",
    acceptedCommandIds: [
      "SET_CONCRETE_FC",
      "SET_CONCRETE_DIMENSIONS",
      "SET_REBAR_GRADES",
      "SET_STEEL_GRADE",
      "SET_STEEL_UNBRACED_LENGTH",
      "SET_DEFLECTION_LIMIT",
    ],
    targetWindowId: "SNI_DESIGN_PARAMETERS",
    targetSelector: "[data-window-id='SNI_DESIGN_PARAMETERS']",
    mobileTab: "PARAMETERS",
    questKind: "STANDARD",
  },
  {
    id: "quest-4-viewport",
    stepNumber: 4,
    title: "Eksplorasi Viewport 3D & Lendutan",
    badgeLabel: "Misi 4 • Visualisasi 3D",
    ucuyDialogue:
      "Lihat balok 3D-mu melendut secara real-time! Putar kamera, zoom, atau ubah sudut pandang ke Tampak Depan 2D maupun Isometrik 3D.",
    missionTitle: "Ubah preset kamera 3D/2D atau mode wireframe/solid",
    missionDescription:
      "Klik tombol 3D Isometrik, Depan 2D, Fit Kamera, atau Wireframe/Solid pada bilah kontrol kamera di atas kanvas.",
    voiceCommandExample: "Tampilkan tampak depan 2D",
    voiceNarration:
      "Misi empat, eksplorasi viewport 3D. Coba ganti kamera ke tampak depan 2D atau kembali ke 3D isometrik.",
    acceptedCommandIds: [
      "SET_VIEW_ISOMETRIC",
      "SET_VIEW_FRONT",
      "FIT_CAMERA_VIEW",
      "SET_CONCRETE_VIEW_SOLID",
      "SET_CONCRETE_VIEW_WIREFRAME",
      "SET_COORDINATE_Z_UP",
      "SET_COORDINATE_Y_UP",
    ],
    targetSelector: "[data-tutorial-id='camera-toolbar']",
    mobileTab: "RESULTS",
    questKind: "STANDARD",
  },
  {
    id: "quest-5-diagrams",
    stepNumber: 5,
    title: "Baca Diagram Gaya Dalam (SFD/BMD)",
    badgeLabel: "Misi 5 • Mekanika Bahan",
    ucuyDialogue:
      "Di balik visual 3D, mari periksa gaya dalam balok: Geser (SFD), Momen Lentur (BMD), Normal (NFD), dan Torsi (TFD).",
    missionTitle: "Aktifkan atau ubah tampilan diagram gaya dalam",
    missionDescription:
      "Nyalakan/matikan kurva BMD, SFD, NFD, TFD atau ubah tata letak (In-Place / Stacked / Window) di panel Diagram Gaya Dalam.",
    voiceCommandExample: "Tampilkan bidang momen BMD",
    voiceNarration:
      "Misi lima, baca diagram gaya dalam. Aktifkan diagram momen BMD atau gaya geser SFD.",
    acceptedCommandIds: [
      "TOGGLE_DIAGRAM_BMD",
      "TOGGLE_DIAGRAM_SFD",
      "TOGGLE_DIAGRAM_NFD",
      "TOGGLE_DIAGRAM_TFD",
      "SET_DIAGRAM_MODE_IN_PLACE",
      "SET_DIAGRAM_MODE_STACKED",
      "SET_DIAGRAM_MODE_WINDOW",
    ],
    targetWindowId: "INTERNAL_FORCE_DIAGRAMS",
    targetSelector: "[data-window-id='INTERNAL_FORCE_DIAGRAMS']",
    mobileTab: "RESULTS",
    questKind: "STANDARD",
  },
  {
    id: "quest-6-optimization",
    stepNumber: 6,
    title: "Cek Hasil & Optimasi Penampang",
    badgeLabel: "Misi 6 • Optimasi SNI",
    ucuyDialogue:
      "Saatnya evaluasi kapasitas! Buka peringkat profil IWF/BOX paling efisien atau periksa kebutuhan tulangan beton bertulang pada panel Hasil.",
    missionTitle: "Jalankan optimasi atau pilih/filter profil hasil",
    missionDescription:
      "Klik filter IWF/BOX, pilih salah satu peringkat profil baja terhemat, atau ucapkan perintah optimasi penampang.",
    voiceCommandExample: "Optimalkan penampang profil",
    voiceNarration:
      "Misi enam, cek hasil dan optimasi penampang. Pilih profil terhemat atau ucapkan optimalkan penampang profil.",
    acceptedCommandIds: [
      "RUN_OPTIMIZATION",
      "FILTER_STEEL_IWF",
      "FILTER_STEEL_BOX",
      "FILTER_STEEL_ALL",
      "SELECT_STEEL_PROFILE",
    ],
    targetWindowId: "OPTIMIZATION_RESULTS",
    targetSelector: "[data-window-id='OPTIMIZATION_RESULTS']",
    mobileTab: "RESULTS",
    questKind: "STANDARD",
  },
  {
    id: "quest-7-ai-voice-gesture",
    stepNumber: 7,
    title: "Coba Asisten AI Ucuy, Suara & Gestur",
    badgeLabel: "Misi 7 • Kendali Multimodal",
    ucuyDialogue:
      "Kamu bisa mengendalikan seluruh simulator tanpa menyentuh mouse! Coba tanyakan analisis ke Asisten AI Ucuy, aktifkan suara, atau kamera gestur tangan.",
    missionTitle: "Gunakan Asisten AI Ucuy, Perintah Suara, atau Kamera Gestur",
    missionDescription:
      "Kirim pertanyaan ke chat Asisten AI pada panel ini, aktifkan kamera hand-tracking, atau ucapkan perintah AI lewat mikrofon.",
    voiceCommandExample: "Tanya asisten AI",
    voiceNarration:
      "Misi tujuh, coba asisten AI Ucuy, suara, dan kamera gestur tangan. Kirim pertanyaan atau aktifkan asisten AI.",
    acceptedCommandIds: ["TOGGLE_AI_ASSISTANT", "TOGGLE_CAMERA_PREVIEW", "TOGGLE_ECO_MODE"],
    targetWindowId: "GESTURE_AI_ASSISTANT",
    targetSelector: "[data-window-id='GESTURE_AI_ASSISTANT']",
    mobileTab: "RESULTS",
    questKind: "STANDARD",
  },
  {
    id: "quest-8-export-dxf",
    stepNumber: 8,
    title: "Ekspor ke AutoCAD (.DXF)",
    badgeLabel: "Misi 8 • Ekspor AutoCAD",
    ucuyDialogue:
      "Desain beres! Buka jendela Ekspor lewat tombol di Panel 4, pastikan format .dxf dipilih, lalu klik 'Unduh File Pilihan' (atau pakai tombol cepat di sini).",
    missionTitle: "Buka jendela ekspor di Panel 4, pilih .dxf, lalu unduh",
    missionDescription:
      "Klik tombol Ekspor pada Panel 4 (Hasil Optimasi) yang disorot, pilih kartu .dxf bila belum aktif, lalu klik 'Unduh File Pilihan'. Anda juga bisa klik tombol 'Ekspor Langsung AutoCAD (.dxf)' di bawah atau ucapkan perintah suara.",
    voiceCommandExample: "Ekspor ke AutoCAD DXF",
    voiceNarration:
      "Misi delapan, ekspor ke AutoCAD DXF. Tekan tombol ekspor pada panel empat, pilih format dxf, lalu unduh file pilihan.",
    acceptedCommandIds: ["EXPORT_DXF"],
    targetWindowId: "OPTIMIZATION_RESULTS",
    targetSelector: "[data-tutorial-export-trigger='true']",
    mobileTab: "RESULTS",
    questKind: "EXPORT_DXF",
  },
  {
    id: "quest-9-autocad-guide",
    stepNumber: 9,
    title: "Cara Buka & Pakai File DXF di AutoCAD",
    badgeLabel: "Misi 9 • Workflow AutoCAD",
    ucuyDialogue:
      "Selamat! File .dxf sudah siap di komputermu. Ikuti 3 langkah praktis berikut agar gambar potongan & dimensi tampil sempurna di AutoCAD.",
    missionTitle: "Pelajari 3 langkah membuka file .dxf di AutoCAD",
    missionDescription:
      "Gunakan OPEN di AutoCAD, ketik ZOOM lalu EXTENTS agar objek langsung terlihat, dan manfaatkan 4 layer standar teknik yang sudah dipisah otomatis.",
    voiceCommandExample: "Selesai tutorial",
    voiceNarration:
      "Misi terakhir! Buka file DXF di AutoCAD dengan perintah OPEN, lalu ketik ZOOM dan EXTENTS agar gambar penampang langsung terlihat dalam satuan milimeter.",
    acceptedCommandIds: [],
    mobileTab: "RESULTS",
    questKind: "AUTOCAD_GUIDE",
  },
];

export const TOTAL_TUTORIAL_STEPS = TUTORIAL_QUEST_STEPS.length;
