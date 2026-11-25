import { afterEach, describe, expect, test } from "bun:test";

import { GITHUB_REPO_FALLBACK_SNAPSHOT } from "@/data/presentation/github-fallback-snapshot";
import { getGithubRepoSnapshot } from "@/lib/github/repo-snapshot";

const originalFetch = globalThis.fetch;

function createMockFetch(
  handler: (input: string | URL | Request, init?: RequestInit) => Promise<Response>,
): typeof fetch {
  return Object.assign(handler, {
    preconnect: originalFetch.preconnect,
  }) as unknown as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("GitHub Repository Snapshot Service (/embed/github-repo)", () => {
  test("parses live GitHub REST API v3 responses when all endpoints return 200 OK", async () => {
    const mockFetch = createMockFetch(async (input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

      if (url.endsWith("/languages")) {
        return new Response(JSON.stringify({ TypeScript: 80_000, Rust: 15_000, CSS: 5_000 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/contents")) {
        return new Response(
          JSON.stringify([
            {
              name: "src",
              path: "src",
              type: "dir",
              html_url: "https://github.com/Rilaptra/erzysh-IBDS/tree/main/src",
            },
            {
              name: "README.md",
              path: "README.md",
              type: "file",
              html_url: "https://github.com/Rilaptra/erzysh-IBDS/blob/main/README.md",
            },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/commits")) {
        return new Response(
          JSON.stringify([
            {
              sha: "97a0514abcdef1234567890",
              html_url: "https://github.com/Rilaptra/erzysh-IBDS/commit/97a0514",
              commit: {
                message: "feat(presentation): add interactive presentation route\n\nDetails",
                author: { name: "Rizqi Lasheva", date: "2026-11-25T10:00:00Z" },
              },
            },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({
          full_name: "Rilaptra/erzysh-IBDS",
          name: "erzysh-IBDS",
          owner: { login: "Rilaptra" },
          html_url: "https://github.com/Rilaptra/erzysh-IBDS",
          description: "Interactive 3D Beam Deflection & Structural Design Simulator",
          default_branch: "main",
          license: { spdx_id: "MIT" },
          stargazers_count: 42,
          forks_count: 7,
          subscribers_count: 10,
          open_issues_count: 2,
          topics: ["civil-engineering", "rust-wasm", "nextjs"],
          pushed_at: "2026-11-25T10:00:00Z",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    globalThis.fetch = mockFetch;

    const snapshot = await getGithubRepoSnapshot();
    expect(snapshot.dataSource).toBe("live-github-api");
    expect(snapshot.fullName).toBe("Rilaptra/erzysh-IBDS");
    expect(snapshot.starsCount).toBe(42);
    expect(snapshot.forksCount).toBe(7);
    expect(snapshot.languages.length).toBeGreaterThan(0);
    expect(snapshot.rootTree.length).toBe(2);
    expect(snapshot.recentCommits[0]?.shaShort).toBe("97a0514");
  });

  test("falls back gracefully to GITHUB_REPO_FALLBACK_SNAPSHOT on HTTP 403 rate limit", async () => {
    globalThis.fetch = createMockFetch(
      async () =>
        new Response(JSON.stringify({ message: "API rate limit exceeded" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }),
    );

    const snapshot = await getGithubRepoSnapshot();
    expect(snapshot.dataSource).toBe("static-fallback");
    expect(snapshot.fullName).toBe(GITHUB_REPO_FALLBACK_SNAPSHOT.fullName);
    expect(snapshot.rootTree.length).toBeGreaterThan(0);
  });

  test("falls back gracefully without throwing on network error or timeout", async () => {
    globalThis.fetch = createMockFetch(async () => {
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    });

    const snapshot = await getGithubRepoSnapshot();
    expect(snapshot.dataSource).toBe("static-fallback");
    expect(snapshot.htmlUrl).toBe("https://github.com/Rilaptra/erzysh-IBDS");
  });
});
