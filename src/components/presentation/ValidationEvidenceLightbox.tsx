"use client";

import {
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Columns2Icon,
  ImageIcon,
  Maximize2Icon,
  XIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react";
import type { MouseEvent, ReactElement } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { glassPanelClass } from "@/components/landing/ErzyshPageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  ValidationCaseCard,
  ValidationEvidenceKind,
  ValidationEvidenceMedia,
} from "@/types/presentation-types";

export interface ValidationEvidenceLightboxProps {
  readonly open?: boolean;
  readonly card?: ValidationCaseCard | null;
  readonly media?: readonly ValidationEvidenceMedia[];
  readonly title?: string;
  readonly initialMediaId?: string | null;
  readonly onClose: () => void;
}

type LightboxViewMode = "single" | "compare";

const ZOOM_STEPS = [100, 150, 200] as const;

const KIND_META: Record<
  ValidationEvidenceKind,
  { readonly label: string; readonly badgeClass: string }
> = {
  IBDS: {
    label: "erzysh-IBDS",
    badgeClass: "border-cyan-400/40 bg-cyan-500/15 text-cyan-200",
  },
  SAP2000: {
    label: "SAP2000",
    badgeClass: "border-sky-400/40 bg-sky-500/15 text-sky-200",
  },
  EXCEL_MANUAL: {
    label: "Excel Manual",
    badgeClass: "border-emerald-400/40 bg-emerald-500/15 text-emerald-200",
  },
};

function EvidenceImageFrame({
  item,
  zoomPercent,
  hasError,
  onImageError,
}: {
  readonly item: ValidationEvidenceMedia;
  readonly zoomPercent: number;
  readonly hasError: boolean;
  readonly onImageError: (src: string) => void;
}): ReactElement {
  const kindStyle = KIND_META[item.kind];

  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-cyan-500/20 bg-[#050b16]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-500/15 bg-[#091324] px-3 py-2">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn("text-[10px] font-semibold", kindStyle.badgeClass)}
          >
            {kindStyle.label}
          </Badge>
          {item.softwareVersion ? (
            <span className="font-mono text-[11px] text-slate-300">{item.softwareVersion}</span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] text-slate-400">
          {item.sheetOrModelRef ? <span>{item.sheetOrModelRef}</span> : null}
          {item.capturedAt ? (
            <span className="rounded bg-slate-800/80 px-1.5 py-0.5 text-slate-300">
              {item.capturedAt}
            </span>
          ) : null}
        </div>
      </div>

      <div className="relative flex max-h-[58dvh] min-h-[260px] w-full items-center justify-center overflow-auto bg-[#030712] p-3">
        {hasError || !item.src ? (
          <div className="flex max-w-md flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-cyan-500/25 bg-[#081224]/70 px-5 py-8 text-center">
            <ImageIcon className="size-8 text-cyan-400/60" aria-hidden="true" />
            <p className="text-xs font-semibold text-slate-200">Slot Bukti Visual Belum Tersedia</p>
            <p className="text-[11px] leading-relaxed text-slate-400">
              Letakkan berkas tangkapan layar pada lokasi di bawah ini atau unggah melalui Drawer
              Card Validasi untuk pratinjau instan:
            </p>
            <code className="max-w-full rounded border border-cyan-500/20 bg-[#040914] px-2.5 py-1 font-mono text-[10px] break-all text-cyan-300">
              {item.src || "/presentation/validation/<case-id>/evidence.png"}
            </code>
          </div>
        ) : (
          <img
            src={item.src}
            alt={item.alt}
            width={item.width}
            height={item.height}
            loading="lazy"
            onError={() => onImageError(item.src)}
            style={{
              width: `${zoomPercent}%`,
              maxWidth: zoomPercent === 100 ? "100%" : "none",
            }}
            className="h-auto rounded border border-slate-800 object-contain transition-[width] duration-200"
          />
        )}
      </div>

      <div className="border-t border-cyan-500/15 bg-[#081020] px-3 py-2 text-xs text-slate-300">
        {item.caption}
      </div>
    </div>
  );
}

export function ValidationEvidenceLightbox({
  open,
  card = null,
  media,
  title,
  initialMediaId = null,
  onClose,
}: ValidationEvidenceLightboxProps): ReactElement {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const mediaList = useMemo<readonly ValidationEvidenceMedia[]>(
    () => media ?? card?.evidenceMedia ?? [],
    [card, media],
  );
  const isOpen = open ?? Boolean(card || (media && media.length > 0));

  const [viewMode, setViewMode] = useState<LightboxViewMode>("single");
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [compareLeftId, setCompareLeftId] = useState<string>("");
  const [compareRightId, setCompareRightId] = useState<string>("");
  const [failedSrcs, setFailedSrcs] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    // Progressive enhancement for native light-dismiss where supported.
    dialog.setAttribute("closedby", "any");

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const initialIdx = initialMediaId
      ? mediaList.findIndex((item) => item.id === initialMediaId)
      : 0;
    setActiveIndex(initialIdx >= 0 ? initialIdx : 0);
    setZoomIndex(0);
    setViewMode("single");

    const ibdsItem = mediaList.find((item) => item.kind === "IBDS") ?? mediaList[0];
    const refItem =
      mediaList.find((item) => item.kind === "SAP2000" && item.id !== ibdsItem?.id) ??
      mediaList.find((item) => item.kind === "EXCEL_MANUAL" && item.id !== ibdsItem?.id) ??
      mediaList[1] ??
      ibdsItem;

    setCompareLeftId(ibdsItem?.id ?? "");
    setCompareRightId(refItem?.id ?? "");
  }, [initialMediaId, isOpen, mediaList]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (mediaList.length <= 1 || viewMode !== "single") return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        event.stopPropagation();
        setActiveIndex((prev) => (prev + 1) % mediaList.length);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        event.stopPropagation();
        setActiveIndex((prev) => (prev - 1 + mediaList.length) % mediaList.length);
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [isOpen, mediaList.length, viewMode]);

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

  const handleImageError = (src: string): void => {
    setFailedSrcs((prev) => {
      if (prev.has(src)) return prev;
      const next = new Set(prev);
      next.add(src);
      return next;
    });
  };

  const safeIndex = mediaList.length > 0 ? Math.min(activeIndex, mediaList.length - 1) : 0;
  const currentMedia = mediaList[safeIndex] ?? null;
  const zoomPercent = ZOOM_STEPS[zoomIndex] ?? 100;
  const leftMedia = mediaList.find((item) => item.id === compareLeftId) ?? mediaList[0] ?? null;
  const rightMedia =
    mediaList.find((item) => item.id === compareRightId) ?? mediaList[1] ?? leftMedia;

  const headingTitle = title ?? (card ? `${card.code} — ${card.title}` : "Bukti Validasi Visual");

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="validation-lightbox-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={handleBackdropClick}
      className={cn(
        glassPanelClass,
        "text-foreground m-auto max-h-[92dvh] w-[min(96vw,1160px)] overflow-hidden overscroll-contain border-cyan-400/30 bg-[#071020]/95 p-0 shadow-2xl shadow-black/80 backdrop:bg-black/80 backdrop:backdrop-blur-sm",
      )}
    >
      <div className="flex max-h-[92dvh] flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-500/20 bg-[#0a162a]/90 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <CheckCircle2Icon className="size-4 shrink-0 text-emerald-400" aria-hidden="true" />
              <h3
                id="validation-lightbox-title"
                className="truncate text-sm font-bold tracking-tight text-slate-100"
              >
                {headingTitle}
              </h3>
            </div>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Inspeksi visual bukti pembanding IBDS, SAP2000, dan Excel Manual ({mediaList.length}{" "}
              berkas)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <div className="inline-flex rounded-md border border-cyan-500/20 bg-[#050b16] p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("single")}
                className={cn(
                  "flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-medium transition-colors",
                  viewMode === "single"
                    ? "bg-cyan-500/20 text-cyan-200"
                    : "text-slate-400 hover:text-slate-200",
                )}
              >
                <Maximize2Icon className="size-3.5" aria-hidden="true" />
                <span>Tunggal</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("compare")}
                disabled={mediaList.length < 2}
                className={cn(
                  "flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                  viewMode === "compare"
                    ? "bg-cyan-500/20 text-cyan-200"
                    : "text-slate-400 hover:text-slate-200",
                )}
              >
                <Columns2Icon className="size-3.5" aria-hidden="true" />
                <span>Side-by-Side</span>
              </button>
            </div>

            {viewMode === "single" ? (
              <div className="inline-flex items-center gap-1 rounded-md border border-cyan-500/20 bg-[#050b16] px-1.5 py-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-slate-300"
                  disabled={zoomIndex === 0}
                  onClick={() => setZoomIndex((prev) => Math.max(0, prev - 1))}
                  aria-label="Perkecil gambar"
                >
                  <ZoomOutIcon className="size-3.5" aria-hidden="true" />
                </Button>
                <span className="min-w-10 text-center font-mono text-[11px] text-cyan-300 tabular-nums">
                  {zoomPercent}%
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-slate-300"
                  disabled={zoomIndex >= ZOOM_STEPS.length - 1}
                  onClick={() => setZoomIndex((prev) => Math.min(ZOOM_STEPS.length - 1, prev + 1))}
                  aria-label="Perbesar gambar"
                >
                  <ZoomInIcon className="size-3.5" aria-hidden="true" />
                </Button>
              </div>
            ) : null}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 px-2 text-slate-300 hover:bg-slate-800 hover:text-white"
              aria-label="Tutup lightbox bukti validasi"
            >
              <XIcon className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {mediaList.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-cyan-500/20 py-14 text-center">
              <ImageIcon className="size-9 text-slate-500" aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-200">
                Belum ada bukti gambar pada kartu validasi ini
              </p>
              <p className="max-w-md text-xs text-slate-400">
                Gunakan tombol Tambah / Edit Card Validasi untuk melampirkan tangkapan layar IBDS,
                SAP2000, dan lembar perhitungan Excel Manual.
              </p>
            </div>
          ) : viewMode === "single" && currentMedia ? (
            <div className="flex flex-col gap-3">
              <EvidenceImageFrame
                item={currentMedia}
                zoomPercent={zoomPercent}
                hasError={failedSrcs.has(currentMedia.src)}
                onImageError={handleImageError}
              />

              {mediaList.length > 1 ? (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {mediaList.map((item, idx) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setActiveIndex(idx);
                          setZoomIndex(0);
                        }}
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors",
                          idx === safeIndex
                            ? "border-cyan-400/60 bg-cyan-500/20 text-cyan-100"
                            : "border-cyan-500/15 bg-[#071121] text-slate-400 hover:border-cyan-500/35 hover:text-slate-200",
                        )}
                      >
                        {KIND_META[item.kind].label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 border-cyan-500/25 bg-[#081224] px-2 text-[11px]"
                      onClick={() =>
                        setActiveIndex((prev) => (prev - 1 + mediaList.length) % mediaList.length)
                      }
                    >
                      <ChevronLeftIcon className="size-3.5" aria-hidden="true" />
                      <span>Sebelumnya</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 border-cyan-500/25 bg-[#081224] px-2 text-[11px]"
                      onClick={() => setActiveIndex((prev) => (prev + 1) % mediaList.length)}
                    >
                      <span>Berikutnya</span>
                      <ChevronRightIcon className="size-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : leftMedia && rightMedia ? (
            <div className="flex flex-col gap-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex items-center justify-between gap-2 rounded-md border border-cyan-500/20 bg-[#081326] px-3 py-1.5 text-xs">
                  <span className="font-medium text-slate-300">Panel Kiri</span>
                  <select
                    value={leftMedia.id}
                    onChange={(event) => setCompareLeftId(event.target.value)}
                    className="rounded border border-cyan-500/25 bg-[#050b16] px-2 py-1 text-xs text-slate-100 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
                  >
                    {mediaList.map((item) => (
                      <option key={item.id} value={item.id}>
                        {KIND_META[item.kind].label} — {item.caption.slice(0, 32)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex items-center justify-between gap-2 rounded-md border border-cyan-500/20 bg-[#081326] px-3 py-1.5 text-xs">
                  <span className="font-medium text-slate-300">Panel Kanan</span>
                  <select
                    value={rightMedia.id}
                    onChange={(event) => setCompareRightId(event.target.value)}
                    className="rounded border border-cyan-500/25 bg-[#050b16] px-2 py-1 text-xs text-slate-100 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
                  >
                    {mediaList.map((item) => (
                      <option key={item.id} value={item.id}>
                        {KIND_META[item.kind].label} — {item.caption.slice(0, 32)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <EvidenceImageFrame
                  item={leftMedia}
                  zoomPercent={100}
                  hasError={failedSrcs.has(leftMedia.src)}
                  onImageError={handleImageError}
                />
                <EvidenceImageFrame
                  item={rightMedia}
                  zoomPercent={100}
                  hasError={failedSrcs.has(rightMedia.src)}
                  onImageError={handleImageError}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </dialog>
  );
}

export default ValidationEvidenceLightbox;
