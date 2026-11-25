import type { QualityAttributeItem } from "@/types/presentation-types";

export const QUALITY_ATTRIBUTES: readonly QualityAttributeItem[] = [
  {
    key: "sustainability",
    title: "Sustainability",
    tagline: "Hemat energi, bebas server komputasi berat, ramah perangkat RAM rendah",
    summary:
      "100% kalkulasi mekanika & render 3D berjalan lokal di perangkat pengguna melalui biner Rust WASM 104.6 KB dan WebGL2 murni tanpa biaya server komputasi.",
    maturityScore: 94,
    evidencePoints: [
      {
        label: "Zero-Server Structural Compute",
        detail:
          "Biner WASM 104.6 KB dengan SolverWorkspace pra-alokasi (65.536 float) tanpa GC churn.",
        fileRef: "crates/mechanics-3d-wasm/src/lib.rs",
      },
      {
        label: "Thermal & Battery Eco-Mode",
        detail:
          "Pelacakan tangan dibatasi 15–16 FPS (<45°C) dan Android Companion menonaktifkan 3D/kamera.",
        fileRef: "src/config/platform-capabilities.ts",
      },
      {
        label: "Zero Heavy SDK Bloat",
        detail:
          "Penandatanganan JWT GA4 memakai Web Crypto native crypto.subtle tanpa Google Cloud SDK.",
        fileRef: "src/app/api/analytics/visitors/route.ts",
      },
    ],
  },
  {
    key: "scalability",
    title: "Scalability",
    tagline: "Biaya CPU server O(1) dan pencarian katalog O(log N)",
    summary:
      "Lonjakan pengguna simultan tidak membebani CPU server karena solver dijalankan di klien, sementara katalog profil baja dicari dalam kompleksitas logaritmik.",
    maturityScore: 92,
    evidencePoints: [
      {
        label: "Compile-Time Macro Pre-Sorting",
        detail: "Properti 90 IWF & 23 BOX dihitung dan diurutkan berdasarkan Zx saat build-time.",
        fileRef: "src/macros/precompute-steel-catalog.macro.ts",
      },
      {
        label: "Combinatorial Guard",
        detail: "Generator Custom Parametric BOX dibatasi aman hingga maksimal 2.500 kombinasi.",
        fileRef: "src/core/steel/steel-section-optimizer.ts",
      },
      {
        label: "Multi-Key Failover & ISR Cache",
        detail:
          "Rotasi multi-key Gemini (cooldown 60–900s) serta cache HTTP/ISR pada endpoint API.",
        fileRef: "src/lib/gemini-api-failover.ts",
      },
    ],
  },
  {
    key: "modularity",
    title: "Modularity",
    tagline: "Arsitektur 7 lapis murni dengan isolasi domain tegas",
    summary:
      "Engine Rust WASM, evaluator SNI, exporter CAD/BIM, store state, dan komponen UI dipisahkan dalam batas modul independen yang dapat diuji terpisah.",
    maturityScore: 95,
    evidencePoints: [
      {
        label: "6 Submodul Rust Terpisah",
        detail:
          "supports, diagrams, deflection, extrude_3d, rebar_cage_3d, dan lib.rs terisolasi rapi.",
        fileRef: "crates/mechanics-3d-wasm/src/",
      },
      {
        label: "Pure Structural Engines",
        detail:
          "Modul beton (SNI 2847) dan baja (SNI 1729) berdiri sebagai pure functions tanpa side-effect UI.",
        fileRef: "src/core/steel/ & src/core/concrete/",
      },
      {
        label: "Pluggable CAD/BIM Exporters",
        detail:
          "5 modul generator format industri independen siap ditambah format baru tanpa ubah solver.",
        fileRef: "src/core/exporters/",
      },
    ],
  },
  {
    key: "flexibility",
    title: "Flexibility",
    tagline: "Adaptif lintas paradigma beban, sistem koordinat, perangkat, & kondisi offline",
    summary:
      "Mendukung Mode A & Mode B, Baja & Beton, 9 orientasi tumpuan, Z-Up/Y-Up/CustomXYZ, 3 mode diagram, 9 format ekspor, serta mode PWA Desktop/Android.",
    maturityScore: 96,
    evidencePoints: [
      {
        label: "Dual-Paradigm & Dynamic XYZ",
        detail:
          "Pindah mulus antara Z-Up (SAP2000/Revit) dan Y-Up (SolidWorks/WebGL) secara real-time.",
        fileRef: "src/core/mechanics/wasm-mechanics-bridge.ts",
      },
      {
        label: "Adaptive Platform Gating",
        detail:
          "Deteksi otomatis Desktop Workstation vs Android Field Companion pada viewport ≤ 768px.",
        fileRef: "src/config/platform-capabilities.ts",
      },
      {
        label: "Graceful Offline Resilience",
        detail:
          "Fallback deterministik lokal untuk AI konsultan, intent suara, analitik, dan GitHub embed.",
        fileRef: "src/lib/github/repo-snapshot.ts",
      },
    ],
  },
  {
    key: "simplicity",
    title: "Simplicity",
    tagline:
      "Sederhana bagi pengguna akhir sekaligus minimalis bagi developer — tanpa mengorbankan presisi SNI",
    summary:
      "Tanpa instalasi, kendali bahasa Indonesia alami bersama AI Ucuy, tur 9 misi terpandu, hanya 11 production dependencies (tanpa Three.js/Redux), dan 1 perintah kerja Bun.",
    maturityScore: 98,
    isHighlighted: true,
    evidencePoints: [
      {
        label: "Zero-Install & Guided UX",
        detail:
          "Langsung aktif di browser/PWA dengan 9 misi IBDS Engineer Quest, kontrol suara, & ekspor 1-klik.",
        fileRef: "src/config/tutorial-steps-config.ts",
      },
      {
        label: "Minimal 11 Runtime Dependencies",
        detail:
          "Tanpa Three.js, Redux, Zustand, atau database eksternal — ringan dibangun di laptop RAM 4–8 GB.",
        fileRef: "package.json",
      },
      {
        label: "Single-File UI Primitives & Unified CLI",
        detail:
          "22 primitif UI terpadu di core.tsx serta alur kerja satu baris bun run dev / lint / commit.",
        fileRef: "src/components/ui/core.tsx",
      },
    ],
  },
  {
    key: "maintainability",
    title: "Maintainability",
    tagline: "Type-safety satuan fisika ekstrem + gerbang CI 7-tahap & 364 kasus uji",
    summary:
      "Perubahan kode diamankan oleh Branded Units TypeScript strict, validator integritas katalog SNI, sinkronisasi versi otomatis, Git hooks, dan CI Quality Gate.",
    maturityScore: 95,
    evidencePoints: [
      {
        label: "Compile-Time Physical Unit Safety",
        detail:
          "strict + noUncheckedIndexedAccess + Branded Units mencegah tertukarnya kNm dan Nmm.",
        fileRef: "src/types/branded-units.ts",
      },
      {
        label: "364 Automated Tests + 5 Rust Tests",
        detail:
          "Pengujian paralel bun test mencakup analitik Euler-Bernoulli, SNI 1729, SNI 2847, & validasi.",
        fileRef: "tests/ & crates/mechanics-3d-wasm/src/lib.rs",
      },
      {
        label: "Automated Release & Verification Gate",
        detail:
          "scripts/verify.ts, scripts/sync-version.ts, dan .github/workflows/ci-quality-gate.yml.",
        fileRef: ".github/workflows/ci-quality-gate.yml",
      },
    ],
  },
];
