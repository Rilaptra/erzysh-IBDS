import type { PresentationChapterMeta } from "@/types/presentation-types";

export const PRESENTATION_CHAPTERS: readonly PresentationChapterMeta[] = [
  {
    id: "hero",
    slideNumber: 1,
    code: "00",
    title: "Ringkasan Eksekutif & Identitas IBDS",
    shortTitle: "Ringkasan",
    subtitle: "Interactive 3D Beam Deflection & Structural Design Simulator",
  },
  {
    id: "bab-1-identitas-fitur",
    slideNumber: 2,
    code: "01",
    title: "Pengertian Aplikasi & 7 Fitur Unggulan",
    shortTitle: "Identitas & Fitur",
    subtitle: "Posisi produk, keunggulan teknis Rust WASM + WebGL2, dan komparasi solusi",
  },
  {
    id: "bab-2-fungsi-tujuan",
    slideNumber: 3,
    code: "02",
    title: "Fungsi & Tujuan Aplikasi",
    shortTitle: "Fungsi & Tujuan",
    subtitle: "4 pilar operasional dan alur kerja rekayasa struktur end-to-end",
  },
  {
    id: "bab-3-proses-pengembangan",
    slideNumber: 4,
    code: "03",
    title: "Proses & Tahapan Pembuatan Aplikasi",
    shortTitle: "Tahapan Build",
    subtitle: "Evolusi kronologis dari Spec-First, R&D Prototipe, hingga v0.6.21",
  },
  {
    id: "bab-4-riwayat-update",
    slideNumber: 5,
    code: "04",
    title: "Riwayat Update yang Sudah Dilakukan",
    shortTitle: "Riwayat Update",
    subtitle: "Single Source of Truth langsung dari CHANGELOG.md repositori",
  },
  {
    id: "bab-5-tutorial-panduan",
    slideNumber: 6,
    code: "05",
    title: "Tutorial & Panduan Lengkap Terbaru",
    shortTitle: "Tutorial",
    subtitle: "9 misi IBDS Engineer Quest, kontrol multimodal, dan manual PDF 24-slide",
  },
  {
    id: "bab-6-sumber-validasi",
    slideNumber: 7,
    code: "06",
    title: "Sumber Hitungan & Bukti Validasi",
    shortTitle: "Validasi",
    subtitle: "Persamaan KaTeX SNI serta perbandingan IBDS vs SAP2000 & Excel Manual",
  },
  {
    id: "bab-7-target-pengguna",
    slideNumber: 8,
    code: "07",
    title: "Target Pengguna (Matriks Persona)",
    shortTitle: "Target Pengguna",
    subtitle: "Pemetaan kebutuhan mahasiswa, dosen, engineer, drafter, dan developer",
  },
  {
    id: "bab-8-kualitas-sistem",
    slideNumber: 9,
    code: "08",
    title: "Arsitektur & 6 Aspek Kualitas Sistem",
    shortTitle: "6 Kualitas",
    subtitle: "Sustainability, Scalability, Modularity, Flexibility, Simplicity, Maintainability",
  },
  {
    id: "bab-9-github-preview",
    slideNumber: 10,
    code: "09",
    title: "Pratinjau GitHub Repository via Iframe",
    shortTitle: "GitHub Preview",
    subtitle: "Same-origin embed rute /embed/github-repo dengan cache ISR dan offline fallback",
  },
  {
    id: "bab-10-masukan-issue",
    slideNumber: 11,
    code: "10",
    title: "Kotak Masukan & Panduan GitHub Issues",
    shortTitle: "Masukan & Issue",
    subtitle: "Panduan 4 langkah ramah pemula dan composer pre-filled GitHub Issue URL",
  },
];

export const TOTAL_PRESENTATION_SLIDES = PRESENTATION_CHAPTERS.length;

export function getChapterBySlideNumber(slideNumber: number): PresentationChapterMeta {
  const clamped = Math.min(Math.max(Math.trunc(slideNumber), 1), TOTAL_PRESENTATION_SLIDES);
  const found = PRESENTATION_CHAPTERS[clamped - 1];
  return found ?? PRESENTATION_CHAPTERS[0]!;
}
