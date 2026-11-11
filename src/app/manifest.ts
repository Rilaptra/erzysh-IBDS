/**
 * @file manifest.ts
 * @description Progressive Web App (PWA) Web App Manifest generator for IBDS.
 * Conforms to W3C Web App Manifest specification and Next.js App Router metadata conventions.
 * Enables installability across Desktop Workstations and Android Mobile Companions.
 */

import type { MetadataRoute } from "next";

/**
 * Generates the official PWA Web App Manifest configuration.
 *
 * @returns {MetadataRoute.Manifest} Validated Web App Manifest specification object.
 *
 * @example
 * // Next.js App Router automatically evaluates this handler at /manifest.webmanifest
 * export default function manifest() { ... }
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "IBDS - Interactive Beam Simulator",
    short_name: "IBDS",
    description:
      "Interactive 3D Beam Deflection & Structural Design Simulator following SNI 2847:2019 & SNI 1729:2020.",
    start_url: "/simulator",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0A0A0A",
    theme_color: "#0A0A0A",
    lang: "id",
    categories: ["education", "engineering", "productivity", "utilities"],
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
    shortcuts: [
      {
        name: "Mode Beban Eksternal",
        short_name: "Mode A",
        description: "Simulasi balok interaktif dengan pembebanan eksternal",
        url: "/simulator?mode=MODE_A_EXTERNAL_LOADS",
        icons: [{ src: "/icons/icon.svg", sizes: "any" }],
      },
      {
        name: "Mode Gaya Dalam SNI",
        short_name: "Mode B",
        description: "Optimasi penampang beton bertulang dan profil baja SNI",
        url: "/simulator?mode=MODE_B_DIRECT_INTERNAL_FORCES",
        icons: [{ src: "/icons/icon.svg", sizes: "any" }],
      },
    ],
  };
}
