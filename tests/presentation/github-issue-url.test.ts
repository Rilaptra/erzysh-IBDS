import { describe, expect, test } from "bun:test";

import { buildGitHubIssueUrl, MAX_ISSUE_URL_LENGTH } from "@/lib/presentation/github-issue-url";
import type { FeedbackIssueDraft } from "@/types/presentation-types";

describe("Presentation GitHub Issue URL Builder", () => {
  test("maps categories to templates, labels, and prefixes accurately", () => {
    const bugDraft: FeedbackIssueDraft = {
      category: "bug_report",
      title: "Grafik BMD terpotong di layar kecil",
      description: "Saat mode compact aktif, label puncak momen terpotong.",
      includeClientDiagnostics: false,
    };

    const bugResult = buildGitHubIssueUrl(bugDraft);
    const bugParsed = new URL(bugResult.url);

    expect(bugParsed.origin).toBe("https://github.com");
    expect(bugParsed.pathname).toBe("/Rilaptra/erzysh-IBDS/issues/new");
    expect(bugParsed.searchParams.get("template")).toBe("bug_report.yml");
    expect(bugParsed.searchParams.get("labels")).toContain("bug");
    expect(bugParsed.searchParams.get("title")).toContain("Grafik BMD");
    expect(bugResult.isTruncated).toBe(false);
  });

  test("includes validation case reference and handles Unicode & Markdown safely", () => {
    const valDraft: FeedbackIssueDraft = {
      category: "validation_feedback",
      title: "Cek Δ_max WF 300x150 vs SAP2000",
      description: "Nilai IBDS = -8.4375 mm, SAP2000 = -8.44 mm (Δ = 0.03%) ✅",
      validationCaseCode: "VAL-01",
      includeClientDiagnostics: true,
    };

    const valResult = buildGitHubIssueUrl(valDraft);
    const parsed = new URL(valResult.url);
    const body = parsed.searchParams.get("body") ?? "";

    expect(parsed.searchParams.get("template")).toBe("validation_feedback.yml");
    expect(parsed.searchParams.get("labels")).toContain("validation");
    expect(body).toContain("VAL-01");
    expect(body).toContain("-8.4375");
  });

  test("enforces MAX_ISSUE_URL_LENGTH guard to prevent HTTP 414 errors", () => {
    const longDraft: FeedbackIssueDraft = {
      category: "feature_request",
      title: "Usulan analisis balok menerus 3 bentang",
      description: "Detail panjang: ".repeat(900),
      includeClientDiagnostics: true,
    };

    const result = buildGitHubIssueUrl(longDraft);
    expect(result.url.length).toBeLessThanOrEqual(MAX_ISSUE_URL_LENGTH);
    expect(result.isTruncated).toBe(true);
  });
});
