"use client";

import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ClockIcon,
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileCodeIcon,
  ImageIcon,
  PencilIcon,
  XCircleIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactElement } from "react";

import { glassPanelClass } from "@/components/landing/ErzyshPageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  VALIDATION_CATEGORY_LABELS,
  VALIDATION_SOURCE_LABELS,
} from "@/data/presentation/validation-cases";
import { formatMetricNumber } from "@/lib/presentation/validation-metrics";
import { cn } from "@/lib/utils";
import type {
  EvaluatedValidationCard,
  ValidationCaseCard,
  ValidationRowStatus,
} from "@/types/presentation-types";

export interface ValidationCaseCardItemProps {
  readonly evaluated: EvaluatedValidationCard;
  readonly isCleanPresenterMode?: boolean;
  readonly onOpenLightbox: (card: ValidationCaseCard, initialMediaId?: string) => void;
  readonly onEditCard: (card: ValidationCaseCard) => void;
  readonly onDuplicateToDraft: (card: ValidationCaseCard) => void;
}

function getStatusBadgeStyle(status: ValidationRowStatus): {
  readonly className: string;
  readonly label: string;
} {
  switch (status) {
    case "PASS":
      return {
        className: "border-emerald-400/40 bg-emerald-500/15 text-emerald-300",
        label: "PASS",
      };
    case "WARN":
      return {
        className: "border-amber-400/40 bg-amber-500/15 text-amber-300",
        label: "WARN",
      };
    case "FAIL":
      return {
        className: "border-red-400/40 bg-red-500/15 text-red-300",
        label: "FAIL",
      };
    case "PENDING_REF":
      return {
        className: "border-slate-600/50 bg-slate-800/70 text-slate-300",
        label: "PENDING",
      };
  }
}

function StatusIcon({ status }: { readonly status: ValidationRowStatus }): ReactElement {
  switch (status) {
    case "PASS":
      return <CheckCircle2Icon className="size-3 text-emerald-400" aria-hidden="true" />;
    case "WARN":
      return <AlertTriangleIcon className="size-3 text-amber-400" aria-hidden="true" />;
    case "FAIL":
      return <XCircleIcon className="size-3 text-red-400" aria-hidden="true" />;
    case "PENDING_REF":
      return <ClockIcon className="size-3 text-slate-400" aria-hidden="true" />;
  }
}

export function ValidationCaseCardItem({
  evaluated,
  isCleanPresenterMode = false,
  onOpenLightbox,
  onEditCard,
  onDuplicateToDraft,
}: ValidationCaseCardItemProps): ReactElement {
  const { card, rows, overallStatus, maxErrorPercent } = evaluated;
  const overallStyle = getStatusBadgeStyle(overallStatus);
  const tableCaptionId = `val-table-caption-${card.id}`;

  return (
    <article
      className={cn(
        glassPanelClass,
        "flex flex-col justify-between gap-4 border-cyan-500/20 p-4 transition-colors hover:border-cyan-400/35 sm:p-5",
      )}
    >
      <div className="space-y-3.5">
        <header className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              className="border-cyan-400/40 bg-cyan-500/15 font-mono text-[10px] font-bold text-cyan-200"
            >
              {card.code}
            </Badge>
            <Badge
              variant="outline"
              className={cn("font-mono text-[10px] font-semibold", overallStyle.className)}
            >
              <StatusIcon status={overallStatus} />
              <span className="ml-1">
                {overallStyle.label}
                {maxErrorPercent !== null ? ` · Δ ${maxErrorPercent.toFixed(2)}%` : ""}
              </span>
            </Badge>
            <Badge
              variant="outline"
              className="border-sky-400/30 bg-sky-500/10 text-[10px] text-sky-200"
            >
              {VALIDATION_SOURCE_LABELS[card.benchmarkSource]}
            </Badge>
            <Badge
              variant="outline"
              className="border-slate-700 bg-slate-900/70 text-[10px] text-slate-300"
            >
              {VALIDATION_CATEGORY_LABELS[card.category]}
            </Badge>
            {card.origin === "USER_LOCAL_DRAFT" ? (
              <Badge
                variant="outline"
                className="border-violet-400/40 bg-violet-500/15 text-[10px] text-violet-200"
              >
                Draft Lokal
              </Badge>
            ) : null}
          </div>

          {!isCleanPresenterMode ? (
            <div className="no-print flex items-center gap-1">
              {card.origin === "USER_LOCAL_DRAFT" ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onEditCard(card)}
                  className="h-7 px-2 text-[11px] text-cyan-300 hover:bg-cyan-500/10"
                >
                  <PencilIcon className="size-3" aria-hidden="true" />
                  <span>Edit</span>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onDuplicateToDraft(card)}
                  className="h-7 px-2 text-[11px] text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-200"
                  title="Salin ke Draft Lokal untuk menambahkan angka/screenshot SAP2000 & Excel"
                >
                  <CopyIcon className="size-3" aria-hidden="true" />
                  <span>Edit Salinan</span>
                </Button>
              )}
            </div>
          ) : null}
        </header>

        <div>
          <h3 className="text-sm font-bold tracking-tight text-slate-100 sm:text-base">
            {card.title}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-300/85">{card.summary}</p>
        </div>

        {card.modelInputs.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-cyan-500/15 bg-[#060d19]/80 p-2.5">
            <dl className="flex flex-wrap gap-x-3 gap-y-1.5">
              {card.modelInputs.map((input) => (
                <div
                  key={`${input.label}-${input.value}`}
                  className="flex items-baseline gap-1 text-[11px]"
                >
                  <dt className="text-slate-400">{input.label}:</dt>
                  <dd className="font-mono font-semibold text-slate-200">{input.value}</dd>
                </div>
              ))}
            </dl>
            {card.simulatorHref ? (
              <Link
                href={card.simulatorHref}
                prefetch={false}
                className="no-print inline-flex shrink-0 items-center gap-1 font-mono text-[10px] font-semibold text-cyan-300 transition-colors hover:text-cyan-200"
              >
                <span>Buka di Simulator</span>
                <ExternalLinkIcon className="size-3" aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        ) : null}

        <div
          tabIndex={0}
          role="region"
          aria-labelledby={tableCaptionId}
          className="table-wrapper overflow-x-auto rounded-md border border-cyan-500/15 bg-[#050b16]/90"
        >
          <table className="w-full border-collapse text-left text-xs">
            <caption id={tableCaptionId} className="sr-only">
              Perbandingan numerik studi kasus {card.code} — {card.title}
            </caption>
            <thead>
              <tr className="border-b border-cyan-500/15 bg-[#091426] text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                <th scope="col" className="px-2.5 py-2">
                  Parameter
                </th>
                <th scope="col" className="px-2 py-2 text-right text-cyan-300">
                  IBDS
                </th>
                <th scope="col" className="px-2 py-2 text-right text-sky-300">
                  SAP2000
                </th>
                <th scope="col" className="px-2 py-2 text-right text-emerald-300">
                  Excel
                </th>
                <th scope="col" className="px-2 py-2 text-right">
                  Galat
                </th>
                <th scope="col" className="px-2.5 py-2 text-center">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cyan-500/10">
              {rows.map((row) => {
                const rowStyle = getStatusBadgeStyle(row.status);
                return (
                  <tr key={row.id} className="transition-colors hover:bg-cyan-500/5">
                    <th scope="row" className="px-2.5 py-2 font-medium text-slate-200">
                      <span className="block">{row.parameter}</span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {row.symbol} ({row.unit})
                      </span>
                    </th>
                    <td className="px-2 py-2 text-right font-mono font-semibold text-cyan-200 tabular-nums">
                      {formatMetricNumber(row.ibdsValue)}
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-slate-300 tabular-nums">
                      {formatMetricNumber(row.sap2000Value)}
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-slate-300 tabular-nums">
                      {formatMetricNumber(row.excelValue ?? row.analyticalValue)}
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-[11px] text-slate-200 tabular-nums">
                      {row.maxErrorPercent !== null ? `${row.maxErrorPercent.toFixed(2)}%` : "—"}
                    </td>
                    <td className="px-2.5 py-2 text-center">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold",
                          rowStyle.className,
                        )}
                      >
                        {rowStyle.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              BUKTI VISUAL ({card.evidenceMedia.length} SLOT)
            </span>
            <button
              type="button"
              onClick={() => onOpenLightbox(card, card.evidenceMedia[0]?.id)}
              className="no-print inline-flex items-center gap-1 font-mono text-[10px] text-cyan-300 hover:text-cyan-200"
            >
              <ImageIcon className="size-3" aria-hidden="true" />
              <span>Buka Lightbox / Compare</span>
            </button>
          </div>

          {card.evidenceMedia.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {card.evidenceMedia.slice(0, 3).map((media) => (
                <button
                  key={media.id}
                  type="button"
                  onClick={() => onOpenLightbox(card, media.id)}
                  className="group flex flex-col items-start justify-between rounded-md border border-cyan-500/15 bg-[#060d19]/90 p-2 text-left transition-colors hover:border-cyan-400/50 hover:bg-cyan-500/10"
                >
                  <span className="font-mono text-[9px] font-bold text-cyan-300">
                    {media.kind === "EXCEL_MANUAL" ? "EXCEL" : media.kind}
                  </span>
                  <span className="mt-1 line-clamp-2 text-[10px] leading-snug text-slate-300 group-hover:text-white">
                    {media.caption}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onOpenLightbox(card)}
              className="w-full rounded-md border border-dashed border-cyan-500/20 bg-[#060d19]/60 px-3 py-2 text-center text-[11px] text-slate-400 transition-colors hover:border-cyan-400/40 hover:text-slate-200"
            >
              Klik untuk melihat panduan unggah tangkapan layar IBDS / SAP2000 / Excel
            </button>
          )}
        </div>
      </div>

      <footer className="space-y-2 border-t border-cyan-500/15 pt-3">
        {card.notes ? (
          <p className="text-[11px] leading-relaxed text-slate-400 italic">{card.notes}</p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            {card.sniClauses.map((clause) => (
              <span
                key={clause}
                className="rounded border border-cyan-500/15 bg-[#050b16] px-1.5 py-0.5 font-mono text-[9px] text-slate-300"
              >
                {clause}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {card.solverTestRef ? (
              <span className="inline-flex items-center gap-1 font-mono text-[10px] text-emerald-300/90">
                <FileCodeIcon className="size-3" aria-hidden="true" />
                <span>{card.solverTestRef}</span>
              </span>
            ) : null}
            {card.downloadableArtifacts?.map((artifact) => (
              <a
                key={artifact.href}
                href={artifact.href}
                download
                className="inline-flex items-center gap-1 rounded border border-cyan-500/25 bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] text-cyan-200 hover:bg-cyan-500/20"
              >
                <DownloadIcon className="size-3" aria-hidden="true" />
                <span>{artifact.format}</span>
              </a>
            ))}
          </div>
        </div>
      </footer>
    </article>
  );
}

export default ValidationCaseCardItem;
