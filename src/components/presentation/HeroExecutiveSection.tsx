"use client";

import gsap from "gsap";
import {
  ArrowRightIcon,
  DownloadIcon,
  ExternalLinkIcon,
  PresentationIcon,
  SparklesIcon,
} from "lucide-react";
import Link from "next/link";
import { type ReactElement, useEffect, useRef } from "react";

import { glassPanelClass } from "@/components/landing/ErzyshPageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { APP_VERSION, WASM_VERSION } from "@/config/version";
import { DEVELOPMENT_TELEMETRY } from "@/data/presentation/development-phases";
import { GITHUB_REPO_URL } from "@/data/presentation/github-fallback-snapshot";
import { cn } from "@/lib/utils";

export interface HeroExecutiveSectionProps {
  readonly totalReleasesCount: number;
  readonly onStartDeckMode: () => void;
}

const TELEMETRY_STRIP = [
  { label: "APP VERSION", value: `v${APP_VERSION}`, accent: "text-cyan-300" },
  { label: "RUST WASM", value: `v${WASM_VERSION} (104.6 KB)`, accent: "text-sky-300" },
  {
    label: "STANDAR SNI",
    value: "SNI 1729:2020 & 2847:2019",
    accent: "text-emerald-300",
  },
  {
    label: "AUTOMATED TESTS",
    value: `${DEVELOPMENT_TELEMETRY.testFilesCount} Suites · ${DEVELOPMENT_TELEMETRY.testCasesCount} Tests`,
    accent: "text-violet-300",
  },
] as const;

export function HeroExecutiveSection({
  totalReleasesCount,
  onStartDeckMode,
}: HeroExecutiveSectionProps): ReactElement {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      gsap.from("[data-pres-hero]", {
        y: 14,
        opacity: 0,
        duration: 0.45,
        stagger: 0.06,
        ease: "power2.out",
        clearProps: "transform,opacity",
      });
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={rootRef} className="flex flex-col gap-6">
      <div className={cn(glassPanelClass, "relative overflow-hidden p-6 sm:p-8 lg:p-10")}>
        <span
          aria-hidden="true"
          className="erzysh-scanline no-print pointer-events-none absolute top-0 left-0 h-px w-44 bg-linear-to-r from-transparent via-cyan-400/70 to-transparent"
        />

        <div className="flex flex-wrap items-center gap-2" data-pres-hero>
          <Badge
            variant="outline"
            className="border-cyan-400/35 bg-[#0c1a2c]/85 text-[11px] text-cyan-200"
          >
            <SparklesIcon className="size-3 text-cyan-400" aria-hidden="true" />
            <span>
              PRESENTASI TEKNIS · v{APP_VERSION} · WASM v{WASM_VERSION}
            </span>
          </Badge>
          <Badge
            variant="outline"
            className="border-emerald-400/30 bg-emerald-500/10 text-[11px] text-emerald-300"
          >
            MIT License · {totalReleasesCount} Rilis Tercatat
          </Badge>
        </div>

        <h1
          data-pres-hero
          className="mt-5 text-2xl font-bold tracking-tight text-balance sm:text-4xl lg:text-[2.65rem] lg:leading-[1.12]"
        >
          Interactive 3D Beam Deflection &amp;{" "}
          <span className="erzysh-gradient-text bg-linear-to-r from-cyan-300 via-sky-400 to-violet-400 bg-clip-text text-transparent">
            Structural Design Simulator (IBDS)
          </span>
        </h1>

        <p
          data-pres-hero
          className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-300/90 sm:text-base"
        >
          Platform rekayasa struktur berbasis web &amp; Adaptive PWA yang memadukan{" "}
          <strong className="text-slate-100">Rust WebAssembly zero-copy</strong>,{" "}
          <strong className="text-slate-100">WebGL2 murni</strong>, dan optimasi penampang{" "}
          <strong className="text-slate-100">SNI 1729:2020 &amp; SNI 2847:2019</strong> dengan
          ekspor 9 format CAD/BIM/CAE serta kendali suara AI &ldquo;Ucuy&rdquo; dan gestur tangan.
        </p>

        <p data-pres-hero className="mt-3 text-xs text-slate-400">
          Dikembangkan oleh{" "}
          <span className="font-semibold text-cyan-300">Rizqi Lasheva Purnama Putra</span> (
          <span className="font-mono">Erzy.sh / @Rilaptra</span>) — Program Studi Teknik Sipil, Mata
          Kuliah Aplikasi Komputer Teknik Sipil.
        </p>

        <div data-pres-hero className="no-print mt-6 flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            size="lg"
            onClick={onStartDeckMode}
            className="bg-linear-to-r from-cyan-400 via-sky-400 to-violet-500 px-4 font-bold text-slate-950 shadow-lg shadow-cyan-500/20 hover:brightness-110"
          >
            <PresentationIcon className="size-4" aria-hidden="true" />
            <span>Mulai Mode Slide (F)</span>
          </Button>

          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-cyan-500/35 bg-cyan-950/35 px-4 font-semibold text-cyan-200 hover:border-cyan-400/70 hover:bg-cyan-500/15"
          >
            <Link href="/simulator" prefetch={false}>
              <span>Buka Simulator Live</span>
              <ArrowRightIcon className="size-4" aria-hidden="true" />
            </Link>
          </Button>

          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-slate-700 bg-[#0b1628]/80 px-3.5 text-slate-200 hover:border-cyan-400/50 hover:text-cyan-200"
          >
            <a href="/presentation/manual/Panduan_01_IBDS.pdf" download>
              <DownloadIcon className="size-4 text-cyan-400" aria-hidden="true" />
              <span>Unduh Manual PDF (24 Slide)</span>
            </a>
          </Button>

          <Button
            asChild
            size="lg"
            variant="ghost"
            className="px-3 text-slate-300 hover:text-white"
          >
            <a href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer">
              <span>GitHub Repo</span>
              <ExternalLinkIcon className="size-3.5" aria-hidden="true" />
            </a>
          </Button>
        </div>
      </div>

      <dl
        data-pres-hero
        className={cn(
          glassPanelClass,
          "grid grid-cols-2 divide-y divide-cyan-500/15 sm:grid-cols-4 sm:divide-x sm:divide-y-0",
        )}
      >
        {TELEMETRY_STRIP.map((item) => (
          <div key={item.label} className="p-4 text-center sm:text-left">
            <dt className="text-[10px] font-bold tracking-wider text-slate-400">{item.label}</dt>
            <dd className={cn("mt-1 font-mono text-xs font-semibold sm:text-sm", item.accent)}>
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
