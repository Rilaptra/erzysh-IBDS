import type { PersonaItem } from "@/types/presentation-types";

export const TARGET_PERSONAS: readonly PersonaItem[] = [
  {
    id: "student",
    role: "Mahasiswa Teknik Sipil",
    tag: "ACADEMIC",
    accentClass: "text-cyan-300 border-cyan-400/30 bg-cyan-500/10",
    painPoints:
      "Sulit membayangkan hubungan langsung antara konfigurasi beban, diagram SFD/BMD, dan bentuk lendutan 3D serta rawan salah konversi satuan saat hitungan manual SNI.",
    workflow:
      "Bereksperimen menggeser beban/tumpuan secara real-time, menyelesaikan 9 misi IBDS Engineer Quest, dan memeriksa tugas melalui Nota Desain KaTeX.",
    recommendedMode: "Mode A · Viewport 3D + 3-Mode Diagram",
    ctaLabel: "Mulai Quest 9 Misi",
    ctaHref: "/simulator?tutorial=1",
  },
  {
    id: "lecturer",
    role: "Dosen & Praktisi Akademik",
    tag: "TEACHING",
    accentClass: "text-sky-300 border-sky-400/30 bg-sky-500/10",
    painPoints:
      "Software struktur komersial berat dan lambat disiapkan di kelas, serta tidak praktis mengoperasikan mouse sambil menerangkan di depan proyektor.",
    workflow:
      "Mendemonstrasikan 9 orientasi tumpuan, X-Ray sangkar tulangan beton, dan kurva lendutan secara hands-free memakai perintah suara 'Ucuy' atau gestur tangan.",
    recommendedMode: "Desktop Workstation · Voice AI & Deck Mode",
    ctaLabel: "Buka Mode Slide",
    ctaHref: "/presentation?view=deck&slide=1",
  },
  {
    id: "engineer",
    role: "Junior / Structural Engineer",
    tag: "FIELD & DESIGN",
    accentClass: "text-emerald-300 border-emerald-400/30 bg-emerald-500/10",
    painPoints:
      "Butuh preliminary sizing cepat sebelum masuk model portal penuh dan perlu pengecekan kapasitas cepat di lapangan dari gaya dalam terfaktor.",
    workflow:
      "Memasukkan Pu, Mux, Muy, Tu, Vu langsung pada Mode B (atau via Android Companion PWA), menemukan profil DCR 90–100% dalam milidetik, lalu ekspor .s2k / .iom.xml.",
    recommendedMode: "Mode B · Android Companion PWA",
    ctaLabel: "Buka Mode B SNI",
    ctaHref: "/simulator?mode=MODE_B_DIRECT_INTERNAL_FORCES",
  },
  {
    id: "drafter",
    role: "BIM / CAD Drafter",
    tag: "DETAILING",
    accentClass: "text-violet-300 border-violet-400/30 bg-violet-500/10",
    painPoints:
      "Sering harus menggambar ulang penampang profil baja IWF/BOX atau detail tulangan beton dari laporan hitungan statis ke AutoCAD maupun Revit.",
    workflow:
      "Mengunduh langsung .dxf 4-layer standar AC1009, skrip .lsp AutoLISP, model BIM .ifc (IFC4), Revit Type Catalog .txt, atau .step B-Rep solid.",
    recommendedMode: "Export Modal 9-Format · AutoCAD DXF & IFC4",
    ctaLabel: "Coba Alur Ekspor",
    ctaHref: "/simulator?tutorial=8",
  },
  {
    id: "developer",
    role: "Peneliti & Developer Rekayasa",
    tag: "OPEN SOURCE",
    accentClass: "text-amber-300 border-amber-400/30 bg-amber-500/10",
    painPoints:
      "Mencari referensi nyata penerapan Rust WASM zero-copy, WebGL2 murni tanpa Three.js, serta Bun compile-time macros untuk aplikasi teknik berbasis web.",
    workflow:
      "Menelusuri kode sumber berlisensi MIT, menjalankan 364 unit test + Cargo tests, atau memperluas katalog SNI dan exporter format baru secara modular.",
    recommendedMode: "GitHub Open Source (MIT) · crates/ & src/core/",
    ctaLabel: "Lihat Repositori",
    ctaHref: "https://github.com/Rilaptra/erzysh-IBDS",
    isExternal: true,
  },
];
