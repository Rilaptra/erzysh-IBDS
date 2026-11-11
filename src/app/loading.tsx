import { ErzyshPageShell } from "@/components/landing/ErzyshPageShell";

export default function Loading() {
  return (
    <ErzyshPageShell>
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3" aria-busy="true">
        <div
          className="border-border/40 size-8 animate-spin rounded-full border-2 border-t-cyan-400"
          role="status"
          aria-label="Memuat"
        />
        <span className="text-[11px] font-bold tracking-wider text-slate-500">MEMUAT…</span>
      </main>
    </ErzyshPageShell>
  );
}
