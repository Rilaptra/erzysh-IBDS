"use client";

import {
  ArrowRightIcon,
  GraduationCapIcon,
  HardHatIcon,
  PenToolIcon,
  PresentationIcon,
  TerminalIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import type { ComponentType, ReactElement } from "react";
import { useState } from "react";

import { glassPanelClass } from "@/components/landing/ErzyshPageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface TargetPersonaItem {
  readonly id: string;
  readonly role: string;
  readonly tag: string;
  readonly painPoints: string;
  readonly workflow: string;
  readonly recommendedFeatures: readonly string[];
  readonly ctaLabel: string;
  readonly ctaHref: string;
  readonly accentClass: string;
  readonly borderActiveClass: string;
  readonly icon: ComponentType<{ className?: string }>;
}

export interface TargetUsersSectionProps {
  readonly id?: string;
  readonly className?: string;
}

const TARGET_PERSONAS: readonly TargetPersonaItem[] = [
  {
    id: "mahasiswa",
    role: "Mahasiswa Teknik Sipil",
    tag: "PEMBELAJARAN",
    painPoints:
      "Sulit membayangkan hubungan langsung antara beban, diagram SFD/BMD, dan bentuk lendutan 3D; rawan salah hitung manual SNI.",
    workflow:
      "Bereksperimen langsung menggeser beban/tumpuan, menyelesaikan 9 misi IBDS Engineer Quest, dan memeriksa hasil tugas lewat Nota Desain KaTeX.",
    recommendedFeatures: ["Mode A Interaktif", "Viewport 3D + 3-Mode Diagram", "9 Misi Quest"],
    ctaLabel: "Mulai Quest 9 Misi",
    ctaHref: "/simulator?tutorial=1",
    accentClass: "text-cyan-300",
    borderActiveClass: "border-cyan-400/60 bg-cyan-500/10",
    icon: GraduationCapIcon,
  },
  {
    id: "dosen",
    role: "Dosen & Praktisi Akademik",
    tag: "DEMONSTRASI KELAS",
    painPoints:
      "Software struktur komersial berat dan lambat disiapkan saat kuliah; tidak praktis mengoperasikan mouse sambil menjelaskan di depan kelas.",
    workflow:
      "Demonstrasi langsung perilaku 9 orientasi tumpuan, X-Ray sangkar tulangan beton, dan kurva lendutan secara hands-free lewat perintah suara 'Ucuy' & gestur tangan MediaPipe.",
    recommendedFeatures: ["Desktop Workstation", "Voice AI + MediaPipe", "Mode Slide Deck"],
    ctaLabel: "Buka Mode Slide Deck",
    ctaHref: "/presentation?view=deck",
    accentClass: "text-violet-300",
    borderActiveClass: "border-violet-400/60 bg-violet-500/10",
    icon: PresentationIcon,
  },
  {
    id: "engineer",
    role: "Junior / Structural Engineer",
    tag: "PRADESAIN & LAPANGAN",
    painPoints:
      "Butuh preliminary sizing cepat sebelum masuk model portal penuh, serta pengecekan lapangan saat hanya memiliki gaya dalam terfaktor.",
    workflow:
      "Memasukkan Pu, Mux, Muy, Tu, Vu di Mode B (atau via Android Companion PWA di lapangan), mencari profil baja DCR 90–100% dalam milidetik, lalu ekspor .s2k / .iom.xml / Nota PDF.",
    recommendedFeatures: [
      "Mode B Direct Forces",
      "Android Companion PWA",
      "SNI Optimizer O(log N)",
    ],
    ctaLabel: "Coba Mode B Gaya Dalam",
    ctaHref: "/simulator?mode=MODE_B_DIRECT_INTERNAL_FORCES",
    accentClass: "text-emerald-300",
    borderActiveClass: "border-emerald-400/60 bg-emerald-500/10",
    icon: HardHatIcon,
  },
  {
    id: "drafter",
    role: "BIM / CAD Drafter",
    tag: "DETILING & EKSPOR",
    painPoints:
      "Sering harus menggambar ulang penampang profil baja/tulangan balok secara manual di AutoCAD atau Revit dari laporan hitungan statis.",
    workflow:
      "Mengunduh langsung .dxf (4 layer standar AC1009), .lsp AutoLISP, .ifc IFC4, Revit Type Catalog .txt, atau .step untuk manufaktur/detiling.",
    recommendedFeatures: ["9 Format Ekspor", "AutoCAD 4-Layer DXF", "IFC4 & STEP AP214"],
    ctaLabel: "Buka Simulator & Ekspor",
    ctaHref: "/simulator",
    accentClass: "text-sky-300",
    borderActiveClass: "border-sky-400/60 bg-sky-500/10",
    icon: PenToolIcon,
  },
  {
    id: "developer",
    role: "Peneliti & Developer Rekayasa",
    tag: "OPEN SOURCE MIT",
    painPoints:
      "Ingin mempelajari penerapan Rust WASM zero-copy, WebGL2 murni tanpa library 3D besar, dan Bun compile-time macros pada aplikasi sains web.",
    workflow:
      "Menelusuri kode sumber terbuka (MIT), memverifikasi 364 unit test + Cargo tests, atau memperluas katalog SNI/exporter baru secara modular.",
    recommendedFeatures: ["Rust WASM Zero-Copy", "364 Unit Tests", "GitHub Open Source"],
    ctaLabel: "Lihat Pratinjau GitHub",
    ctaHref: "#bab-9-github-preview",
    accentClass: "text-amber-300",
    borderActiveClass: "border-amber-400/60 bg-amber-500/10",
    icon: TerminalIcon,
  },
];

export function TargetUsersSection({
  id = "bab-7-target-pengguna",
  className,
}: TargetUsersSectionProps): ReactElement {
  const [selectedId, setSelectedId] = useState<string>(TARGET_PERSONAS[0]?.id ?? "mahasiswa");
  const activePersona =
    TARGET_PERSONAS.find((persona) => persona.id === selectedId) ?? TARGET_PERSONAS[0];

  return (
    <section id={id} className={cn("scroll-mt-20 space-y-6", className)}>
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="border-cyan-400/30 bg-cyan-500/10 font-mono text-[10px] text-cyan-300"
          >
            BAB 07
          </Badge>
          <Badge
            variant="outline"
            className="border-slate-700 bg-slate-900/70 text-[10px] text-slate-300"
          >
            <UsersIcon className="mr-1 size-3 text-cyan-400" aria-hidden="true" />
            MATRIKS PERSONA PENGGUNA
          </Badge>
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
          Target Pengguna &amp; Skenario Penggunaan
        </h2>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-300/85">
          IBDS dirancang melampaui tugas kuliah semata — melayani lima segmen pengguna dari ruang
          kelas mekanika struktur hingga pradesain insinyur, drafter CAD/BIM, dan peneliti perangkat
          lunak rekayasa.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TARGET_PERSONAS.map((persona) => {
          const Icon = persona.icon;
          const isSelected = persona.id === activePersona?.id;

          return (
            <button
              key={persona.id}
              type="button"
              onClick={() => setSelectedId(persona.id)}
              aria-pressed={isSelected}
              className={cn(
                glassPanelClass,
                "group flex flex-col justify-between p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-400/45",
                isSelected ? persona.borderActiveClass : "border-cyan-500/15",
              )}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "font-mono text-[10px] font-bold tracking-wider",
                      persona.accentClass,
                    )}
                  >
                    {persona.tag}
                  </span>
                  <Icon
                    className={cn(
                      "size-4 transition-transform duration-200 group-hover:scale-110",
                      persona.accentClass,
                    )}
                    aria-hidden="true"
                  />
                </div>
                <h3 className="mt-2 text-sm font-bold text-slate-100">{persona.role}</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-300/85">
                  <span className="font-semibold text-slate-200">Tantangan: </span>
                  {persona.painPoints}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  <span className="font-semibold text-slate-300">Alur di IBDS: </span>
                  {persona.workflow}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5 border-t border-cyan-500/10 pt-3">
                {persona.recommendedFeatures.map((feature) => (
                  <span
                    key={feature}
                    className="rounded border border-cyan-500/20 bg-[#050b16]/90 px-2 py-0.5 font-mono text-[10px] text-slate-300"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {activePersona ? (
        <div
          className={cn(
            glassPanelClass,
            "flex flex-col justify-between gap-4 border-cyan-400/25 p-4 sm:flex-row sm:items-center",
          )}
        >
          <div className="space-y-1">
            <p className="font-mono text-[10px] font-bold tracking-wider text-cyan-300 uppercase">
              REKOMENDASI JALUR CEPAT · {activePersona.role}
            </p>
            <p className="text-xs leading-relaxed text-slate-200">{activePersona.workflow}</p>
          </div>
          {activePersona.ctaHref.startsWith("#") ? (
            <Button
              asChild
              size="sm"
              className="shrink-0 bg-linear-to-r from-cyan-400 via-sky-400 to-violet-500 text-xs font-bold text-slate-950 hover:brightness-110"
            >
              <a href={activePersona.ctaHref}>
                <span>{activePersona.ctaLabel}</span>
                <ArrowRightIcon className="size-3.5" aria-hidden="true" />
              </a>
            </Button>
          ) : (
            <Button
              asChild
              size="sm"
              className="shrink-0 bg-linear-to-r from-cyan-400 via-sky-400 to-violet-500 text-xs font-bold text-slate-950 hover:brightness-110"
            >
              <Link href={activePersona.ctaHref} prefetch={false}>
                <span>{activePersona.ctaLabel}</span>
                <ArrowRightIcon className="size-3.5" aria-hidden="true" />
              </Link>
            </Button>
          )}
        </div>
      ) : null}
    </section>
  );
}

export default TargetUsersSection;
