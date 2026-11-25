"use client";

import {
  CheckIcon,
  Code2Icon,
  CopyIcon,
  DownloadIcon,
  ImageIcon,
  PlusIcon,
  SaveIcon,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import type { ChangeEvent, FormEvent, MouseEvent, ReactElement } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { glassPanelClass } from "@/components/landing/ErzyshPageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  ValidationBenchmarkSource,
  ValidationCaseCard,
  ValidationCategory,
  ValidationComparisonRowInput,
  ValidationEvidenceKind,
  ValidationEvidenceMedia,
  ValidationRowStatus,
} from "@/types/presentation-types";

export interface ValidationCardBuilderDrawerProps {
  readonly open: boolean;
  readonly editingCard?: ValidationCaseCard | null;
  readonly initialCard?: ValidationCaseCard | null;
  readonly existingCount?: number;
  readonly onSave: (card: ValidationCaseCard) => void;
  readonly onDelete?: (cardId: string) => void;
  readonly onClose: () => void;
}

interface EditableModelInput {
  readonly id: string;
  readonly label: string;
  readonly value: string;
}

interface EditableRow {
  readonly id: string;
  readonly parameter: string;
  readonly symbol: string;
  readonly unit: string;
  readonly ibdsValue: string;
  readonly sap2000Value: string;
  readonly excelValue: string;
  readonly analyticalValue: string;
  readonly tolerancePercent: string;
}

const ZERO_EPSILON = 1e-9;
const DEFAULT_ZERO_ABS_TOL = 1e-4;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_COMPRESSED_DATA_URL_CHARS = 750_000;

const CATEGORY_OPTIONS: ReadonlyArray<{
  readonly value: ValidationCategory;
  readonly label: string;
}> = [
  { value: "DEFLECTION_MECHANICS", label: "Lendutan & Mekanika" },
  { value: "SHEAR_MOMENT_DIAGRAM", label: "Gaya Dalam (SFD / BMD)" },
  { value: "STEEL_SNI_1729", label: "Baja SNI 1729:2020" },
  { value: "CONCRETE_SNI_2847", label: "Beton SNI 2847:2019" },
  { value: "SECTION_GEOMETRY", label: "Geometri Profil" },
];

const SOURCE_OPTIONS: ReadonlyArray<{
  readonly value: ValidationBenchmarkSource;
  readonly label: string;
}> = [
  { value: "SAP2000_AND_EXCEL", label: "3-Arah (SAP2000 + Excel Manual)" },
  { value: "SAP2000", label: "SAP2000" },
  { value: "EXCEL_MANUAL", label: "Excel Manual" },
  { value: "ANALYTICAL", label: "Analitik Tertutup" },
];

const EVIDENCE_KIND_OPTIONS: ReadonlyArray<{
  readonly value: ValidationEvidenceKind;
  readonly label: string;
}> = [
  { value: "IBDS", label: "erzysh-IBDS" },
  { value: "SAP2000", label: "SAP2000" },
  { value: "EXCEL_MANUAL", label: "Excel Manual" },
];

const inputClass =
  "w-full rounded-md border border-cyan-500/20 bg-[#060d19]/90 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus-visible:border-cyan-400/60 focus-visible:ring-2 focus-visible:ring-cyan-400/40 focus-visible:outline-none";

function createUid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function slugifyCardId(code: string, title: string): string {
  const raw = `${code}-${title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return raw || createUid("val-draft");
}

function parseOptionalNumber(raw: string): number | undefined {
  const trimmed = raw.trim().replace(",", ".");
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function computeRelError(appValue: number, refValue: number): number {
  if (Math.abs(refValue) < ZERO_EPSILON) {
    return Math.abs(appValue - refValue) <= DEFAULT_ZERO_ABS_TOL ? 0 : 100;
  }
  return (Math.abs(appValue - refValue) / Math.abs(refValue)) * 100;
}

function previewRowStatus(row: EditableRow): {
  readonly maxError: number | null;
  readonly status: ValidationRowStatus;
} {
  const ibds = parseOptionalNumber(row.ibdsValue);
  if (ibds === undefined) {
    return { maxError: null, status: "PENDING_REF" };
  }

  const tol = parseOptionalNumber(row.tolerancePercent) ?? 1.0;
  const refs = [
    parseOptionalNumber(row.sap2000Value),
    parseOptionalNumber(row.excelValue),
    parseOptionalNumber(row.analyticalValue),
  ].filter((v): v is number => v !== undefined);

  if (refs.length === 0) {
    return { maxError: null, status: "PENDING_REF" };
  }

  const errors = refs.map((ref) => computeRelError(ibds, ref));
  const maxError = Math.max(...errors);

  if (maxError <= tol) return { maxError, status: "PASS" };
  if (maxError <= tol * 2.5) return { maxError, status: "WARN" };
  return { maxError, status: "FAIL" };
}

async function compressImageToDataUrl(file: File): Promise<{
  readonly src: string;
  readonly width: number;
  readonly height: number;
}> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Ukuran file gambar melebihi batas 5 MB.");
  }

  const objectUrl = URL.createObjectURL(file);
  const canvas = document.createElement("canvas");

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Gagal membaca berkas gambar."));
      image.src = objectUrl;
    });

    const maxDim = 1280;
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    const targetWidth = Math.max(1, Math.round(img.naturalWidth * scale));
    const targetHeight = Math.max(1, Math.round(img.naturalHeight * scale));

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D context tidak tersedia.");
    }
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    let dataUrl = canvas.toDataURL("image/webp", 0.82);
    if (!dataUrl.startsWith("data:image/webp")) {
      dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    }

    if (dataUrl.length > MAX_COMPRESSED_DATA_URL_CHARS) {
      dataUrl = canvas.toDataURL("image/jpeg", 0.65);
    }

    return { src: dataUrl, width: targetWidth, height: targetHeight };
  } finally {
    URL.revokeObjectURL(objectUrl);
    canvas.width = 0;
    canvas.height = 0;
  }
}

function buildTypeScriptCardSnippet(card: ValidationCaseCard): string {
  const sanitized: ValidationCaseCard = {
    ...card,
    origin: "REPO_SEED",
    verificationStatus: "VERIFIED",
    evidenceMedia: card.evidenceMedia.map((media) => {
      if (!media.src.startsWith("data:")) return media;
      const extName =
        media.kind === "IBDS" ? "ibds" : media.kind === "SAP2000" ? "sap2000" : "excel";
      return {
        ...media,
        src: `/presentation/validation/${card.id}/${extName}.png`,
      };
    }),
  };

  return `// Tempel ke array VALIDATION_CASES di src/data/presentation/validation-cases.ts\n${JSON.stringify(sanitized, null, 2)},`;
}

function createDefaultRow(): EditableRow {
  return {
    id: createUid("row"),
    parameter: "Lendutan Maksimum",
    symbol: "Δ_max",
    unit: "mm",
    ibdsValue: "",
    sap2000Value: "",
    excelValue: "",
    analyticalValue: "",
    tolerancePercent: "1.0",
  };
}

export function ValidationCardBuilderDrawer({
  open,
  editingCard = null,
  initialCard = null,
  existingCount = 4,
  onSave,
  onDelete,
  onClose,
}: ValidationCardBuilderDrawerProps): ReactElement {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeEditingCard = editingCard ?? initialCard ?? null;

  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [category, setCategory] = useState<ValidationCategory>("DEFLECTION_MECHANICS");
  const [benchmarkSource, setBenchmarkSource] =
    useState<ValidationBenchmarkSource>("SAP2000_AND_EXCEL");
  const [sniClausesText, setSniClausesText] = useState("");
  const [simulatorHref, setSimulatorHref] = useState("/simulator?mode=MODE_A_EXTERNAL_LOADS");
  const [notes, setNotes] = useState("");
  const [modelInputs, setModelInputs] = useState<readonly EditableModelInput[]>([]);
  const [rows, setRows] = useState<readonly EditableRow[]>([]);
  const [mediaItems, setMediaItems] = useState<readonly ValidationEvidenceMedia[]>([]);

  const [uploadKind, setUploadKind] = useState<ValidationEvidenceKind>("SAP2000");
  const [uploadCaption, setUploadCaption] = useState("");
  const [uploadSoftware, setUploadSoftware] = useState("SAP2000 v22.2.0");
  const [uploadRef, setUploadRef] = useState("");
  const [uploadPathFallback, setUploadPathFallback] = useState("");

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    dialog.setAttribute("closedby", "any");

    if (open) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setErrorMessage(null);
    setCopiedSnippet(false);

    if (activeEditingCard) {
      setCode(activeEditingCard.code);
      setTitle(activeEditingCard.title);
      setSummary(activeEditingCard.summary);
      setCategory(activeEditingCard.category);
      setBenchmarkSource(activeEditingCard.benchmarkSource);
      setSniClausesText(activeEditingCard.sniClauses.join(", "));
      setSimulatorHref(activeEditingCard.simulatorHref ?? "/simulator");
      setNotes(activeEditingCard.notes ?? "");
      setModelInputs(
        activeEditingCard.modelInputs.map((item) => ({
          id: createUid("mi"),
          label: item.label,
          value: item.value,
        })),
      );
      setRows(
        activeEditingCard.comparisonRows.map((row) => ({
          id: row.id,
          parameter: row.parameter,
          symbol: row.symbol,
          unit: row.unit,
          ibdsValue: String(row.ibdsValue),
          sap2000Value: row.sap2000Value !== undefined ? String(row.sap2000Value) : "",
          excelValue: row.excelValue !== undefined ? String(row.excelValue) : "",
          analyticalValue: row.analyticalValue !== undefined ? String(row.analyticalValue) : "",
          tolerancePercent: String(row.tolerancePercent),
        })),
      );
      setMediaItems(activeEditingCard.evidenceMedia);
      return;
    }

    const nextNum = String(existingCount + 1).padStart(2, "0");
    setCode(`VAL-${nextNum}`);
    setTitle("");
    setSummary("");
    setCategory("DEFLECTION_MECHANICS");
    setBenchmarkSource("SAP2000_AND_EXCEL");
    setSniClausesText("SNI 1729:2020 Pasal F2, Euler-Bernoulli");
    setSimulatorHref("/simulator?mode=MODE_A_EXTERNAL_LOADS");
    setNotes("");
    setModelInputs([
      { id: createUid("mi"), label: "Bentang L", value: "6.0 m" },
      { id: createUid("mi"), label: "Tumpuan", value: "Sendi-Rol" },
    ]);
    setRows([createDefaultRow()]);
    setMediaItems([]);
  }, [activeEditingCard, existingCount, open]);

  const draftCardPreview = useMemo<ValidationCaseCard | null>(() => {
    const cleanCode = code.trim();
    const cleanTitle = title.trim();
    if (!cleanCode || !cleanTitle) return null;

    const validRows: ValidationComparisonRowInput[] = [];
    for (const row of rows) {
      const ibds = parseOptionalNumber(row.ibdsValue);
      if (ibds === undefined || !row.parameter.trim()) continue;
      validRows.push({
        id: row.id,
        parameter: row.parameter.trim(),
        symbol: row.symbol.trim() || "val",
        unit: row.unit.trim() || "-",
        ibdsValue: ibds,
        sap2000Value: parseOptionalNumber(row.sap2000Value),
        excelValue: parseOptionalNumber(row.excelValue),
        analyticalValue: parseOptionalNumber(row.analyticalValue),
        tolerancePercent: Math.max(0.01, parseOptionalNumber(row.tolerancePercent) ?? 1.0),
      });
    }

    if (validRows.length === 0) return null;

    const id =
      activeEditingCard && activeEditingCard.origin === "USER_LOCAL_DRAFT"
        ? activeEditingCard.id
        : slugifyCardId(cleanCode, cleanTitle);

    const hasRefValues = validRows.some(
      (r) =>
        r.sap2000Value !== undefined ||
        r.excelValue !== undefined ||
        r.analyticalValue !== undefined,
    );

    return {
      id,
      code: cleanCode,
      title: cleanTitle,
      summary:
        summary.trim() || "Studi kasus perbandingan numerik IBDS terhadap software referensi.",
      category,
      benchmarkSource,
      verificationStatus: hasRefValues ? "DRAFT_LOCAL" : "TEMPLATE_PLACEHOLDER",
      origin: "USER_LOCAL_DRAFT",
      modelInputs: modelInputs
        .filter((item) => item.label.trim() && item.value.trim())
        .map((item) => ({ label: item.label.trim(), value: item.value.trim() })),
      comparisonRows: validRows,
      evidenceMedia: mediaItems,
      sniClauses: sniClausesText
        .split(",")
        .map((clause) => clause.trim())
        .filter(Boolean),
      simulatorHref: simulatorHref.trim() || undefined,
      notes: notes.trim() || undefined,
    };
  }, [
    activeEditingCard,
    benchmarkSource,
    category,
    code,
    mediaItems,
    modelInputs,
    notes,
    rows,
    simulatorHref,
    sniClausesText,
    summary,
    title,
  ]);

  const handleBackdropClick = (event: MouseEvent<HTMLDialogElement>): void => {
    const dialog = dialogRef.current;
    if (!dialog || event.target !== dialog) return;
    if (event.clientX === 0 && event.clientY === 0) return;

    const rect = dialog.getBoundingClientRect();
    const isOutside =
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom;
    if (isOutside) {
      onClose();
    }
  };

  const handleUploadFile = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setErrorMessage(null);
    try {
      const compressed = await compressImageToDataUrl(file);
      const labelPrefix =
        uploadKind === "IBDS"
          ? "Tangkapan Layar erzysh-IBDS"
          : uploadKind === "SAP2000"
            ? "Tangkapan Layar SAP2000"
            : "Lembar Hitungan Excel Manual";

      const newMedia: ValidationEvidenceMedia = {
        id: createUid("ev"),
        kind: uploadKind,
        src: compressed.src,
        alt: `${labelPrefix} — ${title.trim() || code.trim()}`,
        caption: uploadCaption.trim() || `${labelPrefix} (${file.name})`,
        width: compressed.width,
        height: compressed.height,
        softwareVersion: uploadSoftware.trim() || undefined,
        sheetOrModelRef: uploadRef.trim() || undefined,
        capturedAt: new Date().toISOString().slice(0, 10),
      };

      setMediaItems((prev) => [...prev, newMedia]);
      setUploadCaption("");
      setUploadRef("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Gagal memproses gambar.");
    }
  };

  const handleAddStaticMediaPath = (): void => {
    const cleanPath = uploadPathFallback.trim();
    if (!cleanPath) return;

    const newMedia: ValidationEvidenceMedia = {
      id: createUid("ev"),
      kind: uploadKind,
      src: cleanPath,
      alt: `Bukti ${uploadKind} — ${title.trim() || code.trim()}`,
      caption: uploadCaption.trim() || `Bukti visual ${uploadKind}`,
      width: 1280,
      height: 720,
      softwareVersion: uploadSoftware.trim() || undefined,
      sheetOrModelRef: uploadRef.trim() || undefined,
      capturedAt: new Date().toISOString().slice(0, 10),
    };

    setMediaItems((prev) => [...prev, newMedia]);
    setUploadPathFallback("");
    setUploadCaption("");
    setUploadRef("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!draftCardPreview) {
      setErrorMessage(
        "Pastikan Kode, Judul, dan minimal 1 baris parameter dengan nilai angka IBDS terisi valid.",
      );
      return;
    }
    setErrorMessage(null);
    onSave(draftCardPreview);
    onClose();
  };

  const handleCopyTsSnippet = async (): Promise<void> => {
    if (!draftCardPreview) {
      setErrorMessage(
        "Lengkapi data utama & minimal 1 baris perbandingan sebelum menyalin snippet.",
      );
      return;
    }
    try {
      await navigator.clipboard.writeText(buildTypeScriptCardSnippet(draftCardPreview));
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 2400);
    } catch {
      setErrorMessage("Gagal mengakses clipboard browser.");
    }
  };

  const handleDownloadJson = (): void => {
    if (!draftCardPreview) {
      setErrorMessage("Lengkapi data utama & minimal 1 baris perbandingan sebelum ekspor JSON.");
      return;
    }
    const blob = new Blob([JSON.stringify(draftCardPreview, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${draftCardPreview.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="validation-builder-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={handleBackdropClick}
      className={cn(
        glassPanelClass,
        "text-foreground m-0 ml-auto h-dvh max-h-dvh w-full max-w-3xl overflow-hidden overscroll-contain rounded-none border-y-0 border-r-0 border-l border-cyan-400/30 bg-[#071020]/96 p-0 shadow-2xl shadow-black/80 backdrop:bg-black/75 backdrop:backdrop-blur-xs",
      )}
    >
      <form onSubmit={handleSubmit} className="flex h-full flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-cyan-500/20 bg-[#0a162a]/90 px-4 py-3">
          <div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="border-cyan-400/35 bg-cyan-500/15 text-[10px] font-semibold text-cyan-200"
              >
                TIER-B BUILDER
              </Badge>
              <h3 id="validation-builder-title" className="text-sm font-bold text-slate-100">
                {activeEditingCard
                  ? `Edit Card ${activeEditingCard.code}`
                  : "Tambah Card Bukti Validasi"}
              </h3>
            </div>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Simpan otomatis ke localStorage & ekspor 1-klik ke TypeScript / JSON permanen.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 px-2 text-slate-300 hover:bg-slate-800 hover:text-white"
            aria-label="Tutup drawer card validasi"
          >
            <XIcon className="size-4" aria-hidden="true" />
          </Button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {errorMessage ? (
            <div
              role="alert"
              className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200"
            >
              {errorMessage}
            </div>
          ) : null}

          <fieldset className="space-y-3 rounded-lg border border-cyan-500/15 bg-[#081224]/70 p-3">
            <legend className="px-1 text-[11px] font-bold tracking-wider text-cyan-300 uppercase">
              1. Identitas Studi Kasus
            </legend>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1">
                <span className="text-[11px] font-medium text-slate-300">Kode Kasus *</span>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="VAL-05"
                  className={cn(inputClass, "font-mono")}
                />
              </label>
              <label className="space-y-1 sm:col-span-2">
                <span className="text-[11px] font-medium text-slate-300">Judul Studi Kasus *</span>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Mis. Balok WF 300x150 Sendi-Rol Beban Terpusat 50 kN"
                  className={inputClass}
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-[11px] font-medium text-slate-300">Kategori Pengujian</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ValidationCategory)}
                  className={inputClass}
                >
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-medium text-slate-300">Sumber Pembanding</span>
                <select
                  value={benchmarkSource}
                  onChange={(e) => setBenchmarkSource(e.target.value as ValidationBenchmarkSource)}
                  className={inputClass}
                >
                  {SOURCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block space-y-1">
              <span className="text-[11px] font-medium text-slate-300">Ringkasan Kasus</span>
              <textarea
                rows={2}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Ringkas konfigurasi struktur dan tujuan validasi..."
                className={inputClass}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-[11px] font-medium text-slate-300">
                  Pasal SNI / Acuan (pisahkan koma)
                </span>
                <input
                  type="text"
                  value={sniClausesText}
                  onChange={(e) => setSniClausesText(e.target.value)}
                  placeholder="SNI 1729:2020 Pasal F2, Tabel B4.1b"
                  className={inputClass}
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-medium text-slate-300">
                  Deep-Link Simulator (opsional)
                </span>
                <input
                  type="text"
                  value={simulatorHref}
                  onChange={(e) => setSimulatorHref(e.target.value)}
                  placeholder="/simulator?mode=MODE_A_EXTERNAL_LOADS"
                  className={cn(inputClass, "font-mono")}
                />
              </label>
            </div>
          </fieldset>

          <fieldset className="space-y-2.5 rounded-lg border border-cyan-500/15 bg-[#081224]/70 p-3">
            <div className="flex items-center justify-between">
              <legend className="px-1 text-[11px] font-bold tracking-wider text-cyan-300 uppercase">
                2. Parameter Input Model
              </legend>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 border-cyan-500/25 bg-[#060d19] px-2 text-[11px]"
                onClick={() =>
                  setModelInputs((prev) => [...prev, { id: createUid("mi"), label: "", value: "" }])
                }
              >
                <PlusIcon className="size-3" aria-hidden="true" />
                <span>Tambah Input</span>
              </Button>
            </div>

            <div className="space-y-2">
              {modelInputs.map((item) => (
                <div key={item.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) =>
                      setModelInputs((prev) =>
                        prev.map((m) => (m.id === item.id ? { ...m, label: e.target.value } : m)),
                      )
                    }
                    placeholder="Label (mis. Profil Baja)"
                    className={inputClass}
                  />
                  <input
                    type="text"
                    value={item.value}
                    onChange={(e) =>
                      setModelInputs((prev) =>
                        prev.map((m) => (m.id === item.id ? { ...m, value: e.target.value } : m)),
                      )
                    }
                    placeholder="Nilai (mis. WF 300x150x36.7)"
                    className={cn(inputClass, "font-mono")}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-slate-400 hover:text-red-400"
                    onClick={() => setModelInputs((prev) => prev.filter((m) => m.id !== item.id))}
                    aria-label="Hapus parameter input"
                  >
                    <Trash2Icon className="size-3.5" aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2.5 rounded-lg border border-cyan-500/15 bg-[#081224]/70 p-3">
            <div className="flex items-center justify-between">
              <legend className="px-1 text-[11px] font-bold tracking-wider text-cyan-300 uppercase">
                3. Tabel Perbandingan Angka (Live % Error)
              </legend>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 border-cyan-500/25 bg-[#060d19] px-2 text-[11px]"
                onClick={() => setRows((prev) => [...prev, createDefaultRow()])}
              >
                <PlusIcon className="size-3" aria-hidden="true" />
                <span>Tambah Baris</span>
              </Button>
            </div>

            <div className="space-y-2.5">
              {rows.map((row) => {
                const live = previewRowStatus(row);
                const statusClass =
                  live.status === "PASS"
                    ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-300"
                    : live.status === "WARN"
                      ? "border-amber-400/40 bg-amber-500/15 text-amber-300"
                      : live.status === "FAIL"
                        ? "border-red-400/40 bg-red-500/15 text-red-300"
                        : "border-slate-600/50 bg-slate-800/70 text-slate-300";

                return (
                  <div
                    key={row.id}
                    className="space-y-2 rounded-md border border-cyan-500/15 bg-[#050b16]/90 p-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn("font-mono text-[10px]", statusClass)}
                        >
                          {live.status}
                          {live.maxError !== null ? ` · ${live.maxError.toFixed(2)}%` : ""}
                        </Badge>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={rows.length <= 1}
                        className="h-6 px-1.5 text-slate-400 hover:text-red-400 disabled:opacity-30"
                        onClick={() => setRows((prev) => prev.filter((r) => r.id !== row.id))}
                        aria-label="Hapus baris perbandingan"
                      >
                        <Trash2Icon className="size-3.5" aria-hidden="true" />
                      </Button>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-3">
                      <input
                        type="text"
                        value={row.parameter}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((r) =>
                              r.id === row.id ? { ...r, parameter: e.target.value } : r,
                            ),
                          )
                        }
                        placeholder="Parameter (mis. Lendutan Maks)"
                        className={inputClass}
                      />
                      <input
                        type="text"
                        value={row.symbol}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((r) =>
                              r.id === row.id ? { ...r, symbol: e.target.value } : r,
                            ),
                          )
                        }
                        placeholder="Simbol (Δ_max)"
                        className={cn(inputClass, "font-mono")}
                      />
                      <input
                        type="text"
                        value={row.unit}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((r) => (r.id === row.id ? { ...r, unit: e.target.value } : r)),
                          )
                        }
                        placeholder="Satuan (mm / kN / kNm)"
                        className={cn(inputClass, "font-mono")}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                      <label className="space-y-0.5">
                        <span className="text-[10px] text-cyan-300">IBDS *</span>
                        <input
                          type="number"
                          step="any"
                          required
                          value={row.ibdsValue}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((r) =>
                                r.id === row.id ? { ...r, ibdsValue: e.target.value } : r,
                              ),
                            )
                          }
                          placeholder="-8.4375"
                          className={cn(inputClass, "font-mono tabular-nums")}
                        />
                      </label>
                      <label className="space-y-0.5">
                        <span className="text-[10px] text-sky-300">SAP2000</span>
                        <input
                          type="number"
                          step="any"
                          value={row.sap2000Value}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((r) =>
                                r.id === row.id ? { ...r, sap2000Value: e.target.value } : r,
                              ),
                            )
                          }
                          placeholder="-8.44"
                          className={cn(inputClass, "font-mono tabular-nums")}
                        />
                      </label>
                      <label className="space-y-0.5">
                        <span className="text-[10px] text-emerald-300">Excel Manual</span>
                        <input
                          type="number"
                          step="any"
                          value={row.excelValue}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((r) =>
                                r.id === row.id ? { ...r, excelValue: e.target.value } : r,
                              ),
                            )
                          }
                          placeholder="-8.4375"
                          className={cn(inputClass, "font-mono tabular-nums")}
                        />
                      </label>
                      <label className="space-y-0.5">
                        <span className="text-[10px] text-violet-300">Analitik</span>
                        <input
                          type="number"
                          step="any"
                          value={row.analyticalValue}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((r) =>
                                r.id === row.id ? { ...r, analyticalValue: e.target.value } : r,
                              ),
                            )
                          }
                          placeholder="Opsional"
                          className={cn(inputClass, "font-mono tabular-nums")}
                        />
                      </label>
                      <label className="space-y-0.5">
                        <span className="text-[10px] text-slate-400">Tol (%)</span>
                        <input
                          type="number"
                          step="0.1"
                          min="0.01"
                          value={row.tolerancePercent}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((r) =>
                                r.id === row.id ? { ...r, tolerancePercent: e.target.value } : r,
                              ),
                            )
                          }
                          className={cn(inputClass, "font-mono tabular-nums")}
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="space-y-3 rounded-lg border border-cyan-500/15 bg-[#081224]/70 p-3">
            <legend className="px-1 text-[11px] font-bold tracking-wider text-cyan-300 uppercase">
              4. Lampiran Bukti Visual (Screenshot IBDS / SAP2000 / Excel)
            </legend>

            <div className="grid gap-2 sm:grid-cols-3">
              <select
                value={uploadKind}
                onChange={(e) => {
                  const nextKind = e.target.value as ValidationEvidenceKind;
                  setUploadKind(nextKind);
                  setUploadSoftware(
                    nextKind === "SAP2000"
                      ? "SAP2000 v22.2.0"
                      : nextKind === "EXCEL_MANUAL"
                        ? "Microsoft Excel 365"
                        : "erzysh-IBDS v0.6.21",
                  );
                }}
                className={inputClass}
              >
                {EVIDENCE_KIND_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={uploadSoftware}
                onChange={(e) => setUploadSoftware(e.target.value)}
                placeholder="Versi Software"
                className={inputClass}
              />
              <input
                type="text"
                value={uploadRef}
                onChange={(e) => setUploadRef(e.target.value)}
                placeholder="Sheet / Model Ref"
                className={inputClass}
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                type="text"
                value={uploadCaption}
                onChange={(e) => setUploadCaption(e.target.value)}
                placeholder="Caption gambar bukti (mis. Deformed shape SAP2000 U3 = -8.44 mm)"
                className={inputClass}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleUploadFile}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="border-cyan-400/35 bg-cyan-500/10 text-xs text-cyan-200 hover:bg-cyan-500/20"
              >
                <UploadIcon className="size-3.5" aria-hidden="true" />
                <span>Unggah Gambar</span>
              </Button>
            </div>

            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                type="text"
                value={uploadPathFallback}
                onChange={(e) => setUploadPathFallback(e.target.value)}
                placeholder="Atau path statis repo: /presentation/validation/val-05/sap2000.png"
                className={cn(inputClass, "font-mono")}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddStaticMediaPath}
                className="border-cyan-500/20 bg-[#060d19] text-xs"
              >
                <PlusIcon className="size-3.5" aria-hidden="true" />
                <span>Tambah Path</span>
              </Button>
            </div>

            {mediaItems.length > 0 ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {mediaItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-cyan-500/15 bg-[#050b16] p-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <ImageIcon className="size-4 shrink-0 text-cyan-400" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-semibold text-slate-200">
                          {item.kind} · {item.caption}
                        </p>
                        <p className="truncate font-mono text-[10px] text-slate-400">
                          {item.src.startsWith("data:") ? "[Local WebP Preview]" : item.src}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1.5 text-slate-400 hover:text-red-400"
                      onClick={() =>
                        setMediaItems((prev) => prev.filter((media) => media.id !== item.id))
                      }
                      aria-label="Hapus bukti gambar"
                    >
                      <Trash2Icon className="size-3.5" aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </fieldset>

          <label className="block space-y-1">
            <span className="text-[11px] font-medium text-slate-300">
              Catatan Teknis (opsional)
            </span>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Mis. Perbedaan <0.1% disebabkan shear deformation aktif pada SAP2000..."
              className={inputClass}
            />
          </label>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-cyan-500/20 bg-[#0a162a]/90 px-4 py-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyTsSnippet}
              className="border-violet-500/30 bg-violet-500/10 text-[11px] text-violet-200 hover:bg-violet-500/20"
            >
              {copiedSnippet ? (
                <CheckIcon className="size-3.5 text-emerald-400" aria-hidden="true" />
              ) : (
                <Code2Icon className="size-3.5" aria-hidden="true" />
              )}
              <span>{copiedSnippet ? "Snippet TS Disalin!" : "Salin Snippet TS"}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadJson}
              className="border-cyan-500/25 bg-[#060d19] text-[11px] text-slate-200"
            >
              <DownloadIcon className="size-3.5" aria-hidden="true" />
              <span>Ekspor JSON</span>
            </Button>
            {activeEditingCard && activeEditingCard.origin === "USER_LOCAL_DRAFT" && onDelete ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  onDelete(activeEditingCard.id);
                  onClose();
                }}
                className="text-[11px] text-red-400 hover:bg-red-500/10 hover:text-red-300"
              >
                <Trash2Icon className="size-3.5" aria-hidden="true" />
                <span>Hapus Draft</span>
              </Button>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} className="text-xs">
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              className="bg-linear-to-r from-cyan-400 via-sky-400 to-violet-500 text-xs font-bold text-slate-950 hover:brightness-110"
            >
              <SaveIcon className="size-3.5" aria-hidden="true" />
              <span>Simpan ke Kartu Validasi</span>
            </Button>
          </div>
        </footer>
      </form>
    </dialog>
  );
}

export default ValidationCardBuilderDrawer;
