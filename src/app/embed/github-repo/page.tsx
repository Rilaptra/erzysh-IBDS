import {
  CircleAlertIcon,
  ExternalLinkIcon,
  EyeIcon,
  FileCodeIcon,
  FolderIcon,
  GitBranchIcon,
  GitCommitHorizontalIcon,
  GitForkIcon,
  ShieldCheckIcon,
  StarIcon,
} from "lucide-react";
import type { ReactElement } from "react";

import { APP_VERSION } from "@/config/version";
import { getGithubRepoSnapshot } from "@/lib/github/repo-snapshot";

export const revalidate = 3600;

function formatShortDate(iso: string): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return iso;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(parsed));
}

export default async function GitHubRepoEmbedPage(): Promise<ReactElement> {
  const repo = await getGithubRepoSnapshot();
  const isLive = repo.dataSource === "live-github-api";

  return (
    <div className="h-dvh w-full overflow-x-hidden overflow-y-auto bg-[#0d1117] px-4 py-4 text-slate-100 select-text sm:px-5">
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
              <a
                href={`https://github.com/${repo.owner}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-400 hover:underline"
              >
                {repo.owner}
              </a>
              <span className="text-slate-500">/</span>
              <a
                href={repo.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-cyan-300 hover:underline"
              >
                {repo.name}
              </a>
              <span className="rounded-full border border-slate-700 bg-slate-800/80 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                Public
              </span>
              <span className="rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-300">
                {repo.licenseSpdx}
              </span>
              <span className="rounded-full border border-cyan-500/35 bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] text-cyan-200">
                web-v{APP_VERSION}
              </span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{repo.description}</p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span
              className={
                isLive
                  ? "inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[10px] text-emerald-300"
                  : "inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 font-mono text-[10px] text-amber-200"
              }
            >
              <span
                aria-hidden="true"
                className={
                  isLive
                    ? "size-1.5 rounded-full bg-emerald-400"
                    : "size-1.5 rounded-full bg-amber-400"
                }
              />
              {isLive ? "Live GitHub API" : "Cached Snapshot"}
            </span>
            <a
              href={repo.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800/90 px-2.5 py-1 text-[11px] font-medium text-slate-200 transition-colors hover:border-cyan-400/50 hover:text-cyan-200"
            >
              <span>GitHub</span>
              <ExternalLinkIcon className="size-3" aria-hidden="true" />
            </a>
          </div>
        </header>

        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <div className="rounded-md border border-slate-800 bg-[#161b22] px-3 py-2">
            <dt className="flex items-center gap-1 text-[10px] text-slate-400">
              <StarIcon className="size-3 text-amber-400" aria-hidden="true" />
              <span>Stars</span>
            </dt>
            <dd className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
              {repo.starsCount}
            </dd>
          </div>
          <div className="rounded-md border border-slate-800 bg-[#161b22] px-3 py-2">
            <dt className="flex items-center gap-1 text-[10px] text-slate-400">
              <GitForkIcon className="size-3 text-sky-400" aria-hidden="true" />
              <span>Forks</span>
            </dt>
            <dd className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
              {repo.forksCount}
            </dd>
          </div>
          <div className="rounded-md border border-slate-800 bg-[#161b22] px-3 py-2">
            <dt className="flex items-center gap-1 text-[10px] text-slate-400">
              <EyeIcon className="size-3 text-violet-400" aria-hidden="true" />
              <span>Watchers</span>
            </dt>
            <dd className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
              {repo.watchersCount}
            </dd>
          </div>
          <div className="rounded-md border border-slate-800 bg-[#161b22] px-3 py-2">
            <dt className="flex items-center gap-1 text-[10px] text-slate-400">
              <CircleAlertIcon className="size-3 text-emerald-400" aria-hidden="true" />
              <span>Issues</span>
            </dt>
            <dd className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
              {repo.openIssuesCount}
            </dd>
          </div>
          <div className="col-span-2 rounded-md border border-slate-800 bg-[#161b22] px-3 py-2 sm:col-span-1">
            <dt className="flex items-center gap-1 text-[10px] text-slate-400">
              <GitBranchIcon className="size-3 text-cyan-400" aria-hidden="true" />
              <span>Branch</span>
            </dt>
            <dd className="mt-0.5 font-mono text-sm font-semibold text-cyan-300">
              {repo.defaultBranch}
            </dd>
          </div>
        </dl>

        <section className="rounded-md border border-slate-800 bg-[#161b22] p-3">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
            <span>Komposisi Bahasa Kode</span>
            <span className="font-mono text-[10px] text-slate-400">
              Push terakhir: {formatShortDate(repo.pushedAtIso)}
            </span>
          </div>
          <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-slate-800">
            {repo.languages.map((lang) => (
              <span
                key={lang.name}
                style={{ width: `${lang.percentage}%`, backgroundColor: lang.colorHex }}
                title={`${lang.name}: ${lang.percentage}%`}
              />
            ))}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-300">
            {repo.languages.map((lang) => (
              <li key={lang.name} className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full"
                  style={{ backgroundColor: lang.colorHex }}
                />
                <span>{lang.name}</span>
                <span className="font-mono text-slate-400 tabular-nums">{lang.percentage}%</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="overflow-hidden rounded-md border border-slate-800 bg-[#161b22]">
            <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2 text-xs font-semibold text-slate-200">
              <span>Struktur Direktori Root ({repo.defaultBranch})</span>
              <span className="font-mono text-[10px] text-slate-400">
                {repo.rootTree.length} entri
              </span>
            </div>
            <ul className="divide-y divide-slate-800/80 text-xs">
              {repo.rootTree.map((entry) => (
                <li key={entry.path}>
                  <a
                    href={entry.htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between px-3 py-1.5 transition-colors hover:bg-slate-800/60"
                  >
                    <span className="flex items-center gap-2 font-mono text-[11px]">
                      {entry.type === "dir" ? (
                        <FolderIcon className="size-3.5 text-sky-400" aria-hidden="true" />
                      ) : (
                        <FileCodeIcon className="size-3.5 text-slate-400" aria-hidden="true" />
                      )}
                      <span className={entry.type === "dir" ? "text-slate-100" : "text-slate-300"}>
                        {entry.name}
                      </span>
                    </span>
                    <ExternalLinkIcon className="size-3 text-slate-500" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </section>

          <div className="flex flex-col gap-4">
            <section className="overflow-hidden rounded-md border border-slate-800 bg-[#161b22]">
              <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2 text-xs font-semibold text-slate-200">
                <span className="flex items-center gap-1.5">
                  <GitCommitHorizontalIcon className="size-3.5 text-cyan-400" aria-hidden="true" />
                  <span>5 Commit Terbaru</span>
                </span>
                <a
                  href={`${repo.htmlUrl}/commits/${repo.defaultBranch}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-sky-400 hover:underline"
                >
                  Semua commit ↗
                </a>
              </div>
              <ul className="divide-y divide-slate-800/80 text-xs">
                {repo.recentCommits.map((commit) => (
                  <li key={`${commit.shaShort}-${commit.committedAtIso}`} className="px-3 py-2">
                    <a
                      href={commit.htmlUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block transition-colors hover:text-cyan-300"
                    >
                      <p className="line-clamp-1 font-medium text-slate-200">
                        {commit.messageHeadline}
                      </p>
                      <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-slate-400">
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-cyan-300">
                          {commit.shaShort}
                        </span>
                        <span>
                          {commit.authorName} · {formatShortDate(commit.committedAtIso)}
                        </span>
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-md border border-slate-800 bg-[#161b22] p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                <ShieldCheckIcon className="size-3.5 text-emerald-400" aria-hidden="true" />
                <span>Quick Start Lokal (Bun v1.4.4 + Rust WASM)</span>
              </div>
              <pre className="mt-2 overflow-x-auto rounded bg-[#0d1117] p-2.5 font-mono text-[11px] leading-relaxed text-cyan-200">
                {`git clone ${repo.htmlUrl}.git\ncd ${repo.name}\nbun install && bun run wasm:build && bun run dev`}
              </pre>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
