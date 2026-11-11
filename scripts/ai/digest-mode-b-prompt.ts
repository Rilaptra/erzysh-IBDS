#!/usr/bin/env bun
/**
 * @file digest-mode-b-prompt.ts
 * @description Repo-specific Bun TypeScript prompt & code digest generator for fixing
 * Mode B (Direct Factored Internal Forces / Input Gaya Dalam), Steel Section Optimization,
 * 3D/2D Viewport synchronization, Confirmation/Submit button, and UI status/error notifications.
 *
 * Compatible with the user's `digest` CLI workflow (`prompter.config.json`) and also
 * works standalone to produce a ready-to-paste Markdown prompt (+ auto-copy to clipboard).
 */

import { mkdir } from "node:fs/promises";
import { extname, join } from "node:path";

/**
 * Target files required for another AI model to completely understand and fix the Mode B
 * & Steel Profile issues in one shot without missing any types or state actions.
 */
export const TARGET_FILES: readonly string[] = [
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

/**
 * Computes an adaptive backtick fence strictly longer than any backtick sequence inside `text`.
 * Matches the `fenceFor` logic from `C:\SHEVA\Project\digester\src\commands\scan.ts`.
 *
 * @param text Raw file content string.
 * @returns Backtick fence string (minimum 3 backticks).
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
 *
 * @param relPaths Relative file paths using forward slashes.
 * @returns Array of formatted tree lines.
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
 * Generates the comprehensive engineering prompt instructing an AI assistant how to fix
 * all Mode B (Direct Internal Forces) and Steel Profile responsiveness issues.
 */
export function buildInstructionPrompt(): string {
  return [
    "# 🛠️ TASK: Perbaiki Responsivitas Input Gaya Dalam (Mode B), Optimasi Profil Baja, Visual 3D/2D, Tombol Submit, & Notifikasi Status/Error",
    "",
    "Kamu adalah Senior Structural Engineering & Full-Stack TypeScript/Bun Developer yang menangani repositori **Interactive Beam Deflection & Structural Design Simulator (SNI 2847:2019 & SNI 1729:2020)**.",
    "",
    "## 🚨 Gejala Masalah Saat Ini (Keluhan User)",
    "Saat user menggunakan fitur **Input Gaya Dalam (Mode B / `MODE_B_DIRECT_INTERNAL_FORCES`)**:",
    '1. **Terasa tidak ada respon apa-apa:** Kanvas 3D tiba-tiba kosong (*"Menunggu hasil solver mekanika WASM…"*), tumpuan 2D hilang, dan diagram gaya dalam (BMD/SFD/NFD) hilang.',
    "2. **Profil baja tidak berubah** meskipun user sudah menginput beberapa kombinasi gaya dalam (atau ketika beban diperbesar melampaui kapasitas katalog, profil lama membeku tanpa perubahan; serta gambar 2D/3D penampang baja tidak berubah ukurannya).",
    "3. **Tidak ada tombol Konfirmasi / Submit / Hitung** di form Input Gaya Dalam, dan saat mengetik angka (misal menghapus digit untuk mengetik angka baru) input langsung ter-reset ke `0` atau `1`.",
    "4. **Tidak ada pemberitahuan / notifikasi / pesan error** sama sekali baik saat perhitungan berhasil diperbarui maupun saat solver gagal (`solverError` ditelan diam-diam).",
    "",
    "---",
    "",
    "## 🔍 Root Cause Analysis (Hasil Audit Kode)",
    "",
    "### Bug 1: `meshViews`, `rebarCageViews`, dan `stationViews` Di-set `null` di Mode B (`src/hooks/use-structural-solver-engine.ts`)",
    "- Pada `use-structural-solver-engine.ts` baris 180–213 (blok `else` untuk Mode B):",
    "  - Pemanggilan `interpolateModeBInternalForces(...)` **tidak menyertakan** parameter `crossSection`, `visualScale: 15.0`, maupun `coordinateMode: store.coordinateMode`.",
    "  - Di baris 210–212, kode justru memanggil `setMeshViews(null)`, `setRebarCageViews(null)`, dan `setStationViews(null)`.",
    "  - Padahal fungsi `interpolateModeBInternalForces` di `src/core/mechanics/direct-internal-force-interpolator.ts` (baris 184–255) **sudah mendukung penuh** pembuatan `mesh3D`, `rebarCage3D`, dan 256 titik stasiun diagram (`getZeroCopyStationViews()`).",
    "  - Selain itu, pada `DesktopWorkstationView.tsx` (baris 463–470), Jendela 5 (`INTERNAL_FORCE_DIAGRAMS`) menampilkan pesan kosong jika `stationViews` bernilai `null`. Ketika `stationViews` diisi dari Mode B, diagram BMD/SFD/NFD akan langsung tampil di Mode B.",
    "",
    "### Bug 2: `Muy` Di-hardcode `0` & `Lb` Memakai `activeSpanM` (`src/hooks/use-structural-solver-engine.ts`)",
    "- Pada `GoverningInternalForces` (`src/state/beam-simulator-store.ts`), belum ada field `absoluteMaxMuy`.",
    "- Pada `use-structural-solver-engine.ts` baris 238–249, pemanggilan `optimizeSteelSection` meng-hardcode:",
    "  - `factoredMomentMuy: kilonewtonMeter(0)` (mengabaikan `store.directMomentMuyKnm` dari `DirectInternalForcesForm.tsx`).",
    "  - `unbracedLengthLbM: meter(activeSpanM)` (mengabaikan `store.steelUnbracedLengthLbM` yang diatur user di `SteelDesignParametersForm.tsx`).",
    "",
    "### Bug 3: Dimensi Primer (`H`, `B`, `tw`, `tf`, `r`, `t`) Hilang dari `SteelSectionProperties` & Penampang 2D/3D Statis",
    "- Pada `src/types/steel-sni1729-types.ts` dan `src/core/steel/iwf-geometric-properties.ts`, fungsi `computeIwfSectionProperties` dan `computeBoxSectionProperties` tidak menyertakan dimensi primer (`H`, `B`, `tw`, `tf`, `r`, `t`) pada objek return `SteelSectionProperties`.",
    "- Akibatnya:",
    "  1. Di `SteelOptimizationRankingTable.tsx` (baris 86–110), `webThicknessTw`, `flangeThicknessTf`, dan `boxThicknessT` selalu jatuh ke angka fallback `8` dan `12`. Ditambah lagi `SteelProfileCrossSectionSvg.tsx` men-scale `maxDim` agar selalu memenuhi kotak SVG yang sama tanpa menampilkan label tebal `tw` dan `tf`.",
    "  2. Di `use-structural-solver-engine.ts` (baris 79 & 118–136), momen inersia baja di-hardcode `I_Mm4 = 100_000_000` dan ukuran penampang ekstrusi 3D baja di-hardcode (`dMm: 300, bfMm: 150, twMm: 6.5, tfMm: 9.0` untuk IWF dan `200x200x8` untuk BOX) karena solver mekanika dijalankan *sebelum* `optimizeSteelSection`!",
    "",
    "### Bug 4: Urutan Eksekusi Solver & Prioritas Sorting Kandidat Baja (`src/core/steel/steel-section-optimizer.ts`)",
    "- Di `use-structural-solver-engine.ts`, sebaiknya tentukan `govForces` terlebih dahulu (atau jalankan optimasi penampang baja/beton), lalu gunakan dimensi & momen inersia (`Ix`) dari profil hasil optimasi (`steelOptResult.bestCandidate.properties` atau profil pilihan user `store.selectedSteelProfileName`) untuk menjalankan `solveEulerBernoulliDeflection` (Mode A) / `interpolateModeBInternalForces` (Mode B) sehingga lendutan dan balok 3D benar-benar merepresentasikan profil baja yang terpilih!",
    '- Di `steel-section-optimizer.ts` (baris 259 & 275–283), sorting memprioritaskan `status === "OPTIMAL"` (`0.90 <= DCR <= 1.00`) secara mutlak di atas berat (`unitWeightKgPerM`). Jika profil ringan memiliki `DCR = 0.82` (`ACCEPTABLE`) sedangkan profil yang jauh lebih berat memiliki `DCR = 0.92` (`OPTIMAL` karena LTB), profil berat malah menang. Perbaiki agar kandidat yang lulus (`governingDcrValue <= 1.0 && deflectionCompliant`) selalu diurutkan berdasarkan **berat paling ringan (`unitWeightKgPerM` ascending)** sebagai kriteria utama, sementara label `OPTIMAL` tetap diberikan untuk informasi efisiensi.',
    "",
    "### Bug 5: Silent Error (`solverError` Tidak Ditampilkan), Tidak Ada Tombol Konfirmasi/Submit, & Mode B di Mobile",
    '- Di `DirectInternalForcesForm.tsx`:Tidak ada state draft lokal (menghapus angka langsung menjadi `0`/`1`), tidak ada pilihan orientasi tumpuan (`supportOrientation`), tidak ada tombol **"Terapkan & Hitung Gaya Dalam"**, dan tidak ada pemberitahuan status hasil kalkulasi / error.',
    "- Di `beam-simulator-store.ts` (`setSolverError`): Ketika `optimizeSteelSection` melempar `SteelDesignError` (misal beban melebihi kapasitas maksimum katalog), `solverError` di-set tetapi tidak pernah ditampilkan di UI manapun, dan `steelOptimizationResult` lama tetap tertinggal sehingga user mengira profil baja tidak merespon.",
    '- Di `AndroidCompanionView.tsx`: Saat user membuka tab `INPUT` ("Gaya Dalam"), `store.loadingMode` masih berada di `"MODE_A_EXTERNAL_LOADS"` sehingga input Mode B diabaikan.',
    "",
    "---",
    "",
    "## ✅ Spesifikasi Perbaikan yang Wajib Kamu Implementasikan",
    "",
    "1. **Simpan Dimensi Primer pada `SteelSectionProperties` (`src/types/steel-sni1729-types.ts` & `src/core/steel/iwf-geometric-properties.ts`):**",
    "   - Tambahkan properti `H: Millimeter`, `B: Millimeter`, `tw: Millimeter`, `tf: Millimeter`, `r?: Millimeter`, dan `t?: Millimeter` pada `SteelSectionProperties`.",
    "   - Pada `computeIwfSectionProperties`, kembalikan `H: millimeter(H)`, `B: millimeter(B)`, `tw: millimeter(tw)`, `tf: millimeter(tf)`, `r: millimeter(r)`.",
    "   - Pada `computeBoxSectionProperties`, kembalikan `H: millimeter(H)`, `B: millimeter(B)`, `tw: millimeter(t)`, `tf: millimeter(t)`, `t: millimeter(t)`.",
    "",
    "2. **Perbaiki `GoverningInternalForces` & `beam-simulator-store.ts` (`src/state/beam-simulator-store.ts`):**",
    "   - Tambahkan `readonly absoluteMaxMuy: number;` pada interface `GoverningInternalForces` (inisialisasi dengan `0` di `INITIAL_STATE`).",
    '   - Pastikan ketika `setDirectForces` dipanggil, jika `currentState.loadingMode !== "MODE_B_DIRECT_INTERNAL_FORCES"`, otomatis aktifkan `loadingMode: "MODE_B_DIRECT_INTERNAL_FORCES"` agar input gaya dalam selalu langsung direspon oleh solver.',
    "   - Pada `setSolverError(error: string)`, pertahankan error message yang jelas agar dapat ditampilkan oleh komponen UI.",
    "",
    "3. **Perbaiki Alur `useStructuralSolverEngine` (`src/hooks/use-structural-solver-engine.ts`):**",
    "   - Untuk **Mode B (`!isModeA`)**:",
    "     - Hitung `govForces` terlebih dahulu dari input Mode B (termasuk `absoluteMaxMuy: Math.abs(Number(store.directMomentMuyKnm))`).",
    "     - Jalankan optimasi penampang (`optimizeSteelSection` / `optimizeConcreteSection`) terlebih dahulu menggunakan `govForces` dan `unbracedLengthLbM: meter(Number(store.steelUnbracedLengthLbM) || activeSpanM)` serta `spanLengthM: meter(activeSpanM)`.",
    "     - Jika user memilih profil manual dari tabel (`store.selectedSteelProfileName`), gunakan kandidat tersebut sebagai profil aktif; jika tidak, gunakan `steelOptResult.bestCandidate`.",
    "     - Gunakan `Ix` dan dimensi asli (`H`, `B`, `tw`, `tf`, `r`, `t`) dari profil baja aktif tersebut untuk membentuk `I_Mm4` dan `crossSection` (`ExtrusionCrossSectionInput`).",
    "     - Panggil `interpolateModeBInternalForces` **dengan menyertakan** `crossSection`, `visualScale: 15.0`, `coordinateMode: store.coordinateMode`, dan `deflectionLimitKey`.",
    "     - Set `setMeshViews(modeBRes.mesh3D)`, `setRebarCageViews(modeBRes.rebarCage3D)`, dan `setStationViews(getZeroCopyStationViews())` (**JANGAN di-set `null`!**).",
    "   - Untuk **Mode A (`isModeA`)**:",
    "     - Setelah mendapatkan `govForces` dan menjalankan `optimizeSteelSection`, bangun ulang 3D mesh / defleksi menggunakan dimensi dan `Ix` dari profil baja hasil optimasi (`bestCandidate`) sehingga balok 3D dan lendutan di Mode A juga berubah mengikuti profil baja terpilih.",
    "",
    "4. **Perbaiki Sorting Kandidat di `optimizeSteelSection` (`src/core/steel/steel-section-optimizer.ts`):**",
    "   - Tetap evaluasi seluruh kandidat yang memenuhi `governingDcrValue <= 1.0 && deflectionCompliant`.",
    '   - Tandai `status = "OPTIMAL"` jika `governingDcrValue >= targetMinDcr && governingDcrValue <= 1.0`, atau jika kandidat tersebut adalah kandidat **paling ringan** yang memenuhi syarat (`compliantCandidates` pertama setelah diurutkan berdasarkan berat).',
    "   - Urutkan `compliantCandidates` berdasarkan **`unitWeightKgPerM` ascending** (paling ringan & ekonomis di urutan pertama; jika berat sama, pilih `governingDcr` yang lebih tinggi/mendekati 1.0). Dengan demikian, setiap kali gaya dalam (`Mux`, `Muy`, `Vu`, `Pu`, `Tu`) berubah melampaui kapasitas suatu profil, `bestCandidate` dijamin berganti secara responsif dan deterministik.",
    "",
    "5. **Upgrade `DirectInternalForcesForm.tsx` dengan State Draft, Tombol Konfirmasi/Submit, & Banner Pemberitahuan (`src/components/forms/DirectInternalForcesForm.tsx`):**",
    "   - Gunakan state draft string lokal untuk setiap input (`L`, `Mux`, `Vu`, `Pu`, `Muy`, `Tu`) agar user bisa menghapus angka / mengetik tanda minus (`-`) atau desimal dengan leluasa tanpa ter-reset paksa ke `0` di tengah pengetikan.",
    '   - Tetap dukung pembaruan reaktif saat nilai angka valid berubah, **DAN** tambahkan `<form onSubmit={...}>` dengan tombol konfirmasi eksplisit **"⚡ Hitung & Terapkan Gaya Dalam"** (beserta tombol **Reset Default**).',
    '   - Saat tombol **"⚡ Hitung & Terapkan Gaya Dalam"** ditekan:',
    "     - Commit seluruh nilai draft ke `beamSimulatorActions.setDirectForces(...)` dan pastikan `loadingMode` adalah `MODE_B_DIRECT_INTERNAL_FORCES`.",
    '     - Buka otomatis Jendela 4 (`floatingWindowActions.openWindow("OPTIMIZATION_RESULTS")`) jika di Desktop agar user langsung melihat hasilnya.',
    "     - Tampilkan **Banner Pemberitahuan / Konfirmasi** di dalam form yang memuat ringkasan hasil secara jelas:",
    "       - Jika sukses (Baja): tampilkan nama **Profil Baja Terpilih** (misal `WF 300 x 150 x 36.7`), **DCR (%)**, **Lendutan Maks (`-Δ_max` mm)**, dan waktu update.",
    "       - Jika sukses (Beton): tampilkan dimensi beton `bw x h`, tulangan pokok, sengkang, dan lendutan.",
    '       - Jika gagal (`store.solverError` ada): tampilkan `<Alert variant="destructive">` yang jelas menjelaskan alasan kegagalan (misal beban melebihi profil terbesar di katalog) dan saran tindakan (naikkan mutu baja ke BJ 50/55 atau kurangi bentang/beban).',
    "",
    "6. **Perbaiki Visual 2D SVG & Tabel Peringkat Baja (`SteelOptimizationRankingTable.tsx` & `SteelProfileCrossSectionSvg.tsx`):**",
    '   - Pada `SteelOptimizationRankingTable.tsx`, tampilkan `<Alert variant="destructive">` jika `store.solverError` bernilai non-null agar user langsung tahu jika beban melebihi kapasitas katalog.',
    "   - Kirim dimensi asli `bestCandidate.properties.H`, `B`, `tw`, `tf`, `t`, `r` ke `<SteelProfileCrossSectionSvg />`.",
    '   - Izinkan user meng-klik baris pada tabel "Peringkat Profil Alternatif" untuk memilih profil tersebut (`beamSimulatorActions.setSteelParameters({ selectedProfileName: c.properties.name })`) lengkap dengan indikator baris yang aktif.',
    "   - Pada `SteelProfileCrossSectionSvg.tsx`, tampilkan juga anotasi teks `tw` & `tf` (untuk IWF) atau `t` (untuk BOX) agar perubahan dimensi ketebalan antar profil terlihat jelas secara visual.",
    "",
    "7. **Sinkronisasi `AndroidCompanionView.tsx`:**",
    '   - Saat user berpindah ke tab `INPUT` ("Gaya Dalam"), otomatis panggil `beamSimulatorActions.setLoadingMode("MODE_B_DIRECT_INTERNAL_FORCES")` agar input gaya dalam di tampilan mobile selalu aktif.',
    "",
    "---",
    "",
    "## 📜 Aturan Kualitas Kode & Verifikasi",
    "- Tulis **JSDoc lengkap** pada setiap fungsi/komponen yang dibuat atau dimodifikasi (deskripsi fungsi, `@param`, `@returns`, `@throws`, dan `@example`).",
    "- Tulis **error handling yang jelas** sehingga setiap error mudah di-traceback.",
    "- Jangan gunakan `any`; patuhi strict TypeScript dan Branded Units (`Kilonewton`, `KilonewtonMeter`, `Meter`, `Millimeter`).",
    "- Setelah selesai, pastikan perintah berikut lulus 0 error:",
    "  ```bash",
    "  bun check -b && bun test",
    "  ```",
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
  const promptOnlyPath = join(outDir, "PROMPT_ONLY_MODE_B.md");
  await Bun.write(promptOnlyPath, instructionPrompt);

  if (promptOnly) {
    const copied = noCopy ? false : await copyToWindowsClipboard(instructionPrompt);
    console.log("\n✅ Berhasil membuat file PROMPT ONLY (tanpa isi kode):");
    console.log(`📄 File Prompt : ${promptOnlyPath}`);
    console.log(
      `📋 Clipboard   : ${copied ? "Tersalin otomatis ke Clipboard! (Tinggal Ctrl+V)" : "Gagal copy otomatis, silakan buka file di atas."}`,
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

  const fullDigestPath = join(outDir, "PROMPT_FIX_MODE_B_GAYA_DALAM.md");
  await Bun.write(fullDigestPath, fullDigestMarkdown);

  const copied = noCopy ? false : await copyToWindowsClipboard(fullDigestMarkdown);
  const sizeKb = (totalBytes / 1024).toFixed(1);
  const estTokens = Math.round(fullDigestMarkdown.length / 4).toLocaleString("en-US");

  console.log("=======================================================================");
  console.log("⚡ BUN AI PROMPT & DIGEST GENERATOR — FIX MODE B (GAYA DALAM)");
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
  console.log("   1. Langsung ketik `digest` -> Pilih `Full Scan` (prompter.config.json");
  console.log("      sudah dikonfigurasi otomatis hanya mengambil 15 file di atas!).");
  console.log("   2. Atau ketik `digest` -> Pilih `🤖 AI Copilot` -> Pilih `Config Only`");
  console.log("      -> Masukkan keyword: `DirectInternalForcesForm Mode B steel optimizer`");
  console.log("   3. Atau jalankan one-liner `digest` langsung:");
  console.log(`      digest ${TARGET_FILES.join(" ")}`);
  console.log("=======================================================================\n");
}

main();
