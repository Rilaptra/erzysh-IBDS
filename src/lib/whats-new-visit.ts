import type { ChangelogRelease } from "@/lib/changelog-shared";

export const WHATS_NEW_STORAGE_KEY = "ibds:last-visit";

export interface LastVisitRecord {
  readonly lastSeenVersion: string;
  readonly lastVisitAt: string;
}

/**
 * Returns all releases newer than `lastSeenVersion`.
 * Returns `[]` on first visit (`lastSeenVersion === null`) or when already on the latest version.
 */
export function getUnseenReleases(
  releases: readonly ChangelogRelease[],
  lastSeenVersion: string | null,
): ChangelogRelease[] {
  if (releases.length === 0 || lastSeenVersion === null) {
    return [];
  }

  const seenIndex = releases.findIndex((release) => release.version === lastSeenVersion);
  if (seenIndex === 0) {
    return [];
  }
  if (seenIndex > 0) {
    return releases.slice(0, seenIndex);
  }

  // Fallback when the stored version is older than the retained changelog entries
  return releases.slice(0, 5);
}

/**
 * Safely reads the last visit record from `localStorage`.
 */
export function readLastVisitRecord(): LastVisitRecord | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(WHATS_NEW_STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "lastSeenVersion" in parsed &&
      "lastVisitAt" in parsed &&
      typeof parsed.lastSeenVersion === "string" &&
      typeof parsed.lastVisitAt === "string"
    ) {
      return {
        lastSeenVersion: parsed.lastSeenVersion,
        lastVisitAt: parsed.lastVisitAt,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Safely persists the latest seen version and timestamp to `localStorage`.
 */
export function writeLastVisitRecord(lastSeenVersion: string, lastVisitAt?: string): void {
  if (typeof window === "undefined") return;

  try {
    const record: LastVisitRecord = {
      lastSeenVersion,
      lastVisitAt: lastVisitAt ?? new Date().toISOString(),
    };
    window.localStorage.setItem(WHATS_NEW_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Ignore storage quota or private-mode errors
  }
}

const VISIT_TIMESTAMP_FORMATTER = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Formats an ISO timestamp into a readable Indonesian date & time label.
 */
export function formatLastVisitTimestamp(isoTimestamp: string): string {
  const parsed = Date.parse(isoTimestamp);
  if (Number.isNaN(parsed)) return isoTimestamp;
  return VISIT_TIMESTAMP_FORMATTER.format(new Date(parsed));
}
