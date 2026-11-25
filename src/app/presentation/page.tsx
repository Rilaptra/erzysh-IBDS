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
  return (
    <div className="flex h-dvh w-full items-center justify-center bg-[#050a14] text-sm text-cyan-300">
      Memuat Halaman Presentasi Interaktif IBDS...
    </div>
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
