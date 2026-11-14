/**
 * @file SteelDesignParametersForm.tsx
 * @description Form component for structural steel design parameters (SNI 1729:2020):
 * - Profile type filter (IWF vs BOX)
 * - Parametric Custom Hollow Box (HSS) Generator & Optimizer controls (step 50 mm, thickness 20–35 mm)
 * - Steel material grade (BJ 34 s/d BJ 55)
 * - Lateral unbraced length Lb (m) for LTB analysis
 * - Maximum geometric depth Hmax and flange width Bmax filters
 */

"use client";

import React, { type ReactElement, useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { generateCustomBoxCatalog } from "@/core/steel/steel-section-optimizer";
import { beamSimulatorActions, useBeamSimulatorStore } from "@/state/beam-simulator-store";
import type { CustomBoxShapeRule, SteelGrade, SteelProfileType } from "@/types/steel-sni1729-types";

const STEEL_GRADES: Array<{ value: SteelGrade; label: string }> = [
  { value: "BJ_34", label: "BJ 34 (fy = 210 MPa, fu = 340 MPa)" },
  { value: "BJ_37", label: "BJ 37 (fy = 240 MPa, fu = 370 MPa)" },
  { value: "BJ_41", label: "BJ 41 (fy = 250 MPa, fu = 410 MPa)" },
  { value: "BJ_50", label: "BJ 50 (fy = 290 MPa, fu = 500 MPa)" },
  { value: "BJ_55", label: "BJ 55 (fy = 410 MPa, fu = 550 MPa)" },
];

/**
 * Renders the SNI 1729:2020 Steel Design Parameters form, including the optional
 * Parametric Custom Box Hollow Section Generator when `steelProfileType === "BOX"`.
 *
 * @returns React element for steel design parameter configuration.
 * @example
 * <SteelDesignParametersForm />
 */
export function SteelDesignParametersForm(): ReactElement {
  const {
    steelProfileType,
    steelGrade,
    steelUnbracedLengthLbM,
    steelMaxHeightMm,
    steelMaxWidthMm,
    customBoxConfig,
  } = useBeamSimulatorStore();

  const generatedBoxCount = useMemo(() => {
    if (steelProfileType !== "BOX" || !customBoxConfig.enabled) {
      return 0;
    }
    return generateCustomBoxCatalog(customBoxConfig).length;
  }, [steelProfileType, customBoxConfig]);

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
              beamSimulatorActions.setSteelParameters({
                profileType: val as SteelProfileType,
              });
          }}
          className="grid w-full grid-cols-2"
        >
          <ToggleGroupItem
            value="IWF"
            className="h-auto min-h-8 px-2 py-1.5 text-center text-[11px] leading-tight whitespace-normal sm:text-xs"
          >
            IWF / H-Beam
          </ToggleGroupItem>
          <ToggleGroupItem
            value="BOX"
            className="h-auto min-h-8 px-2 py-1.5 text-center text-[11px] leading-tight whitespace-normal sm:text-xs"
          >
            BOX / Hollow HSS
          </ToggleGroupItem>
        </ToggleGroup>
      </Field>

      {/* 1b. Panel Generator Parametrik BOX Hollow Custom (Khusus jika tipe = BOX) */}
      {steelProfileType === "BOX" ? (
        <div className="rounded-lg border border-purple-500/35 bg-purple-950/20 p-2.5">
          <Field orientation="horizontal" className="items-start gap-2">
            <Checkbox
              id="toggle-custom-box-generator"
              checked={customBoxConfig.enabled}
              onCheckedChange={(checked) =>
                beamSimulatorActions.setSteelParameters({
                  customBoxConfig: { enabled: Boolean(checked) },
                })
              }
              className="mt-0.5"
            />
            <div className="flex flex-1 flex-col gap-0.5">
              <FieldLabel
                htmlFor="toggle-custom-box-generator"
                className="cursor-pointer font-bold text-purple-300"
              >
                ⚡ Gunakan Generator Parametrik Custom (Interval 50 mm & Tebal 20–35 mm)
              </FieldLabel>
              <span className="text-muted-foreground text-[10px] leading-snug">
                Mencari penampang BOX hollow custom paling ringan sesuai SNI 1729:2020 di luar
                katalog standar JIS G 3466.
              </span>
            </div>
          </Field>

          {customBoxConfig.enabled ? (
            <div className="mt-2.5 flex flex-col gap-2 border-t border-purple-500/25 pt-2.5">
              {/* Badge Info Kombinasi */}
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <Badge
                  variant="outline"
                  className="border-purple-500/40 bg-purple-500/15 px-1.5 py-0 text-[10px] font-semibold text-purple-200"
                >
                  {generatedBoxCount} variasi penampang diuji real-time
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() =>
                    beamSimulatorActions.setSteelParameters({
                      customBoxConfig: {
                        enabled: true,
                        hMinMm: 200,
                        hMaxMm: 600,
                        bMinMm: 200,
                        bMaxMm: 600,
                        dimensionStepMm: 50,
                        tMinMm: 20,
                        tMaxMm: 35,
                        thicknessStepMm: 5,
                        shapeRule: "ALL",
                      },
                    })
                  }
                  className="h-5 px-1.5 text-[10px] text-purple-300 hover:bg-purple-500/20"
                >
                  ↺ Default (50mm / 20–35mm)
                </Button>
              </div>

              {/* Aturan Bentuk Penampang */}
              <Field>
                <FieldLabel className="text-muted-foreground text-[10px] font-semibold">
                  Aturan Bentuk Penampang BOX
                </FieldLabel>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  size="sm"
                  value={customBoxConfig.shapeRule}
                  onValueChange={(val) => {
                    if (val) {
                      beamSimulatorActions.setSteelParameters({
                        customBoxConfig: {
                          shapeRule: val as CustomBoxShapeRule,
                        },
                      });
                    }
                  }}
                  className="grid w-full grid-cols-3"
                >
                  <ToggleGroupItem
                    value="ALL"
                    className="h-auto min-h-8 px-1 py-1 text-center text-[10px] leading-tight whitespace-normal"
                  >
                    Semua
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="SQUARE_ONLY"
                    className="h-auto min-h-8 px-1 py-1 text-center text-[10px] leading-tight whitespace-normal"
                  >
                    Persegi (H=B)
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="RECTANGULAR_ONLY"
                    className="h-auto min-h-8 px-1 py-1 text-center text-[10px] leading-tight whitespace-normal"
                  >
                    Persegi Panjang
                  </ToggleGroupItem>
                </ToggleGroup>
              </Field>

              {/* Rentang Tinggi H (Hmin - Hmax) */}
              <div className="grid grid-cols-2 gap-2">
                <Field>
                  <FieldLabel className="text-muted-foreground text-[10px] font-semibold">
                    Tinggi Hmin
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      type="number"
                      step={customBoxConfig.dimensionStepMm}
                      min={100}
                      value={customBoxConfig.hMinMm}
                      onChange={(e) =>
                        beamSimulatorActions.setSteelParameters({
                          customBoxConfig: {
                            hMinMm: Math.max(100, Number.parseFloat(e.target.value) || 200),
                          },
                        })
                      }
                    />
                    <InputGroupAddon align="inline-end">mm</InputGroupAddon>
                  </InputGroup>
                </Field>

                <Field>
                  <FieldLabel className="text-muted-foreground text-[10px] font-semibold">
                    Tinggi Hmax
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      type="number"
                      step={customBoxConfig.dimensionStepMm}
                      min={100}
                      value={customBoxConfig.hMaxMm}
                      onChange={(e) =>
                        beamSimulatorActions.setSteelParameters({
                          customBoxConfig: {
                            hMaxMm: Math.max(100, Number.parseFloat(e.target.value) || 600),
                          },
                        })
                      }
                    />
                    <InputGroupAddon align="inline-end">mm</InputGroupAddon>
                  </InputGroup>
                </Field>
              </div>

              {/* Rentang Lebar B (Bmin - Bmax) */}
              <div className="grid grid-cols-2 gap-2">
                <Field>
                  <FieldLabel className="text-muted-foreground text-[10px] font-semibold">
                    Lebar Bmin
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      type="number"
                      step={customBoxConfig.dimensionStepMm}
                      min={100}
                      value={customBoxConfig.bMinMm}
                      onChange={(e) =>
                        beamSimulatorActions.setSteelParameters({
                          customBoxConfig: {
                            bMinMm: Math.max(100, Number.parseFloat(e.target.value) || 200),
                          },
                        })
                      }
                    />
                    <InputGroupAddon align="inline-end">mm</InputGroupAddon>
                  </InputGroup>
                </Field>

                <Field>
                  <FieldLabel className="text-muted-foreground text-[10px] font-semibold">
                    Lebar Bmax
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      type="number"
                      step={customBoxConfig.dimensionStepMm}
                      min={100}
                      value={customBoxConfig.bMaxMm}
                      onChange={(e) =>
                        beamSimulatorActions.setSteelParameters({
                          customBoxConfig: {
                            bMaxMm: Math.max(100, Number.parseFloat(e.target.value) || 600),
                          },
                        })
                      }
                    />
                    <InputGroupAddon align="inline-end">mm</InputGroupAddon>
                  </InputGroup>
                </Field>
              </div>

              {/* Rentang Tebal Dinding t (tmin - tmax) */}
              <div className="grid grid-cols-2 gap-2">
                <Field>
                  <FieldLabel className="text-[10px] font-bold text-amber-300">
                    Tebal Awal tmin
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      type="number"
                      step={customBoxConfig.thicknessStepMm}
                      min={2}
                      value={customBoxConfig.tMinMm}
                      onChange={(e) =>
                        beamSimulatorActions.setSteelParameters({
                          customBoxConfig: {
                            tMinMm: Math.max(2, Number.parseFloat(e.target.value) || 20),
                          },
                        })
                      }
                    />
                    <InputGroupAddon align="inline-end">mm</InputGroupAddon>
                  </InputGroup>
                </Field>

                <Field>
                  <FieldLabel className="text-[10px] font-bold text-amber-300">
                    Tebal Maks tmax
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      type="number"
                      step={customBoxConfig.thicknessStepMm}
                      min={2}
                      value={customBoxConfig.tMaxMm}
                      onChange={(e) =>
                        beamSimulatorActions.setSteelParameters({
                          customBoxConfig: {
                            tMaxMm: Math.max(2, Number.parseFloat(e.target.value) || 35),
                          },
                        })
                      }
                    />
                    <InputGroupAddon align="inline-end">mm</InputGroupAddon>
                  </InputGroup>
                </Field>
              </div>

              {/* Interval Step Dimensi (ΔH, ΔB) & Step Tebal (Δt) */}
              <div className="grid grid-cols-2 gap-2">
                <Field>
                  <FieldLabel className="text-muted-foreground text-[10px] font-semibold">
                    Step Dimensi (ΔH, ΔB)
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      type="number"
                      step={10}
                      min={10}
                      value={customBoxConfig.dimensionStepMm}
                      onChange={(e) =>
                        beamSimulatorActions.setSteelParameters({
                          customBoxConfig: {
                            dimensionStepMm: Math.max(10, Number.parseFloat(e.target.value) || 50),
                          },
                        })
                      }
                    />
                    <InputGroupAddon align="inline-end">mm</InputGroupAddon>
                  </InputGroup>
                </Field>

                <Field>
                  <FieldLabel className="text-muted-foreground text-[10px] font-semibold">
                    Step Tebal (Δt)
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      type="number"
                      step={0.5}
                      min={0.5}
                      value={customBoxConfig.thicknessStepMm}
                      onChange={(e) =>
                        beamSimulatorActions.setSteelParameters({
                          customBoxConfig: {
                            thicknessStepMm: Math.max(0.5, Number.parseFloat(e.target.value) || 5),
                          },
                        })
                      }
                    />
                    <InputGroupAddon align="inline-end">mm</InputGroupAddon>
                  </InputGroup>
                </Field>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* 2. Mutu Material Baja */}
      <Field>
        <FieldLabel className="text-muted-foreground font-semibold">
          Mutu Baja Struktural (SNI 1729 / JIS G 3101)
        </FieldLabel>
        <Select
          value={steelGrade}
          onValueChange={(val) =>
            beamSimulatorActions.setSteelParameters({
              grade: val as SteelGrade,
            })
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
      <div className="grid grid-cols-1 gap-2 min-[340px]:grid-cols-2">
        {(
          [
            {
              key: "maxHeightMm",
              label: "Batas Hmax",
              value: steelMaxHeightMm,
            },
            { key: "maxWidthMm", label: "Batas Bmax", value: steelMaxWidthMm },
          ] as const
        ).map(({ key, label, value }) => (
          <Field key={key}>
            <FieldLabel className="text-muted-foreground font-semibold">{label}</FieldLabel>
            <InputGroup>
              <InputGroupInput
                type="number"
                placeholder="Tanpa batas"
                className="px-2 text-xs placeholder:text-[10px] sm:placeholder:text-[11px]"
                value={value ? Number(value) : ""}
                onChange={(e) =>
                  beamSimulatorActions.setSteelParameters({
                    [key]: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
              />
              <InputGroupAddon align="inline-end" className="pr-2 pl-1 text-[10px] sm:text-[11px]">
                mm
              </InputGroupAddon>
            </InputGroup>
          </Field>
        ))}
      </div>
    </FieldGroup>
  );
}

export default SteelDesignParametersForm;
