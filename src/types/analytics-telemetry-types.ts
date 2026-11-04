/**
 * @file analytics-telemetry-types.ts
 * @description Types for Google Analytics 4 (GA4) custom epoch visitor counters,
 * hardware capability telemetry, and in-app event tracking.
 */

// ============================================================================
// Visitor Counter & GA4 Payload Types
// ============================================================================

/**
 * Cache freshness status of the visitor count response.
 */
export type VisitorCountStatus = "fresh" | "cached" | "fallback";

/**
 * Structured API response returned by `/api/analytics/visitors`.
 */
export interface VisitorCountResponse {
  /** Aggregated total number of visitor sessions since HARDCODED_START_DATE. */
  readonly totalVisitors: number;
  /** ISO 8601 start date of the analytics counting epoch. */
  readonly startDate: string;
  /** ISO 8601 timestamp when this count was fetched or retrieved from cache. */
  readonly cachedAt: string;
  /** Cache time-to-live in seconds. */
  readonly ttlSeconds: number;
  /** Pre-formatted badge string for UI presentation. */
  readonly formattedBadge: string;
  /** Cache freshness status. */
  readonly status: VisitorCountStatus;
}

/**
 * Service Account credentials required to fetch analytics from the Google Analytics Data API.
 */
export interface Ga4ServiceAccountCredentials {
  /** Google Cloud Service Account client email. */
  readonly clientEmail: string;
  /** RSA private key in PEM format. */
  readonly privateKey: string;
  /** Numeric GA4 property ID. */
  readonly propertyId: string;
}

/**
 * GA4 Data API runReport query specification.
 */
export interface Ga4ReportQuery {
  readonly propertyId: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly metrics: readonly string[];
}

// ============================================================================
// Client Telemetry & Device Metrics
// ============================================================================

/**
 * Client-side user action telemetry payload.
 */
export interface TelemetryEventPayload {
  /** GA4 event name (e.g. beam_mode_changed, export_dxf, optimization_run). */
  readonly eventName: string;
  /** Custom key-value event parameters. */
  readonly params: Record<string, string | number | boolean>;
}

/**
 * Hardware capability telemetry collected to adapt rendering performance.
 */
export interface PlatformHardwareTelemetry {
  /** Active platform mode. */
  readonly platformMode: "DESKTOP_WORKSTATION" | "ANDROID_COMPANION";
  /** Screen physical width in pixels. */
  readonly screenWidth: number;
  /** Screen physical height in pixels. */
  readonly screenHeight: number;
  /** Display device pixel ratio. */
  readonly devicePixelRatio: number;
  /** Logical processor count if reported by browser. */
  readonly logicalProcessors?: number;
  /** Device RAM in GB if reported by browser. */
  readonly memoryGb?: number;
  /** WebGL 2 hardware acceleration availability. */
  readonly hasWebGL2: boolean;
  /** WebGPU API availability. */
  readonly hasWebGPU: boolean;
}

// ============================================================================
// Custom Error Hierarchy
// ============================================================================

/**
 * Custom error thrown when analytics token signing or report fetching fails.
 */
export class AnalyticsTelemetryError extends Error {
  public readonly context: string;

  constructor(context: string, message: string) {
    super(`[AnalyticsTelemetryError] Context '${context}': ${message}`);
    this.name = "AnalyticsTelemetryError";
    this.context = context;
  }
}
