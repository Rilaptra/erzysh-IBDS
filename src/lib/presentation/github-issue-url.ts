import { GITHUB_REPO_URL } from "@/data/presentation/github-fallback-snapshot";
import type {
  BuiltGitHubIssueUrl,
  FeedbackClientDiagnostics,
  FeedbackIssueCategory,
  FeedbackIssueDraft,
} from "@/types/presentation-types";

export const MAX_ISSUE_URL_LENGTH = 7500;

export interface FeedbackCategoryMeta {
  readonly label: string;
  readonly shortDescription: string;
  readonly templateFile: string;
  readonly titlePrefix: string;
  readonly labels: readonly string[];
}

export const FEEDBACK_CATEGORY_META: Readonly<Record<FeedbackIssueCategory, FeedbackCategoryMeta>> =
  {
    bug_report: {
      label: "Laporan Bug",
      shortDescription: "Error runtime, tampilan rusak, atau hasil yang tidak sesuai harapan.",
      templateFile: "bug_report.yml",
      titlePrefix: "[Bug]",
      labels: ["bug", "triage"],
    },
    feature_request: {
      label: "Saran Fitur",
      shortDescription: "Usulan standar SNI tambahan, format ekspor baru, atau fitur analisis.",
      templateFile: "feature_request.yml",
      titlePrefix: "[Fitur]",
      labels: ["enhancement"],
    },
    validation_feedback: {
      label: "Koreksi Validasi SAP2000/Excel",
      shortDescription: "Laporkan selisih hasil hitungan IBDS terhadap SAP2000 atau Excel manual.",
      templateFile: "validation_feedback.yml",
      titlePrefix: "[Validasi]",
      labels: ["validation", "engineering"],
    },
    ux_question: {
      label: "Pertanyaan / Masukan UI & UX",
      shortDescription: "Saran alur kerja, dokumentasi, atau pertanyaan penggunaan aplikasi.",
      templateFile: "feature_request.yml",
      titlePrefix: "[UX]",
      labels: ["ux", "question"],
    },
  };

export function formatIssueTitle(category: FeedbackIssueCategory, rawTitle: string): string {
  const meta = FEEDBACK_CATEGORY_META[category];
  const cleaned = rawTitle.trim().slice(0, 120);
  if (!cleaned) return `${meta.titlePrefix}: `;
  if (cleaned.toLowerCase().startsWith(meta.titlePrefix.toLowerCase())) {
    return cleaned;
  }
  return `${meta.titlePrefix}: ${cleaned}`;
}

export function buildGitHubIssueBody(
  draft: FeedbackIssueDraft,
  diagnostics?: FeedbackClientDiagnostics,
): string {
  const meta = FEEDBACK_CATEGORY_META[draft.category];
  const sections: string[] = [
    `### Kategori\n${meta.label}`,
    `### Deskripsi Masukan\n${draft.description.trim() || "_(Lengkapi rincian masukan di sini)_"}`,
  ];

  if (draft.category === "validation_feedback" && draft.validationCaseCode?.trim()) {
    sections.push(`### Referensi Kasus Validasi / Profil\n\`${draft.validationCaseCode.trim()}\``);
  }

  if (draft.stepsOrContext?.trim()) {
    sections.push(`### Langkah Reproduksi / Parameter Pendukung\n${draft.stepsOrContext.trim()}`);
  }

  if (draft.includeClientDiagnostics && diagnostics) {
    sections.push(
      [
        "### Diagnostik Lingkungan (Otomatis)",
        `- **App Version:** \`v${diagnostics.appVersion}\``,
        `- **WASM Engine:** \`v${diagnostics.wasmVersion}\``,
        `- **Platform Mode:** \`${diagnostics.platformMode}\``,
        `- **Viewport:** \`${diagnostics.viewport}\``,
        `- **Browser:** ${diagnostics.userAgentSummary}`,
      ].join("\n"),
    );
  }

  sections.push(
    "_Dikirim melalui Kotak Masukan Halaman Presentasi (`/presentation`). Anda dapat menempelkan screenshot langsung di editor ini dengan `Ctrl+V`._",
  );

  return sections.join("\n\n");
}

export function buildGitHubIssueUrl(
  draft: FeedbackIssueDraft,
  diagnostics?: FeedbackClientDiagnostics,
): BuiltGitHubIssueUrl {
  const meta = FEEDBACK_CATEGORY_META[draft.category];
  const formattedTitle = formatIssueTitle(draft.category, draft.title);
  const fullMarkdownBody = buildGitHubIssueBody(draft, diagnostics);

  const buildUrlWithBody = (bodyText: string): string => {
    const params = new URLSearchParams();
    params.set("template", meta.templateFile);
    params.set("title", formattedTitle);
    params.set("labels", meta.labels.join(","));
    params.set("body", bodyText);
    return `${GITHUB_REPO_URL}/issues/new?${params.toString()}`;
  };

  let url = buildUrlWithBody(fullMarkdownBody);
  let isTruncated = false;

  if (url.length > MAX_ISSUE_URL_LENGTH) {
    isTruncated = true;
    const notice =
      "\n\n---\n> [Dipotong otomatis agar sesuai batas URL browser. Silakan klik 'Salin Markdown' di halaman /presentation lalu tempel di sini.]";
    let low = 0;
    let high = fullMarkdownBody.length;
    let bestUrl = buildUrlWithBody(notice.trim());

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const candidate = buildUrlWithBody(`${fullMarkdownBody.slice(0, mid)}${notice}`);
      if (candidate.length <= MAX_ISSUE_URL_LENGTH) {
        bestUrl = candidate;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    url = bestUrl;
  }

  return {
    url,
    markdownBody: fullMarkdownBody,
    formattedTitle,
    isTruncated,
    urlLength: url.length,
  };
}
