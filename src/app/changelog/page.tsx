import { ArrowLeftIcon, HistoryIcon, RulerIcon, SparklesIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement } from "react";

import { ChangelogExplorer } from "@/components/changelog/ChangelogExplorer";
import { ErzyshPageShell, glassPanelClass } from "@/components/landing/ErzyshPageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { APP_VERSION } from "@/config/version";
import { formatChangelogDate, getAllChangelogReleases } from "@/lib/changelog";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Changelog — IBDS",
  description:
    "Riwayat lengkap pembaruan, fitur baru, peningkatan performa, dan perbaikan bug untuk Interactive Beam Deflection & Structural Design Simulator (IBDS).",
};

export default function ChangelogPage(): ReactElement {
  const releases = getAllChangelogReleases();
  const latest = releases[0];
  const totalChanges = releases.reduce((sum, release) => sum + release.totalItems, 0);

  return (
    <ErzyshPageShell>
      <header className="erzysh-landing-header sticky top-0 z-40 px-4 pt-3 sm:px-6">
        <nav
          aria-label="Navigasi utama"
          className={cn(
            glassPanelClass,
            "mx-auto flex max-w-6xl items-center justify-between px-3 py-1.5",
          )}
        >
          <Link
            href="/"
            prefetch={false}
            className="flex items-center gap-2 text-xs font-bold tracking-wider"
          >
            <RulerIcon className="size-4 text-cyan-400" aria-hidden="true" />
            <span>IBDS</span>
          </Link>

          <div className="flex items-center gap-1.5">
            <Button asChild variant="ghost" size="sm" className="text-[11px] text-slate-300">
              <Link href="/" prefetch={false}>
                <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
                <span>Beranda</span>
              </Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="bg-linear-to-r from-cyan-400 via-sky-400 to-violet-500 text-[11px] font-bold text-slate-950 transition-all hover:brightness-110"
            >
              <Link href="/simulator" prefetch={false}>
                Buka Simulator
              </Link>
            </Button>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        {/* Page Header */}
        <section className="mb-10 flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <Badge
              variant="outline"
              className="w-fit border-cyan-400/25 bg-[#0c1a2c]/80 text-[11px] text-cyan-200"
            >
              <HistoryIcon className="size-3 text-cyan-400" aria-hidden="true" />
              <span>RELEASE NOTES · CHANGELOG.md</span>
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Changelog &amp;{" "}
              <span className="bg-linear-to-r from-cyan-300 via-sky-400 to-violet-400 bg-clip-text text-transparent">
                Riwayat Pembaruan
              </span>
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-300/85">
              Dokumentasi kronologis seluruh rilis IBDS — mulai dari fitur simulator 3D, solver Rust
              WASM, asisten AI &amp; gestur tangan, hingga pembaruan standar desain SNI.
            </p>
          </div>

          {/* Summary Stats */}
          <dl
            className={cn(
              glassPanelClass,
              "grid grid-cols-2 divide-y divide-cyan-500/15 sm:grid-cols-4 sm:divide-x sm:divide-y-0",
            )}
          >
            <div className="p-4">
              <dt className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                Versi Saat Ini
              </dt>
              <dd className="mt-1 flex items-center gap-1.5 font-mono text-sm font-bold text-cyan-300">
                <SparklesIcon className="size-3.5 text-cyan-400" aria-hidden="true" />
                <span>v{latest?.version ?? APP_VERSION}</span>
              </dd>
            </div>
            <div className="p-4">
              <dt className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                Rilis Terakhir
              </dt>
              <dd className="mt-1 font-mono text-sm font-semibold text-slate-100">
                {latest ? formatChangelogDate(latest.date) : "—"}
              </dd>
            </div>
            <div className="p-4">
              <dt className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                Total Rilis
              </dt>
              <dd className="mt-1 font-mono text-sm font-semibold text-emerald-300">
                {releases.length} versi
              </dd>
            </div>
            <div className="p-4">
              <dt className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                Total Catatan
              </dt>
              <dd className="mt-1 font-mono text-sm font-semibold text-violet-300">
                {totalChanges} item
              </dd>
            </div>
          </dl>
        </section>

        <ChangelogExplorer releases={releases} latestVersion={latest?.version} />
      </main>

      <footer className="mt-12 border-t border-cyan-500/15 bg-[#050a14]/75 py-8 text-[11px] text-slate-500 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <div className="flex items-center gap-2 text-center sm:text-left">
            <RulerIcon className="size-3.5 text-cyan-400" aria-hidden="true" />
            <span>
              © {new Date().getFullYear()} IBDS — Interactive Beam Deflection &amp; Structural
              Design Simulator
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              prefetch={false}
              className="text-slate-400 transition-colors hover:text-cyan-400"
            >
              Beranda
            </Link>
            <span className="text-slate-700" aria-hidden="true">
              ·
            </span>
            <Link
              href="/simulator"
              prefetch={false}
              className="text-slate-400 transition-colors hover:text-cyan-400"
            >
              Simulator
            </Link>
          </div>
        </div>
      </footer>
    </ErzyshPageShell>
  );
}
