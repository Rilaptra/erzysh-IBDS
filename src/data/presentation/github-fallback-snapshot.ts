import { APP_VERSION, BUILD_DATE } from "@/config/version";
import type { GitHubRepoSnapshot } from "@/types/presentation-types";

export const GITHUB_REPO_OWNER = "Rilaptra";
export const GITHUB_REPO_NAME = "erzysh-IBDS";
export const GITHUB_REPO_URL = `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`;

export const GITHUB_REPO_FALLBACK_SNAPSHOT: GitHubRepoSnapshot = {
  owner: GITHUB_REPO_OWNER,
  name: GITHUB_REPO_NAME,
  fullName: `${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`,
  htmlUrl: GITHUB_REPO_URL,
  description:
    "Interactive 3D Beam Deflection & Structural Design Simulator (SNI 2847:2019 & SNI 1729:2020) powered by Next.js 16, Bun 1.4.4, and Rust WebAssembly.",
  defaultBranch: "main",
  licenseSpdx: "MIT",
  starsCount: 1,
  forksCount: 0,
  watchersCount: 1,
  openIssuesCount: 0,
  topics: [
    "civil-engineering",
    "structural-analysis",
    "rust-wasm",
    "nextjs",
    "bun",
    "sni-1729",
    "sni-2847",
    "webgl2",
  ],
  pushedAtIso: BUILD_DATE,
  languages: [
    { name: "TypeScript", bytes: 425000, percentage: 78.4, colorHex: "#3178c6" },
    { name: "Rust", bytes: 78000, percentage: 14.4, colorHex: "#dea584" },
    { name: "CSS", bytes: 24000, percentage: 4.4, colorHex: "#663399" },
    { name: "Other", bytes: 15000, percentage: 2.8, colorHex: "#64748b" },
  ],
  rootTree: [
    {
      name: ".github",
      path: ".github",
      type: "dir",
      htmlUrl: `${GITHUB_REPO_URL}/tree/main/.github`,
    },
    {
      name: "crates",
      path: "crates",
      type: "dir",
      htmlUrl: `${GITHUB_REPO_URL}/tree/main/crates`,
    },
    {
      name: "mdfiles",
      path: "mdfiles",
      type: "dir",
      htmlUrl: `${GITHUB_REPO_URL}/tree/main/mdfiles`,
    },
    {
      name: "prototype",
      path: "prototype",
      type: "dir",
      htmlUrl: `${GITHUB_REPO_URL}/tree/main/prototype`,
    },
    {
      name: "public",
      path: "public",
      type: "dir",
      htmlUrl: `${GITHUB_REPO_URL}/tree/main/public`,
    },
    {
      name: "scripts",
      path: "scripts",
      type: "dir",
      htmlUrl: `${GITHUB_REPO_URL}/tree/main/scripts`,
    },
    {
      name: "src",
      path: "src",
      type: "dir",
      htmlUrl: `${GITHUB_REPO_URL}/tree/main/src`,
    },
    {
      name: "tests",
      path: "tests",
      type: "dir",
      htmlUrl: `${GITHUB_REPO_URL}/tree/main/tests`,
    },
    {
      name: "CHANGELOG.md",
      path: "CHANGELOG.md",
      type: "file",
      htmlUrl: `${GITHUB_REPO_URL}/blob/main/CHANGELOG.md`,
    },
    {
      name: "LICENSE",
      path: "LICENSE",
      type: "file",
      htmlUrl: `${GITHUB_REPO_URL}/blob/main/LICENSE`,
    },
    {
      name: "README.md",
      path: "README.md",
      type: "file",
      htmlUrl: `${GITHUB_REPO_URL}/blob/main/README.md`,
    },
    {
      name: "USER_MANUAL.md",
      path: "USER_MANUAL.md",
      type: "file",
      htmlUrl: `${GITHUB_REPO_URL}/blob/main/USER_MANUAL.md`,
    },
    {
      name: "package.json",
      path: "package.json",
      type: "file",
      htmlUrl: `${GITHUB_REPO_URL}/blob/main/package.json`,
    },
  ],
  recentCommits: [
    {
      shaShort: "97a0514",
      messageHeadline: `feat(canvas): perspective-accurate 3D load vectors & smart badge stacking (v${APP_VERSION})`,
      authorName: "Rizqi Lasheva",
      committedAtIso: "2026-11-19T04:30:55Z",
      htmlUrl: `${GITHUB_REPO_URL}/commits/main`,
    },
    {
      shaShort: "8c2b10e",
      messageHeadline: "chore(deps): upgrade Next.js to v16.4.5 and refresh release pipeline",
      authorName: "Rizqi Lasheva",
      committedAtIso: "2026-11-19T02:15:00Z",
      htmlUrl: `${GITHUB_REPO_URL}/commits/main`,
    },
    {
      shaShort: "61f3a9d",
      messageHeadline: "feat(canvas): add LoadVisualization2DOverlay and dual +/- diagram colors",
      authorName: "Rizqi Lasheva",
      committedAtIso: "2026-11-15T14:20:00Z",
      htmlUrl: `${GITHUB_REPO_URL}/commits/main`,
    },
    {
      shaShort: "4d9e82b",
      messageHeadline: "feat(tutorial): launch 9-mission IBDS Engineer Quest with AI Ucuy",
      authorName: "Rizqi Lasheva",
      committedAtIso: "2026-11-15T09:10:00Z",
      htmlUrl: `${GITHUB_REPO_URL}/commits/main`,
    },
    {
      shaShort: "2a7c45f",
      messageHeadline: "feat(changelog): add dedicated /changelog explorer & What's New dialog",
      authorName: "Rizqi Lasheva",
      committedAtIso: "2026-11-14T16:40:00Z",
      htmlUrl: `${GITHUB_REPO_URL}/commits/main`,
    },
  ],
  fetchedAtIso: BUILD_DATE,
  dataSource: "static-fallback",
};
