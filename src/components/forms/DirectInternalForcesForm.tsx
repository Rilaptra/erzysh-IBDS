/**
 * @file DirectInternalForcesForm.tsx
 * @description Real-time interactive form for Mode B (Direct Factored Internal Forces):
 * - Factored strong-axis moment Mux (kNm)
 * - Factored shear force Vu (kN)
 * - Factored axial force Pu (kN)
 * - Factored weak-axis moment Muy (kNm)
 * - Factored torsion Tu (kNm)
 * - Span length L (m)
 */

"use client";

import type { ReactElement } from "react";

import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { beamSimulatorActions, useBeamSimulatorStore } from "@/state/beam-simulator-store";

export function DirectInternalForcesForm(): ReactElement {
  const {
    directSpanLengthM,
    directMomentMuxKnm,
    directShearVuKn,
    directAxialPuKn,
    directMomentMuyKnm,
    directTorsionTuKnm,
  } = useBeamSimulatorStore();

  return (
    <FieldGroup className="gap-2.5 text-xs">
      {/* 1. Bentang L */}
      <Field>
        <FieldLabel className="text-muted-foreground font-semibold">
          Panjang Bentang Balok (L)
        </FieldLabel>
        <InputGroup>
          <InputGroupInput
            type="number"
            step="0.5"
            value={Number(directSpanLengthM)}
            onChange={(e) =>
              beamSimulatorActions.setDirectForces({ spanLengthM: parseFloat(e.target.value) || 1 })
            }
          />
          <InputGroupAddon align="inline-end">m</InputGroupAddon>
        </InputGroup>
      </Field>

      {/* 2. Mux (Momen Lentur Utama) */}
      <Field>
        <FieldLabel className="font-bold text-cyan-500">Momen Lentur Terfaktor Mux</FieldLabel>
        <InputGroup>
          <InputGroupInput
            type="number"
            value={Number(directMomentMuxKnm)}
            onChange={(e) =>
              beamSimulatorActions.setDirectForces({
                momentMuxKnm: parseFloat(e.target.value) || 0,
              })
            }
          />
          <InputGroupAddon align="inline-end">kNm</InputGroupAddon>
        </InputGroup>
      </Field>

      {/* 3. Vu (Gaya Geser) */}
      <Field>
        <FieldLabel className="font-bold text-emerald-500">Gaya Geser Terfaktor Vu</FieldLabel>
        <InputGroup>
          <InputGroupInput
            type="number"
            value={Number(directShearVuKn)}
            onChange={(e) =>
              beamSimulatorActions.setDirectForces({ shearVuKn: parseFloat(e.target.value) || 0 })
            }
          />
          <InputGroupAddon align="inline-end">kN</InputGroupAddon>
        </InputGroup>
      </Field>

      {/* 4. Pu (Gaya Aksial) */}
      <Field>
        <FieldLabel className="font-bold text-purple-500">Gaya Aksial Terfaktor Pu</FieldLabel>
        <InputGroup>
          <InputGroupInput
            type="number"
            value={Number(directAxialPuKn)}
            onChange={(e) =>
              beamSimulatorActions.setDirectForces({ axialPuKn: parseFloat(e.target.value) || 0 })
            }
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
            type="number"
            value={Number(directMomentMuyKnm)}
            onChange={(e) =>
              beamSimulatorActions.setDirectForces({
                momentMuyKnm: parseFloat(e.target.value) || 0,
              })
            }
          />
          <InputGroupAddon align="inline-end">kNm</InputGroupAddon>
        </InputGroup>
      </Field>

      {/* 6. Tu (Torsi) */}
      <Field>
        <FieldLabel className="font-semibold text-amber-500">
          Momen Puntir / Torsi Tu (Khusus Baja)
        </FieldLabel>
        <InputGroup>
          <InputGroupInput
            type="number"
            value={Number(directTorsionTuKnm)}
            onChange={(e) =>
              beamSimulatorActions.setDirectForces({
                torsionTuKnm: parseFloat(e.target.value) || 0,
              })
            }
          />
          <InputGroupAddon align="inline-end">kNm</InputGroupAddon>
        </InputGroup>
      </Field>
    </FieldGroup>
  );
}

export default DirectInternalForcesForm;
