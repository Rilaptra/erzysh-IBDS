"use client";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  LayoutGridIcon,
  Maximize2Icon,
  Minimize2Icon,
  XIcon,
} from "lucide-react";
import { type MouseEvent, type ReactElement, useEffect, useRef } from "react";

import { glassPanelClass } from "@/components/landing/ErzyshPageShell";
import { Button } from "@/components/ui/button";
import {
  getChapterBySlideNumber,
  PRESENTATION_CHAPTERS,
  TOTAL_PRESENTATION_SLIDES,
} from "@/data/presentation/chapters";
import { cn } from "@/lib/utils";

export interface PresentationDeckHudProps {
  readonly activeSlide: number;
  readonly isFullscreen: boolean;
  readonly isJumpOpen: boolean;
  readonly onPrev: () => void;
  readonly onNext: () => void;
  readonly onSelectSlide: (slideNumber: number) => void;
  readonly onToggleJump: (open: boolean) => void;
  readonly onToggleFullscreen: () => void;
  readonly onExitDeck: () => void;
}

export function PresentationDeckHud({
  activeSlide,
  isFullscreen,
  isJumpOpen,
  onPrev,
  onNext,
  onSelectSlide,
  onToggleJump,
  onToggleFullscreen,
  onExitDeck,
}: PresentationDeckHudProps): ReactElement {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const currentChapter = getChapterBySlideNumber(activeSlide);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.setAttribute("closedby", "any");
    if (isJumpOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isJumpOpen && dialog.open) {
      dialog.close();
    }
  }, [isJumpOpen]);

  const handleBackdropClick = (event: MouseEvent<HTMLDialogElement>): void => {
    // Fallback for browsers without native closedby="any" backdrop dismiss
    const dialog = dialogRef.current;
    if (!dialog || event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    const isInside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    if (!isInside) {
      onToggleJump(false);
    }
  };

  return (
    <>
      <div className="no-print pointer-events-none fixed inset-x-0 bottom-3 z-40 flex justify-center px-3">
        <div
          className={cn(
            glassPanelClass,
            "pointer-events-auto flex flex-wrap items-center gap-2 border-cyan-400/25 px-3 py-2",
          )}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onPrev}
            disabled={activeSlide <= 1}
            className="h-7 border-cyan-500/25 bg-[#060d19] px-2 text-xs"
            aria-label="Slide sebelumnya"
          >
            <ChevronLeftIcon className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Prev</span>
          </Button>

          <button
            type="button"
            onClick={() => onToggleJump(true)}
            className="flex items-center gap-2 rounded-md border border-cyan-500/20 bg-[#060d19]/90 px-2.5 py-1 text-xs transition-colors hover:border-cyan-400/50"
            title="Lompat cepat ke slide (G)"
          >
            <span className="font-mono font-bold text-cyan-300 tabular-nums">
              {String(activeSlide).padStart(2, "0")} / {TOTAL_PRESENTATION_SLIDES}
            </span>
            <span className="hidden text-slate-500 sm:inline">•</span>
            <span className="hidden max-w-48 truncate text-slate-200 sm:inline">
              {currentChapter.shortTitle}
            </span>
            <LayoutGridIcon className="size-3.5 text-cyan-400" aria-hidden="true" />
          </button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onNext}
            disabled={activeSlide >= TOTAL_PRESENTATION_SLIDES}
            className="h-7 border-cyan-500/25 bg-[#060d19] px-2 text-xs"
            aria-label="Slide berikutnya"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRightIcon className="size-3.5" aria-hidden="true" />
          </Button>

          <div className="mx-0.5 hidden h-4 w-px bg-cyan-500/20 sm:block" aria-hidden="true" />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggleFullscreen}
            className="h-7 px-2 text-[11px] text-slate-300"
            title="Toggle Layar Penuh (F)"
          >
            {isFullscreen ? (
              <Minimize2Icon className="size-3.5" aria-hidden="true" />
            ) : (
              <Maximize2Icon className="size-3.5" aria-hidden="true" />
            )}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onExitDeck}
            className="h-7 px-2 text-[11px] text-slate-300 hover:text-cyan-200"
          >
            Scroll (D)
          </Button>
        </div>
      </div>

      <dialog
        ref={dialogRef}
        className="erzysh-native-dialog no-print"
        aria-labelledby="quick-jump-dialog-title"
        onClose={() => onToggleJump(false)}
        onClick={handleBackdropClick}
      >
        <div className={cn(glassPanelClass, "w-[min(92vw,42rem)] p-4 sm:p-5")}>
          <div className="flex items-center justify-between border-b border-cyan-500/15 pb-3">
            <div>
              <p className="font-mono text-[10px] tracking-wider text-cyan-400">
                QUICK SLIDE JUMP (G)
              </p>
              <h2 id="quick-jump-dialog-title" className="text-sm font-bold text-slate-100">
                Pilih Bab / Slide Presentasi
              </h2>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onToggleJump(false)}
              aria-label="Tutup pemilih slide"
            >
              <XIcon className="size-4" aria-hidden="true" />
            </Button>
          </div>

          <ol className="mt-3 grid max-h-[65dvh] gap-2 overflow-y-auto sm:grid-cols-2">
            {PRESENTATION_CHAPTERS.map((chapter) => {
              const isCurrent = chapter.slideNumber === activeSlide;
              return (
                <li key={chapter.id}>
                  <button
                    type="button"
                    aria-current={isCurrent ? "step" : undefined}
                    onClick={() => {
                      onSelectSlide(chapter.slideNumber);
                      onToggleJump(false);
                    }}
                    className={cn(
                      "flex w-full items-start gap-2.5 rounded-lg border p-2.5 text-left transition-colors",
                      isCurrent
                        ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-100"
                        : "border-cyan-500/15 bg-[#060d19]/80 text-slate-300 hover:border-cyan-400/40 hover:bg-cyan-500/10",
                    )}
                  >
                    <span className="mt-0.5 rounded bg-cyan-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-cyan-300">
                      {chapter.code}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold">{chapter.shortTitle}</p>
                      <p className="line-clamp-1 text-[11px] text-slate-400">{chapter.subtitle}</p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </dialog>
    </>
  );
}
