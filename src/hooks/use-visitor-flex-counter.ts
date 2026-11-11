/**
 * @file use-visitor-flex-counter.ts
 * @description Production-grade React hook for fetching and caching cumulative visitor telemetry
 * from the Next.js `/api/analytics/visitors` endpoint since HARDCODED_START_DATE.
 * Features:
 * - Module-level client-side memory caching to eliminate duplicate requests during navigation.
 * - Automatic background revalidation if client cache exceeds 15 minutes.
 * - Graceful fallback to default visitor count (1,420) during network partition.
 * - Full TypeScript typing with JSDoc and strict error tracing.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  ANALYTICS_CACHE_TTL_SECONDS,
  DEFAULT_FALLBACK_VISITOR_COUNT,
  formatVisitorBadge,
  HARDCODED_START_DATE,
} from "@/config/analytics-config";
import type { VisitorCountResponse, VisitorCountStatus } from "@/types/analytics-telemetry-types";

/**
 * Return contract for the `useVisitorFlexCounter` hook.
 */
export interface UseVisitorFlexCounterReturn {
  /** Numeric total of visitors recorded since epoch. */
  readonly visitorCount: number;
  /** Human-readable badge text (e.g., "Visited 1,420 times since 01 Nov 2026"). */
  readonly formattedBadge: string;
  /** Telemetry status (fresh from GA4, cached locally, or fallback). */
  readonly status: VisitorCountStatus;
  /** Whether the network fetch is currently in flight. */
  readonly isLoading: boolean;
  /** Any error encountered during fetch. */
  readonly error: Error | null;
  /** ISO timestamp of when the count was cached. */
  readonly cachedAt: string | null;
  /** Triggers an immediate network re-fetch bypassing client cache. */
  readonly refresh: () => Promise<void>;
}

// Module-level client cache shared across component instances
let clientSharedData: VisitorCountResponse | null = null;
let clientLastFetchTime = 0;

/**
 * React hook delivering real-time or cached GA4 visitor counter telemetry.
 *
 * @returns {UseVisitorFlexCounterReturn} Visitor count state and manual refresh method.
 *
 * @example
 * function VisitorPill() {
 *   const { formattedBadge, isLoading } = useVisitorFlexCounter();
 *   return <span>{isLoading ? "Loading..." : formattedBadge}</span>;
 * }
 */
export function useVisitorFlexCounter(): UseVisitorFlexCounterReturn {
  const [data, setData] = useState<VisitorCountResponse>(() => {
    if (clientSharedData) return clientSharedData;
    return {
      totalVisitors: DEFAULT_FALLBACK_VISITOR_COUNT,
      startDate: HARDCODED_START_DATE,
      cachedAt: new Date().toISOString(),
      ttlSeconds: ANALYTICS_CACHE_TTL_SECONDS,
      formattedBadge: formatVisitorBadge(DEFAULT_FALLBACK_VISITOR_COUNT, HARDCODED_START_DATE),
      status: "fallback",
    };
  });

  const [isLoading, setIsLoading] = useState<boolean>(!clientSharedData);
  const [error, setError] = useState<Error | null>(null);
  const isMountedRef = useRef<boolean>(true);

  /**
   * Fetches the latest visitor count from the internal Next.js API.
   *
   * @param {boolean} force Whether to ignore the client-side time-to-live cache.
   */
  const fetchVisitorCount = useCallback(async (force = false): Promise<void> => {
    const now = Date.now();
    const cacheValid =
      clientSharedData && !force && now - clientLastFetchTime < ANALYTICS_CACHE_TTL_SECONDS * 1000;

    if (cacheValid && clientSharedData) {
      if (isMountedRef.current) {
        setData(clientSharedData);
        setIsLoading(false);
      }
      return;
    }

    if (isMountedRef.current) {
      setIsLoading(true);
      setError(null);
    }

    try {
      const hasRecordedHit =
        typeof window !== "undefined" && window.sessionStorage?.getItem("ibds_visitor_counted");
      const url = !hasRecordedHit ? "/api/analytics/visitors?hit=1" : "/api/analytics/visitors";
      if (!hasRecordedHit && typeof window !== "undefined" && window.sessionStorage) {
        try {
          window.sessionStorage.setItem("ibds_visitor_counted", "1");
        } catch {
          // Ignore storage quota error
        }
      }

      const response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: force ? "no-store" : "default",
      });

      if (!response.ok) {
        throw new Error(`API returned HTTP ${response.status}: ${response.statusText}`);
      }

      const json = (await response.json()) as VisitorCountResponse;
      clientSharedData = json;
      clientLastFetchTime = Date.now();

      if (isMountedRef.current) {
        setData(json);
        setError(null);
      }
    } catch (err) {
      const parsedError = err instanceof Error ? err : new Error(String(err));
      if (isMountedRef.current) {
        setError(parsedError);
        // Fallback to offline standard counter
        setData((prev) => ({
          ...prev,
          status: "fallback",
        }));
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    void fetchVisitorCount(false);

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchVisitorCount]);

  const refresh = useCallback(async (): Promise<void> => {
    await fetchVisitorCount(true);
  }, [fetchVisitorCount]);

  return {
    visitorCount: data.totalVisitors,
    formattedBadge: data.formattedBadge,
    status: data.status,
    isLoading,
    error,
    cachedAt: data.cachedAt,
    refresh,
  };
}
