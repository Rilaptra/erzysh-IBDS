/**
 * @file release-cancellation.ts
 * @description Graceful cancellation, hotkey/signal handling, subprocess tree termination,
 * cancel-aware TUI prompts, and atomic Git + file rollback transaction for IBDS release scripts.
 */

import { existsSync, unlinkSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { ANSI, c, type KeyPress, useInput, write } from "@rilaptra/tui";
import Bun from "bun";

export type CancelSignalName = "SIGINT" | "SIGTERM" | "SIGHUP" | "SIGBREAK" | "SIGQUIT";
export type CancelSource = CancelSignalName | "HOTKEY" | "USER";

export const SIGNAL_EXIT_CODES: Record<CancelSource, number> = {
  SIGINT: 130,
  SIGBREAK: 130,
  SIGQUIT: 131,
  SIGTERM: 143,
  SIGHUP: 129,
  HOTKEY: 130,
  USER: 130,
};

const HANDLED_SIGNALS: readonly CancelSignalName[] = [
  "SIGINT",
  "SIGBREAK",
  "SIGTERM",
  "SIGHUP",
  "SIGQUIT",
];

/**
 * Error thrown whenever a release or verification workflow is cancelled by user hotkey or OS signal.
 */
export class ReleaseCancelledError extends Error {
  public readonly source: CancelSource;
  public readonly exitCode: number;

  constructor(source: CancelSource = "USER", detail?: string) {
    const label = detail ? `${source}: ${detail}` : source;
    super(`Proses dibatalkan oleh pengguna (${label}).`);
    this.name = "ReleaseCancelledError";
    this.source = source;
    this.exitCode = SIGNAL_EXIT_CODES[source];
  }
}

/**
 * Type guard checking whether an unknown thrown value represents a user/signal cancellation.
 */
export function isReleaseCancelledError(error: unknown): error is ReleaseCancelledError {
  if (error instanceof ReleaseCancelledError) return true;
  if (error instanceof Error) {
    return error.name === "ReleaseCancelledError" || error.name === "AbortError";
  }
  return false;
}

/**
 * Throws a {@link ReleaseCancelledError} immediately if the given AbortSignal is already aborted.
 */
export function throwIfCancelled(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  if (isReleaseCancelledError(signal.reason)) {
    throw signal.reason;
  }
  throw new ReleaseCancelledError("USER", "aborted");
}

/**
 * Classifies whether a decoded TUI keypress is a cancel/abort hotkey.
 * Supports Ctrl+C, Esc, Ctrl+D, Ctrl+Z, Ctrl+\, Ctrl+Q, and Q.
 */
export function isCancelKeyPress(key: KeyPress): {
  readonly cancelled: boolean;
  readonly label: string;
} {
  if ((key.ctrl && key.name === "c") || key.sequence === "\x03") {
    return { cancelled: true, label: "Ctrl+C" };
  }
  if (key.name === "escape" || key.sequence === "\x1b") {
    return { cancelled: true, label: "Esc" };
  }
  if ((key.ctrl && key.name === "d") || key.sequence === "\x04") {
    return { cancelled: true, label: "Ctrl+D" };
  }
  if ((key.ctrl && key.name === "z") || key.sequence === "\x1a") {
    return { cancelled: true, label: "Ctrl+Z" };
  }
  if (key.sequence === "\x1c" || (key.ctrl && (key.name === "\\" || key.name === "|"))) {
    return { cancelled: true, label: "Ctrl+\\" };
  }
  if ((key.ctrl && key.name === "q") || key.sequence === "\x11") {
    return { cancelled: true, label: "Ctrl+Q" };
  }
  if (!key.ctrl && !key.meta && (key.name === "q" || key.name === "Q")) {
    return { cancelled: true, label: "Q" };
  }
  return { cancelled: false, label: "" };
}

export type ManagedSubprocess = Pick<
  ReturnType<typeof Bun.spawn>,
  "pid" | "exited" | "kill" | "killed" | "exitCode"
>;

/**
 * Restores terminal cursor visibility, ANSI reset attributes, and cooked stdin mode.
 */
export function restoreTerminalState(): void {
  try {
    write(`${ANSI.RESET}${ANSI.SHOW_CURSOR}`);
  } catch {
    // Ignore stdout write failures during shutdown
  }

  try {
    if (process.stdin.isTTY && typeof process.stdin.setRawMode === "function") {
      process.stdin.setRawMode(false);
    }
  } catch {
    // Ignore raw mode reset errors when stdin is closed
  }

  try {
    process.stdin.pause();
  } catch {
    // Ignore pause errors when stdin is unavailable
  }
}

export function isSubprocessExited(proc: ManagedSubprocess): boolean {
  return proc.exitCode !== null || proc.killed;
}

/**
 * Terminates an active subprocess (and on Windows force-kill, its entire child process tree).
 */
export function terminateSubprocess(proc: ManagedSubprocess, force = false): void {
  if (isSubprocessExited(proc)) return;

  try {
    proc.kill(force ? "SIGKILL" : "SIGTERM");
  } catch {
    // Process may have exited concurrently
  }

  if (force && process.platform === "win32" && typeof proc.pid === "number") {
    try {
      Bun.spawnSync(["taskkill", "/PID", String(proc.pid), "/T", "/F"], {
        stdout: "ignore",
        stderr: "ignore",
      });
    } catch {
      // Ignore taskkill errors when PID already exited
    }
  }
}

/**
 * Coordinates OS signal listeners, AbortController propagation, and tracked child process cleanup.
 */
export class CancellationController {
  public readonly controller = new AbortController();
  private readonly activeProcs = new Set<ManagedSubprocess>();
  private readonly signalHandlers = new Map<CancelSignalName, () => void>();
  private cancelCount = 0;
  private onBeforeAbort?: () => void;

  get signal(): AbortSignal {
    return this.controller.signal;
  }

  get isCancelled(): boolean {
    return this.controller.signal.aborted;
  }

  get reason(): ReleaseCancelledError | null {
    if (!this.controller.signal.aborted) return null;
    return isReleaseCancelledError(this.controller.signal.reason)
      ? this.controller.signal.reason
      : new ReleaseCancelledError("USER", "aborted");
  }

  /**
   * Registers process signal handlers idempotently.
   * First signal triggers graceful abort; second signal force-kills subprocesses and exits.
   */
  public install(opts?: { onBeforeAbort?: () => void }): void {
    if (opts?.onBeforeAbort) {
      this.onBeforeAbort = opts.onBeforeAbort;
    }
    if (this.signalHandlers.size > 0) return;

    for (const sig of HANDLED_SIGNALS) {
      const handler = () => {
        this.cancelCount++;
        if (this.cancelCount === 1) {
          try {
            this.onBeforeAbort?.();
          } catch {
            // Ignore UI cleanup failures during interrupt
          }
          write(
            `\n${c.yellowBold(`⚠ Sinyal ${sig} diterima — membatalkan proses dengan aman...`)}\n${c.dim("  (Tekan Ctrl+C lagi untuk paksa berhenti segera)")}\n`,
          );
          if (!this.controller.signal.aborted) {
            this.controller.abort(new ReleaseCancelledError(sig, sig));
          }
          for (const proc of this.activeProcs) {
            terminateSubprocess(proc, false);
          }
          return;
        }

        write(`\n${c.redBold("⛔ Force exit diminta — menghentikan proses sekarang.")}\n`);
        restoreTerminalState();
        for (const proc of this.activeProcs) {
          terminateSubprocess(proc, true);
        }
        process.exit(SIGNAL_EXIT_CODES[sig]);
      };

      try {
        process.on(sig, handler);
        this.signalHandlers.set(sig, handler);
      } catch {
        // Signal not supported on current platform/runtime
      }
    }
  }

  /**
   * Detaches all registered OS signal listeners.
   */
  public uninstall(): void {
    for (const [sig, handler] of this.signalHandlers) {
      try {
        process.off(sig, handler);
      } catch {
        // Ignore removal errors
      }
    }
    this.signalHandlers.clear();
  }

  /**
   * Tracks a spawned subprocess so cancellation automatically terminates it.
   * @returns Cleanup function to call once the subprocess finishes.
   */
  public trackProcess(proc: ManagedSubprocess): () => void {
    this.activeProcs.add(proc);
    let forceTimer: ReturnType<typeof setTimeout> | null = null;
    const onAbort = () => {
      terminateSubprocess(proc, false);
      if (!isSubprocessExited(proc) && !forceTimer) {
        forceTimer = setTimeout(() => terminateSubprocess(proc, true), 1200);
      }
    };

    if (this.signal.aborted) {
      onAbort();
    } else {
      this.signal.addEventListener("abort", onAbort, { once: true });
    }

    return () => {
      if (forceTimer) {
        clearTimeout(forceTimer);
        forceTimer = null;
      }
      this.activeProcs.delete(proc);
      this.signal.removeEventListener("abort", onAbort);
    };
  }

  /**
   * Gracefully terminates all tracked child processes, escalating to force-kill after timeoutMs.
   */
  public async waitForActiveProcesses(timeoutMs = 2000): Promise<void> {
    const procs = [...this.activeProcs];
    if (procs.length === 0) return;

    for (const proc of procs) {
      if (!isSubprocessExited(proc)) {
        terminateSubprocess(proc, false);
      }
    }

    const exitedSet = new Set<ManagedSubprocess>();
    await Promise.race([
      Promise.allSettled(
        procs.map(async (p) => {
          await p.exited;
          exitedSet.add(p);
        }),
      ),
      Bun.sleep(timeoutMs),
    ]);

    const stillAlive = procs.filter((p) => !exitedSet.has(p) && !isSubprocessExited(p));
    if (stillAlive.length > 0) {
      for (const proc of stillAlive) {
        terminateSubprocess(proc, true);
      }
      await Promise.race([Promise.allSettled(stillAlive.map((p) => p.exited)), Bun.sleep(600)]);
    }

    this.activeProcs.clear();
  }
}

export interface ConfirmPromptOptions {
  readonly title: string;
  readonly initialValue?: boolean;
  readonly signal?: AbortSignal;
}

/**
 * Interactive Yes/No confirmation prompt that rejects cleanly with {@link ReleaseCancelledError}
 * instead of calling `process.exit(0)` on Ctrl+C / Esc / Ctrl+D / Ctrl+Z / Ctrl+\ / Ctrl+Q / Q.
 */
export async function promptConfirm(opts: ConfirmPromptOptions): Promise<boolean> {
  throwIfCancelled(opts.signal);

  let value = opts.initialValue ?? false;
  write(ANSI.HIDE_CURSOR);

  const render = () => {
    write(ANSI.CLEAR_LINE);
    const qMark = c.cyan("? ");
    const title = c.bold(opts.title);
    const yesLabel = value ? c.bgGreen(" Yes ") : c.dim(" Yes ");
    const noLabel = !value ? c.bgRed(" No ") : c.dim(" No ");
    const hint = c.dim("(Esc/Ctrl+C/Q: batal)");
    write(`${qMark}${title}  ${yesLabel}  ${noLabel}  ${hint}`);
  };

  render();

  return new Promise<boolean>((resolvePromise, rejectPromise) => {
    let settled = false;
    let cleanupInput: (() => void) | null = null;

    const finish = () => {
      if (settled) return false;
      settled = true;
      cleanupInput?.();
      cleanupInput = null;
      opts.signal?.removeEventListener("abort", onAbort);
      return true;
    };

    const onAbort = () => {
      if (!finish()) return;
      write(`\n${ANSI.SHOW_CURSOR}`);
      const err = isReleaseCancelledError(opts.signal?.reason)
        ? opts.signal.reason
        : new ReleaseCancelledError("USER", "aborted");
      rejectPromise(err);
    };

    opts.signal?.addEventListener("abort", onAbort, { once: true });

    cleanupInput = useInput((key) => {
      if (settled) return;

      const cancel = isCancelKeyPress(key);
      if (cancel.cancelled) {
        if (!finish()) return;
        write(
          `${ANSI.CLEAR_LINE}${c.yellow("✕ ")} ${c.bold(opts.title)} ${c.yellow(`Dibatalkan (${cancel.label})`)}\n${ANSI.SHOW_CURSOR}`,
        );
        rejectPromise(new ReleaseCancelledError("HOTKEY", cancel.label));
        return;
      }

      switch (key.name) {
        case "left":
        case "right":
        case "tab":
          value = !value;
          render();
          break;
        case "y":
        case "Y":
          value = true;
          render();
          break;
        case "n":
        case "N":
          value = false;
          render();
          break;
        case "return": {
          if (!finish()) return;
          write(ANSI.CLEAR_LINE);
          const finalRes = value ? c.green("Yes") : c.red("No");
          write(`${c.cyan("? ")} ${c.bold(opts.title)} ${finalRes}\n`);
          write(ANSI.SHOW_CURSOR);
          resolvePromise(value);
          break;
        }
      }
    });
  });
}

export interface SelectPromptOption<T> {
  readonly label: string;
  readonly value: T;
  readonly desc?: string;
}

export interface SelectPromptOptions<T> {
  readonly title: string;
  readonly options: readonly SelectPromptOption<T>[];
  readonly pageSize?: number;
  readonly signal?: AbortSignal;
}

/**
 * Paginated interactive single-select prompt that rejects cleanly with {@link ReleaseCancelledError}
 * on any cancel hotkey or AbortSignal cancellation.
 */
export async function promptSelect<T>(opts: SelectPromptOptions<T>): Promise<T> {
  throwIfCancelled(opts.signal);
  if (opts.options.length === 0) {
    throw new Error("promptSelect: options tidak boleh kosong.");
  }

  const pageSize = Math.max(1, Math.min(opts.pageSize ?? 10, opts.options.length));
  const totalRows = opts.options.length;
  let selectedIndex = 0;
  let scrollOffset = 0;
  let isFirstRender = true;

  write(ANSI.HIDE_CURSOR);

  const render = () => {
    if (selectedIndex < scrollOffset) {
      scrollOffset = selectedIndex;
    } else if (selectedIndex >= scrollOffset + pageSize) {
      scrollOffset = selectedIndex - pageSize + 1;
    }
    scrollOffset = Math.max(0, Math.min(scrollOffset, Math.max(0, totalRows - pageSize)));

    const heightToClear = pageSize + 2;
    if (!isFirstRender) {
      write(`\x1B[${heightToClear}A`);
    }

    const progressStr =
      totalRows > pageSize
        ? c.dim(
            ` (${scrollOffset + 1}-${Math.min(scrollOffset + pageSize, totalRows)}/${totalRows})`,
          )
        : "";
    write(`${c.cyan("? ")} ${c.bold(opts.title)}${progressStr}\x1B[K\n`);

    for (let i = 0; i < pageSize; i++) {
      const idx = scrollOffset + i;
      const opt = opts.options[idx];
      let lineOutput = "";
      if (opt) {
        const isSelected = idx === selectedIndex;
        const pointer = isSelected ? c.cyan("❯") : " ";
        const marker = isSelected ? "●" : "○";
        const labelText = isSelected ? c.cyanBold(opt.label) : c.white(opt.label);
        const descText = opt.desc ? c.dim(` - ${opt.desc}`) : "";
        lineOutput = `${pointer} ${marker} ${labelText}${descText}`;
      } else {
        lineOutput = c.dim(" ");
      }
      write(` ${lineOutput}\x1B[K\n`);
    }

    write(
      `${c.dim("─".repeat(10))} ${c.dim("(↑/↓: pilih, Enter: ok, Esc/Ctrl+C/Q: batal)")}\x1B[K\n`,
    );
    isFirstRender = false;
  };

  render();

  return new Promise<T>((resolvePromise, rejectPromise) => {
    let settled = false;
    let cleanupInput: (() => void) | null = null;
    const heightToClear = pageSize + 2;

    const finish = () => {
      if (settled) return false;
      settled = true;
      cleanupInput?.();
      cleanupInput = null;
      opts.signal?.removeEventListener("abort", onAbort);
      return true;
    };

    const clearMenu = () => {
      if (!isFirstRender) {
        write(`\x1B[${heightToClear}A\x1B[0J`);
      }
    };

    const onAbort = () => {
      if (!finish()) return;
      clearMenu();
      write(
        `${c.yellow("✕ ")} ${c.bold(opts.title)} ${c.yellow("Dibatalkan")}\n${ANSI.SHOW_CURSOR}`,
      );
      const err = isReleaseCancelledError(opts.signal?.reason)
        ? opts.signal.reason
        : new ReleaseCancelledError("USER", "aborted");
      rejectPromise(err);
    };

    opts.signal?.addEventListener("abort", onAbort, { once: true });

    const move = (delta: number) => {
      selectedIndex = (((selectedIndex + delta) % totalRows) + totalRows) % totalRows;
    };

    cleanupInput = useInput((key) => {
      if (settled) return;

      const cancel = isCancelKeyPress(key);
      if (cancel.cancelled) {
        if (!finish()) return;
        clearMenu();
        write(
          `${c.yellow("✕ ")} ${c.bold(opts.title)} ${c.yellow(`Dibatalkan (${cancel.label})`)}\n${ANSI.SHOW_CURSOR}`,
        );
        rejectPromise(new ReleaseCancelledError("HOTKEY", cancel.label));
        return;
      }

      const prevIndex = selectedIndex;
      switch (key.name) {
        case "up":
        case "left":
          move(-1);
          break;
        case "down":
        case "right":
          move(1);
          break;
        case "pageup":
          move(-pageSize);
          break;
        case "pagedown":
          move(pageSize);
          break;
        case "home":
          selectedIndex = 0;
          break;
        case "end":
          selectedIndex = totalRows - 1;
          break;
        case "return": {
          const selected = opts.options[selectedIndex];
          if (!selected || !finish()) return;
          clearMenu();
          write(
            `${c.cyan("? ")} ${c.bold(opts.title)} ${c.green(`✔ ${selected.label}`)}\n${ANSI.SHOW_CURSOR}`,
          );
          resolvePromise(selected.value);
          return;
        }
      }

      if (prevIndex !== selectedIndex) {
        render();
      }
    });
  });
}

interface FileBackupRecord {
  readonly existed: boolean;
  readonly content: string | null;
}

export interface RollbackReport {
  readonly filesRestored: readonly string[];
  readonly filesDeleted: readonly string[];
  readonly indexRestored: boolean;
  readonly commitReverted: boolean;
  readonly tagReverted: string | null;
  readonly rebaseAborted: boolean;
  readonly commitAlreadyPushed: boolean;
  readonly warnings: readonly string[];
}

/**
 * Tracks pre-release Git state and file backups so cancelling or failing mid-pipeline
 * safely restores files, Git index, unpushed commits, local tags, and in-progress rebases.
 */
export class ReleaseTransaction {
  private initialHead: string | null = null;
  private initialIndexTree: string | null = null;
  private initialUntracked: string[] = [];
  private indexTouched = false;
  private rebaseStarted = false;
  private commitPushed = false;
  private tagPushed = false;
  private createdTag: { readonly name: string; readonly previousSha: string | null } | null = null;
  private readonly fileBackups = new Map<string, FileBackupRecord>();
  private readonly modifiedFiles = new Set<string>();
  private rolledBack = false;

  constructor(private readonly root: string) {}

  private git(args: string[]): {
    readonly success: boolean;
    readonly output: string;
    readonly error: string;
  } {
    const proc = Bun.spawnSync(["git", ...args], {
      cwd: this.root,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return {
      success: proc.exitCode === 0,
      output: proc.stdout.toString().trim(),
      error: proc.stderr.toString().trim(),
    };
  }

  private resolveGitPath(relPath: string): string {
    const res = this.git(["rev-parse", "--git-path", relPath]);
    if (res.success && res.output) {
      return resolve(this.root, res.output);
    }
    return join(this.root, ".git", relPath);
  }

  /**
   * Captures the current HEAD, staged index tree, and untracked files prior to any git staging.
   */
  public captureGitSnapshot(): void {
    const headRes = this.git(["rev-parse", "--verify", "HEAD"]);
    this.initialHead = headRes.success && headRes.output ? headRes.output : null;

    const treeRes = this.git(["write-tree"]);
    this.initialIndexTree = treeRes.success && treeRes.output ? treeRes.output : null;

    const untrackedProc = Bun.spawnSync(
      ["git", "ls-files", "--others", "--exclude-standard", "-z"],
      {
        cwd: this.root,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    if (untrackedProc.exitCode === 0) {
      this.initialUntracked = untrackedProc.stdout
        .toString()
        .split("\0")
        .filter((entry) => entry.length > 0);
    }
  }

  public markIndexTouched(): void {
    this.indexTouched = true;
  }

  public markRebaseStarted(): void {
    this.rebaseStarted = true;
  }

  public markCommitPushed(): void {
    this.commitPushed = true;
  }

  public markTagPushed(): void {
    this.tagPushed = true;
  }

  /**
   * Records whether a tag already existed before `git tag` creates/overwrites it.
   */
  public recordTagBeforeCreate(tagName: string): void {
    const res = this.git(["rev-parse", "--verify", `refs/tags/${tagName}`]);
    this.createdTag = {
      name: tagName,
      previousSha: res.success && res.output ? res.output : null,
    };
  }

  /**
   * Stores an in-memory snapshot of a file (idempotent per filePath).
   */
  public async backupFile(filePath: string): Promise<void> {
    if (this.fileBackups.has(filePath)) return;
    const file = Bun.file(filePath);
    if (await file.exists()) {
      this.fileBackups.set(filePath, {
        existed: true,
        content: await file.text(),
      });
    } else {
      this.fileBackups.set(filePath, {
        existed: false,
        content: null,
      });
    }
  }

  public markFileModified(filePath: string): void {
    this.modifiedFiles.add(filePath);
  }

  public async backupFiles(filePaths: readonly string[]): Promise<void> {
    for (const filePath of filePaths) {
      await this.backupFile(filePath);
    }
  }

  /**
   * Safely rolls back uncommitted/unpushed Git mutations and restores modified files.
   * Idempotent: subsequent calls return an empty report.
   */
  public async rollback(): Promise<RollbackReport> {
    if (this.rolledBack) {
      return {
        filesRestored: [],
        filesDeleted: [],
        indexRestored: false,
        commitReverted: false,
        tagReverted: null,
        rebaseAborted: false,
        commitAlreadyPushed: this.commitPushed,
        warnings: [],
      };
    }
    this.rolledBack = true;

    const filesRestored: string[] = [];
    const filesDeleted: string[] = [];
    const warnings: string[] = [];
    let indexRestored = false;
    let commitReverted = false;
    let tagReverted: string | null = null;
    let rebaseAborted = false;

    if (
      this.rebaseStarted &&
      (existsSync(this.resolveGitPath("rebase-merge")) ||
        existsSync(this.resolveGitPath("rebase-apply")))
    ) {
      const abortRes = this.git(["rebase", "--abort"]);
      if (abortRes.success) {
        rebaseAborted = true;
      } else {
        warnings.push(`Gagal menjalankan git rebase --abort: ${abortRes.error || abortRes.output}`);
      }
    }

    if (this.commitPushed) {
      return {
        filesRestored,
        filesDeleted,
        indexRestored,
        commitReverted,
        tagReverted,
        rebaseAborted,
        commitAlreadyPushed: true,
        warnings,
      };
    }

    const indexLockPath = this.resolveGitPath("index.lock");
    const lockDeadline = Date.now() + 1000;
    while (existsSync(indexLockPath) && Date.now() < lockDeadline) {
      await Bun.sleep(100);
    }

    const gitLocked = existsSync(indexLockPath);
    if (gitLocked) {
      warnings.push(
        "File .git/index.lock masih aktif; rollback index/commit Git dilewati demi keamanan.",
      );
    } else {
      if (this.createdTag && !this.tagPushed) {
        if (this.createdTag.previousSha) {
          const restoreTag = this.git([
            "tag",
            "-f",
            this.createdTag.name,
            this.createdTag.previousSha,
          ]);
          if (restoreTag.success) {
            tagReverted = this.createdTag.name;
          } else {
            warnings.push(`Gagal mengembalikan tag '${this.createdTag.name}': ${restoreTag.error}`);
          }
        } else {
          const existsTag = this.git(["tag", "-l", this.createdTag.name]);
          if (existsTag.success && existsTag.output) {
            const delTag = this.git(["tag", "-d", this.createdTag.name]);
            if (delTag.success) {
              tagReverted = this.createdTag.name;
            } else {
              warnings.push(`Gagal menghapus tag '${this.createdTag.name}': ${delTag.error}`);
            }
          }
        }
      }

      const currentHeadRes = this.git(["rev-parse", "--verify", "HEAD"]);
      const currentHead =
        currentHeadRes.success && currentHeadRes.output ? currentHeadRes.output : null;
      if (this.initialHead && currentHead && currentHead !== this.initialHead) {
        const resetRes = this.git(["reset", "--soft", this.initialHead]);
        if (resetRes.success) {
          commitReverted = true;
        } else {
          warnings.push(`Gagal soft-reset commit ke ${this.initialHead}: ${resetRes.error}`);
        }
      }

      if (this.indexTouched || commitReverted) {
        if (this.initialIndexTree) {
          const readTreeRes = this.git(["read-tree", this.initialIndexTree]);
          if (readTreeRes.success) {
            indexRestored = true;
          } else {
            warnings.push(`Gagal mengembalikan index Git (read-tree): ${readTreeRes.error}`);
          }
        } else if (this.initialUntracked.length > 0) {
          let resetAllOk = true;
          for (let i = 0; i < this.initialUntracked.length; i += 50) {
            const batch = this.initialUntracked.slice(i, i + 50);
            const resetRes = this.git(["reset", "--", ...batch]);
            if (!resetRes.success) {
              resetAllOk = false;
              warnings.push(`Gagal reset intent-to-add untracked files: ${resetRes.error}`);
              break;
            }
          }
          if (resetAllOk) {
            indexRestored = true;
          }
        }
      }
    }

    for (const filePath of this.modifiedFiles) {
      const backup = this.fileBackups.get(filePath);
      if (!backup) continue;
      const rel = relative(this.root, filePath).replaceAll("\\", "/") || filePath;

      if (backup.existed && backup.content !== null) {
        await Bun.write(filePath, backup.content);
        filesRestored.push(rel);
      } else if (!backup.existed && existsSync(filePath)) {
        try {
          unlinkSync(filePath);
          filesDeleted.push(rel);
        } catch (err) {
          warnings.push(
            `Gagal menghapus file baru '${rel}': ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }

    return {
      filesRestored,
      filesDeleted,
      indexRestored,
      commitReverted,
      tagReverted,
      rebaseAborted,
      commitAlreadyPushed: false,
      warnings,
    };
  }
}
