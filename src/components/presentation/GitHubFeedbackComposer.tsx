"use client";

import {
  AlertTriangleIcon,
  BugIcon,
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  EyeIcon,
  HelpCircleIcon,
  LightbulbIcon,
  MessageSquareIcon,
  ScaleIcon,
  SendIcon,
} from "lucide-react";
import type { ComponentType, FormEvent, ReactElement } from "react";
import { useMemo, useState } from "react";

import { glassPanelClass } from "@/components/landing/ErzyshPageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { APP_VERSION, WASM_VERSION } from "@/config/version";
import { cn } from "@/lib/utils";
import type {
  FeedbackIssueCategory,
  FeedbackIssueDraft,
  ValidationCaseCard,
} from "@/types/presentation-types";

export interface GitHubFeedbackComposerProps {
  readonly id?: string;
  readonly validationCases?: readonly Pick<ValidationCaseCard, "id" | "code" | "title">[];
  readonly className?: string;
}

const GITHUB_ISSUES_BASE_URL = "https://github.com/Rilaptra/erzysh-IBDS/issues";
const MAX_TITLE_LENGTH = 120;
const MAX_ISSUE_URL_LENGTH = 7500;

interface CategoryMeta {
  readonly id: FeedbackIssueCategory;
  readonly label: string;
  readonly shortDesc: string;
  readonly prefix: string;
  readonly template: string;
  readonly labels: string;
  readonly placeholder: string;
  readonly icon: ComponentType<{ className?: string }>;
}

const FEEDBACK_CATEGORIES: readonly CategoryMeta[] = [
  {
    id: "bug_report",
    label: "Laporan Bug",
    shortDesc: "Error visual, solver, atau tombol tidak berfungsi",
    prefix: "[Bug]",
    template: "bug_report.yml",
    labels: "bug,triage",
    placeholder:
      "Jelaskan masalah yang terjadi, kondisi beban/tumpuan, dan hasil yang diharapkan...",
    icon: BugIcon,
  },
  {
    id: "feature_request",
    label: "Saran Fitur",
    shortDesc: "Usulan peningkatan UX, SNI, atau ekspor baru",
    prefix: "[Fitur]",
    template: "feature_request.yml",
    labels: "enhancement",
    placeholder: "Jelaskan fitur yang Anda usulkan dan manfaatnya dalam alur desain struktur...",
    icon: LightbulbIcon,
  },
  {
    id: "validation_feedback",
    label: "Koreksi Validasi",
    shortDesc: "Selisih angka IBDS vs SAP2000 / Excel Manual",
    prefix: "[Validasi]",
    template: "validation_feedback.yml",
    labels: "validation,engineering",
    placeholder:
      "Cantumkan parameter input (L, tumpuan, profil, beban), hasil IBDS, hasil SAP2000/Excel, dan % selisih...",
    icon: ScaleIcon,
  },
  {
    id: "ux_question",
    label: "Pertanyaan UI / UX",
    shortDesc: "Diskusi tata letak, tutorial, atau kendali suara",
    prefix: "[UX]",
    template: "feature_request.yml",
    labels: "ux,question",
    placeholder: "Tulis pertanyaan atau masukan terkait kemudahan penggunaan antarmuka IBDS...",
    icon: HelpCircleIcon,
  },
];

const DEFAULT_VALIDATION_CASES: ReadonlyArray<Pick<ValidationCaseCard, "id" | "code" | "title">> = [
  { id: "val-01-simply-supported-udl", code: "VAL-01", title: "Balok Sendi-Rol Beban Merata" },
  {
    id: "val-02-indeterminate-fixed-cantilever",
    code: "VAL-02",
    title: "Balok Statis Tak Tentu Jepit-Jepit & Kantilever",
  },
  { id: "val-03-steel-sni1729", code: "VAL-03", title: "Geometri Fillet & Baja SNI 1729:2020" },
  {
    id: "val-04-concrete-sni2847",
    code: "VAL-04",
    title: "Lentur Whitney & Geser Beton SNI 2847:2019",
  },
];

const FOUR_STEPS_GUIDE = [
  {
    step: "01",
    title: "Pilih Kategori & Tulis Masukan",
    desc: "Pilih jenis masukan di kotak sebelah, lalu isi judul singkat dan penjelasan atau angka pembanding SAP2000/Excel.",
  },
  {
    step: "02",
    title: "Klik 'Kirim ke GitHub Issue'",
    desc: "Sistem otomatis menyusun format Markdown rapi lengkap dengan versi aplikasi dan membuka draft GitHub Issue di tab baru.",
  },
  {
    step: "03",
    title: "Masuk Akun GitHub (Gratis)",
    desc: "Belum punya akun? Daftar gratis 1 menit di github.com/signup. Teks yang sudah Anda tulis tetap tersimpan otomatis di URL.",
  },
  {
    step: "04",
    title: "Lampirkan Bukti & Submit",
    desc: "Anda dapat langsung paste tangkapan layar (Ctrl+V) di editor GitHub sebelum menekan 'Create / Submit New Issue'.",
  },
] as const;

const fieldClass =
  "w-full rounded-md border border-cyan-500/20 bg-[#060d19]/90 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus-visible:border-cyan-400/60 focus-visible:ring-2 focus-visible:ring-cyan-400/40 focus-visible:outline-none";

function getCompactDiagnostics(): string {
  if (typeof window === "undefined") {
    return `- **App Version:** v${APP_VERSION}\n- **WASM Engine:** v${WASM_VERSION}`;
  }
  const viewport = `${window.innerWidth}x${window.innerHeight}`;
  const platformTier =
    window.innerWidth <= 768 ? "ANDROID_COMPANION / Narrow" : "DESKTOP_WORKSTATION";
  const uaSummary = navigator.userAgent.slice(0, 96);
  return [
    `- **App Version:** \`v${APP_VERSION}\``,
    `- **WASM Engine:** \`v${WASM_VERSION}\``,
    `- **Platform Mode:** ${platformTier}`,
    `- **Viewport:** ${viewport}`,
    `- **Browser UA (ringkas):** \`${uaSummary}\``,
  ].join("\n");
}

function buildComposerIssuePayload(draft: FeedbackIssueDraft): {
  readonly fullTitle: string;
  readonly markdownBody: string;
  readonly url: string;
  readonly isTruncated: boolean;
} {
  const meta =
    FEEDBACK_CATEGORIES.find((item) => item.id === draft.category) ?? FEEDBACK_CATEGORIES[0]!;
  const trimmedTitle = draft.title.trim();
  const fullTitle = trimmedTitle.startsWith(meta.prefix)
    ? trimmedTitle
    : `${meta.prefix} ${trimmedTitle || "Masukan untuk erzysh-IBDS"}`;

  const bodyLines: string[] = [`## Kategori`, `${meta.label} (\`${meta.id}\`)`, ""];

  if (draft.category === "validation_feedback" && draft.validationCaseCode) {
    bodyLines.push("## Referensi Kasus Validasi", `- Kasus: \`${draft.validationCaseCode}\``, "");
  }

  bodyLines.push(
    "## Rincian Masukan",
    draft.description.trim() || "_(Tuliskan detail masukan Anda di sini)_",
    "",
  );

  if (draft.stepsOrContext?.trim()) {
    bodyLines.push("## Langkah Reproduksi / Konteks Teknis", draft.stepsOrContext.trim(), "");
  }

  if (draft.includeClientDiagnostics) {
    bodyLines.push("## Diagnostik Lingkungan Otomatis", getCompactDiagnostics(), "");
  }

  bodyLines.push("_Dikirim melalui Halaman Presentasi `/presentation` erzysh-IBDS._");

  const markdownBody = bodyLines.join("\n");

  const buildUrlWithBody = (bodyValue: string): string => {
    const params = new URLSearchParams({
      template: meta.template,
      title: fullTitle,
      labels: meta.labels,
      body: bodyValue,
    });
    return `${GITHUB_ISSUES_BASE_URL}/new?${params.toString()}`;
  };

  const fullUrl = buildUrlWithBody(markdownBody);
  if (fullUrl.length <= MAX_ISSUE_URL_LENGTH) {
    return { fullTitle, markdownBody, url: fullUrl, isTruncated: false };
  }

  // Guard against GitHub HTTP 414 URI Too Long by trimming body in URL while keeping full copyable Markdown.
  const suffix =
    "\n\n> [Teks dipotong karena batas URL — gunakan tombol Salin Markdown lalu tempel di sini]";
  let limit = Math.min(markdownBody.length, 3200);
  let candidateUrl = buildUrlWithBody(`${markdownBody.slice(0, limit)}${suffix}`);
  while (candidateUrl.length > MAX_ISSUE_URL_LENGTH && limit > 200) {
    limit = Math.floor(limit * 0.75);
    candidateUrl = buildUrlWithBody(`${markdownBody.slice(0, limit)}${suffix}`);
  }

  return { fullTitle, markdownBody, url: candidateUrl, isTruncated: true };
}

export function GitHubFeedbackComposer({
  id = "bab-10-masukan-issue",
  validationCases,
  className,
}: GitHubFeedbackComposerProps): ReactElement {
  const caseOptions =
    validationCases && validationCases.length > 0 ? validationCases : DEFAULT_VALIDATION_CASES;

  const [category, setCategory] = useState<FeedbackIssueCategory>("feature_request");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [stepsOrContext, setStepsOrContext] = useState("");
  const [validationCaseCode, setValidationCaseCode] = useState(caseOptions[0]?.code ?? "VAL-01");
  const [includeClientDiagnostics, setIncludeClientDiagnostics] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);

  const activeCategoryMeta =
    FEEDBACK_CATEGORIES.find((item) => item.id === category) ?? FEEDBACK_CATEGORIES[0]!;

  const issuePayload = useMemo(
    () =>
      buildComposerIssuePayload({
        category,
        title,
        description,
        stepsOrContext,
        validationCaseCode: category === "validation_feedback" ? validationCaseCode : undefined,
        includeClientDiagnostics,
      }),
    [category, description, includeClientDiagnostics, stepsOrContext, title, validationCaseCode],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!title.trim()) return;
    window.open(issuePayload.url, "_blank", "noopener,noreferrer");
  };

  const handleCopyMarkdown = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(
        `# ${issuePayload.fullTitle}\n\n${issuePayload.markdownBody}`,
      );
      setCopiedMarkdown(true);
      setTimeout(() => setCopiedMarkdown(false), 2400);
    } catch {
      setCopiedMarkdown(false);
    }
  };

  return (
    <section id={id} className={cn("scroll-mt-20 space-y-6", className)}>
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="border-cyan-400/30 bg-cyan-500/10 font-mono text-[10px] text-cyan-300"
          >
            BAB 10
          </Badge>
          <Badge
            variant="outline"
            className="border-violet-400/30 bg-violet-500/10 text-[10px] text-violet-200"
          >
            <MessageSquareIcon className="mr-1 size-3 text-violet-300" aria-hidden="true" />
            KOTAK MASUKAN &amp; GITHUB ISSUES
          </Badge>
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
          Masukan, Saran &amp; Pelaporan Validasi
        </h2>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-300/85">
          Temukan bug, punya usulan fitur, atau ingin melaporkan selisih hitungan SAP2000/Excel?
          Tulis langsung di bawah ini — sistem otomatis menyusun draft GitHub Issue siap kirim tanpa
          konfigurasi rumit.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[0.88fr_1.12fr]">
        <aside className={cn(glassPanelClass, "flex flex-col justify-between p-5")}>
          <div>
            <p className="font-mono text-[10px] font-bold tracking-wider text-cyan-300 uppercase">
              PANDUAN 4 LANGKAH (RAMAH NON-GITHUB)
            </p>
            <h3 className="mt-1 text-base font-bold text-slate-100">
              Cara Mengirim Masukan lewat GitHub Issues
            </h3>

            <ol className="mt-4 space-y-3">
              {FOUR_STEPS_GUIDE.map((item) => (
                <li
                  key={item.step}
                  className="flex gap-3 rounded-lg border border-cyan-500/15 bg-[#060d19]/80 p-3"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-cyan-400/40 bg-cyan-500/15 font-mono text-[10px] font-bold text-cyan-300">
                    {item.step}
                  </span>
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-slate-100">{item.title}</p>
                    <p className="text-[11px] leading-relaxed text-slate-400">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-cyan-500/15 pt-4">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="border-cyan-500/25 bg-[#060d19] text-[11px] text-slate-200 hover:border-cyan-400/50 hover:text-cyan-200"
            >
              <a href={GITHUB_ISSUES_BASE_URL} target="_blank" rel="noopener noreferrer">
                <span>Lihat Daftar Issues Eksisting</span>
                <ExternalLinkIcon className="size-3" aria-hidden="true" />
              </a>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-[11px] text-slate-400 hover:text-cyan-300"
            >
              <a href="https://github.com/signup" target="_blank" rel="noopener noreferrer">
                <span>Daftar GitHub Gratis ↗</span>
              </a>
            </Button>
          </div>
        </aside>

        <form onSubmit={handleSubmit} className={cn(glassPanelClass, "space-y-4 p-5")}>
          <fieldset className="space-y-2">
            <legend className="text-xs font-bold text-slate-200">1. Pilih Kategori Masukan</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {FEEDBACK_CATEGORIES.map((item) => {
                const Icon = item.icon;
                const isSelected = item.id === category;
                return (
                  <label
                    key={item.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 transition-colors",
                      isSelected
                        ? "border-cyan-400/60 bg-cyan-500/12"
                        : "border-cyan-500/15 bg-[#060d19]/75 hover:border-cyan-500/35",
                    )}
                  >
                    <input
                      type="radio"
                      name="feedback-category"
                      value={item.id}
                      checked={isSelected}
                      onChange={() => setCategory(item.id)}
                      className="sr-only"
                    />
                    <Icon
                      className={cn(
                        "mt-0.5 size-4 shrink-0",
                        isSelected ? "text-cyan-300" : "text-slate-400",
                      )}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-100">{item.label}</p>
                      <p className="text-[11px] leading-snug text-slate-400">{item.shortDesc}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor="feedback-title" className="text-xs font-semibold text-slate-200">
                2. Judul Singkat *
              </label>
              <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                {title.length}/{MAX_TITLE_LENGTH}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="shrink-0 rounded border border-cyan-500/25 bg-cyan-500/10 px-2 py-2 font-mono text-[11px] font-semibold text-cyan-300">
                {activeCategoryMeta.prefix}
              </span>
              <input
                id="feedback-title"
                type="text"
                required
                maxLength={MAX_TITLE_LENGTH}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Mis. Tambahkan preset kombinasi beban 1.2D + 1.6L"
                className={fieldClass}
              />
            </div>
          </div>

          {category === "validation_feedback" ? (
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-200">
                Referensi Studi Kasus Validasi
              </span>
              <select
                value={validationCaseCode}
                onChange={(e) => setValidationCaseCode(e.target.value)}
                className={fieldClass}
              >
                {caseOptions.map((c) => (
                  <option key={c.id} value={c.code}>
                    {c.code} — {c.title}
                  </option>
                ))}
                <option value="CUSTOM">Kasus Baru / Profil Kustom</option>
              </select>
            </label>
          ) : null}

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-200">3. Rincian Masukan</span>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={activeCategoryMeta.placeholder}
              className={fieldClass}
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-200">
              Langkah Reproduksi / Parameter Tambahan (opsional)
            </span>
            <textarea
              rows={2}
              value={stepsOrContext}
              onChange={(e) => setStepsOrContext(e.target.value)}
              placeholder="Mis. L = 6 m, Sendi-Rol, WF 300x150, q = 10 kN/m..."
              className={fieldClass}
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-cyan-500/15 bg-[#060d19]/80 px-3 py-2">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={includeClientDiagnostics}
                onChange={(e) => setIncludeClientDiagnostics(e.target.checked)}
                className="size-3.5 accent-cyan-400"
              />
              <span>
                Sertakan diagnostik otomatis (v{APP_VERSION}, WASM v{WASM_VERSION}, tanpa PII)
              </span>
            </label>

            <button
              type="button"
              onClick={() => setShowPreview((prev) => !prev)}
              className="flex items-center gap-1 font-mono text-[11px] text-cyan-300 hover:text-cyan-200"
            >
              <EyeIcon className="size-3.5" aria-hidden="true" />
              <span>{showPreview ? "Sembunyikan Pratinjau" : "Pratinjau Markdown"}</span>
            </button>
          </div>

          {issuePayload.isTruncated ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200"
            >
              <AlertTriangleIcon
                className="mt-0.5 size-4 shrink-0 text-amber-400"
                aria-hidden="true"
              />
              <span>
                Panjang teks mendekati batas URL GitHub ({MAX_ISSUE_URL_LENGTH} karakter). Gunakan
                tombol <strong>Salin Markdown</strong> lalu tempel (Ctrl+V) di editor GitHub agar
                seluruh isi tersimpan utuh.
              </span>
            </div>
          ) : null}

          {showPreview ? (
            <pre className="max-h-52 overflow-auto rounded-md border border-cyan-500/20 bg-[#040914] p-3 font-mono text-[11px] whitespace-pre-wrap text-slate-300">
              {`# ${issuePayload.fullTitle}\n\n${issuePayload.markdownBody}`}
            </pre>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyMarkdown}
              className="border-cyan-500/25 bg-[#060d19] text-xs text-slate-200"
            >
              {copiedMarkdown ? (
                <CheckIcon className="size-3.5 text-emerald-400" aria-hidden="true" />
              ) : (
                <CopyIcon className="size-3.5" aria-hidden="true" />
              )}
              <span>{copiedMarkdown ? "Markdown Disalin!" : "Salin Markdown"}</span>
            </Button>

            <Button
              type="submit"
              disabled={!title.trim()}
              className="bg-linear-to-r from-cyan-400 via-sky-400 to-violet-500 text-xs font-bold text-slate-950 hover:brightness-110 disabled:opacity-50"
            >
              <SendIcon className="size-3.5" aria-hidden="true" />
              <span>Kirim ke GitHub Issue</span>
              <ExternalLinkIcon className="size-3" aria-hidden="true" />
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}

export default GitHubFeedbackComposer;
