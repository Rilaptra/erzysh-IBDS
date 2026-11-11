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
        "text-foreground relative h-dvh w-full overflow-x-hidden overflow-y-auto scroll-smooth bg-[#0A0A0A] select-text",
        className,
      )}
    >
      {/* 40px x 40px orthogonal grid with radial vignette (fixed while content scrolls) */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 opacity-85"
        style={{
          backgroundImage:
            "linear-gradient(to right, #1F2020 1px, transparent 1px), linear-gradient(to bottom, #1F2020 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage: "radial-gradient(circle at 50% 40%, black 45%, transparent 95%)",
          WebkitMaskImage: "radial-gradient(circle at 50% 40%, black 45%, transparent 95%)",
        }}
      />
      {/* Teal/Cyan soft ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 35%, rgba(6, 182, 212, 0.08) 0%, rgba(10, 14, 14, 0.02) 45%, transparent 75%)",
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

/** Glassmorphism panel matching the floating-window surface used in the workstation. */
export const glassPanelClass =
  "bg-card/85 border-border/40 rounded-lg border shadow-xl backdrop-blur-md";

export default ErzyshPageShell;
