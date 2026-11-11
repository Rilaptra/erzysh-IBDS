import {
  ArrowRightIcon,
  BoxIcon,
  Building2Icon,
  FileTextIcon,
  HandIcon,
  MicIcon,
  RulerIcon,
  ZapIcon,
} from "lucide-react";
import Link from "next/link";

import { ErzyshPageShell, glassPanelClass } from "@/components/landing/ErzyshPageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { APP_VERSION, WASM_VERSION } from "@/config/version";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    icon: BoxIcon,
    tag: "VIEWPORT",
    title: "Viewport 3D Interaktif",
    description:
      "Visualisasi defleksi balok real-time lengkap dengan colorbar dan diagram gaya dalam.",
    accent: "text-cyan-400",
  },
  {
    icon: Building2Icon,
    tag: "SNI",
    title: "Desain SNI 2847 & 1729",
    description: "Optimasi penampang beton bertulang dan profil baja IWF/Box sesuai standar SNI.",
    accent: "text-emerald-400",
  },
  {
    icon: ZapIcon,
    tag: "WASM",
    title: "Mesin Rust WASM",
    description: "Solver Euler-Bernoulli berperforma tinggi yang berjalan langsung di browser.",
    accent: "text-sky-400",
  },
  {
    icon: HandIcon,
    tag: "GESTURE",
    title: "Kontrol Gestur Tangan",
    description: "Gerakkan kursor dan jendela melayang menggunakan kamera dan MediaPipe.",
    accent: "text-violet-400",
  },
  {
    icon: MicIcon,
    tag: "AI",
    title: "Asisten Suara & AI",
    description: "Perintah suara dan konsultan struktur berbasis AI untuk alur kerja lebih cepat.",
    accent: "text-amber-400",
  },
  {
    icon: FileTextIcon,
    tag: "EXPORT",
    title: "Ekspor Profesional",
    description: "Lembar perhitungan serta ekspor DXF, IFC4, SAP2000, STEP, dan IDEA StatiCa.",
    accent: "text-cyan-400",
  },
] as const;

const SPECS = [
  { label: "APP", value: `v${APP_VERSION}` },
  { label: "WASM ENGINE", value: `v${WASM_VERSION}` },
  { label: "BETON", value: "SNI 2847:2019" },
  { label: "BAJA", value: "SNI 1729:2020" },
] as const;

export default function LandingPage() {
  return (
    <ErzyshPageShell>
      <header className="sticky top-0 z-40 px-4 pt-3.5 sm:px-6">
        <nav
          className={cn(
            glassPanelClass,
            "mx-auto flex max-w-6xl items-center justify-between px-3 py-1.5",
          )}
        >
          <Link href="/" className="flex items-center gap-2 text-xs font-bold tracking-wider">
            <RulerIcon className="size-4 text-cyan-400" aria-hidden />
            IBDS
          </Link>
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm" className="hidden text-[11px] sm:inline-flex">
              <a href="#fitur">Fitur</a>
            </Button>
            <Button asChild variant="ghost" size="sm" className="hidden text-[11px] sm:inline-flex">
              <a href="#mulai">Mulai</a>
            </Button>
            <Button
              asChild
              size="sm"
              className="bg-sky-500/20 text-[11px] font-bold text-sky-400 hover:bg-sky-500/30"
            >
              <Link href="/simulator">Buka Simulator</Link>
            </Button>
          </div>
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-4xl px-6 pt-24 pb-16 text-center sm:pt-32">
          <Badge
            variant="outline"
            className="border-border/40 bg-card/60 text-[11px] text-slate-400"
          >
            <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden />v{APP_VERSION} ·
            Interactive Beam Deflection & Structural Design Simulator
          </Badge>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-balance sm:text-5xl">
            Simulasi Defleksi Balok & Desain Struktur{" "}
            <span className="bg-linear-to-r from-cyan-400 to-sky-400 bg-clip-text text-transparent">
              3D Interaktif
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm text-balance text-slate-400 sm:text-base">
            Analisis defleksi, gaya dalam, dan desain penampang beton maupun baja langsung di
            browser — cepat, akurat, dan mengacu pada standar SNI.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            <Button asChild size="lg" className="px-4 font-semibold">
              <Link href="/simulator">
                Mulai Simulasi <ArrowRightIcon data-icon="inline-end" aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="px-4">
              <a href="#fitur">Lihat Fitur</a>
            </Button>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-6">
          <dl
            className={cn(
              glassPanelClass,
              "divide-border/40 grid grid-cols-2 sm:grid-cols-4 sm:divide-x",
            )}
          >
            {SPECS.map((spec) => (
              <div key={spec.label} className="px-4 py-3 text-center">
                <dt className="text-[10px] font-bold tracking-wider text-slate-500">
                  {spec.label}
                </dt>
                <dd className="mt-0.5 font-mono text-sm text-cyan-400">{spec.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="fitur" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-24">
          <p className="text-center text-[11px] font-bold tracking-wider text-sky-400">
            FITUR UTAMA
          </p>
          <h2 className="mt-2 text-center text-2xl font-bold tracking-tight">
            Workstation teknik sipil di browser
          </h2>
          <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, tag, title, description, accent }) => (
              <li
                key={title}
                className={cn(
                  glassPanelClass,
                  "overflow-hidden transition-colors hover:border-cyan-500/40",
                )}
              >
                <div className="border-border/40 flex items-center justify-between border-b px-3 py-2">
                  <span className="text-foreground text-xs font-bold tracking-wider">{title}</span>
                  <Icon className={cn("size-3.5", accent)} aria-hidden />
                </div>
                <div className="p-3">
                  <p className="text-xs leading-relaxed text-slate-300">{description}</p>
                  <span className={cn("mt-3 inline-block font-mono text-[10px]", accent)}>
                    #{tag}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section id="mulai" className="mx-auto max-w-4xl scroll-mt-20 px-6 pb-24">
          <div className={cn(glassPanelClass, "p-8 text-center")}>
            <p className="text-[11px] font-bold tracking-wider text-sky-400">MULAI SEKARANG</p>
            <h2 className="mt-2 text-xl font-bold">Pilih mode simulasi</h2>
            <p className="mx-auto mt-2 max-w-md text-xs text-slate-400">
              Tersedia untuk desktop workstation dan Android companion (PWA). Tanpa instalasi.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Link
                href="/simulator?mode=MODE_A_EXTERNAL_LOADS"
                className="group border-border/40 bg-background/60 rounded-lg border p-4 text-left transition-colors hover:border-cyan-500/50 hover:bg-cyan-500/5"
              >
                <span className="font-mono text-[10px] text-cyan-400">MODE A</span>
                <p className="mt-1 text-sm font-semibold">Beban Eksternal</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Balok interaktif dengan beban titik & merata.
                </p>
              </Link>
              <Link
                href="/simulator?mode=MODE_B_DIRECT_INTERNAL_FORCES"
                className="group border-border/40 bg-background/60 rounded-lg border p-4 text-left transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/5"
              >
                <span className="font-mono text-[10px] text-emerald-400">MODE B</span>
                <p className="mt-1 text-sm font-semibold">Gaya Dalam SNI</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Optimasi penampang beton bertulang & profil baja.
                </p>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-border/40 bg-background/60 border-t py-6 text-center text-[11px] text-slate-500 backdrop-blur-md">
        © {new Date().getFullYear()} IBDS — Interactive Beam Deflection & Structural Design
        Simulator
      </footer>
    </ErzyshPageShell>
  );
}
