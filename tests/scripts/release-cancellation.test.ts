/**
 * @file release-cancellation.test.ts
 * @description Unit and isolated temp-Git integration tests for graceful cancellation,
 * hotkey classification, subprocess termination, and atomic Git/file rollback in bun commit.
 */

import { describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { KeyPress } from "@rilaptra/tui";
import Bun from "bun";

import {
  CancellationController,
  isCancelKeyPress,
  isReleaseCancelledError,
  promptConfirm,
  promptSelect,
  ReleaseCancelledError,
  ReleaseTransaction,
  SIGNAL_EXIT_CODES,
  throwIfCancelled,
} from "../../scripts/lib/release-cancellation";
import { runVerification } from "../../scripts/verify";

function createTempGitRepo(): {
  dir: string;
  git: (args: string[]) => { ok: boolean; out: string; err: string };
  cleanup: () => void;
} {
  const dir = mkdtempSync(join(tmpdir(), "ibds-release-tx-"));
  const git = (args: string[]) => {
    const proc = Bun.spawnSync(["git", ...args], {
      cwd: dir,
      stdout: "pipe",
      stderr: "pipe",
    });
    return {
      ok: proc.exitCode === 0,
      out: proc.stdout.toString().trim(),
      err: proc.stderr.toString().trim(),
    };
  };

  git(["init"]);
  git(["config", "user.email", "test@ibds.local"]);
  git(["config", "user.name", "IBDS Tester"]);

  return {
    dir,
    git,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

function makeKey(overrides: Partial<KeyPress> = {}): KeyPress {
  return {
    name: "",
    ctrl: false,
    meta: false,
    sequence: "",
    ...overrides,
  };
}

describe("Release Cancellation & Safe Rollback", () => {
  describe("isCancelKeyPress", () => {
    it("recognizes all supported cancel hotkeys", () => {
      expect(isCancelKeyPress(makeKey({ ctrl: true, name: "c", sequence: "\x03" }))).toEqual({
        cancelled: true,
        label: "Ctrl+C",
      });
      expect(isCancelKeyPress(makeKey({ name: "escape", sequence: "\x1b" }))).toEqual({
        cancelled: true,
        label: "Esc",
      });
      expect(isCancelKeyPress(makeKey({ ctrl: true, name: "d", sequence: "\x04" }))).toEqual({
        cancelled: true,
        label: "Ctrl+D",
      });
      expect(isCancelKeyPress(makeKey({ ctrl: true, name: "z", sequence: "\x1a" }))).toEqual({
        cancelled: true,
        label: "Ctrl+Z",
      });
      expect(isCancelKeyPress(makeKey({ ctrl: true, name: "|", sequence: "\x1c" }))).toEqual({
        cancelled: true,
        label: "Ctrl+\\",
      });
      expect(isCancelKeyPress(makeKey({ ctrl: true, name: "\\", sequence: "\x1c" }))).toEqual({
        cancelled: true,
        label: "Ctrl+\\",
      });
      expect(isCancelKeyPress(makeKey({ ctrl: true, name: "q", sequence: "\x11" }))).toEqual({
        cancelled: true,
        label: "Ctrl+Q",
      });
      expect(isCancelKeyPress(makeKey({ name: "q", sequence: "q" }))).toEqual({
        cancelled: true,
        label: "Q",
      });
      expect(isCancelKeyPress(makeKey({ name: "Q", sequence: "Q" }))).toEqual({
        cancelled: true,
        label: "Q",
      });
    });

    it("does not misclassify navigation or confirmation keys as cancellation", () => {
      for (const key of [
        makeKey({ name: "y", sequence: "y" }),
        makeKey({ name: "n", sequence: "n" }),
        makeKey({ name: "return", sequence: "\r" }),
        makeKey({ name: "up", sequence: "\x1b[A" }),
        makeKey({ name: "down", sequence: "\x1b[B" }),
        makeKey({ name: "tab", sequence: "\t" }),
        makeKey({ name: "space", sequence: " " }),
        makeKey({ meta: true, name: "q", sequence: "\x1bq" }),
      ]) {
        expect(isCancelKeyPress(key)).toEqual({ cancelled: false, label: "" });
      }
    });
  });

  describe("ReleaseCancelledError & AbortSignal helpers", () => {
    it("maps OS signals and hotkeys to standard POSIX exit codes", () => {
      expect(SIGNAL_EXIT_CODES.SIGINT).toBe(130);
      expect(SIGNAL_EXIT_CODES.SIGBREAK).toBe(130);
      expect(SIGNAL_EXIT_CODES.HOTKEY).toBe(130);
      expect(SIGNAL_EXIT_CODES.USER).toBe(130);
      expect(SIGNAL_EXIT_CODES.SIGQUIT).toBe(131);
      expect(SIGNAL_EXIT_CODES.SIGTERM).toBe(143);
      expect(SIGNAL_EXIT_CODES.SIGHUP).toBe(129);

      const err = new ReleaseCancelledError("SIGTERM", "SIGTERM");
      expect(err.name).toBe("ReleaseCancelledError");
      expect(err.source).toBe("SIGTERM");
      expect(err.exitCode).toBe(143);
    });

    it("detects cancellation errors including AbortError", () => {
      expect(isReleaseCancelledError(new ReleaseCancelledError("SIGINT"))).toBe(true);
      expect(isReleaseCancelledError(new DOMException("Aborted", "AbortError"))).toBe(true);
      expect(isReleaseCancelledError(new Error("Generic error"))).toBe(false);
      expect(isReleaseCancelledError("string error")).toBe(false);
    });

    it("throwIfCancelled propagates ReleaseCancelledError or wraps generic abort reason", () => {
      const ac1 = new AbortController();
      const custom = new ReleaseCancelledError("HOTKEY", "Esc");
      ac1.abort(custom);
      expect(() => throwIfCancelled(ac1.signal)).toThrow(custom);

      const ac2 = new AbortController();
      ac2.abort("manual");
      try {
        throwIfCancelled(ac2.signal);
        expect.unreachable("Expected throwIfCancelled to throw");
      } catch (err) {
        expect(isReleaseCancelledError(err)).toBe(true);
        expect((err as ReleaseCancelledError).source).toBe("USER");
      }
    });

    it("rejects immediately in runVerification, promptConfirm, and promptSelect when signal is aborted", async () => {
      const ac = new AbortController();
      ac.abort(new ReleaseCancelledError("HOTKEY", "Esc"));

      await expect(runVerification({ signal: ac.signal })).rejects.toBeInstanceOf(
        ReleaseCancelledError,
      );
      await expect(
        promptConfirm({ title: "Confirm test", initialValue: true, signal: ac.signal }),
      ).rejects.toBeInstanceOf(ReleaseCancelledError);
      await expect(
        promptSelect({
          title: "Select test",
          options: [{ label: "A", value: "a" }],
          signal: ac.signal,
        }),
      ).rejects.toBeInstanceOf(ReleaseCancelledError);
    });
  });

  describe("CancellationController subprocess tracking", () => {
    it("terminates a tracked Bun subprocess cleanly when aborted", async () => {
      const ctrl = new CancellationController();
      const proc = Bun.spawn([process.execPath, "-e", "await Bun.sleep(10000)"], {
        stdin: "ignore",
        stdout: "ignore",
        stderr: "ignore",
      });

      const untrack = ctrl.trackProcess(proc);
      const startedAt = Date.now();

      try {
        ctrl.controller.abort(new ReleaseCancelledError("SIGINT", "SIGINT"));
        await ctrl.waitForActiveProcesses(2000);
        const elapsedMs = Date.now() - startedAt;

        expect(proc.killed || proc.exitCode !== null).toBe(true);
        const exitResult = await Promise.race([proc.exited, Bun.sleep(100).then(() => -1)]);
        expect(exitResult).not.toBe(-1);
        expect(elapsedMs).toBeLessThan(2000);
      } finally {
        untrack();
        if (proc.exitCode === null && !proc.killed) {
          proc.kill("SIGKILL");
        }
      }
    });
  });

  describe("ReleaseTransaction Git & file rollback", () => {
    it("restores exact git status after git add -N . with staged, unstaged, and untracked files", async () => {
      const repo = createTempGitRepo();
      try {
        writeFileSync(join(repo.dir, "unstaged.txt"), "v1\n");
        writeFileSync(join(repo.dir, "staged.txt"), "v1\n");
        repo.git(["add", "."]);
        repo.git(["commit", "-m", "chore: initial commit"]);

        writeFileSync(join(repo.dir, "unstaged.txt"), "v2-unstaged\n");
        writeFileSync(join(repo.dir, "staged.txt"), "v2-staged\n");
        repo.git(["add", "staged.txt"]);
        writeFileSync(join(repo.dir, "brand-new.txt"), "keep-me\n");

        const statusBefore = repo.git(["status", "--short"]).out;

        const tx = new ReleaseTransaction(repo.dir);
        tx.captureGitSnapshot();
        tx.markIndexTouched();
        repo.git(["add", "-N", "."]);

        const report = await tx.rollback();
        const statusAfter = repo.git(["status", "--short"]).out;

        expect(report.indexRestored).toBe(true);
        expect(report.commitReverted).toBe(false);
        expect(statusAfter).toBe(statusBefore);
        expect(readFileSync(join(repo.dir, "brand-new.txt"), "utf8")).toBe("keep-me\n");
      } finally {
        repo.cleanup();
      }
    }, 15_000);

    it("restores modified tracked files and removes newly created files on rollback", async () => {
      const repo = createTempGitRepo();
      try {
        const pkgPath = join(repo.dir, "package.json");
        const newChangelogPath = join(repo.dir, "CHANGELOG.md");

        writeFileSync(pkgPath, '{\n  "version": "1.0.0"\n}\n');
        repo.git(["add", "."]);
        repo.git(["commit", "-m", "chore: initial commit"]);

        const tx = new ReleaseTransaction(repo.dir);
        tx.captureGitSnapshot();
        await tx.backupFiles([pkgPath, newChangelogPath]);

        tx.markFileModified(pkgPath);
        writeFileSync(pkgPath, '{\n  "version": "1.0.1"\n}\n');

        tx.markFileModified(newChangelogPath);
        writeFileSync(newChangelogPath, "# Changelog\n\n## [1.0.1]\n");

        const report = await tx.rollback();

        expect(readFileSync(pkgPath, "utf8")).toBe('{\n  "version": "1.0.0"\n}\n');
        expect(existsSync(newChangelogPath)).toBe(false);
        expect(report.filesRestored).toContain("package.json");
        expect(report.filesDeleted).toContain("CHANGELOG.md");
      } finally {
        repo.cleanup();
      }
    }, 15_000);

    it("soft-resets local commit, deletes new tag, restores index, and reverts config files before push", async () => {
      const repo = createTempGitRepo();
      try {
        const pkgPath = join(repo.dir, "package.json");
        const featurePath = join(repo.dir, "feature.ts");

        writeFileSync(pkgPath, '{\n  "version": "1.0.0"\n}\n');
        repo.git(["add", "."]);
        repo.git(["commit", "-m", "chore: initial commit"]);
        const initialHead = repo.git(["rev-parse", "HEAD"]).out;

        // Pre-release developer work (untracked new file)
        writeFileSync(featurePath, "export const x = 1;\n");
        const statusBefore = repo.git(["status", "--short"]).out;

        const tx = new ReleaseTransaction(repo.dir);
        tx.captureGitSnapshot();
        tx.markIndexTouched();
        repo.git(["add", "-N", "."]);

        await tx.backupFile(pkgPath);
        tx.markFileModified(pkgPath);
        writeFileSync(pkgPath, '{\n  "version": "1.0.1"\n}\n');

        repo.git(["add", "-A"]);
        repo.git(["commit", "-m", "feat: release v1.0.1"]);

        tx.recordTagBeforeCreate("web-v1.0.1");
        repo.git(["tag", "web-v1.0.1"]);

        const report = await tx.rollback();

        expect(report.commitReverted).toBe(true);
        expect(report.tagReverted).toBe("web-v1.0.1");
        expect(report.indexRestored).toBe(true);
        expect(report.filesRestored).toContain("package.json");
        expect(repo.git(["rev-parse", "HEAD"]).out).toBe(initialHead);
        expect(repo.git(["tag", "-l", "web-v1.0.1"]).out).toBe("");
        expect(repo.git(["status", "--short"]).out).toBe(statusBefore);
        expect(readFileSync(pkgPath, "utf8")).toBe('{\n  "version": "1.0.0"\n}\n');
      } finally {
        repo.cleanup();
      }
    }, 15_000);

    it("restores an overwritten existing tag back to its previous SHA", async () => {
      const repo = createTempGitRepo();
      try {
        writeFileSync(join(repo.dir, "file.txt"), "v1\n");
        repo.git(["add", "."]);
        repo.git(["commit", "-m", "chore: c1"]);
        const c1Sha = repo.git(["rev-parse", "HEAD"]).out;
        repo.git(["tag", "web-v1.0.0", c1Sha]);

        writeFileSync(join(repo.dir, "file.txt"), "v2\n");
        repo.git(["add", "."]);
        repo.git(["commit", "-m", "chore: c2"]);

        const tx = new ReleaseTransaction(repo.dir);
        tx.captureGitSnapshot();
        tx.recordTagBeforeCreate("web-v1.0.0");
        repo.git(["tag", "-d", "web-v1.0.0"]);
        repo.git(["tag", "web-v1.0.0"]);

        const report = await tx.rollback();

        expect(report.tagReverted).toBe("web-v1.0.0");
        expect(repo.git(["rev-parse", "refs/tags/web-v1.0.0"]).out).toBe(c1Sha);
      } finally {
        repo.cleanup();
      }
    }, 15_000);

    it("preserves commit, tag, and files when commit was already pushed to origin", async () => {
      const repo = createTempGitRepo();
      try {
        const pkgPath = join(repo.dir, "package.json");
        writeFileSync(pkgPath, '{\n  "version": "1.0.0"\n}\n');
        repo.git(["add", "."]);
        repo.git(["commit", "-m", "chore: initial commit"]);

        const tx = new ReleaseTransaction(repo.dir);
        tx.captureGitSnapshot();
        await tx.backupFile(pkgPath);
        tx.markFileModified(pkgPath);
        writeFileSync(pkgPath, '{\n  "version": "1.0.1"\n}\n');

        repo.git(["add", "-A"]);
        repo.git(["commit", "-m", "feat: pushed release"]);
        const pushedSha = repo.git(["rev-parse", "HEAD"]).out;
        tx.recordTagBeforeCreate("web-v1.0.1");
        repo.git(["tag", "web-v1.0.1"]);

        tx.markCommitPushed();

        const report = await tx.rollback();

        expect(report.commitAlreadyPushed).toBe(true);
        expect(report.commitReverted).toBe(false);
        expect(report.tagReverted).toBeNull();
        expect(repo.git(["rev-parse", "HEAD"]).out).toBe(pushedSha);
        expect(repo.git(["tag", "-l", "web-v1.0.1"]).out).toBe("web-v1.0.1");
        expect(readFileSync(pkgPath, "utf8")).toBe('{\n  "version": "1.0.1"\n}\n');
      } finally {
        repo.cleanup();
      }
    }, 15_000);

    it("is idempotent on repeated rollback calls", async () => {
      const repo = createTempGitRepo();
      try {
        const pkgPath = join(repo.dir, "package.json");
        writeFileSync(pkgPath, '{\n  "version": "1.0.0"\n}\n');
        repo.git(["add", "."]);
        repo.git(["commit", "-m", "chore: init"]);

        const tx = new ReleaseTransaction(repo.dir);
        tx.captureGitSnapshot();
        await tx.backupFile(pkgPath);
        tx.markFileModified(pkgPath);
        writeFileSync(pkgPath, '{\n  "version": "1.0.1"\n}\n');

        const first = await tx.rollback();
        const second = await tx.rollback();

        expect(first.filesRestored).toEqual(["package.json"]);
        expect(second.filesRestored).toEqual([]);
        expect(second.filesDeleted).toEqual([]);
        expect(second.commitReverted).toBe(false);
        expect(second.indexRestored).toBe(false);
      } finally {
        repo.cleanup();
      }
    }, 15_000);
  });
});
