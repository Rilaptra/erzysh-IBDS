import type { Metadata } from "next";

import { AdaptiveApplicationShell } from "@/components/adaptive/AdaptiveApplicationShell";

export const metadata: Metadata = {
  title: "Simulator — IBDS",
};

export default function SimulatorPage() {
  return <AdaptiveApplicationShell />;
}
