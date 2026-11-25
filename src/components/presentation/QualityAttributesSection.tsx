"use client";

import {
  CpuIcon,
  LayersIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  WrenchIcon,
} from "lucide-react";
import type { ComponentType, ReactElement } from "react";
import { useMemo, useState } from "react";

import { glassPanelClass } from "@/components/landing/ErzyshPageShell";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { QualityAttributeItem, QualityAttributeKey } from "@/types/presentation-types";

export interface QualityAttributesSectionProps {
  readonly id?: string;
  readonly items?: readonly QualityAttributeItem[];
  readonly className?: string;
}

const DEFAULT_QUALITY_ATTRIBUTES: readonly QualityAttributeItem[] = [
  {
    key: "simplicity",
    title: "Simplicity",
    tagline: "Sederhana dipakai pengguna, sederhana dipelihara developer",
    summary:
      "Kesederhanaan adalah pilar inti IBDS: zero instalasi bagi pengguna akhir lewat PWA + suara 'Ucuy' + Quest 9 misi, sekaligus arsitektur ramping bagi developer dengan hanya 11 production dependencies.",
    maturityScore: 98,
    isHighlighted: true,
    evidencePoints: [
      {
        label: "Simplicity bagi Pengguna",
        detail:
          "Langsung berjalan di browser/PWA tanpa setup, kontrol suara alami bahasa Indonesia ('Ucuy'), tur gamifikasi 9 misi, & ekspor 1-klik.",
        fileRef: "src/config/tutorial-steps-config.ts",
      },
      {
        label: "Simplicity bagi Developer",
        detail:
          "Hanya 11 production dependencies di package.json (tanpa Three.js, Redux, Zustand, atau SDK Google berat) & perintah CLI satu baris.",
        fileRef: "package.json",
      },
      {
        label: "Single-File UI System",
        detail:
          "Seluruh 22 primitif antarmuka terpusat dan konsisten tanpa kompleksitas database eksternal.",
        fileRef: "src/components/ui/core.tsx",
      },
    ],
  },
  {
    key: "sustainability",
    title: "Sustainability",
    tagline: "Hemat energi, ramah perangkat keras, & biaya server minimal",
    summary:
      "100% komputasi mekanika dan render 3D berjalan lokal di browser menggunakan biner Rust WASM 104.6 KB dan WebGL2 murni tanpa server komputasi mahal.",
    maturityScore: 95,
    evidencePoints: [
      {
        label: "Zero-Server Compute + Zero GC Churn",
        detail:
          "SolverWorkspace pra-alokasi 65.536 float di memori linear WASM (104.6 KB) menghilangkan jeda Garbage Collector.",
        fileRef: "src/wasm/mechanics_3d_wasm_bg.wasm",
      },
      {
        label: "Thermal & Battery Care",
        detail:
          "MediaPipe Eco-Mode 15–16 FPS (<45°C), mode Android Companion menonaktifkan 3D/kamera, dan mematuhi prefers-reduced-motion.",
        fileRef: "src/components/adaptive/AndroidCompanionView.tsx",
      },
      {
        label: "Zero SDK Bloat",
        detail: "Penandatanganan JWT GA4 memakai Web Crypto native (crypto.subtle).",
        fileRef: "src/app/api/analytics/visitors/route.ts",
      },
    ],
  },
  {
    key: "scalability",
    title: "Scalability",
    tagline: "Beban komputasi server O(1) & pencarian profil O(log N)",
    summary:
      "Tambahan ribuan pengguna serentak tidak menaikkan CPU server solver, sementara optimasi katalog baja berjalan dalam waktu logaritmik.",
    maturityScore: 93,
    evidencePoints: [
      {
        label: "Compile-Time Bun Macro O(log N)",
        detail:
          "Pra-komputasi properti 90 IWF + 23 BOX dan pengurutan Zx saat build-time untuk binary search milidetik.",
        fileRef: "src/macros/precompute-steel-catalog.macro.ts",
      },
      {
        label: "Guard Kombinatorial Custom BOX",
        detail: "Generator Custom Parametric BOX dibatasi ketat pada 2.500 kombinasi aman.",
        fileRef: "src/core/steel/steel-section-optimizer.ts",
      },
      {
        label: "Multi-Key API Failover & CDN Cache",
        detail:
          "Rotasi multi-kunci Gemini (backoff 60–900s) + cache Bun.hash & s-maxage=900 mencegah bottleneck API.",
        fileRef: "src/lib/gemini-api-failover.ts",
      },
    ],
  },
  {
    key: "modularity",
    title: "Modularity",
    tagline: "Arsitektur 7 lapis murni & terisolasi per domain",
    summary:
      "Setiap domain rekayasa (mekanika Rust, baja SNI 1729, beton SNI 2847, 5 exporter CAD/BIM) berdiri sebagai modul murni independen.",
    maturityScore: 96,
    evidencePoints: [
      {
        label: "Rust Crate Modular (6 Modul)",
        detail:
          "Pemisahan tegas supports.rs, diagrams.rs, deflection.rs, extrude_3d.rs, dan rebar_cage_3d.rs.",
        fileRef: "crates/mechanics-3d-wasm/src/lib.rs",
      },
      {
        label: "Pluggable Core & Exporters",
        detail:
          "Fungsi murni pada src/core/{mechanics,steel,concrete,exporters,audio}/ mudah diperluas tanpa efek samping UI.",
        fileRef: "src/core/exporters/dxf-autocad-exporter.ts",
      },
      {
        label: "3 Store Reaktif Terpisah",
        detail: "State simulator, floating windows, dan multimodal memakai useSyncExternalStore.",
        fileRef: "src/state/beam-simulator-store.ts",
      },
    ],
  },
  {
    key: "flexibility",
    title: "Flexibility",
    tagline: "Multi-paradigma struktur, lintas perangkat, & tahan offline",
    summary:
      "Menyesuaikan alur kerja pengguna dari Mode A/Mode B, 9 orientasi tumpuan, 3 orientasi sumbu XYZ, hingga fallback deterministik saat offline.",
    maturityScore: 94,
    evidencePoints: [
      {
        label: "Multi-Standar & Multi-Orientasi",
        detail:
          "Mendukung Baja SNI 1729 & Beton SNI 2847, sumbu Z-Up/Y-Up/CustomXYZ, 3 mode diagram, dan 9 format ekspor.",
        fileRef: "src/types/beam-loading-modes.ts",
      },
      {
        label: "Adaptive Platform Gate",
        detail: "Otomatis menyesuaikan kapabilitas Desktop Workstation vs Android Companion PWA.",
        fileRef: "src/config/platform-capabilities.ts",
      },
      {
        label: "Offline Deterministic Fallback",
        detail:
          "AI intent router, konsultan struktur, analitik, & GitHub preview tetap hidup tanpa internet.",
        fileRef: "src/lib/github/repo-snapshot.ts",
      },
    ],
  },
  {
    key: "maintainability",
    title: "Maintainability",
    tagline: "Type-safety satuan fisika & gerbang mutu CI 7-tahap",
    summary:
      "Perubahan fitur baru dilindungi oleh nominal Branded Units saat kompilasi, 364 unit tests, validator katalog, dan pipeline CI otomatis.",
    maturityScore: 95,
    evidencePoints: [
      {
        label: "Nominal Branded Units",
        detail:
          "Mencegah kesalahan campur satuan kNm vs Nmm atau MPa vs kN pada waktu kompilasi TypeScript strict.",
        fileRef: "src/types/branded-units.ts",
      },
      {
        label: "364 Unit Tests + 5 Rust Cargo Tests",
        detail:
          "Benchmark analitis Euler-Bernoulli, geometri fillet WF 100x100, SNI 1729, & SNI 2847.",
        fileRef: "tests/mechanics/euler-bernoulli-deflection.test.ts",
      },
      {
        label: "CI Quality Gate & Auto Release",
        detail:
          "bun fmt, bun check -b, data:validate, test paralel, Git hooks, & sync-version otomatis.",
        fileRef: "scripts/verify.ts",
      },
    ],
  },
];

const KEY_ICONS: Record<QualityAttributeKey, ComponentType<{ className?: string }>> = {
  simplicity: SparklesIcon,
  sustainability: CpuIcon,
  scalability: SlidersHorizontalIcon,
  modularity: LayersIcon,
  flexibility: ShieldCheckIcon,
  maintainability: WrenchIcon,
};

const RADAR_CENTER_X = 190;
const RADAR_CENTER_Y = 170;
const RADAR_MAX_RADIUS = 112;
const RADAR_RINGS = [25, 50, 75, 100] as const;

function polarPoint(
  index: number,
  total: number,
  radius: number,
): { readonly x: number; readonly y: number } {
  const angleRad = -Math.PI / 2 + (index * 2 * Math.PI) / total;
  return {
    x: RADAR_CENTER_X + Math.cos(angleRad) * radius,
    y: RADAR_CENTER_Y + Math.sin(angleRad) * radius,
  };
}

export function QualityAttributesSection({
  id = "bab-8-kualitas-sistem",
  items,
  className,
}: QualityAttributesSectionProps): ReactElement {
  const attributes = items && items.length > 0 ? items : DEFAULT_QUALITY_ATTRIBUTES;
  const [selectedKey, setSelectedKey] = useState<QualityAttributeKey>("simplicity");

  const radarVertices = useMemo(
    () =>
      attributes.map((item, idx) => {
        const radius = (Math.max(0, Math.min(100, item.maturityScore)) / 100) * RADAR_MAX_RADIUS;
        const point = polarPoint(idx, attributes.length, radius);
        const labelPoint = polarPoint(idx, attributes.length, RADAR_MAX_RADIUS + 26);
        const outerPoint = polarPoint(idx, attributes.length, RADAR_MAX_RADIUS);
        return { item, point, labelPoint, outerPoint };
      }),
    [attributes],
  );

  const dataPolygonPoints = radarVertices
    .map((v) => `${v.point.x.toFixed(1)},${v.point.y.toFixed(1)}`)
    .join(" ");

  const simplicityItem = attributes.find((item) => item.key === "simplicity" || item.isHighlighted);
  const otherItems = attributes.filter((item) => item.key !== simplicityItem?.key);

  return (
    <section id={id} className={cn("scroll-mt-20 space-y-6", className)}>
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="border-cyan-400/30 bg-cyan-500/10 font-mono text-[10px] text-cyan-300"
          >
            BAB 08
          </Badge>
          <Badge
            variant="outline"
            className="border-violet-400/30 bg-violet-500/10 text-[10px] text-violet-200"
          >
            ARSITEKTUR &amp; 6 ASPEK KUALITAS SISTEM
          </Badge>
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
          Analisis 6 Pilar Kualitas Rekayasa
        </h2>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-300/85">
          Evaluasi objektif terhadap{" "}
          <strong className="text-cyan-200">
            Sustainability, Scalability, Modularity, Flexibility, Simplicity, dan Maintainability
          </strong>{" "}
          yang seluruhnya didukung oleh bukti berkas nyata pada repositori.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div className={cn(glassPanelClass, "flex flex-col items-center justify-center p-4")}>
          <div className="mb-2 flex w-full items-center justify-between">
            <span className="font-mono text-[10px] font-bold tracking-wider text-cyan-300 uppercase">
              RADAR KEMATANGAN 6-SUMBU (SVG)
            </span>
            <span className="font-mono text-[10px] text-slate-400">Klik simpul untuk sorot</span>
          </div>

          <svg
            viewBox="0 0 380 340"
            role="img"
            aria-label="Grafik radar 6 aspek kualitas sistem IBDS: Simplicity, Sustainability, Scalability, Modularity, Flexibility, dan Maintainability"
            className="h-auto w-full max-w-[380px]"
          >
            <defs>
              <linearGradient id="qualityRadarFill" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.32" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.28" />
              </linearGradient>
              <linearGradient id="qualityRadarStroke" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#22d3ee" />
                <stop offset="50%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#a78bfa" />
              </linearGradient>
            </defs>

            {RADAR_RINGS.map((ring) => {
              const r = (ring / 100) * RADAR_MAX_RADIUS;
              const ringPoints = attributes
                .map((_, idx) => {
                  const pt = polarPoint(idx, attributes.length, r);
                  return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
                })
                .join(" ");
              return (
                <polygon
                  key={ring}
                  points={ringPoints}
                  fill="none"
                  stroke="rgba(148, 163, 184, 0.16)"
                  strokeWidth={ring === 100 ? "1.2" : "0.8"}
                  strokeDasharray={ring === 100 ? undefined : "3 3"}
                />
              );
            })}

            {radarVertices.map(({ item, outerPoint }) => (
              <line
                key={`axis-${item.key}`}
                x1={RADAR_CENTER_X}
                y1={RADAR_CENTER_Y}
                x2={outerPoint.x}
                y2={outerPoint.y}
                stroke={
                  item.key === selectedKey
                    ? "rgba(34, 211, 238, 0.65)"
                    : "rgba(148, 163, 184, 0.18)"
                }
                strokeWidth={item.key === selectedKey ? "1.5" : "1"}
              />
            ))}

            <polygon
              points={dataPolygonPoints}
              fill="url(#qualityRadarFill)"
              stroke="url(#qualityRadarStroke)"
              strokeWidth="2.2"
              strokeLinejoin="round"
            />

            {radarVertices.map(({ item, point, labelPoint }) => {
              const isSelected = item.key === selectedKey;
              const isHighlight = Boolean(item.isHighlighted);
              const textAnchor =
                labelPoint.x < RADAR_CENTER_X - 18
                  ? "end"
                  : labelPoint.x > RADAR_CENTER_X + 18
                    ? "start"
                    : "middle";

              return (
                <g
                  key={item.key}
                  onClick={() => setSelectedKey(item.key)}
                  className="cursor-pointer"
                >
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={isSelected ? 6 : 4.2}
                    fill={isHighlight ? "#22d3ee" : isSelected ? "#a78bfa" : "#38bdf8"}
                    stroke="#050a14"
                    strokeWidth="2"
                  />
                  <text
                    x={labelPoint.x}
                    y={labelPoint.y}
                    textAnchor={textAnchor}
                    dominantBaseline="middle"
                    className="fill-slate-200 text-[10.5px] font-semibold"
                  >
                    {item.title}
                    {isHighlight ? " ★" : ""}
                  </text>
                  <text
                    x={labelPoint.x}
                    y={labelPoint.y + 12}
                    textAnchor={textAnchor}
                    dominantBaseline="middle"
                    className="fill-cyan-300 font-mono text-[9.5px]"
                  >
                    {item.maturityScore}/100
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {simplicityItem ? (
          <article
            onClick={() => setSelectedKey(simplicityItem.key)}
            className={cn(
              glassPanelClass,
              "relative flex flex-col justify-between overflow-hidden border-cyan-400/45 bg-linear-to-br from-[#0b1b30]/95 via-[#0a1322]/90 to-[#161030]/90 p-5 shadow-cyan-500/15",
              selectedKey === simplicityItem.key ? "ring-1 ring-cyan-400/50" : "",
            )}
          >
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <SparklesIcon className="size-4 text-cyan-300" aria-hidden="true" />
                  <Badge className="bg-linear-to-r from-cyan-400 to-violet-400 text-[10px] font-bold text-slate-950">
                    SOROTAN UTAMA ★
                  </Badge>
                </div>
                <span className="font-mono text-xs font-bold text-cyan-300 tabular-nums">
                  {simplicityItem.maturityScore}/100
                </span>
              </div>

              <div>
                <h3 className="text-lg font-bold tracking-tight text-white">
                  {simplicityItem.title} — {simplicityItem.tagline}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                  {simplicityItem.summary}
                </p>
              </div>

              <ul className="space-y-2 pt-1">
                {simplicityItem.evidencePoints.map((ev) => (
                  <li
                    key={ev.label}
                    className="rounded-md border border-cyan-400/20 bg-[#060d19]/80 p-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <span className="text-xs font-semibold text-cyan-200">{ev.label}</span>
                      <code className="rounded bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[10px] text-cyan-300">
                        {ev.fileRef}
                      </code>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-300/90">
                      {ev.detail}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {otherItems.map((item) => {
          const Icon = KEY_ICONS[item.key];
          const isSelected = item.key === selectedKey;

          return (
            <article
              key={item.key}
              onClick={() => setSelectedKey(item.key)}
              className={cn(
                glassPanelClass,
                "cursor-pointer p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-400/45",
                isSelected ? "border-cyan-400/55 ring-1 ring-cyan-400/35" : "border-cyan-500/15",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Icon className="size-4 text-cyan-400" aria-hidden="true" />
                  <h3 className="text-sm font-bold text-slate-100">{item.title}</h3>
                </div>
                <span className="font-mono text-[11px] font-semibold text-cyan-300 tabular-nums">
                  {item.maturityScore}%
                </span>
              </div>

              <p className="mt-1 text-[11px] font-medium text-sky-300/90">{item.tagline}</p>

              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800/90">
                <div
                  className="h-full rounded-full bg-linear-to-r from-cyan-400 via-sky-400 to-violet-400"
                  style={{ width: `${item.maturityScore}%` }}
                />
              </div>

              <p className="mt-2.5 text-xs leading-relaxed text-slate-300/85">{item.summary}</p>

              <ul className="mt-3 space-y-1.5 border-t border-cyan-500/10 pt-2.5">
                {item.evidencePoints.map((ev) => (
                  <li key={ev.label} className="text-[11px] leading-snug text-slate-400">
                    <span className="font-semibold text-slate-200">{ev.label}: </span>
                    <span>{ev.detail} </span>
                    <code className="font-mono text-[10px] text-cyan-300/90">{ev.fileRef}</code>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default QualityAttributesSection;
