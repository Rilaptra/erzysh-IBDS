import { HomeIcon, SearchXIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ErzyshPageShell, glassPanelClass } from "@/components/landing/ErzyshPageShell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "404 — Halaman Tidak Ditemukan | IBDS",
};

export default function NotFound() {
  return (
    <ErzyshPageShell>
      <main className="flex min-h-dvh items-center justify-center px-6 py-12">
        <div className={cn(glassPanelClass, "w-full max-w-md overflow-hidden")}>
          <div className="border-border/40 flex items-center justify-between border-b px-3 py-2">
            <span className="text-xs font-bold tracking-wider">ERROR · ROUTE NOT FOUND</span>
            <SearchXIcon className="size-3.5 text-amber-400" aria-hidden />
          </div>
          <div className="p-6 text-center">
            <p className="bg-linear-to-r from-cyan-400 to-sky-400 bg-clip-text font-mono text-7xl font-bold text-transparent">
              404
            </p>
            <h1 className="mt-3 text-lg font-semibold">Halaman tidak ditemukan</h1>
            <p className="mt-2 text-xs text-slate-400">
              Halaman yang Anda cari tidak ada, sudah dipindahkan, atau alamatnya salah ketik.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link href="/">
                  <HomeIcon data-icon="inline-start" aria-hidden /> Beranda
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/simulator">Buka Simulator</Link>
              </Button>
            </div>
          </div>
        </div>
      </main>
    </ErzyshPageShell>
  );
}
