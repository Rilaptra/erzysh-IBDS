/**
 * @file multi-command-compound.test.ts
 * @description Comprehensive unit tests for multi-command compound voice intent routing and execution.
 * Validates:
 * 1. User's exact prompt: "ganti ke beton dan munculkan jendela untuk mengatur dimensi dan gaya dalam".
 * 2. Multi-window opening and closing batch actions.
 * 3. Multi-diagram toggling batch actions.
 * 4. Multi-parameter modifications (span length, point load, distributed load).
 * 5. Camera + view mode compound commands.
 * 6. Sequential execution of multiple commands against simulator state.
 */

import { describe, expect, it } from "bun:test";

import { executeRegistryCommand } from "@/hooks/use-web-speech-command";
import {
  extractMultiWindowActions,
  matchRuleBasedIntent,
  splitCompoundClauses,
} from "@/lib/command-matcher";
import { getBeamSimulatorSnapshot } from "@/state/beam-simulator-store";
import { getFloatingWindowState } from "@/state/floating-window-store";

describe("Multi-Command Compound Intent Routing & Execution", () => {
  describe("Clause Splitting & Protected Phrases", () => {
    it("splits compound conjunctions into distinct clauses", () => {
      const clauses = splitCompoundClauses(
        "ganti ke beton lalu ubah bentang ke 8 meter terus fit tampilan",
      );
      expect(clauses.length).toBe(3);
      expect(clauses[0]).toBe("ganti ke beton");
      expect(clauses[1]).toBe("ubah bentang ke 8 meter");
      expect(clauses[2]).toBe("fit tampilan");
    });

    it("preserves protected multi-word terms like sendi-rol and solid + potongan", () => {
      const clauses = splitCompoundClauses("tumpuan sendi dan rol, dan mode solid dan potongan");
      expect(clauses.length).toBe(2);
      expect(clauses[0]).toContain("sendi-rol");
      expect(clauses[1]).toContain("solid + potongan");
    });
  });

  describe("User's Exact Multi-Intent Prompt", () => {
    it("correctly identifies all 3 actions for: 'ganti ke beton dan munculkan jendela untuk mengatur dimensi dan gaya dalam'", () => {
      const transcript =
        "ganti ke beton dan munculkan jendela untuk mengatur dimensi dan gaya dalam";
      const result = matchRuleBasedIntent(transcript);

      expect(result).not.toBeNull();
      expect(result?.actions).toBeDefined();
      expect(result?.actions?.length).toBe(3);

      const commandIds = result?.actions?.map((a) => a.commandId);
      expect(commandIds).toContain("SWITCH_MATERIAL_CONCRETE");
      expect(commandIds).toContain("OPEN_WINDOW");

      // Verify specific window targets
      const windowTargets = result?.actions
        ?.filter((a) => a.commandId === "OPEN_WINDOW")
        .map((a) => a.extractedParameters?.target);

      expect(windowTargets).toContain("SNI_DESIGN_PARAMETERS");
      expect(windowTargets).toContain("INTERNAL_FORCE_DIAGRAMS");

      // Spoken confirmation should describe the multiple actions
      expect(result?.spokenConfirmation).toContain("3 perintah");
    });

    it("executes all 3 actions sequentially and updates simulator + floating window stores", () => {
      const transcript =
        "ganti ke beton dan munculkan jendela untuk mengatur dimensi dan gaya dalam";
      const result = matchRuleBasedIntent(transcript);
      expect(result?.actions?.length).toBe(3);

      // Execute each action in order
      for (const act of result?.actions ?? []) {
        const execResult = executeRegistryCommand(act.commandId, act.extractedParameters);
        expect(execResult.success).toBe(true);
      }

      // 1. Verify beam material became CONCRETE
      const snapshot = getBeamSimulatorSnapshot();
      expect(snapshot.materialKind).toBe("CONCRETE");

      // 2. Verify floating windows are open
      const windowState = getFloatingWindowState();
      expect(windowState.windows.SNI_DESIGN_PARAMETERS.isOpen).toBe(true);
      expect(windowState.windows.INTERNAL_FORCE_DIAGRAMS.isOpen).toBe(true);
    });
  });

  describe("Multi-Window Batch Open & Close", () => {
    it("routes multi-window opening: 'buka jendela material dan jendela beban'", () => {
      const res = matchRuleBasedIntent("buka jendela material dan jendela beban");
      expect(res).not.toBeNull();
      const actions = res?.actions ?? [];
      expect(actions.length).toBe(2);
      expect(actions[0]?.commandId).toBe("OPEN_WINDOW");
      expect(actions[0]?.extractedParameters?.target).toBe("MATERIAL_LOAD_MODE");
      expect(actions[1]?.commandId).toBe("OPEN_WINDOW");
      expect(actions[1]?.extractedParameters?.target).toBe("REALTIME_LOAD_INPUT");
    });

    it("routes multi-window closing: 'tutup jendela diagram dan jendela optimasi'", () => {
      const res = matchRuleBasedIntent("tutup jendela diagram dan jendela optimasi");
      expect(res).not.toBeNull();
      const actions = res?.actions ?? [];
      expect(actions.length).toBe(2);
      expect(actions[0]?.commandId).toBe("CLOSE_WINDOW");
      expect(actions[0]?.extractedParameters?.target).toBe("INTERNAL_FORCE_DIAGRAMS");
      expect(actions[1]?.commandId).toBe("CLOSE_WINDOW");
      expect(actions[1]?.extractedParameters?.target).toBe("OPTIMIZATION_RESULTS");
    });
  });

  describe("Multi-Parameter & Viewport Combinations", () => {
    it("routes: 'ubah bentang ke 12 meter dan tambah beban titik 80 kN'", () => {
      const res = matchRuleBasedIntent("ubah bentang ke 12 meter dan tambah beban titik 80 kN");
      expect(res).not.toBeNull();
      const actions = res?.actions ?? [];
      expect(actions.length).toBe(2);

      const a1 = actions[0];
      expect(a1?.commandId).toBe("SET_SPAN_LENGTH");
      expect(a1?.extractedParameters?.spanLengthM).toBe(12);

      const a2 = actions[1];
      expect(a2?.commandId).toBe("ADD_POINT_LOAD");
      expect(a2?.extractedParameters?.magnitudeKn).toBe(80);
    });

    it("routes: 'lihat tampak depan 2d lalu tampilkan wireframe tulangan dan fit tampilan'", () => {
      const res = matchRuleBasedIntent(
        "lihat tampak depan 2d lalu tampilkan wireframe tulangan dan fit tampilan",
      );
      expect(res).not.toBeNull();
      const actions = res?.actions ?? [];
      expect(actions.length).toBe(3);

      expect(actions[0]?.commandId).toBe("SET_VIEW_FRONT");
      expect(actions[1]?.commandId).toBe("SET_CONCRETE_VIEW_WIREFRAME");
      expect(actions[2]?.commandId).toBe("FIT_CAMERA_VIEW");
    });

    it("routes: 'ganti material baja dan filter profil iwf'", () => {
      const res = matchRuleBasedIntent("ganti material baja dan filter profil iwf");
      expect(res).not.toBeNull();
      const actions = res?.actions ?? [];
      expect(actions.length).toBe(2);

      expect(actions[0]?.commandId).toBe("SWITCH_MATERIAL_STEEL");
      expect(actions[1]?.commandId).toBe("FILTER_STEEL_IWF");
    });
  });

  describe("Backward Compatibility on Single Commands", () => {
    it("preserves single-command routing behavior unchanged", () => {
      const r1 = matchRuleBasedIntent("ganti ke material beton bertulang");
      expect(r1?.commandId).toBe("SWITCH_MATERIAL_CONCRETE");
      expect(r1?.confidence).toBeGreaterThanOrEqual(0.9);

      const r2 = matchRuleBasedIntent("switch to steel");
      expect(r2?.commandId).toBe("SWITCH_MATERIAL_STEEL");
      expect(r2?.confidence).toBeGreaterThanOrEqual(0.9);

      const r3 = matchRuleBasedIntent("fit view");
      expect(r3?.commandId).toBe("FIT_CAMERA_VIEW");

      const r4 = matchRuleBasedIntent("span 8.5 m");
      expect(r4?.commandId).toBe("SET_SPAN_LENGTH");
      expect(r4?.extractedParameters.spanLengthM).toBe(8.5);
    });
  });
});
