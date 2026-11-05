import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IBDS — Interactive Beam Deflection & Structural Design Simulator",
  description:
    "Interactive 3D Beam Deflection & Structural Design Simulator following SNI 2847:2019 & SNI 1729:2020.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
