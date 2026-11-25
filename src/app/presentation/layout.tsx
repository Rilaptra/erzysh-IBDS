import "katex/dist/katex.min.css";
import type { Metadata } from "next";
import type { ReactElement, ReactNode } from "react";

import { APP_VERSION, WASM_VERSION } from "@/config/version";

export const metadata: Metadata = {
  title: `Presentasi Interaktif IBDS v${APP_VERSION} — Interactive 3D Beam Simulator`,
  description: `Dek presentasi rekayasa interaktif IBDS v${APP_VERSION} (Rust WASM v${WASM_VERSION}): arsitektur, sumber perhitungan SNI 1729:2020 & SNI 2847:2019, bukti validasi SAP2000 & Excel Manual, tutorial 9 misi, dan pratinjau GitHub.`,
  openGraph: {
    title: `Presentasi Interaktif IBDS v${APP_VERSION}`,
    description:
      "Interactive 3D Beam Deflection & Structural Design Simulator — Rust WASM + Next.js 16 + Bun 1.4.4.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `Presentasi Interaktif IBDS v${APP_VERSION}`,
    description:
      "Arsitektur, validasi SAP2000 & Excel Manual, tutorial 9 misi, dan kualitas sistem IBDS.",
  },
};

export default function PresentationLayout({
  children,
}: {
  readonly children: ReactNode;
}): ReactElement {
  return <>{children}</>;
}
