/**
 * @file release.ts
 * @description Automated 8-stage release, versioning, verification, changelog, and git commit/push pipeline
 * for IBDS (Interactive 3D Beam Deflection & Structural Design Simulator).
 * Modeled after Erzy.sh automated release pipeline using @rilaptra/tui and Bun v1.4.4 native APIs.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { c, Confirm, Notification, Select, ToastBuilder, write } from "@rilaptra/tui";
import Bun from "bun";

import { getGeminiApiKeys } from "../src/config/app-config";
import { isQuotaOrAuthError, maskApiKey } from "../src/lib/gemini-api-failover";
import { ZyLog } from "../src/lib/zylog";
import { runVerification } from "./verify";

const log = ZyLog.withScope("RELEASE");

const CONVENTIONAL_COMMIT_REGEX = /^(feat|fix|perf|refactor|docs|test|chore)(\([a-z0-9-]+\))?: .+/;

/**
 * Resolves the Gemini API key from environment variables or local .env fallback files.
 * @returns API key string or undefined if not configured.
 */
function resolveApiKey(): string | undefined {
  const fromEnv =
    process.env.GEMINI_API_KEY ||
    process.env.AI_PROVIDER_API_KEY ||
    process.env.GEMINI_API_KEY_BACKUP ||
    process.env.GEMINI_API_KEYS ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (fromEnv?.trim()) {
    const firstKey = fromEnv.split(",")[0]?.trim();
    if (firstKey && firstKey !== "your_gemini_api_key_here") return firstKey;
  }

  const candidatePaths = [
    join(process.cwd(), ".env.local"),
    join(process.cwd(), ".env"),
    join(process.cwd(), "prototype", "voice-command", ".env"),
    "C:/SHEVA/Project/erzysh/.env.local",
  ];

  for (const p of candidatePaths) {
    if (existsSync(p)) {
      try {
        const content = readFileSync(p, "utf-8");
        const match = content.match(
          /^(?:GEMINI_API_KEY|AI_PROVIDER_API_KEY|GEMINI_API_KEY_BACKUP|GEMINI_API_KEYS|NEXT_PUBLIC_GEMINI_API_KEY)\s*=\s*["']?([^"',\r\n]+)/m,
        );
        if (match?.[1]?.trim() && match[1].trim() !== "your_gemini_api_key_here") {
          return match[1].trim();
        }
      } catch {
        // Ignore unreadable fallback files
      }
    }
  }
  return undefined;
}

/**
 * Ensures a commit message strictly conforms to the Conventional Commits format required by .githooks/commit-msg.
 * @param rawMsg Raw commit message from AI or fallback.
 * @param defaultScope Default scope if prefix is missing.
 * @returns Validated Conventional Commit message.
 */
function ensureConventionalCommit(rawMsg: string, defaultScope = "release"): string {
  const firstLine = (rawMsg.split(/\r?\n/)[0] ?? "").trim().replace(/^["'`]+|["'`]+$/g, "");
  if (CONVENTIONAL_COMMIT_REGEX.test(firstLine)) {
    return firstLine;
  }

  // Strip invalid prefixes and wrap in chore(scope): ...
  const cleaned = firstLine.replace(/^[a-zA-Z0-9_-]+(\([^)]*\))?:\s*/, "").trim();
  return `chore(${defaultScope}): ${cleaned || "update project files"}`;
}

// ============================================================================
// Native Bun Shell Helper
// ============================================================================

const Shell = {
  exec(cmd: string | string[], opts: { silent?: boolean; cwd?: string } = {}) {
    const cmdArr = Array.isArray(cmd) ? cmd : cmd.split(" ");
    const cmdStr = Array.isArray(cmd) ? cmd.join(" ") : cmd;
    if (!opts.silent) log.cmd(cmdStr);

    const proc = Bun.spawnSync(cmdArr, {
      cwd: opts.cwd || process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });

    const output = proc.stdout.toString().trim();
    const error = proc.stderr.toString().trim();
    return {
      success: proc.exitCode === 0,
      code: proc.exitCode,
      output,
      error,
    };
  },

  run(cmd: string | string[], opts: { silent?: boolean; cwd?: string } = {}) {
    const res = this.exec(cmd, opts);
    if (!res.success) {
      throw new Error(
        `Command failed: ${Array.isArray(cmd) ? cmd.join(" ") : cmd}\n${c.red(res.error || res.output)}`,
      );
    }
    return res.output;
  },

  async execAsync(cmd: string | string[], opts: { silent?: boolean; cwd?: string } = {}) {
    const cmdArr = Array.isArray(cmd) ? cmd : cmd.split(" ");
    const cmdStr = Array.isArray(cmd) ? cmd.join(" ") : cmd;
    if (!opts.silent) log.cmd(cmdStr);

    const proc = Bun.spawn(cmdArr, {
      cwd: opts.cwd || process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;
    const output = (await new Response(proc.stdout).text()).trim();
    const error = (await new Response(proc.stderr).text()).trim();

    return {
      success: exitCode === 0,
      code: exitCode,
      output,
      error,
    };
  },

  async runAsync(cmd: string | string[], opts: { silent?: boolean; cwd?: string } = {}) {
    const res = await this.execAsync(cmd, opts);
    if (!res.success) {
      throw new Error(
        `Command failed: ${Array.isArray(cmd) ? cmd.join(" ") : cmd}\n${c.red(res.error || res.output)}`,
      );
    }
    return res.output;
  },
};

// ============================================================================
// Fancy CLI UI Helpers
// ============================================================================

const ui = {
  spinnerInterval: null as ReturnType<typeof setInterval> | null,
  startSpinner(text: string) {
    const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    let i = 0;
    process.stdout.write(c.cyan(`  ⠋ ${text}`));
    this.spinnerInterval = setInterval(() => {
      process.stdout.write(`\r\x1b[2K${c.cyan(`  ${frames[i++ % frames.length]} ${text}`)}`);
    }, 80);
  },
  stopSpinner(success: boolean, text: string) {
    if (this.spinnerInterval) clearInterval(this.spinnerInterval);
    const icon = success ? c.green("✓") : c.red("✗");
    process.stdout.write(`\r\x1b[2K  ${icon} ${text}\n`);
  },
  step(num: number, total: number, title: string) {
    write(`\n${c.cyanBold(`▶ [STEP ${num}/${total}] ${title}`)}\n`);
    write(`${c.gray(`  ${"─".repeat(54)}`)}\n`);
  },
  info(msg: string) {
    log.info(msg);
  },
  success(msg: string) {
    log.success(msg);
  },
  warn(msg: string) {
    log.warn(msg);
  },
  error(msg: string) {
    log.error(msg);
  },
};

// ============================================================================
// AI Manager (Google Gemini API)
// ============================================================================

interface GeminiModelEntry {
  readonly name: string;
  readonly supportedGenerationMethods?: readonly string[];
}

interface AiReleaseDecision {
  readonly webVersion: string;
  readonly wasmVersion: string;
  readonly commitMessage: string;
  readonly changelog: string;
  readonly readmeBlocks: string;
}

const AIManager = {
  getApiKeys(): readonly string[] {
    const fromConfig = getGeminiApiKeys();
    if (fromConfig.length > 0) return fromConfig;
    const single = resolveApiKey();
    return single ? [single] : [];
  },
  MODEL: "gemini-3.5-flash-lite",
  availableModels: [] as string[],

  async fetchModels(): Promise<boolean> {
    const keys = this.getApiKeys();
    if (keys.length === 0) return false;

    ui.startSpinner("Fetching available Gemini models...");
    for (const key of keys) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models`, {
          headers: {
            "x-goog-api-key": key,
          },
        });
        if (!res.ok) {
          if (res.status === 429 || res.status === 400 || res.status === 403) {
            continue;
          }
          throw new Error(`HTTP ${res.status}`);
        }

        const data = (await res.json()) as { models?: GeminiModelEntry[] };
        this.availableModels = (data.models ?? [])
          .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
          .map((m) => m.name.replace("models/", ""));

        ui.stopSpinner(true, `Found ${this.availableModels.length} available Gemini models.`);
        return true;
      } catch {
        continue;
      }
    }
    ui.stopSpinner(false, "Failed to fetch models: all API keys failed or rate-limited.");
    return false;
  },

  async generateReleaseData(
    oldWebVer: string,
    oldWasmVer: string,
    diff: string,
  ): Promise<AiReleaseDecision> {
    const keys = this.getApiKeys();
    if (keys.length === 0) throw new Error("No GEMINI_API_KEY / AI_PROVIDER_API_KEY found.");

    const cleanDiff = diff.length > 30000 ? `${diff.substring(0, 30000)}\n... (truncated)` : diff;
    const today = new Date().toISOString().split("T")[0];

    const prompt = `
You are the DevOps Lead for "IBDS" (Interactive 3D Beam Deflection & Structural Design Simulator — SNI 2847:2019 & SNI 1729:2020).
Analyze these git diffs. The current Web version is ${oldWebVer} and Rust WASM Engine version is ${oldWasmVer}.

Rules:
1. If web/TypeScript/config/data code (src/, scripts/, tests/) changed, determine the next Web Semantic Version (e.g. patch bump for fixes/docs/chore, minor bump for new step/feature).
2. If Rust WASM code (crates/mechanics-3d-wasm/) changed, determine the next WASM Semantic Version. If unchanged, keep ${oldWasmVer}.
3. Write a concise CHANGELOG entry for this new version using "Keep a Changelog" format with emojis (e.g. ### ✨ Added, ### ⚡ Performance, ### 🛠️ Maintenance) dated ${today}.
4. Create a single-line Conventional Commit message strictly matching regex:
   ^(feat|fix|perf|refactor|docs|test|chore)(\\([a-z0-9-]+\\))?: .+
   Example valid messages:
   - "feat(data): add JIS G 3192 IWF and BOX primary catalogs with Bun macro"
   - "chore(ci): add automated release and verification pipeline"
5. DO NOT include the "# Changelog" main header in your changelog output, only the "## [x.y.z] - ${today}" block.

Respond ONLY with a valid JSON object:
{"webVersion": "x.y.z", "wasmVersion": "a.b.c", "commitMessage": "feat(scope): short summary", "changelog": "## [x.y.z] - ${today}\\n\\n### ✨ Added\\n- ...\\n", "readmeBlocks": ""}

Diffs:
${cleanDiff}
`.trim();

    let lastError: unknown = null;
    for (let keyIdx = 0; keyIdx < keys.length; keyIdx++) {
      const currentKey = keys[keyIdx]!;
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${this.MODEL}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": currentKey,
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.2 },
            }),
          },
        );

        if (!res.ok) {
          const errorBody = await res.text().catch(() => "");
          if (isQuotaOrAuthError(res.status, errorBody) && keyIdx + 1 < keys.length) {
            const nextKey = keys[keyIdx + 1]!;
            console.warn(
              `⚠️ [Release AI Failover] Kunci API (${maskApiKey(currentKey)}) terkena batas limit/error (HTTP ${res.status}). Mengalihkan ke kunci cadangan (${maskApiKey(nextKey)})...`,
            );
            continue;
          }
          throw new Error(`HTTP ${res.status}: ${errorBody}`);
        }

        const data = (await res.json()) as {
          error?: { message?: string };
          candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
        };
        if (data.error) {
          if (keyIdx + 1 < keys.length) {
            const nextKey = keys[keyIdx + 1]!;
            console.warn(
              `⚠️ [Release AI Failover] Error dari Gemini API (${maskApiKey(currentKey)}): ${data.error.message}. Mengalihkan ke kunci cadangan (${maskApiKey(nextKey)})...`,
            );
            continue;
          }
          throw new Error(data.error.message ?? "Gemini API error");
        }

        const parts = data.candidates?.[0]?.content?.parts ?? [];
        const nonThought = parts
          .filter((p) => !p.thought && typeof p.text === "string")
          .map((p) => p.text)
          .join("");
        const text = (
          nonThought.trim() ||
          parts
            .filter((p) => typeof p.text === "string")
            .map((p) => p.text)
            .join("")
        ).trim();

        const match = text.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("AI did not return valid JSON");

        const parsed = JSON.parse(match[0]) as Partial<AiReleaseDecision>;
        if (
          !parsed.webVersion ||
          !parsed.wasmVersion ||
          !parsed.changelog ||
          !parsed.commitMessage
        ) {
          throw new Error("Missing required fields in AI JSON response");
        }

        return {
          webVersion: parsed.webVersion,
          wasmVersion: parsed.wasmVersion,
          commitMessage: ensureConventionalCommit(parsed.commitMessage),
          changelog: `${parsed.changelog.trim()}\n\n`,
          readmeBlocks: typeof parsed.readmeBlocks === "string" ? parsed.readmeBlocks.trim() : "",
        };
      } catch (err) {
        lastError = err;
        if (keyIdx + 1 < keys.length) {
          const nextKey = keys[keyIdx + 1]!;
          console.warn(
            `⚠️ [Release AI Failover] Terjadi kendala pada kunci (${maskApiKey(currentKey)}). Mencoba kunci cadangan (${maskApiKey(nextKey)})...`,
          );
          continue;
        }
        throw err;
      }
    }

    throw lastError ?? new Error("All API keys failed in generateReleaseData");
  },
};

// ============================================================================
// Release Manager
// ============================================================================

class ReleaseManager {
  private readonly root = process.cwd();
  private readonly paths = {
    package: join(this.root, "package.json"),
    cargo: join(this.root, "crates", "mechanics-3d-wasm", "Cargo.toml"),
    changelog: join(this.root, "CHANGELOG.md"),
    versionTs: join(this.root, "src", "config", "version.ts"),
    readme: join(this.root, "README.md"),
    releaseTs: join(this.root, "scripts", "release.ts"),
  };

  private backups: Record<string, string> = {};

  private manualBump(oldVer: string): string {
    const parts = oldVer.split(".").map((n) => Number.parseInt(n, 10) || 0);
    while (parts.length < 3) parts.push(0);
    parts[2] = (parts[2] ?? 0) + 1;
    return parts.slice(0, 3).join(".");
  }

  private async pickModel(): Promise<string> {
    const select = new Select<string>().title("Pilih model AI Gemini:").pageSize(10);
    for (const model of AIManager.availableModels) {
      select.add(model === AIManager.MODEL ? `${model} (current)` : model, model);
    }
    return select.run();
  }

  private async persistDefaultModel(model: string): Promise<void> {
    const content = await Bun.file(this.paths.releaseTs).text();
    const updated = content.replace(/^(\s*MODEL:\s*")[^"]+(")/m, `$1${model}$2`);
    if (updated !== content) {
      await Bun.write(this.paths.releaseTs, updated);
      ui.success(`Default model disimpan permanen di scripts/release.ts: ${c.bold(model)}`);
    }
  }

  public async init(): Promise<void> {
    write(`\n${c.cyanBold("🚀 IBDS — ERZY.SH AUTOMATED COMMIT & RELEASE PIPELINE")}\n`);

    const isAutoYes =
      process.argv.includes("--yes") || process.argv.includes("-y") || !process.stdin.isTTY;
    const noPush = process.argv.includes("--no-push");
    const noTag = process.argv.includes("--no-tag");

    try {
      const currentBranch =
        Shell.exec("git rev-parse --abbrev-ref HEAD", { silent: true }).output || "flash";
      ui.info(`Active Branch: ${c.cyanBold(currentBranch)}`);

      // Stage intent-to-add for untracked files so git diff HEAD captures newly created files
      Shell.exec("git add -N .", { silent: true });

      // 1. Detect Changes & Build Options
      ui.step(1, 8, "Detect Changes & Build Options");
      const diff = Shell.exec("git diff HEAD", { silent: true }).output;

      if (!diff.trim()) {
        ui.warn("Tidak ada perubahan file yang belum di-commit (working tree clean).");
        if (!noPush) {
          const shouldPushOnly = isAutoYes
            ? true
            : await new Confirm({
                title: `Push branch '${currentBranch}' ke origin sekarang?`,
                initialValue: true,
              }).run();
          if (shouldPushOnly) {
            ui.startSpinner(`Pushing ${currentBranch} to origin...`);
            await this.smartPush(currentBranch);
            ui.stopSpinner(true, `Branch '${currentBranch}' berhasil di-push ke origin.`);
          }
        }
        return;
      }

      const hasCargo = await Bun.file(this.paths.cargo).exists();
      const webChanged = diff
        .split("\n")
        .some(
          (line) =>
            line.startsWith("diff --git a/src/") ||
            line.startsWith("diff --git a/scripts/") ||
            line.startsWith("diff --git a/tests/") ||
            line.startsWith("diff --git a/package.json"),
        );
      const rustChanged =
        hasCargo &&
        diff
          .split("\n")
          .some((line) => line.startsWith("diff --git a/crates/") && line.includes(".rs"));

      ui.info(
        `Perubahan terdeteksi: ${webChanged ? "🌐 Web/TS" : "📄 Docs/Config"} ${rustChanged ? "🦀 Rust WASM" : ""}`,
      );

      let buildWeb = false;
      const hasNextApp = existsSync(join(this.root, "src", "app"));
      if (webChanged && hasNextApp && !isAutoYes) {
        buildWeb = await new Confirm({
          title: "Ada perubahan di src/ — mau jalankan full build Next.js?",
          initialValue: false,
        }).run();
      }
      if (!buildWeb) {
        ui.info(
          "Full Next.js build di-skip (fmt + typecheck + catalog validation + unit tests tetap dijalankan).",
        );
      }

      let skipWasmBuild = true;
      if (rustChanged && !isAutoYes) {
        const buildRust = await new Confirm({
          title: "Ada perubahan di crates/mechanics-3d-wasm — mau build WASM sekarang?",
          initialValue: true,
        }).run();
        skipWasmBuild = !buildRust;
      }

      // 2. Code Verification Gate
      ui.step(
        2,
        8,
        `Code Verification (Fmt + TypeScript + Catalogs + Unit Tests${buildWeb ? " + Build" : ""})`,
      );
      const verified = await runVerification({ build: buildWeb });
      if (!verified) {
        throw new Error("Verifikasi kode gagal. Perbaiki error di atas sebelum commit/release.");
      }

      // 3. AI Model Setup
      ui.step(3, 8, "AI Model Configuration");
      let useAI = true;

      if (AIManager.getApiKeys().length > 0) {
        const modelsFetched = await AIManager.fetchModels();
        if (modelsFetched && AIManager.availableModels.length > 0) {
          if (AIManager.availableModels.includes(AIManager.MODEL)) {
            let keep = true;
            if (!isAutoYes) {
              keep = await new Confirm({
                title: `Tetap lanjut dengan model AI ${AIManager.MODEL}?`,
                initialValue: true,
              }).run();
            }
            if (!keep) {
              AIManager.MODEL = await this.pickModel();
              await this.persistDefaultModel(AIManager.MODEL);
            }
          } else {
            ui.warn(`Model default ${AIManager.MODEL} tidak tersedia — pilih pengganti.`);
            AIManager.MODEL = await this.pickModel();
            await this.persistDefaultModel(AIManager.MODEL);
          }
          ui.success(`Menggunakan model AI: ${c.bold(AIManager.MODEL)}`);
        } else {
          ui.warn(`Gagal mengambil daftar model, tetap menggunakan default (${AIManager.MODEL}).`);
        }
      } else {
        ui.warn("GEMINI_API_KEY / AI_PROVIDER_API_KEY tidak ditemukan. Mode AI dilewati.");
        useAI = false;
      }

      // 4. AI Versioning & Commit Message Execution
      ui.step(4, 8, "AI Version & Conventional Commit Analysis");
      const oldWebVer =
        (JSON.parse(await Bun.file(this.paths.package).text()) as { version?: string }).version ??
        "0.4.0";
      let oldWasmVer = oldWebVer;
      if (hasCargo) {
        const cargoMatch = (await Bun.file(this.paths.cargo).text()).match(
          /version\s*=\s*"([^"]+)"/,
        );
        if (cargoMatch?.[1]) oldWasmVer = cargoMatch[1];
      }

      let newWebVer = oldWebVer;
      let newWasmVer = oldWasmVer;
      let changelogEntry = "";
      let commitMsg = `chore(release): bump version to v${newWebVer}`;

      if (useAI) {
        ui.startSpinner(`Consulting ${AIManager.MODEL}...`);
        try {
          const aiResult = await AIManager.generateReleaseData(oldWebVer, oldWasmVer, diff);
          ui.stopSpinner(
            true,
            `AI Decision: Web ➜ ${c.greenBold(aiResult.webVersion)} | WASM ➜ ${c.greenBold(aiResult.wasmVersion)}`,
          );

          newWebVer = aiResult.webVersion;
          newWasmVer = aiResult.wasmVersion;
          changelogEntry = aiResult.changelog;
          commitMsg = aiResult.commitMessage;
        } catch (e: unknown) {
          const errMsg = e instanceof Error ? e.message : String(e);
          ui.stopSpinner(false, `AI Failed: ${errMsg}`);
          let fallback = true;
          if (!isAutoYes) {
            fallback = await new Confirm({
              title: "Fallback ke manual patch bump?",
              initialValue: true,
            }).run();
          }
          if (!fallback) throw new Error("Dibatalkan oleh user.");

          if (webChanged) newWebVer = this.manualBump(oldWebVer);
          if (rustChanged) newWasmVer = this.manualBump(oldWasmVer);
          commitMsg = `chore(release): bump version to v${newWebVer}`;
          changelogEntry = `## [${newWebVer}] - ${new Date().toISOString().split("T")[0]}\n\n### 🛠️ Maintenance\n- Manual patch release v${newWebVer}.\n\n`;
        }
      } else {
        if (webChanged) newWebVer = this.manualBump(oldWebVer);
        if (rustChanged) newWasmVer = this.manualBump(oldWasmVer);
        commitMsg = `chore(release): bump version to v${newWebVer}`;
        changelogEntry = `## [${newWebVer}] - ${new Date().toISOString().split("T")[0]}\n\n### 🛠️ Maintenance\n- Manual patch release v${newWebVer}.\n\n`;
      }

      await this.backup();

      // 5. Update Configurations
      ui.step(5, 8, "Writing Configurations & Changelog");
      ui.startSpinner("Updating package.json, version.ts, CHANGELOG.md, README.md...");
      await this.writePackageJson(newWebVer);
      if (hasCargo && rustChanged) await this.syncToCargo(newWasmVer);
      await this.syncToVersionTs(newWebVer, newWasmVer);
      await this.updateChangelogFile(changelogEntry);
      await this.syncToReadme(newWebVer);

      // Format modified config files with bun fmt so pre-commit hook passes 100%
      Shell.exec("bun fmt", { silent: true });
      ui.stopSpinner(true, "Configurations & CHANGELOG.md synced and formatted.");

      // 6. Build Rust WASM Binary
      if (hasCargo && !skipWasmBuild) {
        ui.step(6, 8, "Compiling Rust WASM Engine");
        ui.info("Running bun run wasm:build:\n");
        const proc = Bun.spawn(["bun", "run", "wasm:build"], {
          stdout: "inherit",
          stderr: "inherit",
        });
        const exitCode = await proc.exited;
        if (exitCode !== 0) throw new Error("WASM build failed.");
        ui.success("Rust WASM compiled successfully.");
      } else {
        ui.step(6, 8, "Compiling Rust WASM Engine");
        ui.info("Skipped.");
      }

      // 7. Git Commit & Tag
      ui.step(7, 8, "Git Commit & Tag");
      ui.startSpinner("Staging and committing changes...");
      Shell.run("git add -A", { silent: true });
      Shell.run(["git", "commit", "-m", commitMsg], { silent: true });

      if (!noTag) {
        const tagName = `web-v${newWebVer}`;
        const tagExists = Shell.exec(["git", "tag", "-l", tagName], { silent: true }).output;
        if (tagExists) Shell.run(["git", "tag", "-d", tagName], { silent: true });
        Shell.run(["git", "tag", tagName], { silent: true });
        ui.stopSpinner(true, `Committed & Tagged (${tagName} on ${currentBranch})`);
      } else {
        ui.stopSpinner(true, `Committed on branch ${currentBranch} (tag skipped)`);
      }

      // 8. Deploy to Origin
      ui.step(8, 8, "Deploy to Origin");
      if (!noPush) {
        ui.startSpinner(`Pushing branch '${currentBranch}' to origin...`);
        await this.smartPush(currentBranch);
        if (!noTag) {
          await this.smartPushTag(`web-v${newWebVer}`);
        }
        ui.stopSpinner(true, `Pushed to origin/${currentBranch} successfully`);
      } else {
        ui.info("Push ke origin di-skip (--no-push aktif).");
      }

      write(`📝 Commit   : ${c.dim(commitMsg)}\n`);
      await this.summary(currentBranch, newWebVer, newWasmVer, skipWasmBuild);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      log.error("🔥 PIPELINE FAILED!");
      ui.error(errMsg);
      try {
        await ToastBuilder.create(errMsg)
          .setTitle("🔥 IBDS Release Failed")
          .setAppName("IBDS Release")
          .show();
      } catch {
        // Ignore toast errors in headless environments
      }
      await this.rollback();
      process.exit(1);
    }
  }

  private async writePackageJson(newVer: string): Promise<void> {
    const file = await Bun.file(this.paths.package).text();
    const json = JSON.parse(file) as Record<string, unknown>;
    json.version = newVer;
    await Bun.write(this.paths.package, `${JSON.stringify(json, null, 2)}\n`);
  }

  private async syncToCargo(version: string): Promise<void> {
    if (!(await Bun.file(this.paths.cargo).exists())) return;
    const content = await Bun.file(this.paths.cargo).text();
    const newContent = content.replace(/version\s*=\s*"[^"]+"/, `version = "${version}"`);
    await Bun.write(this.paths.cargo, newContent);
  }

  private async syncToVersionTs(webVer: string, wasmVer: string): Promise<void> {
    const ts = [
      "/**",
      " * @file version.ts",
      " * @description Auto-generated application and Rust WASM engine version constants.",
      " */",
      "",
      `export const APP_VERSION = "${webVer}";`,
      `export const WASM_VERSION = "${wasmVer}";`,
      `export const BUILD_DATE = "${new Date().toISOString()}";`,
      "",
    ].join("\n");
    await Bun.write(this.paths.versionTs, ts);
  }

  private async updateChangelogFile(entry: string): Promise<void> {
    let current = (await Bun.file(this.paths.changelog).exists())
      ? await Bun.file(this.paths.changelog).text()
      : "";

    current = current.replace(/^# Changelog\s*\n+/gm, "").trim();
    const newContent = `# Changelog\n\n${entry}${current ? `\n${current}\n` : "\n"}`;
    await Bun.write(this.paths.changelog, newContent);
  }

  private async syncToReadme(version: string): Promise<void> {
    if (!(await Bun.file(this.paths.readme).exists())) return;
    const content = await Bun.file(this.paths.readme).text();
    const updated = content
      .replace(/RELEASE-v\d+\.\d+\.\d+--alpha/g, `RELEASE-v${version}--alpha`)
      .replace(/Version-\d+\.\d+\.\d+(?:-[a-z]+)?-blue/g, `Version-${version}-blue`);
    if (updated !== content) {
      await Bun.write(this.paths.readme, updated);
    }
  }

  private async smartPush(branch: string): Promise<void> {
    const push = await Shell.execAsync(["git", "push", "-u", "origin", branch], {
      silent: true,
    });
    if (!push.success) {
      if (push.error.includes("fetch first") || push.error.includes("non-fast-forward")) {
        await Shell.runAsync(["git", "pull", "--rebase", "origin", branch], {
          silent: true,
        });
        await Shell.runAsync(["git", "push", "-u", "origin", branch], {
          silent: true,
        });
      } else {
        throw new Error(push.error || push.output);
      }
    }
  }

  private async smartPushTag(tag: string): Promise<void> {
    const push = await Shell.execAsync(["git", "push", "origin", tag], {
      silent: true,
    });
    if (!push.success) {
      if (push.error.includes("already exists")) {
        await Shell.runAsync(["git", "push", "--force", "origin", tag], {
          silent: true,
        });
      } else {
        throw new Error(push.error || push.output);
      }
    }
  }

  private async backup(): Promise<void> {
    this.backups.package = await Bun.file(this.paths.package).text();
    if (await Bun.file(this.paths.cargo).exists()) {
      this.backups.cargo = await Bun.file(this.paths.cargo).text();
    }
    if (await Bun.file(this.paths.changelog).exists()) {
      this.backups.changelog = await Bun.file(this.paths.changelog).text();
    }
    if (await Bun.file(this.paths.versionTs).exists()) {
      this.backups.versionTs = await Bun.file(this.paths.versionTs).text();
    }
    if (await Bun.file(this.paths.readme).exists()) {
      this.backups.readme = await Bun.file(this.paths.readme).text();
    }
  }

  private async rollback(): Promise<void> {
    ui.warn("Rolling back modified configuration files...");
    if (this.backups.package) await Bun.write(this.paths.package, this.backups.package);
    if (this.backups.cargo) await Bun.write(this.paths.cargo, this.backups.cargo);
    if (this.backups.changelog) await Bun.write(this.paths.changelog, this.backups.changelog);
    if (this.backups.versionTs) await Bun.write(this.paths.versionTs, this.backups.versionTs);
    if (this.backups.readme) await Bun.write(this.paths.readme, this.backups.readme);
    ui.success("System restored (Config files reverted).");
  }

  private async summary(
    branch: string,
    webVer: string,
    wasmVer: string,
    wasmSkipped: boolean,
  ): Promise<void> {
    write(`\n${c.cyanBold("─".repeat(50))}\n`);
    write(`${c.greenBold("🚀 IBDS COMMIT & RELEASE COMPLETED!")}\n`);
    write(`${c.cyanBold("─".repeat(50))}\n`);
    write(`🌿 Branch   : ${c.cyanBold(branch)}\n`);
    write(`🌐 Web Ver  : ${c.greenBold(webVer)}\n`);
    write(`🦀 WASM Ver : ${c.greenBold(wasmVer)}\n`);
    write(`🏗️  WASM Bld : ${wasmSkipped ? c.yellow("Skipped") : c.green("Completed")}\n`);
    write(`🤖 AI Model : ${c.cyan(AIManager.MODEL)}\n`);
    write(`${c.gray("✨ System ready.")}\n`);

    try {
      await Notification.show({
        title: "🚀 IBDS Release Completed",
        message: `Branch ${branch} • Web v${webVer} • WASM v${wasmVer}`,
        appName: "IBDS Release",
      });
    } catch {
      // Ignore notification errors in non-GUI sessions
    }
  }
}

if (import.meta.main) {
  await new ReleaseManager().init();
}
