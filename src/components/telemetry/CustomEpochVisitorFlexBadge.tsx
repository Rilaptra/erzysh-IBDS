/**
 * @file CustomEpochVisitorFlexBadge.tsx
 * @description UI Pill Badge displaying the custom epoch GA4 visitor flex counter.
 * Styled in dark CAD/CAE theme (`#0A0A0A`, border `#334155`) with a pulsing green indicator
 * and interactive telemetry details popover / tooltip.
 */

"use client";

import { cn } from "cn";
import React, { type ReactElement, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useVisitorFlexCounter } from "@/hooks/use-visitor-flex-counter";

/**
 * Props for `CustomEpochVisitorFlexBadge`.
 */
export interface CustomEpochVisitorFlexBadgeProps {
  /** Optional custom CSS class name. */
  readonly className?: string;
  /** Whether to show the details tooltip on hover/click. Defaults to true. */
  readonly enableTooltip?: boolean;
}

/**
 * Renders the custom epoch visitor count badge with pulsing status dot and details tooltip.
 *
 * @param {CustomEpochVisitorFlexBadgeProps} props Component properties.
 * @returns {ReactElement} Rendered pill badge component.
 *
 * @example
 * <CustomEpochVisitorFlexBadge />
 */
export function CustomEpochVisitorFlexBadge({
  className,
  enableTooltip = true,
}: CustomEpochVisitorFlexBadgeProps): ReactElement {
  const { formattedBadge, visitorCount, status, isLoading, cachedAt, refresh } =
    useVisitorFlexCounter();

  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const handleManualRefresh = async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation();
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusLabel = (): string => {
    switch (status) {
      case "fresh":
        return "GA4 Live (Terbaru)";
      case "cached":
        return "Tersimpan di Cache (900s)";
      case "fallback":
        return "Fallback Lokal (Dev)";
    }
  };

  const badgeElement = (
    <Badge
      variant="outline"
      role="status"
      aria-label={formattedBadge}
      className={cn(
        "border-border/60 bg-card text-foreground hover:bg-muted/50 inline-flex cursor-pointer items-center gap-2 rounded-full px-3 py-1 font-mono text-[11px] shadow-md transition-all select-none",
        className,
      )}
    >
      {/* Pulsing indicator dot */}
      <span className="relative flex size-2">
        <span
          className={cn(
            "absolute inline-flex size-full animate-ping rounded-full opacity-75",
            status === "fallback" ? "bg-amber-500" : "bg-emerald-500",
          )}
        />
        <span
          className={cn(
            "relative inline-flex size-2 rounded-full",
            status === "fallback" ? "bg-amber-600" : "bg-emerald-600",
          )}
        />
      </span>

      {/* Badge Text */}
      <span className="font-semibold tracking-wide">
        {isLoading && !visitorCount ? "Mengambil data..." : formattedBadge}
      </span>

      {/* Refresh Icon */}
      <button
        type="button"
        aria-label="Refresh visitor count"
        onClick={handleManualRefresh}
        className="text-muted-foreground hover:text-foreground ml-0.5 inline-flex cursor-pointer items-center justify-center p-0 transition-colors"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn("transition-transform", (isRefreshing || isLoading) && "animate-spin")}
        >
          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
        </svg>
      </button>
    </Badge>
  );

  if (!enableTooltip) {
    return badgeElement;
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{badgeElement}</TooltipTrigger>
        <TooltipContent
          side="top"
          className="border-slate-800 bg-slate-950 font-mono text-[11px] text-slate-200 shadow-xl"
        >
          <div className="mb-1 font-bold text-slate-100">📊 Statistik Pengunjung IBDS</div>
          <div>
            Mulai Epoch: <strong>01 Nov 2026</strong>
          </div>
          <div>
            Total Kunjungan: <strong>{visitorCount.toLocaleString()}</strong> sesi
          </div>
          <div>
            Status Data: <strong className="text-sky-400">{getStatusLabel()}</strong>
          </div>
          {cachedAt && (
            <div className="mt-1 text-[10px] text-slate-400">
              Terakhir diperbarui: {new Date(cachedAt).toLocaleTimeString("id-ID")}
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
