/**
 * @file sync-version.ts
 * @description Synchronizes semantic versions from package.json and crates/mechanics-3d-wasm/Cargo.toml
 * into src/config/version.ts.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { zyLog } from "../src/lib/zylog";

const packageJsonPath = join(process.cwd(), "package.json");
const cargoPath = join(process.cwd(), "crates", "mechanics-3d-wasm", "Cargo.toml");
const versionTsPath = join(process.cwd(), "src", "config", "version.ts");

/**
 * Synchronizes package.json and Cargo.toml versions into src/config/version.ts.
 */
export function syncVersion(): { webVersion: string; wasmVersion: string } {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as { version?: string };
  const webVersion = packageJson.version;

  if (!webVersion) {
    throw new Error("Could not find 'version' field in package.json.");
  }

  let wasmVersion = webVersion;
  if (existsSync(cargoPath)) {
    const cargoContent = readFileSync(cargoPath, "utf-8");
    const match = cargoContent.match(/^version\s*=\s*"([^"]+)"/m);
    if (match?.[1]) {
      wasmVersion = match[1];
    } else {
      zyLog.warn(`Could not find version in Cargo.toml, defaulting to '${webVersion}'.`);
    }
  }

  const tsContent = [
    "/**",
    " * @file version.ts",
    " * @description Auto-generated application and Rust WASM engine version constants.",
    " */",
    "",
    `export const APP_VERSION = "${webVersion}";`,
    `export const WASM_VERSION = "${wasmVersion}";`,
    `export const BUILD_DATE = "${new Date().toISOString()}";`,
    "",
  ].join("\n");

  writeFileSync(versionTsPath, tsContent);

  zyLog.success(`Web Application (APP_VERSION) synced: ${webVersion}`);
  zyLog.success(`Rust WASM Engine (WASM_VERSION) synced: ${wasmVersion}`);

  return { webVersion, wasmVersion };
}

if (import.meta.main) {
  try {
    syncVersion();
  } catch (error) {
    zyLog.error("Error syncing version:", error);
    process.exit(1);
  }
}
