/**
 * @file generate-pwa-icons.ts
 * @description Generates PWA icon assets (192x192, 512x512, and 180x180 Apple Touch Icon)
 * from `public/png/pwa-icon.png` using native `Bun.Image`.
 */

import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ICON_TARGETS = [
  { filename: "icon-192x192.png", size: 192 },
  { filename: "icon-512x512.png", size: 512 },
  { filename: "apple-touch-icon.png", size: 180 },
] as const;

/**
 * Generates resized PNG PWA icons from the source `pwa-icon.png`.
 */
export async function generatePwaIcons(): Promise<void> {
  const rootDir = process.cwd();
  const sourcePath = join(rootDir, "public", "png", "pwa-icon.png");
  const iconsDir = join(rootDir, "public", "icons");

  if (!existsSync(sourcePath)) {
    throw new Error(`Source PWA icon not found at: ${sourcePath}`);
  }

  mkdirSync(iconsDir, { recursive: true });
  const sourceBuffer = await Bun.file(sourcePath).arrayBuffer();

  for (const target of ICON_TARGETS) {
    const outPath = join(iconsDir, target.filename);
    await new Bun.Image(sourceBuffer).resize(target.size, target.size).png().write(outPath);
    console.log(`✅ Generated ${target.filename} (${target.size}x${target.size})`);
  }
}

if (import.meta.main) {
  await generatePwaIcons();
}
