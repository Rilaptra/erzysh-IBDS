/**
 * @file ExternalLoadInteractiveForm.tsx
 * @description Real-time interactive form for Mode A (External Loads):
 * - Clear span length L (m)
 * - 5 Support categories (8 boundary orientations)
 * - Point loads list (P in kN, position x in m)
 * - Distributed segment loads (q in kN/m, start x1, end x2 in m)
 * - Self-weight inclusion toggle
 */

"use client";

import { PlusIcon, XIcon } from "lucide-react";
import type { ReactElement } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Slider } from "@/components/ui/slider";
import { beamSimulatorActions, useBeamSimulatorStore } from "@/state/beam-simulator-store";
import type { SupportOrientation } from "@/types/beam-loading-modes";
import { kilonewton, kilonewtonPerMeter, meter } from "@/types/branded-units";

const SUPPORT_OPTIONS: Array<{ value: SupportOrientation; label: string }> = [
  { value: "PINNED_ROLLER", label: "Sendi — Rol (Simply Supported)" },
  { value: "ROLLER_PINNED", label: "Rol — Sendi" },
  { value: "CANTILEVER_LEFT", label: "Kantilever (Jepit Kiri — Bebas)" },
  { value: "CANTILEVER_RIGHT", label: "Kantilever (Bebas — Jepit Kanan)" },
  { value: "FIXED_FIXED", label: "Jepit — Jepit (Fixed End)" },
  { value: "FIXED_ROLLER", label: "Jepit — Rol" },
  { value: "ROLLER_FIXED", label: "Rol — Jepit" },
  { value: "FIXED_PINNED", label: "Jepit — Sendi" },
  { value: "PINNED_FIXED", label: "Sendi — Jepit" },
];

export function ExternalLoadInteractiveForm(): ReactElement {
  const { spanLengthM, supportOrientation, pointLoads, distributedLoads } = useBeamSimulatorStore();

  const handleSpanChange = (val: number): void => {
    if (val > 0) {
      beamSimulatorActions.setSpanLength(val);
    }
  };

  const handleAddPointLoad = (): void => {
    const nextId = `P${pointLoads.length + 1}`;
    beamSimulatorActions.setPointLoads([
      ...pointLoads,
      {
        id: nextId,
        magnitude: kilonewton(30),
        position: meter(Number(spanLengthM) / 2),
      },
    ]);
  };

  const handleRemovePointLoad = (index: number): void => {
    beamSimulatorActions.setPointLoads(pointLoads.filter((_, idx) => idx !== index));
  };

  const handleUpdatePointLoad = (index: number, mag: number, pos: number): void => {
    const updated = [...pointLoads];
    const target = updated[index];
    if (target) {
      updated[index] = {
        ...target,
        magnitude: kilonewton(mag),
        position: meter(Math.min(Math.max(0, pos), Number(spanLengthM))),
      };
      beamSimulatorActions.setPointLoads(updated);
    }
  };

  const handleAddDistLoad = (): void => {
    const nextId = `Q${distributedLoads.length + 1}`;
    beamSimulatorActions.setDistributedLoads([
      ...distributedLoads,
      {
        id: nextId,
        magnitude: kilonewtonPerMeter(10),
        startPosition: meter(0),
        endPosition: meter(Number(spanLengthM)),
      },
    ]);
  };

  const handleRemoveDistLoad = (index: number): void => {
    beamSimulatorActions.setDistributedLoads(distributedLoads.filter((_, idx) => idx !== index));
  };

  return (
    <FieldGroup className="gap-3 text-xs">
      {/* 1. Panjang Bentang L */}
      <Field>
        <div className="flex items-center justify-between">
          <FieldLabel className="text-muted-foreground font-semibold">
            Panjang Bentang Balok (L)
          </FieldLabel>
          <span className="font-mono font-bold text-sky-400">
            {Number(spanLengthM).toFixed(2)} m
          </span>
        </div>
        <Slider
          min={1}
          max={24}
          step={0.25}
          value={[Number(spanLengthM)]}
          onValueChange={([val]) => {
            if (val !== undefined) handleSpanChange(val);
          }}
          className="mt-1"
        />
      </Field>

      {/* 2. Konfigurasi Tumpuan */}
      <Field>
        <FieldLabel className="text-muted-foreground font-semibold">
          Konfigurasi Tumpuan Balok
        </FieldLabel>
        <Select
          value={supportOrientation}
          onValueChange={(val) =>
            beamSimulatorActions.setSupportOrientation(val as SupportOrientation)
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Pilih tumpuan balok..." />
          </SelectTrigger>
          <SelectContent onPointerDown={(e) => e.stopPropagation()}>
            <SelectGroup>
              {SUPPORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>

      {/* 3. Beban Titik Terpusat (P) */}
      <Field>
        <div className="mb-1 flex items-center justify-between">
          <FieldLabel className="text-muted-foreground font-semibold">
            Beban Titik Terpusat (P)
          </FieldLabel>
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={handleAddPointLoad}
            className="border-sky-400/30 text-sky-400 hover:bg-sky-500/10"
          >
            <PlusIcon data-icon="inline-start" /> Tambah P
          </Button>
        </div>

        <div className="flex flex-col gap-1.5">
          {pointLoads.map((pl, idx) => (
            <div
              key={pl.id}
              className="bg-muted/30 border-border/30 flex items-center gap-1.5 rounded-lg border p-1.5"
            >
              <Badge
                variant="outline"
                className="h-5 border-red-500/30 px-1.5 py-0 font-bold text-red-400"
              >
                {pl.id}
              </Badge>
              <InputGroup className="w-24">
                <InputGroupInput
                  type="number"
                  value={Number(pl.magnitude)}
                  onChange={(e) =>
                    handleUpdatePointLoad(idx, parseFloat(e.target.value) || 0, Number(pl.position))
                  }
                />
                <InputGroupAddon align="inline-end">kN</InputGroupAddon>
              </InputGroup>

              <InputGroup className="w-28">
                <InputGroupAddon align="inline-start">x=</InputGroupAddon>
                <InputGroupInput
                  type="number"
                  step="0.1"
                  value={Number(pl.position)}
                  onChange={(e) =>
                    handleUpdatePointLoad(
                      idx,
                      Number(pl.magnitude),
                      parseFloat(e.target.value) || 0,
                    )
                  }
                />
                <InputGroupAddon align="inline-end">m</InputGroupAddon>
              </InputGroup>

              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => handleRemovePointLoad(idx)}
                className="text-muted-foreground hover:text-destructive ml-auto"
              >
                <XIcon />
              </Button>
            </div>
          ))}
        </div>
      </Field>

      {/* 4. Beban Merata (q) */}
      <Field>
        <div className="mb-1 flex items-center justify-between">
          <FieldLabel className="text-muted-foreground font-semibold">Beban Merata (q)</FieldLabel>
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={handleAddDistLoad}
            className="border-emerald-400/30 text-emerald-400 hover:bg-emerald-500/10"
          >
            <PlusIcon data-icon="inline-start" /> Tambah q
          </Button>
        </div>

        <div className="flex flex-col gap-1.5">
          {distributedLoads.map((dl, idx) => (
            <div
              key={dl.id}
              className="bg-muted/30 border-border/30 flex items-center gap-1.5 rounded-lg border p-1.5"
            >
              <Badge
                variant="outline"
                className="h-5 border-emerald-500/30 px-1.5 py-0 font-bold text-emerald-400"
              >
                {dl.id}
              </Badge>
              <InputGroup className="flex-1">
                <InputGroupInput
                  type="number"
                  value={Number(dl.magnitude)}
                  onChange={(e) => {
                    const updated = [...distributedLoads];
                    const target = updated[idx];
                    if (target) {
                      updated[idx] = {
                        ...target,
                        magnitude: kilonewtonPerMeter(parseFloat(e.target.value) || 0),
                      };
                      beamSimulatorActions.setDistributedLoads(updated);
                    }
                  }}
                />
                <InputGroupAddon align="inline-end">kN/m</InputGroupAddon>
              </InputGroup>

              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => handleRemoveDistLoad(idx)}
                className="text-muted-foreground hover:text-destructive ml-auto"
              >
                <XIcon />
              </Button>
            </div>
          ))}
        </div>
      </Field>
    </FieldGroup>
  );
}

export default ExternalLoadInteractiveForm;
