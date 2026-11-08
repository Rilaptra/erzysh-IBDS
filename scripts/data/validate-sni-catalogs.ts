/**
 * @file validate-sni-catalogs.ts
 * @description Validates the data integrity, geometry numbers, and schema compliance
 * of all primary structural steel (IWF, BOX, Materials) and reinforced concrete (Rebar)
 * JSON catalog files in src/data/ according to SNI 1729:2020 and SNI 2847:2019.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

interface IwfCatalogItem {
  name: string;
  H: number;
  B: number;
  tw: number;
  tf: number;
  r: number;
}

interface BoxCatalogItem {
  name: string;
  H: number;
  B: number;
  t: number;
  shapeType: "SQUARE" | "RECTANGULAR";
}

interface SteelGradeItem {
  grade: string;
  name: string;
  fy: number;
  fu: number;
  E: number;
  G: number;
  nu: number;
}

interface RebarBarItem {
  name: string;
  diameter: number;
  area: number;
  unitWeightKgPerM: number;
}

interface RebarGradeItem {
  grade: string;
  name: string;
  fy: number;
  fu: number;
  type: "PLAIN" | "DEFORMED";
  barDiameters: number[];
}

interface RebarCatalog {
  grades: RebarGradeItem[];
  plainBars: RebarBarItem[];
  deformedBars: RebarBarItem[];
}

function assertPositiveFinite(val: unknown, fieldName: string, context: string): void {
  if (typeof val !== "number" || !Number.isFinite(val) || val <= 0) {
    throw new Error(
      `[VALIDATION FAILED] ${context}: Field '${fieldName}' must be a positive finite number, received: ${val}`,
    );
  }
}

export async function validateSniCatalogs(): Promise<void> {
  const rootDir = process.cwd();
  const dataDir = join(rootDir, "src", "data");

  console.log("🔍 Validating SNI structural catalogs in src/data/...");

  // 1. Validate steel-iwf-catalog.json
  const iwfPath = join(dataDir, "steel-iwf-catalog.json");
  const iwfRaw = readFileSync(iwfPath, "utf-8");
  const iwfData: IwfCatalogItem[] = JSON.parse(iwfRaw);

  if (!Array.isArray(iwfData) || iwfData.length < 89) {
    throw new Error(
      `[VALIDATION FAILED] steel-iwf-catalog.json must be an array with >= 89 entries, got: ${iwfData.length}`,
    );
  }

  for (const item of iwfData) {
    if (!item.name || typeof item.name !== "string") {
      throw new Error(`[VALIDATION FAILED] IWF item has invalid name: ${JSON.stringify(item)}`);
    }
    assertPositiveFinite(item.H, "H", item.name);
    assertPositiveFinite(item.B, "B", item.name);
    assertPositiveFinite(item.tw, "tw", item.name);
    assertPositiveFinite(item.tf, "tf", item.name);
    assertPositiveFinite(item.r, "r", item.name);
  }

  // Check sample WF 100 x 100 x 17.2
  const sample100 = iwfData.find((p) => p.name.includes("100 x 100"));
  if (!sample100) {
    throw new Error("[VALIDATION FAILED] Sample profile WF 100 x 100 x 17.2 not found in catalog");
  }
  if (sample100.H !== 100 || sample100.B !== 100 || sample100.tw !== 6 || sample100.tf !== 8) {
    throw new Error(
      `[VALIDATION FAILED] Sample WF 100 x 100 x 17.2 dimensions mismatch: ${JSON.stringify(sample100)}`,
    );
  }
  console.log(
    `  ✓ steel-iwf-catalog.json: ${iwfData.length} profiles verified (Sample: ${sample100.name})`,
  );

  // 2. Validate steel-box-catalog.json
  const boxPath = join(dataDir, "steel-box-catalog.json");
  const boxRaw = readFileSync(boxPath, "utf-8");
  const boxData: BoxCatalogItem[] = JSON.parse(boxRaw);

  if (!Array.isArray(boxData) || boxData.length !== 23) {
    throw new Error(
      `[VALIDATION FAILED] steel-box-catalog.json must have 23 entries, got: ${boxData.length}`,
    );
  }

  for (const item of boxData) {
    if (!item.name || typeof item.name !== "string") {
      throw new Error(`[VALIDATION FAILED] BOX item has invalid name: ${JSON.stringify(item)}`);
    }
    assertPositiveFinite(item.H, "H", item.name);
    assertPositiveFinite(item.B, "B", item.name);
    assertPositiveFinite(item.t, "t", item.name);
    if (item.shapeType !== "SQUARE" && item.shapeType !== "RECTANGULAR") {
      throw new Error(`[VALIDATION FAILED] BOX item has invalid shapeType: ${item.shapeType}`);
    }
  }
  console.log(`  ✓ steel-box-catalog.json: ${boxData.length} profiles verified`);

  // 3. Validate steel-material-grades.json
  const gradesPath = join(dataDir, "steel-material-grades.json");
  const gradesRaw = readFileSync(gradesPath, "utf-8");
  const gradesData: SteelGradeItem[] = JSON.parse(gradesRaw);

  if (!Array.isArray(gradesData) || gradesData.length !== 5) {
    throw new Error(
      `[VALIDATION FAILED] steel-material-grades.json must have 5 grades, got: ${gradesData.length}`,
    );
  }

  const expectedSteelGrades = ["BJ_34", "BJ_37", "BJ_41", "BJ_50", "BJ_55"];
  for (const item of gradesData) {
    if (!expectedSteelGrades.includes(item.grade)) {
      throw new Error(`[VALIDATION FAILED] Unexpected steel grade: ${item.grade}`);
    }
    assertPositiveFinite(item.fy, "fy", item.grade);
    assertPositiveFinite(item.fu, "fu", item.grade);
    assertPositiveFinite(item.E, "E", item.grade);
    assertPositiveFinite(item.G, "G", item.grade);
    assertPositiveFinite(item.nu, "nu", item.grade);
  }
  console.log(`  ✓ steel-material-grades.json: ${gradesData.length} steel grades verified`);

  // 4. Validate concrete-rebar-catalog.json
  const rebarPath = join(dataDir, "concrete-rebar-catalog.json");
  const rebarRaw = readFileSync(rebarPath, "utf-8");
  const rebarData: RebarCatalog = JSON.parse(rebarRaw);

  if (!Array.isArray(rebarData.grades) || rebarData.grades.length !== 5) {
    throw new Error(
      `[VALIDATION FAILED] concrete-rebar-catalog.json must have 5 grades, got: ${rebarData.grades?.length}`,
    );
  }
  if (!Array.isArray(rebarData.plainBars) || rebarData.plainBars.length !== 5) {
    throw new Error(
      `[VALIDATION FAILED] plainBars must have 5 items, got: ${rebarData.plainBars?.length}`,
    );
  }
  if (!Array.isArray(rebarData.deformedBars) || rebarData.deformedBars.length !== 9) {
    throw new Error(
      `[VALIDATION FAILED] deformedBars must have 9 items, got: ${rebarData.deformedBars?.length}`,
    );
  }

  for (const bar of [...rebarData.plainBars, ...rebarData.deformedBars]) {
    assertPositiveFinite(bar.diameter, "diameter", bar.name);
    assertPositiveFinite(bar.area, "area", bar.name);
    assertPositiveFinite(bar.unitWeightKgPerM, "unitWeightKgPerM", bar.name);
  }

  console.log(
    `  ✓ concrete-rebar-catalog.json: ${rebarData.grades.length} grades, ${rebarData.plainBars.length} plain bars, ${rebarData.deformedBars.length} deformed bars verified`,
  );
  console.log("✅ All SNI structural catalogs verified successfully!");
}

// Execute directly if run as CLI script
if (import.meta.main) {
  validateSniCatalogs().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
