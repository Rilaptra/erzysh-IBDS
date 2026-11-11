#!/usr/bin/env bun
/**
 * @file digest-custom-box-prompt.ts
 * @description Bun TypeScript prompt & code digest generator for implementing:
 * Parametric Custom BOX Hollow Section Iterator & Generator (SNI 1729:2020)
 * - Dimension interval iteration (default 50 mm for H and B)
 * - Wall thickness range (default t_min = 20 mm to t_max = 35 mm)
 * - Configurable / optional custom min/max bounds and step intervals
 * - Seamless integration into SteelDesignParametersForm, SteelSectionOptimizer, Store, and UI
 */

import { mkdir } from "node:fs/promises";
import { extname, join } from "node:path";

/**
 * Target files relevant for the Custom Box Hollow Parametric Optimizer feature.
 */
export const TARGET_FILES: readonly string[] = [
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

/**
 * Computes an adaptive backtick fence strictly longer than any backtick sequence in `text`.
 */
function fenceFor(text: string): string {
  let max = 2;
  for (const match of text.matchAll(/`+/g)) {
    if (match[0].length > max) {
      max = match[0].length;
    }
  }
  return "`".repeat(Math.max(3, max + 1));
}

/**
 * Builds an ASCII directory tree from a list of relative file paths.
 */
function buildTreeFromPaths(relPaths: readonly string[]): string[] {
  type TreeNode = { dirs: Map<string, TreeNode>; files: string[] };
  const root: TreeNode = { dirs: new Map(), files: [] };

  for (const rel of relPaths) {
    const parts = rel.split("/");
    const fileName = parts.pop();
    if (!fileName) continue;
    let cur = root;
    for (const part of parts) {
      if (!cur.dirs.has(part)) {
        cur.dirs.set(part, { dirs: new Map(), files: [] });
      }
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

/**
 * Generates the complete, rigorous engineering prompt.
 */
export function buildInstructionPrompt(): string {
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
    "---",
    "",
    "## ✅ Kriteria Verifikasi",
    "Setelah implementasi selesai, pastikan perintah berikut lulus 0 error:",
    "```bash",
    "bun check -b && bun test tests/steel\n```",
  ].join("\n");
}

async function copyToWindowsClipboard(text: string): Promise<boolean> {
  try {
    const proc = Bun.spawn(["clip"], {
      stdin: new TextEncoder().encode(text),
      stdout: "ignore",
      stderr: "ignore",
    });
    const exitCode = await proc.exited;
    return exitCode === 0;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const rootDir = process.cwd();
  const args = new Set(Bun.argv.slice(2));
  const promptOnly = args.has("--prompt-only") || args.has("-p");
  const noCopy = args.has("--no-copy");

  const outDir = join(rootDir, ".tmp-step-context");
  await mkdir(outDir, { recursive: true });

  const instructionPrompt = buildInstructionPrompt();
  const promptOnlyPath = join(outDir, "PROMPT_ONLY_CUSTOM_BOX.md");
  await Bun.write(promptOnlyPath, instructionPrompt);

  if (promptOnly) {
    const copied = noCopy ? false : await copyToWindowsClipboard(instructionPrompt);
    console.log("\n✅ Berhasil membuat file PROMPT ONLY (tanpa isi kode):");
    console.log(`📄 File Prompt : ${promptOnlyPath}`);
    console.log(
      `📋 Clipboard   : ${
        copied
          ? "Tersalin otomatis ke Clipboard! (Tinggal Ctrl+V)"
          : "Gagal copy otomatis, silakan buka file di atas."
      }`,
    );
    return;
  }

  // Build full digest (Instruction Prompt + Structure Tree + Code Content)
  const treeLines = buildTreeFromPaths(TARGET_FILES);
  const codeBlocks: string[] = [];
  let totalBytes = 0;

  for (const relPath of TARGET_FILES) {
    const fullPath = join(rootDir, relPath);
    const file = Bun.file(fullPath);
    if (!(await file.exists())) {
      codeBlocks.push(`\n// --- ${relPath} (File not found) ---\n`);
      continue;
    }

    let text = await file.text();
    if (text.includes("\r")) {
      text = text.replace(/\r\n/g, "\n");
    }
    totalBytes += file.size;

    const fence = fenceFor(text);
    const lang = extname(relPath).replace(/^\./, "") || "ts";
    codeBlocks.push(`\n// --- ${relPath} ---\n${fence}${lang}\n${text}\n${fence}\n`);
  }

  const fullDigestMarkdown = [
    instructionPrompt,
    "",
    "---",
    "",
    "# 📦 PROJECT DIGEST (RELEVANT FILES FOR THIS TASK)",
    "",
    "## Structure",
    "```",
    ...treeLines,
    "```",
    "",
    "## Code Content",
    ...codeBlocks,
  ].join("\n");

  const fullDigestPath = join(outDir, "PROMPT_CUSTOM_BOX_HOLLOW.md");
  await Bun.write(fullDigestPath, fullDigestMarkdown);

  const copied = noCopy ? false : await copyToWindowsClipboard(fullDigestMarkdown);
  const sizeKb = (totalBytes / 1024).toFixed(1);
  const estTokens = Math.round(fullDigestMarkdown.length / 4).toLocaleString("en-US");

  console.log("=======================================================================");
  console.log("⚡ BUN AI PROMPT & DIGEST GENERATOR — CUSTOM PARAMETRIC BOX HOLLOW");
  console.log("=======================================================================");
  console.log(`📂 Total File Terkait : ${TARGET_FILES.length} files (${sizeKb} KB kode)`);
  console.log(`🧮 Estimasi Token     : ~${estTokens} tokens (Sangat hemat & fokus!)`);
  console.log(`📄 Full Prompt + Kode : ${fullDigestPath}`);
  console.log(`📝 Prompt Saja        : ${promptOnlyPath}`);
  console.log(
    `📋 Status Clipboard   : ${
      copied
        ? "✅ SUDAH TERSALIN KE CLIPBOARD! Langsung tekan Ctrl+V di AI tujuan."
        : "Silakan buka file .md di atas untuk copy manual."
    }`,
  );
  console.log("-----------------------------------------------------------------------");
  console.log("💡 Opsi Penggunaan dengan CLI `digest` kamu:");
  console.log("   1. Ketik `digest` -> Pilih `Full Scan` (prompter.config.json sudah");
  console.log("      disesuaikan untuk file-file ini).");
  console.log("   2. Atau jalankan one-liner `digest`:");
  console.log(`      digest ${TARGET_FILES.join(" ")}`);
  console.log("=======================================================================\n");
}

main();
