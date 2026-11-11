"use client";

import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { ErzyshPageShell, glassPanelClass } from "@/components/landing/ErzyshPageShell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErzyshPageShell>
      <main className="flex min-h-dvh items-center justify-center px-6 py-12">
        <div className={cn(glassPanelClass, "w-full max-w-md overflow-hidden")}>
          <div className="border-border/40 flex items-center justify-between border-b px-3 py-2">
            <span className="text-xs font-bold tracking-wider">ERROR · RUNTIME EXCEPTION</span>
            <TriangleAlertIcon className="text-destructive size-3.5" aria-hidden />
          </div>
          <div className="p-6 text-center">
            <p className="text-destructive font-mono text-6xl font-bold">500</p>
            <h1 className="mt-3 text-lg font-semibold">Terjadi kesalahan</h1>
            <p className="mt-2 text-xs text-slate-400">
              Sesuatu tidak berjalan semestinya. Coba muat ulang, atau kembali ke beranda.
            </p>
            {error.digest ? (
              <p className="border-border/40 bg-background/60 mt-3 inline-block rounded-md border px-2 py-1 font-mono text-[10px] text-slate-500">
                digest: {error.digest}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button type="button" onClick={reset}>
                <RotateCcwIcon data-icon="inline-start" aria-hidden /> Coba Lagi
              </Button>
              <Button asChild variant="outline">
                <Link href="/">Kembali ke Beranda</Link>
              </Button>
            </div>
          </div>
        </div>
      </main>
    </ErzyshPageShell>
  );
}
