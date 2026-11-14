#!/usr/bin/env bun
/**
 * @file scripts/docs/generate-manual.ts
 * @description Generator Buku Panduan Pengguna 01 (24 Halaman 16:9) untuk erzysh-IBDS
 * menggunakan fitur native Bun v1.4.4 (`Bun.WebView` + CDP `Page.printToPDF`).
 *
 * Cara pakai:
 *   1. Jalankan server di terminal 1 : bun run dev (atau bun run start)
 *   2. Jalankan skrip di terminal 2  : bun run scripts/docs/generate-manual.ts
 *   Opsional: tambahkan flag `--dark` untuk tema Erzysh Dark Void, atau `--skip-capture`
 *   jika tangkapan layar sudah ada di `docs/screenshots/`.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { APP_VERSION, WASM_VERSION } from "../../src/config/version";

// ============================================================================
// Konfigurasi CLI & Path
// ============================================================================

const BASE_URL = process.env.DOCS_BASE_URL ?? "http://localhost:3000";
const OUT_DIR = resolve(process.cwd(), "docs");
const SCREENSHOT_DIR = resolve(OUT_DIR, "screenshots");
const HTML_OUT_PATH = resolve(OUT_DIR, "manual.html");
const PDF_OUT_PATH = resolve(OUT_DIR, "Panduan_01_IBDS.pdf");

const args = new Set(Bun.argv.slice(2));
const IS_DARK_THEME = args.has("--dark");
const SKIP_CAPTURE = args.has("--skip-capture");
const EDITION_DATE = "13 November 2026";

// ============================================================================
// Tipe Data Layout Halaman (Mengikuti Struktur PDF Referensi 16:9)
// ============================================================================

type PageSlide =
  | {
      readonly pageNumber: number;
      readonly type: "COVER";
      readonly title: string;
      readonly subtitle: string;
      readonly bullets: readonly string[];
    }
  | {
      readonly pageNumber: number;
      readonly type: "TOC";
      readonly title: string;
      readonly subtitle: string;
    }
  | {
      readonly pageNumber: number;
      readonly type: "TEXT_GRID";
      readonly title: string;
      readonly subtitle: string;
      readonly cards: ReadonlyArray<{
        readonly heading: string;
        readonly body: string;
      }>;
    }
  | {
      readonly pageNumber: number;
      readonly type: "SCREENSHOT";
      readonly title: string;
      readonly breadcrumb: string;
      readonly screenshotFile: string;
      readonly caption: string;
    }
  | {
      readonly pageNumber: number;
      readonly type: "TABLE";
      readonly title: string;
      readonly subtitle: string;
      readonly headers: readonly [string, string, string];
      readonly rows: ReadonlyArray<readonly [string, string, string]>;
    };

// ============================================================================
// Definisi 24 Halaman Buku Panduan Pengguna erzysh-IBDS
// ============================================================================

const MANUAL_PAGES: readonly PageSlide[] = [
  {
    pageNumber: 1,
    type: "COVER",
    title: "Simulasi balok 3D, optimasi SNI\ndan asisten rekayasa AI",
    subtitle: "PANDUAN PENGGUNA 01 — INTERACTIVE BEAM DEFLECTION SIMULATOR (IBDS)",
    bullets: [
      "Dari pemodelan beban eksternal dan gaya dalam sampai ekspor gambar kerja CAD/BIM.",
      "Langkah demi langkah dengan tangkapan layar workstation 3D dan mobile companion.",
      `Mengacu standar beton bertulang SNI 2847:2019 dan baja struktural SNI 1729:2020 (Engine v${APP_VERSION} / WASM v${WASM_VERSION}).`,
    ],
  },
  {
    pageNumber: 2,
    type: "TOC",
    title: "Daftar isi",
    subtitle:
      "Klik judul untuk membuka halaman. Gunakan pembesaran PDF untuk membaca detail parameter.",
  },
  {
    pageNumber: 3,
    type: "TEXT_GRID",
    title: "Cara memakai buku ini",
    subtitle: "Langkah penggunaan dan penjelasan praktis",
    cards: [
      {
        heading: "Untuk siapa?",
        body: "Mahasiswa teknik sipil, dosen, dan perencana struktur yang ingin menyimulasikan lendutan balok 3D, mengecek kapasitas penampang SNI, serta mengekspor model ke perangkat lunak CAD/BIM/CAE.",
      },
      {
        heading: "Urutan yang disarankan",
        body: "Pilih material & paradigma beban (Window 1) → masukkan beban atau gaya dalam (Window 2) → atur mutu & dimensi (Window 3) → tinjau optimasi SNI (Window 4) → ekspor laporan atau model.",
      },
      {
        heading: "Dua paradigma pembebanan",
        body: "Mode A (Beban Eksternal) menghitung reaksi, diagram gaya dalam, dan kurva elastis dari beban titik P serta beban merata q. Mode B (Gaya Dalam) mengoptimasi penampang langsung dari input Mux, Vu, Pu, Muy, dan Tu.",
      },
      {
        heading: "Tentang tangkapan layar",
        body: "Gambar menampilkan antarmuka Desktop Workstation dan Android Companion pada pengujian lokal. Pada penggunaan nyata buka aplikasi melalui https://erzysh-ibds.vercel.app.",
      },
      {
        heading: "Istilah penting",
        body: "ULS adalah kondisi batas kekuatan terfaktor. SLS adalah kondisi batas layan lendutan. DCR (Demand-to-Capacity Ratio) adalah rasio beban terhadap kapasitas; nilai ≤ 1,00 berarti penampang memenuhi syarat.",
      },
    ],
  },
  {
    pageNumber: 4,
    type: "TEXT_GRID",
    title: "Privasi & arsitektur komputasi lokal",
    subtitle: "Pemrosesan WASM di browser, izin perangkat, dan layanan AI",
    cards: [
      {
        heading: "Solver mekanika berjalan 100% lokal",
        body: "Perhitungan matriks kekakuan Euler-Bernoulli, pembuatan mesh 3D, dan evaluasi kapasitas SNI 2847/1729 dieksekusi di memori browser melalui Rust WebAssembly (zero-copy Float32Array) tanpa mengirim model ke server.",
      },
      {
        heading: "Kamera gestur tangan (MediaPipe)",
        body: "Saat fitur Cam Tracking diaktifkan di Window 6, umpan video webcam diproses secara lokal di perangkat Anda untuk mendeteksi 21 titik sendi jari. Rekaman kamera tidak pernah disimpan atau diunggah.",
      },
      {
        heading: "Perintah suara & asisten AI Ucuy",
        body: "Pencocokan perintah cepat berjalan secara deterministik di lokal (0 ms). Jika Anda mengajukan konsultasi terbuka kepada asisten AI Ucuy, transkrip dan ringkasan parameter balok dikirim ke endpoint Gemini API.",
      },
      {
        heading: "Telemetri pengunjung anonim",
        body: "Lencana jumlah pengunjung di kanan atas hanya mencatat hitungan sesi agregat melalui Google Analytics 4 (GA4) dengan cache in-memory 15 menit tanpa mengumpulkan identitas pribadi.",
      },
      {
        heading: "Kendali yang dapat Anda lakukan",
        body: "Gunakan tombol Mute pada panel suara dan tombol Stop Cam pada Window 6 kapan saja untuk mematikan akses mikrofon serta kamera. Simpan berkas ekspor DXF/IFC/S2K/PDF di penyimpanan aman.",
      },
    ],
  },
  {
    pageNumber: 5,
    type: "SCREENSHOT",
    title: "Beranda dan mulai simulasi",
    breadcrumb:
      "Buka erzysh-ibds.vercel.app → klik Mulai Simulasi atau pilih kartu Mode A / Mode B.",
    screenshotFile: "01-landing.png",
    caption:
      "Halaman beranda menampilkan versi aplikasi, mesin WASM, standar acuan SNI, serta pintasan langsung menuju Mode A (Beban Eksternal) dan Mode B (Gaya Dalam SNI).",
  },
  {
    pageNumber: 6,
    type: "SCREENSHOT",
    title: "Kenali Desktop Workstation & Quick Dock",
    breadcrumb: "Simulator → Top Workstation Bar (Tombol 1. Material s/d 6. AI & Gestur).",
    screenshotFile: "02-desktop-steel.png",
    caption:
      "Layar utama menggabungkan kanvas 3D WebGL2, simbol tumpuan 2D, legenda warna lendutan di kanan, kartu status lendutan di kiri bawah, serta 6 jendela kerja melayang yang dapat digeser bebas.",
  },
  {
    pageNumber: 7,
    type: "TABLE",
    title: "Pilih konfigurasi tumpuan & batas lendutan",
    subtitle: "Sesuaikan kondisi batas perletakan dan syarat kelayanan SLS dengan fungsi balok",
    headers: ["Kategori Parameter", "Opsi yang Tersedia di IBDS", "Catatan Rekayasa & Penggunaan"],
    rows: [
      [
        "Balok Sederhana (Simple Beam)",
        "Sendi — Rol (PINNED_ROLLER) / Rol — Sendi",
        "Tumpuan statis tertentu standar untuk balok anak atau gelagar jembatan bentang tunggal.",
      ],
      [
        "Balok Kantilever (Cantilever)",
        "Jepit Kiri — Bebas / Bebas — Jepit Kanan",
        "Ujung bebas mengalami lendutan maksimum; perhatikan penulangan tarik di serat atas tumpuan.",
      ],
      [
        "Balok Statis Tak Tentu",
        "Jepit — Jepit, Jepit — Rol, Jepit — Sendi",
        "Menghasilkan momen negatif di tumpuan dan mereduksi lendutan tengah bentang secara signifikan.",
      ],
      [
        "Batas Lendutan L/180 & L/240",
        "Denominator 180 atau 240",
        "Untuk balok atap datar atau elemen struktur yang tidak menahan plafon/partisi rentan retak.",
      ],
      [
        "Batas Lendutan L/360 & L/480",
        "Denominator 360 (Default) atau 480",
        "Standar SNI 2847 Tabel 24.2.2 untuk balok lantai (L/360) dan elemen penumpu partisi getas (L/480).",
      ],
    ],
  },
  {
    pageNumber: 8,
    type: "SCREENSHOT",
    title: "Mode A: Susun beban eksternal secara interaktif",
    breadcrumb: "Quick Dock → 2. Beban → Mode A: Beban Eksternal.",
    screenshotFile: "03-mode-a-loads.png",
    caption:
      "Atur panjang bentang L (1–24 m) dengan slider, pilih tumpuan, lalu tambahkan beban titik terpusat P (kN) beserta posisi x (m) dan beban merata q (kN/m). Kurva 3D diperbarui seketika.",
  },
  {
    pageNumber: 9,
    type: "SCREENSHOT",
    title: "Mode B: Input gaya dalam terfaktor langsung",
    breadcrumb:
      "Quick Dock → 1. Material (Pilih Mode B) → 2. Beban → ⚡ Hitung & Terapkan Gaya Dalam.",
    screenshotFile: "04-mode-b-direct.png",
    caption:
      "Cocok bila Anda sudah memiliki output analisis struktur (SAP2000/ETABS). Masukkan nilai Mux, Vu, Pu, Muy, dan Tu lalu tekan tombol konfirmasi untuk mencari penampang optimal.",
  },
  {
    pageNumber: 10,
    type: "SCREENSHOT",
    title: "Parameter desain baja struktural (SNI 1729:2020)",
    breadcrumb: "Quick Dock → 1. Material (Baja) → 3. Parameter.",
    screenshotFile: "05-steel-params.png",
    caption:
      "Pilih tipe profil (IWF/H-Beam atau BOX/Hollow HSS), mutu baja (BJ 34 s/d BJ 55), panjang tak terkekang lateral Lb untuk evaluasi tekuk torsi lateral (LTB), serta batas tinggi/lebar.",
  },
  {
    pageNumber: 11,
    type: "TEXT_GRID",
    title: "Generator parametrik BOX hollow custom",
    subtitle: "Eksplorasi penampang baja berongga di luar katalog standar JIS G 3466",
    cards: [
      {
        heading: "Kapan fitur ini diperlukan?",
        body: "Ketika beban lentur atau puntir (torsi Tu) pada jembatan/struktur bentang panjang melampaui kapasitas profil BOX standar pabrikan dan membutuhkan profil box tersusun (built-up plate).",
      },
      {
        heading: "Aktifkan generator custom",
        body: "Pada Window 3 (Parameter Baja), pilih tipe BOX / Hollow HSS, lalu centang kotak ⚡ Gunakan Generator Parametrik Custom (Interval 50 mm & Tebal 20–35 mm).",
      },
      {
        heading: "Aturan geometri & rentang",
        body: "Pilih aturan bentuk: Semua, Persegi (H=B), atau Persegi Panjang. Tentukan rentang tinggi Hmin–Hmax dan lebar Bmin–Bmax (default 200–600 mm dengan langkah 50 mm).",
      },
      {
        heading: "Variasi tebal pelat dinding",
        body: "Atur ketebalan dinding t dari 20 mm hingga 35 mm (langkah 5 mm). Aplikasi menampilkan badge jumlah variasi penampang yang diuji secara real-time oleh solver SNI 1729.",
      },
      {
        heading: "Evaluasi kekompakan & torsi",
        body: "Setiap kandidat custom dievaluasi terhadap rasio kelangsingan pelat (kompak/non-kompak/langsing), interaksi biaxial Bab H, serta geser-torsi gabungan sebelum diurutkan berdasarkan berat teringan.",
      },
    ],
  },
  {
    pageNumber: 12,
    type: "SCREENSHOT",
    title: "Tinjau peringkat optimasi profil baja",
    breadcrumb: "Quick Dock → 4. Optimasi → Tabel Peringkat Profil Baja & Gambar Potongan 2D.",
    screenshotFile: "06-steel-results.png",
    caption:
      "Window 4 menampilkan penampang paling ekonomis beserta nilai DCR, kapasitas φMn, φVn, berat per meter (kg/m), dan gambar teknis potongan melintang lengkap dengan dimensi H, B, tw, dan tf.",
  },
  {
    pageNumber: 13,
    type: "SCREENSHOT",
    title: "Parameter beton bertulang (SNI 2847:2019)",
    breadcrumb: "Quick Dock → 1. Material (Beton) → 3. Parameter.",
    screenshotFile: "07-concrete-params.png",
    caption:
      "Masukkan kuat tekan silinder fc' (MPa) atau konversi otomatis dari mutu kubus (K-175 s/d K-500). Atur lebar bw, tinggi h, tebal selimut bersih dc, serta mutu baja tulangan pokok dan sengkang (BJTP/BJTS).",
  },
  {
    pageNumber: 14,
    type: "SCREENSHOT",
    title: "Visualisasi 3D beton: Solid vs Wireframe tulangan",
    breadcrumb: "Toolbar Kamera Atas → klik Solid + Potongan atau Wireframe Tulangan.",
    screenshotFile: "08-concrete-wireframe.png",
    caption:
      "Mode Solid + Potongan menampilkan balok beton utuh dengan gambar detail penampang di ujung balok. Mode Wireframe Tulangan membuat selubung beton transparan (opasitas 18%) sehingga rakitan tulangan pokok dan cincin sengkang 3D terlihat jelas.",
  },
  {
    pageNumber: 15,
    type: "TEXT_GRID",
    title: "Kontrol viewport 3D, kamera, dan sumbu koordinat",
    subtitle: "Navigasi orbit, proyeksi ortografis 2D, dan konvensi sumbu rekayasa",
    cards: [
      {
        heading: "Navigasi mouse & layar sentuh",
        body: "Seret klik-kiri untuk memutar orbit 3D, seret klik-kanan/tengah (atau Shift + klik-kiri) untuk menggeser (pan), dan putar roda mouse atau cubit dua jari untuk memperbesar/memperkecil.",
      },
      {
        heading: "Preset 3D Isometrik & Tampak Depan",
        body: "Gunakan toolbar atas atau tekan tombol angka 3 untuk perspektif 3D Isometrik dan angka 1 untuk proyeksi ortografis Tampak Depan 2D yang sejajar 1:1 dengan simbol tumpuan.",
      },
      {
        heading: "Pusatkan kamera otomatis (Fit)",
        body: "Klik tombol Fit pada toolbar atas, tekan tombol F di keyboard, atau klik ganda pada kanvas untuk memusatkan kembali seluruh bentang balok ke tengah layar.",
      },
      {
        heading: "Konvensi sumbu Z-Up vs Y-Up",
        body: "Gunakan kartu gizmo di kanan bawah untuk beralih antara Z-Up (standar teknik sipil SAP2000, ETABS, Revit, AutoCAD) dan Y-Up (standar grafika WebGL & SolidWorks).",
      },
      {
        heading: "Membaca HUD & colorbar lendutan",
        body: "Legenda vertikal di tepi kanan memetakan warna kontur SAP2000 dari 0,00 mm (biru) hingga -Δmaks (merah). Kartu kiri bawah merangkum nilai lendutan maksimum, posisi x, dan status AMAN/NG.",
      },
    ],
  },
  {
    pageNumber: 16,
    type: "SCREENSHOT",
    title: "Baca diagram gaya dalam (BMD, SFD, NFD, TFD)",
    breadcrumb: "Quick Dock → 1. Material (Mode Tampilan Diagram 2D) & 5. Diagram.",
    screenshotFile: "09-diagrams-window.png",
    caption:
      "Pilih 3 mode penempatan diagram: Mode 1 (Bertumpuk di As Balok), Mode 2 (Sejajar Vertikal di Bawah Balok), atau Mode 3 (Jendela Khusus Window 5). Centang visibilitas SFD, BMD, NFD, dan TFD sesuai kebutuhan.",
  },
  {
    pageNumber: 17,
    type: "SCREENSHOT",
    title: "Konsultan AI 'Ucuy' & perintah suara hands-free",
    breadcrumb: "Quick Dock → 6. AI & Gestur → Panel Consultant AI & Toast Mikrofon Bawah.",
    screenshotFile: "10-ai-assistant.png",
    caption:
      "Klik pil Quick Prompt (seperti 'Bandingkan IWF vs BOX' atau 'Rekomendasi tulangan geser') atau ketik pertanyaan teknis. Untuk perintah suara, ucapkan wake-word 'Halo Ucuy' atau tepuk tangan 2 kali (double-clap).",
  },
  {
    pageNumber: 18,
    type: "TEXT_GRID",
    title: "Kontrol gestur tangan webcam (MediaPipe)",
    subtitle: "Interaksi tanpa menyentuh mouse menggunakan pelacakan tangan real-time",
    cards: [
      {
        heading: "Cara mengaktifkan kamera",
        body: "Buka Window 6 (AI & Gestur), lalu klik tombol 📷 Cam Tracking. Izinkan akses kamera di browser; pratinjau skeleton tangan dan indikator FPS akan tampil di bagian bawah jendela.",
      },
      {
        heading: "Gestur 1: Two-Finger Grab (▣)",
        body: "Rapatkan jari telunjuk dan jari tengah di atas header salah satu jendela melayang untuk menangkap dan menggeser posisi jendela tersebut di layar tanpa mouse.",
      },
      {
        heading: "Gestur 2: Fist Load (▼)",
        body: "Kepalkan tangan di area balok untuk menempatkan dan mengubah beban titik P1 secara langsung. Geser tangan secara horizontal untuk mengatur posisi x (m) dan vertikal untuk besar beban P (25–250 kN).",
      },
      {
        heading: "Gestur 3: Point Precision (▸)",
        body: "Acungkan satu jari telunjuk ke sepanjang bentang balok untuk memunculkan HUD inspeksi presisi yang menampilkan nilai x, lendutan Δ (mm), momen Mu (kNm), dan geser Vu (kN) di titik tersebut.",
      },
      {
        heading: "Mode hemat daya (Eco Mode)",
        body: "Aktifkan sakelar Eco Mode pada panel pratinjau kamera untuk menurunkan frekuensi deteksi frame sehingga suhu prosesor dan baterai laptop tetap hemat saat presentasi panjang.",
      },
    ],
  },
  {
    pageNumber: 19,
    type: "SCREENSHOT",
    title: "Tampilan ringkas di Android Mobile Companion",
    breadcrumb: "Buka melalui perangkat Android atau instal sebagai PWA (Add to Home Screen).",
    screenshotFile: "11-android-companion.png",
    caption:
      "Pada perangkat mobile, aplikasi otomatis melewati kanvas 3D WebGL yang berat dan menyajikan kalkulator lapangan 3 tab (Hasil Desain, Beban & Gaya, Parameter SNI) agar baterai hemat dan bebas panas berlebih.",
  },
  {
    pageNumber: 20,
    type: "SCREENSHOT",
    title: "Ekspor model ke perangkat lunak CAD, BIM & CAE",
    breadcrumb: "Quick Dock → 4. Optimasi → tombol Ekspor Model / Profil.",
    screenshotFile: "12-export-modal.png",
    caption:
      "Modal ekspor menyediakan unduhan berkas lintas ekosistem teknik sipil dalam satu klik, lengkap dengan ringkasan spesifikasi geometri dan hasil verifikasi SNI.",
  },
  {
    pageNumber: 21,
    type: "TABLE",
    title: "Matriks format ekspor & lembar perhitungan resmi",
    subtitle: "Spesifikasi teknis berkas keluaran untuk interoperabilitas lintas perangkat lunak",
    headers: ["Format Berkas", "Perangkat Lunak Tujuan", "Isi & Cakupan Data Teknis"],
    rows: [
      [
        "AutoCAD DXF (.dxf)",
        "AutoCAD 2024+, BricsCAD, ZWCAD",
        "Gambar potongan melintang 2D berskala (mm) lengkap dengan layer dimensi, tulangan/profil, dan teks anotasi.",
      ],
      [
        "SAP2000 Text (.s2k)",
        "CSI SAP2000 & CSiBridge",
        "Definisi material, frame section properties, koordinat joint, restraint tumpuan, serta kombinasi beban.",
      ],
      [
        "BIM IFC4 (.ifc)",
        "Autodesk Revit, Tekla Structures, ArchiCAD",
        "Entitas IfcBeam 3D, IfcIShapeProfileDef / IfcRectangleProfileDef, dan properti struktural standar ISO 16739.",
      ],
      [
        "IDEA StatiCa (.xml) & STEP (.stp)",
        "IDEA StatiCa Connection & SolidWorks",
        "Gaya dalam ujung batang untuk analisis sambungan baja serta geometri solid B-Rep 3D presisi.",
      ],
      [
        "Calculation Sheet (HTML/PDF A4)",
        "Browser Cetak A4 (/api/report/calculation-sheet)",
        "Nota desain resmi berisi tabel geometri, beban rencana ULS, pemeriksaan DCR lentur/geser, SLS lendutan, dan kolom tanda tangan.",
      ],
    ],
  },
  {
    pageNumber: 22,
    type: "TEXT_GRID",
    title: "Checklist rekayasa sebelum desain dinyatakan selesai",
    subtitle: "Langkah verifikasi mandiri untuk memastikan keamanan dan kepatuhan kode SNI",
    cards: [
      {
        heading: "1. Pastikan kesesuaian tumpuan & bentang",
        body: "Periksa apakah panjang bentang bersih L dan orientasi tumpuan (Sendi-Rol, Jepit, atau Kantilever) sudah mencerminkan kondisi sambungan aktual di lapangan.",
      },
      {
        heading: "2. Verifikasi faktor beban ULS",
        body: "Pada Mode B, pastikan nilai Mux, Vu, Pu, dan Tu yang dimasukkan sudah berupa gaya dalam terfaktor (misal kombinasi 1,2D + 1,6L sesuai SNI 1727:2020).",
      },
      {
        heading: "3. Periksa kekangan lateral Lb (Baja)",
        body: "Pastikan nilai Lb pada Window 3 sesuai dengan jarak pengaku lateral atau balok anak. Nilai Lb yang besar dapat menurunkan kapasitas lentur φMn akibat tekuk torsi lateral (LTB).",
      },
      {
        heading: "4. Tinjau rasio DCR & spasi tulangan",
        body: "Pastikan DCR lentur dan geser berada di bawah 1,00. Untuk beton bertulang, periksa apakah jumlah batang tulangan muat terhadap lebar balok bw dan spasi bersih minimum agregat.",
      },
      {
        heading: "5. Arsipkan Calculation Sheet A4",
        body: "Unduh berkas CAD/BIM yang diperlukan dan cetak Calculation Sheet A4 melalui tombol cetak PDF sebagai lampiran resmi laporan perhitungan struktur.",
      },
    ],
  },
  {
    pageNumber: 23,
    type: "TEXT_GRID",
    title: "Pemecahan masalah umum (Troubleshooting)",
    subtitle: "Solusi cepat untuk kendala grafis, solver, mikrofon, dan kamera",
    cards: [
      {
        heading: "Pesan WEBGL2_UNAVAILABLE di kanvas",
        body: "Aktifkan opsi 'Use graphics acceleration when available' di pengaturan browser Chrome/Edge Anda, lalu muat ulang halaman. Jika memakai perangkat seluler, gunakan tampilan Mobile Companion.",
      },
      {
        heading: "Peringatan Kapasitas Katalog Terlampaui",
        body: "Muncul bila beban terlalu besar sehingga seluruh profil standar memiliki DCR > 1,00. Solusi: naikkan mutu baja ke BJ 50/55, perbesar dimensi beton bw×h, atau aktifkan Generator BOX Custom.",
      },
      {
        heading: "Diagram gaya dalam tidak muncul",
        body: "Pastikan Anda berada di Mode A (Beban Eksternal) dan kotak centang SFD/BMD pada Window 1 sudah diaktifkan. Pada tampilan Mode 1/Mode 2, pastikan balok berada di dalam area pandang kamera.",
      },
      {
        heading: "Perintah suara tidak merespons",
        body: "Pastikan izin mikrofon diizinkan di bilah alamat browser dan status toast bawah bertuliskan 'Mendengarkan...'. Gunakan tombol 🔊 Uji Audio di Window 6 untuk memeriksa keluaran speaker.",
      },
      {
        heading: "Kamera gestur lambat atau gagal dibuka",
        body: "Tutup aplikasi lain yang sedang memakai webcam (seperti Zoom/OBS), lalu klik ulang 📷 Cam Tracking. Aktifkan Eco Mode jika frame rate terasa berat.",
      },
    ],
  },
  {
    pageNumber: 24,
    type: "TEXT_GRID",
    title: "Referensi standar & informasi pengembang",
    subtitle: "Acuan normatif desain struktur dan repositori kode sumber terbuka",
    cards: [
      {
        heading: "Standar Beton Bertulang",
        body: "SNI 2847:2019 — Persyaratan Beton Struktural untuk Bangunan Gedung dan Penjelasan (mengadopsi ACI 318M-14). Mencakup metode blok tegangan ekuivalen Whitney dan geser satu arah Pasal 22.5.",
      },
      {
        heading: "Standar Baja Struktural",
        body: "SNI 1729:2020 — Spesifikasi untuk Bangunan Gedung Baja Struktural (mengadopsi AISC 360-16). Mencakup klasifikasi kekompakan Tabel B4.1b, lentur Bab F, geser Bab G, dan interaksi Bab H.",
      },
      {
        heading: "Katalog Profil & Material",
        body: "Profil IWF dan H-Beam mengacu pada JIS G 3192 / SNI 07-7178. Profil berongga persegi/persegi panjang (Hollow Structural Sections) mengacu pada JIS G 3466.",
      },
      {
        heading: "Pengembang & Lisensi Open-Source",
        body: "Dikembangkan oleh Rizqi Lasheva Purnama Putra (@Rilaptra / Erzy.sh) — Program Studi S1 Teknik Sipil, Fakultas Teknik, Universitas Tidar.",
      },
      {
        heading: "Tautan Resmi & Bantuan",
        body: "Aplikasi web: https://erzysh-ibds.vercel.app | Repositori GitHub & Pelaporan Isu (Issue Tracker): https://github.com/Rilaptra/erzysh-IBDS.",
      },
    ],
  },
];

// ============================================================================
// Tahap 1: Otomasi Tangkapan Layar UI Menggunakan Native `Bun.WebView`
// ============================================================================

async function captureApplicationScreenshots(): Promise<void> {
  await mkdir(SCREENSHOT_DIR, { recursive: true });

  if (SKIP_CAPTURE) {
    console.log("⏭️  Melewati proses auto-capture (--skip-capture aktif).");
    return;
  }

  console.log(`📸 Memulai sesi Bun.WebView ke ${BASE_URL} ...`);

  await using view = new Bun.WebView({
    width: 1440,
    height: 810, // Rasio 16:9 presisi
    backend: {
      type: "chrome",
      argv: [
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-webgl",
        "--ignore-gpu-blocklist",
        "--hide-scrollbars",
      ],
    },
  });

  // Helper untuk klik tombol berdasarkan teks di dalam DOM
  const clickButtonWithText = async (labelSubstring: string): Promise<void> => {
    await view.evaluate(`(() => {
      const buttons = Array.from(document.querySelectorAll('button, [role="tab"], [role="radio"], label'));
      const target = buttons.find(el => el.textContent && el.textContent.includes(${JSON.stringify(labelSubstring)}));
      if (target instanceof HTMLElement) target.click();
    })()`);
  };

  // Helper untuk mengatur jendela melayang mana saja yang dibuka
  const setOpenWindows = async (openLabels: readonly string[]): Promise<void> => {
    await view.evaluate(`(() => {
      const dockButtons = Array.from(document.querySelectorAll('button')).filter(b => /^\\d\\.\\s/.test(b.textContent?.trim() || ''));
      for (const btn of dockButtons) {
        const text = btn.textContent?.trim() || '';
        const shouldOpen = ${JSON.stringify(openLabels)}.some(lbl => text.includes(lbl));
        const isCurrentlyActive = btn.className.includes('text-sky-400');
        if (shouldOpen !== isCurrentlyActive) {
          btn.click();
        }
      }
    })()`);
  };

  // 1. Landing Page
  await view.navigate(BASE_URL);
  await Bun.sleep(800);
  await Bun.write(resolve(SCREENSHOT_DIR, "01-landing.png"), await view.screenshot());
  console.log("  ✓ 01-landing.png");

  // 2. Desktop Workstation Overview (Mode A - Steel)
  await view.navigate(`${BASE_URL}/simulator?mode=MODE_A_EXTERNAL_LOADS`);
  await Bun.sleep(1400); // Tunggu solver WASM & WebGL2 selesai inisialisasi
  await Bun.write(resolve(SCREENSHOT_DIR, "02-desktop-steel.png"), await view.screenshot());
  console.log("  ✓ 02-desktop-steel.png");

  // 3. Mode A Interactive Loads (Fokus Window 1 & Window 2)
  await setOpenWindows(["1. Material", "2. Beban"]);
  await Bun.sleep(400);
  await Bun.write(resolve(SCREENSHOT_DIR, "03-mode-a-loads.png"), await view.screenshot());
  console.log("  ✓ 03-mode-a-loads.png");

  // 4. Mode B Direct Internal Forces
  await clickButtonWithText("Mode B: Gaya Dalam");
  await Bun.sleep(500);
  await Bun.write(resolve(SCREENSHOT_DIR, "04-mode-b-direct.png"), await view.screenshot());
  console.log("  ✓ 04-mode-b-direct.png");

  // Kembalikan ke Mode A untuk visualisasi diagram & kurva
  await clickButtonWithText("Mode A: Beban Eksternal");
  await Bun.sleep(400);

  // 5. Steel Design Parameters (Window 3 + Custom Box Generator)
  await setOpenWindows(["1. Material", "3. Parameter"]);
  await clickButtonWithText("BOX / Hollow HSS");
  await Bun.sleep(300);
  await clickButtonWithText("Gunakan Generator Parametrik Custom");
  await Bun.sleep(400);
  await Bun.write(resolve(SCREENSHOT_DIR, "05-steel-params.png"), await view.screenshot());
  console.log("  ✓ 05-steel-params.png");

  // Kembalikan ke IWF standar & buka hasil optimasi
  await clickButtonWithText("IWF / H-Beam");
  await setOpenWindows(["3. Parameter", "4. Optimasi"]);
  await Bun.sleep(500);
  await Bun.write(resolve(SCREENSHOT_DIR, "06-steel-results.png"), await view.screenshot());
  console.log("  ✓ 06-steel-results.png");

  // 7. Concrete Design Parameters (SNI 2847:2019)
  await setOpenWindows(["1. Material", "3. Parameter", "4. Optimasi"]);
  await clickButtonWithText("Beton (SNI 2847)");
  await Bun.sleep(500);
  await Bun.write(resolve(SCREENSHOT_DIR, "07-concrete-params.png"), await view.screenshot());
  console.log("  ✓ 07-concrete-params.png");

  // 8. Concrete 3D Wireframe Rebar Cage
  await setOpenWindows(["4. Optimasi"]);
  await clickButtonWithText("Wireframe Tulangan");
  await Bun.sleep(500);
  await Bun.write(resolve(SCREENSHOT_DIR, "08-concrete-wireframe.png"), await view.screenshot());
  console.log("  ✓ 08-concrete-wireframe.png");

  // 9. Multi-Mode Internal Force Diagrams (Window 5)
  await clickButtonWithText("Baja (SNI 1729)");
  await setOpenWindows(["2. Beban", "5. Diagram"]);
  await Bun.sleep(500);
  await Bun.write(resolve(SCREENSHOT_DIR, "09-diagrams-window.png"), await view.screenshot());
  console.log("  ✓ 09-diagrams-window.png");

  // 10. AI Assistant Ucuy & Hand Gesture Window (Window 6)
  await setOpenWindows(["6. AI & Gestur"]);
  await clickButtonWithText("Bandingkan IWF vs BOX");
  await Bun.sleep(800);
  await Bun.write(resolve(SCREENSHOT_DIR, "10-ai-assistant.png"), await view.screenshot());
  console.log("  ✓ 10-ai-assistant.png");

  // 12. Export Modal (Window 4 -> Buka Modal Ekspor)
  await setOpenWindows(["4. Optimasi"]);
  await Bun.sleep(300);
  await clickButtonWithText("Ekspor");
  await Bun.sleep(500);
  await Bun.write(resolve(SCREENSHOT_DIR, "12-export-modal.png"), await view.screenshot());
  console.log("  ✓ 12-export-modal.png");

  // 11. Android Mobile Companion View (Emulasi User-Agent Android)
  await view.cdp("Emulation.setUserAgentOverride", {
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  });
  await view.navigate(`${BASE_URL}/simulator`);
  await Bun.sleep(900);
  await Bun.write(resolve(SCREENSHOT_DIR, "11-android-companion.png"), await view.screenshot());
  console.log("  ✓ 11-android-companion.png");
}

// ============================================================================
// Tahap 2: Konversi Gambar ke Base64 Data URI & Builder HTML 16:9
// ============================================================================

async function loadScreenshotDataUri(filename: string): Promise<string> {
  const fullPath = resolve(SCREENSHOT_DIR, filename);
  if (existsSync(fullPath)) {
    const buf = await readFile(fullPath);
    return `data:image/png;base64,${buf.toString("base64")}`;
  }
  // Fallback SVG placeholder jika file screenshot belum tersedia
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
    <rect width="1280" height="720" fill="#0f172a"/>
    <rect x="40" y="40" width="1200" height="640" rx="12" fill="#1e293b" stroke="#38bdf8" stroke-width="2" stroke-dasharray="8 8"/>
    <text x="640" y="345" text-anchor="middle" fill="#38bdf8" font-family="monospace" font-size="22" font-weight="bold">PRATINJAU TANGKAPAN LAYAR: ${filename}</text>
    <text x="640" y="385" text-anchor="middle" fill="#94a3b8" font-family="sans-serif" font-size="15">Jalankan server lokal (bun run dev) untuk menangkap layar asli aplikasi</text>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function pad2(num: number): string {
  return String(num).padStart(2, "0");
}

async function buildManualHtml(): Promise<string> {
  const totalPages = MANUAL_PAGES.length;

  // Preload seluruh screenshot ke Base64 agar render PDF mandiri 100%
  const screenshotMap = new Map<string, string>();
  for (const slide of MANUAL_PAGES) {
    if (slide.type === "SCREENSHOT") {
      screenshotMap.set(slide.screenshotFile, await loadScreenshotDataUri(slide.screenshotFile));
    }
  }

  const tocEntries = MANUAL_PAGES.filter((p) => p.pageNumber >= 3);
  const leftToc = tocEntries.slice(0, Math.ceil(tocEntries.length / 2));
  const rightToc = tocEntries.slice(Math.ceil(tocEntries.length / 2));

  const pagesHtml = MANUAL_PAGES.map((slide) => {
    const pageId = `page-${pad2(slide.pageNumber)}`;
    const pageCounter = `${pad2(slide.pageNumber)}/${pad2(totalPages)}`;

    const topBar = `
      <header class="slide-topbar">
        <div class="brand-crumb">ERZYSH-IBDS / PANDUAN PENGGUNA 01</div>
        <div class="edition-crumb">Edisi ${EDITION_DATE}</div>
      </header>
    `;

    const bottomBar = `
      <footer class="slide-footer">
        <div class="footer-left">erzysh-ibds.vercel.app &nbsp;|&nbsp; Standar SNI 2847:2019 &amp; SNI 1729:2020 &nbsp;|&nbsp; Engine v${APP_VERSION}</div>
        <div class="footer-right">${pageCounter}</div>
      </footer>
    `;

    if (slide.type === "COVER") {
      return `
        <section class="slide cover-slide" id="${pageId}">
          <div class="cover-inner">
            <div class="cover-logo">
              <span class="cover-logo-badge">📐</span>
              <span class="cover-logo-text">IBDS<span>.erzysh</span></span>
            </div>
            <div class="cover-kicker">${slide.subtitle}</div>
            <h1 class="cover-title">${slide.title.replace(/\n/g, "<br/>")}</h1>
            <ul class="cover-bullets">
              ${slide.bullets.map((b) => `<li>${b}</li>`).join("")}
            </ul>
            <div class="cover-meta">
              <span>${EDITION_DATE} &nbsp;|&nbsp; Dokumen Teknis Rekayasa Struktur</span>
              <span class="cover-page-pill">${totalPages} halaman</span>
            </div>
          </div>
        </section>
      `;
    }

    if (slide.type === "TOC") {
      const renderTocItem = (p: PageSlide) => `
        <a class="toc-item" href="#page-${pad2(p.pageNumber)}">
          <span class="toc-num">${pad2(p.pageNumber)}</span>
          <span class="toc-label">${p.title}</span>
        </a>
      `;
      return `
        <section class="slide" id="${pageId}">
          ${topBar}
          <div class="slide-heading">
            <h2>${slide.title}</h2>
            <p>${slide.subtitle}</p>
          </div>
          <div class="toc-grid">
            <div class="toc-col">${leftToc.map(renderTocItem).join("")}</div>
            <div class="toc-col">${rightToc.map(renderTocItem).join("")}</div>
          </div>
          ${bottomBar}
        </section>
      `;
    }

    if (slide.type === "TEXT_GRID") {
      return `
        <section class="slide" id="${pageId}">
          ${topBar}
          <div class="slide-heading">
            <h2>${slide.title}</h2>
            <p>${slide.subtitle}</p>
          </div>
          <div class="cards-grid">
            ${slide.cards
              .map(
                (c) => `
              <article class="info-card">
                <h3>${c.heading}</h3>
                <p>${c.body}</p>
              </article>
            `,
              )
              .join("")}
          </div>
          ${bottomBar}
        </section>
      `;
    }

    if (slide.type === "SCREENSHOT") {
      const imgSrc = screenshotMap.get(slide.screenshotFile) ?? "";
      return `
        <section class="slide screenshot-slide" id="${pageId}">
          ${topBar}
          <div class="slide-heading compact">
            <h2>${slide.title}</h2>
            <p class="breadcrumb-line">${slide.breadcrumb}</p>
          </div>
          <div class="screenshot-frame">
            <img src="${imgSrc}" alt="${slide.title}" />
          </div>
          <p class="screenshot-caption">${slide.caption}</p>
          ${bottomBar}
        </section>
      `;
    }

    if (slide.type === "TABLE") {
      return `
        <section class="slide" id="${pageId}">
          ${topBar}
          <div class="slide-heading">
            <h2>${slide.title}</h2>
            <p>${slide.subtitle}</p>
          </div>
          <div class="table-wrap">
            <table class="ref-table">
              <thead>
                <tr>
                  <th style="width: 24%">${slide.headers[0]}</th>
                  <th style="width: 30%">${slide.headers[1]}</th>
                  <th style="width: 46%">${slide.headers[2]}</th>
                </tr>
              </thead>
              <tbody>
                ${slide.rows
                  .map(
                    (r) => `
                  <tr>
                    <td><strong>${r[0]}</strong></td>
                    <td class="mono-cell">${r[1]}</td>
                    <td>${r[2]}</td>
                  </tr>
                `,
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
          ${bottomBar}
        </section>
      `;
    }

    return "";
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="id" class="${IS_DARK_THEME ? "theme-dark" : "theme-light"}">
<head>
  <meta charset="UTF-8" />
  <title>Panduan Pengguna 01 — erzysh-IBDS</title>
  <style>
    @page {
      size: 1280px 720px;
      margin: 0;
    }
    :root {
      --bg-page: #F4F7F9;
      --bg-card: #FFFFFF;
      --text-main: #0F172A;
      --text-muted: #475569;
      --accent: #0284C7;
      --accent-soft: #E0F2FE;
      --border: #DCE4EC;
      --cover-bg: linear-gradient(135deg, #061320 0%, #0A2239 55%, #083344 100%);
    }
    html.theme-dark {
      --bg-page: #0A0E12;
      --bg-card: #111820;
      --text-main: #F8FAFC;
      --text-muted: #94A3B8;
      --accent: #06B6D4;
      --accent-soft: rgba(6, 182, 212, 0.14);
      --border: rgba(148, 163, 184, 0.18);
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: var(--bg-page);
      color: var(--text-main);
    }
    .slide {
      width: 1280px;
      height: 720px;
      padding: 36px 56px 30px 56px;
      background: var(--bg-page);
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      page-break-after: always;
      break-after: page;
      overflow: hidden;
    }
    /* Cover Slide */
    .cover-slide {
      background: var(--cover-bg);
      color: #F8FAFC;
      padding: 64px 76px;
    }
    .cover-inner {
      display: flex;
      flex-direction: column;
      height: 100%;
      justify-content: space-between;
    }
    .cover-logo {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    .cover-logo-badge {
      background: rgba(6, 182, 212, 0.2);
      border: 1px solid rgba(6, 182, 212, 0.45);
      border-radius: 10px;
      padding: 6px 10px;
      font-size: 22px;
    }
    .cover-logo-text span {
      color: #38BDF8;
    }
    .cover-kicker {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 1.6px;
      color: #38BDF8;
      text-transform: uppercase;
      margin-top: 16px;
    }
    .cover-title {
      font-size: 50px;
      font-weight: 800;
      line-height: 1.14;
      letter-spacing: -1px;
      max-width: 980px;
      color: #FFFFFF;
    }
    .cover-bullets {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 10px;
      font-size: 17px;
      color: #CBD5E1;
      border-left: 3px solid #06B6D4;
      padding-left: 18px;
    }
    .cover-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid rgba(148, 163, 184, 0.25);
      padding-top: 20px;
      font-size: 14px;
      color: #94A3B8;
    }
    .cover-page-pill {
      background: rgba(56, 189, 248, 0.16);
      border: 1px solid rgba(56, 189, 248, 0.4);
      color: #E0F2FE;
      padding: 6px 14px;
      border-radius: 999px;
      font-weight: 700;
    }
    /* Header & Footer */
    .slide-topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.8px;
      color: var(--accent);
      border-bottom: 1px solid var(--border);
      padding-bottom: 10px;
    }
    .edition-crumb {
      color: var(--text-muted);
      font-weight: 600;
    }
    .slide-heading {
      margin-top: 12px;
      margin-bottom: 14px;
    }
    .slide-heading.compact {
      margin-top: 8px;
      margin-bottom: 10px;
    }
    .slide-heading h2 {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: var(--text-main);
    }
    .slide-heading p {
      font-size: 14px;
      color: var(--text-muted);
      margin-top: 4px;
    }
    .breadcrumb-line {
      font-weight: 600;
      color: var(--accent) !important;
    }
    .slide-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      color: var(--text-muted);
      border-top: 1px solid var(--border);
      padding-top: 10px;
    }
    .footer-right {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-weight: 700;
      color: var(--text-main);
    }
    /* TOC Grid */
    .toc-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px 32px;
      flex: 1;
      align-content: start;
      margin-top: 6px;
    }
    .toc-col {
      display: flex;
      flex-direction: column;
      gap: 7px;
    }
    .toc-item {
      display: flex;
      align-items: center;
      gap: 12px;
      text-decoration: none;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 7px 12px;
      color: var(--text-main);
    }
    .toc-num {
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      font-size: 12px;
      font-weight: 800;
      color: var(--accent);
      background: var(--accent-soft);
      padding: 3px 7px;
      border-radius: 5px;
    }
    .toc-label {
      font-size: 13.5px;
      font-weight: 600;
    }
    /* Text Grid Cards */
    .cards-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px 20px;
      flex: 1;
      align-content: start;
    }
    .info-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-left: 4px solid var(--accent);
      border-radius: 10px;
      padding: 16px 20px;
    }
    .info-card h3 {
      font-size: 16px;
      font-weight: 700;
      color: var(--text-main);
      margin-bottom: 6px;
    }
    .info-card p {
      font-size: 13.5px;
      line-height: 1.5;
      color: var(--text-muted);
    }
    /* Screenshot Layout */
    .screenshot-frame {
      flex: 1;
      min-height: 0;
      background: #070B0E;
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
    }
    .screenshot-frame img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: top center;
      display: block;
    }
    .screenshot-caption {
      font-size: 13.5px;
      line-height: 1.45;
      color: var(--text-muted);
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px 16px;
      margin-top: 10px;
      margin-bottom: 10px;
    }
    /* Table Layout */
    .table-wrap {
      flex: 1;
      display: flex;
       flex-direction: column;
      justify-content: flex-start;
    }
    .ref-table {
      width: 100%;
      border-collapse: collapse;
      background: var(--bg-card);
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid var(--border);
      font-size: 14px;
    }
    .ref-table th {
      background: var(--accent-soft);
      color: var(--text-main);
      text-align: left;
      padding: 13px 16px;
      font-weight: 700;
      border-bottom: 2px solid var(--border);
    }
    .ref-table td {
      padding: 13px 16px;
      border-bottom: 1px solid var(--border);
      color: var(--text-muted);
      vertical-align: top;
      line-height: 1.45;
    }
    .ref-table td strong {
      color: var(--text-main);
    }
    .mono-cell {
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      font-size: 13px;
      color: var(--accent) !important;
      font-weight: 600;
    }
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>`;
}

// ============================================================================
// Tahap 3: Render HTML ke PDF 16:9 Menggunakan `Bun.WebView` CDP
// ============================================================================

async function renderHtmlToPdf(htmlPath: string, pdfPath: string): Promise<void> {
  console.log("🖨️  Merender dokumen 24 halaman ke PDF 16:9 ...");

  await using view = new Bun.WebView({
    width: 1280,
    height: 720,
    backend: { type: "chrome" },
  });

  const fileUrl = `file:///${htmlPath.replace(/\\/g, "/")}`;
  await view.navigate(fileUrl);
  await Bun.sleep(500);

  const cdpResult = (await view.cdp("Page.printToPDF", {
    printBackground: true,
    preferCSSPageSize: true,
    marginTop: 0,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
  })) as { data: string };

  await Bun.write(pdfPath, Buffer.from(cdpResult.data, "base64"));
}

// ============================================================================
// Main Runner
// ============================================================================

async function main(): Promise<void> {
  const startTime = performance.now();
  await mkdir(OUT_DIR, { recursive: true });

  await captureApplicationScreenshots();

  const html = await buildManualHtml();
  await Bun.write(HTML_OUT_PATH, html);
  console.log(`📄 File HTML pratinjau disimpan di: ${HTML_OUT_PATH}`);

  await renderHtmlToPdf(HTML_OUT_PATH, PDF_OUT_PATH);

  const elapsedSec = ((performance.now() - startTime) / 1000).toFixed(2);
  console.log(`✅ Selesai dalam ${elapsedSec} detik! Buku panduan tersedia di: ${PDF_OUT_PATH}`);
}

await main();
