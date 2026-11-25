import type { DevelopmentPhaseItem } from "@/types/presentation-types";

export const DEVELOPMENT_TELEMETRY = {
  commitsCount: 57,
  tagsCount: 24,
  mergedPrsCount: 8,
  testFilesCount: 23,
  testCasesCount: 364,
  rustCargoTestsCount: 5,
} as const;

export const DEVELOPMENT_PHASES: readonly DevelopmentPhaseItem[] = [
  {
    id: "phase-0",
    phaseCode: "FASE 0",
    title: "Konseptualisasi & Evolusi Spesifikasi (Spec-First)",
    period: "31 Okt – 2 Nov 2026",
    gitRef: "41dccfe..eb56a69",
    focus:
      "Iterasi dokumen spesifikasi arsitektur dari v2 hingga v4.1, lalu dipecah menjadi 9 dokumen modular aktif di mdfiles/ dengan keputusan arsitektur Hybrid Option B (Rust WASM + Next.js + Bun).",
    deliverables: [
      "Kontrak matematis 5 kategori tumpuan & lendutan negatif Euler-Bernoulli",
      "Spesifikasi desain SNI 1729:2020 (baja) & SNI 2847:2019 (beton)",
      "Peta pembangunan bertahap 7 langkah & bundler konteks AI",
    ],
    artifactPaths: [
      "mdfiles/bun_v1_4_4_architecture_and_context.md",
      "mdfiles/step_by_step_build_roadmap.md",
      "mdfiles/structural_mechanics_and_deflection_solver_spec.md",
    ],
    engineeringLesson:
      "Menetapkan konvensi tanda fisika, struktur data, dan anggaran memori sebelum menulis baris kode pertama mencegah refactor besar di tengah jalan.",
  },
  {
    id: "phase-1",
    phaseCode: "FASE 1",
    title: "R&D Prototipe Multimodal Independen",
    period: "Awal Nov 2026",
    gitRef: "prototype/*",
    focus:
      "Eksperimen terisolasi pelacakan tangan Knuckle-Anchored anti pinch-dip (Eco-Mode 15–16 FPS <45°C) serta prototipe perintah suara Gemini Live sebelum diintegrasikan ke codebase produksi.",
    deliverables: [
      "Engine kursor tangan 5-gestur dengan smoothing stabil",
      "Server prototipe perintah suara & router intent bahasa Indonesia/Inggris",
      "Benchmark latensi dan konsumsi CPU pada perangkat RAM terbatas",
    ],
    artifactPaths: ["prototype/hand-tracking/engine.ts", "prototype/voice-command/server.ts"],
    engineeringLesson:
      "Memisahkan R&D interaksi eksperimental di folder prototype/ menjaga branch utama tetap bersih dan bebas dependency sampah.",
  },
  {
    id: "phase-2a",
    phaseCode: "FASE 2A",
    title: "Fondasi, Katalog SNI & CI Quality Gate (Step 1–2)",
    period: "4 – 5 Nov 2026",
    gitRef: "web-v0.4.0 – web-v0.5.0",
    focus:
      "Scaffolding Bun 1.4.4, Branded Units anti salah satuan, katalog primer 90 IWF + 23 BOX + 5 BJ + tulangan, mesin geometri fillet akurat, Bun compile-time macro, dan gerbang CI otomatis.",
    deliverables: [
      "Nominal Branded Types (kN, kNm, MPa, mm, m, DCR)",
      "Pre-komputasi & pengurutan profil Zx saat build-time via Bun Macro (O(log N))",
      "Pipeline GitHub Actions CI Quality Gate & CLI rilis otomatis scripts/release.ts",
    ],
    artifactPaths: [
      "src/types/branded-units.ts",
      "src/macros/precompute-steel-catalog.macro.ts",
      ".github/workflows/ci-quality-gate.yml",
    ],
    engineeringLesson:
      "Hanya menyimpan 5 dimensi primer di JSON lalu menghitung 14 properti turunan lewat Bun Macro menjamin konsistensi matematis tanpa bloat bundle.",
  },
  {
    id: "phase-2b",
    phaseCode: "FASE 2B",
    title: "Rust WASM Mechanics Solver & Engine SNI (Step 3–4)",
    period: "5 – 6 Nov 2026",
    gitRef: "19a328d..e7cc265",
    focus:
      "Implementasi crate Rust mechanics-3d-wasm (5 submodul, pre-allocated SolverWorkspace zero-copy) beserta engine optimasi baja SNI 1729:2020 dan beton bertulang SNI 2847:2019.",
    deliverables: [
      "Biner Rust WASM 104.6 KB dengan 256 stasiun diskrit & mesh 3D CCW",
      "Solver 9 orientasi tumpuan (Macaulay + kompatibilitas Mohr)",
      "Optimizer baja (LTB Bab F, Biaxial H1, Torsi H3) & beton (Whitney + Sengkang)",
    ],
    artifactPaths: [
      "crates/mechanics-3d-wasm/src/lib.rs",
      "src/core/steel/steel-section-optimizer.ts",
      "src/core/concrete/concrete-section-optimizer.ts",
    ],
    engineeringLesson:
      "Memakai linear memory buffer pra-alokasi di Rust WASM menghapus lonjakan Garbage Collector sehingga drag slider tetap mulus di 60–120 FPS.",
  },
  {
    id: "phase-2c",
    phaseCode: "FASE 2C",
    title: "Hybrid 3D/2D Viewport, Exporters & PWA (Step 5–7)",
    period: "6 Nov 2026",
    gitRef: "web-v0.5.1 (4f3480b)",
    focus:
      "Pembangunan viewport WebGL2 murni tanpa Three.js, 6 Floating Windows, Android Companion PWA, 5 modul ekspor CAD/BIM/CAE (DXF AC1009, .s2k, .ifc, .iom.xml, .step/.stl), dan integrasi multimodal.",
    deliverables: [
      "Ekstrusi 3D IWF/BOX & Beton (Solid End-Cap + X-Ray Rebar Cage)",
      "9 format ekspor industri lintas AutoCAD, SAP2000, Revit, IDEA StatiCa, SolidWorks",
      "Adaptive PWA split Desktop Workstation vs Android Field Companion",
    ],
    artifactPaths: [
      "src/components/canvas/Beam3DExtrudedViewport.tsx",
      "src/core/exporters/dxf-autocad-exporter.ts",
      "src/config/platform-capabilities.ts",
    ],
    engineeringLesson:
      "WebGL2 murni dengan shader ringan memangkas ratusan KB bundle JS dibandingkan library 3D umum sekaligus menjaga kompatibilitas RAM rendah.",
  },
  {
    id: "phase-3",
    phaseCode: "FASE 3",
    title: "Polish UI/UX, AI 'Ucuy', Manual 24-Slide & Next.js 16.4.5",
    period: "8 – 19 Nov 2026",
    gitRef: "web-v0.6.0 – web-v0.6.21",
    focus:
      "Migrasi Tailwind CSS v4 + shadcn/ui, persona AI 'Ucuy' + multi-key Gemini failover + double-clap, Custom Parametric BOX (r=0), Landing GSAP, Manual PDF 24-slide, /changelog, Quest 9 Misi, proyeksi beban 3D, dan upgrade Next.js 16.4.5.",
    deliverables: [
      "Multi-key Gemini API rotation + fallback deterministik offline",
      "Onboarding gamifikasi 9 misi (IBDS Engineer Quest) + manual 24-slide PDF",
      "Proyeksi vektor beban 3D perspektif + smart label collision avoidance",
    ],
    artifactPaths: [
      "src/config/tutorial-steps-config.ts",
      "src/app/changelog/page.tsx",
      "src/app/page.tsx",
    ],
    engineeringLesson:
      "Setiap fitur tambahan divalidasi dengan unit test (364 kasus uji) dan gerbang CI sebelum rilis otomatis agar stabilitas aplikasi tidak pernah turun.",
  },
];
