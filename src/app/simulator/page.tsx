import type { Metadata } from "next";

import { AdaptiveApplicationShell } from "@/components/adaptive/AdaptiveApplicationShell";

export const metadata: Metadata = {
  title: "Simulator — IBDS",
};

export default function SimulatorPage() {
  return (
    <div className="relative h-dvh w-full overflow-hidden">
      {/* Subtle 1px cyber-HUD telemetry scanline along the top viewport edge */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-50 h-px overflow-hidden"
      >
        <div className="erzysh-scanline h-full w-40 bg-linear-to-r from-transparent via-cyan-400/50 to-transparent" />
      </div>
      <AdaptiveApplicationShell />
    </div>
  );
}
