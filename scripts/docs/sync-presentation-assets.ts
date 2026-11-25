import { existsSync } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { VALIDATION_CASE_CARDS } from "../../src/data/presentation/validation-cases";

const CURATED_SCREENSHOTS = [
  "01-landing.png",
  "02-desktop-steel.png",
  "03-mode-a-loads.png",
  "04-mode-b-direct.png",
  "05-steel-params.png",
  "06-steel-results.png",
  "07-concrete-params.png",
  "08-concrete-wireframe.png",
  "09-diagrams-window.png",
  "10-ai-assistant.png",
  "11-android-companion.png",
  "12-export-modal.png",
] as const;

async function syncPresentationAssets(): Promise<void> {
  const rootDir = process.cwd();
  const manualDestDir = path.join(rootDir, "public", "presentation", "manual");
  const screenshotsDestDir = path.join(manualDestDir, "screenshots");

  await mkdir(screenshotsDestDir, { recursive: true });

  let copiedCount = 0;
  let skippedCount = 0;

  const pdfSource = path.join(rootDir, "docs", "Panduan_01_IBDS.pdf");
  const pdfDest = path.join(manualDestDir, "Panduan_01_IBDS.pdf");
  if (existsSync(pdfSource)) {
    await copyFile(pdfSource, pdfDest);
    copiedCount += 1;
    console.log("[sync-presentation-assets] Copied Panduan_01_IBDS.pdf");
  } else {
    skippedCount += 1;
    console.warn("[sync-presentation-assets] Missing docs/Panduan_01_IBDS.pdf (skipped)");
  }

  for (const filename of CURATED_SCREENSHOTS) {
    const src = path.join(rootDir, "docs", "screenshots", filename);
    const dest = path.join(screenshotsDestDir, filename);
    if (existsSync(src)) {
      await copyFile(src, dest);
      copiedCount += 1;
    } else {
      skippedCount += 1;
    }
  }

  for (const card of VALIDATION_CASE_CARDS) {
    const caseDir = path.join(rootDir, "public", "presentation", "validation", card.id);
    await mkdir(caseDir, { recursive: true });
  }

  console.log(
    `[sync-presentation-assets] Done: ${copiedCount} assets copied, ${skippedCount} optional files skipped, ${VALIDATION_CASE_CARDS.length} validation directories ready.`,
  );
}

await syncPresentationAssets();
