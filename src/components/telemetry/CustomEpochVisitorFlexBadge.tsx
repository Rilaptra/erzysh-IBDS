/**
 * @file CustomEpochVisitorFlexBadge.tsx
 * @description UI Pill Badge & interactive telemetry popover displaying the custom epoch GA4 visitor flex counter.
 * Styled in dark CAD/CAE theme (`#0f1416`, border `slate-700/75`) matching the IBDS workstation HUD,
 * supporting hover preview + click/tap pin toggle, Escape/outside light-dismiss, and inline refresh.
 */

"use client";

import { cn } from "cn";
import { BarChart3, Calendar, ChevronDown, Clock, Database, RefreshCw } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import React, { type ReactElement, useCallback, useEffect, useRef, useState } from "react";

import { useVisitorFlexCounter } from "@/hooks/use-visitor-flex-counter";

/**
 * Props for `CustomEpochVisitorFlexBadge`.
 */
export interface CustomEpochVisitorFlexBadgeProps {
  /** Optional custom CSS class name. */
  readonly className?: string;
  /** Whether to enable the interactive telemetry details popover on hover/click. Defaults to true. */
  readonly enableTooltip?: boolean;
}

const HOVER_CLOSE_DELAY_MS = 160;

/**
 * Renders the custom epoch visitor count pill badge with pulsing status dot,
 * separated refresh control, and vertical telemetry details popover.
 */
export function CustomEpochVisitorFlexBadge({
  className,
  enableTooltip = true,
}: CustomEpochVisitorFlexBadgeProps): ReactElement {
  const { visitorCount, formattedBadge, status, isLoading, error, cachedAt, refresh } =
    useVisitorFlexCounter();

  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isHoverOpen, setIsHoverOpen] = useState<boolean>(false);
  const [isPinned, setIsPinned] = useState<boolean>(false);
  const hoverCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isOpen = enableTooltip && (isHoverOpen || isPinned);

  const clearHoverCloseTimer = useCallback((): void => {
    if (hoverCloseTimerRef.current !== null) {
      clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearHoverCloseTimer, [clearHoverCloseTimer]);

  const handleHoverEnter = useCallback((): void => {
    if (!enableTooltip) return;
    clearHoverCloseTimer();
    setIsHoverOpen(true);
  }, [clearHoverCloseTimer, enableTooltip]);

  const handleHoverLeave = useCallback((): void => {
    if (!enableTooltip) return;
    clearHoverCloseTimer();
    hoverCloseTimerRef.current = setTimeout(() => {
      setIsHoverOpen(false);
    }, HOVER_CLOSE_DELAY_MS);
  }, [clearHoverCloseTimer, enableTooltip]);

  const handleTogglePin = useCallback((): void => {
    if (!enableTooltip) return;
    clearHoverCloseTimer();
    // Hover often opens the preview first; clicking when unpinned pins it open instead of closing.
    setIsPinned((prevPinned) => {
      if (prevPinned) {
        setIsHoverOpen(false);
        return false;
      }
      return true;
    });
  }, [clearHoverCloseTimer, enableTooltip]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean): void => {
      if (!nextOpen) {
        clearHoverCloseTimer();
        setIsPinned(false);
        setIsHoverOpen(false);
      }
    },
    [clearHoverCloseTimer],
  );

  const handleManualRefresh = async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation();
    if (isRefreshing || isLoading) return;
    setIsRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const statusMeta = (() => {
    switch (status) {
      case "fresh":
        return {
          shortLabel: "GA4 Live",
          detailLabel: "GA4 Live (Terbaru)",
          dotClass: "bg-emerald-500",
          pingClass: "bg-emerald-400",
          countClass: "text-emerald-300",
          chipClass: "border-emerald-500/35 bg-emerald-500/12 text-emerald-300",
          detailTextClass: "text-emerald-400",
        };
      case "cached":
        return {
          shortLabel: "Cache 900s",
          detailLabel: "Tersimpan di Cache (900s)",
          dotClass: "bg-emerald-500",
          pingClass: "bg-emerald-400",
          countClass: "text-cyan-300",
          chipClass: "border-sky-500/35 bg-sky-500/12 text-sky-300",
          detailTextClass: "text-sky-400",
        };
      case "fallback":
        return {
          shortLabel: "Lokal",
          detailLabel: "Fallback Lokal (Dev)",
          dotClass: "bg-amber-500",
          pingClass: "bg-amber-400",
          countClass: "text-amber-300",
          chipClass: "border-amber-500/35 bg-amber-500/12 text-amber-300",
          detailTextClass: "text-amber-400",
        };
    }
  })();

  const formattedCount = visitorCount.toLocaleString("en-US");
  const formattedUpdatedAt = (() => {
    if (!cachedAt) return null;
    const timestamp = Date.parse(cachedAt);
    if (Number.isNaN(timestamp)) return null;
    return new Date(timestamp).toLocaleTimeString("id-ID");
  })();

  const pillLabelContent =
    isLoading && !visitorCount ? (
      <span className="text-slate-300">Mengambil data...</span>
    ) : (
      <>
        <span className="text-slate-300">Visited </span>
        <span className={cn("font-bold tabular-nums", statusMeta.countClass)}>
          {formattedCount}
        </span>
        <span className="text-slate-300"> times</span>
        <span className="hidden text-slate-400 sm:inline"> since 01 Nov 2026</span>
      </>
    );

  const triggerButton = (
    <button
      type="button"
      onClick={enableTooltip ? handleTogglePin : undefined}
      onMouseEnter={enableTooltip ? handleHoverEnter : undefined}
      onMouseLeave={enableTooltip ? handleHoverLeave : undefined}
      aria-label={enableTooltip ? `${formattedBadge} — Lihat statistik pengunjung` : formattedBadge}
      aria-expanded={enableTooltip ? isOpen : undefined}
      className={cn(
        "text-foreground inline-flex h-full min-w-0 items-center gap-1.5 rounded-l-full pr-2 pl-2.5 font-mono text-[10px] leading-none transition-colors select-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 focus-visible:outline-none sm:gap-2 sm:pl-3 sm:text-[11px]",
        enableTooltip ? "cursor-pointer hover:bg-white/5" : "cursor-default",
        !enableTooltip && "rounded-r-full pr-2.5 sm:pr-3",
      )}
    >
      {/* Pulsing live status indicator dot */}
      <span className="relative flex size-2 shrink-0">
        <span
          className={cn(
            "absolute inline-flex size-full animate-ping rounded-full opacity-75",
            statusMeta.pingClass,
          )}
        />
        <span className={cn("relative inline-flex size-2 rounded-full", statusMeta.dotClass)} />
      </span>

      {/* Formatted Counter Text */}
      <span className="min-w-0 truncate tracking-tight">{pillLabelContent}</span>

      {/* Explicit disclosure indicator (touch + screen reader affordance) */}
      {enableTooltip && (
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "size-3 shrink-0 text-slate-400 transition-transform duration-150",
            isOpen && "rotate-180 text-cyan-300",
          )}
        />
      )}
    </button>
  );

  const refreshButton = (
    <button
      type="button"
      aria-label="Refresh visitor count"
      title="Perbarui jumlah pengunjung"
      disabled={isRefreshing || isLoading}
      onClick={handleManualRefresh}
      className="text-muted-foreground inline-flex h-full shrink-0 cursor-pointer items-center justify-center rounded-r-full px-2 transition-colors hover:bg-white/5 hover:text-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-400/70 focus-visible:outline-none disabled:cursor-wait disabled:opacity-60"
    >
      <RefreshCw
        aria-hidden="true"
        className={cn(
          "size-3 transition-transform",
          (isRefreshing || isLoading) && "animate-spin text-cyan-400",
        )}
      />
    </button>
  );

  const pillContainer = (
    <div
      role="status"
      data-testid="visitor-flex-badge"
      className={cn(
        "border-border/60 bg-card/85 inline-flex h-7 max-w-full min-w-0 items-center overflow-hidden rounded-full border shadow-md backdrop-blur-md transition-colors",
        isOpen ? "border-cyan-500/50 bg-[#121a1e]/95" : "hover:border-slate-600/80",
        className,
      )}
    >
      {triggerButton}
      <span aria-hidden="true" className="bg-border/60 h-3.5 w-px shrink-0" />
      {refreshButton}
    </div>
  );

  if (!enableTooltip) {
    return pillContainer;
  }

  return (
    <PopoverPrimitive.Root open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Anchor asChild>{pillContainer}</PopoverPrimitive.Anchor>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side="bottom"
          align="end"
          sideOffset={8}
          collisionPadding={12}
          onMouseEnter={handleHoverEnter}
          onMouseLeave={handleHoverLeave}
          onPointerDown={(e) => e.stopPropagation()}
          onOpenAutoFocus={(e) => {
            // Preserve focus on trigger during hover preview (WCAG 3.2.1 On Focus).
            if (!isPinned) {
              e.preventDefault();
            }
          }}
          data-testid="visitor-telemetry-popover"
          className={cn(
            "z-50 flex w-72 max-w-[calc(100vw-24px)] flex-col gap-3 rounded-xl border border-slate-700/75 bg-[#0b1014]/95 p-3.5 text-slate-200 shadow-[0_18px_44px_-12px_rgba(0,0,0,0.88)] backdrop-blur-xl outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-150",
          )}
        >
          {/* Card Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-cyan-500/25 bg-cyan-500/10 text-cyan-400">
                <BarChart3 aria-hidden="true" className="size-3.5" />
              </span>
              <div className="flex flex-col">
                <span className="text-xs leading-tight font-semibold text-slate-100">
                  Statistik Pengunjung
                </span>
                <span className="text-[10px] leading-tight text-slate-400">Telemetri IBDS</span>
              </div>
            </div>

            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium",
                statusMeta.chipClass,
              )}
            >
              <span className={cn("size-1.5 rounded-full", statusMeta.dotClass)} />
              {statusMeta.shortLabel}
            </span>
          </div>

          {/* Primary KPI Highlight */}
          <div className="flex items-end justify-between gap-2 rounded-lg border border-slate-800/90 bg-slate-900/75 px-3 py-2.5">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-medium tracking-wider text-slate-400 uppercase">
                Total Kunjungan
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-2xl leading-none font-bold tracking-tight text-slate-50 tabular-nums">
                  {formattedCount}
                </span>
                <span className="text-[11px] font-medium text-slate-400">sesi</span>
              </div>
            </div>

            <span className="rounded-md border border-slate-700/70 bg-slate-800/70 px-2 py-0.5 font-mono text-[10px] text-slate-300">
              Epoch Nov &apos;26
            </span>
          </div>

          {/* Structured Key-Value Telemetry Rows */}
          <dl className="flex flex-col gap-2 text-[11px]">
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-slate-400">
                <Calendar aria-hidden="true" className="size-3.5 shrink-0 text-slate-500" />
                <span>Mulai Epoch</span>
              </dt>
              <dd className="font-mono font-semibold text-slate-200">01 Nov 2026</dd>
            </div>

            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-slate-400">
                <Database aria-hidden="true" className="size-3.5 shrink-0 text-slate-500" />
                <span>Status Data</span>
              </dt>
              <dd className={cn("text-right font-mono font-medium", statusMeta.detailTextClass)}>
                {statusMeta.detailLabel}
              </dd>
            </div>

            {formattedUpdatedAt && (
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-slate-400">
                  <Clock aria-hidden="true" className="size-3.5 shrink-0 text-slate-500" />
                  <span>Diperbarui</span>
                </dt>
                <dd className="font-mono text-slate-300 tabular-nums">{formattedUpdatedAt}</dd>
              </div>
            )}
          </dl>

          {/* Footer Action Row */}
          <div className="flex items-center justify-between gap-2 border-t border-slate-800/80 pt-2.5">
            <span className={cn("text-[10px]", error ? "text-amber-400" : "text-slate-500")}>
              {error ? "Sinkronisasi offline (fallback)" : "Auto-cache TTL 15 menit"}
            </span>

            <button
              type="button"
              disabled={isRefreshing || isLoading}
              onClick={handleManualRefresh}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-700/80 bg-slate-800/80 px-2 py-1 text-[10px] font-medium text-slate-200 transition-colors hover:border-cyan-500/40 hover:bg-cyan-500/15 hover:text-cyan-200 disabled:cursor-wait disabled:opacity-60"
            >
              <RefreshCw
                aria-hidden="true"
                className={cn(
                  "size-3",
                  (isRefreshing || isLoading) && "animate-spin text-cyan-400",
                )}
              />
              <span>{isRefreshing || isLoading ? "Memuat..." : "Perbarui"}</span>
            </button>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
