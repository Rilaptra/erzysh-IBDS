import {
  GITHUB_REPO_FALLBACK_SNAPSHOT,
  GITHUB_REPO_NAME,
  GITHUB_REPO_OWNER,
  GITHUB_REPO_URL,
} from "@/data/presentation/github-fallback-snapshot";
import type {
  GitHubCommitSummary,
  GitHubLanguageShare,
  GitHubRepoSnapshot,
  GitHubTreeEntry,
} from "@/types/presentation-types";

type NextFetchInit = RequestInit & {
  readonly next?: {
    readonly revalidate?: number | false;
    readonly tags?: readonly string[];
  };
};

export interface GetGithubRepoSnapshotOptions {
  readonly fetchImpl?: typeof fetch;
  readonly token?: string;
  readonly timeoutMs?: number;
}

const LANGUAGE_COLOR_MAP: Readonly<Record<string, string>> = {
  TypeScript: "#3178c6",
  Rust: "#dea584",
  CSS: "#663399",
  JavaScript: "#f1e05a",
  HTML: "#e34c26",
  Shell: "#89e051",
  MDX: "#fcb32c",
};

interface RawGitHubRepo {
  readonly name?: string;
  readonly full_name?: string;
  readonly html_url?: string;
  readonly description?: string | null;
  readonly default_branch?: string;
  readonly license?: { readonly spdx_id?: string | null } | null;
  readonly stargazers_count?: number;
  readonly forks_count?: number;
  readonly subscribers_count?: number;
  readonly watchers_count?: number;
  readonly open_issues_count?: number;
  readonly topics?: readonly string[];
  readonly pushed_at?: string;
  readonly owner?: { readonly login?: string };
}

interface RawGitHubContentEntry {
  readonly name?: string;
  readonly path?: string;
  readonly type?: string;
  readonly html_url?: string;
}

interface RawGitHubCommit {
  readonly sha?: string;
  readonly html_url?: string;
  readonly commit?: {
    readonly message?: string;
    readonly author?: {
      readonly name?: string;
      readonly date?: string;
    };
  };
}

function buildHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "erzysh-IBDS-Presentation",
  };
  if (token?.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }
  return headers;
}

async function fetchJsonSafe<T>(
  url: string,
  fetchImpl: typeof fetch,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<{ readonly ok: boolean; readonly status: number; readonly data: T | null }> {
  const init: NextFetchInit = {
    method: "GET",
    headers,
    signal: AbortSignal.timeout(timeoutMs),
    next: { revalidate: 3600, tags: ["github-repo"] },
  };
  const response = await fetchImpl(url, init);
  if (!response.ok) {
    return { ok: false, status: response.status, data: null };
  }
  const data = (await response.json()) as T;
  return { ok: true, status: response.status, data };
}

function mapLanguages(raw: Record<string, number> | null): GitHubLanguageShare[] {
  if (!raw) return [...GITHUB_REPO_FALLBACK_SNAPSHOT.languages];
  const entries = Object.entries(raw).filter(
    ([, bytes]) => typeof bytes === "number" && Number.isFinite(bytes) && bytes > 0,
  );
  if (entries.length === 0) return [...GITHUB_REPO_FALLBACK_SNAPSHOT.languages];

  const totalBytes = entries.reduce((sum, [, bytes]) => sum + bytes, 0);
  entries.sort((a, b) => b[1] - a[1]);

  return entries.slice(0, 5).map(([name, bytes]) => ({
    name,
    bytes,
    percentage: Number(((bytes / totalBytes) * 100).toFixed(1)),
    colorHex: LANGUAGE_COLOR_MAP[name] ?? "#64748b",
  }));
}

function mapRootTree(raw: readonly RawGitHubContentEntry[] | null): GitHubTreeEntry[] {
  if (!raw || raw.length === 0) return [...GITHUB_REPO_FALLBACK_SNAPSHOT.rootTree];
  const mapped: GitHubTreeEntry[] = [];
  for (const entry of raw) {
    if (!entry.name || !entry.path) continue;
    const type: "dir" | "file" = entry.type === "dir" ? "dir" : "file";
    mapped.push({
      name: entry.name,
      path: entry.path,
      type,
      htmlUrl:
        entry.html_url ??
        `${GITHUB_REPO_URL}/${type === "dir" ? "tree" : "blob"}/main/${entry.path}`,
    });
  }
  mapped.sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return mapped.slice(0, 18);
}

function mapCommits(raw: readonly RawGitHubCommit[] | null): GitHubCommitSummary[] {
  if (!raw || raw.length === 0) return [...GITHUB_REPO_FALLBACK_SNAPSHOT.recentCommits];
  const commits: GitHubCommitSummary[] = [];
  for (const item of raw) {
    const sha = item.sha ?? "";
    const headline = (item.commit?.message ?? "").split("\n")[0]?.trim() ?? "Update repository";
    if (!sha) continue;
    commits.push({
      shaShort: sha.slice(0, 7),
      messageHeadline: headline,
      authorName: item.commit?.author?.name ?? "Rizqi Lasheva",
      committedAtIso: item.commit?.author?.date ?? GITHUB_REPO_FALLBACK_SNAPSHOT.pushedAtIso,
      htmlUrl: item.html_url ?? `${GITHUB_REPO_URL}/commit/${sha}`,
    });
  }
  return commits.length > 0
    ? commits.slice(0, 5)
    : [...GITHUB_REPO_FALLBACK_SNAPSHOT.recentCommits];
}

export async function getGithubRepoSnapshot(
  options: GetGithubRepoSnapshotOptions = {},
): Promise<GitHubRepoSnapshot> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const token = options.token ?? process.env.GITHUB_TOKEN;
  const timeoutMs = options.timeoutMs ?? 4000;
  const headers = buildHeaders(token);
  const baseUrl = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`;

  try {
    const [repoRes, langRes, treeRes, commitsRes] = await Promise.allSettled([
      fetchJsonSafe<RawGitHubRepo>(baseUrl, fetchImpl, headers, timeoutMs),
      fetchJsonSafe<Record<string, number>>(`${baseUrl}/languages`, fetchImpl, headers, timeoutMs),
      fetchJsonSafe<RawGitHubContentEntry[]>(
        `${baseUrl}/contents?ref=main`,
        fetchImpl,
        headers,
        timeoutMs,
      ),
      fetchJsonSafe<RawGitHubCommit[]>(
        `${baseUrl}/commits?sha=main&per_page=5`,
        fetchImpl,
        headers,
        timeoutMs,
      ),
    ]);

    if (repoRes.status !== "fulfilled" || !repoRes.value.ok || !repoRes.value.data) {
      return {
        ...GITHUB_REPO_FALLBACK_SNAPSHOT,
        fetchedAtIso: new Date().toISOString(),
        dataSource: "static-fallback",
      };
    }

    const repo = repoRes.value.data;
    const rawLanguages =
      langRes.status === "fulfilled" && langRes.value.ok ? langRes.value.data : null;
    const rawTree = treeRes.status === "fulfilled" && treeRes.value.ok ? treeRes.value.data : null;
    const rawCommits =
      commitsRes.status === "fulfilled" && commitsRes.value.ok ? commitsRes.value.data : null;

    return {
      owner: repo.owner?.login ?? GITHUB_REPO_OWNER,
      name: repo.name ?? GITHUB_REPO_NAME,
      fullName: repo.full_name ?? `${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`,
      htmlUrl: repo.html_url ?? GITHUB_REPO_URL,
      description: repo.description ?? GITHUB_REPO_FALLBACK_SNAPSHOT.description,
      defaultBranch: repo.default_branch ?? "main",
      licenseSpdx: repo.license?.spdx_id ?? "MIT",
      starsCount: repo.stargazers_count ?? 0,
      forksCount: repo.forks_count ?? 0,
      watchersCount: repo.subscribers_count ?? repo.watchers_count ?? 0,
      openIssuesCount: repo.open_issues_count ?? 0,
      topics:
        repo.topics && repo.topics.length > 0 ? repo.topics : GITHUB_REPO_FALLBACK_SNAPSHOT.topics,
      pushedAtIso: repo.pushed_at ?? GITHUB_REPO_FALLBACK_SNAPSHOT.pushedAtIso,
      languages: mapLanguages(rawLanguages),
      rootTree: mapRootTree(rawTree),
      recentCommits: mapCommits(rawCommits),
      fetchedAtIso: new Date().toISOString(),
      dataSource: "live-github-api",
    };
  } catch {
    return {
      ...GITHUB_REPO_FALLBACK_SNAPSHOT,
      fetchedAtIso: new Date().toISOString(),
      dataSource: "static-fallback",
    };
  }
}
