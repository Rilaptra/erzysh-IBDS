/**
 * @file verify.ts
 * @description One-stop pre-commit & pre-release code verification gate for IBDS.
 * Stages:
 *   1. Bun Fmt Autofix (bun fmt)                      — format files, sort imports & tailwind classes
 *   2. Bun Fmt Check   (bun fmt --check)              — GATE: 0 unformatted files
 *   3. TypeScript      (bun check -b)                 — GATE: 0 type errors
 *   4. Rust Mechanics  (cargo test)                   — GATE: 0 Rust test failures
 *   5. SNI Catalogs    (bun run data:validate)        — GATE: catalog integrity & WF 100x100 benchmark
 *   6. Unit Tests      (bun test --parallel --check)  — GATE: parallel unit & macro tests
 *   7. Next Build      (bun run build)                — GATE: optional with --build flag
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

import { c, write } from "@rilaptra/tui";
import Bun from "bun";

import { ZyLog } from "../src/lib/zylog";

const log = ZyLog.withScope("VERIFY");

export interface VerifyOptions {
  readonly build?: boolean;
}

async function spawnInherit(cmd: string[]): Promise<number> {
  const proc = Bun.spawn(cmd, { stdout: "inherit", stderr: "inherit" });
  return await proc.exited;
}

async function spawnCapture(cmd: string[]): Promise<{ code: number; output: string }> {
  const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
  const code = await proc.exited;
  const output =
    `${await new Response(proc.stdout).text()}\n${await new Response(proc.stderr).text()}`.trim();
  return { code, output };
}

function elapsed(start: number): string {
  return `${((Date.now() - start) / 1000).toFixed(2)}s`;
}

function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

/**
 * Executes the multi-stage verification pipeline.
 * @param options Verification options (e.g., whether to run full Next.js production build).
 * @returns True if all active gates pass with exit code 0; false otherwise.
 */
export async function runVerification(options: VerifyOptions = {}): Promise<boolean> {
  let failedAt: string | null = null;
  const rootDir = process.cwd();

  // --- Stage 1: Bun Fmt Autofix ---
  write(`${c.cyan("  ▶ Bun Fmt (format & organize imports)")}\n`);
  {
    const start = Date.now();
    const { code, output } = await spawnCapture(["bun", "fmt"]);
    const plain = stripAnsi(output);
    const fixedMatch = plain.match(/Formatted (\d+) files?/);
    const unchangedMatch = plain.match(/(\d+) unchanged/);
    const fixed = fixedMatch?.[1] ?? "0";
    const unchanged = unchangedMatch?.[1] ?? "0";

    if (fixed !== "0") {
      write(
        `${c.cyan(`    ℹ ${fixed} file diformat otomatis (${unchanged} unchanged, ${elapsed(start)})`)}\n`,
      );
    } else {
      write(`${c.green(`    ✓ Sudah rapi, semua file terformat (${elapsed(start)})`)}\n`);
    }
    if (code !== 0) {
      write(`${c.yellow("    ⚠ Masih ada issue formatting — lanjut ke gate check...")}\n`);
    }
  }

  // --- Stage 2: Bun Fmt Check (GATE) ---
  write(`${c.cyan("  ▶ Bun Fmt Check (gate: wajib 0 unformatted)")}\n`);
  {
    const start = Date.now();
    const code = await spawnInherit(["bun", "fmt", "--check"]);
    if (code === 0) {
      write(`${c.green(`    ✓ Bun Fmt Check lolos (${elapsed(start)})`)}\n`);
    } else {
      write(
        `${c.red(`    ✗ Bun Fmt Check gagal (${elapsed(start)}) — ada file yang belum terformat.`)}\n`,
      );
      failedAt = "Bun Fmt Check";
    }
  }

  // --- Stage 3: TypeScript Check (GATE) ---
  if (!failedAt) {
    write(`${c.cyan("  ▶ TypeScript Check (bun check -b)")}\n`);
    const start = Date.now();
    const code = await spawnInherit(["bun", "check", "-b"]);
    if (code === 0) {
      write(`${c.green(`    ✓ TypeScript lolos (${elapsed(start)})`)}\n`);
    } else {
      write(`${c.red(`    ✗ TypeScript error (${elapsed(start)}) — lihat detail di atas.`)}\n`);
      failedAt = "TypeScript";
    }
  }

  // --- Stage 4: Rust Mechanics Unit Tests (GATE) ---
  const cargoManifestPath = join(rootDir, "crates", "mechanics-3d-wasm", "Cargo.toml");
  if (!failedAt && existsSync(cargoManifestPath)) {
    write(`${c.cyan("  ▶ Rust Mechanics Tests (cargo test)")}\n`);
    const start = Date.now();
    const { code, output } = await spawnCapture([
      "cargo",
      "test",
      "--manifest-path",
      cargoManifestPath,
    ]);
    if (code === 0) {
      write(`${c.green(`    ✓ Rust unit tests lolos (${elapsed(start)})`)}\n`);
    } else {
      console.error(output);
      write(`${c.red(`    ✗ Rust unit tests gagal (${elapsed(start)}).`)}\n`);
      failedAt = "Rust Mechanics Unit Tests";
    }
  }

  // --- Stage 5: SNI Catalogs Validation (GATE) ---
  const catalogValidatorPath = join(rootDir, "scripts", "data", "validate-sni-catalogs.ts");
  if (!failedAt && existsSync(catalogValidatorPath)) {
    write(`${c.cyan("  ▶ SNI Catalogs Validation (bun run data:validate)")}\n`);
    const start = Date.now();
    const { code, output } = await spawnCapture(["bun", "run", catalogValidatorPath]);
    if (code === 0) {
      write(`${c.green(`    ✓ Katalog SNI (IWF, BOX, BJ, Rebar) valid (${elapsed(start)})`)}\n`);
    } else {
      console.error(output);
      write(`${c.red(`    ✗ Validasi katalog SNI gagal (${elapsed(start)}).`)}\n`);
      failedAt = "SNI Catalogs Validation";
    }
  }

  // --- Stage 6: Parallel Unit Tests (GATE) ---
  const testsDir = join(rootDir, "tests");
  if (!failedAt && existsSync(testsDir)) {
    write(`${c.cyan("  ▶ Parallel Unit Tests (bun test --parallel --check)")}\n`);
    const start = Date.now();
    const { code, output } = await spawnCapture(["bun", "test", "--parallel", "--check"]);
    if (code === 0) {
      write(`${c.green(`    ✓ Semua unit test lolos (${elapsed(start)})`)}\n`);
    } else {
      console.error(output);
      write(`${c.red(`    ✗ Unit test gagal (${elapsed(start)}).`)}\n`);
      failedAt = "Unit Tests";
    }
  }

  // --- Stage 6: Production Build (GATE, opsional) ---
  if (!failedAt && options.build) {
    write(`${c.cyan("  ▶ Production Build (bun run build)")}\n`);
    const start = Date.now();
    const code = await spawnInherit(["bun", "run", "build"]);
    if (code === 0) {
      write(`${c.green(`    ✓ Build production sukses (${elapsed(start)})`)}\n`);
    } else {
      write(
        `${c.red(`    ✗ Build production gagal (${elapsed(start)}) — lihat error di atas.`)}\n`,
      );
      failedAt = "Production Build";
    }
  }

  return failedAt === null;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const withBuild = args.includes("--build");

  write(`\n${c.cyanBold("🔍 IBDS CODE VERIFICATION PIPELINE")}\n\n`);

  const ok = await runVerification({ build: withBuild });

  if (ok) {
    log.success(
      `✅ Semua check lolos${withBuild ? " (fmt + typecheck + rust + catalogs + tests + build)" : " (fmt + typecheck + rust + catalogs + tests)"} — aman untuk commit! 🚀`,
    );
  } else {
    log.error("❌ Verifikasi gagal — perbaiki error di atas sebelum commit.");
    process.exit(1);
  }
}
