/**
 * @file CustomEpochVisitorFlexBadge.tsx
 * @description UI Pill Badge displaying the custom epoch GA4 visitor flex counter.
 * Styled in dark CAD/CAE theme (`#0A0A0A`, border `#334155`) with a pulsing green indicator
 * and interactive telemetry details popover / tooltip.
 */

"use client";

import React, { type ReactElement, useState } from "react";

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

  const [isTooltipOpen, setIsTooltipOpen] = useState<boolean>(false);
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

  return (
    <div
      className={className}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
      }}
      onMouseEnter={() => enableTooltip && setIsTooltipOpen(true)}
      onMouseLeave={() => enableTooltip && setIsTooltipOpen(false)}
    >
      <div
        role="status"
        aria-label={formattedBadge}
        onClick={() => enableTooltip && setIsTooltipOpen((prev) => !prev)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          backgroundColor: "#0A0A0A",
          border: "1px solid #334155",
          padding: "4px 12px",
          borderRadius: 9999,
          fontSize: 11,
          fontFamily: "var(--font-mono, monospace)",
          color: "#E2E8F0",
          cursor: "pointer",
          userSelect: "none",
          transition: "all 0.2s ease-in-out",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.4)",
        }}
      >
        {/* Pulsing indicator dot */}
        <span
          style={{
            position: "relative",
            display: "flex",
            height: 8,
            width: 8,
          }}
        >
          <span
            style={{
              position: "absolute",
              display: "inline-flex",
              height: "100%",
              width: "100%",
              borderRadius: "50%",
              backgroundColor: status === "fallback" ? "#F59E0B" : "#10B981",
              opacity: 0.75,
              animation: "ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite",
            }}
          />
          <span
            style={{
              position: "relative",
              display: "inline-flex",
              borderRadius: "50%",
              height: 8,
              width: 8,
              backgroundColor: status === "fallback" ? "#D97706" : "#059669",
            }}
          />
        </span>

        {/* Badge Text */}
        <span style={{ fontWeight: 600, letterSpacing: "0.02em" }}>
          {isLoading && !visitorCount ? "Mengambil data..." : formattedBadge}
        </span>

        {/* Refresh Icon */}
        <button
          type="button"
          aria-label="Refresh visitor count"
          onClick={handleManualRefresh}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            color: "#94A3B8",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginLeft: 2,
          }}
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
            style={{
              animation: isRefreshing || isLoading ? "spin 1s linear infinite" : "none",
            }}
          >
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
          </svg>
        </button>
      </div>

      {/* Tooltip / Details Popover */}
      {isTooltipOpen && (
        <div
          role="tooltip"
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "#0F172A",
            border: "1px solid #475569",
            borderRadius: 6,
            padding: "10px 14px",
            fontSize: 11,
            color: "#CBD5E1",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.6)",
            zIndex: 1000,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            fontFamily: "var(--font-mono, monospace)",
          }}
        >
          <div style={{ fontWeight: 700, color: "#F8FAFC", marginBottom: 4 }}>
            📊 Statistik Pengunjung IBDS
          </div>
          <div>
            Mulai Epoch: <strong>01 Nov 2026</strong>
          </div>
          <div>
            Total Kunjungan: <strong>{visitorCount.toLocaleString()}</strong> sesi
          </div>
          <div>
            Status Data: <strong style={{ color: "#38BDF8" }}>{getStatusLabel()}</strong>
          </div>
          {cachedAt && (
            <div style={{ fontSize: 10, color: "#64748B", marginTop: 4 }}>
              Terakhir diperbarui: {new Date(cachedAt).toLocaleTimeString("id-ID")}
            </div>
          )}
        </div>
      )}

      {/* CSS Keyframes for Ping and Spin */}
      <style jsx>{`
        @keyframes ping {
          75%,
          100% {
            transform: scale(2);
            opacity: 0;
          }
        }
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
