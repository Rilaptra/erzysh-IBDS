import { describe, expect, test } from "bun:test";

import type { ChangelogRelease } from "@/lib/changelog-shared";
import { formatLastVisitTimestamp, getUnseenReleases } from "@/lib/whats-new-visit";

const MOCK_RELEASES: readonly ChangelogRelease[] = [
  { version: "0.6.16", date: "2026-11-14", sections: [], totalItems: 3 },
  { version: "0.6.15", date: "2026-11-13", sections: [], totalItems: 4 },
  { version: "0.6.14", date: "2026-11-13", sections: [], totalItems: 2 },
  { version: "0.6.13", date: "2026-11-13", sections: [], totalItems: 1 },
];

describe("whats-new visit tracker", () => {
  test("returns empty list on first visit (null)", () => {
    expect(getUnseenReleases(MOCK_RELEASES, null)).toEqual([]);
  });

  test("returns empty list when already on latest version", () => {
    expect(getUnseenReleases(MOCK_RELEASES, "0.6.16")).toEqual([]);
  });

  test("returns all releases newer than last seen version", () => {
    const unseen = getUnseenReleases(MOCK_RELEASES, "0.6.14");
    expect(unseen.map((r) => r.version)).toEqual(["0.6.16", "0.6.15"]);
  });

  test("falls back to latest releases when stored version is unknown", () => {
    const unseen = getUnseenReleases(MOCK_RELEASES, "0.1.0");
    expect(unseen).toHaveLength(4);
  });

  test("formats ISO timestamp deterministically", () => {
    expect(formatLastVisitTimestamp("2026-11-14T08:30:00Z")).toContain("2026");
    expect(formatLastVisitTimestamp("not-a-date")).toBe("not-a-date");
  });
});
