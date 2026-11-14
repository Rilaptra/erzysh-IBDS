import {
  BookOpenIcon,
  BugIcon,
  type LucideIcon,
  SparklesIcon,
  TagIcon,
  WrenchIcon,
  ZapIcon,
} from "lucide-react";
import type { ReactElement } from "react";

import { Badge } from "@/components/ui/badge";
import {
  type ChangelogCategoryKind,
  type ChangelogSection,
  parseInlineMarkdown,
} from "@/lib/changelog-shared";
import { cn } from "@/lib/utils";

export interface CategoryVisualMeta {
  readonly label: string;
  readonly badgeClass: string;
  readonly accentText: string;
  readonly Icon: LucideIcon;
}

const CATEGORY_META: Record<ChangelogCategoryKind, CategoryVisualMeta> = {
  added: {
    label: "Added",
    badgeClass: "border-cyan-400/30 bg-cyan-500/10 text-cyan-300",
    accentText: "text-cyan-400",
    Icon: SparklesIcon,
  },
  fixed: {
    label: "Bug Fixes",
    badgeClass: "border-rose-400/30 bg-rose-500/10 text-rose-300",
    accentText: "text-rose-400",
    Icon: BugIcon,
  },
  performance: {
    label: "Performance",
    badgeClass: "border-amber-400/30 bg-amber-500/10 text-amber-300",
    accentText: "text-amber-400",
    Icon: ZapIcon,
  },
  maintenance: {
    label: "Maintenance",
    badgeClass: "border-violet-400/30 bg-violet-500/10 text-violet-300",
    accentText: "text-violet-400",
    Icon: WrenchIcon,
  },
  docs: {
    label: "Docs",
    badgeClass: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
    accentText: "text-emerald-400",
    Icon: BookOpenIcon,
  },
  other: {
    label: "Changes",
    badgeClass: "border-slate-400/30 bg-slate-500/10 text-slate-300",
    accentText: "text-slate-400",
    Icon: TagIcon,
  },
};

export function getCategoryVisualMeta(kind: ChangelogCategoryKind): CategoryVisualMeta {
  return CATEGORY_META[kind];
}

export function ChangelogCategoryBadge({
  section,
  className,
}: {
  readonly section: Pick<ChangelogSection, "kind" | "title">;
  readonly className?: string;
}): ReactElement {
  const meta = getCategoryVisualMeta(section.kind);
  const Icon = meta.Icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-[10px] tracking-wide uppercase",
        meta.badgeClass,
        className,
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden="true" />
      <span>{section.title || meta.label}</span>
    </Badge>
  );
}

export function ChangelogInlineText({
  text,
  className,
}: {
  readonly text: string;
  readonly className?: string;
}): ReactElement {
  const tokens = parseInlineMarkdown(text);

  return (
    <span className={cn("wrap-break-word", className)}>
      {tokens.map((token, index) => {
        if (token.type === "code") {
          return (
            <code
              key={`${index}-${token.value}`}
              className="mx-0.5 rounded border border-cyan-500/20 bg-cyan-950/60 px-1.5 py-0.5 font-mono text-[11px] text-cyan-300"
            >
              {token.value}
            </code>
          );
        }
        if (token.type === "bold") {
          return (
            <strong key={`${index}-${token.value}`} className="font-semibold text-slate-100">
              {token.value}
            </strong>
          );
        }
        return <span key={`${index}-${token.value}`}>{token.value}</span>;
      })}
    </span>
  );
}
