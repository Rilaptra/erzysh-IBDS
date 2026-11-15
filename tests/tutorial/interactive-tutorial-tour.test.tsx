import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";

import React from "react";
import { renderToString } from "react-dom/server";

import { parseTutorialQueryParam } from "@/components/adaptive/AdaptiveApplicationShell";
import { InteractiveTutorialOverlay } from "@/components/tutorial/InteractiveTutorialOverlay";
import { TOTAL_TUTORIAL_STEPS, TUTORIAL_QUEST_STEPS } from "@/config/tutorial-steps-config";
import type { UseWebSpeechCommandResult } from "@/hooks/use-web-speech-command";
import { matchRuleBasedIntent } from "@/lib/command-matcher";
import {
  getTutorialTourState,
  TUTORIAL_STORAGE_KEY,
  tutorialTourActions,
} from "@/state/tutorial-tour-store";

function createMockVoiceResult(
  overrides: Partial<UseWebSpeechCommandResult> = {},
): UseWebSpeechCommandResult {
  return {
    isListening: false,
    isMuted: false,
    isSupported: true,
    transcript: "",
    lastExecution: null,
    suggestions: [],
    feedbackMessage: "",
    error: null,
    toggleListening: () => {},
    setMuted: () => {},
    testAudioTone: () => {},
    executeCommand: (commandId) => ({
      success: true,
      commandId,
      message: "ok",
      timestamp: Date.now(),
    }),
    executeTranscript: () => null,
    speakFeedback: async () => {},
    ...overrides,
  };
}

describe("IBDS Engineer Quest — Interactive Tutorial System", () => {
  beforeEach(() => {
    tutorialTourActions.resetTutorialStateForTests();
  });

  afterEach(() => {
    tutorialTourActions.resetTutorialStateForTests();
  });

  describe("Quest Configuration & DXF-Only Export Constraints", () => {
    it("memiliki tepat 9 misi berurutan dengan ID unik", () => {
      expect(TOTAL_TUTORIAL_STEPS).toBe(9);
      expect(TUTORIAL_QUEST_STEPS).toHaveLength(9);

      const ids = TUTORIAL_QUEST_STEPS.map((s) => s.id);
      expect(new Set(ids).size).toBe(9);
      TUTORIAL_QUEST_STEPS.forEach((step, idx) => {
        expect(step.stepNumber).toBe(idx + 1);
        expect(step.ucuyDialogue.length).toBeGreaterThan(10);
        expect(step.voiceNarration.length).toBeGreaterThan(10);
        expect(step.voiceCommandExample.length).toBeGreaterThan(3);
      });
    });

    it("setiap contoh perintah suara Misi 1-8 dikenali command-matcher secara deterministik", () => {
      for (let i = 0; i < 8; i++) {
        const step = TUTORIAL_QUEST_STEPS[i]!;
        const match = matchRuleBasedIntent(step.voiceCommandExample);
        expect(match).not.toBeNull();
        expect(step.acceptedCommandIds).toContain(match!.commandId);
      }
    });

    it("Misi 8 & 9 berfokus eksklusif pada ekspor langsung AutoCAD (.dxf) tanpa menyebut .lsp", () => {
      const combinedText = JSON.stringify(TUTORIAL_QUEST_STEPS);
      expect(combinedText.toLowerCase()).not.toContain(".lsp");
      expect(combinedText.toLowerCase()).not.toContain("autolisp");

      const quest8 = TUTORIAL_QUEST_STEPS[7]!;
      expect(quest8.id).toBe("quest-8-export-dxf");
      expect(quest8.questKind).toBe("EXPORT_DXF");
      expect(quest8.targetWindowId).toBe("OPTIMIZATION_RESULTS");
      expect(quest8.targetSelector).toBe("[data-tutorial-export-trigger='true']");
      expect(quest8.acceptedCommandIds).toEqual(["EXPORT_DXF"]);
      expect(quest8.missionDescription).toContain(".dxf");

      const quest9 = TUTORIAL_QUEST_STEPS[8]!;
      expect(quest9.id).toBe("quest-9-autocad-guide");
      expect(quest9.questKind).toBe("AUTOCAD_GUIDE");
    });

    it("Panel 4 & ProfileAndModelExportModal mengekspos kait data-tutorial tanpa kopling UI tutorial", () => {
      const modalPath = path.resolve(
        process.cwd(),
        "src/components/results/ProfileAndModelExportModal.tsx",
      );
      const modalSource = fs.readFileSync(modalPath, "utf8");
      expect(modalSource).not.toContain("InteractiveTutorialOverlay");
      expect(modalSource).not.toContain("tutorialTourActions");
      expect(modalSource).not.toContain("IBDS Engineer Quest");
      expect(modalSource).toContain("data-tutorial-export-modal");
      expect(modalSource).toContain("data-tutorial-export-format");
      expect(modalSource).toContain("data-tutorial-export-download");
      expect(modalSource).toContain("app:dxf-exported");

      const steelTablePath = path.resolve(
        process.cwd(),
        "src/components/results/SteelOptimizationRankingTable.tsx",
      );
      const concreteCardPath = path.resolve(
        process.cwd(),
        "src/components/results/ConcreteOptimizationResultCard.tsx",
      );
      expect(fs.readFileSync(steelTablePath, "utf8")).toContain(
        'data-tutorial-export-trigger="true"',
      );
      expect(fs.readFileSync(concreteCardPath, "utf8")).toContain(
        'data-tutorial-export-trigger="true"',
      );
    });
  });

  describe("Tutorial Voice Control Intent Matching", () => {
    it("mengenali perintah suara START, NEXT, PREV, REPEAT, dan STOP tutorial", () => {
      const cases: Array<[string, string]> = [
        ["Mulai tutorial", "START"],
        ["Buka panduan sekarang", "START"],
        ["Lanjut tutorial", "NEXT"],
        ["Langkah berikutnya", "NEXT"],
        ["Langkah sebelumnya", "PREV"],
        ["Kembali tutorial", "PREV"],
        ["Bacakan ulang", "REPEAT"],
        ["Ulangi penjelasan", "REPEAT"],
        ["Tutup tutorial", "STOP"],
        ["Selesai tutorial", "STOP"],
      ];

      for (const [phrase, expectedAction] of cases) {
        const match = matchRuleBasedIntent(phrase);
        expect(match).not.toBeNull();
        expect(match?.commandId).toBe("AI_CONSULTATION");
        expect(match?.extractedParameters?.tutorialAction).toBe(expectedAction);
      }
    });
  });

  describe("Tutorial Tour Store Transitions & Persistence", () => {
    it("mengelola alur kunjungan pertama, navigasi misi, dan penyelesaian", () => {
      expect(getTutorialTourState().isActive).toBe(false);
      expect(getTutorialTourState().isWelcomeOpen).toBe(false);

      // Kunjungan pertama -> tampilkan sambutan
      tutorialTourActions.initFirstVisitCheck(false);
      expect(getTutorialTourState().isWelcomeOpen).toBe(true);
      expect(getTutorialTourState().isActive).toBe(false);

      // Mulai tutorial -> tutup sambutan, aktifkan misi 1
      tutorialTourActions.startTutorial(0);
      expect(getTutorialTourState().isWelcomeOpen).toBe(false);
      expect(getTutorialTourState().isActive).toBe(true);
      expect(getTutorialTourState().currentStepIndex).toBe(0);

      // Navigasi clamping
      tutorialTourActions.prevStep();
      expect(getTutorialTourState().currentStepIndex).toBe(0);
      tutorialTourActions.nextStep();
      expect(getTutorialTourState().currentStepIndex).toBe(1);
      tutorialTourActions.goToStep(99);
      expect(getTutorialTourState().currentStepIndex).toBe(TOTAL_TUTORIAL_STEPS - 1);

      // Tandai selesai idempoten
      expect(tutorialTourActions.markStepCompleted("quest-1-material")).toBe(true);
      expect(tutorialTourActions.markStepCompleted("quest-1-material")).toBe(false);
      expect(getTutorialTourState().completedStepIds).toContain("quest-1-material");

      // Rekam ekspor DXF
      expect(tutorialTourActions.recordDxfExport("IBDS-Beam-6m.dxf")).toBe(true);
      expect(getTutorialTourState().lastExportedDxfFile).toBe("IBDS-Beam-6m.dxf");
      expect(getTutorialTourState().completedStepIds).toContain("quest-8-export-dxf");

      // Toggle narasi suara
      expect(getTutorialTourState().isVoiceNarrationEnabled).toBe(true);
      tutorialTourActions.toggleVoiceNarration();
      expect(getTutorialTourState().isVoiceNarrationEnabled).toBe(false);

      // Lanjut di langkah terakhir menutup & menuntaskan tur
      tutorialTourActions.goToStep(TOTAL_TUTORIAL_STEPS - 1);
      tutorialTourActions.nextStep();
      expect(getTutorialTourState().isActive).toBe(false);
      expect(getTutorialTourState().hasCompletedTour).toBe(true);
      expect(getTutorialTourState().completedStepIds).toContain("quest-9-autocad-guide");
    });

    it("membaca flag forceStart (?tutorial=1) & membaca persistensi localStorage", () => {
      const fakeStorage = new Map<string, string>();
      const prevWindow = globalThis.window;

      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: {
          localStorage: {
            getItem: (key: string) => fakeStorage.get(key) ?? null,
            setItem: (key: string, val: string) => {
              fakeStorage.set(key, val);
            },
            removeItem: (key: string) => {
              fakeStorage.delete(key);
            },
          },
        },
      });

      try {
        tutorialTourActions.resetTutorialStateForTests();
        tutorialTourActions.initFirstVisitCheck(false);
        expect(getTutorialTourState().isWelcomeOpen).toBe(true);

        tutorialTourActions.dismissWelcome();
        expect(fakeStorage.has(TUTORIAL_STORAGE_KEY)).toBe(true);

        // Simulasi kunjungan kedua (state memori di-reset namun localStorage tetap ada)
        tutorialTourActions.markStepCompleted("quest-2-loads");
        expect(JSON.parse(fakeStorage.get(TUTORIAL_STORAGE_KEY)!).hasDismissedWelcome).toBe(true);

        // forceStart (?tutorial=1) selalu membuka misi 1 walaupun pernah dismiss
        tutorialTourActions.initFirstVisitCheck(true);
        expect(getTutorialTourState().isActive).toBe(true);
        expect(getTutorialTourState().isWelcomeOpen).toBe(false);
        expect(getTutorialTourState().currentStepIndex).toBe(0);

        // forceStart (?tutorial=7) langsung membuka Misi 7 (index 6)
        const parsedSeven = parseTutorialQueryParam("7");
        expect(parsedSeven).toEqual({ shouldForceStart: true, stepIndex: 6 });
        expect(parseTutorialQueryParam("1")).toEqual({ shouldForceStart: true, stepIndex: 0 });
        expect(parseTutorialQueryParam("true")).toEqual({ shouldForceStart: true, stepIndex: 0 });
        expect(parseTutorialQueryParam("0")).toEqual({ shouldForceStart: false, stepIndex: 0 });

        tutorialTourActions.initFirstVisitCheck(
          parsedSeven.shouldForceStart,
          parsedSeven.stepIndex,
        );
        expect(getTutorialTourState().isActive).toBe(true);
        expect(getTutorialTourState().isWelcomeOpen).toBe(false);
        expect(getTutorialTourState().currentStepIndex).toBe(6);
      } finally {
        if (prevWindow === undefined) {
          Reflect.deleteProperty(globalThis, "window");
        } else {
          Object.defineProperty(globalThis, "window", {
            configurable: true,
            value: prevWindow,
          });
        }
      }
    });
  });

  describe("InteractiveTutorialOverlay SSR Rendering", () => {
    it("merender kartu sambutan kunjungan pertama secara akurat", () => {
      tutorialTourActions.initFirstVisitCheck(false);
      const html = renderToString(<InteractiveTutorialOverlay />);
      expect(html).toContain("Baru pertama kali memakai IBDS?");
      expect(html).toContain("Mulai Misi Tutorial");
      expect(html).toContain("AutoCAD (.dxf)");
    });

    it("merender Misi 8 (Ekspor Langsung .DXF) & indikator Live Voice Input", () => {
      tutorialTourActions.startTutorial(7);
      tutorialTourActions.recordDxfExport("IBDS-Balok-IWF.dxf");
      const mockVoice = createMockVoiceResult({
        isListening: true,
        transcript: "Ekspor ke AutoCAD DXF",
      });

      const html = renderToString(<InteractiveTutorialOverlay voice={mockVoice} />);
      expect(html).toContain("Ekspor Langsung AutoCAD (.dxf)");
      expect(html).toContain("IBDS-Balok-IWF.dxf");
      expect(html).toContain("MISI SELESAI!");
      expect(html).toContain("Live Voice Input Aktif");
      expect(html).toContain("Mic On");
      expect(html.toLowerCase()).not.toContain(".lsp");
    });

    it("merender Misi 9 (Panduan Buka DXF & 4 Layer Standar di AutoCAD)", () => {
      tutorialTourActions.startTutorial(8);
      const html = renderToString(<InteractiveTutorialOverlay voice={createMockVoiceResult()} />);

      expect(html).toContain("Panduan Cepat Buka DXF di AutoCAD");
      expect(html).toContain("ZOOM");
      expect(html).toContain("EXTENTS");
      expect(html).toContain("Millimeters");
      expect(html).toContain("S-SECT-OUTLINE");
      expect(html).toContain("S-REBAR-STIRRUP");
      expect(html).toContain("S-REBAR-MAIN");
      expect(html).toContain("S-ANNO-DIMS");
      expect(html).toContain("Selesai &amp; Tutup");
    });

    it("spotlight reticle melacak drag window pada capture phase tanpa transition-all", () => {
      const overlayPath = path.resolve(
        process.cwd(),
        "src/components/tutorial/InteractiveTutorialOverlay.tsx",
      );
      const overlaySource = fs.readFileSync(overlayPath, "utf8");
      expect(overlaySource).toContain("capture: true");
      expect(overlaySource).toContain("MutationObserver");
      expect(overlaySource).toContain("useFloatingWindowStore");

      const reticleBlockMatch = overlaySource.match(
        /data-testid="tutorial-spotlight-reticle"[\s\S]*?TARGET MISI/,
      );
      expect(reticleBlockMatch).not.toBeNull();
      expect(reticleBlockMatch![0]).not.toContain("transition-all");
    });

    it("Misi 8 merender via Portal dan melacak urutan Panel 4 -> pilih .dxf -> Unduh", () => {
      const overlayPath = path.resolve(
        process.cwd(),
        "src/components/tutorial/InteractiveTutorialOverlay.tsx",
      );
      const overlaySource = fs.readFileSync(overlayPath, "utf8");
      expect(overlaySource).toContain("createPortal");
      expect(overlaySource).toContain("OPEN_WINDOW4_BTN");
      expect(overlaySource).toContain("SELECT_DXF");
      expect(overlaySource).toContain("CLICK_DOWNLOAD");
      expect(overlaySource).toContain("data-tutorial-export-format='dxf'");
      expect(overlaySource).toContain("data-tutorial-export-download='true'");
    });
  });
});
