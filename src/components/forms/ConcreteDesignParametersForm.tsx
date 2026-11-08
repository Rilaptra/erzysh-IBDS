/**
 * @file ConcreteDesignParametersForm.tsx
 * @description Form component for reinforced concrete design parameters (SNI 2847:2019):
 * - Cylinder fc' (MPa) or Cube K-xxx selector
 * - Section dimensions (bw x h in mm)
 * - Concrete clear cover (dc in mm)
 * - Longitudinal and stirrup rebar grade selectors (BJTP / BJTS)
 * - Maximum aggregate size
 */

"use client";

import type { ReactElement } from "react";

import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { beamSimulatorActions, useBeamSimulatorStore } from "@/state/beam-simulator-store";
import type { ConcreteCubeGrade, RebarSteelGrade } from "@/types/concrete-sni2847-types";

const CUBE_GRADES: ConcreteCubeGrade[] = [
  "K_175",
  "K_200",
  "K_225",
  "K_250",
  "K_300",
  "K_350",
  "K_400",
  "K_500",
];

const REBAR_GRADES: Array<{ value: RebarSteelGrade; label: string }> = [
  { value: "BJTP_24", label: "BJTP 24 (Polos, fy = 240 MPa)" },
  { value: "BJTP_30", label: "BJTP 30 (Polos, fy = 300 MPa)" },
  { value: "BJTS_40", label: "BJTS 40 (Ulir, fy = 400 MPa)" },
  { value: "BJTS_50", label: "BJTS 50 (Ulir, fy = 500 MPa)" },
  { value: "BJTS_60", label: "BJTS 60 (Ulir, fy = 600 MPa)" },
];

export function ConcreteDesignParametersForm(): ReactElement {
  const {
    concreteBwMm,
    concreteHMm,
    concreteCoverMm,
    concreteFcMpa,
    concreteCubeGrade,
    longitudinalRebarGrade,
    stirrupRebarGrade,
  } = useBeamSimulatorStore();

  return (
    <FieldGroup className="gap-2.5 text-xs">
      {/* 1. Mutu Beton: Silinder fc' atau Kubus K */}
      <Field>
        <FieldLabel className="text-muted-foreground font-semibold">
          Mutu Kuat Tekan Beton
        </FieldLabel>
        <div className="grid grid-cols-2 gap-2">
          <Field>
            <span className="text-muted-foreground text-[10px]">Silinder fc'</span>
            <InputGroup>
              <InputGroupInput
                type="number"
                min="17"
                max="60"
                value={Number(concreteFcMpa)}
                onChange={(e) =>
                  beamSimulatorActions.setConcreteParameters({
                    fcMpa: parseFloat(e.target.value) || 25,
                    cubeGrade: null,
                  })
                }
              />
              <InputGroupAddon align="inline-end">MPa</InputGroupAddon>
            </InputGroup>
          </Field>

          <Field>
            <span className="text-muted-foreground text-[10px]">Atau Kubus K-xxx</span>
            <Select
              value={concreteCubeGrade ?? "NONE"}
              onValueChange={(val) => {
                if (val && val !== "NONE") {
                  beamSimulatorActions.setConcreteParameters({
                    cubeGrade: val as ConcreteCubeGrade,
                  });
                } else {
                  beamSimulatorActions.setConcreteParameters({ cubeGrade: null });
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pilih K-xxx..." />
              </SelectTrigger>
              <SelectContent onPointerDown={(e) => e.stopPropagation()}>
                <SelectGroup>
                  <SelectItem value="NONE">Manual fc'</SelectItem>
                  {CUBE_GRADES.map((k) => (
                    <SelectItem key={k} value={k}>
                      {k}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </Field>

      {/* 2. Dimensi Penampang Balok (bw x h) */}
      <div className="grid grid-cols-2 gap-2">
        <Field>
          <FieldLabel className="text-muted-foreground font-semibold">Lebar bw</FieldLabel>
          <InputGroup>
            <InputGroupInput
              type="number"
              step="25"
              value={Number(concreteBwMm)}
              onChange={(e) =>
                beamSimulatorActions.setConcreteParameters({
                  bwMm: parseFloat(e.target.value) || 200,
                })
              }
            />
            <InputGroupAddon align="inline-end">mm</InputGroupAddon>
          </InputGroup>
        </Field>

        <Field>
          <FieldLabel className="text-muted-foreground font-semibold">Tinggi h</FieldLabel>
          <InputGroup>
            <InputGroupInput
              type="number"
              step="50"
              value={Number(concreteHMm)}
              onChange={(e) =>
                beamSimulatorActions.setConcreteParameters({
                  hMm: parseFloat(e.target.value) || 300,
                })
              }
            />
            <InputGroupAddon align="inline-end">mm</InputGroupAddon>
          </InputGroup>
        </Field>
      </div>

      {/* 3. Selimut Beton (dc) */}
      <Field>
        <FieldLabel className="text-muted-foreground font-semibold">
          Tebal Selimut Bersih dc
        </FieldLabel>
        <InputGroup>
          <InputGroupInput
            type="number"
            step="5"
            value={Number(concreteCoverMm)}
            onChange={(e) =>
              beamSimulatorActions.setConcreteParameters({
                coverMm: parseFloat(e.target.value) || 40,
              })
            }
          />
          <InputGroupAddon align="inline-end">mm</InputGroupAddon>
        </InputGroup>
      </Field>

      {/* 4. Mutu Tulangan Pokok Memanjang */}
      <Field>
        <FieldLabel className="text-muted-foreground font-semibold">
          Mutu Tulangan Pokok Memanjang
        </FieldLabel>
        <Select
          value={longitudinalRebarGrade}
          onValueChange={(val) =>
            beamSimulatorActions.setConcreteParameters({
              longitudinalGrade: val as RebarSteelGrade,
            })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent onPointerDown={(e) => e.stopPropagation()}>
            <SelectGroup>
              {REBAR_GRADES.map((rg) => (
                <SelectItem key={rg.value} value={rg.value}>
                  {rg.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>

      {/* 5. Mutu Tulangan Sengkang Geser */}
      <Field>
        <FieldLabel className="text-muted-foreground font-semibold">
          Mutu Tulangan Sengkang Geser
        </FieldLabel>
        <Select
          value={stirrupRebarGrade}
          onValueChange={(val) =>
            beamSimulatorActions.setConcreteParameters({
              stirrupGrade: val as RebarSteelGrade,
            })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent onPointerDown={(e) => e.stopPropagation()}>
            <SelectGroup>
              {REBAR_GRADES.map((rg) => (
                <SelectItem key={rg.value} value={rg.value}>
                  {rg.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
    </FieldGroup>
  );
}

export default ConcreteDesignParametersForm;
