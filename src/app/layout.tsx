import type { Metadata, Viewport } from "next";

import { GoogleAnalyticsScriptLoader } from "@/components/telemetry/GoogleAnalyticsScriptLoader";
import "./globals.css";
import { Geist } from "next/font/google";

import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "IBDS — Interactive Beam Deflection & Structural Design Simulator",
  description:
    "Interactive 3D Beam Deflection & Structural Design Simulator following SNI 2847:2019 & SNI 1729:2020.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "IBDS",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={cn("font-sans", geist.variable)}>
      <body>
        <GoogleAnalyticsScriptLoader />
        {children}
      </body>
    </html>
  );
}
