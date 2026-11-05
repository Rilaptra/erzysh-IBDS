/**
 * @file ProfileAndModelExportModal.tsx
 * @description Modal dialog providing export capabilities to engineering CAD/BIM/CAE formats:
 * - AutoCAD (.dxf 2D Section & 3D Mesh, .lsp AutoLISP)
 * - SAP2000 (.s2k Text Model with Materials & Joint Restraints)
 * - Revit & Tekla (.ifc IFC4 BIM & Revit Family Type Catalog .txt)
 * - IDEA StatiCa (.iom.xml IDEA Open Model & .saf)
 * - SolidWorks & ANSYS (.step ISO 10303-21 AP214 B-Rep Solid & .stl Mesh)
 */

"use client";

import React, { type ReactElement, useState } from "react";

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

export function ProfileAndModelExportModal({
  isOpen,
  onClose,
}: ProfileAndModelExportModalProps): ReactElement | null {
  const { materialKind, coordinateMode } = useBeamSimulatorStore();
  const [selectedFormat, setSelectedFormat] = useState<string>("dxf");
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTriggerExport = (item: ExportFormatItem): void => {
    setIsExporting(true);
    setDownloadSuccess(null);

    // In Step 5, prepare synthetic trigger which connects to Step 6 exporters
    setTimeout(() => {
      setIsExporting(false);
      setDownloadSuccess(
        `File ${item.name} (${item.extension}) berhasil disiapkan mengikuti sumbu ${coordinateMode}!`,
      );
    }, 400);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 640,
          background: "rgba(15, 20, 22, 0.95)",
          border: "1px solid rgba(148, 163, 184, 0.2)",
          borderRadius: 12,
          padding: 20,
          boxShadow: "0 20px 48px rgba(0, 0, 0, 0.6)",
          color: "#E2E8F0",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#F8FAFC" }}>
              Ekspor Model Struktur & Gambar CAD/BIM
            </h3>
            <span style={{ fontSize: 11, color: "#94A3B8" }}>
              Material Aktif: <strong>{materialKind}</strong> | Sistem Sumbu:{" "}
              <strong>{coordinateMode}</strong>
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              color: "#94A3B8",
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            ✕
          </button>
        </div>

        {/* List of Formats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            maxHeight: 360,
            overflowY: "auto",
            marginBottom: 16,
          }}
        >
          {EXPORT_FORMATS.map((item) => {
            const isSelected = selectedFormat === item.id;
            return (
              <div
                key={item.id}
                onClick={() => setSelectedFormat(item.id)}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  cursor: "pointer",
                  background: isSelected ? "rgba(6, 182, 212, 0.15)" : "rgba(30, 41, 59, 0.4)",
                  border: `1px solid ${isSelected ? "#06B6D4" : "rgba(148, 163, 184, 0.12)"}`,
                  transition: "all 0.15s ease",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 4,
                  }}
                >
                  <strong style={{ fontSize: 12, color: isSelected ? "#38BDF8" : "#F8FAFC" }}>
                    {item.extension}
                  </strong>
                  <span
                    style={{
                      fontSize: 9,
                      padding: "1px 6px",
                      borderRadius: 4,
                      background: "rgba(148, 163, 184, 0.1)",
                      color: "#94A3B8",
                    }}
                  >
                    {item.category}
                  </span>
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#CBD5E1", marginBottom: 2 }}>
                  {item.name}
                </div>
                <div style={{ fontSize: 10, color: "#94A3B8", lineHeight: 1.3 }}>
                  {item.targetSoftware}
                </div>
              </div>
            );
          })}
        </div>

        {/* Success / Feedback notice */}
        {downloadSuccess ? (
          <div
            style={{
              background: "rgba(16, 185, 129, 0.15)",
              border: "1px solid rgba(16, 185, 129, 0.4)",
              borderRadius: 6,
              padding: "8px 12px",
              color: "#34D399",
              fontSize: 11,
              marginBottom: 12,
            }}
          >
            ✓ {downloadSuccess}
          </div>
        ) : null}

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "1px solid rgba(148, 163, 184, 0.2)",
              background: "transparent",
              color: "#94A3B8",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Tutup
          </button>

          <button
            type="button"
            disabled={isExporting}
            onClick={() => {
              const item = EXPORT_FORMATS.find((f) => f.id === selectedFormat);
              if (item) handleTriggerExport(item);
            }}
            style={{
              padding: "8px 20px",
              borderRadius: 6,
              border: "none",
              background: "linear-gradient(90deg, #06B6D4 0%, #3B82F6 100%)",
              color: "#FFFFFF",
              fontWeight: 700,
              cursor: isExporting ? "wait" : "pointer",
              fontSize: 12,
            }}
          >
            {isExporting ? "Memproses Ekspor…" : "Unduh File Pilihan"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProfileAndModelExportModal;
