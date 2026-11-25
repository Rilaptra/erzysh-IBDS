import type { Metadata } from "next";
import type { ReactElement, ReactNode } from "react";

export const metadata: Metadata = {
  title: "GitHub Preview — Rilaptra/erzysh-IBDS",
  description:
    "Pratinjau same-origin repositori GitHub Rilaptra/erzysh-IBDS untuk halaman presentasi.",
  robots: { index: false, follow: false },
};

export default function GitHubRepoEmbedLayout({
  children,
}: {
  readonly children: ReactNode;
}): ReactElement {
  return <div className="h-dvh w-full overflow-hidden bg-[#0d1117]">{children}</div>;
}
