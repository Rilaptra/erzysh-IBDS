import { existsSync } from "node:fs";
import path from "node:path";

import { VALIDATION_CASE_CARDS } from "../../src/data/presentation/validation-cases";
import { evaluateValidationCard } from "../../src/lib/presentation/validation-metrics";

function validatePresentationCards(): void {
  const errors: string[] = [];
  const warnings: string[] = [];
  const seenIds = new Set<string>();
  const seenCodes = new Set<string>();
  const publicDir = path.join(process.cwd(), "public");

  if (VALIDATION_CASE_CARDS.length === 0) {
    errors.push("VALIDATION_CASE_CARDS must contain at least one study case.");
  }

  for (const card of VALIDATION_CASE_CARDS) {
    if (seenIds.has(card.id)) {
      errors.push(`Duplicate validation card id: "${card.id}"`);
    }
    seenIds.add(card.id);

    if (seenCodes.has(card.code)) {
      errors.push(`Duplicate validation card code: "${card.code}"`);
    }
    seenCodes.add(card.code);

    if (card.comparisonRows.length === 0) {
      errors.push(`Card ${card.code} (${card.id}) has no comparisonRows.`);
    }

    const rowIds = new Set<string>();
    for (const row of card.comparisonRows) {
      if (rowIds.has(row.id)) {
        errors.push(`Card ${card.code} contains duplicate row id: "${row.id}"`);
      }
      rowIds.add(row.id);

      if (!Number.isFinite(row.ibdsValue)) {
        errors.push(`Card ${card.code} row "${row.id}" has non-finite ibdsValue.`);
      }
      if (!Number.isFinite(row.tolerancePercent) || row.tolerancePercent <= 0) {
        errors.push(`Card ${card.code} row "${row.id}" must have tolerancePercent > 0.`);
      }
    }

    const evaluated = evaluateValidationCard(card);
    if (card.verificationStatus === "VERIFIED" && evaluated.overallStatus === "FAIL") {
      errors.push(
        `Card ${card.code} is marked VERIFIED but has rows exceeding error tolerance (max ${evaluated.maxErrorPercent?.toFixed(2)}%).`,
      );
    }

    for (const media of card.evidenceMedia) {
      if (media.src.startsWith("/")) {
        const diskPath = path.join(publicDir, media.src.replace(/^\/+/, ""));
        if (!existsSync(diskPath)) {
          const message = `Card ${card.code} evidence "${media.id}" file not found at public${media.src}`;
          if (card.verificationStatus === "VERIFIED") {
            errors.push(message);
          } else {
            warnings.push(message);
          }
        }
      }
    }
  }

  if (warnings.length > 0) {
    console.log(
      `[validate-presentation-cards] ${warnings.length} placeholder media slot(s) pending screenshots.`,
    );
  }

  if (errors.length > 0) {
    console.error("[validate-presentation-cards] Validation FAILED:");
    for (const err of errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  console.log(
    `[validate-presentation-cards] OK: ${VALIDATION_CASE_CARDS.length} validation cards verified.`,
  );
}

validatePresentationCards();
