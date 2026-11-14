"use client";

import { CalendarIcon, RotateCcwIcon, SearchIcon, TagIcon } from "lucide-react";
import { type ReactElement, useId, useMemo, useState } from "react";

import {
  ChangelogCategoryBadge,
  ChangelogInlineText,
  getCategoryVisualMeta,
} from "@/components/changelog/ChangelogPrimitives";
import { glassPanelClass } from "@/components/landing/ErzyshPageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  type ChangelogCategoryKind,
  type ChangelogRelease,
  formatChangelogDate,
} from "@/lib/changelog-shared";
import { cn } from "@/lib/utils";

type CategoryFilter = "all" | ChangelogCategoryKind;

const FILTER_OPTIONS: readonly { readonly value: CategoryFilter; readonly label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "added", label: "Added" },
  { value: "performance", label: "Performance" },
  { value: "fixed", label: "Bug Fixes" },
  { value: "maintenance", label: "Maintenance" },
  { value: "docs", label: "Docs" },
];

export interface ChangelogExplorerProps {
  readonly releases: readonly ChangelogRelease[];
  readonly latestVersion?: string;
}

export function ChangelogExplorer({
  releases,
  latestVersion,
}: ChangelogExplorerProps): ReactElement {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const searchInputId = useId();

  const categoryCounts = useMemo(() => {
    const counts: Record<CategoryFilter, number> = {
      all: releases.length,
      added: 0,
      fixed: 0,
      performance: 0,
      maintenance: 0,
      docs: 0,
      other: 0,
    };

    for (const release of releases) {
      const seenKinds = new Set<ChangelogCategoryKind>();
      for (const section of release.sections) {
        if (!seenKinds.has(section.kind)) {
          seenKinds.add(section.kind);
          counts[section.kind] += 1;
        }
      }
    }

    return counts;
  }, [releases]);

  const filteredReleases = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return releases
      .map((release): ChangelogRelease | null => {
        const versionMatches =
          normalizedQuery.length > 0 &&
          (release.version.toLowerCase().includes(normalizedQuery) ||
            release.date.toLowerCase().includes(normalizedQuery));

        const matchingSections = release.sections
          .filter((section) => activeCategory === "all" || section.kind === activeCategory)
          .map((section) => {
            if (!normalizedQuery || versionMatches) return section;
            const titleMatches = section.title.toLowerCase().includes(normalizedQuery);
            if (titleMatches) return section;
            const items = section.items.filter((item) =>
              item.toLowerCase().includes(normalizedQuery),
            );
            return { ...section, items };
          })
          .filter((section) => section.items.length > 0);

        if (matchingSections.length === 0) return null;

        return {
          ...release,
          sections: matchingSections,
          totalItems: matchingSections.reduce((sum, s) => sum + s.items.length, 0),
        };
      })
      .filter((release): release is ChangelogRelease => release !== null);
  }, [releases, query, activeCategory]);

  const hasActiveFilters = query.trim().length > 0 || activeCategory !== "all";

  const resetFilters = (): void => {
    setQuery("");
    setActiveCategory("all");
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Search & Category Filter Toolbar */}
      <div className={cn(glassPanelClass, "flex flex-col gap-4 p-4 sm:p-5")}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative min-w-0 flex-1 md:max-w-sm">
            <label htmlFor={searchInputId} className="sr-only">
              Cari catatan rilis, versi, atau fitur
            </label>
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <Input
              id={searchInputId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari versi (0.6.16), fitur, atau modul..."
              className="border-cyan-500/20 bg-[#060d19]/80 pl-9 text-xs text-slate-100 placeholder:text-slate-500 focus-visible:border-cyan-400/60"
            />
          </div>

          <div
            className="flex flex-wrap items-center gap-1.5"
            role="group"
            aria-label="Filter kategori"
          >
            {FILTER_OPTIONS.map((option) => {
              const count = categoryCounts[option.value];
              if (option.value !== "all" && count === 0) return null;
              const isActive = activeCategory === option.value;

              return (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={isActive ? "default" : "outline"}
                  aria-pressed={isActive}
                  onClick={() => setActiveCategory(option.value)}
                  className={cn(
                    "h-7 gap-1.5 px-2.5 text-[11px]",
                    isActive
                      ? "bg-cyan-400 font-semibold text-slate-950 hover:bg-cyan-300"
                      : "border-cyan-500/20 bg-[#060d19]/70 text-slate-300 hover:border-cyan-400/45 hover:bg-cyan-500/10 hover:text-cyan-200",
                  )}
                >
                  <span>{option.label}</span>
                  <span
                    className={cn(
                      "font-mono text-[10px]",
                      isActive ? "text-slate-900/80" : "text-slate-500",
                    )}
                  >
                    {count}
                  </span>
                </Button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-cyan-500/10 pt-3 text-[11px] text-slate-400">
          <span>
            Menampilkan <strong className="text-slate-200">{filteredReleases.length}</strong> dari{" "}
            <strong className="text-slate-200">{releases.length}</strong> rilis
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 font-medium text-cyan-400 transition-colors hover:text-cyan-300"
            >
              <RotateCcwIcon className="size-3" aria-hidden="true" />
              <span>Reset filter</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content: Sticky Version Index + Release Timeline */}
      {filteredReleases.length === 0 ? (
        <Empty className={cn(glassPanelClass, "py-14")}>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TagIcon className="size-5 text-cyan-400" aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>Tidak ada catatan rilis yang cocok</EmptyTitle>
            <EmptyDescription>
              Coba kata kunci lain atau reset filter kategori untuk melihat semua rilis.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetFilters}
              className="border-cyan-500/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20"
            >
              <RotateCcwIcon data-icon="inline-start" aria-hidden="true" />
              <span>Tampilkan Semua Rilis</span>
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
          {/* Quick Version Index (Desktop Sticky Sidebar) */}
          <aside className="hidden lg:sticky lg:top-20 lg:block">
            <nav
              aria-label="Daftar versi rilis"
              className={cn(glassPanelClass, "flex flex-col gap-2 p-4")}
            >
              <p className="font-mono text-[10px] font-bold tracking-wider text-cyan-400 uppercase">
                Navigasi Versi
              </p>
              <ul className="flex max-h-[65dvh] flex-col gap-1 overflow-y-auto pr-1">
                {filteredReleases.map((release) => {
                  const isLatest = release.version === latestVersion;
                  return (
                    <li key={`nav-${release.version}`}>
                      <a
                        href={`#v${release.version}`}
                        className="flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs text-slate-300 transition-colors hover:bg-cyan-500/10 hover:text-cyan-200"
                      >
                        <span className="font-mono font-medium">v{release.version}</span>
                        {isLatest ? (
                          <span className="rounded bg-cyan-400/15 px-1.5 py-0.5 font-mono text-[9px] font-bold text-cyan-300">
                            NEW
                          </span>
                        ) : (
                          <span className="font-mono text-[10px] text-slate-500">
                            {release.date.slice(5)}
                          </span>
                        )}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </aside>

          {/* Vertical Timeline */}
          <ol className="relative flex min-w-0 flex-col gap-6 border-l border-cyan-500/20 pl-5 sm:pl-7">
            {filteredReleases.map((release) => {
              const isLatest = release.version === latestVersion;

              return (
                <li key={release.version} className="relative min-w-0">
                  {/* Timeline Node */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute top-6 -left-[25px] size-2.5 rounded-full border sm:-left-[33px]",
                      isLatest
                        ? "border-cyan-300 bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)]"
                        : "border-cyan-500/50 bg-[#0a1322]",
                    )}
                  />

                  <article
                    id={`v${release.version}`}
                    className={cn(
                      glassPanelClass,
                      "scroll-mt-24 p-5 transition-colors duration-200 sm:p-6",
                      isLatest ? "border-cyan-400/35" : "hover:border-cyan-400/30",
                    )}
                  >
                    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-500/15 pb-4">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h2 className="font-mono text-lg font-bold text-white sm:text-xl">
                          <a
                            href={`#v${release.version}`}
                            className="transition-colors hover:text-cyan-300"
                          >
                            v{release.version}
                          </a>
                        </h2>
                        {isLatest && (
                          <Badge className="bg-linear-to-r from-cyan-400 via-sky-400 to-violet-500 font-mono text-[10px] font-bold text-slate-950">
                            TERBARU
                          </Badge>
                        )}
                        <span className="font-mono text-[11px] text-slate-500">
                          {release.totalItems} perubahan
                        </span>
                      </div>

                      <time
                        dateTime={release.date}
                        className="inline-flex items-center gap-1.5 font-mono text-xs text-slate-400"
                      >
                        <CalendarIcon className="size-3.5 text-cyan-400/80" aria-hidden="true" />
                        <span>{formatChangelogDate(release.date)}</span>
                      </time>
                    </header>

                    <div className="mt-4 flex flex-col gap-5">
                      {release.sections.map((section) => {
                        const meta = getCategoryVisualMeta(section.kind);
                        return (
                          <section
                            key={`${release.version}-${section.title}`}
                            className="flex flex-col gap-2.5"
                          >
                            <div className="flex items-center gap-2">
                              <ChangelogCategoryBadge section={section} />
                              <span className="font-mono text-[10px] text-slate-500">
                                ({section.items.length})
                              </span>
                            </div>
                            <ul className="flex flex-col gap-2 pl-1">
                              {section.items.map((item, idx) => (
                                <li
                                  key={`${release.version}-${section.title}-${idx}`}
                                  className="flex items-start gap-2.5 text-xs leading-relaxed text-slate-300 sm:text-[13px]"
                                >
                                  <span
                                    aria-hidden="true"
                                    className={cn(
                                      "mt-2 size-1.5 shrink-0 rounded-full bg-current",
                                      meta.accentText,
                                    )}
                                  />
                                  <ChangelogInlineText text={item} className="min-w-0 flex-1" />
                                </li>
                              ))}
                            </ul>
                          </section>
                        );
                      })}
                    </div>
                  </article>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}

export default ChangelogExplorer;
