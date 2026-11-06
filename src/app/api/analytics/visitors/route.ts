/**
 * @file route.ts
 * @description Native Bun zero-dependency Google Analytics 4 (GA4) Custom Epoch Visitor Counter API.
 * Uses Web Crypto `crypto.subtle` for RS256 JWT assertion signing against Google OAuth2 endpoints,
 * queries the Google Analytics Data API v1beta (`runReport`), and maintains in-memory caching
 * with `Bun.hash` keys and 900s TTL.
 */

import {
  ANALYTICS_CACHE_TTL_SECONDS,
  DEFAULT_FALLBACK_VISITOR_COUNT,
  formatVisitorBadge,
  getValidatedGa4Credentials,
  HARDCODED_START_DATE,
} from "@/config/analytics-config";
import {
  AnalyticsTelemetryError,
  type Ga4ServiceAccountCredentials,
  type VisitorCountResponse,
} from "@/types/analytics-telemetry-types";

// ============================================================================
// In-Memory Cache Store with Bun.hash
// ============================================================================

interface InMemVisitorCache {
  readonly response: VisitorCountResponse;
  readonly expiresAt: number;
}

/** In-memory cache map holding hashed keys and active TTLs */
const cacheStore = new Map<string, InMemVisitorCache>();

// ============================================================================
// Web Crypto RS256 Service Account JWT Signer (Zero External Dependencies)
// ============================================================================

/**
 * Encodes binary or UTF-8 string data into RFC 7515 Base64URL string without padding.
 *
 * @param {Uint8Array | string} input Raw input data.
 * @returns {string} URL-safe base64 string.
 */
export function base64UrlEncode(input: Uint8Array | string): string {
  let base64: string;
  if (typeof input === "string") {
    base64 = btoa(input);
  } else {
    let binary = "";
    const len = input.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(input[i]!);
    }
    base64 = btoa(binary);
  }
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Parses an RSA PEM private key string into a binary DER ArrayBuffer for Web Crypto import.
 *
 * @param {string} pem Standard PKCS#8 PEM string containing "-----BEGIN PRIVATE KEY-----".
 * @returns {Uint8Array} Binary DER representation of the private key.
 * @throws {AnalyticsTelemetryError} If the PEM string cannot be decoded.
 */
export function pemToDer(pem: string): Uint8Array {
  try {
    const cleanPem = pem
      .replace(/-----BEGIN [A-Z ]+-----/g, "")
      .replace(/-----END [A-Z ]+-----/g, "")
      .replace(/[\r\n\s]/g, "");

    const binaryString = atob(cleanPem);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (error) {
    throw new AnalyticsTelemetryError(
      "pemToDer",
      `Failed to parse RSA private key PEM: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Imports an RSA PKCS#8 private key into Web Crypto `CryptoKey`.
 *
 * @param {string} pem RSA PEM private key.
 * @returns {Promise<CryptoKey>} Web Crypto key configured for RSASSA-PKCS1-v1_5 signing with SHA-256.
 * @throws {AnalyticsTelemetryError} If Web Crypto key import fails.
 */
export async function importRsaPrivateKey(pem: string): Promise<CryptoKey> {
  try {
    const der = pemToDer(pem);
    return await crypto.subtle.importKey(
      "pkcs8",
      der.buffer as ArrayBuffer,
      {
        name: "RSASSA-PKCS1-v1_5",
        hash: { name: "SHA-256" },
      },
      false,
      ["sign"],
    );
  } catch (error) {
    throw new AnalyticsTelemetryError(
      "importRsaPrivateKey",
      `Web Crypto key import failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Signs a Google OAuth2 JWT Bearer assertion using native `crypto.subtle`.
 *
 * @param {Ga4ServiceAccountCredentials} creds Validated Google Cloud Service Account credentials.
 * @returns {Promise<string>} Signed RS256 JWT string.
 * @throws {AnalyticsTelemetryError} If signature computation fails.
 */
export async function createSignedServiceAccountJwt(
  creds: Ga4ServiceAccountCredentials,
): Promise<string> {
  try {
    const privateKey = await importRsaPrivateKey(creds.privateKey);

    const header = JSON.stringify({ alg: "RS256", typ: "JWT" });
    const nowSec = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({
      iss: creds.clientEmail,
      scope: "https://www.googleapis.com/auth/analytics.readonly",
      aud: "https://oauth2.googleapis.com/token",
      exp: nowSec + 3600,
      iat: nowSec,
    });

    const headerB64 = base64UrlEncode(header);
    const payloadB64 = base64UrlEncode(payload);
    const unsignedToken = `${headerB64}.${payloadB64}`;

    const signatureBuffer = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      privateKey,
      new TextEncoder().encode(unsignedToken),
    );

    const signatureB64 = base64UrlEncode(new Uint8Array(signatureBuffer));
    return `${unsignedToken}.${signatureB64}`;
  } catch (error) {
    throw new AnalyticsTelemetryError(
      "createSignedServiceAccountJwt",
      `JWT signing failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Exchanges a signed service account JWT for a Google OAuth2 bearer access token.
 *
 * @param {string} assertion Signed RS256 JWT.
 * @returns {Promise<string>} OAuth2 Bearer Access Token.
 * @throws {AnalyticsTelemetryError} If the Google OAuth2 token endpoint returns an error.
 */
export async function exchangeJwtForAccessToken(assertion: string): Promise<string> {
  const tokenUrl = "https://oauth2.googleapis.com/token";
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new AnalyticsTelemetryError(
      "exchangeJwtForAccessToken",
      `OAuth2 endpoint responded with ${response.status}: ${errorBody}`,
    );
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new AnalyticsTelemetryError(
      "exchangeJwtForAccessToken",
      "OAuth2 response omitted 'access_token'.",
    );
  }

  return data.access_token;
}

/**
 * Queries Google Analytics Data API v1beta runReport endpoint for cumulative visitor sessions.
 *
 * @param {string} propertyId Numeric GA4 property ID.
 * @param {string} accessToken Bearer access token.
 * @param {string} startDateIso ISO 8601 epoch date string.
 * @returns {Promise<number>} Aggregate visitor count since start date.
 * @throws {AnalyticsTelemetryError} If GA4 Data API query fails.
 */
export async function fetchGa4VisitorCount(
  propertyId: string,
  accessToken: string,
  startDateIso: string,
): Promise<number> {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;
  const startDate = startDateIso.slice(0, 10); // Format YYYY-MM-DD

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      dateRanges: [{ startDate, endDate: "today" }],
      metrics: [{ name: "sessions" }, { name: "activeUsers" }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new AnalyticsTelemetryError(
      "fetchGa4VisitorCount",
      `GA4 Data API error ${response.status}: ${errorBody}`,
    );
  }

  const report = (await response.json()) as {
    rows?: Array<{
      metricValues?: Array<{ value?: string }>;
    }>;
  };

  const sessionsStr = report.rows?.[0]?.metricValues?.[0]?.value ?? "0";
  const parsedSessions = parseInt(sessionsStr, 10);
  return Number.isNaN(parsedSessions) ? 0 : parsedSessions;
}

// ============================================================================
// Next.js Route Handler (GET /api/analytics/visitors)
// ============================================================================

/**
 * Next.js GET endpoint delivering cumulative GA4 visitor telemetry with in-memory caching.
 * Falls back gracefully to default badge counter if credentials are not configured.
 *
 * @returns {Promise<Response>} JSON response implementing `VisitorCountResponse`.
 */
export async function GET(): Promise<Response> {
  const now = Date.now();
  const defaultFallback: VisitorCountResponse = {
    totalVisitors: DEFAULT_FALLBACK_VISITOR_COUNT,
    startDate: HARDCODED_START_DATE,
    cachedAt: new Date(now).toISOString(),
    ttlSeconds: ANALYTICS_CACHE_TTL_SECONDS,
    formattedBadge: formatVisitorBadge(DEFAULT_FALLBACK_VISITOR_COUNT, HARDCODED_START_DATE),
    status: "fallback",
  };

  let creds: Ga4ServiceAccountCredentials;
  try {
    creds = getValidatedGa4Credentials();
  } catch {
    // Service Account credentials not configured (standard in local dev / test environments).
    // Return graceful fallback without throwing HTTP 500.
    return Response.json(defaultFallback, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
        "Content-Type": "application/json",
      },
    });
  }

  // Derive in-memory cache key using native Bun.hash
  const cacheKey = Bun.hash(creds.propertyId).toString(16);
  const cached = cacheStore.get(cacheKey);

  if (cached && now < cached.expiresAt) {
    const cachedResponse: VisitorCountResponse = {
      ...cached.response,
      status: "cached",
    };
    return Response.json(cachedResponse, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
        "Content-Type": "application/json",
        "X-Cache-Status": "HIT",
      },
    });
  }

  try {
    const assertionJwt = await createSignedServiceAccountJwt(creds);
    const accessToken = await exchangeJwtForAccessToken(assertionJwt);
    const apiCount = await fetchGa4VisitorCount(
      creds.propertyId,
      accessToken,
      HARDCODED_START_DATE,
    );

    // Sum api count with base epoch count if required, or take max
    const totalVisitors = Math.max(apiCount, DEFAULT_FALLBACK_VISITOR_COUNT);

    const freshResponse: VisitorCountResponse = {
      totalVisitors,
      startDate: HARDCODED_START_DATE,
      cachedAt: new Date(now).toISOString(),
      ttlSeconds: ANALYTICS_CACHE_TTL_SECONDS,
      formattedBadge: formatVisitorBadge(totalVisitors, HARDCODED_START_DATE),
      status: "fresh",
    };

    cacheStore.set(cacheKey, {
      response: freshResponse,
      expiresAt: now + ANALYTICS_CACHE_TTL_SECONDS * 1000,
    });

    return Response.json(freshResponse, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
        "Content-Type": "application/json",
        "X-Cache-Status": "MISS",
      },
    });
  } catch {
    // If Google API is unreachable, quota exceeded, or network dropped, gracefully return fallback
    return Response.json(defaultFallback, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
        "Content-Type": "application/json",
      },
    });
  }
}
