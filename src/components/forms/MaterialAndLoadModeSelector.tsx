/**
 * @file MaterialAndLoadModeSelector.tsx
 * @description Form component for Window 1:
 * - Material Selector (Beton Bertulang vs Baja Struktural)
 * - Load Mode Selector (Mode A: External Loads vs Mode B: Direct Internal Forces)
 * - 3D Concrete Sub-Mode (Solid + Potongan Ujung vs Wireframe Tulangan)
 * - Batas Lendutan Izin (L/180, L/240, L/360, L/480)
 * - Tampilan Diagram 2D & Checkboxes (SFD, BMD, NFD, TFD)
 */

"use client";

import type { ReactElement } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { beamSimulatorActions, useBeamSimulatorStore } from "@/state/beam-simulator-store";

export function MaterialAndLoadModeSelector(): ReactElement {
  const {
    materialKind,
    loadingMode,
    concreteViewMode,
    deflectionLimitDenominator,
    diagramDisplayMode,
    visibleDiagrams,
  } = useBeamSimulatorStore();

  return (
    <FieldGroup className="gap-3 text-xs">
      {/* 1. Material Selector */}
      <Field>
        <FieldLabel className="text-muted-foreground font-semibold">
          Jenis Material Struktur
        </FieldLabel>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={materialKind}
          onValueChange={(val) => {
            if (val) beamSimulatorActions.setMaterialKind(val as "STEEL" | "CONCRETE");
          }}
          className="grid w-full grid-cols-2"
        >
          <ToggleGroupItem
            value="STEEL"
            className="h-auto min-h-8 px-2 py-1.5 text-center text-[11px] leading-tight whitespace-normal sm:text-xs"
          >
            Baja (SNI 1729)
          </ToggleGroupItem>
          <ToggleGroupItem
            value="CONCRETE"
            className="h-auto min-h-8 px-2 py-1.5 text-center text-[11px] leading-tight whitespace-normal sm:text-xs"
          >
            Beton (SNI 2847)
          </ToggleGroupItem>
        </ToggleGroup>
      </Field>

      {/* 2. Loading Mode Selector */}
      <Field>
        <FieldLabel className="text-muted-foreground font-semibold">
          Paradigma Pembebanan
        </FieldLabel>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={loadingMode}
          onValueChange={(val) => {
            if (val)
              beamSimulatorActions.setLoadingMode(
                val as "MODE_A_EXTERNAL_LOADS" | "MODE_B_DIRECT_INTERNAL_FORCES",
              );
          }}
          className="grid w-full grid-cols-2"
        >
          <ToggleGroupItem
            value="MODE_A_EXTERNAL_LOADS"
            className="h-auto min-h-8 px-2 py-1.5 text-center text-[11px] leading-tight whitespace-normal sm:text-xs"
          >
            Mode A: Beban Eksternal
          </ToggleGroupItem>
          <ToggleGroupItem
            value="MODE_B_DIRECT_INTERNAL_FORCES"
            className="h-auto min-h-8 px-2 py-1.5 text-center text-[11px] leading-tight whitespace-normal sm:text-xs"
          >
            Mode B: Gaya Dalam
          </ToggleGroupItem>
        </ToggleGroup>
      </Field>

      {/* 3. Sub-Mode Beton 3D (Hanya tampil jika Beton) */}
      {materialKind === "CONCRETE" ? (
        <Field>
          <FieldLabel className="text-muted-foreground font-semibold">
            Sub-Mode Visualisasi Beton 3D
          </FieldLabel>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={concreteViewMode}
            onValueChange={(val) => {
              if (val)
                beamSimulatorActions.setConcreteViewMode(
                  val as "SOLID_WITH_END_SECTION" | "WIREFRAME_REBAR_CAGE",
                );
            }}
            className="grid w-full grid-cols-2"
          >
            <ToggleGroupItem
              value="SOLID_WITH_END_SECTION"
              className="h-auto min-h-8 px-2 py-1.5 text-center text-[11px] leading-tight whitespace-normal sm:text-xs"
            >
              Solid + Potongan
            </ToggleGroupItem>
            <ToggleGroupItem
              value="WIREFRAME_REBAR_CAGE"
              className="h-auto min-h-8 px-2 py-1.5 text-center text-[11px] leading-tight whitespace-normal sm:text-xs"
            >
              Wireframe Tulangan
            </ToggleGroupItem>
          </ToggleGroup>
        </Field>
      ) : null}

      {/* 4. Batas Lendutan Izin */}
      <Field>
        <FieldLabel className="text-muted-foreground font-semibold">
          Batas Lendutan Izin SNI
        </FieldLabel>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={String(deflectionLimitDenominator)}
          onValueChange={(val) => {
            if (val)
              beamSimulatorActions.setDeflectionLimitDenominator(
                Number(val) as 180 | 240 | 360 | 480,
              );
          }}
          className="grid w-full grid-cols-4"
        >
          {([180, 240, 360, 480] as const).map((denom) => (
            <ToggleGroupItem key={denom} value={String(denom)} className="text-xs">
              L/{denom}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>

      {/* 5. Tampilan Diagram Gaya Dalam */}
      <Field>
        <FieldLabel className="text-muted-foreground font-semibold">
          Mode Tampilan Diagram 2D
        </FieldLabel>
        <Select
          value={diagramDisplayMode}
          onValueChange={(val) =>
            beamSimulatorActions.setDiagramDisplayMode(
              val as "IN_PLACE_BEAM_AXIS" | "STACKED_VERTICAL" | "FLOATING_WINDOW",
            )
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Pilih mode diagram..." />
          </SelectTrigger>
          <SelectContent onPointerDown={(e) => e.stopPropagation()}>
            <SelectGroup>
              <SelectItem value="IN_PLACE_BEAM_AXIS">Mode 1: Bertumpuk di As Balok</SelectItem>
              <SelectItem value="STACKED_VERTICAL">Mode 2: Sejajar Vertikal ke Bawah</SelectItem>
              <SelectItem value="FLOATING_WINDOW">Mode 3: Jendela Khusus Terpisah</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        {/* Checkbox toggles per diagram */}
        <FieldSet className="mt-1 gap-2">
          <FieldLegend variant="label" className="text-muted-foreground text-xs font-semibold">
            Visibilitas Bidang Gaya Dalam
          </FieldLegend>
          <div className="grid grid-cols-1 gap-2 min-[340px]:grid-cols-2">
            <Field orientation="horizontal" className="min-w-0 items-center gap-2">
              <Checkbox
                id="check-sfd"
                checked={visibleDiagrams.sfd}
                onCheckedChange={() => beamSimulatorActions.toggleDiagramVisibility("sfd")}
              />
              <FieldLabel
                htmlFor="check-sfd"
                className="min-w-0 cursor-pointer leading-tight font-medium text-emerald-500"
              >
                SFD (Geser)
              </FieldLabel>
            </Field>

            <Field orientation="horizontal" className="min-w-0 items-center gap-2">
              <Checkbox
                id="check-bmd"
                checked={visibleDiagrams.bmd}
                onCheckedChange={() => beamSimulatorActions.toggleDiagramVisibility("bmd")}
              />
              <FieldLabel
                htmlFor="check-bmd"
                className="min-w-0 cursor-pointer leading-tight font-medium text-cyan-500"
              >
                BMD (Momen)
              </FieldLabel>
            </Field>

            <Field orientation="horizontal" className="min-w-0 items-center gap-2">
              <Checkbox
                id="check-nfd"
                checked={visibleDiagrams.nfd}
                onCheckedChange={() => beamSimulatorActions.toggleDiagramVisibility("nfd")}
              />
              <FieldLabel
                htmlFor="check-nfd"
                className="min-w-0 cursor-pointer leading-tight font-medium text-purple-500"
              >
                NFD (Aksial)
              </FieldLabel>
            </Field>

            <Field orientation="horizontal" className="min-w-0 items-center gap-2">
              <Checkbox
                id="check-tfd"
                checked={visibleDiagrams.tfd}
                onCheckedChange={() => beamSimulatorActions.toggleDiagramVisibility("tfd")}
              />
              <FieldLabel
                htmlFor="check-tfd"
                className="min-w-0 cursor-pointer leading-tight font-medium text-amber-500"
              >
                TFD (Torsi)
              </FieldLabel>
            </Field>
          </div>
        </FieldSet>
      </Field>
    </FieldGroup>
  );
}

export default MaterialAndLoadModeSelector;
