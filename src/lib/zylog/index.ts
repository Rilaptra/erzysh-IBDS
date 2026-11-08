/**
 * @file index.ts
 * @description High-performance terminal logger (ZyLog) built on @rilaptra/tui and Bun native APIs.
 * Provides scoped logging, caller detection, and progress bar rendering in WIB (Asia/Jakarta) timezone.
 */

import { c } from "@rilaptra/tui";

export type LogType = "info" | "error" | "warn" | "success" | "debug" | "cmd";

export interface ProgressOptions {
  readonly current: number;
  readonly total: number;
  readonly startAt: number;
  readonly title?: string;
  readonly length?: number;
}

export interface LogConfig {
  readonly scope?: string;
  readonly noContext?: boolean;
}

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Jakarta",
});

const COLORS: Record<LogType, (text: string) => string> = {
  info: c.cyan,
  error: c.red,
  warn: c.yellow,
  success: c.green,
  debug: c.cyanDim,
  cmd: c.cyanBold,
};

const LABELS: Record<LogType, string> = {
  info: COLORS.info("INFO"),
  error: COLORS.error("ERROR"),
  warn: COLORS.warn("WARN"),
  success: COLORS.success("SUCCESS"),
  debug: COLORS.debug("DEBUG"),
  cmd: COLORS.cmd("CMD"),
};

/**
 * Detects the calling function name using a bounded V8/Bun stack trace capture.
 * @returns Resolved caller function name or "SYSTEM".
 */
function getCaller(): string {
  const oldStackTraceLimit = Error.stackTraceLimit;
  Error.stackTraceLimit = 4;

  const holder: { stack?: string } = {};
  if (typeof Error.captureStackTrace === "function") {
    Error.captureStackTrace(holder, getCaller);
  }
  const stack = holder.stack;
  Error.stackTraceLimit = oldStackTraceLimit;

  if (!stack) return "SYSTEM";

  const lines = stack.split("\n");
  const callerLine = lines[3] ?? "";
  const match = /at\s+(?:async\s+)?([^\s(]+)/.exec(callerLine);

  if (match?.[1]) {
    const name = match[1].split(".").pop();
    return !name || name === "Object" || name === "<anonymous>" || name.includes("ts:")
      ? "SYSTEM"
      : name;
  }
  return "SYSTEM";
}

/**
 * Structured logger class for CLI scripts and DevOps pipelines.
 */
export class ZyLog {
  private readonly config: LogConfig;

  constructor(config: LogConfig = {}) {
    this.config = config;
  }

  /**
   * Dispatches a formatted log entry to stdout.
   * @param type Log severity type.
   * @param message Array of message items to format.
   * @param progress Optional progress bar configuration.
   */
  private dispatch(type: LogType, message: unknown[], progress?: ProgressOptions): void {
    const time = timeFormatter.format(Date.now());
    const prefix = `[${LABELS[type]}] ${c.gray(time)}`;

    let contextStr = "";
    if (!this.config.noContext) {
      const contextRaw = this.config.scope ?? getCaller();
      contextStr = this.config.scope
        ? c.greenBold(`[${contextRaw}]`)
        : c.cyanBold(`[${contextRaw}]`);
    }

    let logBody = "";

    if (progress) {
      const { current, total, startAt, title = "Task", length = 20 } = progress;
      const ratio = Math.min(1, Math.max(0, total > 0 ? current / total : 0));
      const filled = (length * ratio) | 0;

      const elapsedMs = Date.now() - startAt;
      const totalSec = (elapsedMs / 1000) | 0;
      const h = ((totalSec / 3600) | 0).toString().padStart(2, "0");
      const m = (((totalSec % 3600) / 60) | 0).toString().padStart(2, "0");
      const s = (totalSec % 60).toString().padStart(2, "0");

      const isDone = ratio >= 1;
      const colorFn = isDone ? c.green : COLORS[type];
      const bar = colorFn("━".repeat(filled)) + c.gray("━".repeat(length - filled));
      const percent = `${((ratio * 100) | 0).toString().padStart(3)}%`;

      logBody = `Processing ${c.yellow(title)} ${bar} ${colorFn(percent)} ${c.cyan(`[${h}:${m}:${s}]`)}`;
    } else {
      logBody =
        message.length === 1
          ? String(message[0])
          : message.map((m) => (typeof m === "object" ? JSON.stringify(m) : String(m))).join(" ");
    }

    const output = contextStr ? `${prefix} ${contextStr} ${logBody}` : `${prefix} ${logBody}`;
    console.log(output);
  }

  /** Logs an informational message. */
  public info(...message: unknown[]): void {
    this.dispatch("info", message);
  }

  /** Logs a success confirmation message. */
  public success(...message: unknown[]): void {
    this.dispatch("success", message);
  }

  /** Logs a warning message. */
  public warn(...message: unknown[]): void {
    this.dispatch("warn", message);
  }

  /** Logs an error message. */
  public error(...message: unknown[]): void {
    this.dispatch("error", message);
  }

  /** Logs a debug message. */
  public debug(...message: unknown[]): void {
    this.dispatch("debug", message);
  }

  /** Logs an executed shell command. */
  public cmd(...message: unknown[]): void {
    this.dispatch("cmd", message);
  }

  /** Renders a terminal progress bar. */
  public progress(options: ProgressOptions): void {
    this.dispatch("info", [], options);
  }

  /**
   * Creates a new ZyLog instance bound to a specific scope name.
   * @param scope Scope identifier displayed in brackets.
   * @returns Scoped ZyLog instance.
   * @example const log = ZyLog.withScope("RELEASE");
   */
  public static withScope(scope: string): ZyLog {
    return new ZyLog({ scope });
  }
}

export const zyLog = new ZyLog();
