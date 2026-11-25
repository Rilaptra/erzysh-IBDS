"use client";

import { CircleCheckIcon, FolderIcon, GitBranchIcon, LightbulbIcon } from "lucide-react";
import { type ReactElement, useState } from "react";

import { glassPanelClass } from "@/components/landing/ErzyshPageShell";
import { Badge } from "@/components/ui/badge";
import { DEVELOPMENT_PHASES, DEVELOPMENT_TELEMETRY } from "@/data/presentation/development-phases";
import { cn } from "@/lib/utils";

export function DevelopmentProcessTimeline(): ReactElement {
  const [selectedIndex, setSelectedIndex] = useState<number>(DEVELOPMENT_PHASES.length - 1);
  const activePhase = DEVELOPMENT_PHASES[selectedIndex] ?? DEVELOPMENT_PHASES[0]!;

  return (
    <div className="flex flex-col gap-5">
      <dl
        className={cn(
          glassPanelClass,
          "grid grid-cols-2 divide-y divide-cyan-500/15 sm:grid-cols-4 sm:divide-x sm:divide-y-0",
        )}
      >
        <div className="p-3.5 text-center sm:text-left">
          <dt className="text-[10px] font-bold tracking-wider text-slate-400">GIT COMMITS</dt>
          <dd className="mt-0.5 font-mono text-sm font-bold text-cyan-300 tabular-nums">
            {DEVELOPMENT_TELEMETRY.commitsCount} commits
          </dd>
        </div>
        <div className="p-3.5 text-center sm:text-left">
          <dt className="text-[10px] font-bold tracking-wider text-slate-400">RELEASE TAGS</dt>
          <dd className="mt-0.5 font-mono text-sm font-bold text-sky-300 tabular-nums">
            {DEVELOPMENT_TELEMETRY.tagsCount} tags
          </dd>
        </div>
        <div className="p-3.5 text-center sm:text-left">
          <dt className="text-[10px] font-bold tracking-wider text-slate-400">MERGED PR</dt>
          <dd className="mt-0.5 font-mono text-sm font-bold text-violet-300 tabular-nums">
            {DEVELOPMENT_TELEMETRY.mergedPrsCount} PR (flash → main)
          </dd>
        </div>
        <div className="p-3.5 text-center sm:text-left">
          <dt className="text-[10px] font-bold tracking-wider text-slate-400">VERIFIKASI CI</dt>
          <dd className="mt-0.5 font-mono text-sm font-bold text-emerald-300 tabular-nums">
            {DEVELOPMENT_TELEMETRY.testCasesCount} TS + {DEVELOPMENT_TELEMETRY.rustCargoTestsCount}{" "}
            Rust Tests
          </dd>
        </div>
      </dl>

      <div
        role="tablist"
        aria-label="Tahapan pembuatan aplikasi"
        className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6"
      >
        {DEVELOPMENT_PHASES.map((phase, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <button
              key={phase.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => setSelectedIndex(idx)}
              className={cn(
                "rounded-lg border p-3 text-left transition-all",
                isSelected
                  ? "border-cyan-400/70 bg-cyan-500/15 shadow-md shadow-cyan-500/10"
                  : "border-cyan-500/15 bg-[#0a1322]/75 hover:border-cyan-400/35",
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-mono text-[10px] font-bold text-cyan-300">
                  {phase.phaseCode}
                </span>
                <span className="font-mono text-[9px] text-slate-400">{idx + 1}/6</span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-100">
                {phase.title}
              </p>
              <p className="mt-1 font-mono text-[10px] text-slate-400">{phase.period}</p>
            </button>
          );
        })}
      </div>

      <article className={cn(glassPanelClass, "p-5")}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-500/15 pb-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="border-cyan-400/40 bg-cyan-500/15 font-mono text-[10px] text-cyan-200"
              >
                {activePhase.phaseCode}
              </Badge>
              <span className="font-mono text-xs text-slate-400">{activePhase.period}</span>
            </div>
            <h3 className="mt-1.5 text-base font-bold text-slate-100">{activePhase.title}</h3>
          </div>
          <Badge
            variant="outline"
            className="border-violet-400/35 bg-violet-500/10 font-mono text-[10px] text-violet-200"
          >
            <GitBranchIcon className="mr-1 size-3" aria-hidden="true" />
            {activePhase.gitRef}
          </Badge>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-slate-300 sm:text-sm">
          {activePhase.focus}
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-cyan-500/15 bg-[#060d19]/80 p-3.5">
            <p className="text-[11px] font-bold tracking-wider text-emerald-300">
              LUARAN KUNCI (DELIVERABLES)
            </p>
            <ul className="mt-2 space-y-1.5 text-xs text-slate-300">
              {activePhase.deliverables.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CircleCheckIcon
                    className="mt-0.5 size-3.5 shrink-0 text-emerald-400"
                    aria-hidden="true"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col justify-between gap-3 rounded-lg border border-cyan-500/15 bg-[#060d19]/80 p-3.5">
            <div>
              <p className="text-[11px] font-bold tracking-wider text-sky-300">
                ARTEFAK NYATA REPOSITORI
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {activePhase.artifactPaths.map((artifact) => (
                  <li key={artifact}>
                    <code className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-900/90 px-2 py-0.5 font-mono text-[10px] text-cyan-200">
                      <FolderIcon className="size-3 text-sky-400" aria-hidden="true" />
                      {artifact}
                    </code>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-md border border-amber-400/25 bg-amber-500/10 p-2.5 text-xs text-amber-100/90">
              <span className="inline-flex items-center gap-1.5 font-semibold text-amber-300">
                <LightbulbIcon className="size-3.5" aria-hidden="true" />
                Engineering Lesson:
              </span>{" "}
              {activePhase.engineeringLesson}
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
