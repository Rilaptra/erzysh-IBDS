// src/components/forms/DirectInternalForcesForm.tsx
/**
 * @file DirectInternalForcesForm.tsx
 * @description Interactive form for Mode B (Direct Factored Internal Forces) with:
 * - Local string draft state so users can freely edit negative/decimal numbers without mid-typing resets
 * - Boundary support orientation selector (`supportOrientation`)
 * - Explicit confirmation/submit button ("⚡ Hitung & Terapkan Gaya Dalam") and Reset Default button
 * - Live status confirmation & error notification banner showing the optimized section or failure diagnostics
 */

"use client";

import React, { type FormEvent, type ReactElement, useEffect, useState } from "react";

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
import { cn } from "@/lib/utils";
import { beamSimulatorActions, useBeamSimulatorStore } from "@/state/beam-simulator-store";
import { floatingWindowActions } from "@/state/floating-window-store";
import type { SupportOrientation } from "@/types/beam-loading-modes";

/** Support orientation options for Mode B equivalent curve interpolation. */
const SUPPORT_OPTIONS: ReadonlyArray<{
  readonly value: SupportOrientation;
  readonly label: string;
}> = [
  { value: "PINNED_ROLLER", label: "Sendi — Rol (Simple Beam)" },
  { value: "FIXED_FIXED", label: "Jepit — Jepit (Fixed Both Ends)" },
  { value: "FIXED_PINNED", label: "Jepit — Sendi (Propped Cantilever)" },
  { value: "CANTILEVER_LEFT", label: "Kantilever (Jepit Kiri)" },
  { value: "CANTILEVER_RIGHT", label: "Kantilever (Jepit Kanan)" },
];

/** Local string draft state for Mode B inputs. */
interface DirectForcesDraftState {
  readonly spanLengthM: string;
  readonly momentMuxKnm: string;
  readonly shearVuKn: string;
  readonly axialPuKn: string;
  readonly momentMuyKnm: string;
  readonly torsionTuKnm: string;
}

/**
 * Checks whether a draft string is a complete, finite numeric literal ready for live commit.
 *
 * @param raw Raw input string from user keystrokes.
 * @returns Parsed finite number or `null` if user is mid-typing (e.g. `""`, `"-"`, `"12."`).
 */
function parseCompleteNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (
    trimmed === "" ||
    trimmed === "-" ||
    trimmed === "+" ||
    trimmed === "." ||
    trimmed === "-." ||
    trimmed.endsWith(".")
  ) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export interface DirectInternalForcesFormProps {
  readonly onAppliedSuccess?: () => void;
}

/**
 * Renders the Mode B Direct Factored Internal Forces form with draft buffering,
 * explicit submit/reset actions, and live structural optimization feedback banner.
 *
 * @returns React element for the Mode B input form.
 * @example
 * <DirectInternalForcesForm />
 */
export function DirectInternalForcesForm({
  onAppliedSuccess,
}: DirectInternalForcesFormProps = {}): ReactElement {
  const store = useBeamSimulatorStore();
  const {
    materialKind,
    supportOrientation,
    directSpanLengthM,
    directMomentMuxKnm,
    directShearVuKn,
    directAxialPuKn,
    directMomentMuyKnm,
    directTorsionTuKnm,
    solverError,
    maxDeflectionMm,
    steelOptimizationResult,
    concreteOptimizationResult,
  } = store;

  const [draft, setDraft] = useState<DirectForcesDraftState>(() => ({
    spanLengthM: String(Number(directSpanLengthM)),
    momentMuxKnm: String(Number(directMomentMuxKnm)),
    shearVuKn: String(Number(directShearVuKn)),
    axialPuKn: String(Number(directAxialPuKn)),
    momentMuyKnm: String(Number(directMomentMuyKnm)),
    torsionTuKnm: String(Number(directTorsionTuKnm)),
  }));

  const [lastConfirmedTime, setLastConfirmedTime] = useState<string | null>(null);

  // Sync draft state when store values are updated externally (e.g. voice command or preset reset)
  useEffect(() => {
    setDraft((prev) => {
      const nextSpan =
        parseCompleteNumber(prev.spanLengthM) === Number(directSpanLengthM)
          ? prev.spanLengthM
          : String(Number(directSpanLengthM));
      const nextMux =
        parseCompleteNumber(prev.momentMuxKnm) === Number(directMomentMuxKnm)
          ? prev.momentMuxKnm
          : String(Number(directMomentMuxKnm));
      const nextVu =
        parseCompleteNumber(prev.shearVuKn) === Number(directShearVuKn)
          ? prev.shearVuKn
          : String(Number(directShearVuKn));
      const nextPu =
        parseCompleteNumber(prev.axialPuKn) === Number(directAxialPuKn)
          ? prev.axialPuKn
          : String(Number(directAxialPuKn));
      const nextMuy =
        parseCompleteNumber(prev.momentMuyKnm) === Number(directMomentMuyKnm)
          ? prev.momentMuyKnm
          : String(Number(directMomentMuyKnm));
      const nextTu =
        parseCompleteNumber(prev.torsionTuKnm) === Number(directTorsionTuKnm)
          ? prev.torsionTuKnm
          : String(Number(directTorsionTuKnm));

      return {
        spanLengthM: nextSpan,
        momentMuxKnm: nextMux,
        shearVuKn: nextVu,
        axialPuKn: nextPu,
        momentMuyKnm: nextMuy,
        torsionTuKnm: nextTu,
      };
    });
  }, [
    directSpanLengthM,
    directMomentMuxKnm,
    directShearVuKn,
    directAxialPuKn,
    directMomentMuyKnm,
    directTorsionTuKnm,
  ]);

  /**
   * Handles draft input change and triggers reactive solver update if the value is valid.
   */
  const handleFieldChange = (field: keyof DirectForcesDraftState, rawValue: string): void => {
    setDraft((prev) => ({ ...prev, [field]: rawValue }));

    const parsed = parseCompleteNumber(rawValue);
    if (parsed === null) {
      return;
    }

    if (field === "spanLengthM") {
      if (parsed > 0) {
        beamSimulatorActions.setDirectForces({ spanLengthM: parsed });
      }
      return;
    }

    beamSimulatorActions.setDirectForces({ [field]: parsed });
  };

  /**
   * Explicitly commits all draft fields to the simulator store, switches to Mode B,
   * opens the Optimization Results window, and records the confirmation timestamp.
   */
  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();

    const parsedSpan = Number.parseFloat(draft.spanLengthM);
    const safeSpan = Number.isFinite(parsedSpan) && parsedSpan > 0 ? parsedSpan : 6.0;
    const safeMux = Number.isFinite(Number.parseFloat(draft.momentMuxKnm))
      ? Number.parseFloat(draft.momentMuxKnm)
      : 0;
    const safeVu = Number.isFinite(Number.parseFloat(draft.shearVuKn))
      ? Number.parseFloat(draft.shearVuKn)
      : 0;
    const safePu = Number.isFinite(Number.parseFloat(draft.axialPuKn))
      ? Number.parseFloat(draft.axialPuKn)
      : 0;
    const safeMuy = Number.isFinite(Number.parseFloat(draft.momentMuyKnm))
      ? Number.parseFloat(draft.momentMuyKnm)
      : 0;
    const safeTu = Number.isFinite(Number.parseFloat(draft.torsionTuKnm))
      ? Number.parseFloat(draft.torsionTuKnm)
      : 0;

    setDraft({
      spanLengthM: String(safeSpan),
      momentMuxKnm: String(safeMux),
      shearVuKn: String(safeVu),
      axialPuKn: String(safePu),
      momentMuyKnm: String(safeMuy),
      torsionTuKnm: String(safeTu),
    });

    beamSimulatorActions.setLoadingMode("MODE_B_DIRECT_INTERNAL_FORCES");
    beamSimulatorActions.setDirectForces({
      spanLengthM: safeSpan,
      momentMuxKnm: safeMux,
      shearVuKn: safeVu,
      axialPuKn: safePu,
      momentMuyKnm: safeMuy,
      torsionTuKnm: safeTu,
    });

    floatingWindowActions.openWindow("OPTIMIZATION_RESULTS");
    onAppliedSuccess?.();

    const now = new Date();
    setLastConfirmedTime(
      now.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    );
  };

  /**
   * Resets Mode B internal forces back to default engineering values.
   */
  const handleResetDefaults = (): void => {
    setDraft({
      spanLengthM: "6",
      momentMuxKnm: "120",
      shearVuKn: "80",
      axialPuKn: "0",
      momentMuyKnm: "0",
      torsionTuKnm: "0",
    });

    beamSimulatorActions.setSteelParameters({ selectedProfileName: null });
    beamSimulatorActions.setDirectForces({
      spanLengthM: 6.0,
      momentMuxKnm: 120,
      shearVuKn: 80,
      axialPuKn: 0,
      momentMuyKnm: 0,
      torsionTuKnm: 0,
    });

    const now = new Date();
    setLastConfirmedTime(
      now.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    );
  };

  const activeSteel = steelOptimizationResult?.bestCandidate ?? null;
  const activeConcrete = concreteOptimizationResult ?? null;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2.5 text-xs">
      <FieldGroup className="gap-2 text-xs">
        {/* 0. Kondisi Tumpuan untuk Interpolasi Lendutan & Simbol 2D */}
        <Field>
          <FieldLabel className="text-muted-foreground font-semibold">
            Kondisi Tumpuan Balok
          </FieldLabel>
          <Select
            value={supportOrientation}
            onValueChange={(val) =>
              beamSimulatorActions.setSupportOrientation(val as SupportOrientation)
            }
          >
            <SelectTrigger className="h-8 w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent onPointerDown={(e) => e.stopPropagation()}>
              <SelectGroup>
                {SUPPORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        {/* 1. Bentang L */}
        <Field>
          <FieldLabel className="text-muted-foreground font-semibold">
            Panjang Bentang Balok (L)
          </FieldLabel>
          <InputGroup>
            <InputGroupInput
              type="text"
              inputMode="decimal"
              placeholder="Contoh: 6.0"
              value={draft.spanLengthM}
              onChange={(e) => handleFieldChange("spanLengthM", e.target.value)}
            />
            <InputGroupAddon align="inline-end">m</InputGroupAddon>
          </InputGroup>
        </Field>

        {/* 2. Mux (Momen Lentur Utama) */}
        <Field>
          <FieldLabel className="font-bold text-cyan-400">Momen Lentur Terfaktor Mux</FieldLabel>
          <InputGroup>
            <InputGroupInput
              type="text"
              inputMode="decimal"
              placeholder="Contoh: 120"
              value={draft.momentMuxKnm}
              onChange={(e) => handleFieldChange("momentMuxKnm", e.target.value)}
            />
            <InputGroupAddon align="inline-end">kNm</InputGroupAddon>
          </InputGroup>
        </Field>

        {/* 3. Vu (Gaya Geser) */}
        <Field>
          <FieldLabel className="font-bold text-emerald-400">Gaya Geser Terfaktor Vu</FieldLabel>
          <InputGroup>
            <InputGroupInput
              type="text"
              inputMode="decimal"
              placeholder="Contoh: 80"
              value={draft.shearVuKn}
              onChange={(e) => handleFieldChange("shearVuKn", e.target.value)}
            />
            <InputGroupAddon align="inline-end">kN</InputGroupAddon>
          </InputGroup>
        </Field>

        {/* 4. Pu (Gaya Aksial) */}
        <Field>
          <FieldLabel className="font-bold text-purple-400">Gaya Aksial Terfaktor Pu</FieldLabel>
          <InputGroup>
            <InputGroupInput
              type="text"
              inputMode="decimal"
              placeholder="0 (+Tarik / -Tekan)"
              value={draft.axialPuKn}
              onChange={(e) => handleFieldChange("axialPuKn", e.target.value)}
            />
            <InputGroupAddon align="inline-end">kN (+T / -C)</InputGroupAddon>
          </InputGroup>
        </Field>

        {/* 5. Muy (Momen Sumbu Lemah) */}
        <Field>
          <FieldLabel className="text-muted-foreground font-semibold">
            Momen Sumbu Lemah Muy (Khusus Baja)
          </FieldLabel>
          <InputGroup>
            <InputGroupInput
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={draft.momentMuyKnm}
              onChange={(e) => handleFieldChange("momentMuyKnm", e.target.value)}
            />
            <InputGroupAddon align="inline-end">kNm</InputGroupAddon>
          </InputGroup>
        </Field>

        {/* 6. Tu (Torsi) */}
        <Field>
          <FieldLabel className="font-semibold text-amber-400">
            Momen Puntir / Torsi Tu (Khusus Baja)
          </FieldLabel>
          <InputGroup>
            <InputGroupInput
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={draft.torsionTuKnm}
              onChange={(e) => handleFieldChange("torsionTuKnm", e.target.value)}
            />
            <InputGroupAddon align="inline-end">kNm</InputGroupAddon>
          </InputGroup>
        </Field>
      </FieldGroup>

      {/* 7. Tombol Konfirmasi / Hitung & Reset */}
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <Button
          type="submit"
          size="sm"
          className="h-auto min-h-8 min-w-[11rem] flex-1 bg-linear-to-r from-cyan-500 to-blue-600 py-1.5 text-center text-xs leading-snug font-bold whitespace-normal text-white shadow-sm hover:from-cyan-600 hover:to-blue-700"
        >
          ⚡ Hitung & Terapkan Gaya Dalam
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleResetDefaults}
          className="h-8 shrink-0 text-xs font-medium"
        >
          ↺ Reset
        </Button>
      </div>

      {/* 8. Banner Pemberitahuan Status Kalkulasi / Error */}
      {solverError ? (
        <div
          role="alert"
          className="rounded-lg border border-red-500/50 bg-red-950/40 p-2.5 text-[11px] leading-relaxed text-red-200"
        >
          <div className="flex items-center justify-between font-bold text-red-400">
            <span>⚠️ Kapasitas Katalog Terlampaui / Error Solver</span>
            {lastConfirmedTime ? (
              <span className="font-mono text-[10px] text-red-300/80">{lastConfirmedTime}</span>
            ) : null}
          </div>
          <p className="mt-1 text-red-200/90">{solverError}</p>
        </div>
      ) : materialKind === "STEEL" && activeSteel ? (
        <div
          role="status"
          className="rounded-lg border border-emerald-500/35 bg-emerald-950/25 p-2.5 text-[11px] leading-relaxed"
        >
          <div className="flex items-center justify-between">
            <span className="font-bold text-emerald-400">✅ Profil Baja Optimal Diperbarui</span>
            <Badge
              variant="secondary"
              className={cn(
                "h-4 px-1.5 py-0 text-[10px] font-bold",
                "border-emerald-500/40 bg-emerald-500/20 text-emerald-300",
              )}
            >
              DCR {(Number(activeSteel.governingDcr) * 100).toFixed(1)}%
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 text-slate-200">
            <strong className="text-xs text-sky-300">{activeSteel.properties.name}</strong>
            <span className="text-muted-foreground text-[10px]">
              {activeSteel.grade.grade.replace("_", " ")} •{" "}
              {Number(activeSteel.properties.unitWeightKgPerM).toFixed(1)} kg/m
            </span>
          </div>
          <div className="text-muted-foreground mt-0.5 flex items-center justify-between text-[10px]">
            <span>
              Δmaks ={" "}
              <strong className="font-mono text-amber-300">{maxDeflectionMm.toFixed(2)} mm</strong>
            </span>
            {lastConfirmedTime ? <span>Diperbarui: {lastConfirmedTime}</span> : null}
          </div>
        </div>
      ) : materialKind === "CONCRETE" && activeConcrete ? (
        <div
          role="status"
          className="rounded-lg border border-emerald-500/35 bg-emerald-950/25 p-2.5 text-[11px] leading-relaxed"
        >
          <div className="flex items-center justify-between">
            <span className="font-bold text-emerald-400">
              ✅ Penampang Beton Optimal Diperbarui
            </span>
            <Badge
              variant="secondary"
              className="h-4 border-emerald-500/40 bg-emerald-500/20 px-1.5 py-0 text-[10px] font-bold text-emerald-300"
            >
              DCR {(Number(activeConcrete.flexure.flexuralDcr) * 100).toFixed(1)}%
            </Badge>
          </div>
          <div className="mt-1 text-slate-200">
            <strong className="text-sky-300">
              Balok {Number(activeConcrete.section.bw)} × {Number(activeConcrete.section.h)} mm
            </strong>{" "}
            <span className="text-muted-foreground text-[10px]">
              ({activeConcrete.flexure.tensionLayers[0]?.barCount ?? 0}D
              {Number(activeConcrete.flexure.tensionLayers[0]?.barDiameter ?? 0)} | Δmaks ={" "}
              {maxDeflectionMm.toFixed(2)} mm)
            </span>
          </div>
        </div>
      ) : null}
    </form>
  );
}

export default DirectInternalForcesForm;
