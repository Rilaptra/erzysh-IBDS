/**
 * @file install-git-hooks.ts
 * @description Installs native Git hooks into .githooks/ without third-party dependencies (e.g. Husky).
 * Configures pre-commit (bun fmt --staged && bun check -b) and commit-msg (Conventional Commits validation).
 */

import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { $ } from "bun";

/**
 * Installs and configures Git hooks for the repository.
 * @returns Promise that resolves when configuration succeeds.
 * @throws {Error} If git is not installed or configuration fails.
 */
export async function installGitHooks(): Promise<void> {
  const rootDir = process.cwd();
  const hooksDir = join(rootDir, ".githooks");

  try {
    await mkdir(hooksDir, { recursive: true });

    const preCommitPath = join(hooksDir, "pre-commit");
    const commitMsgPath = join(hooksDir, "commit-msg");

    const preCommitScript = `#!/usr/bin/env sh
set -e
bun fmt --staged
bun check -b
`;

    const commitMsgScript = `#!/usr/bin/env sh
set -e
grep -Eq "^(feat|fix|perf|refactor|docs|test|chore)(\\([a-z0-9-]+\\))?: .+" "$1" || {
  echo "Error: Commit message must follow Conventional Commits format (e.g., feat(mechanics): add 3D solver)."
  exit 1
}
`;

    await Bun.write(preCommitPath, preCommitScript);
    await Bun.write(commitMsgPath, commitMsgScript);

    // Make scripts executable on Unix-like platforms
    if (process.platform !== "win32") {
      await $`chmod +x ${preCommitPath} ${commitMsgPath}`.quiet();
    }

    // Configure Git to use the repository .githooks directory
    await $`git config core.hooksPath .githooks`;

    console.log("✅ Native Bun git hooks successfully configured in .githooks/");
    console.log("   - .githooks/pre-commit  (runs bun fmt --staged && bun check -b)");
    console.log("   - .githooks/commit-msg  (validates Conventional Commits)");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to install Git hooks: ${message}`);
    process.exit(1);
  }
}

// Run installer if executed directly from CLI
if (import.meta.main) {
  await installGitHooks();
}
