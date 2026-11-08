/**
 * @file GoogleAnalyticsScriptLoader.tsx
 * @description Production Next.js SSR-safe script loader for Google Analytics 4 (GA4).
 * Injects Google Tag Manager (`gtag.js`) asynchronously after page hydration.
 * Ensures scripts are omitted when running in offline environments or with dummy measurement IDs.
 */

"use client";

import Script from "next/script";
import React, { type ReactElement } from "react";

/**
 * Validates whether a provided string qualifies as an active Google Analytics 4 Measurement ID.
 *
 * @param {string | undefined} id Raw environment measurement identifier string.
 * @returns {boolean} True if the ID follows the official `G-[A-Z0-9]+` pattern and is non-placeholder.
 */
export function isValidGa4MeasurementId(id: string | undefined): boolean {
  if (!id) return false;
  const trimmed = id.trim();
  if (trimmed === "G-XXXXXXXXXX" || trimmed === "G-YOUR_MEASUREMENT_ID" || trimmed === "") {
    return false;
  }
  return /^G-[A-Z0-9]+$/i.test(trimmed);
}

/**
 * Client component that injects Google Analytics 4 tracking tags if a valid measurement ID is present.
 *
 * @returns {ReactElement | null} `<Script>` elements or null if unconfigured.
 *
 * @example
 * // In Root Layout:
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <GoogleAnalyticsScriptLoader />
 *         {children}
 *       </body>
 *     </html>
 *   );
 * }
 */
export function GoogleAnalyticsScriptLoader(): ReactElement | null {
  const measurementId = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID?.trim();

  if (!isValidGa4MeasurementId(measurementId)) {
    return null;
  }

  return (
    <>
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
      />
      <Script
        id="google-analytics-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${measurementId}', {
              page_path: window.location.pathname,
              anonymize_ip: true,
              send_page_view: true
            });
          `,
        }}
      />
    </>
  );
}
