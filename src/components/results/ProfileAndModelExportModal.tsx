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

import { AlertCircleIcon, CheckCircle2Icon } from "lucide-react";
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
  readonly category: "CAD" | "BIM" | "CAE" | "3D_SOLID";
}

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

  const handleTriggerExport = (item: ExportFormatItem): void => {
    setIsExporting(true);
    setDownloadSuccess(null);
    setErrorMessage(null);

    try {
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
        className="flex max-h-[90vh] flex-col p-6 sm:max-w-xl"
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
        <div className="grid max-h-80 grid-cols-2 gap-2.5 overflow-y-auto py-1">
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
              if (item) handleTriggerExport(item);
            }}
          >
            {isExporting ? (
              <>
                <Spinner data-icon="inline-start" /> Memproses Ekspor…
              </>
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
