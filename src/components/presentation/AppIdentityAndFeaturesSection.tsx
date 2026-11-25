import {
  ArrowRightIcon,
  BoxIcon,
  Building2Icon,
  CpuIcon,
  FileCodeIcon,
  LayersIcon,
  MicIcon,
  SmartphoneIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactElement } from "react";

import { glassPanelClass } from "@/components/landing/ErzyshPageShell";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STANDOUT_FEATURES = [
  {
    icon: CpuIcon,
    badge: "RUST WASM · 104.6 KB",
    title: "Mesin Mekanika Zero-Copy (M = 256)",
    detail:
      "SolverWorkspace pra-alokasi (65.536 float) diakses via linear memory view langsung dari WebGL2 tanpa GC churn untuk interaksi slider 60–120 FPS.",
    codeRef: "crates/mechanics-3d-wasm/src/lib.rs",
    accent: "text-sky-300",
    featured: true,
    href: "/simulator?mode=MODE_A_EXTERNAL_LOADS",
  },
  {
    icon: BoxIcon,
    badge: "WEBGL2 MURNI",
    title: "Ekstrusi 3D Tanpa Three.js + Overlay 2D 1:1",
    detail:
      "Profil IWF (28 titik keliling lengkap 4 fillet), BOX, dan Beton (Solid End-Cap + X-Ray sangkar tulangan 3D), kontur SAP2000, dan proyeksi beban 3D.",
    codeRef: "src/components/canvas/Beam3DExtrudedViewport.tsx",
    accent: "text-cyan-300",
    href: "/simulator?tutorial=4",
  },
  {
    icon: LayersIcon,
    badge: "MODE A & MODE B",
    title: "Paradigma Ganda + 9 Orientasi Tumpuan",
    detail:
      "Input beban eksternal interaktif (P, q, M + berat sendiri) maupun input langsung gaya dalam (Pu, Mux, Muy, Tu, Vu) untuk 5 kategori / 9 orientasi tumpuan.",
    codeRef: "src/core/mechanics/support-reactions-solver.ts",
    accent: "text-violet-300",
    href: "/simulator?mode=MODE_B_DIRECT_INTERNAL_FORCES",
  },
  {
    icon: Building2Icon,
    badge: "SNI 1729 & 2847",
    title: "Optimasi Otomatis O(log N) via Bun Macro",
    detail:
      "90 IWF JIS G 3192, 23 BOX JIS G 3466, Custom BOX (r = 0, maks. 2.500 kandidat), BJ 34–55, target DCR 90–100%, serta beton blok Whitney & sengkang [Beta].",
    codeRef: "src/macros/precompute-steel-catalog.macro.ts",
    accent: "text-emerald-300",
    href: "/simulator?tutorial=6",
  },
  {
    icon: FileCodeIcon,
    badge: "9 FORMAT EKSPOR",
    title: "Interoperabilitas CAD / BIM / CAE + Nota KaTeX",
    detail:
      "Ekspor langsung ke AutoCAD (.dxf 4-layer AC1009, .lsp), SAP2000 (.s2k), Revit/Tekla (.ifc, .txt), IDEA StatiCa (.iom.xml), SolidWorks (.step, .stl), dan PDF.",
    codeRef: "src/core/exporters/",
    accent: "text-cyan-300",
    href: "/simulator?tutorial=8",
  },
  {
    icon: MicIcon,
    badge: "AI UCUY · 60 CMD",
    title: "Suara, Double-Clap & Gestur MediaPipe",
    detail:
      "Wake-word 'halo ucuy', detektor double-clap, rotasi multi-key Gemini + fallback offline, serta 5 gestur tangan Knuckle-Anchored Eco-Mode 15–16 FPS.",
    codeRef: "src/components/assistant/StructuralAiAssistantPanel.tsx",
    accent: "text-amber-300",
    href: "/simulator?tutorial=7",
  },
  {
    icon: SmartphoneIcon,
    badge: "ADAPTIVE PWA",
    title: "Desktop Workstation vs Android Field Companion",
    detail:
      "Desktop memuat 6 Floating Windows + WebGL2 + MediaPipe; Android (≤ 768px) otomatis ringan untuk Mode B + SNI + AI, dilengkapi 9 misi IBDS Engineer Quest.",
    codeRef: "src/config/platform-capabilities.ts",
    accent: "text-emerald-300",
    href: "/simulator?tutorial=1",
  },
] as const;

const COMPARISON_ROWS = [
  {
    aspect: "Waktu Setup & Akses",
    ibds: "Instan di browser / PWA (< 2 detik, tanpa instalasi)",
    excel: "Manual tiap proyek, rawan salah rumus/satuan",
    cae: "Instalasi GB-an, butuh lisensi & PC spesifikasi tinggi",
  },
  {
    aspect: "Visualisasi 3D Real-Time",
    ibds: "60–120 FPS Rust WASM + WebGL2 + X-Ray tulangan",
    excel: "Hanya grafik 2D statis sederhana",
    cae: "3D penuh, tetapi perlu run analysis berulang",
  },
  {
    aspect: "Kepatuhan SNI & Optimasi",
    ibds: "Otomatis SNI 1729:2020 & SNI 2847:2019 (DCR 90–100%)",
    excel: "Bergantung kelengkapan formula penyusun sheet",
    cae: "Lengkap (AISC/ACI), perlu pemetaan manual ke mutu BJ",
  },
  {
    aspect: "Interoperabilitas CAD/BIM",
    ibds: "9 format (.dxf, .s2k, .ifc, .iom.xml, .step, .stl)",
    excel: "Ekspor manual (copy-paste nilai angka)",
    cae: "Sangat kuat, terbatas ekosistem vendor",
  },
  {
    aspect: "Mobilitas & Kontrol Hands-Free",
    ibds: "Android Companion PWA + Suara AI Ucuy + Gestur",
    excel: "Terbatas di layar ponsel, tanpa kontrol suara",
    cae: "Khusus desktop Windows dengan mouse/keyboard",
  },
] as const;

export function AppIdentityAndFeaturesSection(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {STANDOUT_FEATURES.map((feat) => {
          const Icon = feat.icon;
          return (
            <article
              key={feat.title}
              className={cn(
                glassPanelClass,
                "flex flex-col justify-between p-4 transition-colors hover:border-cyan-400/40",
                "featured" in feat && feat.featured ? "sm:col-span-2 lg:col-span-3" : "",
              )}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "border-cyan-500/25 bg-[#060d19] font-mono text-[10px]",
                      feat.accent,
                    )}
                  >
                    {feat.badge}
                  </Badge>
                  <Icon className={cn("size-4 shrink-0", feat.accent)} aria-hidden="true" />
                </div>
                <h3 className="mt-2.5 text-sm font-bold text-slate-100">{feat.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-300/90">{feat.detail}</p>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-cyan-500/10 pt-2.5">
                <code className="truncate font-mono text-[10px] text-slate-400">
                  {feat.codeRef}
                </code>
                <Link
                  href={feat.href}
                  prefetch={false}
                  className="no-print inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-cyan-300 hover:text-cyan-200"
                >
                  <span>Coba</span>
                  <ArrowRightIcon className="size-3" aria-hidden="true" />
                </Link>
              </div>
            </article>
          );
        })}
      </div>

      <div className={cn(glassPanelClass, "overflow-hidden p-4")}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-mono text-[10px] font-bold tracking-wider text-cyan-400">
              POSISI PRODUK
            </p>
            <h3 className="text-sm font-bold text-slate-100">
              Komparasi Ringkas: erzysh-IBDS vs Spreadsheet Manual vs CAE Desktop Berat
            </h3>
          </div>
        </div>
        <div
          className="erzysh-table-wrapper"
          tabIndex={0}
          role="region"
          aria-labelledby="comparison-table-caption"
        >
          <table className="erzysh-responsive-table text-left text-xs">
            <caption id="comparison-table-caption" className="sr-only">
              Perbandingan erzysh-IBDS dengan Spreadsheet Manual dan Software CAE Desktop Berat
            </caption>
            <thead>
              <tr className="border-b border-cyan-500/20 text-[11px] text-slate-300">
                <th scope="col" className="px-3 py-2 font-semibold">
                  Aspek
                </th>
                <th scope="col" className="px-3 py-2 font-semibold text-cyan-300">
                  erzysh-IBDS (Web / PWA)
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Spreadsheet Manual
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Software CAE Desktop
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cyan-500/10">
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.aspect}>
                  <th scope="row" className="px-3 py-2.5 font-semibold text-slate-100">
                    {row.aspect}
                  </th>
                  <td data-label="erzysh-IBDS" className="px-3 py-2.5 text-cyan-200">
                    {row.ibds}
                  </td>
                  <td data-label="Spreadsheet" className="px-3 py-2.5 text-slate-300">
                    {row.excel}
                  </td>
                  <td data-label="CAE Desktop" className="px-3 py-2.5 text-slate-400">
                    {row.cae}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
