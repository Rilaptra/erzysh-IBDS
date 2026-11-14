import { readFileSync } from "node:fs";
import path from "node:path";

import { type ChangelogRelease, parseChangelogMarkdown } from "./changelog-shared";

export * from "./changelog-shared";

/**
 * Reads and parses the repository's root `CHANGELOG.md` on the server.
 */
export function getAllChangelogReleases(): ChangelogRelease[] {
  try {
    const changelogPath = path.join(process.cwd(), "CHANGELOG.md");
    const content = readFileSync(changelogPath, "utf8");
    return parseChangelogMarkdown(content);
  } catch {
    return [];
  }
}

/**
 * Returns the latest `limit` releases from `CHANGELOG.md`.
 */
export function getLatestChangelogReleases(limit = 3): ChangelogRelease[] {
  return getAllChangelogReleases().slice(0, Math.max(0, limit));
}
