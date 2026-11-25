import type {
  ComputedValidationRow,
  EvaluatedValidationCard,
  ValidationAggregateMetrics,
  ValidationCaseCard,
  ValidationComparisonRowInput,
  ValidationRowStatus,
} from "@/types/presentation-types";

export const ZERO_REF_EPSILON = 1e-9;
export const DEFAULT_ZERO_ABS_TOLERANCE = 1e-4;
export const WARN_TOLERANCE_MULTIPLIER = 2.5;

export function computeRelativeErrorPercent(
  appValue: number,
  refValue: number,
  zeroAbsoluteTolerance = DEFAULT_ZERO_ABS_TOLERANCE,
): number | null {
  if (!Number.isFinite(appValue) || !Number.isFinite(refValue)) {
    return null;
  }

  // Prevent division by zero when reference reaction or moment equals 0
  if (Math.abs(refValue) < ZERO_REF_EPSILON) {
    return Math.abs(appValue - refValue) <= zeroAbsoluteTolerance ? 0 : 100;
  }

  return (Math.abs(appValue - refValue) / Math.abs(refValue)) * 100;
}

export function evaluateValidationRow(row: ValidationComparisonRowInput): ComputedValidationRow {
  const zeroTol = row.zeroAbsoluteTolerance ?? DEFAULT_ZERO_ABS_TOLERANCE;

  const sap2000ErrorPercent =
    typeof row.sap2000Value === "number"
      ? computeRelativeErrorPercent(row.ibdsValue, row.sap2000Value, zeroTol)
      : null;

  const excelErrorPercent =
    typeof row.excelValue === "number"
      ? computeRelativeErrorPercent(row.ibdsValue, row.excelValue, zeroTol)
      : null;

  const analyticalErrorPercent =
    typeof row.analyticalValue === "number"
      ? computeRelativeErrorPercent(row.ibdsValue, row.analyticalValue, zeroTol)
      : null;

  const errors: number[] = [];
  if (sap2000ErrorPercent !== null) errors.push(sap2000ErrorPercent);
  if (excelErrorPercent !== null) errors.push(excelErrorPercent);
  if (analyticalErrorPercent !== null) errors.push(analyticalErrorPercent);

  if (errors.length === 0) {
    return {
      ...row,
      sap2000ErrorPercent,
      excelErrorPercent,
      analyticalErrorPercent,
      maxErrorPercent: null,
      status: "PENDING_REF",
    };
  }

  const maxErrorPercent = Math.max(...errors);
  const tolerance = Math.max(0, row.tolerancePercent);
  let status: ValidationRowStatus;
  if (maxErrorPercent <= tolerance) {
    status = "PASS";
  } else if (maxErrorPercent <= tolerance * WARN_TOLERANCE_MULTIPLIER) {
    status = "WARN";
  } else {
    status = "FAIL";
  }

  return {
    ...row,
    sap2000ErrorPercent,
    excelErrorPercent,
    analyticalErrorPercent,
    maxErrorPercent,
    status,
  };
}

function averageOrNull(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  let sum = 0;
  for (const val of values) {
    sum += val;
  }
  return sum / values.length;
}

export function evaluateValidationCard(card: ValidationCaseCard): EvaluatedValidationCard {
  const rows = card.comparisonRows.map(evaluateValidationRow);
  const sapErrors: number[] = [];
  const excelErrors: number[] = [];
  const rowMaxErrors: number[] = [];

  let hasFail = false;
  let hasWarn = false;
  let hasPass = false;

  for (const row of rows) {
    if (row.sap2000ErrorPercent !== null) sapErrors.push(row.sap2000ErrorPercent);
    if (row.excelErrorPercent !== null) excelErrors.push(row.excelErrorPercent);
    if (row.maxErrorPercent !== null) rowMaxErrors.push(row.maxErrorPercent);
    if (row.status === "FAIL") hasFail = true;
    else if (row.status === "WARN") hasWarn = true;
    else if (row.status === "PASS") hasPass = true;
  }

  let overallStatus: ValidationRowStatus = "PENDING_REF";
  if (hasFail) overallStatus = "FAIL";
  else if (hasWarn) overallStatus = "WARN";
  else if (hasPass) overallStatus = "PASS";

  return {
    card,
    rows,
    overallStatus,
    maxErrorPercent: rowMaxErrors.length > 0 ? Math.max(...rowMaxErrors) : null,
    meanSap2000ErrorPercent: averageOrNull(sapErrors),
    meanExcelErrorPercent: averageOrNull(excelErrors),
  };
}

export function computeValidationAggregateMetrics(
  cards: readonly ValidationCaseCard[],
): ValidationAggregateMetrics {
  const evaluated = cards.map(evaluateValidationCard);
  const verifiedCases = cards.filter((c) => c.verificationStatus === "VERIFIED").length;

  let totalRowsEvaluated = 0;
  let passedRows = 0;
  const sapErrors: number[] = [];
  const excelErrors: number[] = [];
  const allMaxErrors: number[] = [];

  for (const item of evaluated) {
    for (const row of item.rows) {
      if (row.status !== "PENDING_REF") {
        totalRowsEvaluated += 1;
        if (row.status === "PASS") passedRows += 1;
      }
      if (row.sap2000ErrorPercent !== null) sapErrors.push(row.sap2000ErrorPercent);
      if (row.excelErrorPercent !== null) excelErrors.push(row.excelErrorPercent);
      if (row.maxErrorPercent !== null) allMaxErrors.push(row.maxErrorPercent);
    }
  }

  const passRatePercent = totalRowsEvaluated > 0 ? (passedRows / totalRowsEvaluated) * 100 : 0;

  return {
    totalCases: cards.length,
    verifiedCases,
    totalRowsEvaluated,
    passRatePercent,
    meanSap2000ErrorPercent: averageOrNull(sapErrors),
    meanExcelErrorPercent: averageOrNull(excelErrors),
    maxObservedErrorPercent: allMaxErrors.length > 0 ? Math.max(...allMaxErrors) : null,
  };
}

export function formatMetricNumber(value: number | undefined | null, maxDecimals = 4): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  if (Math.abs(value) < 1e-12) return "0";
  return Number(value.toFixed(maxDecimals)).toString();
}

export function generateValidationCardTsSnippet(card: ValidationCaseCard): string {
  const sanitizedMedia = card.evidenceMedia.map((media) => {
    const filename =
      media.kind === "IBDS" ? "ibds.png" : media.kind === "SAP2000" ? "sap2000.png" : "excel.png";
    // Replace temporary local base64 DataURLs with clean repository asset paths
    const src = media.src.startsWith("data:")
      ? `/presentation/validation/${card.id}/${filename}`
      : media.src;
    return {
      ...media,
      src,
    };
  });

  const exportCard: ValidationCaseCard = {
    ...card,
    origin: "REPO_SEED",
    verificationStatus:
      card.verificationStatus === "DRAFT_LOCAL" ? "VERIFIED" : card.verificationStatus,
    evidenceMedia: sanitizedMedia,
  };

  return `// Paste inside VALIDATION_CASE_CARDS in src/data/presentation/validation-cases.ts\n${JSON.stringify(exportCard, null, 2)},`;
}
