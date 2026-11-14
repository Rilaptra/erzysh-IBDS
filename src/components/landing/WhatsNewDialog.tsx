"use client";

import { ArrowRightIcon, CalendarIcon, CheckIcon, HistoryIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { type ReactElement, useCallback, useEffect, useState } from "react";

import {
  ChangelogCategoryBadge,
  ChangelogInlineText,
} from "@/components/changelog/ChangelogPrimitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type ChangelogRelease, formatChangelogDate } from "@/lib/changelog-shared";
import {
  formatLastVisitTimestamp,
  getUnseenReleases,
  type LastVisitRecord,
  readLastVisitRecord,
  writeLastVisitRecord,
} from "@/lib/whats-new-visit";

export interface WhatsNewDialogProps {
  readonly releases: readonly ChangelogRelease[];
}

export function WhatsNewDialog({ releases }: WhatsNewDialogProps): ReactElement | null {
  const [open, setOpen] = useState(false);
  const [unseenReleases, setUnseenReleases] = useState<readonly ChangelogRelease[]>([]);
  const [previousVisit, setPreviousVisit] = useState<LastVisitRecord | null>(null);

  const latestVersion = releases[0]?.version;

  useEffect(() => {
    if (!latestVersion) return;

    const record = readLastVisitRecord();
    if (!record) {
      // First visit: store current version as baseline without interrupting the user
      writeLastVisitRecord(latestVersion);
      return;
    }

    const diff = getUnseenReleases(releases, record.lastSeenVersion);
    if (diff.length > 0) {
      setPreviousVisit(record);
      setUnseenReleases(diff);
      setOpen(true);
    } else {
      // Refresh visit timestamp while preserving the latest seen version
      writeLastVisitRecord(latestVersion);
    }
  }, [latestVersion, releases]);

  const markAsSeen = useCallback((): void => {
    if (latestVersion) {
      writeLastVisitRecord(latestVersion);
    }
    setOpen(false);
  }, [latestVersion]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean): void => {
      if (!nextOpen) {
        markAsSeen();
      } else {
        setOpen(true);
      }
    },
    [markAsSeen],
  );

  if (unseenReleases.length === 0) return null;

  const totalUnseenItems = unseenReleases.reduce((sum, release) => sum + release.totalItems, 0);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] border-cyan-500/25 bg-[#0a1322]/95 text-slate-100 shadow-2xl shadow-cyan-950/50 backdrop-blur-xl sm:max-w-2xl">
        <DialogHeader className="border-b border-cyan-500/15 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-linear-to-r from-cyan-400 via-sky-400 to-violet-500 font-mono text-[10px] font-bold text-slate-950">
              <SparklesIcon className="size-3" aria-hidden="true" />
              <span>WHAT&apos;S NEW</span>
            </Badge>
            <span className="font-mono text-[11px] text-cyan-300">
              {unseenReleases.length} rilis baru · {totalUnseenItems} pembaruan
            </span>
          </div>
          <DialogTitle className="mt-1 text-lg font-bold tracking-tight text-white sm:text-xl">
            Pembaruan Sejak Kunjungan Terakhir Anda
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400">
            {previousVisit ? (
              <>
                Kunjungan terakhir tercatat pada{" "}
                <strong className="font-mono text-slate-200">
                  v{previousVisit.lastSeenVersion}
                </strong>{" "}
                ({formatLastVisitTimestamp(previousVisit.lastVisitAt)}). Berikut ringkasan perubahan
                terbaru:
              </>
            ) : (
              "Berikut ringkasan perubahan terbaru pada IBDS:"
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[55dvh] flex-col gap-4 overflow-y-auto overscroll-contain py-2 pr-1">
          {unseenReleases.map((release, index) => (
            <article
              key={release.version}
              className="flex flex-col gap-3 rounded-lg border border-cyan-500/15 bg-[#060d19]/80 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-500/10 pb-2.5">
                <div className="flex items-center gap-2">
                  <h3 className="font-mono text-sm font-bold text-white">v{release.version}</h3>
                  {index === 0 && (
                    <Badge
                      variant="outline"
                      className="border-cyan-400/40 bg-cyan-500/10 font-mono text-[9px] text-cyan-300"
                    >
                      TERBARU
                    </Badge>
                  )}
                </div>
                <time
                  dateTime={release.date}
                  className="inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-400"
                >
                  <CalendarIcon className="size-3 text-cyan-400/80" aria-hidden="true" />
                  <span>{formatChangelogDate(release.date)}</span>
                </time>
              </div>

              <div className="flex flex-col gap-3">
                {release.sections.map((section) => (
                  <div
                    key={`${release.version}-${section.title}`}
                    className="flex flex-col gap-1.5"
                  >
                    <div>
                      <ChangelogCategoryBadge section={section} />
                    </div>
                    <ul className="flex flex-col gap-1.5 pl-1">
                      {section.items.map((item, itemIdx) => (
                        <li
                          key={`${release.version}-${section.title}-${itemIdx}`}
                          className="flex items-start gap-2 text-xs leading-relaxed text-slate-300"
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
            </article>
          ))}
        </div>

        <DialogFooter className="flex flex-col-reverse gap-2 border-t border-cyan-500/15 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <Button
            asChild
            variant="outline"
            size="sm"
            onClick={markAsSeen}
            className="border-cyan-500/25 bg-[#0b1628]/80 text-xs text-cyan-200 hover:border-cyan-400/50 hover:bg-cyan-500/10 hover:text-cyan-100"
          >
            <Link href="/changelog" prefetch={false}>
              <HistoryIcon data-icon="inline-start" aria-hidden="true" />
              <span>Lihat Semua di Changelog</span>
              <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
            </Link>
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={markAsSeen}
            className="bg-linear-to-r from-cyan-400 via-sky-400 to-violet-500 text-xs font-bold text-slate-950 hover:brightness-110"
          >
            <CheckIcon data-icon="inline-start" aria-hidden="true" />
            <span>Mengerti &amp; Tandai Dibaca</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default WhatsNewDialog;
