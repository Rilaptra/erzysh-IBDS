/**
 * @file ErzyshPageShell.tsx
 * @description Scrollable page shell for non-simulator routes (landing, 404, error).
 * The global stylesheet locks `html, body` with `overflow: hidden` for the full-screen
 * simulator canvas, so content pages provide their own viewport-sized scroll container.
 * Visuals mirror {@link ErzyshDarkGridBackground}: #0A0A0A void, 40px #1F2020 grid with
 * radial vignette, and a soft teal/cyan ambient glow.
 */

import type { ReactElement, ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface ErzyshPageShellProps {
  readonly children: ReactNode;
  readonly className?: string;
}

export function ErzyshPageShell({ children, className }: ErzyshPageShellProps): ReactElement {
  return (
    <div
      className={cn(
        "text-foreground relative h-dvh w-full overflow-x-hidden overflow-y-auto scroll-smooth bg-[#050a14] select-text",
        className,
      )}
    >
      {/* 40px x 40px blueprint grid with radial vignette (fixed while content scrolls) */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 opacity-85"
        style={{
          backgroundImage:
            "linear-gradient(to right, #122133 1px, transparent 1px), linear-gradient(to bottom, #122133 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage: "radial-gradient(circle at 50% 40%, black 45%, transparent 95%)",
          WebkitMaskImage: "radial-gradient(circle at 50% 40%, black 45%, transparent 95%)",
        }}
      />
      {/* Dual Cyan (left) + Violet/Indigo (right) ambient glow matching banner-wide */}
      <div
        aria-hidden="true"
        className="erzysh-glow-pulse pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(circle at 22% 28%, rgba(34, 211, 238, 0.11) 0%, transparent 52%), radial-gradient(circle at 80% 42%, rgba(139, 92, 246, 0.11) 0%, transparent 55%)",
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

/** Glassmorphism panel matching the deep navy-cyan surface of banner-wide. */
export const glassPanelClass =
  "bg-[#0a1322]/80 border-cyan-500/15 rounded-lg border shadow-xl shadow-black/40 backdrop-blur-md";

export default ErzyshPageShell;
