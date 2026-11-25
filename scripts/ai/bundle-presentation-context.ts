#!/usr/bin/env bun
/**
 * @file bundle-presentation-context.ts
 * @description Copies all required repository context files for planning the IBDS presentation page
 * into a single temporary folder sibling to `scripts/` (`.tmp-presentation-context/` by default).
 */

import { existsSync } from "node:fs";
import { copyFile, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

import { zyLog } from "../../src/lib/zylog";

export type ContextTier = "core" | "recommended" | "optional";
export type BundleTierSelection = "core" | "recommended" | "all";

export interface ContextFileEntry {
  readonly path: string;
  readonly tier: ContextTier;
  readonly purpose: string;
}

export const PRESENTATION_CONTEXT_FILES: readonly ContextFileEntry[] = [
  // Tier 1: Core context
  {
    path: "README.md",
    tier: "core",
    purpose: "Project overview, 8 core capabilities, architecture diagram, live demo & GitHub URLs",
  },
  {
    path: "USER_MANUAL.md",
    tier: "core",
    purpose: "Product description, objectives, target audience, standards, and step-by-step guide",
  },
  {
    path: "CHANGELOG.md",
    tier: "core",
    purpose: "Chronological release history (v0.4.0 to latest) for updates section",
  },
  {
    path: "mdfiles/bun_v1_4_4_architecture_and_context.md",
    tier: "core",
    purpose: "20 quality pillars, Hybrid Rust WASM + Bun v1.4.4 architecture, Big-O optimizations",
  },
  {
    path: "mdfiles/step_by_step_build_roadmap.md",
    tier: "core",
    purpose: "7-stage development roadmap and build methodology (Step 1-7)",
  },
  {
    path: "src/config/tutorial-steps-config.ts",
    tier: "core",
    purpose:
      "Latest in-system interactive tutorial (IBDS Engineer Quest - 9 missions with AI Ucuy)",
  },
  {
    path: "src/app/page.tsx",
    tier: "core",
    purpose:
      "Landing page layout, main navigation integration point, GitHub links & changelog usage",
  },
  {
    path: "src/app/changelog/page.tsx",
    tier: "core",
    purpose: "Reference pattern for non-simulator content routes using ErzyshPageShell",
  },
  {
    path: "src/components/landing/ErzyshPageShell.tsx",
    tier: "core",
    purpose: "Required scrollable page wrapper and shared glassPanelClass styling",
  },
  {
    path: "package.json",
    tier: "core",
    purpose: "Installed tech stack, dependency versions, and repository scripts",
  },
  {
    path: "mdfiles/presentation_page_specification_and_plan.md",
    tier: "core",
    purpose:
      "paling penting, karena belum ikut masuk ke bundle (dibuat setelah script dijalankan) dan sudah memuat blueprint, kontrak TypeScript, arsitektur /embed/github-repo, sistem card validasi 2-tier, serta ringkasan aturan Next.js 16.4.5.",
  },
  {
    path: "tsconfig.json",
    tier: "core",
    purpose:
      "Installed tech stack, dependency versions, and repository scmemuat aturan strict TypeScript (noUncheckedIndexedAccess, verbatimModuleSyntax, alias @/*) yang sering memicu error build jika AI tidak tahu.",
  },
  {
    path: "components.json",
    tier: "core",
    purpose: "agar AI memakai primitif UI & token desain eksisting tanpa mengarang komponen baru.",
  },
  {
    path: "mdfiles/ui_ux_visual_layout_and_interaction_spec.md",
    tier: "core",
    purpose: "spesifikasi visual & interaksi resmi aplikasi (belum masuk list di script).",
  },
  {
    path: "src/app/robots.ts",
    tier: "core",
    purpose: "untuk pengaturan SEO/indexing /presentation dan noindex rute /embed/github-repo.",
  },

  // Tier 2: Recommended engineering specs, styling & conventions
  {
    path: "mdfiles/structural_mechanics_and_deflection_solver_spec.md",
    tier: "recommended",
    purpose: "5 support categories, Macaulay/Mohr formulas, Euler-Bernoulli deflection, XYZ axes",
  },
  {
    path: "mdfiles/sni_2847_concrete_design_specification.md",
    tier: "recommended",
    purpose: "SNI 2847:2019 reinforced concrete flexural (Whitney) and shear stirrup formulas",
  },
  {
    path: "mdfiles/sni_1729_steel_design_specification.md",
    tier: "recommended",
    purpose: "SNI 1729:2020 steel design rules (Table B4.1b, LTB Ch. F, Biaxial H1, Torsion H3)",
  },
  {
    path: "mdfiles/steel_wf_box_section_geometry_spec.md",
    tier: "recommended",
    purpose: "Exact IWF & BOX geometric property formulas including root fillet constants",
  },
  {
    path: "mdfiles/final_project_file_structure_and_preparation.md",
    tier: "recommended",
    purpose: "Production folder blueprint and mdfiles/ naming and documentation conventions",
  },
  {
    path: "src/app/globals.css",
    tier: "recommended",
    purpose: "Erzysh Dark Void Tailwind v4 design tokens and custom animation classes",
  },
  {
    path: "src/app/layout.tsx",
    tier: "recommended",
    purpose: "Root metadata, Geist font setup, and global layout shell",
  },
  {
    path: "src/lib/changelog.ts",
    tier: "recommended",
    purpose: "Server-side CHANGELOG.md loader reusable inside the presentation route",
  },
  {
    path: "src/lib/changelog-shared.ts",
    tier: "recommended",
    purpose: "Shared changelog data types and markdown parser helpers",
  },
  {
    path: "next.config.ts",
    tier: "recommended",
    purpose: "Next.js configuration and custom HTTP headers",
  },
  {
    path: "AGENTS.md",
    tier: "recommended",
    purpose: "Next.js 16 version notice and repository agent constraints",
  },

  // Tier 3: Optional validation benchmarks, capabilities & export spec
  {
    path: "tests/mechanics/euler-bernoulli-deflection.test.ts",
    tier: "optional",
    purpose: "Analytical & SAP2000 reference benchmark cases for beam reactions, BMD & deflection",
  },
  {
    path: "tests/core/steel/iwf-geometric-properties.test.ts",
    tier: "optional",
    purpose: "Geometric validation benchmark against WF 100x100x17.2 reference table",
  },
  {
    path: "tests/steel/steel-sni1729-optimizer.test.ts",
    tier: "optional",
    purpose: "SNI 1729:2020 steel validation cases (compactness, LTB zones, H1 interaction)",
  },
  {
    path: "tests/concrete/concrete-sni2847-optimizer.test.ts",
    tier: "optional",
    purpose: "SNI 2847:2019 concrete validation cases (Whitney flexure, beta1, shear stirrups)",
  },
  {
    path: "src/config/platform-capabilities.ts",
    tier: "optional",
    purpose: "Adaptive PWA Desktop vs Android Companion capability gate configuration",
  },
  {
    path: "src/config/version.ts",
    tier: "optional",
    purpose: "Synced APP_VERSION, WASM_VERSION, and BUILD_DATE constants",
  },
  {
    path: "mdfiles/cad_bim_cae_export_specification.md",
    tier: "optional",
    purpose: "Multi-format CAD/BIM/CAE export specs (.s2k, .dxf, .ifc, .iom.xml, .step, .stl)",
  },
];

const DEFAULT_OUT_FOLDER = ".tmp-presentation-context";

interface CliOptions {
  readonly tier: BundleTierSelection;
  readonly nested: boolean;
  readonly clean: boolean;
  readonly help: boolean;
  readonly outFolder: string;
}

function parseCliArgs(argv: readonly string[]): CliOptions {
  let tier: BundleTierSelection = "all";
  let nested = false;
  let clean = false;
  let help = false;
  let outFolder = DEFAULT_OUT_FOLDER;

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      help = true;
    } else if (arg === "--nested") {
      nested = true;
    } else if (arg === "--clean") {
      clean = true;
    } else if (arg.startsWith("--tier=")) {
      const value = arg.slice("--tier=".length).trim().toLowerCase();
      if (value === "core" || value === "recommended" || value === "all") {
        tier = value;
      } else {
        throw new Error(`Invalid --tier value "${value}". Expected: core | recommended | all.`);
      }
    } else if (arg.startsWith("--out=")) {
      const value = arg.slice("--out=".length).trim();
      if (!value) {
        throw new Error("--out cannot be empty.");
      }
      outFolder = value;
    } else {
      throw new Error(`Unknown argument "${arg}". Use --help for usage.`);
    }
  }

  return { tier, nested, clean, help, outFolder };
}

function selectEntriesByTier(tier: BundleTierSelection): readonly ContextFileEntry[] {
  if (tier === "core") {
    return PRESENTATION_CONTEXT_FILES.filter((entry) => entry.tier === "core");
  }
  if (tier === "recommended") {
    return PRESENTATION_CONTEXT_FILES.filter(
      (entry) => entry.tier === "core" || entry.tier === "recommended",
    );
  }
  return PRESENTATION_CONTEXT_FILES;
}

/**
 * Converts a repo-relative POSIX path to a collision-free flat filename while keeping
 * its original directory structure readable (e.g., `src/app/page.tsx` -> `src__app__page.tsx`).
 */
function toFlatFilename(repoRelativePath: string): string {
  return repoRelativePath.replaceAll("\\", "/").replaceAll("/", "__");
}

function resolveSafeOutputDir(repoRoot: string, outFolder: string): string {
  const targetDir = resolve(repoRoot, outFolder);
  const relToRoot = relative(repoRoot, targetDir).replaceAll("\\", "/");
  const scriptsDir = resolve(repoRoot, "scripts");
  const relToScripts = relative(scriptsDir, targetDir).replaceAll("\\", "/");

  if (!relToRoot || relToRoot === "." || relToRoot.startsWith("..")) {
    throw new Error(
      `Output directory "${outFolder}" must be a subfolder inside the repository root.`,
    );
  }

  if (relToScripts === "" || (!relToScripts.startsWith("..") && !relToScripts.startsWith("/"))) {
    throw new Error(
      `Output directory "${outFolder}" must be outside the scripts/ folder (sibling to scripts/).`,
    );
  }

  return targetDir;
}

function buildContextIndexMarkdown(
  copied: ReadonlyArray<{
    readonly entry: ContextFileEntry;
    readonly copiedRelPath: string;
    readonly sizeBytes: number;
  }>,
  tier: BundleTierSelection,
  nested: boolean,
): string {
  const totalKb = (copied.reduce((sum, item) => sum + item.sizeBytes, 0) / 1024).toFixed(1);
  const lines: string[] = [
    "# IBDS Presentation Plan — Bundled AI Context Index",
    "",
    `- **Generated At:** ${new Date().toISOString()}`,
    `- **Tier Selection:** \`${tier}\``,
    `- **Layout Mode:** \`${nested ? "nested" : "flat"}\``,
    `- **Total Files:** ${copied.length} (${totalKb} KB)`,
    "",
    "## File Mapping",
    "",
    "| Bundled File | Original Repo Path | Tier | Size (KB) | Purpose |",
    "| :--- | :--- | :---: | ---: | :--- |",
  ];

  for (const item of copied) {
    const kb = (item.sizeBytes / 1024).toFixed(1);
    lines.push(
      `| \`${item.copiedRelPath}\` | \`${item.entry.path}\` | \`${item.entry.tier}\` | ${kb} | ${item.entry.purpose} |`,
    );
  }

  lines.push(
    "",
    "## Available Visual Assets (Not Copied Into Text Bundle)",
    "",
    "- `docs/screenshots/01-landing.png` .. `12-export-modal.png` (14 application UI screenshots)",
    "- `public/webp/banner-wide-1200x288.webp`, `public/webp/logo.webp`, `public/webp/pwa-icon.webp`",
    "",
  );

  return lines.join("\n");
}

function printHelp(): void {
  console.log(
    [
      "Usage: bun run scripts/ai/bundle-presentation-context.ts [options]",
      "",
      "Copies all required context files into a single tmp folder sibling to `scripts/`.",
      "",
      "Options:",
      "  --tier=all|recommended|core  Select file tier to copy (default: all)",
      "  --nested                     Preserve repo folder structure instead of flat copy",
      `  --out=<folder>               Output folder at repo root (default: ${DEFAULT_OUT_FOLDER})`,
      "  --clean                      Delete the output tmp folder and exit",
      "  -h, --help                   Show this help message",
    ].join("\n"),
  );
}

export async function bundlePresentationContext(
  argv: readonly string[] = Bun.argv.slice(2),
): Promise<void> {
  const options = parseCliArgs(argv);
  if (options.help) {
    printHelp();
    return;
  }

  const repoRoot = resolve(import.meta.dir, "../..");
  const outputDir = resolveSafeOutputDir(repoRoot, options.outFolder);

  if (options.clean) {
    if (existsSync(outputDir)) {
      await rm(outputDir, { recursive: true, force: true });
      zyLog.success(`Removed temporary context folder: ${relative(repoRoot, outputDir)}`);
    } else {
      zyLog.info(`Temporary context folder does not exist: ${relative(repoRoot, outputDir)}`);
    }
    return;
  }

  const selectedEntries = selectEntriesByTier(options.tier);

  if (existsSync(outputDir)) {
    await rm(outputDir, { recursive: true, force: true });
  }
  await mkdir(outputDir, { recursive: true });

  const copied: Array<{
    readonly entry: ContextFileEntry;
    readonly copiedRelPath: string;
    readonly sizeBytes: number;
  }> = [];
  const missing: string[] = [];

  for (const entry of selectedEntries) {
    const srcPath = resolve(repoRoot, entry.path);
    if (!existsSync(srcPath)) {
      missing.push(entry.path);
      zyLog.warn(`Skipped missing source file: ${entry.path}`);
      continue;
    }

    const copiedRelPath = options.nested ? entry.path : toFlatFilename(entry.path);
    const destPath = join(outputDir, copiedRelPath);
    await mkdir(dirname(destPath), { recursive: true });
    await copyFile(srcPath, destPath);

    const fileStat = await stat(srcPath);
    copied.push({ entry, copiedRelPath, sizeBytes: fileStat.size });
  }

  const indexContent = buildContextIndexMarkdown(copied, options.tier, options.nested);
  await writeFile(join(outputDir, "00_CONTEXT_INDEX.md"), indexContent, "utf-8");

  const totalKb = (copied.reduce((sum, item) => sum + item.sizeBytes, 0) / 1024).toFixed(1);
  zyLog.success(
    `Copied ${copied.length} context files (${totalKb} KB) + 00_CONTEXT_INDEX.md into ./${relative(repoRoot, outputDir)}/`,
  );
  zyLog.info(`Tier: ${options.tier} | Layout: ${options.nested ? "nested" : "flat"}`);

  if (missing.length > 0) {
    zyLog.warn(`Missing files (${missing.length}): ${missing.join(", ")}`);
  }
}

if (import.meta.main) {
  bundlePresentationContext().catch((error: unknown) => {
    zyLog.error("Failed to bundle presentation context:", error);
    process.exit(1);
  });
}
