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

  const aggregateMetrics = useMemo(() => computeValidationAggregateMetrics(allCards), [allCards]);

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

  return (
    <section id={id} className={cn("scroll-mt-20 space-y-6", className)}>
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
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
          </Badge>
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
          Sumber Data Hitungan &amp; Bukti Validasi Numerik
        </h2>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-300/85">
          Seluruh formulasi mekanika Euler-Bernoulli, SNI 1729:2020, dan SNI 2847:2019 dapat
          ditelusuri langsung hingga ke baris kode sumber dan diuji silang terhadap{" "}
          <strong className="text-cyan-200">SAP2000</strong> serta{" "}
          <strong className="text-emerald-200">Perhitungan Excel Manual</strong>.
        </p>
      </header>

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
