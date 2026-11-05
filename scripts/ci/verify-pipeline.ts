/**
 * @file verify-pipeline.ts
 * @description All-in-one local CI verification pipeline runner using Bun native APIs.
 * Sequentially executes formatting checks, strict typechecks, catalog validations, and unit tests.
 */

import { exists } from "node:fs/promises";
import { join } from "node:path";

import { $ } from "bun";

interface PipelineStep {
  readonly name: string;
  readonly command: () => Promise<void>;
  readonly isOptional?: boolean;
}

/**
 * Executes a pipeline step with nanosecond-resolution timing.
 * @param name Descriptive name of the step.
 * @param runner Async task to execute.
 * @returns Duration formatted in milliseconds.
 */
async function executeStep(name: string, runner: () => Promise<void>): Promise<number> {
  const start = Bun.nanoseconds();
  process.stdout.write(`⏳ Running ${name}... `);
  try {
    await runner();
    const durationMs = (Bun.nanoseconds() - start) / 1_000_000;
    console.log(`✅ [${durationMs.toFixed(1)} ms]`);
    return durationMs;
  } catch (error) {
    const durationMs = (Bun.nanoseconds() - start) / 1_000_000;
    console.log(`❌ FAILED [${durationMs.toFixed(1)} ms]`);
    throw error;
  }
}

/**
 * Runs the full CI verification pipeline.
 */
export async function runVerificationPipeline(): Promise<void> {
  const rootDir = process.cwd();
  console.log("=======================================================================");
  console.log("🚀 IBDS Native CI Quality Gate Verification (Bun v1.4.4)");
  console.log("=======================================================================");

  const catalogScript = join(rootDir, "scripts", "data", "validate-sni-catalogs.ts");
  const hasCatalogScript = await exists(catalogScript);

  const cargoManifest = join(rootDir, "crates", "mechanics-3d-wasm", "Cargo.toml");
  const hasCargoManifest = await exists(cargoManifest);

  const testsDir = join(rootDir, "tests");
  const hasTestsDir = await exists(testsDir);

  const steps: PipelineStep[] = [
    {
      name: "Format Check (bun fmt --check)",
      command: async () => {
        await $`bun fmt --check`.quiet();
      },
    },
    {
      name: "Type Check (bun check -b)",
      command: async () => {
        await $`bun check -b`.quiet();
      },
    },
  ];

  if (hasCargoManifest) {
    steps.push({
      name: "Rust Mechanics Tests (cargo test)",
      command: async () => {
        await $`cargo test --manifest-path ${cargoManifest}`.quiet();
      },
    });
  }

  if (hasCatalogScript) {
    steps.push({
      name: "SNI Catalogs Validation (bun run data:validate)",
      command: async () => {
        await $`bun run ${catalogScript}`.quiet();
      },
    });
  }

  if (hasTestsDir) {
    steps.push({
      name: "Parallel Unit Tests (bun test --parallel --check)",
      command: async () => {
        await $`bun test --parallel --check`.quiet();
      },
    });
  }

  const overallStart = Bun.nanoseconds();

  try {
    for (const step of steps) {
      await executeStep(step.name, step.command);
    }

    const totalDurationMs = (Bun.nanoseconds() - overallStart) / 1_000_000;
    console.log("=======================================================================");
    console.log(`🎉 Quality Gate PASSED in ${totalDurationMs.toFixed(1)} ms! 0 errors detected.`);
    console.log("=======================================================================\n");
  } catch (error) {
    const totalDurationMs = (Bun.nanoseconds() - overallStart) / 1_000_000;
    console.error("\n=======================================================================");
    console.error(`💥 Quality Gate FAILED after ${totalDurationMs.toFixed(1)} ms.`);
    console.error("=======================================================================");
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(String(error));
    }
    process.exit(1);
  }
}

// Run pipeline if invoked as CLI entrypoint
if (import.meta.main) {
  await runVerificationPipeline();
}
