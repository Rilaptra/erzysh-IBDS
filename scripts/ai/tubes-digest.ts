#!/usr/bin/env bun
/**
 * @file tubes-digest.ts
 * @description Dedicated Interactive AI Prompter & Code Digester for the Tubes Project.
 * Built with @rilaptra/tui (Select, MultiSelect, Confirm, TextPrompt, ToastBuilder)
 * and native Bun APIs.
 *
 * Capabilities:
 * 1. Preset 1: 📦 Custom Parametric BOX Hollow Optimizer (Interval 50 mm, t = 20-35 mm, optional)
 * 2. Preset 2: ⚡ Mode B Direct Factored Internal Forces & 3D/2D Viewport Fix
 * 3. Preset 3: ✍️ Custom User Prompt + File MultiSelect Picker
 * 4. Preset 4: 📁 Interactive File Checklist (Select files from src/)
 * 5. Preset 5: 🔍 Recursive Import Trace from an Entry Point
 * 6. Direct CLI arguments: `bun run digest custom-box`, `bun run digest mode-b`, or `bun run digest <files...>`
 * 7. Windows Clipboard auto-copy (`clip`) & Windows Toast Notifications (`ToastBuilder`).
 */

import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { basename, extname, isAbsolute, join, relative } from "node:path";

import { Confirm, MultiSelect, Select, TextPrompt, ToastBuilder } from "@rilaptra/tui";

// ============================================================================
// File Target Presets
// ============================================================================

export const FILES_CUSTOM_BOX: readonly string[] = [
  "src/types/steel-sni1729-types.ts",
  "src/core/steel/iwf-geometric-properties.ts",
  "src/core/steel/steel-section-optimizer.ts",
  "src/state/beam-simulator-store.ts",
  "src/hooks/use-structural-solver-engine.ts",
  "src/components/forms/SteelDesignParametersForm.tsx",
  "src/components/results/SteelOptimizationRankingTable.tsx",
  "src/components/canvas/SteelProfileCrossSectionSvg.tsx",
  "tests/steel/steel-sni1729-optimizer.test.ts",
] as const;

export const FILES_MODE_B: readonly string[] = [
  "src/components/forms/DirectInternalForcesForm.tsx",
  "src/components/forms/SteelDesignParametersForm.tsx",
  "src/components/forms/MaterialAndLoadModeSelector.tsx",
  "src/hooks/use-structural-solver-engine.ts",
  "src/state/beam-simulator-store.ts",
  "src/core/mechanics/direct-internal-force-interpolator.ts",
  "src/core/steel/steel-section-optimizer.ts",
  "src/core/steel/iwf-geometric-properties.ts",
  "src/components/results/SteelOptimizationRankingTable.tsx",
  "src/components/canvas/SteelProfileCrossSectionSvg.tsx",
  "src/components/adaptive/DesktopWorkstationView.tsx",
  "src/components/adaptive/AndroidCompanionView.tsx",
  "src/types/beam-loading-modes.ts",
  "src/types/steel-sni1729-types.ts",
  "src/types/branded-units.ts",
] as const;

// ============================================================================
// Prompts Generator
// ============================================================================

/**
 * Returns the prompt instructing an AI to implement the Custom Parametric Box Hollow feature.
 */
export function getCustomBoxHollowPrompt(customNotes = ""): string {
  return [
    "# 🚀 TASK: Implementasi Generator & Optimizer Parametrik Penampang BOX Hollow Custom (SNI 1729:2020)",
    "",
    "Kamu adalah Senior Structural Engineering & Full-Stack TypeScript/Bun Developer pada repositori **Interactive Beam Deflection & Structural Design Simulator (SNI 2847:2019 & SNI 1729:2020)**.",
    "",
    "## 🎯 Kebutuhan Fitur (User Requirements)",
    "Saat ini, untuk profil baja bertipe **BOX (Hollow Structural Section / HSS)**, aplikasi hanya mencari penampang dari katalog statis JIS G 3466 (`src/data/steel-box-catalog.json` berisi 23 profil standar) yang memiliki tebal maksimum terbatas (maksimal hanya 12 mm).",
    "",
    "Pengguna membutuhkan fitur **Custom Parametric Box Hollow Section Generator & Optimizer** dengan spesifikasi:",
    "1. **Iterasi Otomatis dengan Interval Dimensi (Default Step = 50 mm):**",
    "   - Menghasilkan variasi penampang box hollow berdasarkan rentang tinggi $H$ dan lebar $B$ dengan kelipatan interval tertentu (default $\\Delta H = \\Delta B = 50\\text{ mm}$, misalnya $H, B \\in \\{150, 200, 250, 300, 350, 400, 450, 500, 550, 600\\}\\text{ mm}$).",
    "2. **Rentang Tebal Khusus (Tebal Awal/Min 20 mm s/d Maks 35 mm):**",
    "   - Tebal dinding $t$ diuji mulai dari $t_{\\min} = 20\\text{ mm}$ hingga $t_{\\max} = 35\\text{ mm}$ dengan interval tebal (default $\\Delta t = 2.5\\text{ mm}$ atau $5\\text{ mm}$, misal $t \\in \\{20, 25, 30, 35\\}\\text{ mm}$ atau step bebas).",
    "3. **Fleksibel & Opsional (Bisa Diaktifkan / Dinonaktifkan):**",
    "   - Seluruh batasan dimensi ($H_{\\min}, H_{\\max}$, $B_{\\min}, B_{\\max}$, $t_{\\min}, t_{\\max}$, step dimensi $\\Delta$, dan step tebal $\\Delta t$) dapat **di-input sendiri secara dinamis oleh pengguna** di UI.",
    "   - Fitur ini bersifat **opsional (toggle Switch/Checkbox Aktif/Nonaktif)** di form Parameter Desain Baja. Jika nonaktif, aplikasi tetap menggunakan katalog standar JIS G 3466.",
    "   - Opsi bentuk penampang: **Semua (Persegi & Persegi Panjang)**, **Persegi Saja ($H = B$)**, atau **Persegi Panjang Saja ($H \\ne B$)**.",
    "4. **Perhitungan Geometri & Evaluasi SNI 1729:2020 yang Utuh:**",
    "   - Setiap penampang custom yang di-generate wajib dihitung properti penampangnya secara eksak menggunakan rumus resmi di `computeBoxSectionProperties` (`src/core/steel/iwf-geometric-properties.ts`): luas $A$, berat $W$, inersia $I_x, I_y$, modulus plastis $Z_x, Z_y$, konstanta torsi St. Venant $J$, dan konstanta torsi HSS $C$ (SNI Pasal H3.1).",
    "   - Dievaluasi penuh terhadap SNI 1729:2020: kelangsingan pelat Tabel B4.1b, tekuk torsi lateral (LTB Bab F), interaksi aksial-momen (Bab H1), geser (Bab G), torsi (Bab H3), dan batas lendutan.",
    "   - Diurutkan berdasarkan **berat unit teringan (`unitWeightKgPerM` ascending)** sehingga profil custom yang paling ekonomis dan aman otomatis menjadi peringkat teratas (`bestCandidate`).",
    "5. **Terkoneksi Penuh ke Visual 2D SVG, 3D WebGL Viewport, dan Tabel Peringkat:**",
    "   - Hasil profil custom terpilih langsung di-render pada gambar potongan 2D SVG (`SteelProfileCrossSectionSvg.tsx`), tabel peringkat alternatif (`SteelOptimizationRankingTable.tsx`), dan ekstrusi 3D WebGL (`Beam3DExtrudedViewport.tsx`).",
    "",
    "---",
    "",
    "## 🛠️ Rencana Arsitektur & Langkah-Langkah Implementasi",
    "",
    "### 1. Definisikan Kontrak Tipe di `src/types/steel-sni1729-types.ts`",
    "Tambahkan interface untuk konfigurasi generator box custom:",
    "```ts",
    'export type CustomBoxShapeRule = "ALL" | "SQUARE_ONLY" | "RECTANGULAR_ONLY";',
    "",
    "export interface CustomBoxOptimizationConfig {",
    "  /** Apakah mode generator custom hollow box aktif (default: false). */",
    "  readonly enabled: boolean;",
    "  /** Tinggi minimum H dalam mm (default: 200). */",
    "  readonly hMinMm: number;",
    "  /** Tinggi maksimum H dalam mm (default: 600). */",
    "  readonly hMaxMm: number;",
    "  /** Lebar minimum B dalam mm (default: 200). */",
    "  readonly bMinMm: number;",
    "  /** Lebar maksimum B dalam mm (default: 600). */",
    "  readonly bMaxMm: number;",
    "  /** Interval/step kelipatan dimensi H dan B dalam mm (default: 50). */",
    "  readonly dimensionStepMm: number;",
    "  /** Tebal dinding minimum t dalam mm (default: 20). */",
    "  readonly tMinMm: number;",
    "  /** Tebal dinding maksimum t dalam mm (default: 35). */",
    "  readonly tMaxMm: number;",
    "  /** Interval/step kelipatan tebal t dalam mm (default: 5). */",
    "  readonly thicknessStepMm: number;",
    '  /** Aturan bentuk penampang (default: "ALL"). */',
    "  readonly shapeRule: CustomBoxShapeRule;",
    "}",
    "```",
    "Tambahkan juga properti opsional `isCustomGenerated?: boolean;` pada `SteelSectionProperties` agar UI dapat memberi badge khusus bila profil berasal dari generator parametrik.",
    "",
    "### 2. Implementasikan Generator Penampang di `src/core/steel/steel-section-optimizer.ts`",
    "Buat fungsi pure generator:",
    "```ts",
    "/**",
    " * Menghasilkan katalog penampang hollow box secara parametrik berdasarkan rentang dimensi dan tebal.",
    " * Menjamin batas kelangsingan flat wall SNI 1729: H > 3*t dan B > 3*t.",
    " */",
    "export function generateCustomBoxCatalog(",
    "  config: CustomBoxOptimizationConfig,",
    "): readonly BoxSectionProperties[] {",
    "  const sections: BoxSectionProperties[] = [];",
    "  const stepDim = Math.max(10, Math.round(config.dimensionStepMm || 50));",
    "  const stepT = Math.max(1, Math.round(config.thicknessStepMm || 5));",
    "  const hMin = Math.max(100, Math.round(config.hMinMm));",
    "  const hMax = Math.max(hMin, Math.round(config.hMaxMm));",
    "  const bMin = Math.max(100, Math.round(config.bMinMm));",
    "  const bMax = Math.max(bMin, Math.round(config.bMaxMm));",
    "  const tMin = Math.max(2, Math.round(config.tMinMm));",
    "  const tMax = Math.max(tMin, Math.round(config.tMaxMm));",
    "",
    "  for (let H = hMin; H <= hMax; H += stepDim) {",
    "    for (let B = bMin; B <= bMax; B += stepDim) {",
    '      if (config.shapeRule === "SQUARE_ONLY" && H !== B) continue;',
    '      if (config.shapeRule === "RECTANGULAR_ONLY" && H === B) continue;',
    "",
    "      for (let t = tMin; t <= tMax; t += stepT) {",
    "        // Syarat geometri SNI 1729 Table B4.1b: flat wall height hc = H - 3t > 0",
    "        if (H <= 3 * t || B <= 3 * t) continue;",
    "",
    "        const isSquare = H === B;",
    "        const name = `BOX ${H} x ${B} x ${t} (Custom)`;",
    "        try {",
    "          const props = computeBoxSectionProperties({",
    "            name,",
    "            H: millimeter(H),",
    "            B: millimeter(B),",
    "            t: millimeter(t),",
    '            shapeType: isSquare ? "SQUARE" : "RECTANGULAR",',
    "          });",
    "          sections.push({ ...props, isCustomGenerated: true });",
    "        } catch {",
    "          // Abaikan kombinasi yang melanggar batas fisik",
    "        }",
    "      }",
    "    }",
    "  }",
    "",
    "  // Urutkan ascending berdasarkan Zx untuk konsistensi search",
    "  return sections.sort((a, b) => Number(a.Zx) - Number(b.Zx));",
    "}",
    "```",
    "",
    "Di dalam `optimizeSteelSection(input: SteelOptimizerInput)`:",
    "- Tambahkan field opsional `customBoxConfig?: CustomBoxOptimizationConfig` pada `SteelOptimizerInput`.",
    '- Ketika `selectedProfileType === "BOX"` dan `input.customBoxConfig?.enabled`:',
    "  - Gunakan `generateCustomBoxCatalog(input.customBoxConfig)` sebagai `catalog` (jika kosong, lempar `SteelDesignError` dengan pesan informatif agar user menyesuaikan batasan rentang).",
    "  - Tetap terapkan evaluasi SNI 1729 (Compactness, LTB, Interaction, Shear, Torsion, Deflection) dan sorting berdasarkan `unitWeightKgPerM` ascending.",
    "",
    "### 3. Tambahkan State & Action di `src/state/beam-simulator-store.ts`",
    "- Tambahkan properti `customBoxConfig: CustomBoxOptimizationConfig` pada `BeamSimulatorState`.",
    "- Nilai default pada `INITIAL_STATE`:",
    "  ```ts",
    "  customBoxConfig: {",
    "    enabled: false,",
    "    hMinMm: 200,",
    "    hMaxMm: 600,",
    "    bMinMm: 200,",
    "    bMaxMm: 600,",
    "    dimensionStepMm: 50,",
    "    tMinMm: 20,",
    "    tMaxMm: 35,",
    "    thicknessStepMm: 5,",
    '    shapeRule: "ALL",',
    "  },",
    "  ```",
    "- Perbarui `setSteelParameters` agar dapat menerima `customBoxConfig?: Partial<CustomBoxOptimizationConfig>`.",
    "",
    "### 4. Teruskan Konfigurasi di `src/hooks/use-structural-solver-engine.ts`",
    "- Saat memanggil `optimizeSteelSection({...})`, masukkan `customBoxConfig: store.customBoxConfig`.",
    "- Masukkan `store.customBoxConfig` ke dalam dependency array `useEffect` agar solver langsung menghitung ulang secara reaktif ketika parameter rentang custom diubah.",
    "",
    "### 5. Bangun Antarmuka UI di `src/components/forms/SteelDesignParametersForm.tsx`",
    'Ketika `steelProfileType === "BOX"`, tampilkan kartu kontrol khusus:',
    '- **Toggle Switch / Checkbox:** *"Gunakan Generator Parametrik Custom (Interval 50 mm & Tebal 20-35 mm)"*.',
    "- Jika Aktif, tampilkan panel pengaturan parametrik:",
    "  - **Rentang Tinggi H:** Input `H_min` dan `H_max` (mm, step 50).",
    "  - **Rentang Lebar B:** Input `B_min` dan `B_max` (mm, step 50).",
    "  - **Interval Dimensi:** Input step $\\Delta$ (mm, default 50 mm).",
    "  - **Rentang Tebal t:** Input `t_min` (default 20 mm) dan `t_max` (default 35 mm).",
    "  - **Interval Tebal:** Input step $\\Delta t$ (mm, default 5 mm).",
    "  - **Aturan Bentuk:** Tombol pilihan: *Semua*, *Persegi Saja (H=B)*, atau *Persegi Panjang Saja*.",
    '  - **Indikator Badge Info:** Hitung estimasi jumlah kombinasi profil yang diuji (misal: *"36 variasi penampang akan diuji secara real-time"*).',
    "",
    "### 6. Perbarui UI Hasil di `src/components/results/SteelOptimizationRankingTable.tsx`",
    "- Jika `bestCandidate.properties.isCustomGenerated` bernilai true, tampilkan badge khusus berwarna ungu/amber bertuliskan `⚡ PARAMETRIK CUSTOM` di samping nama profil.",
    "- Di tabel peringkat alternatif, tandai profil custom dengan badge `Custom` agar mudah dibedakan dari profil katalog standar.",
    "",
    "### 7. Buat Unit Test di `tests/steel/steel-sni1729-optimizer.test.ts`",
    "- Tambahkan pengujian `generateCustomBoxCatalog`:",
    "  - Memverifikasi rentang $H, B \\in [200, 300]$ dengan step 50 dan $t \\in [20, 35]$ dengan step 5 menghasilkan jumlah dan nama penampang yang tepat.",
    "  - Memverifikasi `optimizeSteelSection` dengan `customBoxConfig.enabled = true` berhasil merekomendasikan profil custom dengan $t \\ge 20\\text{ mm}$ yang lulus seluruh verifikasi SNI 1729.",
    "",
    customNotes ? `### 8. Catatan Tambahan Developer:\n${customNotes}\n` : "",
    "---",
    "",
    "## ✅ Kriteria Verifikasi",
    "Setelah implementasi selesai, pastikan perintah berikut lulus 0 error:",
    "```bash",
    "bun check -b && bun test tests/steel",
    "```",
  ].join("\n");
}

export function getModeBFixPrompt(): string {
  return [
    "# 🛠️ TASK: Perbaiki Responsivitas Input Gaya Dalam (Mode B), Visual 3D/2D, Tombol Submit, & Notifikasi",
    "Pastikan seluruh input gaya dalam (Mode B) merespon secara langsung, balok 3D dan diagram gaya dalam tetap tampil pada Mode B, tombol submit/konfirmasi tersedia dengan banner notifikasi, dan profil baja terupdate secara dinamis.",
  ].join("\n");
}

// ============================================================================
// File Bundling Utilities
// ============================================================================

function fenceFor(text: string): string {
  let max = 2;
  for (const match of text.matchAll(/`+/g)) {
    if (match[0].length > max) max = match[0].length;
  }
  return "`".repeat(Math.max(3, max + 1));
}

function buildTreeFromPaths(relPaths: readonly string[]): string[] {
  type TreeNode = { dirs: Map<string, TreeNode>; files: string[] };
  const root: TreeNode = { dirs: new Map(), files: [] };

  for (const rel of relPaths) {
    const parts = rel.split("/");
    const fileName = parts.pop();
    if (!fileName) continue;
    let cur = root;
    for (const part of parts) {
      if (!cur.dirs.has(part)) cur.dirs.set(part, { dirs: new Map(), files: [] });
      cur = cur.dirs.get(part)!;
    }
    cur.files.push(fileName);
  }

  const lines: string[] = [];
  const walkNode = (node: TreeNode, prefix: string): void => {
    const dirNames = [...node.dirs.keys()].sort();
    const fileNames = [...node.files].sort();
    const total = dirNames.length + fileNames.length;
    let idx = 0;

    for (const d of dirNames) {
      const isLast = ++idx === total;
      lines.push(`${prefix}${isLast ? "└── " : "├── "}${d}/`);
      walkNode(node.dirs.get(d)!, prefix + (isLast ? "    " : "│   "));
    }
    for (const f of fileNames) {
      const isLast = ++idx === total;
      lines.push(`${prefix}${isLast ? "└── " : "├── "}${f}`);
    }
  };

  walkNode(root, "");
  return lines;
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    const proc = Bun.spawn(["clip"], {
      stdin: new TextEncoder().encode(text),
      stdout: "ignore",
      stderr: "ignore",
    });
    return (await proc.exited) === 0;
  } catch {
    return false;
  }
}

async function bundleFiles(
  filePaths: readonly string[],
  instructionPrompt: string,
  outputFilename: string,
): Promise<{ outputPath: string; totalBytes: number; estTokens: string; copied: boolean }> {
  const rootDir = process.cwd();
  const outDir = join(rootDir, ".tmp-step-context");
  if (!existsSync(outDir)) {
    await mkdir(outDir, { recursive: true });
  }

  const treeLines = buildTreeFromPaths(filePaths);
  const codeBlocks: string[] = [];
  let totalBytes = 0;

  for (const relPath of filePaths) {
    const fullPath = join(rootDir, relPath);
    const file = Bun.file(fullPath);
    if (!(await file.exists())) {
      codeBlocks.push(`\n// --- ${relPath} (File not found) ---\n`);
      continue;
    }

    let text = await file.text();
    if (text.includes("\r")) text = text.replace(/\r\n/g, "\n");
    totalBytes += file.size;

    const fence = fenceFor(text);
    const lang = extname(relPath).replace(/^\./, "") || "ts";
    codeBlocks.push(`\n// --- ${relPath} ---\n${fence}${lang}\n${text}\n${fence}\n`);
  }

  const fullMarkdown = [
    instructionPrompt,
    "",
    "---",
    "",
    "# 📦 PROJECT DIGEST",
    "",
    "## Structure",
    "```",
    ...treeLines,
    "```",
    "",
    "## Code Content",
    ...codeBlocks,
  ].join("\n");

  const outputPath = join(outDir, outputFilename);
  await Bun.write(outputPath, fullMarkdown);

  const copied = await copyToClipboard(fullMarkdown);
  const estTokens = Math.round(fullMarkdown.length / 4).toLocaleString("en-US");

  return { outputPath, totalBytes, estTokens, copied };
}

// ============================================================================
// Interactive TUI Main Runner
// ============================================================================

async function main(): Promise<void> {
  const args = Bun.argv.slice(2);
  const rootDir = process.cwd();

  // Non-interactive CLI flags support
  if (args[0] === "custom-box" || args[0] === "box") {
    console.log("⚡ Generating Custom BOX Hollow prompt...");
    const prompt = getCustomBoxHollowPrompt();
    const res = await bundleFiles(FILES_CUSTOM_BOX, prompt, "PROMPT_CUSTOM_BOX_HOLLOW.md");
    console.log(`✅ Saved: ${res.outputPath} (~${res.estTokens} tokens)`);
    console.log(
      res.copied
        ? "📋 Tersalin ke Clipboard! Tinggal Ctrl+V di AI."
        : "⚠️ Silakan buka file di atas.",
    );
    return;
  }

  if (args[0] === "mode-b") {
    console.log("⚡ Generating Mode B prompt...");
    const prompt = getModeBFixPrompt();
    const res = await bundleFiles(FILES_MODE_B, prompt, "PROMPT_FIX_MODE_B_GAYA_DALAM.md");
    console.log(`✅ Saved: ${res.outputPath} (~${res.estTokens} tokens)`);
    console.log(
      res.copied
        ? "📋 Tersalin ke Clipboard! Tinggal Ctrl+V di AI."
        : "⚠️ Silakan buka file di atas.",
    );
    return;
  }

  // Interactive @rilaptra/tui Mode
  console.clear();
  console.log("=======================================================================");
  console.log("⚡ TUBES PROMPTER & DIGESTER (Custom Repo CLI Tool)");
  console.log("   Built with @rilaptra/tui & Bun v1.4.4");
  console.log("=======================================================================\n");

  const taskMode = await new Select<string>()
    .title("🎯 Pilih Tugas / Fitur yang Ingin Dibuatkan Prompt:")
    .columns(1)
    .add(
      "📦 1. Custom Parametric BOX Hollow Optimizer (Interval 50 mm, t=20-35 mm)",
      "custom-box",
      {
        desc: "Generate variasi penampang box custom dengan rentang H/B step 50 & tebal 20-35 mm",
      },
    )
    .add("⚡ 2. Mode B Direct Internal Forces & Visual 3D/2D Fix", "mode-b", {
      desc: "Prompt perbaikan alur solver gaya dalam Mode B dan visual",
    })
    .add("✍️ 3. Tulis Prompt Kustom Sendiri (Custom Task)", "custom-prompt", {
      desc: "Ketik prompt bebas lalu pilih file yang relevan",
    })
    .add("📁 4. Multi-Select File Checklist Manual", "select-files", {
      desc: "Pilih file-file apa saja yang ingin di-bundle ke digest",
    })
    .run();

  let targetFiles: readonly string[] = FILES_CUSTOM_BOX;
  let instructionPrompt = "";
  let outName = "PROMPT_DIGEST.md";

  if (taskMode === "custom-box") {
    targetFiles = FILES_CUSTOM_BOX;
    const addNotes = await new Confirm({
      title: "Apakah ingin menambahkan instruksi/catatan khusus tambahan?",
      initialValue: false,
    }).run();

    let customNotes = "";
    if (addNotes) {
      customNotes = await new TextPrompt({
        title: "Ketik catatan tambahan developer:",
        placeholder: "misal: buat step tebal default 2 mm, prioritaskan rasio b/h = 1.0",
      }).run();
    }
    instructionPrompt = getCustomBoxHollowPrompt(customNotes);
    outName = "PROMPT_CUSTOM_BOX_HOLLOW.md";
  } else if (taskMode === "mode-b") {
    targetFiles = FILES_MODE_B;
    instructionPrompt = getModeBFixPrompt();
    outName = "PROMPT_FIX_MODE_B_GAYA_DALAM.md";
  } else if (taskMode === "custom-prompt") {
    instructionPrompt = await new TextPrompt({
      title: "Ketikkan instruksi prompt untuk AI tujuan:",
      placeholder: "Jelaskan task apa yang perlu AI selesaikan...",
    }).run();

    const fileChoice = await new Select<string>()
      .title("Pilih kumpulan file yang ingin disertakan:")
      .add("File Terkait Baja & BOX Hollow (9 files)", "box")
      .add("File Terkait Solver Mode B & UI (15 files)", "mode-b")
      .run();

    targetFiles = fileChoice === "box" ? FILES_CUSTOM_BOX : FILES_MODE_B;
    outName = `PROMPT_CUSTOM_${Date.now()}.md`;
  } else if (taskMode === "select-files") {
    instructionPrompt = "# 📦 PROJECT CODE DIGEST\nSilakan tinjau file-file terlampir berikut:";
    // Pre-populate MultiSelect with common source files
    const allCandidates = [
      ...FILES_MODE_B,
      "src/core/concrete/concrete-section-optimizer.ts",
      "src/core/concrete/whitney-flexural-designer.ts",
      "src/core/concrete/shear-stirrup-designer.ts",
      "src/components/forms/ConcreteDesignParametersForm.tsx",
      "src/components/results/ConcreteOptimizationResultCard.tsx",
      "src/components/canvas/Beam3DExtrudedViewport.tsx",
    ];
    const uniqueCandidates = [...new Set(allCandidates)].sort();

    const multi = new MultiSelect<string>()
      .title("Centang file yang ingin dimasukkan (Spasi = toggle, Enter = konfirmasi):")
      .columns(1)
      .pageSize(10);

    for (const f of uniqueCandidates) {
      multi.add(f, f, { selected: FILES_CUSTOM_BOX.includes(f as any) });
    }

    const picked = await multi.run();
    if (!picked || picked.length === 0) {
      console.log("❌ Tidak ada file yang dipilih. Dibatalkan.");
      return;
    }
    targetFiles = picked;
    outName = `DIGEST_SELECTED_${Date.now()}.md`;
  }

  // Format selection
  const format = await new Select<string>()
    .title("Format Digest yang Diinginkan:")
    .add("📄 Full Digest (Instruksi Prompt + Seluruh Isi File Kode)", "full")
    .add("📝 Teks Prompt Saja (Tanpa Isi File Kode)", "prompt-only")
    .run();

  if (format === "prompt-only") {
    const outDir = join(rootDir, ".tmp-step-context");
    if (!existsSync(outDir)) await mkdir(outDir, { recursive: true });
    const pPath = join(outDir, "PROMPT_ONLY.md");
    await Bun.write(pPath, instructionPrompt);
    const copied = await copyToClipboard(instructionPrompt);

    console.log(`\n✅ Berhasil menyimpan teks prompt di: ${pPath}`);
    if (copied) {
      console.log("📋 Teks prompt SUDAH OTOMATIS TERSALIN ke Clipboard!");
      try {
        await ToastBuilder.create("Teks prompt berhasil disalin ke Clipboard! 🚀")
          .setTitle("Tubes Prompter")
          .setAppName("Tubes AI Digester")
          .show();
      } catch {}
    }
    return;
  }

  // Bundle
  console.log(`\n⏳ Sedang mem-bundle ${targetFiles.length} file...`);
  const res = await bundleFiles(targetFiles, instructionPrompt, outName);
  const sizeKb = (res.totalBytes / 1024).toFixed(1);

  console.log("\n=======================================================================");
  console.log("🎉 DIGEST & PROMPT BERHASIL DIGENERATE!");
  console.log("=======================================================================");
  console.log(`📂 Jumlah File    : ${targetFiles.length} files (${sizeKb} KB)`);
  console.log(`🧮 Estimasi Token : ~${res.estTokens} tokens`);
  console.log(`📄 Path File      : ${res.outputPath}`);
  console.log(
    `📋 Status Clip    : ${
      res.copied
        ? "✅ SUDAH TERSALIN KE CLIPBOARD! Langsung tekan Ctrl + V di AI tujuan."
        : "Silakan buka file .md di atas untuk copy manual."
    }`,
  );
  console.log("=======================================================================\n");

  if (res.copied) {
    try {
      await ToastBuilder.create(`Digest (${sizeKb} KB) siap di Clipboard! Langsung Ctrl+V ✅`)
        .setTitle("Tubes Prompter")
        .setAppName("Tubes AI Digester")
        .show();
    } catch {}
  }
}

main();
