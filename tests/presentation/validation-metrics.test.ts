import { describe, expect, test } from "bun:test";

import {
  computeRelativeErrorPercent,
  computeValidationAggregateMetrics,
  evaluateValidationRow,
  generateValidationCardTsSnippet,
} from "@/lib/presentation/validation-metrics";
import type { ValidationCaseCard, ValidationComparisonRowInput } from "@/types/presentation-types";

describe("Presentation Validation Metrics Engine", () => {
  test("computes relative percentage error accurately for non-zero reference values", () => {
    expect(computeRelativeErrorPercent(-8.4375, -8.4375)).toBe(0);
    expect(computeRelativeErrorPercent(-8.4375, -8.44)).toBeCloseTo(0.0296, 3);
    expect(computeRelativeErrorPercent(45.9, 45.0)).toBeCloseTo(2.0, 4);
  });

  test("guards against division by zero when reference value is 0", () => {
    expect(computeRelativeErrorPercent(0, 0)).toBe(0);
    expect(computeRelativeErrorPercent(0.00005, 0, 1e-4)).toBe(0);
    const nonZeroErr = computeRelativeErrorPercent(0.5, 0, 1e-4);
    expect(Number.isFinite(nonZeroErr)).toBe(true);
    expect(nonZeroErr).toBeGreaterThan(0);
  });

  test("classifies rows into PASS, WARN, FAIL, and PENDING_REF correctly", () => {
    const baseRow: ValidationComparisonRowInput = {
      id: "r1",
      parameter: "Lendutan Maksimum",
      symbol: "Δ_max",
      unit: "mm",
      ibdsValue: -8.4375,
      tolerancePercent: 1.0,
    };

    const pending = evaluateValidationRow(baseRow);
    expect(pending.status).toBe("PENDING_REF");
    expect(pending.maxErrorPercent).toBeNull();

    const pass = evaluateValidationRow({
      ...baseRow,
      sap2000Value: -8.44,
      excelValue: -8.4375,
    });
    expect(pass.status).toBe("PASS");
    expect(pass.maxErrorPercent).not.toBeNull();
    expect(pass.maxErrorPercent!).toBeLessThanOrEqual(1.0);

    const warn = evaluateValidationRow({
      ...baseRow,
      sap2000Value: -8.6,
    });
    expect(warn.status).toBe("WARN");

    const fail = evaluateValidationRow({
      ...baseRow,
      sap2000Value: -9.5,
    });
    expect(fail.status).toBe("FAIL");
  });

  test("aggregates KPI accuracy metrics across multiple cards", () => {
    const sampleCard: ValidationCaseCard = {
      id: "val-test-01",
      code: "VAL-T1",
      title: "Simply Supported UDL",
      summary: "Benchmark test",
      category: "DEFLECTION_MECHANICS",
      benchmarkSource: "SAP2000_AND_EXCEL",
      verificationStatus: "VERIFIED",
      origin: "REPO_SEED",
      modelInputs: [{ label: "L", value: "6 m" }],
      comparisonRows: [
        {
          id: "r1",
          parameter: "Moment",
          symbol: "M_max",
          unit: "kNm",
          ibdsValue: 45,
          sap2000Value: 45,
          excelValue: 45,
          tolerancePercent: 1.0,
        },
        {
          id: "r2",
          parameter: "Deflection",
          symbol: "Δ_max",
          unit: "mm",
          ibdsValue: -8.4375,
          sap2000Value: -8.44,
          excelValue: -8.4375,
          tolerancePercent: 1.0,
        },
      ],
      evidenceMedia: [],
      sniClauses: ["Euler-Bernoulli"],
    };

    const metrics = computeValidationAggregateMetrics([sampleCard]);
    expect(metrics.totalCases).toBe(1);
    expect(metrics.verifiedCases).toBe(1);
    expect(metrics.totalRowsEvaluated).toBe(2);
    expect(metrics.passRatePercent).toBe(100);
    expect(metrics.meanExcelErrorPercent).toBe(0);
    expect(metrics.meanSap2000ErrorPercent).not.toBeNull();
    expect(metrics.meanSap2000ErrorPercent!).toBeLessThan(0.1);
  });

  test("generates clean TypeScript snippet without raw data URLs", () => {
    const draftCard: ValidationCaseCard = {
      id: "val-draft-05",
      code: "VAL-05",
      title: "Custom Box Beam",
      summary: "Draft validation",
      category: "STEEL_SNI_1729",
      benchmarkSource: "SAP2000",
      verificationStatus: "DRAFT_LOCAL",
      origin: "USER_LOCAL_DRAFT",
      modelInputs: [],
      comparisonRows: [
        {
          id: "r1",
          parameter: "DCR",
          symbol: "DCR",
          unit: "-",
          ibdsValue: 0.94,
          sap2000Value: 0.94,
          tolerancePercent: 1.0,
        },
      ],
      evidenceMedia: [
        {
          id: "m1",
          kind: "SAP2000",
          src: "data:image/webp;base64,UklGRh4AAABXRUJQ",
          alt: "SAP2000",
          caption: "SAP2000 DCR",
          width: 1280,
          height: 720,
        },
      ],
      sniClauses: ["SNI 1729:2020 Pasal F7"],
    };

    const snippet = generateValidationCardTsSnippet(draftCard);
    expect(snippet).toContain("val-draft-05");
    expect(snippet).not.toContain("data:image/webp;base64");
  });
});
