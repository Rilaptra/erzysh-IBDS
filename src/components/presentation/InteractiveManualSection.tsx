"use client";

import {
  ArrowRightIcon,
  BookOpenIcon,
  DownloadIcon,
  ExternalLinkIcon,
  Gamepad2Icon,
  HandIcon,
  ImageIcon,
  MicIcon,
} from "lucide-react";
import Link from "next/link";
import { type ReactElement, useState } from "react";

import { glassPanelClass } from "@/components/landing/ErzyshPageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TUTORIAL_QUEST_STEPS } from "@/config/tutorial-steps-config";
import { GITHUB_REPO_URL } from "@/data/presentation/github-fallback-snapshot";
import { cn } from "@/lib/utils";

const STEP_SCREENSHOT_MAP: Readonly<Record<number, string>> = {
  1: "/presentation/manual/screenshots/02-desktop-steel.png",
  2: "/presentation/manual/screenshots/03-mode-a-loads.png",
  3: "/presentation/manual/screenshots/05-steel-params.png",
  4: "/presentation/manual/screenshots/08-concrete-wireframe.png",
  5: "/presentation/manual/screenshots/09-diagrams-window.png",
  6: "/presentation/manual/screenshots/06-steel-results.png",
  7: "/presentation/manual/screenshots/10-ai-assistant.png",
  8: "/presentation/manual/screenshots/12-export-modal.png",
  9: "/presentation/manual/screenshots/12-export-modal.png",
};

const HAND_GESTURES = [
  { symbol: "✋ ◎", code: "OPEN_PALM", action: "Kursor melayang (pointer hover) & reset kamera" },
  { symbol: "🤏 ⌖", code: "PINCH_CLICK", action: "Klik tombol UI atau geser posisi beban balok" },
  { symbol: "✊ ▼", code: "FIST_LOAD", action: "Tahan kamera atau tekan beban secara real-time" },
  { symbol: "☝️ ▸", code: "POINT_PRECISION", action: "Seleksi presisi elemen & inspeksi stasiun" },
  { symbol: "✌️ ▣", code: "TWO_FINGER_GRAB", action: "Geser posisi Floating Window di Desktop" },
] as const;

const EXPORT_MATRIX = [
  {
    format: ".dxf / .lsp",
    target: "AutoCAD / Civil 3D",
    note: "4 Layer AC1009 (Outline, Stirrup, Main, Dims) + AutoLISP",
  },
  {
    format: ".s2k",
    target: "CSI SAP2000 & ETABS",
    note: "Import via File → Import → SAP2000 .s2k Text File",
  },
  {
    format: ".ifc / .txt",
    target: "Revit & Tekla [Beta]",
    note: "IFC4 IfcBeam + IfcReinforcingBar & Type Catalog",
  },
  {
    format: ".iom.xml",
    target: "IDEA StatiCa [Beta]",
    note: "IDEA Open Model XML lengkap gaya dalam ekstrem",
  },
  {
    format: ".step / .stl",
    target: "SolidWorks / ANSYS [Beta]",
    note: "AP214 B-Rep Solid & 3D mesh balok terdefleksi",
  },
  {
    format: "Nota .PDF",
    target: "Laporan Teknik A4",
    note: "Lembar hitungan SNI berformat rumus KaTeX siap cetak",
  },
] as const;

type ReferenceTab = "MODES" | "MULTIMODAL" | "EXPORT_PDF";

export function InteractiveManualSection(): ReactElement {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [activeRefTab, setActiveRefTab] = useState<ReferenceTab>("MODES");
  const [failedImages, setFailedImages] = useState<ReadonlySet<string>>(() => new Set());

  const activeStep = TUTORIAL_QUEST_STEPS[activeStepIndex] ?? TUTORIAL_QUEST_STEPS[0]!;
  const screenshotSrc = STEP_SCREENSHOT_MAP[activeStep.stepNumber];
  const isImageMissing = !screenshotSrc || failedImages.has(screenshotSrc);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-[290px_minmax(0,1fr)]">
        <div
          className={cn(glassPanelClass, "flex flex-col gap-1.5 p-3")}
          role="tablist"
          aria-label="9 Langkah Panduan IBDS Engineer Quest"
        >
          <div className="flex items-center justify-between px-1 pb-1.5">
            <span className="flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-wider text-cyan-300">
              <Gamepad2Icon className="size-3.5" aria-hidden="true" />
              IBDS ENGINEER QUEST (9 MISI)
            </span>
          </div>
          {TUTORIAL_QUEST_STEPS.map((step, index) => {
            const isActive = index === activeStepIndex;
            return (
              <button
                key={step.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveStepIndex(index)}
                className={cn(
                  "flex items-center gap-2.5 rounded-md border px-2.5 py-2 text-left transition-colors",
                  isActive
                    ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-100"
                    : "border-transparent bg-[#060d19]/60 text-slate-300 hover:border-cyan-500/25 hover:bg-cyan-500/5",
                )}
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded font-mono text-[10px] font-bold",
                    isActive ? "bg-cyan-400 text-slate-950" : "bg-slate-800 text-slate-300",
                  )}
                >
                  {step.stepNumber}
                </span>
                <span className="line-clamp-1 text-xs font-medium">{step.title}</span>
              </button>
            );
          })}
        </div>

        <article className={cn(glassPanelClass, "flex flex-col justify-between gap-4 p-4 sm:p-5")}>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge
                variant="outline"
                className="border-cyan-400/35 bg-cyan-500/10 font-mono text-[10px] text-cyan-200"
              >
                {activeStep.badgeLabel}
              </Badge>
              {activeStep.mobileTab ? (
                <span className="font-mono text-[10px] text-slate-400">
                  Android Tab: <strong className="text-emerald-300">{activeStep.mobileTab}</strong>
                </span>
              ) : null}
            </div>

            <h3 className="mt-2 text-base font-bold text-slate-100 sm:text-lg">
              Langkah {activeStep.stepNumber}: {activeStep.title}
            </h3>

            <div className="mt-3 overflow-hidden rounded-lg border border-cyan-500/20 bg-[#050b16]">
              <div className="relative aspect-video w-full">
                {!isImageMissing && screenshotSrc ? (
                  <img
                    src={screenshotSrc}
                    alt={`Pratinjau langkah ${activeStep.stepNumber}: ${activeStep.title}`}
                    width={1280}
                    height={720}
                    loading="lazy"
                    decoding="async"
                    onError={() => {
                      setFailedImages((prev) => new Set(prev).add(screenshotSrc));
                    }}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
                    <ImageIcon className="size-8 text-cyan-400/50" aria-hidden="true" />
                    <p className="text-xs font-semibold text-slate-200">
                      Pratinjau Antarmuka — {activeStep.title}
                    </p>
                    <p className="max-w-md text-[11px] text-slate-400">
                      Jalankan{" "}
                      <code className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-cyan-300">
                        bun run presentation:sync-assets
                      </code>{" "}
                      untuk menyinkronkan tangkapan layar dari{" "}
                      <code className="font-mono">docs/screenshots/</code>.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-slate-200 sm:text-sm">
              <strong className="text-cyan-300">Target Misi:</strong> {activeStep.missionTitle}.{" "}
              {activeStep.missionDescription}
            </p>

            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              <div className="rounded-lg border border-amber-400/25 bg-amber-500/10 p-3">
                <p className="font-mono text-[10px] font-bold tracking-wider text-amber-300">
                  TIPS AI &ldquo;UCUY&rdquo;
                </p>
                <p className="mt-1 text-xs leading-relaxed text-amber-100/90">
                  &ldquo;{activeStep.ucuyDialogue}&rdquo;
                </p>
              </div>
              <div className="flex flex-col justify-between rounded-lg border border-cyan-500/20 bg-[#060d19]/85 p-3">
                <div>
                  <p className="flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-wider text-cyan-300">
                    <MicIcon className="size-3" aria-hidden="true" />
                    CONTOH PERINTAH SUARA
                  </p>
                  <p className="mt-1.5 font-mono text-xs text-slate-100">
                    &ldquo;{activeStep.voiceCommandExample}&rdquo;
                  </p>
                </div>
                {activeStep.acceptedCommandIds.length > 0 ? (
                  <p className="mt-2 font-mono text-[10px] text-slate-400">
                    Command ID: {activeStep.acceptedCommandIds.slice(0, 2).join(", ")}
                    {activeStep.acceptedCommandIds.length > 2
                      ? ` (+${activeStep.acceptedCommandIds.length - 2})`
                      : ""}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="no-print flex flex-wrap items-center justify-between gap-2 border-t border-cyan-500/15 pt-3">
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={activeStepIndex <= 0}
                onClick={() => setActiveStepIndex((i) => Math.max(0, i - 1))}
                className="h-7 border-cyan-500/25 bg-[#060d19] text-xs"
              >
                Sebelumnya
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={activeStepIndex >= TUTORIAL_QUEST_STEPS.length - 1}
                onClick={() =>
                  setActiveStepIndex((i) => Math.min(TUTORIAL_QUEST_STEPS.length - 1, i + 1))
                }
                className="h-7 border-cyan-500/25 bg-[#060d19] text-xs"
              >
                Berikutnya
              </Button>
            </div>

            <Button
              asChild
              size="sm"
              className="h-8 bg-linear-to-r from-cyan-400 via-sky-400 to-violet-500 px-3 text-xs font-bold text-slate-950 hover:brightness-110"
            >
              <Link href={`/simulator?tutorial=${activeStep.stepNumber}`} prefetch={false}>
                <span>Coba Misi #{activeStep.stepNumber} di Simulator</span>
                <ArrowRightIcon className="size-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </article>
      </div>

      <div className={cn(glassPanelClass, "p-4 sm:p-5")}>
        <div className="no-print flex flex-wrap items-center gap-2 border-b border-cyan-500/15 pb-3">
          {(
            [
              { id: "MODES", label: "Mode A vs Mode B" },
              { id: "MULTIMODAL", label: "Cheat Sheet Suara & 5 Gestur" },
              { id: "EXPORT_PDF", label: "9 Format Ekspor & Manual PDF" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveRefTab(tab.id)}
              aria-pressed={activeRefTab === tab.id}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors",
                activeRefTab === tab.id
                  ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-200"
                  : "border-cyan-500/15 bg-[#060d19]/75 text-slate-400 hover:text-slate-200",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeRefTab === "MODES" ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-cyan-500/20 bg-[#060d19]/80 p-4">
              <p className="font-mono text-[10px] font-bold text-cyan-300">
                MODE A · EXTERNAL LOADS (DESKTOP)
              </p>
              <p className="mt-1 text-sm font-bold text-slate-100">Pemodelan Beban Eksternal</p>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                Cocok untuk studi mekanika &amp; simulasi penuh: atur bentang L, pilih dari 9
                orientasi tumpuan, tambahkan beban titik P, beban merata q, momen M, serta hitung
                otomatis berat sendiri balok.
              </p>
              <Link
                href="/simulator?mode=MODE_A_EXTERNAL_LOADS"
                prefetch={false}
                className="no-print mt-3 inline-flex items-center gap-1 text-xs font-semibold text-cyan-300 hover:underline"
              >
                <span>Buka Mode A</span>
                <ArrowRightIcon className="size-3.5" aria-hidden="true" />
              </Link>
            </div>
            <div className="rounded-lg border border-violet-500/20 bg-[#060d19]/80 p-4">
              <p className="font-mono text-[10px] font-bold text-violet-300">
                MODE B · DIRECT FORCES (DESKTOP &amp; ANDROID)
              </p>
              <p className="mt-1 text-sm font-bold text-slate-100">Input Gaya Dalam Langsung</p>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                Cocok untuk preliminary design &amp; cek cepat lapangan: langsung masukkan gaya
                terfaktor Pu, Mux, Muy, Tu, Vu dari analisis portal global untuk mencari profil
                paling efisien (DCR 90–100%).
              </p>
              <Link
                href="/simulator?mode=MODE_B_DIRECT_INTERNAL_FORCES"
                prefetch={false}
                className="no-print mt-3 inline-flex items-center gap-1 text-xs font-semibold text-violet-300 hover:underline"
              >
                <span>Buka Mode B</span>
                <ArrowRightIcon className="size-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        ) : null}

        {activeRefTab === "MULTIMODAL" ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-cyan-500/15 bg-[#060d19]/80 p-3.5">
              <p className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                <MicIcon className="size-3.5" aria-hidden="true" />
                Wake-Word, Double-Clap &amp; 60 Perintah Suara
              </p>
              <ul className="mt-2 space-y-1.5 text-xs text-slate-300">
                <li>
                  • Aktivasi hands-free: ucapkan{" "}
                  <code className="rounded bg-slate-800 px-1 text-cyan-200">
                    &ldquo;halo ucuy&rdquo;
                  </code>{" "}
                  atau tepuk tangan ganda (<em>double-clap</em>).
                </li>
                <li>
                  • Contoh: &ldquo;ganti ke baja&rdquo;, &ldquo;tumpuan kantilever&rdquo;,
                  &ldquo;tampilkan BMD&rdquo;, &ldquo;filter box&rdquo;, &ldquo;ekspor
                  autocad&rdquo;.
                </li>
                <li>• Mendukung rotasi multi-key Gemini + fallback offline deterministik.</li>
              </ul>
            </div>
            <div className="rounded-lg border border-cyan-500/15 bg-[#060d19]/80 p-3.5">
              <p className="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
                <HandIcon className="size-3.5" aria-hidden="true" />5 Gestur Tangan MediaPipe
                (Eco-Mode 15–16 FPS)
              </p>
              <ul className="mt-2 space-y-1 text-xs text-slate-300">
                {HAND_GESTURES.map((g) => (
                  <li key={g.code} className="flex items-center gap-2">
                    <span className="w-12 shrink-0 font-mono text-cyan-300">{g.symbol}</span>
                    <span>{g.action}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        {activeRefTab === "EXPORT_PDF" ? (
          <div className="mt-4 flex flex-col gap-3">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {EXPORT_MATRIX.map((item) => (
                <div
                  key={item.format}
                  className="rounded-md border border-cyan-500/15 bg-[#060d19]/80 p-3"
                >
                  <p className="font-mono text-xs font-bold text-cyan-300">{item.format}</p>
                  <p className="text-[11px] font-semibold text-slate-200">{item.target}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{item.note}</p>
                </div>
              ))}
            </div>
            <div className="no-print flex flex-wrap items-center gap-2 pt-1">
              <Button
                asChild
                size="sm"
                variant="outline"
                className="border-cyan-500/35 bg-cyan-950/35 text-xs text-cyan-200"
              >
                <a href="/presentation/manual/Panduan_01_IBDS.pdf" download>
                  <DownloadIcon className="size-3.5" aria-hidden="true" />
                  <span>Unduh Panduan_01_IBDS.pdf (24 Slide)</span>
                </a>
              </Button>
              <Button asChild size="sm" variant="ghost" className="text-xs text-slate-300">
                <a
                  href={`${GITHUB_REPO_URL}/blob/main/USER_MANUAL.md`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <BookOpenIcon className="size-3.5" aria-hidden="true" />
                  <span>Baca USER_MANUAL.md di GitHub</span>
                  <ExternalLinkIcon className="size-3" aria-hidden="true" />
                </a>
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
