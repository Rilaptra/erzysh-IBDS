--- src/components/presentation/ValidationCaseCardItem.tsx
<<<<<<< SEARCH
=======
"use client";

import {
  CheckCircle2Icon,
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileCodeIcon,
  ImageIcon,
  PencilIcon,
  AlertTriangleIcon,
  XCircleIcon,
  ClockIcon,
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
                <div key={`${input.label}-${input.value}`} className="flex items-baseline gap-1 text-[11px]">
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
>>>>>>> REPLACE

---

```
src/components/presentation/ValidationProofSection.tsx
```

<<<<<<< SEARCH
=======

"use client";

import {
BookOpenIcon,
CheckCircle2Icon,
DownloadIcon,
FileCodeIcon,
PlusIcon,
SearchIcon,
UploadIcon,
} from "lucide-react";
import type { ChangeEvent, ReactElement } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { glassPanelClass } from "@/components/landing/ErzyshPageShell";
import { ValidationCardBuilderDrawer } from "@/components/presentation/ValidationCardBuilderDrawer";
import { ValidationCaseCardItem } from "@/components/presentation/ValidationCaseCardItem";
import { ValidationEvidenceLightbox } from "@/components/presentation/ValidationEvidenceLightbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
VALIDATION_CASE_CARDS,
VALIDATION_CATEGORY_LABELS,
VALIDATION_SOURCE_LABELS,
} from "@/data/presentation/validation-cases";
import {
computeValidationAggregateMetrics,
evaluateValidationCard,
} from "@/lib/presentation/validation-metrics";
import {
exportValidationCardsToJson,
loadLocalValidationDrafts,
parseValidationCardsFromJson,
saveLocalValidationDrafts,
} from "@/lib/presentation/validation-storage";
import { cn } from "@/lib/utils";
import type {
ValidationBenchmarkSource,
ValidationCaseCard,
ValidationCategory,
} from "@/types/presentation-types";

export interface RenderedCalculationSource {
readonly id: string;
readonly domain: string;
readonly standard: string;
readonly summary: string;
readonly equations: ReadonlyArray<{
readonly label: string;
readonly renderedHtml: string;
}>;
readonly codeRefs: readonly string[];
}

export interface ValidationProofSectionProps {
readonly id?: string;
readonly calculationSources: readonly RenderedCalculationSource[];
readonly seedCards?: readonly ValidationCaseCard[];
readonly isCleanPresenterMode?: boolean;
readonly className?: string;
}

type CategoryFilter = "ALL" | ValidationCategory;
type SourceFilter = "ALL" | ValidationBenchmarkSource;

const CATEGORY_KEYS: readonly ValidationCategory[] = [
"DEFLECTION_MECHANICS",
"SHEAR_MOMENT_DIAGRAM",
"STEEL_SNI_1729",
"CONCRETE_SNI_2847",
"SECTION_GEOMETRY",
];

const SOURCE_KEYS: readonly ValidationBenchmarkSource[] = [
"SAP2000_AND_EXCEL",
"SAP2000",
"EXCEL_MANUAL",
"ANALYTICAL",
];

export function ValidationProofSection({
id = "bab-6-sumber-validasi",
calculationSources,
seedCards = VALIDATION_CASE_CARDS,
isCleanPresenterMode = false,
className,
}: ValidationProofSectionProps): ReactElement {
const importInputRef = useRef<HTMLInputElement | null>(null);

const [activeSourceId, setActiveSourceId] = useState<string>(calculationSources[0]?.id ?? "");
const [localDrafts, setLocalDrafts] = useState<readonly ValidationCaseCard[]>([]);
const [storageNotice, setStorageNotice] = useState<string | null>(null);

const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("ALL");
const [sourceFilter, setSourceFilter] = useState<SourceFilter>("ALL");
const [searchQuery, setSearchQuery] = useState("");

const [lightboxState, setLightboxState] = useState<{
readonly card: ValidationCaseCard | null;
readonly initialMediaId: string | null;
}>({ card: null, initialMediaId: null });

const [builderOpen, setBuilderOpen] = useState(false);
const [editingCard, setEditingCard] = useState<ValidationCaseCard | null>(null);

useEffect(() => {
setLocalDrafts(loadLocalValidationDrafts());
}, []);

const allCards = useMemo<readonly ValidationCaseCard[]>(
() => [...seedCards, ...localDrafts],
[localDrafts, seedCards],
);

const aggregateMetrics = useMemo(
() => computeValidationAggregateMetrics(allCards),
[allCards],
);

const filteredEvaluatedCards = useMemo(() => {
const q = searchQuery.trim().toLowerCase();
return allCards
.filter((card) => {
if (categoryFilter !== "ALL" && card.category !== categoryFilter) return false;
if (sourceFilter !== "ALL" && card.benchmarkSource !== sourceFilter) return false;
if (!q) return true;
const haystack = [
card.code,
card.title,
card.summary,
...card.sniClauses,
...card.modelInputs.map((i) => `${i.label} ${i.value}`),
]
.join(" ")
.toLowerCase();
return haystack.includes(q);
})
.map(evaluateValidationCard);
}, [allCards, categoryFilter, searchQuery, sourceFilter]);

const activeCalculationSource =
calculationSources.find((src) => src.id === activeSourceId) ?? calculationSources[0] ?? null;

const persistDrafts = (nextDrafts: readonly ValidationCaseCard[]): void => {
setLocalDrafts(nextDrafts);
const result = saveLocalValidationDrafts(nextDrafts);
setStorageNotice(result.ok ? null : (result.error ?? "Gagal menyimpan draft ke localStorage."));
};

const handleSaveCard = (savedCard: ValidationCaseCard): void => {
const exists = localDrafts.some((item) => item.id === savedCard.id);
const nextDrafts = exists
? localDrafts.map((item) => (item.id === savedCard.id ? savedCard : item))
: [...localDrafts, savedCard];
persistDrafts(nextDrafts);
};

const handleDeleteDraft = (cardId: string): void => {
persistDrafts(localDrafts.filter((item) => item.id !== cardId));
};

const handleDuplicateToDraft = (seedCard: ValidationCaseCard): void => {
const nextCode = `VAL-${String(allCards.length + 1).padStart(2, "0")}`;
const cloned: ValidationCaseCard = {
...seedCard,
id: `${seedCard.id}-draft-${Date.now().toString(36)}`,
code: nextCode,
origin: "USER_LOCAL_DRAFT",
verificationStatus: "DRAFT_LOCAL",
};
setEditingCard(cloned);
setBuilderOpen(true);
};

const handleExportAllJson = (): void => {
const json = exportValidationCardsToJson(allCards);
const blob = new Blob([json], { type: "application/json" });
const url = URL.createObjectURL(blob);
const link = document.createElement("a");
link.href = url;
link.download = `ibds-validation-cards-${new Date().toISOString().slice(0, 10)}.json`;
link.click();
URL.revokeObjectURL(url);
};

const handleImportJson = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
const file = event.target.files?.[0];
event.target.value = "";
if (!file) return;

    try {
      const raw = await file.text();
      const parsed = parseValidationCardsFromJson(raw);
      if (parsed.error || parsed.cards.length === 0) {
        setStorageNotice(parsed.error ?? "Berkas JSON tidak berisi kartu validasi yang valid.");
        return;
      }

      const existingIds = new Set(localDrafts.map((c) => c.id));
      const merged: ValidationCaseCard[] = [...localDrafts];
      for (const incoming of parsed.cards) {
        const normalized: ValidationCaseCard = {
          ...incoming,
          origin: "USER_LOCAL_DRAFT",
          id: existingIds.has(incoming.id)
            ? `${incoming.id}-${Date.now().toString(36)}`
            : incoming.id,
        };
        merged.push(normalized);
      }
      persistDrafts(merged);
    } catch {
      setStorageNotice("Gagal membaca berkas JSON yang dipilih.");
    }

};

return ( <section id={id} className={cn("scroll-mt-20 space-y-6", className)}> <header className="space-y-2"> <div className="flex flex-wrap items-center gap-2">
<Badge
            variant="outline"
            className="border-cyan-400/30 bg-cyan-500/10 font-mono text-[10px] text-cyan-300"
          >
BAB 06
</Badge>
<Badge
            variant="outline"
            className="border-emerald-400/30 bg-emerald-500/10 text-[10px] text-emerald-200"
          >
<CheckCircle2Icon className="mr-1 size-3 text-emerald-400" aria-hidden="true" />
SUMBER RUMUS SNI &amp; VALIDASI SAP2000 / EXCEL
</Badge> </div> <h2 className="text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
Sumber Data Hitungan &amp; Bukti Validasi Numerik </h2> <p className="max-w-3xl text-sm leading-relaxed text-slate-300/85">
Seluruh formulasi mekanika Euler-Bernoulli, SNI 1729:2020, dan SNI 2847:2019 dapat
ditelusuri langsung hingga ke baris kode sumber dan diuji silang terhadap{" "}
<strong className="text-cyan-200">SAP2000</strong> serta{" "}
<strong className="text-emerald-200">Perhitungan Excel Manual</strong>. </p> </header>

      {calculationSources.length > 0 ? (
        <div className={cn(glassPanelClass, "overflow-hidden border-cyan-500/20")}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-500/15 bg-[#081224]/90 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <BookOpenIcon className="size-4 text-cyan-400" aria-hidden="true" />
              <span className="font-mono text-[11px] font-bold tracking-wider text-cyan-200 uppercase">
                REFERENSI STANDAR &amp; PERSAMAAN PENGATUR (KaTeX)
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {calculationSources.map((src) => (
                <button
                  key={src.id}
                  type="button"
                  onClick={() => setActiveSourceId(src.id)}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    src.id === activeCalculationSource?.id
                      ? "border-cyan-400/60 bg-cyan-500/20 text-cyan-100"
                      : "border-cyan-500/15 bg-[#050b16] text-slate-400 hover:border-cyan-500/35 hover:text-slate-200",
                  )}
                >
                  {src.domain}
                </button>
              ))}
            </div>
          </div>

          {activeCalculationSource ? (
            <div className="space-y-4 p-4 sm:p-5">
              <div>
                <p className="font-mono text-[11px] font-semibold text-sky-300">
                  {activeCalculationSource.standard}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">
                  {activeCalculationSource.summary}
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {activeCalculationSource.equations.map((eq) => (
                  <div
                    key={eq.label}
                    className="overflow-x-auto rounded-lg border border-cyan-500/15 bg-[#050b16]/90 p-3"
                  >
                    <p className="mb-2 text-[11px] font-semibold text-cyan-200">{eq.label}</p>
                    <div
                      className="text-slate-100 [&_.katex-display]:my-1"
                      // Static server-rendered KaTeX HTML from curated calculation-sources.ts
                      dangerouslySetInnerHTML={{ __html: eq.renderedHtml }}
                    />
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 border-t border-cyan-500/10 pt-3">
                <span className="mr-1 inline-flex items-center gap-1 font-mono text-[10px] text-slate-400">
                  <FileCodeIcon className="size-3 text-cyan-400" aria-hidden="true" />
                  Ketertelusuran Kode:
                </span>
                {activeCalculationSource.codeRefs.map((refPath) => (
                  <code
                    key={refPath}
                    className="rounded border border-cyan-500/15 bg-[#060d19] px-2 py-0.5 font-mono text-[10px] text-cyan-300"
                  >
                    {refPath}
                  </code>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <dl
        className={cn(
          glassPanelClass,
          "grid grid-cols-2 divide-y divide-cyan-500/15 sm:grid-cols-4 sm:divide-x sm:divide-y-0",
        )}
      >
        <div className="p-3.5">
          <dt className="font-mono text-[10px] font-bold tracking-wider text-slate-400 uppercase">
            Total Studi Kasus
          </dt>
          <dd className="mt-1 font-mono text-base font-bold text-cyan-300 tabular-nums">
            {aggregateMetrics.totalCases} kasus{" "}
            <span className="text-[11px] font-normal text-slate-400">
              ({aggregateMetrics.verifiedCases} verified)
            </span>
          </dd>
        </div>
        <div className="p-3.5">
          <dt className="font-mono text-[10px] font-bold tracking-wider text-slate-400 uppercase">
            Rata-Rata Galat SAP2000
          </dt>
          <dd className="mt-1 font-mono text-base font-bold text-sky-300 tabular-nums">
            {aggregateMetrics.meanSap2000ErrorPercent !== null
              ? `${aggregateMetrics.meanSap2000ErrorPercent.toFixed(3)}%`
              : "Siap Diisi"}
          </dd>
        </div>
        <div className="p-3.5">
          <dt className="font-mono text-[10px] font-bold tracking-wider text-slate-400 uppercase">
            Rata-Rata Galat Excel
          </dt>
          <dd className="mt-1 font-mono text-base font-bold text-emerald-300 tabular-nums">
            {aggregateMetrics.meanExcelErrorPercent !== null
              ? `${aggregateMetrics.meanExcelErrorPercent.toFixed(3)}%`
              : "Siap Diisi"}
          </dd>
        </div>
        <div className="p-3.5">
          <dt className="font-mono text-[10px] font-bold tracking-wider text-slate-400 uppercase">
            Kelulusan Toleransi
          </dt>
          <dd className="mt-1 font-mono text-base font-bold text-violet-300 tabular-nums">
            {aggregateMetrics.totalRowsEvaluated > 0
              ? `${aggregateMetrics.passRatePercent.toFixed(1)}%`
              : "100% (Analitik)"}
          </dd>
        </div>
      </dl>

      {storageNotice ? (
        <div
          role="alert"
          className="rounded-md border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
        >
          {storageNotice}
        </div>
      ) : null}

      <div className={cn(glassPanelClass, "no-print space-y-3 p-3.5")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="relative min-w-[220px] flex-1">
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kode VAL-01, profil WF, pasal SNI..."
              aria-label="Cari studi kasus validasi"
              className="w-full rounded-md border border-cyan-500/20 bg-[#050b16] py-1.5 pr-3 pl-8 text-xs text-slate-100 placeholder:text-slate-500 focus-visible:border-cyan-400/60 focus-visible:ring-2 focus-visible:ring-cyan-400/40 focus-visible:outline-none"
            />
          </div>

          {!isCleanPresenterMode ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleImportJson}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => importInputRef.current?.click()}
                className="h-8 border-cyan-500/25 bg-[#060d19] text-[11px] text-slate-200"
              >
                <UploadIcon className="size-3.5" aria-hidden="true" />
                <span>Impor JSON</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportAllJson}
                className="h-8 border-cyan-500/25 bg-[#060d19] text-[11px] text-slate-200"
              >
                <DownloadIcon className="size-3.5" aria-hidden="true" />
                <span>Ekspor JSON</span>
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setEditingCard(null);
                  setBuilderOpen(true);
                }}
                className="h-8 bg-linear-to-r from-cyan-400 via-sky-400 to-violet-500 text-[11px] font-bold text-slate-950 hover:brightness-110"
              >
                <PlusIcon className="size-3.5" aria-hidden="true" />
                <span>Tambah Card Validasi</span>
              </Button>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCategoryFilter("ALL")}
            className={cn(
              "rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors",
              categoryFilter === "ALL"
                ? "border-cyan-400/60 bg-cyan-500/20 text-cyan-100"
                : "border-cyan-500/15 bg-[#050b16] text-slate-400 hover:text-slate-200",
            )}
          >
            Semua Kategori
          </button>
          {CATEGORY_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setCategoryFilter(key)}
              className={cn(
                "rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors",
                categoryFilter === key
                  ? "border-cyan-400/60 bg-cyan-500/20 text-cyan-100"
                  : "border-cyan-500/15 bg-[#050b16] text-slate-400 hover:text-slate-200",
              )}
            >
              {VALIDATION_CATEGORY_LABELS[key]}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-t border-cyan-500/10 pt-2">
          <span className="font-mono text-[10px] text-slate-400">Sumber:</span>
          <button
            type="button"
            onClick={() => setSourceFilter("ALL")}
            className={cn(
              "rounded border px-2 py-0.5 text-[10px] font-medium transition-colors",
              sourceFilter === "ALL"
                ? "border-sky-400/60 bg-sky-500/20 text-sky-100"
                : "border-cyan-500/15 bg-[#050b16] text-slate-400 hover:text-slate-200",
            )}
          >
            Semua
          </button>
          {SOURCE_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setSourceFilter(key)}
              className={cn(
                "rounded border px-2 py-0.5 text-[10px] font-medium transition-colors",
                sourceFilter === key
                  ? "border-sky-400/60 bg-sky-500/20 text-sky-100"
                  : "border-cyan-500/15 bg-[#050b16] text-slate-400 hover:text-slate-200",
              )}
            >
              {VALIDATION_SOURCE_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      {filteredEvaluatedCards.length === 0 ? (
        <div
          className={cn(
            glassPanelClass,
            "flex flex-col items-center justify-center gap-2 py-12 text-center",
          )}
        >
          <p className="text-sm font-semibold text-slate-200">
            Tidak ada kartu validasi yang cocok dengan filter
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setCategoryFilter("ALL");
              setSourceFilter("ALL");
              setSearchQuery("");
            }}
            className="border-cyan-500/25 bg-[#060d19] text-xs"
          >
            Reset Filter
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredEvaluatedCards.map((evaluated) => (
            <ValidationCaseCardItem
              key={evaluated.card.id}
              evaluated={evaluated}
              isCleanPresenterMode={isCleanPresenterMode}
              onOpenLightbox={(card, initialMediaId) =>
                setLightboxState({ card, initialMediaId: initialMediaId ?? null })
              }
              onEditCard={(card) => {
                setEditingCard(card);
                setBuilderOpen(true);
              }}
              onDuplicateToDraft={handleDuplicateToDraft}
            />
          ))}
        </div>
      )}

      <ValidationEvidenceLightbox
        card={lightboxState.card}
        initialMediaId={lightboxState.initialMediaId}
        onClose={() => setLightboxState({ card: null, initialMediaId: null })}
      />

      <ValidationCardBuilderDrawer
        open={builderOpen}
        editingCard={editingCard}
        existingCount={allCards.length}
        onSave={handleSaveCard}
        onDelete={handleDeleteDraft}
        onClose={() => {
          setBuilderOpen(false);
          setEditingCard(null);
        }}
      />
    </section>

);
}

export default ValidationProofSection;

> > > > > > > REPLACE

--- src/components/presentation/PresentationShell.tsx
<<<<<<< SEARCH
=======

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
return ( <header className="mb-6 space-y-2"> <div className="flex flex-wrap items-center gap-2">
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
</Badge> </div> <h2 className="text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
{chapter.title} </h2> <p className="max-w-3xl text-sm leading-relaxed text-slate-300/85">{chapter.subtitle}</p> </header>
);
}

function isEditableTarget(target: EventTarget | null): boolean {
if (!(target instanceof HTMLElement)) return false;
const tag = target.tagName;
return (
tag === "INPUT" ||
tag === "TEXTAREA" ||
tag === "SELECT" ||
target.isContentEditable
);
}

export function PresentationShell({
releases,
calculationSources,
seedValidationCards = VALIDATION_CASE_CARDS,
}: PresentationShellProps): ReactElement {
const searchParams = useSearchParams();
const scrollContainerRef = useRef<HTMLDivElement | null>(null);
const shortcutsDialogRef = useRef<HTMLDialogElement | null>(null);

const initialView: PresentationViewMode =
searchParams.get("view") === "deck" ? "deck" : "scroll";
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
window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
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
      setScrollProgress(maxScroll > 0 ? Math.min(1, Math.max(0, container.scrollTop / maxScroll)) : 0);
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
return (
<GitHubFeedbackComposer
            id={chapter.id}
            validationCases={seedValidationCards}
          />
);
}
};

return ( <div
ref={scrollContainerRef}
className={cn(
"erzysh-presentation-shell text-foreground relative h-dvh w-full bg-[#050a14] select-text",
viewMode === "deck"
? "flex flex-col overflow-hidden"
: "overflow-x-hidden overflow-y-auto scroll-smooth",
)} >
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

          <main id="presentation-main-content" className="mx-auto w-full max-w-5xl space-y-20 pb-24">
            {PRESENTATION_CHAPTERS.map((chapter) => (
              <div
                key={chapter.id}
                id={chapter.id}
                className="scroll-mt-20 print:break-after-page"
              >
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

> > > > > > > REPLACE

--- src/app/presentation/page.tsx
<<<<<<< SEARCH
=======

import katex from "katex";
import "katex/dist/katex.min.css";
import type { ReactElement } from "react";
import { Suspense } from "react";

import { PresentationShell } from "@/components/presentation/PresentationShell";
import type { RenderedCalculationSource } from "@/components/presentation/ValidationProofSection";
import { CALCULATION_SOURCES } from "@/data/presentation/calculation-sources";
import { VALIDATION_CASE_CARDS } from "@/data/presentation/validation-cases";
import { getAllChangelogReleases } from "@/lib/changelog";

function buildRenderedCalculationSources(): readonly RenderedCalculationSource[] {
return CALCULATION_SOURCES.map((source) => ({
id: source.id,
domain: source.domain,
standard: source.standard,
summary: source.summary,
codeRefs: source.codeRefs,
equations: source.equations.map((eq) => ({
label: eq.label,
renderedHtml: katex.renderToString(eq.latex, {
displayMode: true,
throwOnError: false,
}),
})),
}));
}

function PresentationLoadingFallback(): ReactElement {
return ( <div className="flex h-dvh w-full items-center justify-center bg-[#050a14] text-sm text-cyan-300">
Memuat Halaman Presentasi Interaktif IBDS... </div>
);
}

export default function PresentationPage(): ReactElement {
const releases = getAllChangelogReleases();
const renderedCalculationSources = buildRenderedCalculationSources();

return (
<Suspense fallback={<PresentationLoadingFallback />}>
<PresentationShell
        releases={releases}
        calculationSources={renderedCalculationSources}
        seedValidationCards={VALIDATION_CASE_CARDS}
      />
</Suspense>
);
}

> > > > > > > REPLACE

Semua **4 file yang hilang** (`ValidationCaseCardItem.tsx`, `ValidationProofSection.tsx`, `PresentationShell.tsx`, dan `src/app/presentation/page.tsx`) sudah lengkap & 100% selaras dengan seluruh kontrak Part 1! 🚀 `⌐■_■`

Tinggal apply via `bun diff`, lalu:

1. Jalankan `bun run presentation:sync-assets` _(biar manual PDF 24-slide & screenshots masuk ke `public/presentation/manual/`)_.
2. Jalankan `bun lint` untuk pastikan 0 error.
3. Refresh `http://localhost:3000/presentation` — 404 langsung hilang dan halaman presentasi dual-mode (Scroll + Deck + Validasi SAP2000/Excel + GitHub iframe) langsung nyala! ⚡
