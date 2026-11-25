"use client";

import {
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  GitBranchIcon,
  MonitorIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  TabletIcon,
} from "lucide-react";
import type { ReactElement } from "react";
import { useState } from "react";

import { glassPanelClass } from "@/components/landing/ErzyshPageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { APP_VERSION, WASM_VERSION } from "@/config/version";
import { cn } from "@/lib/utils";

export interface GitHubIframePreviewSectionProps {
  readonly id?: string;
  readonly repoUrl?: string;
  readonly embedSrc?: string;
  readonly className?: string;
}

const DEFAULT_REPO_URL = "https://github.com/Rilaptra/erzysh-IBDS";
const DEFAULT_EMBED_SRC = "/embed/github-repo";

export function GitHubIframePreviewSection({
  id = "bab-9-github-preview",
  repoUrl = DEFAULT_REPO_URL,
  embedSrc = DEFAULT_EMBED_SRC,
  className,
}: GitHubIframePreviewSectionProps): ReactElement {
  const [frameWidthMode, setFrameWidthMode] = useState<"full" | "compact">("full");
  const [reloadKey, setReloadKey] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const handleCopyUrl = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(repoUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      setCopiedUrl(false);
    }
  };

  const handleReload = (): void => {
    setIsLoaded(false);
    setReloadKey((prev) => prev + 1);
  };

  return (
    <section id={id} className={cn("scroll-mt-20 space-y-5", className)}>
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="border-cyan-400/30 bg-cyan-500/10 font-mono text-[10px] text-cyan-300"
          >
            BAB 09
          </Badge>
          <Badge
            variant="outline"
            className="border-emerald-400/30 bg-emerald-500/10 text-[10px] text-emerald-200"
          >
            <ShieldCheckIcon className="mr-1 size-3 text-emerald-400" aria-hidden="true" />
            SAME-ORIGIN IFRAME · CSP FRAME-ANCESTORS &apos;SELF&apos;
          </Badge>
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
          Pratinjau Langsung Repositori GitHub
        </h2>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-300/85">
          Karena <code className="font-mono text-xs text-cyan-300">github.com</code> mengirimkan{" "}
          <code className="font-mono text-xs text-amber-300">X-Frame-Options: DENY</code>, IBDS
          menyajikan rute same-origin{" "}
          <code className="font-mono text-xs text-cyan-300">{embedSrc}</code> di dalam{" "}
          <code className="font-mono text-xs text-cyan-300">&lt;iframe&gt;</code> dengan cache ISR 1
          jam dan fallback snapshot statis agar tetap utuh saat sidang offline.
        </p>
      </header>

      <div className="no-print">
        <div
          className={cn(
            glassPanelClass,
            "mx-auto overflow-hidden border-cyan-500/25 transition-[max-width] duration-300",
            frameWidthMode === "compact" ? "max-w-[768px]" : "max-w-full",
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-500/20 bg-[#081224]/95 px-3 py-2">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <div className="hidden items-center gap-1.5 sm:flex" aria-hidden="true">
                <span className="size-2.5 rounded-full bg-red-500/70" />
                <span className="size-2.5 rounded-full bg-amber-400/70" />
                <span className="size-2.5 rounded-full bg-emerald-400/70" />
              </div>

              <div className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md border border-cyan-500/20 bg-[#050b16] px-2.5 py-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <GitBranchIcon className="size-3.5 shrink-0 text-cyan-400" aria-hidden="true" />
                  <span className="truncate font-mono text-[11px] text-slate-300">{repoUrl}</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="shrink-0 text-slate-400 transition-colors hover:text-cyan-300"
                  aria-label="Salin URL repositori GitHub"
                  title="Salin URL repositori"
                >
                  {copiedUrl ? (
                    <CheckIcon className="size-3.5 text-emerald-400" aria-hidden="true" />
                  ) : (
                    <CopyIcon className="size-3.5" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <div className="hidden rounded-md border border-cyan-500/20 bg-[#050b16] p-0.5 md:inline-flex">
                <button
                  type="button"
                  onClick={() => setFrameWidthMode("full")}
                  className={cn(
                    "flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors",
                    frameWidthMode === "full"
                      ? "bg-cyan-500/20 text-cyan-200"
                      : "text-slate-400 hover:text-slate-200",
                  )}
                >
                  <MonitorIcon className="size-3" aria-hidden="true" />
                  <span>Desktop 100%</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFrameWidthMode("compact")}
                  className={cn(
                    "flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors",
                    frameWidthMode === "compact"
                      ? "bg-cyan-500/20 text-cyan-200"
                      : "text-slate-400 hover:text-slate-200",
                  )}
                >
                  <TabletIcon className="size-3" aria-hidden="true" />
                  <span>Compact 768px</span>
                </button>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleReload}
                className="h-7 border-cyan-500/25 bg-[#060d19] px-2 text-[11px] text-slate-200"
                title="Muat ulang pratinjau iframe"
              >
                <RefreshCwIcon className="size-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Muat Ulang</span>
              </Button>

              <Button
                asChild
                size="sm"
                className="h-7 bg-linear-to-r from-cyan-400 via-sky-400 to-violet-500 px-2.5 text-[11px] font-bold text-slate-950 hover:brightness-110"
              >
                <a href={repoUrl} target="_blank" rel="noopener noreferrer">
                  <span>Buka di GitHub</span>
                  <ExternalLinkIcon className="size-3" aria-hidden="true" />
                </a>
              </Button>
            </div>
          </div>

          <div className="relative bg-[#0d1117]">
            {!isLoaded ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[#0d1117]/90 text-xs text-slate-400"
              >
                <RefreshCwIcon className="size-5 animate-spin text-cyan-400" />
                <span>Memuat pratinjau repositori Rilaptra/erzysh-IBDS...</span>
              </div>
            ) : null}

            <iframe
              key={reloadKey}
              src={embedSrc}
              title="Pratinjau langsung repositori GitHub Rilaptra/erzysh-IBDS"
              loading="lazy"
              sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              referrerPolicy="no-referrer"
              onLoad={() => setIsLoaded(true)}
              className="h-[460px] w-full rounded-b-lg border-0 bg-[#0d1117] sm:h-[540px]"
            />
          </div>
        </div>
      </div>

      <div className="print-only hidden rounded-lg border border-slate-400 p-4 text-slate-900">
        <p className="text-xs font-bold uppercase">Ringkasan Repositori GitHub (Mode Cetak)</p>
        <p className="mt-1 font-mono text-sm font-bold">{repoUrl}</p>
        <p className="mt-1 text-xs">
          Rilaptra/erzysh-IBDS · Branch: main · Lisensi: MIT · App v{APP_VERSION} · Rust WASM v
          {WASM_VERSION}
        </p>
        <p className="mt-1 font-mono text-xs">git clone {repoUrl}.git</p>
      </div>
    </section>
  );
}

export default GitHubIframePreviewSection;
