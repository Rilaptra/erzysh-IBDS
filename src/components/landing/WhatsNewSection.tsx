import { ArrowRightIcon, CalendarIcon, HistoryIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import type { ReactElement } from "react";

import {
  ChangelogCategoryBadge,
  ChangelogInlineText,
} from "@/components/changelog/ChangelogPrimitives";
import { glassPanelClass } from "@/components/landing/ErzyshPageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type ChangelogRelease, formatChangelogDate } from "@/lib/changelog";
import { cn } from "@/lib/utils";

export interface WhatsNewSectionProps {
  readonly releases: readonly ChangelogRelease[];
  readonly totalReleasesCount: number;
}

export function WhatsNewSection({
  releases,
  totalReleasesCount,
}: WhatsNewSectionProps): ReactElement | null {
  const [latest, ...recent] = releases;
  if (!latest) return null;

  return (
    <section id="whats-new" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-16 sm:px-6 sm:pb-20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-cyan-400">
            <SparklesIcon className="size-3.5" aria-hidden="true" />
            <span>WHAT&apos;S NEW</span>
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight">
            Pembaruan &amp; Catatan Rilis Terbaru
          </h2>
          <p className="mt-1.5 max-w-2xl text-xs text-slate-400">
            Ringkasan fitur baru, peningkatan performa, dan perbaikan terbaru langsung dari{" "}
            <code className="rounded border border-cyan-500/20 bg-cyan-950/60 px-1.5 py-0.5 font-mono text-[11px] text-cyan-300">
              CHANGELOG.md
            </code>
            .
          </p>
        </div>

        <Button
          asChild
          variant="outline"
          size="sm"
          className="w-fit shrink-0 border-cyan-500/25 bg-[#0b1628]/80 text-xs text-cyan-200 hover:border-cyan-400/55 hover:bg-cyan-500/10 hover:text-cyan-100"
        >
          <Link href="/changelog" prefetch={false}>
            <HistoryIcon data-icon="inline-start" aria-hidden="true" />
            <span>Lihat Semua ({totalReleasesCount} Rilis)</span>
            <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
          </Link>
        </Button>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-12">
        {/* Featured Latest Release */}
        <article
          className={cn(
            glassPanelClass,
            "flex min-w-0 flex-col justify-between border-cyan-400/25 p-5 sm:p-6 lg:col-span-7",
          )}
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-500/15 pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-linear-to-r from-cyan-400 via-sky-400 to-violet-500 font-mono text-[10px] font-bold text-slate-950">
                  TERBARU
                </Badge>
                <h3 className="font-mono text-base font-bold text-white sm:text-lg">
                  v{latest.version}
                </h3>
              </div>
              <time
                dateTime={latest.date}
                className="inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-400"
              >
                <CalendarIcon className="size-3.5 text-cyan-400/80" aria-hidden="true" />
                <span>{formatChangelogDate(latest.date)}</span>
              </time>
            </div>

            <div className="flex flex-col gap-4">
              {latest.sections.map((section) => (
                <div key={`${latest.version}-${section.title}`} className="flex flex-col gap-2">
                  <div>
                    <ChangelogCategoryBadge section={section} />
                  </div>
                  <ul className="flex flex-col gap-2 pl-1">
                    {section.items.map((item, idx) => (
                      <li
                        key={`${latest.version}-${section.title}-${idx}`}
                        className="flex items-start gap-2.5 text-xs leading-relaxed text-slate-300"
                      >
                        <span
                          aria-hidden="true"
                          className="mt-1.5 size-1.5 shrink-0 rounded-full bg-cyan-400"
                        />
                        <ChangelogInlineText text={item} className="min-w-0 flex-1" />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-cyan-500/15 pt-4 text-[11px] text-slate-400">
            <span>{latest.totalItems} pembaruan pada rilis ini</span>
            <Link
              href={`/changelog#v${latest.version}`}
              prefetch={false}
              className="inline-flex items-center gap-1 font-medium text-cyan-300 transition-colors hover:text-cyan-200"
            >
              <span>Detail rilis v{latest.version}</span>
              <ArrowRightIcon className="size-3" aria-hidden="true" />
            </Link>
          </div>
        </article>

        {/* Recent Releases Column */}
        {recent.length > 0 && (
          <div className="flex min-w-0 flex-col gap-4 lg:col-span-5">
            {recent.map((release) => {
              const previewItems = release.sections.flatMap((section) =>
                section.items.map((item) => ({ section, item })),
              );
              const displayedItems = previewItems.slice(0, 3);
              const remainingCount = previewItems.length - displayedItems.length;

              return (
                <article
                  key={release.version}
                  className={cn(
                    glassPanelClass,
                    "group flex min-w-0 flex-1 flex-col justify-between p-4 transition-colors duration-200 hover:border-cyan-400/40 sm:p-5",
                  )}
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-mono text-sm font-bold text-slate-100">
                          v{release.version}
                        </h3>
                        <span className="font-mono text-[10px] text-slate-500">
                          {release.totalItems} item
                        </span>
                      </div>
                      <time
                        dateTime={release.date}
                        className="font-mono text-[11px] text-slate-400"
                      >
                        {formatChangelogDate(release.date)}
                      </time>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {release.sections.map((section) => (
                        <ChangelogCategoryBadge
                          key={`${release.version}-${section.title}`}
                          section={section}
                        />
                      ))}
                    </div>

                    <ul className="flex flex-col gap-1.5">
                      {displayedItems.map(({ item }, idx) => (
                        <li
                          key={`${release.version}-preview-${idx}`}
                          className="flex items-start gap-2 text-xs leading-relaxed text-slate-300/90"
                        >
                          <span
                            aria-hidden="true"
                            className="mt-1.5 size-1 shrink-0 rounded-full bg-violet-400"
                          />
                          <ChangelogInlineText
                            text={item}
                            className="line-clamp-2 min-w-0 flex-1"
                          />
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-cyan-500/10 pt-3 text-[11px]">
                    <span className="text-slate-500">
                      {remainingCount > 0
                        ? `+${remainingCount} perubahan lainnya`
                        : "Rilis lengkap"}
                    </span>
                    <Link
                      href={`/changelog#v${release.version}`}
                      prefetch={false}
                      className="inline-flex items-center gap-1 font-medium text-cyan-400 transition-colors group-hover:text-cyan-300"
                    >
                      <span>Baca selengkapnya</span>
                      <ArrowRightIcon
                        className="size-3 transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export default WhatsNewSection;
