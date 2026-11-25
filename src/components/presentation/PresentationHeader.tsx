"use client";

import {
  ArrowLeftIcon,
  Maximize2Icon,
  Minimize2Icon,
  PresentationIcon,
  PrinterIcon,
  RulerIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactElement } from "react";

import { glassPanelClass } from "@/components/landing/ErzyshPageShell";
import { Button } from "@/components/ui/button";
import { PRESENTATION_CHAPTERS } from "@/data/presentation/chapters";
import { cn } from "@/lib/utils";
import type { PresentationViewMode } from "@/types/presentation-types";

export interface PresentationHeaderProps {
  readonly viewMode: PresentationViewMode;
  readonly activeSlide: number;
  readonly isFullscreen: boolean;
  readonly onChangeViewMode: (mode: PresentationViewMode) => void;
  readonly onJumpToSlide: (slideNumber: number) => void;
  readonly onToggleFullscreen: () => void;
  readonly onPrint: () => void;
  readonly onOpenShortcuts: () => void;
}

export function PresentationHeader({
  viewMode,
  activeSlide,
  isFullscreen,
  onChangeViewMode,
  onJumpToSlide,
  onToggleFullscreen,
  onPrint,
  onOpenShortcuts,
}: PresentationHeaderProps): ReactElement {
  return (
    <header className="no-print sticky top-0 z-40 px-4 pt-3 sm:px-6">
      <nav
        aria-label="Navigasi presentasi"
        className={cn(
          glassPanelClass,
          "mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-3 py-1.5",
        )}
      >
        <div className="flex items-center gap-2">
          <Link
            href="/"
            prefetch={false}
            className="flex items-center gap-2 text-xs font-bold tracking-wider"
          >
            <RulerIcon className="size-4 text-cyan-400" aria-hidden="true" />
            <span>IBDS</span>
          </Link>
          <span className="text-slate-600" aria-hidden="true">
            /
          </span>
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-cyan-300">
            <PresentationIcon className="size-3.5" aria-hidden="true" />
            <span>Presentasi</span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <label className="sr-only" htmlFor="mobile-chapter-select">
            Pilih bab presentasi
          </label>
          <select
            id="mobile-chapter-select"
            value={activeSlide}
            onChange={(e) => onJumpToSlide(Number(e.target.value))}
            className="h-7 max-w-44 rounded-md border border-cyan-500/25 bg-[#060d19] px-2 text-[11px] text-slate-200 xl:hidden"
          >
            {PRESENTATION_CHAPTERS.map((chapter) => (
              <option key={chapter.id} value={chapter.slideNumber}>
                {chapter.code}. {chapter.shortTitle}
              </option>
            ))}
          </select>

          <div
            role="group"
            aria-label="Mode tampilan presentasi"
            className="flex items-center rounded-md border border-cyan-500/20 bg-[#060d19]/90 p-0.5"
          >
            <button
              type="button"
              onClick={() => onChangeViewMode("scroll")}
              aria-pressed={viewMode === "scroll"}
              className={cn(
                "rounded px-2 py-1 text-[11px] font-medium transition-colors",
                viewMode === "scroll"
                  ? "bg-cyan-500/20 text-cyan-200"
                  : "text-slate-400 hover:text-slate-200",
              )}
            >
              Scroll
            </button>
            <button
              type="button"
              onClick={() => onChangeViewMode("deck")}
              aria-pressed={viewMode === "deck"}
              className={cn(
                "rounded px-2 py-1 text-[11px] font-medium transition-colors",
                viewMode === "deck"
                  ? "bg-cyan-500/20 text-cyan-200"
                  : "text-slate-400 hover:text-slate-200",
              )}
            >
              Slide (D)
            </button>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggleFullscreen}
            title="Mode Slide Layar Penuh (F)"
            className="hidden h-7 px-2 text-[11px] text-slate-300 hover:text-cyan-200 sm:inline-flex"
          >
            {isFullscreen ? (
              <Minimize2Icon className="size-3.5" aria-hidden="true" />
            ) : (
              <Maximize2Icon className="size-3.5" aria-hidden="true" />
            )}
            <span className="ml-1 hidden md:inline">{isFullscreen ? "Keluar" : "Layar Penuh"}</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onPrint}
            title="Cetak atau Simpan PDF (Ctrl+P)"
            className="hidden h-7 px-2 text-[11px] text-slate-300 hover:text-cyan-200 md:inline-flex"
          >
            <PrinterIcon className="size-3.5" aria-hidden="true" />
            <span className="ml-1">Cetak PDF</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onOpenShortcuts}
            title="Pintasan Keyboard (?)"
            className="hidden h-7 px-2 text-[11px] text-slate-400 hover:text-cyan-200 lg:inline-flex"
          >
            <SlidersHorizontalIcon className="size-3.5" aria-hidden="true" />
          </Button>

          <Button
            asChild
            variant="ghost"
            size="sm"
            className="hidden h-7 px-2 text-[11px] text-slate-300 sm:inline-flex"
          >
            <Link href="/" prefetch={false}>
              <ArrowLeftIcon className="size-3.5" aria-hidden="true" />
              <span className="ml-1">Beranda</span>
            </Link>
          </Button>

          <Button
            asChild
            size="sm"
            className="h-7 bg-linear-to-r from-cyan-400 via-sky-400 to-violet-500 px-2.5 text-[11px] font-bold text-slate-950 transition-all hover:brightness-110"
          >
            <Link href="/simulator" prefetch={false}>
              Simulator
            </Link>
          </Button>
        </div>
      </nav>
    </header>
  );
}
