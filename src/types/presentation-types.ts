export type PresentationViewMode = "scroll" | "deck";

export type PresentationChapterId =
  | "hero"
  | "bab-1-identitas-fitur"
  | "bab-2-fungsi-tujuan"
  | "bab-3-proses-pengembangan"
  | "bab-4-riwayat-update"
  | "bab-5-tutorial-panduan"
  | "bab-6-sumber-validasi"
  | "bab-7-target-pengguna"
  | "bab-8-kualitas-sistem"
  | "bab-9-github-preview"
  | "bab-10-masukan-issue";

export interface PresentationChapterMeta {
  readonly id: PresentationChapterId;
  readonly slideNumber: number;
  readonly code: string;
  readonly title: string;
  readonly shortTitle: string;
  readonly subtitle: string;
}

export interface DevelopmentPhaseItem {
  readonly id: string;
  readonly phaseCode: string;
  readonly title: string;
  readonly period: string;
  readonly gitRef: string;
  readonly focus: string;
  readonly deliverables: readonly string[];
  readonly artifactPaths: readonly string[];
  readonly engineeringLesson: string;
}

export interface UpdateHighlightMeta {
  readonly badge: string;
  readonly accentClass: string;
  readonly highlightNote?: string;
}

export interface CalculationEquationItem {
  readonly label: string;
  readonly latex: string;
}

export interface CalculationSourceItem {
  readonly id: string;
  readonly domain: string;
  readonly standard: string;
  readonly isBeta?: boolean;
  readonly summary: string;
  readonly equations: readonly CalculationEquationItem[];
  readonly codeRefs: readonly string[];
}

export interface RenderedCalculationEquation {
  readonly label: string;
  readonly latex: string;
  readonly html: string;
}

export interface RenderedCalculationSource {
  readonly id: string;
  readonly domain: string;
  readonly standard: string;
  readonly isBeta?: boolean;
  readonly summary: string;
  readonly equations: readonly RenderedCalculationEquation[];
  readonly codeRefs: readonly string[];
}

export type ValidationCategory =
  | "DEFLECTION_MECHANICS"
  | "SHEAR_MOMENT_DIAGRAM"
  | "STEEL_SNI_1729"
  | "CONCRETE_SNI_2847"
  | "SECTION_GEOMETRY";

export type ValidationBenchmarkSource =
  "SAP2000" | "EXCEL_MANUAL" | "ANALYTICAL" | "SAP2000_AND_EXCEL";

export type ValidationRowStatus = "PASS" | "WARN" | "FAIL" | "PENDING_REF";

export type ValidationCardOrigin = "REPO_SEED" | "USER_LOCAL_DRAFT";

export type ValidationEvidenceKind = "IBDS" | "SAP2000" | "EXCEL_MANUAL";

export interface ValidationComparisonRowInput {
  readonly id: string;
  readonly parameter: string;
  readonly symbol: string;
  readonly unit: string;
  readonly ibdsValue: number;
  readonly sap2000Value?: number;
  readonly excelValue?: number;
  readonly analyticalValue?: number;
  readonly tolerancePercent: number;
  readonly zeroAbsoluteTolerance?: number;
}

export interface ComputedValidationRow extends ValidationComparisonRowInput {
  readonly sap2000ErrorPercent: number | null;
  readonly excelErrorPercent: number | null;
  readonly analyticalErrorPercent: number | null;
  readonly maxErrorPercent: number | null;
  readonly status: ValidationRowStatus;
}

export interface ValidationEvidenceMedia {
  readonly id: string;
  readonly kind: ValidationEvidenceKind;
  readonly src: string;
  readonly alt: string;
  readonly caption: string;
  readonly width: number;
  readonly height: number;
  readonly softwareVersion?: string;
  readonly sheetOrModelRef?: string;
  readonly capturedAt?: string;
}

export interface ValidationCaseCard {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly summary: string;
  readonly category: ValidationCategory;
  readonly benchmarkSource: ValidationBenchmarkSource;
  readonly verificationStatus: "VERIFIED" | "TEMPLATE_PLACEHOLDER" | "DRAFT_LOCAL";
  readonly origin: ValidationCardOrigin;
  readonly modelInputs: ReadonlyArray<{
    readonly label: string;
    readonly value: string;
  }>;
  readonly comparisonRows: readonly ValidationComparisonRowInput[];
  readonly evidenceMedia: readonly ValidationEvidenceMedia[];
  readonly sniClauses: readonly string[];
  readonly solverTestRef?: string;
  readonly simulatorHref?: string;
  readonly downloadableArtifacts?: ReadonlyArray<{
    readonly label: string;
    readonly href: string;
    readonly format: "S2K" | "XLSX" | "PDF" | "JSON";
  }>;
  readonly notes?: string;
}

export interface EvaluatedValidationCard {
  readonly card: ValidationCaseCard;
  readonly rows: readonly ComputedValidationRow[];
  readonly overallStatus: ValidationRowStatus;
  readonly maxErrorPercent: number | null;
  readonly meanSap2000ErrorPercent: number | null;
  readonly meanExcelErrorPercent: number | null;
}

export interface ValidationAggregateMetrics {
  readonly totalCases: number;
  readonly verifiedCases: number;
  readonly totalRowsEvaluated: number;
  readonly passRatePercent: number;
  readonly meanSap2000ErrorPercent: number | null;
  readonly meanExcelErrorPercent: number | null;
  readonly maxObservedErrorPercent: number | null;
}

export interface PersonaItem {
  readonly id: string;
  readonly role: string;
  readonly tag: string;
  readonly accentClass: string;
  readonly painPoints: string;
  readonly workflow: string;
  readonly recommendedMode: string;
  readonly ctaLabel: string;
  readonly ctaHref: string;
  readonly isExternal?: boolean;
}

export type QualityAttributeKey =
  | "sustainability"
  | "scalability"
  | "modularity"
  | "flexibility"
  | "simplicity"
  | "maintainability";

export interface QualityAttributeItem {
  readonly key: QualityAttributeKey;
  readonly title: string;
  readonly tagline: string;
  readonly summary: string;
  readonly maturityScore: number;
  readonly isHighlighted?: boolean;
  readonly evidencePoints: ReadonlyArray<{
    readonly label: string;
    readonly detail: string;
    readonly fileRef: string;
  }>;
}

export interface GitHubLanguageShare {
  readonly name: string;
  readonly bytes: number;
  readonly percentage: number;
  readonly colorHex: string;
}

export interface GitHubTreeEntry {
  readonly name: string;
  readonly path: string;
  readonly type: "dir" | "file";
  readonly htmlUrl: string;
}

export interface GitHubCommitSummary {
  readonly shaShort: string;
  readonly messageHeadline: string;
  readonly authorName: string;
  readonly committedAtIso: string;
  readonly htmlUrl: string;
}

export interface GitHubRepoSnapshot {
  readonly owner: string;
  readonly name: string;
  readonly fullName: string;
  readonly htmlUrl: string;
  readonly description: string;
  readonly defaultBranch: string;
  readonly licenseSpdx: string;
  readonly starsCount: number;
  readonly forksCount: number;
  readonly watchersCount: number;
  readonly openIssuesCount: number;
  readonly topics: readonly string[];
  readonly pushedAtIso: string;
  readonly languages: readonly GitHubLanguageShare[];
  readonly rootTree: readonly GitHubTreeEntry[];
  readonly recentCommits: readonly GitHubCommitSummary[];
  readonly fetchedAtIso: string;
  readonly dataSource: "live-github-api" | "static-fallback";
}

export type FeedbackIssueCategory =
  "bug_report" | "feature_request" | "validation_feedback" | "ux_question";

export interface FeedbackIssueDraft {
  readonly category: FeedbackIssueCategory;
  readonly title: string;
  readonly description: string;
  readonly stepsOrContext?: string;
  readonly validationCaseCode?: string;
  readonly includeClientDiagnostics: boolean;
}

export interface FeedbackClientDiagnostics {
  readonly appVersion: string;
  readonly wasmVersion: string;
  readonly platformMode: string;
  readonly viewport: string;
  readonly userAgentSummary: string;
}

export interface BuiltGitHubIssueUrl {
  readonly url: string;
  readonly markdownBody: string;
  readonly formattedTitle: string;
  readonly isTruncated: boolean;
  readonly urlLength: number;
}
