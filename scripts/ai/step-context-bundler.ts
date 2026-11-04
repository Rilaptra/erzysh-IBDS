import { copyFile, exists, mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";

interface BuildStepConfig {
  stepNumber: number;
  slug: string;
  title: string;
  requiredMdFiles: string[];
  optionalPrototypeDirs?: string[];
  targetDeliverables: string[];
  verificationCommand: string;
  tailoredSystemPrompt: string;
}

const BUILD_STEPS: BuildStepConfig[] = [
  {
    stepNumber: 1,
    slug: "step-01-scaffolding-and-contracts",
    title: "Scaffolding, Konfigurasi Bun v1.4.4, & Kontrak Tipe Statis",
    requiredMdFiles: [
      "final_project_file_structure_and_preparation.md",
      "bun_v1_4_4_architecture_and_context.md",
    ],
    targetDeliverables: [
      "package.json, tsconfig.json, bunfig.toml, vercel.json, .env.example",
      "src/config/analytics-config.ts, platform-capabilities.ts, sni-safety-factors.ts, deflection-limits-config.ts",
      "src/types/branded-units.ts, beam-loading-modes.ts, concrete-sni2847-types.ts, steel-sni1729-types.ts, hand-gesture-cursor-types.ts, command-registry-types.ts, analytics-telemetry-types.ts",
      "scripts/ci/install-git-hooks.ts, scripts/ci/verify-pipeline.ts, & scripts/ai/ai-commit-helper.ts",
    ],
    verificationCommand: "bun fmt --check && bun check -b",
    tailoredSystemPrompt: [
      "Kita sedang berada pada **STEP 1: Scaffolding, Konfigurasi Bun v1.4.4, & Kontrak Tipe Statis** untuk repositori `Tubes/` (**Interactive Beam Deflection & Structural Design Simulator**).",
      "Bacalah seluruh file `.md` yang ada di folder konteks ini secara menyeluruh sebelum menulis kode.",
      "",
      "### Aturan Rekayasa Wajib pada Step 1:",
      "1. Gunakan **Bun v1.4.4 Native APIs** (`bun fmt`, `bun check -b`, `Bun.$`) tanpa menambahkan dependency berat seperti Prettier, Husky, atau ESLint.",
      "2. Pada `src/types/branded-units.ts`, implementasikan *Branded Types* ketat (`Kilonewton`, `KilonewtonMeter`, `Megapascal`, `Millimeter`, `Meter`, `UtilizationRatio`) beserta kontrak sistem koordinat sumbu dinamis (`Z-Up`, `Y-Up`, dan `CustomXYZ`) serta konvensi bahwa **lendutan ke bawah bernilai negatif (Δ < 0)**.",
      "3. Pada `src/types/beam-loading-modes.ts`, definisikan *discriminated union* untuk Mode A (Gaya Eksternal) dan Mode B (Gaya Dalam Langsung) serta ke-5 kategori tumpuan (8 variasi orientasi: `CANTILEVER_LEFT`, `CANTILEVER_RIGHT`, `PINNED_ROLLER`, `ROLLER_PINNED`, `FIXED_FIXED`, `FIXED_ROLLER`, `ROLLER_FIXED`, `FIXED_PINNED`, `PINNED_FIXED`).",
      "4. Patuhi **Strict Comment Policy**: Dilarang menulis komentar sampah yang mengulang nama fungsi/variabel; tulis komentar hanya untuk menjelaskan logika/kontrak krusial dalam **Bahasa Inggris yang sederhana dan lugas**.",
    ].join("\n"),
  },
  {
    stepNumber: 2,
    slug: "step-02-catalogs-and-bun-macros",
    title: "Katalog Dimensi Primer & Bun Macro Pre-Computation (Baja & Beton)",
    requiredMdFiles: [
      "steel_wf_box_section_geometry_spec.md",
      "sni_1729_steel_design_specification.md",
      "sni_2847_concrete_design_specification.md",
    ],
    targetDeliverables: [
      "src/data/steel-iwf-catalog.json (89 profil IWF standar JIS G 3192 / SNI, hanya menyimpan 5 dimensi primer: H, B, tw, tf, r)",
      "src/data/steel-box-catalog.json (23 profil BOX standar JIS G 3466, hanya menyimpan dimensi primer: H, B, t, type)",
      "src/data/steel-material-grades.json (BJ 34, BJ 37, BJ 41, BJ 50, BJ 55) & src/data/concrete-rebar-catalog.json (BJTP 24/30, BJTS 40/50/60)",
      "src/core/steel/iwf-geometric-properties.ts (Fungsi perhitungan eksak A, W, Ix, Iy, rx, ry, Sx, Sy, Zx, Zy, ho, hc, J, Cw, rts untuk IWF serta A, W, Ix, Iy, Zx, Zy, J, C untuk BOX)",
      "src/macros/precompute-steel-catalog.macro.ts (Bun Macro compile-time pre-computation & sorting berdasarkan Zx)",
      "scripts/data/validate-sni-catalogs.ts",
    ],
    verificationCommand: "bun run data:validate && bun check -b",
    tailoredSystemPrompt: [
      "Kita sedang berada pada **STEP 2: Katalog Dimensi Primer & Bun Macro Pre-Computation (Baja & Beton)**.",
      "Gunakan dokumen spesifikasi rumus geometri profil baja dan SNI di folder konteks ini sebagai acuan tunggal.",
      "",
      "### Aturan Rekayasa Wajib pada Step 2:",
      "1. File `src/data/steel-iwf-catalog.json` **HANYA boleh menyimpan nama profil dan 5 dimensi primer** (`H`, `B`, `tw`, `tf`, `r` dalam mm) sesuai tabel di `sni_1729_steel_design_specification.md`.",
      "2. Seluruh properti turunan (`A`, `W`, `Ix`, `Iy`, `rx`, `ry`, `Sx`, `Sy`, `Zx`, `Zy`, `ho`, `hc`, `J`, `Cw`, `rts`) wajib dihitung secara otomatis menggunakan rumus resmi di `steel_wf_box_section_geometry_spec.md` (termasuk konstanta sudut lengkung *fillet* `af`, `c`, `If0`) melalui **Bun Macro** saat *compile-time* dan diurutkan naik berdasarkan `Zx` untuk pencarian biner O(log N).",
      "3. Buat skrip validator `scripts/data/validate-sni-catalogs.ts` yang memverifikasi bahwa perhitungan rumus untuk sampel **WF 100 x 100 x 17.2** menghasilkan nilai yang sesuai dengan tabel validasi di dokumentasi.",
    ].join("\n"),
  },
  {
    stepNumber: 3,
    slug: "step-03-rust-wasm-mechanics-3d",
    title: "Rust WASM Mechanics Solver (5 Tumpuan, Lendutan Negatif, & 3D Extruded Mesh)",
    requiredMdFiles: [
      "structural_mechanics_and_deflection_solver_spec.md",
      "bun_v1_4_4_architecture_and_context.md",
    ],
    targetDeliverables: [
      "crates/mechanics-3d-wasm/Cargo.toml",
      "crates/mechanics-3d-wasm/src/lib.rs, supports.rs, diagrams.rs, deflection.rs, extrude_3d.rs, rebar_cage_3d.rs",
      "scripts/wasm/build-mechanics-wasm.ts",
      "src/core/mechanics/wasm-mechanics-bridge.ts, support-reactions-solver.ts, internal-force-diagrams-solver.ts, euler-bernoulli-deflection-solver.ts, direct-internal-force-interpolator.ts",
      "tests/mechanics/euler-bernoulli-deflection.test.ts",
    ],
    verificationCommand:
      "cargo test --manifest-path crates/mechanics-3d-wasm/Cargo.toml && bun run wasm:build && bun test tests/mechanics",
    tailoredSystemPrompt: [
      "Kita sedang berada pada **STEP 3: Rust WASM Mechanics Solver & 3D Extruded Mesh Generator (Arsitektur Hybrid Opsi B)**.",
      "Bacalah `structural_mechanics_and_deflection_solver_spec.md` dengan teliti untuk mengimplementasikan crate Rust `crates/mechanics-3d-wasm/` beserta jembatan TypeScript-nya.",
      "",
      "### Aturan Rekayasa Wajib pada Step 3:",
      "1. Dukung penuh **5 kategori tumpuan (8 variasi orientasi)**: Kantilever (Kiri/Kanan), Sendi–Rol / Rol–Sendi, Jepit–Jepit, Jepit–Rol / Rol–Jepit, dan Jepit–Sendi / Sendi–Jepit menggunakan fungsi singularitas Macaulay dan integral kompatibilitas Mohr pada `M = 256` titik.",
      "2. **Konvensi Lendutan Negatif (Δ < 0):** Sumbu vertikal lokal mengarah positif ke atas (+v) dan negatif ke bawah (-v). Beban gravitasi ke bawah WAJIB menghasilkan nilai lendutan negatif (`v(s) < 0` dan `Δ_max < 0`, misalnya `-5*q*L^4 / (384*E*I)` pada Sendi–Rol).",
      "3. **Sistem Koordinat Sumbu Dinamis (XYZ):** Sediakan matriks permutasi ortogonal di Rust WASM sehingga koordinat 3D dapat dipetakan secara instan ke mode **`Z-Up`** (standar SAP2000/Revit/AutoCAD), **`Y-Up`** (standar WebGL/SolidWorks), maupun **`Custom XYZ`**.",
      "4. **Ekstrusi Balok 3D Tanpa Distorsi Penampang:** Buat generator *vertex & normal buffer* (`Float32Array`) untuk profil Baja 3D (IWF & BOX), Beton Bertulang Mode 1 (*Solid + End Cross-Section*), dan Beton Bertulang Mode 2 (*Wireframe Tulangan Pokok + Cincin Sengkang per spasi s*).",
    ].join("\n"),
  },
  {
    stepNumber: 4,
    slug: "step-04-sni-concrete-and-steel-optimizers",
    title: "Engine Optimasi Desain Beton (SNI 2847) & Baja (SNI 1729) di TypeScript",
    requiredMdFiles: [
      "sni_2847_concrete_design_specification.md",
      "sni_1729_steel_design_specification.md",
      "steel_wf_box_section_geometry_spec.md",
    ],
    targetDeliverables: [
      "src/core/concrete/concrete-grade-converter.ts, whitney-flexural-designer.ts, shear-stirrup-designer.ts, concrete-section-optimizer.ts",
      "src/core/steel/section-compactness-classifier.ts, lateral-torsional-buckling-solver.ts, biaxial-interaction-evaluator.ts, steel-torsion-shear-evaluator.ts, steel-section-optimizer.ts",
      "tests/concrete/concrete-sni2847-optimizer.test.ts & tests/steel/steel-sni1729-optimizer.test.ts",
    ],
    verificationCommand: "bun test tests/concrete tests/steel --check",
    tailoredSystemPrompt: [
      "Kita sedang berada pada **STEP 4: Engine Optimasi Desain Beton Bertulang (SNI 2847:2019) & Baja (SNI 1729:2020) di TypeScript**.",
      "",
      "### Aturan Rekayasa Wajib pada Step 4:",
      "1. **Batasan Ruang Lingkup Beton (SNI 2847:2019):** Sesuai catatan ruang lingkup di `sni_2847_concrete_design_specification.md`, optimasi beton bertulang **TIDAK mengikutsertakan gaya aksial (Pu/Nu) maupun torsi (Tu)**. Fokuskan murni pada:",
      "   - Penentuan jumlah dan diameter tulangan tarik (`As`) serta tekan (`A's`) yang efisien menggunakan blok tegangan Whitney, cek `As,min`, regangan `εt >= 0.005`, dan spasi bersih antar tulangan dalam lebar balok `bw`.",
      "   - Penentuan diameter tulangan sengkang dan jarak spasinya (`s`) berdasarkan gaya geser `Vu` dan kuat geser beton standar `Vc = 0.17 * λ * sqrt(fc') * bw * d` serta Tabel 9.7.6.2.2.",
      "2. **Optimasi Baja IWF & BOX (SNI 1729:2020):** Gunakan *Binary Search* O(log N) pada katalog yang telah diurutkan oleh Bun Macro, evaluasi kelangsingan Tabel B4.1b, LTB Pasal F2/F3/F6/F7, interaksi biaxial Pasal H1, dan torsi Pasal H3 dengan target efisiensi rasio kapasitas `0.90 <= DCR <= 1.00` serta filter `H <= H_max` dan `B <= W_max`.",
    ].join("\n"),
  },
  {
    stepNumber: 5,
    slug: "step-05-hybrid-3d-2d-viewport-and-ui",
    title: "Kanvas Hybrid 3D/2D, Tumpuan Gambar 3, 3 Mode Diagram, & Floating Windows",
    requiredMdFiles: [
      "ui_ux_visual_layout_and_interaction_spec.md",
      "structural_mechanics_and_deflection_solver_spec.md",
      "final_project_file_structure_and_preparation.md",
    ],
    targetDeliverables: [
      "src/state/beam-simulator-store.ts & floating-window-store.ts",
      "src/hooks/use-platform-capabilities.ts & use-structural-solver-engine.ts",
      "src/components/canvas/ErzyshDarkGridBackground.tsx, Beam3DExtrudedViewport.tsx, SupportSymbols2DOverlay.tsx, MultiModeDiagram2DOverlay.tsx, DeflectionHudAndColorbar.tsx, CoordinateAxisSwitcher.tsx",
      "src/components/canvas/ConcreteCrossSectionSvg.tsx & SteelProfileCrossSectionSvg.tsx",
      "src/components/forms/*, src/components/results/*, src/components/windows/DraggableFloatingWindow.tsx, & src/components/adaptive/*",
    ],
    verificationCommand: "bun check -b && bun --bun next build",
    tailoredSystemPrompt: [
      "Kita sedang berada pada **STEP 5: Implementasi Kanvas Hybrid 3D/2D, Tumpuan 2D, 3 Mode Diagram, & Floating Windows UI**.",
      "Ikuti seluruh token warna, anatomi viewport, dan aturan tata letak di `ui_ux_visual_layout_and_interaction_spec.md`.",
      "",
      "### Aturan Visual & UI Wajib pada Step 5:",
      "1. **Latar Belakang Kanvas (`ErzyshDarkGridBackground.tsx`):** Warna dasar `#0A0A0A`, garis grid ortogonal `40px x 40px` berwarna `#1F2020` dengan *radial vignette mask*, dan pendaran *radial glow* Teal/Cyan lembut di tengah layar.",
      "2. **Balok 3D (`Beam3DExtrudedViewport.tsx`):** Render profil Baja 3D (IWF/BOX) yang ditarik dari ujung A ke B melengkung tanpa distorsi penampang, serta 2 sub-mode untuk Beton 3D (*Mode 1: Solid + Gambar Potongan Ujung*; *Mode 2: Wireframe Tulangan Pokok & Cincin Sengkang*). Sediakan kamera 3D interaktif (*Orbit/Pan/Zoom* + preset tampak depan 2D).",
      "3. **Simbol Tumpuan 2D (`SupportSymbols2DOverlay.tsx`):** Render dalam 2D tepat di titik tumpuan dengan *stroke* `#94A3B8`, *fill* `#334155 -> #1E293B`, dan garis datum vertikal putus-putus `#6D7C90` untuk Jepit (dinding + 6 arsiran miring), Sendi (segitiga), dan Rol (segitiga + landasan + 2 roda).",
      "4. **3 Mode Diagram 2D (`MultiModeDiagram2DOverlay.tsx`):** Dukung penuh (1) *Bertumpuk di As Balok* dengan toggle aktif/nonaktif per diagram, (2) *Sejajar Vertikal Menurun ke Bawah*, dan (3) *Floating Window Terpisah*.",
      "5. **HUD Defleksi:** Tempatkan *Colorbar Legend* (`0,00 mm` s/d `-Δ_max mm`) + *Coordinate Axis Switcher* (`Z-Up` / `Y-Up` / `Custom XYZ`) di **sisi kanan layar**, dan kartu **Lendutan Maksimum (`-Δ_max`)** di **kiri bawah layar**.",
    ].join("\n"),
  },
  {
    stepNumber: 6,
    slug: "step-06-cad-bim-cae-exporters",
    title: "Exporter Multi-Format CAD / BIM / CAE (.dxf, .lsp, .s2k, .ifc, .iom.xml, .step, .stl)",
    requiredMdFiles: [
      "cad_bim_cae_export_specification.md",
      "steel_wf_box_section_geometry_spec.md",
      "structural_mechanics_and_deflection_solver_spec.md",
    ],
    targetDeliverables: [
      "src/core/exporters/dxf-autocad-exporter.ts",
      "src/core/exporters/s2k-sap2000-exporter.ts",
      "src/core/exporters/ifc4-bim-revit-exporter.ts",
      "src/core/exporters/ideastatica-exporter.ts",
      "src/core/exporters/step-solidworks-exporter.ts",
      "src/components/results/ProfileAndModelExportModal.tsx",
    ],
    verificationCommand: "bun check -b && bun test",
    tailoredSystemPrompt: [
      "Kita sedang berada pada **STEP 6: Implementasi Multi-Software CAD / BIM / CAE Profile & Beam Exporters**.",
      "Ikuti spesifikasi format file di `cad_bim_cae_export_specification.md` secara presisi.",
      "",
      "### Aturan Rekayasa Wajib pada Step 6:",
      "1. Seluruh generator ekspor wajib menghormati **orientasi sumbu koordinat aktif (`Z-Up`, `Y-Up`, atau `Custom XYZ`)** yang dipilih pengguna.",
      "2. Pastikan `.dxf` untuk AutoCAD/IDEA StatiCa menyertakan *bulge* busur *fillet* eksak (`tan(pi/8)`) untuk IWF serta layer terpisah (`S-SECT-OUTLINE`, `S-REBAR-STIRRUP`, `S-REBAR-MAIN`, `S-ANNO-DIMS`) untuk Beton Bertulang.",
      "3. Pastikan `.s2k` untuk SAP2000 memetakan material, profil, koordinat titik, beban, serta ke-5 jenis tumpuan (`JOINT RESTRAINT ASSIGNMENTS`) dengan valid.",
      "4. Pastikan `.ifc` (`IFC4`), `.iom.xml` (IDEA StatiCa), serta `.step` (`AP214`) dan `.stl` untuk SolidWorks menghasilkan file terstruktur standar yang langsung dapat diunduh dari `ProfileAndModelExportModal.tsx`.",
    ].join("\n"),
  },
  {
    stepNumber: 7,
    slug: "step-07-multimodal-ai-ga4-and-pwa",
    title: "Interaksi Multimodal (MediaPipe Hands, Voice AI), GA4 Flex Counter, & Finalisasi PWA",
    requiredMdFiles: [
      "ui_ux_visual_layout_and_interaction_spec.md",
      "bun_v1_4_4_architecture_and_context.md",
      "final_project_file_structure_and_preparation.md",
    ],
    optionalPrototypeDirs: ["hand-tracking", "handTracking", "voice-command", "voiceCommand"],
    targetDeliverables: [
      "src/hooks/use-mediapipe-hand-tracking.ts, use-web-speech-command.ts, use-visitor-flex-counter.ts",
      "src/components/windows/DynamicHandCursorOverlay.tsx & HandTrackingCameraPreview.tsx",
      "src/components/assistant/StructuralAiAssistantPanel.tsx & VoiceCommandStatusToast.tsx",
      "src/components/telemetry/GoogleAnalyticsScriptLoader.tsx & CustomEpochVisitorFlexBadge.tsx",
      "src/app/api/analytics/visitors/route.ts, src/app/api/ai/intent-router/route.ts, src/app/api/ai/structural-consultant/route.ts, src/app/api/report/calculation-sheet/route.ts",
    ],
    verificationCommand: "bun run ci:verify",
    tailoredSystemPrompt: [
      "Kita sedang berada pada **STEP 7: Integrasi Prototipe Multimodal (Hand Tracking & Voice Command), AI Consultant, GA4 Visitor Flex Counter, & Finalisasi PWA**.",
      "",
      "### Aturan Rekayasa Wajib pada Step 7:",
      "1. **Gunakan Kode Prototipe Eksisting di Folder `prototypes/`:** Di dalam sub-folder `prototypes/` pada direktori konteks ini telah disalin kode prototipe `hand-tracking` (`engine.ts`) dan `voice-command` yang sudah berfungsi. Adaptasikan dan integrasikan logika dari prototipe tersebut ke dalam `use-mediapipe-hand-tracking.ts`, `DynamicHandCursorOverlay.tsx`, `use-web-speech-command.ts`, dan `/api/ai/intent-router/route.ts` — jangan menulis ulang dari nol.",
      "2. Pastikan modul kamera MediaPipe Hands hanya di-*load* secara dinamis pada mode `DESKTOP_WORKSTATION` dan tidak diunduh pada mode `ANDROID_COMPANION`.",
      "3. Implementasikan endpoint `/api/analytics/visitors/route.ts` menggunakan `crypto.subtle` dan cache `Bun.hash` untuk menampilkan jumlah kunjungan sejak `HARDCODED_START_DATE`.",
    ].join("\n"),
  },
];

async function resolveMdFileName(mdSourceDir: string, requestedName: string): Promise<string> {
  if (await exists(join(mdSourceDir, requestedName))) {
    return requestedName;
  }
  if (requestedName === "steel_wf_box_section_geometry_spec.md") {
    const fallback = "dokumentasi_rumus_profil_baja_wf.md";
    if (await exists(join(mdSourceDir, fallback))) {
      return fallback;
    }
  }
  return requestedName;
}

async function copyDirectoryRecursive(srcDir: string, destDir: string): Promise<void> {
  await mkdir(destDir, { recursive: true });
  const entries = await readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name);
    if (entry.isDirectory()) {
      await copyDirectoryRecursive(srcPath, destPath);
    } else {
      await copyFile(srcPath, destPath);
    }
  }
}

async function bundleStepContext(stepNum: number, customUserNotes: string): Promise<void> {
  const step = BUILD_STEPS.find((s) => s.stepNumber === stepNum);
  if (!step) {
    console.error(`Nomor step tidak valid: ${stepNum}. Pilih angka 1 s/d ${BUILD_STEPS.length}.`);
    process.exit(1);
  }

  const rootDir = process.cwd();
  const mdSourceDir = join(rootDir, "mdfiles");
  const prototypeRootDir = join(rootDir, "prototype");
  const targetDir = join(rootDir, ".tmp-step-context", step.slug);

  await rm(targetDir, { recursive: true, force: true });
  await mkdir(targetDir, { recursive: true });

  const copiedFiles: string[] = [];
  for (const reqFile of step.requiredMdFiles) {
    const actualFile = await resolveMdFileName(mdSourceDir, reqFile);
    const srcPath = join(mdSourceDir, actualFile);
    const destPath = join(targetDir, actualFile);
    if (await exists(srcPath)) {
      await copyFile(srcPath, destPath);
      copiedFiles.push(actualFile);
    } else {
      console.warn(`⚠️ Peringatan: File ${actualFile} belum ditemukan di ${mdSourceDir}`);
    }
  }

  const copiedPrototypes: string[] = [];
  if (step.optionalPrototypeDirs && (await exists(prototypeRootDir))) {
    for (const protoSub of step.optionalPrototypeDirs) {
      const protoSrc = join(prototypeRootDir, protoSub);
      if (await exists(protoSrc)) {
        const protoDest = join(targetDir, "prototypes", protoSub);
        await copyDirectoryRecursive(protoSrc, protoDest);
        copiedPrototypes.push(`prototypes/${protoSub}/`);
      }
    }
  }

  const userNotesContent = customUserNotes.trim()
    ? customUserNotes.trim()
    : "<!-- Tuliskan tambahan prompt, revisi kecil, atau instruksi khusus dari kamu di bawah baris ini sebelum di-copy ke AI -->\n- (Belum ada catatan tambahan khusus — ikuti seluruh spesifikasi di atas secara penuh)";

  const promptMdContent = [
    `# 🚀 PROMPT EKSEKUSI AI — STEP ${step.stepNumber}: ${step.title}`,
    "",
    "> **Cara Pakai:** Copy seluruh isi file `PROMPT.md` ini (atau lampirkan seluruh isi folder `.tmp-step-context/" +
      step.slug +
      "/`) ke AI Coding Agent kamu. Jika ada tambahan ide mendadak, kamu bisa langsung mengetikkannya pada bagian **Catatan / Prompt Tambahan dari Developer** di bagian paling bawah file ini.",
    "",
    "## 🎯 1. Konteks & Instruksi Utama Step Ini",
    "",
    step.tailoredSystemPrompt,
    "",
    "## 📂 2. Daftar File Referensi (`mdfiles`) di Folder Konteks Ini",
    "",
    "Gunakan file berikut yang berada di folder yang sama dengan `PROMPT.md` ini sebagai acuan tunggal (*Single Source of Truth*):",
    ...copiedFiles.map((f, idx) => `${idx + 1}. \`./${f}\``),
    ...(copiedPrototypes.length > 0
      ? [
          "",
          "### 🧪 Kode Prototipe Eksisting yang Wajib Diintegrasikan:",
          ...copiedPrototypes.map((p) => `- \`./${p}\``),
        ]
      : []),
    "",
    "## 🛠️ 3. Daftar Target File & Modul yang Wajib Kamu Buat / Selesaikan pada Step Ini",
    "",
    ...step.targetDeliverables.map((d) => `- [ ] ${d}`),
    "",
    "## ✅ 4. Kriteria Lulus & Perintah Verifikasi",
    "",
    "Setelah seluruh file di atas selesai diimplementasikan tanpa *placeholder* (`// TODO`), jalankan perintah verifikasi berikut hingga lulus 0 error:",
    "```bash",
    step.verificationCommand,
    "```",
    "",
    "## ✍️ 5. Catatan / Prompt Tambahan dari Developer (Custom User Prompt)",
    "",
    "pastikan kamu tulis semuanya dengan JSDocs / Dokumentasi yang lengkap dengan penjelasan tiap parameter input (args) dan outputnya, tipe datanya, contoh datanya, serta deksripsi functionnya",
    "pastikan juga kamu menuliskan error handler yang jelas untuk semua kode, sehingga semua error yang terjadi dapat di traceback secara mudah dan di fix dengan mudah juga",
    "",
    userNotesContent,
    "",
  ].join("\n");

  const promptFilePath = join(targetDir, "PROMPT.md");
  await Bun.write(promptFilePath, promptMdContent);

  console.log(`\n✅ Berhasil menyiapkan paket konteks untuk STEP ${step.stepNumber}!`);
  console.log(`📂 Folder Tujuan : ${targetDir}`);
  console.log(`📄 File Dicopy   : ${copiedFiles.join(", ")}`);
  if (copiedPrototypes.length > 0) {
    console.log(`🧪 Prototipe     : ${copiedPrototypes.join(", ")}`);
  }
  console.log(`📝 File Prompt   : ${promptFilePath} (Siap di-copy atau ditambah catatan!)`);
}

async function runCli(): Promise<void> {
  const argStep = Bun.argv[2] ? Number(Bun.argv[2]) : null;
  const argCustomPrompt = Bun.argv.slice(3).join(" ");

  if (argStep) {
    await bundleStepContext(argStep, argCustomPrompt);
    return;
  }

  console.log("=======================================================================");
  console.log("🏗️  Tubes Step-by-Step AI Context & PROMPT.md Bundler (Bun v1.4.4 CLI)");
  console.log("=======================================================================");
  for (const s of BUILD_STEPS) {
    console.log(`  [${s.stepNumber}] ${s.title}`);
    console.log(`      └─ mdfiles: ${s.requiredMdFiles.join(", ")}`);
  }
  console.log("=======================================================================");
  process.stdout.write("Pilih nomor Step yang ingin disiapkan [1-7]: ");

  let selectedStep: number | null = null;
  for await (const line of console) {
    if (selectedStep === null) {
      selectedStep = Number(line.trim());
      if (!BUILD_STEPS.some((s) => s.stepNumber === selectedStep)) {
        console.error("Nomor step tidak valid. Harap masukkan angka 1 sampai 7.");
        process.exit(1);
      }
      process.stdout.write(
        "Ketik tambahan prompt/catatan khusus untuk Step ini (atau tekan Enter jika kosong): ",
      );
    } else {
      const customNotes = line.trim();
      await bundleStepContext(selectedStep, customNotes);
      break;
    }
  }
}

runCli();
