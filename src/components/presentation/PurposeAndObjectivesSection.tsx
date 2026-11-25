import {
  ArrowRightIcon,
  CircleCheckIcon,
  CompassIcon,
  FileTextIcon,
  LayersIcon,
  SparklesIcon,
} from "lucide-react";
import type { ReactElement } from "react";

import { glassPanelClass } from "@/components/landing/ErzyshPageShell";
import { cn } from "@/lib/utils";

const PURPOSE_PILLARS = [
  {
    icon: CompassIcon,
    accent: "text-cyan-300",
    funcTitle: "1. Analisis Mekanika & Visualisasi Real-Time",
    mechanism:
      "Menghitung reaksi tumpuan, SFD/BMD/NFD/TFD, serta lendutan negatif (Δ < 0) seketika saat beban, bentang, atau tumpuan diubah.",
    objectiveTitle: "Media Pembelajaran Visual Interaktif",
    objectiveDetail:
      "Membantu mahasiswa & dosen memahami perilaku elastis balok, titik balik momen, dan efek kekangan tumpuan tanpa sekadar rumus abstrak.",
  },
  {
    icon: CircleCheckIcon,
    accent: "text-emerald-300",
    funcTitle: "2. Perancangan & Optimasi Patuh SNI",
    mechanism:
      "Mengevaluasi kelangsingan, LTB, interaksi biaksial/torsi (SNI 1729:2020), serta tulangan lentur/geser Whitney (SNI 2847:2019) dan batas layan L/180–L/480.",
    objectiveTitle: "Percepatan Preliminary Design & Reduksi Human Error",
    objectiveDetail:
      "Memangkas iterasi trial-and-error pemilihan profil dari puluhan menit menjadi milidetik dengan penelusuran rumus yang transparan.",
  },
  {
    icon: FileTextIcon,
    accent: "text-violet-300",
    funcTitle: "3. Interoperabilitas Data Rekayasa",
    mechanism:
      "Mentransformasi geometri penampang dan hasil optimasi ke 9 format industri (.s2k, .dxf, .lsp, .ifc, .iom.xml, .step, .stl) serta Nota Desain PDF.",
    objectiveTitle: "Jembatan Alur Kerja Industri (CAD/BIM/CAE)",
    objectiveDetail:
      "Menghilangkan input ulang manual saat berpindah dari pradesain ke pemodelan portal penuh SAP2000, penggambaran AutoCAD/Revit, atau IDEA StatiCa.",
  },
  {
    icon: SparklesIcon,
    accent: "text-amber-300",
    funcTitle: "4. Aksesibilitas Multimodal & Lintas Perangkat",
    mechanism:
      "Menyediakan workstation desktop (mouse, suara AI Ucuy, gestur kamera) dan Android Companion PWA hemat baterai dengan komputasi lokal offline-first.",
    objectiveTitle: "Inklusivitas Kelas & Produktivitas Lapangan",
    objectiveDetail:
      "Memudahkan demonstrasi kelas hands-free bagi dosen serta cek cepat gaya dalam di lapangan tanpa PC berspesifikasi tinggi.",
  },
] as const;

const WORKFLOW_STAGES = [
  {
    step: "01",
    title: "Input Struktur",
    desc: "Mode A (P, q, M) atau Mode B (Pu, Mux, Muy, Tu, Vu) · 9 Tumpuan",
    border: "border-cyan-400/35",
  },
  {
    step: "02",
    title: "Rust WASM Solver",
    desc: "Reaksi + Mohr Compatibility · SFD/BMD/NFD/TFD & Δ(s) pada M = 256",
    border: "border-sky-400/35",
  },
  {
    step: "03",
    title: "SNI Design Engine",
    desc: "Baja SNI 1729 O(log N) & Beton SNI 2847 Whitney + Sengkang",
    border: "border-emerald-400/35",
  },
  {
    step: "04",
    title: "Hybrid 3D/2D Render",
    desc: "WebGL2 Extruded Beam + X-Ray Rebar + SVG Supports & Colorbar",
    border: "border-violet-400/35",
  },
  {
    step: "05",
    title: "Output Industri",
    desc: ".dxf · .lsp · .s2k · .ifc · .iom.xml · .step · .stl · Nota PDF",
    border: "border-amber-400/35",
  },
] as const;

export function PurposeAndObjectivesSection(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 md:grid-cols-2">
        {PURPOSE_PILLARS.map((pillar) => {
          const Icon = pillar.icon;
          return (
            <article key={pillar.funcTitle} className={cn(glassPanelClass, "p-4 sm:p-5")}>
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-bold text-slate-100">{pillar.funcTitle}</h3>
                <Icon className={cn("size-4 shrink-0", pillar.accent)} aria-hidden="true" />
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-300/90">{pillar.mechanism}</p>
              <div className="mt-3 rounded-md border border-cyan-500/15 bg-[#060d19]/80 p-3">
                <p className={cn("text-[11px] font-bold", pillar.accent)}>
                  Tujuan: {pillar.objectiveTitle}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">
                  {pillar.objectiveDetail}
                </p>
              </div>
            </article>
          );
        })}
      </div>

      <div className={cn(glassPanelClass, "p-4 sm:p-5")}>
        <div className="mb-4 flex items-center gap-2">
          <LayersIcon className="size-4 text-cyan-400" aria-hidden="true" />
          <h3 className="text-sm font-bold text-slate-100">
            Alur Kerja Rekayasa End-to-End di erzysh-IBDS
          </h3>
        </div>
        <ol className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
          {WORKFLOW_STAGES.map((stage, index) => (
            <li
              key={stage.step}
              className={cn("relative rounded-lg border bg-[#060d19]/85 p-3", stage.border)}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold text-cyan-300">
                  TAHAP {stage.step}
                </span>
                {index < WORKFLOW_STAGES.length - 1 ? (
                  <ArrowRightIcon
                    className="hidden size-3.5 text-slate-500 lg:block"
                    aria-hidden="true"
                  />
                ) : null}
              </div>
              <p className="mt-1.5 text-xs font-bold text-slate-100">{stage.title}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{stage.desc}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
