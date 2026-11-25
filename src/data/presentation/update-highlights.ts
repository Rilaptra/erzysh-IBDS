import type { UpdateHighlightMeta } from "@/types/presentation-types";

export const UPDATE_HIGHLIGHT_MAP: Readonly<Record<string, UpdateHighlightMeta>> = {
  "0.6.21": {
    badge: "3D Loads & Collision",
    accentClass: "border-cyan-400/40 bg-cyan-500/15 text-cyan-200",
    highlightNote: "Proyeksi vektor beban 3D akurat perspektif + smart badge stacking.",
  },
  "0.6.20": {
    badge: "Next.js 16.4.5",
    accentClass: "border-sky-400/40 bg-sky-500/15 text-sky-200",
    highlightNote: "Upgrade framework Next.js 16.4.5 & sinkronisasi release tooling.",
  },
  "0.6.19": {
    badge: "2D Loads & .s2k",
    accentClass: "border-cyan-400/35 bg-cyan-500/10 text-cyan-200",
  },
  "0.6.18": {
    badge: "Engineer Quest",
    accentClass: "border-violet-400/40 bg-violet-500/15 text-violet-200",
    highlightNote: "Peluncuran 9 misi tur interaktif onboarding bersama AI Ucuy.",
  },
  "0.6.17": {
    badge: "Changelog Explorer",
    accentClass: "border-emerald-400/40 bg-emerald-500/15 text-emerald-200",
  },
  "0.6.16": {
    badge: "Manual 24-Slide & MIT",
    accentClass: "border-amber-400/40 bg-amber-500/15 text-amber-200",
  },
  "0.6.14": {
    badge: "GSAP & Beam Morph",
    accentClass: "border-violet-400/35 bg-violet-500/10 text-violet-200",
  },
  "0.6.11": {
    badge: "Custom BOX r=0",
    accentClass: "border-sky-400/35 bg-sky-500/10 text-sky-200",
  },
  "0.6.8": {
    badge: "Gemini Key Failover",
    accentClass: "border-amber-400/40 bg-amber-500/15 text-amber-200",
    highlightNote: "Rotasi multi-key API otomatis & fallback deterministik offline.",
  },
  "0.6.5": {
    badge: "Persona AI Ucuy",
    accentClass: "border-amber-400/35 bg-amber-500/10 text-amber-200",
  },
  "0.6.0": {
    badge: "Tailwind v4 + shadcn",
    accentClass: "border-cyan-400/35 bg-cyan-500/10 text-cyan-200",
  },
  "0.5.0": {
    badge: "CI Quality Gate",
    accentClass: "border-emerald-400/40 bg-emerald-500/15 text-emerald-200",
  },
  "0.4.0": {
    badge: "Core Foundation",
    accentClass: "border-sky-400/35 bg-sky-500/10 text-sky-200",
  },
};

export function getUpdateHighlight(version: string): UpdateHighlightMeta | undefined {
  return UPDATE_HIGHLIGHT_MAP[version];
}
