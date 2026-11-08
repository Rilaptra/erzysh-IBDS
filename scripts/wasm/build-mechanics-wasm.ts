/**
 * @file build-mechanics-wasm.ts
 * @description Automated build script for the `mechanics-3d-wasm` Rust crate.
 * Compiles the crate to `wasm32-unknown-unknown --release`, generates TypeScript/ESM
 * bindings into `src/wasm/` via `wasm-bindgen`, emits an isomorphic byte loader module
 * (`mechanics_3d_wasm_bytes.ts`) for synchronous zero-latency initialization, and formats
 * the generated files.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/** Result summary of the Rust-to-WASM compilation pipeline. */
export interface WasmBuildResult {
  readonly wasmPath: string;
  readonly jsBindingsPath: string;
  readonly dtsBindingsPath: string;
  readonly bytesModulePath: string;
  readonly sizeBytes: number;
  readonly elapsedMs: number;
}

/**
 * Executes a shell command via `Bun.spawnSync` and throws a descriptive error on failure.
 *
 * @param cmd Command and arguments array.
 * @param stepLabel Diagnostic step description.
 * @throws {Error} When the subprocess exits with a non-zero status code.
 */
function runCommandOrThrow(cmd: string[], stepLabel: string): void {
  const proc = Bun.spawnSync(cmd, {
    cwd: process.cwd(),
    stdout: "inherit",
    stderr: "inherit",
  });

  if (proc.exitCode !== 0) {
    throw new Error(
      `[WasmBuildError] Step '${stepLabel}' failed with exit code ${String(proc.exitCode)}: ${cmd.join(" ")}`,
    );
  }
}

/**
 * Compiles `crates/mechanics-3d-wasm` into `src/wasm/` and formats the output bindings.
 * Automatically falls back to committed prebuilt artifacts in Vercel or cloud CI environments
 * where the native Rust `wasm32-unknown-unknown` toolchain is not pre-installed.
 *
 * @param options Optional build options.
 * @returns Metadata describing the generated WASM binary and TypeScript bindings.
 * @throws {Error} If compilation fails and no valid prebuilt fallback is present.
 * @example
 * const result = await buildMechanicsWasm();
 * console.log(`Built WASM (${result.sizeBytes} bytes) in ${result.elapsedMs.toFixed(0)} ms`);
 */
export async function buildMechanicsWasm(
  options: { force?: boolean } = {},
): Promise<WasmBuildResult> {
  const startTime = performance.now();
  const rootDir = process.cwd();
  const manifestPath = resolve(rootDir, "crates/mechanics-3d-wasm/Cargo.toml");
  const outDir = resolve(rootDir, "src/wasm");

  const wasmPath = resolve(outDir, "mechanics_3d_wasm_bg.wasm");
  const jsBindingsPath = resolve(outDir, "mechanics_3d_wasm.js");
  const dtsBindingsPath = resolve(outDir, "mechanics_3d_wasm.d.ts");
  const bytesModulePath = resolve(outDir, "mechanics_3d_wasm_bytes.ts");

  const hasPrebuiltArtifacts =
    existsSync(wasmPath) &&
    existsSync(jsBindingsPath) &&
    existsSync(dtsBindingsPath) &&
    existsSync(bytesModulePath);

  // 1. Fast-path for Vercel / Cloud CI: Skip re-compiling if prebuilt artifacts are already committed
  const isVercel = Boolean(process.env.VERCEL);
  const skipWasm = Boolean(process.env.SKIP_WASM_BUILD);
  const isForced = options.force ?? Bun.argv.includes("--force");

  if ((isVercel || skipWasm) && hasPrebuiltArtifacts && !isForced) {
    console.log(
      "⚡ [WasmBuild] Vercel/Cloud environment detected: using committed prebuilt WASM artifacts in src/wasm/.",
    );
    const wasmBuffer = readFileSync(wasmPath);
    return {
      wasmPath,
      jsBindingsPath,
      dtsBindingsPath,
      bytesModulePath,
      sizeBytes: wasmBuffer.byteLength,
      elapsedMs: 0,
    };
  }

  if (!existsSync(manifestPath)) {
    if (hasPrebuiltArtifacts && !isForced) {
      console.warn(
        "⚠️ [WasmBuild] Cargo manifest not found, falling back to prebuilt WASM in src/wasm/.",
      );
      const wasmBuffer = readFileSync(wasmPath);
      return {
        wasmPath,
        jsBindingsPath,
        dtsBindingsPath,
        bytesModulePath,
        sizeBytes: wasmBuffer.byteLength,
        elapsedMs: 0,
      };
    }
    throw new Error(`[WasmBuildError] Cargo manifest not found at: ${manifestPath}`);
  }

  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  try {
    console.log(
      "🦀 [1/4] Compiling crates/mechanics-3d-wasm (wasm32-unknown-unknown --release)...",
    );
    runCommandOrThrow(
      [
        "cargo",
        "build",
        "--manifest-path",
        manifestPath,
        "--target",
        "wasm32-unknown-unknown",
        "--release",
      ],
      "cargo build wasm32-unknown-unknown",
    );

    const rawWasmBinary = resolve(
      rootDir,
      "crates/mechanics-3d-wasm/target/wasm32-unknown-unknown/release/mechanics_3d_wasm.wasm",
    );
    if (!existsSync(rawWasmBinary)) {
      throw new Error(`[WasmBuildError] Expected compiled WASM artifact missing: ${rawWasmBinary}`);
    }

    console.log("🔗 [2/4] Generating TypeScript & ESM bindings via wasm-bindgen...");
    runCommandOrThrow(
      ["wasm-bindgen", rawWasmBinary, "--out-dir", outDir, "--target", "web"],
      "wasm-bindgen web target",
    );

    if (!existsSync(wasmPath) || !existsSync(jsBindingsPath) || !existsSync(dtsBindingsPath)) {
      throw new Error(
        "[WasmBuildError] wasm-bindgen did not emit all expected artifacts in src/wasm/",
      );
    }

    console.log("📦 [3/4] Generating isomorphic synchronous WASM byte loader...");
    const wasmBuffer = readFileSync(wasmPath);
    const base64String = wasmBuffer.toString("base64");
    const bytesModuleSource = `/**
 * @file mechanics_3d_wasm_bytes.ts
 * @description Auto-generated isomorphic binary container for synchronous WebAssembly initialization
 * across Bun, Node, Next.js SSR, and Browser WebGL contexts.
 */

export const MECHANICS_WASM_BASE64 = "${base64String}";

/**
 * Decodes the embedded WASM binary into a \`Uint8Array\` buffer suitable for \`initSync\`.
 *
 * @returns Raw WebAssembly binary bytes.
 */
export function decodeMechanicsWasmBytes(): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(MECHANICS_WASM_BASE64, "base64"));
  }
  const binaryStr = atob(MECHANICS_WASM_BASE64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}
`;
    writeFileSync(bytesModulePath, bytesModuleSource, "utf8");

    console.log("✨ [4/4] Formatting generated bindings in src/wasm/...");
    runCommandOrThrow(["bun", "fmt", outDir], "bun fmt src/wasm");

    const sizeBytes = wasmBuffer.byteLength;
    const elapsedMs = performance.now() - startTime;
    console.log(
      `✅ WASM build complete: ${(sizeBytes / 1024).toFixed(2)} KB in ${elapsedMs.toFixed(0)} ms`,
    );

    return {
      wasmPath,
      jsBindingsPath,
      dtsBindingsPath,
      bytesModulePath,
      sizeBytes,
      elapsedMs,
    };
  } catch (buildErr) {
    if (hasPrebuiltArtifacts && !isForced) {
      console.warn(
        "⚠️ [WasmBuild] Rust compilation or wasm-bindgen not available in this environment.\n" +
          "   Falling back gracefully to committed prebuilt WASM artifacts in src/wasm/.",
      );
      const wasmBuffer = readFileSync(wasmPath);
      return {
        wasmPath,
        jsBindingsPath,
        dtsBindingsPath,
        bytesModulePath,
        sizeBytes: wasmBuffer.byteLength,
        elapsedMs: performance.now() - startTime,
      };
    }
    throw buildErr;
  }
}

if (import.meta.main) {
  await buildMechanicsWasm();
}
