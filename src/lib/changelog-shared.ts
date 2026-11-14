export type ChangelogCategoryKind =
  "added" | "fixed" | "performance" | "maintenance" | "docs" | "other";

export interface ChangelogSection {
  readonly title: string;
  readonly emoji?: string;
  readonly kind: ChangelogCategoryKind;
  readonly items: readonly string[];
}

export interface ChangelogRelease {
  readonly version: string;
  readonly date: string;
  readonly sections: readonly ChangelogSection[];
  readonly totalItems: number;
}

export interface InlineMarkdownToken {
  readonly type: "text" | "code" | "bold";
  readonly value: string;
}

const RELEASE_HEADING_RE = /^##\s+\[([^\]]+)\]\s*-\s*(\d{4}-\d{2}-\d{2})\s*$/;
const SECTION_HEADING_RE = /^###\s+(.+?)\s*$/;
const BULLET_ITEM_RE = /^-\s+(.+)$/;
const LEADING_EMOJI_RE =
  /^([\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\u200D]+)\s+(.+)$/u;

function classifyCategory(rawTitle: string, emoji?: string): ChangelogCategoryKind {
  const lower = rawTitle.toLowerCase();
  if (lower.includes("fix") || lower.includes("bug")) return "fixed";
  if (lower.includes("perf")) return "performance";
  if (lower.includes("maint") || lower.includes("chore")) return "maintenance";
  if (emoji === "📚" || lower.includes("doc")) return "docs";
  if (lower.includes("add") || lower.includes("feat")) return "added";
  return "other";
}

function parseSectionHeading(rawHeading: string): {
  readonly title: string;
  readonly emoji?: string;
  readonly kind: ChangelogCategoryKind;
} {
  const trimmed = rawHeading.trim();
  const emojiMatch = LEADING_EMOJI_RE.exec(trimmed);
  if (emojiMatch?.[1] && emojiMatch[2]) {
    const emoji = emojiMatch[1];
    const title = emojiMatch[2].trim();
    return {
      title,
      emoji,
      kind: classifyCategory(title, emoji),
    };
  }
  return {
    title: trimmed,
    kind: classifyCategory(trimmed),
  };
}

/**
 * Parses a Keep-a-Changelog style markdown string into structured releases.
 */
export function parseChangelogMarkdown(markdown: string): ChangelogRelease[] {
  const lines = markdown.split(/\r?\n/);
  const releases: ChangelogRelease[] = [];

  let currentRelease: {
    version: string;
    date: string;
    sections: {
      title: string;
      emoji?: string;
      kind: ChangelogCategoryKind;
      items: string[];
    }[];
  } | null = null;

  let currentSection: {
    title: string;
    emoji?: string;
    kind: ChangelogCategoryKind;
    items: string[];
  } | null = null;

  const flushRelease = (): void => {
    if (!currentRelease) return;
    const sections = currentRelease.sections.filter((section) => section.items.length > 0);
    const totalItems = sections.reduce((sum, section) => sum + section.items.length, 0);
    releases.push({
      version: currentRelease.version,
      date: currentRelease.date,
      sections,
      totalItems,
    });
    currentRelease = null;
    currentSection = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const releaseMatch = RELEASE_HEADING_RE.exec(line);
    if (releaseMatch?.[1] && releaseMatch[2]) {
      flushRelease();
      currentRelease = {
        version: releaseMatch[1].trim(),
        date: releaseMatch[2].trim(),
        sections: [],
      };
      continue;
    }

    if (!currentRelease) continue;

    const sectionMatch = SECTION_HEADING_RE.exec(line);
    if (sectionMatch?.[1]) {
      const parsed = parseSectionHeading(sectionMatch[1]);
      currentSection = {
        title: parsed.title,
        emoji: parsed.emoji,
        kind: parsed.kind,
        items: [],
      };
      currentRelease.sections.push(currentSection);
      continue;
    }

    const bulletMatch = BULLET_ITEM_RE.exec(line);
    if (bulletMatch?.[1]) {
      if (!currentSection) {
        currentSection = {
          title: "Changes",
          kind: "other",
          items: [],
        };
        currentRelease.sections.push(currentSection);
      }
      currentSection.items.push(bulletMatch[1].trim());
    }
  }

  flushRelease();
  return releases;
}

/**
 * Tokenizes inline `**bold**` and `` `code` `` spans for safe React rendering.
 */
export function parseInlineMarkdown(text: string): InlineMarkdownToken[] {
  const tokens: InlineMarkdownToken[] = [];
  const tokenRe = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let lastIndex = 0;

  for (const match of text.matchAll(tokenRe)) {
    const matchIndex = match.index ?? 0;
    if (matchIndex > lastIndex) {
      tokens.push({ type: "text", value: text.slice(lastIndex, matchIndex) });
    }
    const raw = match[0];
    if (raw.startsWith("`") && raw.endsWith("`")) {
      tokens.push({ type: "code", value: raw.slice(1, -1) });
    } else if (raw.startsWith("**") && raw.endsWith("**")) {
      tokens.push({ type: "bold", value: raw.slice(2, -2) });
    }
    lastIndex = matchIndex + raw.length;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: "text", value: text.slice(lastIndex) });
  }

  return tokens.length > 0 ? tokens : [{ type: "text", value: text }];
}

const INDONESIAN_DATE_FORMATTER = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * Formats an ISO `YYYY-MM-DD` date string into a deterministic Indonesian date label.
 */
export function formatChangelogDate(isoDate: string): string {
  const parsed = Date.parse(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(parsed)) return isoDate;
  return INDONESIAN_DATE_FORMATTER.format(new Date(parsed));
}
