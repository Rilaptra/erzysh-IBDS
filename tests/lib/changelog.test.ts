import { describe, expect, test } from "bun:test";

import {
  formatChangelogDate,
  getAllChangelogReleases,
  getLatestChangelogReleases,
  parseChangelogMarkdown,
  parseInlineMarkdown,
} from "@/lib/changelog";

describe("changelog parser", () => {
  test("parses releases, categories, and bullet items", () => {
    const sample = `# Changelog

## [1.2.0] - 2026-11-14

### ✨ Added

- Add \`WhatsNewSection\` to landing page
- Support **bold** highlights

### 🐛 Bug Fixes

- Fix mobile overflow

## [1.1.0] - 2026-11-10

### ⚡ Performance

- Faster parser
`;

    const releases = parseChangelogMarkdown(sample);
    expect(releases).toHaveLength(2);
    const [first, second] = releases;
    expect(first?.version).toBe("1.2.0");
    expect(first?.date).toBe("2026-11-14");
    expect(first?.totalItems).toBe(3);
    expect(first?.sections[0]?.kind).toBe("added");
    expect(first?.sections[0]?.title).toBe("Added");
    expect(first?.sections[1]?.kind).toBe("fixed");
    expect(second?.sections[0]?.kind).toBe("performance");
  });

  test("reads repository CHANGELOG.md cleanly", () => {
    const all = getAllChangelogReleases();
    expect(all.length).toBeGreaterThan(10);
    expect(all[0]?.version).toBe("0.6.16");
    expect(all[0]?.sections.length).toBeGreaterThan(0);

    const latest3 = getLatestChangelogReleases(3);
    expect(latest3).toHaveLength(3);
  });

  test("tokenizes inline code and bold markdown", () => {
    const tokens = parseInlineMarkdown("Add `foo.ts` with **bar** support");
    expect(tokens).toEqual([
      { type: "text", value: "Add " },
      { type: "code", value: "foo.ts" },
      { type: "text", value: " with " },
      { type: "bold", value: "bar" },
      { type: "text", value: " support" },
    ]);
  });

  test("formats ISO dates deterministically", () => {
    expect(formatChangelogDate("2026-11-14")).toContain("2026");
    expect(formatChangelogDate("invalid-date")).toBe("invalid-date");
  });
});
