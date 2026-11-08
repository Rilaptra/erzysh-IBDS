/**
 * @file SteelDesignParametersForm.tsx
 * @description Form component for structural steel design parameters (SNI 1729:2020):
 * - Profile type filter (IWF vs BOX)
 * - Steel material grade (BJ 34 s/d BJ 55)
 * - Lateral unbraced length Lb (m) for LTB analysis
 * - Maximum geometric depth Hmax and flange width Bmax filters
 */

"use client";

import type { ReactElement } from "react";

import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
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
import type { SteelGrade, SteelProfileType } from "@/types/steel-sni1729-types";

const STEEL_GRADES: Array<{ value: SteelGrade; label: string }> = [
  { value: "BJ_34", label: "BJ 34 (fy = 210 MPa, fu = 340 MPa)" },
  { value: "BJ_37", label: "BJ 37 (fy = 240 MPa, fu = 370 MPa)" },
  { value: "BJ_41", label: "BJ 41 (fy = 250 MPa, fu = 410 MPa)" },
  { value: "BJ_50", label: "BJ 50 (fy = 290 MPa, fu = 500 MPa)" },
  { value: "BJ_55", label: "BJ 55 (fy = 410 MPa, fu = 550 MPa)" },
];

export function SteelDesignParametersForm(): ReactElement {
  const {
    steelProfileType,
    steelGrade,
    steelUnbracedLengthLbM,
    steelMaxHeightMm,
    steelMaxWidthMm,
  } = useBeamSimulatorStore();

  return (
    <FieldGroup className="gap-2.5 text-xs">
      {/* 1. Tipe Penampang Baja */}
      <Field>
        <FieldLabel className="text-muted-foreground font-semibold">
          Tipe Penampang Baja Standar
        </FieldLabel>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={steelProfileType}
          onValueChange={(val) => {
            if (val)
              beamSimulatorActions.setSteelParameters({ profileType: val as SteelProfileType });
          }}
          className="grid w-full grid-cols-2"
        >
          <ToggleGroupItem value="IWF" className="text-xs">
            IWF / H-Beam
          </ToggleGroupItem>
          <ToggleGroupItem value="BOX" className="text-xs">
            BOX / Hollow HSS
          </ToggleGroupItem>
        </ToggleGroup>
      </Field>

      {/* 2. Mutu Material Baja */}
      <Field>
        <FieldLabel className="text-muted-foreground font-semibold">
          Mutu Baja Struktural (SNI 1729 / JIS G 3101)
        </FieldLabel>
        <Select
          value={steelGrade}
          onValueChange={(val) =>
            beamSimulatorActions.setSteelParameters({ grade: val as SteelGrade })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent onPointerDown={(e) => e.stopPropagation()}>
            <SelectGroup>
              {STEEL_GRADES.map((g) => (
                <SelectItem key={g.value} value={g.value}>
                  {g.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>

      {/* 3. Panjang Tak Terkekang Lateral Lb */}
      <Field>
        <FieldLabel className="text-muted-foreground font-semibold">
          Panjang Tak Terkekang Lateral Lb
        </FieldLabel>
        <InputGroup>
          <InputGroupInput
            type="number"
            step="0.5"
            value={Number(steelUnbracedLengthLbM)}
            onChange={(e) =>
              beamSimulatorActions.setSteelParameters({
                unbracedLengthLbM: parseFloat(e.target.value) || 1,
              })
            }
          />
          <InputGroupAddon align="inline-end">m</InputGroupAddon>
        </InputGroup>
        <FieldDescription className="text-[10px]">
          Digunakan untuk analisis Tekuk Torsi Lateral (LTB SNI Bab F).
        </FieldDescription>
      </Field>

      {/* 4. Filter Batasan Geometri Maksimum (Hmax & Bmax) */}
      <div className="grid grid-cols-2 gap-2">
        <Field>
          <FieldLabel className="text-muted-foreground font-semibold">Batas Hmax</FieldLabel>
          <InputGroup>
            <InputGroupInput
              type="number"
              placeholder="Tanpa batas"
              value={steelMaxHeightMm ? Number(steelMaxHeightMm) : ""}
              onChange={(e) =>
                beamSimulatorActions.setSteelParameters({
                  maxHeightMm: e.target.value ? parseFloat(e.target.value) : undefined,
                })
              }
            />
            <InputGroupAddon align="inline-end">mm</InputGroupAddon>
          </InputGroup>
        </Field>

        <Field>
          <FieldLabel className="text-muted-foreground font-semibold">Batas Bmax</FieldLabel>
          <InputGroup>
            <InputGroupInput
              type="number"
              placeholder="Tanpa batas"
              value={steelMaxWidthMm ? Number(steelMaxWidthMm) : ""}
              onChange={(e) =>
                beamSimulatorActions.setSteelParameters({
                  maxWidthMm: e.target.value ? parseFloat(e.target.value) : undefined,
                })
              }
            />
            <InputGroupAddon align="inline-end">mm</InputGroupAddon>
          </InputGroup>
        </Field>
      </div>
    </FieldGroup>
  );
}

export default SteelDesignParametersForm;
