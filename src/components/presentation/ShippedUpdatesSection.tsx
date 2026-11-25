"use client";

import { ArrowRightIcon, ChevronDownIcon, HistoryIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { type ReactElement, useMemo, useState } from "react";

import { glassPanelClass } from "@/components/landing/ErzyshPageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { APP_VERSION } from "@/config/version";
import { getUpdateHighlight } from "@/data/presentation/update-highlights";
import {
  type ChangelogCategoryKind,
  type ChangelogRelease,
  formatChangelogDate,
  parseInlineMarkdown,
} from "@/lib/changelog-shared";
import { cn } from "@/lib/utils";

export interface ShippedUpdatesSectionProps {
  readonly releases: readonly ChangelogRelease[];
}

type FilterCategory = "all" | Exclude<ChangelogCategoryKind, "other">;

const CATEGORY_FILTERS: ReadonlyArray<{ readonly key: FilterCategory; readonly label: string }> = [
  { key: "all", label: "Semua" },
  { key: "added", label: "Added" },
  { key: "performance", label: "Performance" },
  { key: "fixed", label: "Fixed" },
  { key: "docs", label: "Docs" },
  { key: "maintenance", label: "Maintenance" },
];

function RenderInlineTokens({ text }: { readonly text: string }): ReactElement {
  const tokens = parseInlineMarkdown(text);
  return (
    <>
      {tokens.map((token, idx) => {
        if (token.type === "code") {
          return (
            <code
              key={`${idx}-${token.value}`}
              className="rounded bg-cyan-500/10 px-1 py-0.5 font-mono text-[11px] text-cyan-200"
            >
              {token.value}
            </code>
          );
        }
        if (token.type === "bold") {
          return (
            <strong key={`${idx}-${token.value}`} className="font-semibold text-slate-100">
              {token.value}
            </strong>
          );
        }
        return <span key={`${idx}-${token.value}`}>{token.value}</span>;
      })}
    </>
  );
}

export function ShippedUpdatesSection({ releases }: ShippedUpdatesSectionProps): ReactElement {
  const [selectedCategory, setSelectedCategory] = useState<FilterCategory>("all");
  const [expandedVersions, setExpandedVersions] = useState<ReadonlySet<string>>(
    () => new Set(releases.slice(0, 3).map((r) => r.version)),
  );
  const [showAll, setShowAll] = useState(false);

  const latest = releases[0];
  const totalChanges = useMemo(
    () => releases.reduce((sum, release) => sum + release.totalItems, 0),
    [releases],
  );

  const filteredReleases = useMemo(() => {
    if (selectedCategory === "all") return releases;
    return releases
      .map((release) => ({
        ...release,
        sections: release.sections.filter((section) => section.kind === selectedCategory),
      }))
      .filter((release) => release.sections.length > 0);
  }, [releases, selectedCategory]);

  const visibleReleases = showAll ? filteredReleases : filteredReleases.slice(0, 8);

  const toggleExpand = (version: string): void => {
    setExpandedVersions((prev) => {
      const next = new Set(prev);
      if (next.has(version)) next.delete(version);
      else next.add(version);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <dl
        className={cn(
          glassPanelClass,
          "grid grid-cols-2 divide-y divide-cyan-500/15 sm:grid-cols-4 sm:divide-x sm:divide-y-0",
        )}
      >
        <div className="p-3.5">
          <dt className="text-[10px] font-bold tracking-wider text-slate-400">VERSI AKTIF</dt>
          <dd className="mt-0.5 flex items-center gap-1.5 font-mono text-sm font-bold text-cyan-300">
            <SparklesIcon className="size-3.5 text-cyan-400" aria-hidden="true" />
            <span>v{latest?.version ?? APP_VERSION}</span>
          </dd>
        </div>
        <div className="p-3.5">
          <dt className="text-[10px] font-bold tracking-wider text-slate-400">TOTAL RILIS</dt>
          <dd className="mt-0.5 font-mono text-sm font-bold text-emerald-300 tabular-nums">
            {releases.length} versi
          </dd>
        </div>
        <div className="p-3.5">
          <dt className="text-[10px] font-bold tracking-wider text-slate-400">ITEM PERUBAHAN</dt>
          <dd className="mt-0.5 font-mono text-sm font-bold text-violet-300 tabular-nums">
            {totalChanges} catatan
          </dd>
        </div>
        <div className="p-3.5">
          <dt className="text-[10px] font-bold tracking-wider text-slate-400">RILIS TERAKHIR</dt>
          <dd className="mt-0.5 font-mono text-sm font-semibold text-slate-100">
            {latest ? formatChangelogDate(latest.date) : "—"}
          </dd>
        </div>
      </dl>

      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Filter kategori update"
        >
          {CATEGORY_FILTERS.map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setSelectedCategory(cat.key)}
              aria-pressed={selectedCategory === cat.key}
              className={cn(
                "rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
                selectedCategory === cat.key
                  ? "border-cyan-400/60 bg-cyan-500/20 text-cyan-200"
                  : "border-cyan-500/15 bg-[#0a1322]/75 text-slate-400 hover:border-cyan-400/35 hover:text-slate-200",
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <Button
          asChild
          variant="outline"
          size="sm"
          className="h-7 border-cyan-500/30 bg-[#0b1628]/80 text-[11px] text-cyan-200 hover:border-cyan-400/60"
        >
          <Link href="/changelog" prefetch={false}>
            <HistoryIcon className="size-3.5" aria-hidden="true" />
            <span>Buka Explorer Changelog Lengkap</span>
            <ArrowRightIcon className="size-3" aria-hidden="true" />
          </Link>
        </Button>
      </div>

      <ol className="space-y-2.5">
        {visibleReleases.map((release) => {
          const highlight = getUpdateHighlight(release.version);
          const isExpanded = expandedVersions.has(release.version);
          return (
            <li key={release.version} className={cn(glassPanelClass, "overflow-hidden")}>
              <button
                type="button"
                onClick={() => toggleExpand(release.version)}
                aria-expanded={isExpanded}
                className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-cyan-500/5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-cyan-300">
                    v{release.version}
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">
                    {formatChangelogDate(release.date)}
                  </span>
                  {highlight ? (
                    <Badge
                      variant="outline"
                      className={cn("font-mono text-[10px]", highlight.accentClass)}
                    >
                      {highlight.badge}
                    </Badge>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <span className="font-mono">{release.totalItems} item</span>
                  <ChevronDownIcon
                    className={cn(
                      "size-4 transition-transform duration-200",
                      isExpanded ? "rotate-180 text-cyan-300" : "",
                    )}
                    aria-hidden="true"
                  />
                </div>
              </button>

              {isExpanded ? (
                <div className="space-y-3 border-t border-cyan-500/15 bg-[#060d19]/60 px-4 py-3">
                  {release.sections.map((section) => (
                    <div key={`${release.version}-${section.title}`}>
                      <p className="text-[11px] font-bold tracking-wider text-slate-300">
                        {section.emoji ? `${section.emoji} ` : ""}
                        {section.title}
                      </p>
                      <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-slate-300/90">
                        {section.items.map((item) => (
                          <li key={item} className="flex items-start gap-2">
                            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-cyan-400" />
                            <span>
                              <RenderInlineTokens text={item} />
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      {filteredReleases.length > 8 ? (
        <div className="no-print text-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowAll((prev) => !prev)}
            className="border-cyan-500/25 bg-[#0b1628]/80 text-xs text-slate-200"
          >
            {showAll
              ? "Tampilkan 8 Rilis Teratas"
              : `Tampilkan Semua ${filteredReleases.length} Rilis`}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
