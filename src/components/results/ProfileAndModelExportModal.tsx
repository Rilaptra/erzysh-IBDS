/**
 * @file ProfileAndModelExportModal.tsx
 * @description Modal dialog providing direct export capabilities to engineering CAD/BIM/CAE formats:
 * - AutoCAD (.dxf 2D Section & 3D Mesh, .lsp AutoLISP)
 * - SAP2000 (.s2k Text Model with Materials & Joint Restraints)
 * - Revit & Tekla (.ifc IFC4 BIM & Revit Family Type Catalog .txt)
 * - IDEA StatiCa (.iom.xml IDEA Open Model & .saf)
 * - SolidWorks & ANSYS (.step ISO 10303-21 AP214 B-Rep Solid & .stl Mesh)
 */

"use client";

import { AlertCircleIcon, CheckCircle2Icon, ChevronDownIcon } from "lucide-react";
import React, { type ReactElement, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  buildAutoLispFromSimulatorState,
  buildDxfFromSimulatorState,
} from "@/core/exporters/dxf-autocad-exporter";
import { buildIdeaOpenModelXmlFromSimulatorState } from "@/core/exporters/ideastatica-exporter";
import {
  buildIfc4FromSimulatorState,
  buildRevitTypeCatalogFromSimulatorState,
} from "@/core/exporters/ifc4-bim-revit-exporter";
import { buildS2kFromSimulatorState } from "@/core/exporters/s2k-sap2000-exporter";
import {
  buildStepAp214FromSimulatorState,
  buildStlFromSimulatorState,
} from "@/core/exporters/step-solidworks-exporter";
import { cn } from "@/lib/utils";
import { useBeamSimulatorStore } from "@/state/beam-simulator-store";

export interface ProfileAndModelExportModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

interface ExportFormatItem {
  readonly id: string;
  readonly name: string;
  readonly extension: string;
  readonly targetSoftware: string;
  readonly description: string;
  readonly category: "CAD" | "BIM" | "CAE" | "3D_SOLID" | "REPORT";
}

const REBAR_GRADE_FY_MAP: Record<string, number> = {
  BJTP_30: 300,
  BJTS_40: 400,
  BJTS_50: 500,
  BJTS_60: 600,
};

const EXPORT_FORMATS: ExportFormatItem[] = [
  {
    id: "dxf",
    name: "Drawing Exchange Format",
    extension: ".dxf",
    targetSoftware: "AutoCAD, Civil 3D, BricsCAD",
    description: "Gambar teknik 2D potongan melintang & 3D wireframe balok.",
    category: "CAD",
  },
  {
    id: "lsp",
    name: "AutoLISP Parametric Script",
    extension: ".lsp",
    targetSoftware: "AutoCAD / Civil 3D",
    description: "Skrip otomasi gambar profil parametric instan.",
    category: "CAD",
  },
  {
    id: "s2k",
    name: "SAP2000 Text Model",
    extension: ".s2k",
    targetSoftware: "SAP2000 & ETABS",
    description: "Model teks lengkap material, frame section, 5 tumpuan, & beban.",
    category: "CAE",
  },
  {
    id: "ifc",
    name: "IFC4 BIM Model",
    extension: ".ifc",
    targetSoftware: "Autodesk Revit & Tekla Structures",
    description: "Entitas BIM IfcBeam standar ISO 16739-1.",
    category: "BIM",
  },
  {
    id: "revit-txt",
    name: "Revit Family Type Catalog",
    extension: ".txt",
    targetSoftware: "Autodesk Revit",
    description: "Katalog parameter dimensi penampang balok Revit.",
    category: "BIM",
  },
  {
    id: "iom",
    name: "IDEA Open Model XML",
    extension: ".iom.xml",
    targetSoftware: "IDEA StatiCa Connection & Detail",
    description: "Model analisis sambungan dan gaya dalam terfaktor.",
    category: "CAE",
  },
  {
    id: "step",
    name: "STEP AP214 B-Rep Solid",
    extension: ".step",
    targetSoftware: "SolidWorks, Inventor, Fusion 360",
    description: "Model 3D solid b-rep geometri balok presisi.",
    category: "3D_SOLID",
  },
  {
    id: "stl",
    name: "Tessellated 3D Mesh",
    extension: ".stl",
    targetSoftware: "3D Printing & CFD / FEA Meshers",
    description: "Mesh segitiga 3D balok melendut.",
    category: "3D_SOLID",
  },
  {
    id: "calculation-sheet",
    name: "Nota Desain Balok (A4/PDF)",
    extension: ".html",
    targetSoftware: "Browser Print / Save as PDF",
    description: "Lembar perhitungan struktur SNI siap cetak A4 & PDF.",
    category: "REPORT",
  },
];

/**
 * Initiates an in-browser download of text or binary file content.
 *
 * @param content - File content as string or Uint8Array.
 * @param fileName - Target download file name.
 * @param mimeType - File MIME type.
 */
function downloadFile(content: string | Uint8Array, fileName: string, mimeType: string): void {
  const blob =
    typeof content === "string"
      ? new Blob([content], { type: mimeType })
      : new Blob([content as Uint8Array<ArrayBuffer>], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ProfileAndModelExportModal({
  isOpen,
  onClose,
}: ProfileAndModelExportModalProps): ReactElement | null {
  const store = useBeamSimulatorStore();
  const { materialKind, coordinateMode } = store;
  const [selectedFormat, setSelectedFormat] = useState<string>("dxf");
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isReportMetaOpen, setIsReportMetaOpen] = useState<boolean>(false);
  const [projectTitle, setProjectTitle] = useState<string>("");
  const [beamMark, setBeamMark] = useState<string>("");
  const [engineerName, setEngineerName] = useState<string>("");
  const [verifierName, setVerifierName] = useState<string>("");
  const [approverName, setApproverName] = useState<string>("");
  const [loadCombination, setLoadCombination] = useState<string>("");
  const [reportDate, setReportDate] = useState<string>("");

  const handleTriggerExport = async (item: ExportFormatItem): Promise<void> => {
    setIsExporting(true);
    setDownloadSuccess(null);
    setErrorMessage(null);

    try {
      if (item.id === "calculation-sheet") {
        const isConcrete = store.materialKind === "CONCRETE";
        const phiMn = isConcrete
          ? store.concreteOptimizationResult?.flexure.designMomentPhiMn
          : store.steelOptimizationResult?.bestCandidate.interaction.phiMnx;
        const phiVn = isConcrete
          ? store.concreteOptimizationResult?.shear.designShearPhiVn
          : undefined;

        const response = await fetch("/api/report/calculation-sheet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            calculationSheetInput: {
              projectTitle: projectTitle.trim() || undefined,
              beamMark: beamMark.trim() || undefined,
              engineerName: engineerName.trim() || undefined,
              verifierName: verifierName.trim() || undefined,
              approverName: approverName.trim() || undefined,
              loadCombination: loadCombination.trim() || undefined,
              materialKind: store.materialKind,
              spanLengthM: Number(store.spanLengthM),
              unbracedLengthM: Number(store.steelUnbracedLengthLbM),
              supportType: store.supportOrientation,
              maxDeflectionMm: Number(store.maxDeflectionMm),
              deflectionLimitDenominator: store.deflectionLimitDenominator,
              governingMuKnm: Number(store.governingForces.absoluteMaxMux),
              governingVuKn: Number(store.governingForces.absoluteMaxVu),
              governingTuKnm: Number(store.governingForces.absoluteMaxTu),
              governingPuKn: Number(store.governingForces.absoluteMaxPu),
              steelProfileName:
                store.selectedSteelProfileName ??
                store.steelOptimizationResult?.bestCandidate.properties.name ??
                undefined,
              steelGrade: store.steelGrade,
              concreteDimensions: isConcrete
                ? {
                    bwMm: Number(store.concreteBwMm),
                    hMm: Number(store.concreteHMm),
                    coverMm: Number(store.concreteCoverMm),
                    fcMpa: Number(store.concreteFcMpa),
                    fyMpa: REBAR_GRADE_FY_MAP[store.longitudinalRebarGrade] ?? 400,
                  }
                : undefined,
              flexuralCapacityPhiMnKnm: phiMn !== undefined ? Number(phiMn) : undefined,
              shearCapacityPhiVnKn: phiVn !== undefined ? Number(phiVn) : undefined,
              dateIso: reportDate || new Date().toISOString(),
            },
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} saat membuat Nota Desain.`);
        }

        const html = await response.text();
        const blob = new Blob([html], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const openedTab = window.open(url, "_blank", "noopener,noreferrer");

        if (openedTab) {
          setTimeout(() => URL.revokeObjectURL(url), 60_000);
          setDownloadSuccess(
            "Nota Desain Balok dibuka di tab baru (klik Cetak / Simpan PDF untuk ekspor A4).",
          );
        } else {
          URL.revokeObjectURL(url);
          downloadFile(html, "nota-desain-balok.html", "text/html;charset=utf-8");
          setDownloadSuccess("Pop-up diblokir; file nota-desain-balok.html berhasil diunduh.");
        }
        return;
      }

      let fileName = "";
      switch (item.id) {
        case "dxf": {
          const res = buildDxfFromSimulatorState(store);
          downloadFile(res.content, res.fileName, res.mimeType);
          fileName = res.fileName;
          break;
        }
        case "lsp": {
          const res = buildAutoLispFromSimulatorState(store);
          downloadFile(res.content, res.fileName, res.mimeType);
          fileName = res.fileName;
          break;
        }
        case "s2k": {
          const res = buildS2kFromSimulatorState(store);
          downloadFile(res.content, res.fileName, res.mimeType);
          fileName = res.fileName;
          break;
        }
        case "ifc": {
          const res = buildIfc4FromSimulatorState(store);
          downloadFile(res.content, res.fileName, res.mimeType);
          fileName = res.fileName;
          break;
        }
        case "revit-txt": {
          const res = buildRevitTypeCatalogFromSimulatorState(store);
          downloadFile(res.content, res.fileName, res.mimeType);
          fileName = res.fileName;
          break;
        }
        case "iom": {
          const res = buildIdeaOpenModelXmlFromSimulatorState(store);
          downloadFile(res.content, res.fileName, res.mimeType);
          fileName = res.fileName;
          break;
        }
        case "step": {
          const res = buildStepAp214FromSimulatorState(store);
          downloadFile(res.content, res.fileName, res.mimeType);
          fileName = res.fileName;
          break;
        }
        case "stl": {
          const res = buildStlFromSimulatorState(store);
          downloadFile(res.content, res.fileName, res.mimeType);
          fileName = res.fileName;
          break;
        }
        default:
          throw new Error(`Format ekspor ${item.id} belum didukung.`);
      }

      setDownloadSuccess(`File ${fileName} berhasil diunduh mengikuti sumbu ${coordinateMode}!`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Gagal mengekspor ${item.name}: ${msg}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="flex max-h-[90dvh] flex-col p-4 sm:max-w-xl sm:p-6"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle className="text-foreground text-base font-bold">
            Ekspor Model Struktur & Gambar CAD/BIM
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Material Aktif: <strong className="text-foreground">{materialKind}</strong> | Sistem
            Sumbu: <strong className="text-foreground">{coordinateMode}</strong>
          </DialogDescription>
        </DialogHeader>

        {/* List of Formats */}
        <div className="grid max-h-80 grid-cols-1 gap-2.5 overflow-y-auto py-1 sm:grid-cols-2">
          {EXPORT_FORMATS.map((item) => {
            const isSelected = selectedFormat === item.id;
            return (
              <Card
                key={item.id}
                onClick={() => setSelectedFormat(item.id)}
                className={cn(
                  "cursor-pointer gap-1 rounded-lg border p-3 py-3 transition-all",
                  isSelected
                    ? "border-primary bg-primary/10 ring-primary ring-1"
                    : "border-border/40 bg-card/60 hover:bg-muted/40",
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "font-mono text-xs font-bold",
                      isSelected ? "text-primary" : "text-foreground",
                    )}
                  >
                    {item.extension}
                  </span>
                  <Badge variant="secondary" className="h-4 px-1.5 py-0 text-[9px]">
                    {item.category}
                  </Badge>
                </div>
                <div className="text-foreground line-clamp-1 text-xs font-semibold">
                  {item.name}
                </div>
                <div className="text-muted-foreground line-clamp-1 text-[10px]">
                  {item.targetSoftware}
                </div>
              </Card>
            );
          })}
        </div>

        {/* Optional collapsible customization for Calculation Sheet */}
        {selectedFormat === "calculation-sheet" ? (
          <div className="border-border/50 bg-muted/20 rounded-lg border">
            <button
              type="button"
              onClick={() => setIsReportMetaOpen((prev) => !prev)}
              className="text-foreground flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium"
            >
              <span>Kustomisasi Nota Desain (Opsional)</span>
              <ChevronDownIcon
                className={cn(
                  "text-muted-foreground size-4 transition-transform",
                  isReportMetaOpen && "rotate-180",
                )}
              />
            </button>
            {isReportMetaOpen ? (
              <div className="border-border/40 grid grid-cols-1 gap-2.5 border-t px-3 py-2.5 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="calc-project-title" className="text-[11px]">
                    Nama Proyek
                  </Label>
                  <Input
                    id="calc-project-title"
                    value={projectTitle}
                    onChange={(e) => setProjectTitle(e.target.value)}
                    placeholder="Gedung Kantor Bertingkat IBDS - Paket A"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="calc-beam-mark" className="text-[11px]">
                    Mark Balok
                  </Label>
                  <Input
                    id="calc-beam-mark"
                    value={beamMark}
                    onChange={(e) => setBeamMark(e.target.value)}
                    placeholder="B-101 (Balok Induk Lantai)"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="calc-load-combo" className="text-[11px]">
                    Kombinasi Beban
                  </Label>
                  <Input
                    id="calc-load-combo"
                    value={loadCombination}
                    onChange={(e) => setLoadCombination(e.target.value)}
                    placeholder="1.2D + 1.6L"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="calc-engineer-name" className="text-[11px]">
                    Perancang (Diajukan Oleh)
                  </Label>
                  <Input
                    id="calc-engineer-name"
                    value={engineerName}
                    onChange={(e) => setEngineerName(e.target.value)}
                    placeholder="IBDS Structural Engine"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="calc-report-date" className="text-[11px]">
                    Tanggal Laporan
                  </Label>
                  <Input
                    id="calc-report-date"
                    type="date"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="calc-verifier-name" className="text-[11px]">
                    Diverifikasi Oleh
                  </Label>
                  <Input
                    id="calc-verifier-name"
                    value={verifierName}
                    onChange={(e) => setVerifierName(e.target.value)}
                    placeholder="Lead Structural Engineer"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="calc-approver-name" className="text-[11px]">
                    Disetujui Oleh
                  </Label>
                  <Input
                    id="calc-approver-name"
                    value={approverName}
                    onChange={(e) => setApproverName(e.target.value)}
                    placeholder="Project Director"
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Success / Feedback notice */}
        {downloadSuccess ? (
          <Alert className="border-emerald-500/40 bg-emerald-500/10 py-2 text-emerald-400">
            <CheckCircle2Icon className="size-4" />
            <AlertDescription className="text-xs text-emerald-300">
              {downloadSuccess}
            </AlertDescription>
          </Alert>
        ) : null}

        {/* Error message */}
        {errorMessage ? (
          <Alert variant="destructive" className="py-2">
            <AlertCircleIcon className="size-4" />
            <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        {/* Actions */}
        <DialogFooter className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Tutup
          </Button>
          <Button
            size="sm"
            disabled={isExporting}
            onClick={() => {
              const item = EXPORT_FORMATS.find((f) => f.id === selectedFormat);
              if (item) void handleTriggerExport(item);
            }}
          >
            {isExporting ? (
              <>
                <Spinner data-icon="inline-start" /> Memproses Ekspor…
              </>
            ) : selectedFormat === "calculation-sheet" ? (
              "Buka Nota Desain"
            ) : (
              "Unduh File Pilihan"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ProfileAndModelExportModal;
