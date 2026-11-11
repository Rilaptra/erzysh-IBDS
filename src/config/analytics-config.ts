/**
 * @file analytics-config.ts
 * @description Configuration constants and formatting utilities for Google Analytics 4
 * custom epoch visitor flex badge tracking.
 */

import type { Ga4ServiceAccountCredentials } from "@/types/analytics-telemetry-types";
import { AnalyticsTelemetryError } from "@/types/analytics-telemetry-types";

/**
 * Hardcoded project launch epoch date.
 * The visitor badge counts cumulative pageviews/sessions since this date.
 * Can be safely modified in this single location.
 */
export const HARDCODED_START_DATE = "2026-11-01T00:00:00.000Z";

/**
 * Cache Time-To-Live (TTL) in seconds for the GA4 Data API response.
 * 15 minutes = 900 seconds to respect Google API quota limits.
 */
export const ANALYTICS_CACHE_TTL_SECONDS = 900;

/**
 * Baseline fallback visitor count used when GA4 credentials are not configured in local development.
 */
export const DEFAULT_FALLBACK_VISITOR_COUNT = 0;

/**
 * Formats the visitor counter badge string.
 * @param count Numeric total of visitors.
 * @param startDateIso ISO 8601 formatted start date string.
 * @returns Human-readable badge string, e.g. "Visited 1,420 times since 01 Nov 2026".
 * @example
 * formatVisitorBadge(1420, "2026-11-01T00:00:00.000Z");
 * // returns "Visited 1,420 times since 01 Nov 2026"
 */
export function formatVisitorBadge(
  count: number,
  startDateIso: string = HARDCODED_START_DATE,
): string {
  if (!Number.isFinite(count) || count < 0) {
    throw new AnalyticsTelemetryError("formatVisitorBadge", `Invalid visitor count: ${count}`);
  }

  const dateObj = new Date(startDateIso);
  if (Number.isNaN(dateObj.getTime())) {
    throw new AnalyticsTelemetryError(
      "formatVisitorBadge",
      `Invalid start date string: ${startDateIso}`,
    );
  }

  const formattedCount = new Intl.NumberFormat("en-US").format(Math.floor(count));
  const day = String(dateObj.getUTCDate()).padStart(2, "0");
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = monthNames[dateObj.getUTCMonth()];
  const year = dateObj.getUTCFullYear();

  return `Visited ${formattedCount} times since ${day} ${month} ${year}`;
}

/**
 * Validates and extracts GA4 service account credentials from the environment.
 * @param env Optional environment map override. Defaults to Bun.env.
 * @returns Validated Ga4ServiceAccountCredentials.
 * @throws {AnalyticsTelemetryError} If any mandatory credential key is absent or malformed.
 */
export function getValidatedGa4Credentials(
  env: Record<string, string | undefined> = Bun.env,
): Ga4ServiceAccountCredentials {
  const clientEmail = env.GA4_SERVICE_ACCOUNT_EMAIL?.trim();
  const rawKey = env.GA4_PRIVATE_KEY?.trim();
  const propertyId = env.GA4_PROPERTY_ID?.trim();

  if (!clientEmail) {
    throw new AnalyticsTelemetryError(
      "getValidatedGa4Credentials",
      "Missing GA4_SERVICE_ACCOUNT_EMAIL in environment.",
    );
  }

  if (!rawKey) {
    throw new AnalyticsTelemetryError(
      "getValidatedGa4Credentials",
      "Missing GA4_PRIVATE_KEY in environment.",
    );
  }

  if (!propertyId) {
    throw new AnalyticsTelemetryError(
      "getValidatedGa4Credentials",
      "Missing GA4_PROPERTY_ID in environment.",
    );
  }

  // Normalize escaped newlines in PEM string
  const privateKey = rawKey.replace(/\\n/g, "\n");

  if (!privateKey.includes("-----BEGIN PRIVATE KEY-----")) {
    throw new AnalyticsTelemetryError(
      "getValidatedGa4Credentials",
      "GA4_PRIVATE_KEY must be a valid RSA PEM private key containing '-----BEGIN PRIVATE KEY-----'.",
    );
  }

  return { clientEmail, privateKey, propertyId };
}
