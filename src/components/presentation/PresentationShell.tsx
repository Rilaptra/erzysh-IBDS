"use client";

import { KeyboardIcon, XIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import type { MouseEvent, ReactElement } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { glassPanelClass } from "@/components/landing/ErzyshPageShell";
import { AppIdentityAndFeaturesSection } from "@/components/presentation/AppIdentityAndFeaturesSection";
import { DevelopmentProcessTimeline } from "@/components/presentation/DevelopmentProcessTimeline";
import { GitHubFeedbackComposer } from "@/components/presentation/GitHubFeedbackComposer";
import { GitHubIframePreviewSection } from "@/components/presentation/GitHubIframePreviewSection";
import { HeroExecutiveSection } from "@/components/presentation/HeroExecutiveSection";
import { InteractiveManualSection } from "@/components/presentation/InteractiveManualSection";
import { PresentationDeckHud } from "@/components/presentation/PresentationDeckHud";
import { PresentationHeader } from "@/components/presentation/PresentationHeader";
import { PurposeAndObjectivesSection } from "@/components/presentation/PurposeAndObjectivesSection";
import { QualityAttributesSection } from "@/components/presentation/QualityAttributesSection";
import { ShippedUpdatesSection } from "@/components/presentation/ShippedUpdatesSection";
import { TargetUsersSection } from "@/components/presentation/TargetUsersSection";
import {
  type RenderedCalculationSource,
  ValidationProofSection,
} from "@/components/presentation/ValidationProofSection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getChapterBySlideNumber,
  PRESENTATION_CHAPTERS,
  TOTAL_PRESENTATION_SLIDES,
} from "@/data/presentation/chapters";
import { VALIDATION_CASE_CARDS } from "@/data/presentation/validation-cases";
import type { ChangelogRelease } from "@/lib/changelog-shared";
import { cn } from "@/lib/utils";
import type {
  PresentationChapterMeta,
  PresentationViewMode,
  ValidationCaseCard,
} from "@/types/presentation-types";

export interface PresentationShellProps {
  readonly releases: readonly ChangelogRelease[];
  readonly calculationSources: readonly RenderedCalculationSource[];
  readonly seedValidationCards?: readonly ValidationCaseCard[];
}

const KEYBOARD_SHORTCUTS = [
  { keys: "→ / PageDown / Space", desc: "Pindah ke slide berikutnya (Deck Mode)" },
  { keys: "← / PageUp", desc: "Pindah ke slide sebelumnya (Deck Mode)" },
  { keys: "Home / End", desc: "Lompat ke Slide 01 atau Slide terakhir" },
  { keys: "F", desc: "Toggle Fullscreen & masuk Mode Slide Deck" },
  { keys: "D", desc: "Beralih antara Mode Scroll dan Mode Slide Deck" },
  { keys: "G", desc: "Buka pemilih cepat slide (Quick Jump)" },
  { keys: "?", desc: "Buka / tutup panduan pintasan keyboard" },
  { keys: "Esc", desc: "Tutup dialog aktif atau keluar dari Fullscreen" },
] as const;

function ChapterHeading({ chapter }: { readonly chapter: PresentationChapterMeta }): ReactElement {
  return (
    <header className="mb-6 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className="border-cyan-400/30 bg-cyan-500/10 font-mono text-[10px] text-cyan-300"
        >
          BAB {chapter.code}
        </Badge>
        <Badge
          variant="outline"
          className="border-slate-700 bg-slate-900/70 font-mono text-[10px] text-slate-300"
        >
          SLIDE {String(chapter.slideNumber).padStart(2, "0")} / {TOTAL_PRESENTATION_SLIDES}
        </Badge>
      </div>
      <h2 className="text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
        {chapter.title}
      </h2>
      <p className="max-w-3xl text-sm leading-relaxed text-slate-300/85">{chapter.subtitle}</p>
    </header>
  );
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function PresentationShell({
  releases,
  calculationSources,
  seedValidationCards = VALIDATION_CASE_CARDS,
}: PresentationShellProps): ReactElement {
  const searchParams = useSearchParams();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const shortcutsDialogRef = useRef<HTMLDialogElement | null>(null);

  const initialView: PresentationViewMode = searchParams.get("view") === "deck" ? "deck" : "scroll";
  const parsedSlide = Number.parseInt(searchParams.get("slide") ?? "1", 10);
  const initialSlide = Number.isFinite(parsedSlide)
    ? Math.min(Math.max(parsedSlide, 1), TOTAL_PRESENTATION_SLIDES)
    : 1;
  const isCleanPresenterMode = searchParams.get("presenter") === "clean";

  const [viewMode, setViewMode] = useState<PresentationViewMode>(initialView);
  const [activeSlide, setActiveSlide] = useState<number>(initialSlide);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isJumpOpen, setIsJumpOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  const syncUrlParams = useCallback((nextView: PresentationViewMode, nextSlide: number) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (nextView === "deck") {
      url.searchParams.set("view", "deck");
      url.searchParams.set("slide", String(nextSlide));
    } else {
      url.searchParams.delete("view");
      url.searchParams.delete("slide");
    }
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, []);

  const handleChangeViewMode = useCallback(
    (nextMode: PresentationViewMode) => {
      setViewMode(nextMode);
      setIsJumpOpen(false);
      syncUrlParams(nextMode, activeSlide);
    },
    [activeSlide, syncUrlParams],
  );

  const handleJumpToSlide = useCallback(
    (slideNumber: number) => {
      const clamped = Math.min(Math.max(slideNumber, 1), TOTAL_PRESENTATION_SLIDES);
      setActiveSlide(clamped);
      setIsJumpOpen(false);

      if (viewMode === "deck") {
        syncUrlParams("deck", clamped);
        return;
      }

      const chapter = getChapterBySlideNumber(clamped);
      const targetEl = document.getElementById(chapter.id);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
    [syncUrlParams, viewMode],
  );

  const handleToggleFullscreen = useCallback(() => {
    if (typeof document === "undefined") return;
    if (!document.fullscreenElement) {
      setViewMode("deck");
      syncUrlParams("deck", activeSlide);
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, [activeSlide, syncUrlParams]);

  const handlePrint = useCallback(() => {
    if (typeof window !== "undefined") {
      window.print();
    }
  }, []);

  useEffect(() => {
    const handleFsChange = (): void => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  useEffect(() => {
    const dialog = shortcutsDialogRef.current;
    if (!dialog) return;
    dialog.setAttribute("closedby", "any");
    if (isShortcutsOpen) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isShortcutsOpen]);

  useEffect(() => {
    if (viewMode !== "scroll") return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = (): void => {
      const maxScroll = container.scrollHeight - container.clientHeight;
      setScrollProgress(
        maxScroll > 0 ? Math.min(1, Math.max(0, container.scrollTop / maxScroll)) : 0,
      );
    };

    handleScroll();
    container.addEventListener("scroll", handleScroll, { passive: true });

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const matched = PRESENTATION_CHAPTERS.find((c) => c.id === entry.target.id);
          if (matched) {
            setActiveSlide(matched.slideNumber);
          }
        }
      },
      {
        root: container,
        rootMargin: "-25% 0px -55% 0px",
        threshold: 0.05,
      },
    );

    for (const chapter of PRESENTATION_CHAPTERS) {
      const el = document.getElementById(chapter.id);
      if (el) observer.observe(el);
    }

    return () => {
      container.removeEventListener("scroll", handleScroll);
      observer.disconnect();
    };
  }, [viewMode]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (isEditableTarget(event.target)) return;
      if (document.querySelector("dialog[open]") && event.key !== "Escape") return;

      if (event.key === "?") {
        event.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
        return;
      }

      if (event.key === "g" || event.key === "G") {
        event.preventDefault();
        if (viewMode !== "deck") {
          handleChangeViewMode("deck");
        }
        setIsJumpOpen((prev) => !prev);
        return;
      }

      if (event.key === "d" || event.key === "D") {
        event.preventDefault();
        handleChangeViewMode(viewMode === "deck" ? "scroll" : "deck");
        return;
      }

      if (event.key === "f" || event.key === "F") {
        event.preventDefault();
        handleToggleFullscreen();
        return;
      }

      if (viewMode === "deck") {
        if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
          event.preventDefault();
          handleJumpToSlide(activeSlide + 1);
        } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
          event.preventDefault();
          handleJumpToSlide(activeSlide - 1);
        } else if (event.key === "Home") {
          event.preventDefault();
          handleJumpToSlide(1);
        } else if (event.key === "End") {
          event.preventDefault();
          handleJumpToSlide(TOTAL_PRESENTATION_SLIDES);
        }
      } else if (event.key === "Home") {
        scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      } else if (event.key === "End") {
        const el = scrollContainerRef.current;
        el?.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeSlide, handleChangeViewMode, handleJumpToSlide, handleToggleFullscreen, viewMode]);

  const handleShortcutsBackdrop = (event: MouseEvent<HTMLDialogElement>): void => {
    const dialog = shortcutsDialogRef.current;
    if (!dialog || event.target !== dialog) return;
    if (event.clientX === 0 && event.clientY === 0) return;
    const rect = dialog.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    ) {
      setIsShortcutsOpen(false);
    }
  };

  const activeChapter = getChapterBySlideNumber(activeSlide);
  const progressScale =
    viewMode === "deck" ? activeSlide / TOTAL_PRESENTATION_SLIDES : scrollProgress;

  const renderChapterBody = (chapter: PresentationChapterMeta): ReactElement => {
    switch (chapter.id) {
      case "hero":
        return (
          <HeroExecutiveSection
            totalReleasesCount={releases.length}
            onStartDeckMode={() => handleChangeViewMode("deck")}
          />
        );
      case "bab-1-identitas-fitur":
        return (
          <>
            <ChapterHeading chapter={chapter} />
            <AppIdentityAndFeaturesSection />
          </>
        );
      case "bab-2-fungsi-tujuan":
        return (
          <>
            <ChapterHeading chapter={chapter} />
            <PurposeAndObjectivesSection />
          </>
        );
      case "bab-3-proses-pengembangan":
        return (
          <>
            <ChapterHeading chapter={chapter} />
            <DevelopmentProcessTimeline />
          </>
        );
      case "bab-4-riwayat-update":
        return (
          <>
            <ChapterHeading chapter={chapter} />
            <ShippedUpdatesSection releases={releases} />
          </>
        );
      case "bab-5-tutorial-panduan":
        return (
          <>
            <ChapterHeading chapter={chapter} />
            <InteractiveManualSection />
          </>
        );
      case "bab-6-sumber-validasi":
        return (
          <ValidationProofSection
            id={chapter.id}
            calculationSources={calculationSources}
            seedCards={seedValidationCards}
            isCleanPresenterMode={isCleanPresenterMode}
          />
        );
      case "bab-7-target-pengguna":
        return <TargetUsersSection id={chapter.id} />;
      case "bab-8-kualitas-sistem":
        return <QualityAttributesSection id={chapter.id} />;
      case "bab-9-github-preview":
        return <GitHubIframePreviewSection id={chapter.id} />;
      case "bab-10-masukan-issue":
        return <GitHubFeedbackComposer id={chapter.id} validationCases={seedValidationCards} />;
    }
  };

  return (
    <div
      ref={scrollContainerRef}
      className={cn(
        "erzysh-presentation-shell text-foreground relative h-dvh w-full bg-[#050a14] select-text",
        viewMode === "deck"
          ? "flex flex-col overflow-hidden"
          : "overflow-x-hidden overflow-y-auto scroll-smooth",
      )}
    >
      <a
        href="#presentation-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-cyan-400 focus:px-3 focus:py-1.5 focus:text-xs focus:font-bold focus:text-slate-950"
      >
        Langsung ke konten utama
      </a>

      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 opacity-85"
        style={{
          backgroundImage:
            "linear-gradient(to right, #122133 1px, transparent 1px), linear-gradient(to bottom, #122133 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage: "radial-gradient(circle at 50% 40%, black 45%, transparent 95%)",
          WebkitMaskImage: "radial-gradient(circle at 50% 40%, black 45%, transparent 95%)",
        }}
      />
      <div
        aria-hidden="true"
        className="erzysh-glow-pulse pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(circle at 22% 28%, rgba(34, 211, 238, 0.11) 0%, transparent 52%), radial-gradient(circle at 80% 42%, rgba(139, 92, 246, 0.11) 0%, transparent 55%)",
        }}
      />

      <div
        aria-hidden="true"
        className="no-print fixed top-0 right-0 left-0 z-50 h-0.5 origin-left bg-linear-to-r from-cyan-400 via-sky-400 to-violet-500 transition-transform duration-150"
        style={{ transform: `scaleX(${progressScale})` }}
      />

      <div aria-live="polite" className="sr-only">
        Slide {activeChapter.slideNumber} dari {TOTAL_PRESENTATION_SLIDES}: {activeChapter.title}
      </div>

      <PresentationHeader
        viewMode={viewMode}
        activeSlide={activeSlide}
        isFullscreen={isFullscreen}
        onChangeViewMode={handleChangeViewMode}
        onJumpToSlide={handleJumpToSlide}
        onToggleFullscreen={handleToggleFullscreen}
        onPrint={handlePrint}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
      />

      {viewMode === "deck" ? (
        <>
          <main
            id="presentation-main-content"
            className="relative flex-1 overflow-y-auto px-4 pt-6 pb-28 sm:px-6"
          >
            <div className="mx-auto max-w-5xl">{renderChapterBody(activeChapter)}</div>
          </main>

          <PresentationDeckHud
            activeSlide={activeSlide}
            isFullscreen={isFullscreen}
            isJumpOpen={isJumpOpen}
            onPrev={() => handleJumpToSlide(activeSlide - 1)}
            onNext={() => handleJumpToSlide(activeSlide + 1)}
            onSelectSlide={handleJumpToSlide}
            onToggleJump={setIsJumpOpen}
            onToggleFullscreen={handleToggleFullscreen}
            onExitDeck={() => handleChangeViewMode("scroll")}
          />
        </>
      ) : (
        <div className="relative mx-auto max-w-[1380px] px-4 py-8 sm:px-6 xl:grid xl:grid-cols-[240px_minmax(0,1fr)] xl:items-start xl:gap-8">
          <aside
            aria-label="Daftar bab presentasi"
            className={cn(
              glassPanelClass,
              "no-print sticky top-20 hidden max-h-[calc(100dvh-6.5rem)] overflow-y-auto p-3 xl:block",
            )}
          >
            <p className="mb-2 px-2 font-mono text-[10px] font-bold tracking-wider text-cyan-300 uppercase">
              NAVIGASI BAB (11 SLIDE)
            </p>
            <ol className="space-y-1">
              {PRESENTATION_CHAPTERS.map((chapter) => {
                const isActive = chapter.slideNumber === activeSlide;
                return (
                  <li key={chapter.id}>
                    <button
                      type="button"
                      onClick={() => handleJumpToSlide(chapter.slideNumber)}
                      aria-current={isActive ? "location" : undefined}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                        isActive
                          ? "border border-cyan-400/40 bg-cyan-500/15 font-semibold text-cyan-100"
                          : "border border-transparent text-slate-400 hover:bg-cyan-500/5 hover:text-slate-200",
                      )}
                    >
                      <span className="font-mono text-[10px] text-cyan-400">{chapter.code}</span>
                      <span className="truncate">{chapter.shortTitle}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </aside>

          <main
            id="presentation-main-content"
            className="mx-auto w-full max-w-5xl space-y-20 pb-24"
          >
            {PRESENTATION_CHAPTERS.map((chapter) => (
              <div key={chapter.id} id={chapter.id} className="scroll-mt-20 print:break-after-page">
                {renderChapterBody(chapter)}
              </div>
            ))}
          </main>
        </div>
      )}

      <dialog
        ref={shortcutsDialogRef}
        aria-labelledby="presentation-shortcuts-title"
        onCancel={(event) => {
          event.preventDefault();
          setIsShortcutsOpen(false);
        }}
        onClick={handleShortcutsBackdrop}
        className={cn(
          glassPanelClass,
          "text-foreground m-auto w-[min(92vw,460px)] overflow-hidden overscroll-contain border-cyan-400/30 bg-[#071020]/96 p-0 shadow-2xl backdrop:bg-black/75 backdrop:backdrop-blur-xs",
        )}
      >
        <div className="flex items-center justify-between border-b border-cyan-500/20 px-4 py-3">
          <div className="flex items-center gap-2">
            <KeyboardIcon className="size-4 text-cyan-400" aria-hidden="true" />
            <h3 id="presentation-shortcuts-title" className="text-sm font-bold text-slate-100">
              Pintasan Keyboard Presentasi
            </h3>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsShortcutsOpen(false)}
            className="h-7 px-2 text-slate-300"
            aria-label="Tutup panduan pintasan keyboard"
          >
            <XIcon className="size-4" aria-hidden="true" />
          </Button>
        </div>
        <dl className="divide-y divide-cyan-500/10 p-4">
          {KEYBOARD_SHORTCUTS.map((item) => (
            <div key={item.keys} className="flex items-center justify-between gap-4 py-2 text-xs">
              <dt className="shrink-0 rounded border border-cyan-500/25 bg-[#050b16] px-2 py-0.5 font-mono text-[11px] font-semibold text-cyan-300">
                {item.keys}
              </dt>
              <dd className="text-right text-slate-300">{item.desc}</dd>
            </div>
          ))}
        </dl>
      </dialog>
    </div>
  );
}

export default PresentationShell;
