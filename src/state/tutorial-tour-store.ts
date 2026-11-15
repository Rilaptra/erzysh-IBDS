/**
 * @file tutorial-tour-store.ts
 * @description External state store berbasis React useSyncExternalStore untuk
 * sistem tutorial interaktif bergaya game ("IBDS Engineer Quest") dengan persistensi localStorage.
 */

import { useSyncExternalStore } from "react";

import { TUTORIAL_QUEST_STEPS } from "@/config/tutorial-steps-config";

export const TUTORIAL_STORAGE_KEY = "ibds:tutorial-v1";

export interface TutorialTourState {
  readonly isActive: boolean;
  readonly isWelcomeOpen: boolean;
  readonly currentStepIndex: number;
  readonly completedStepIds: readonly string[];
  readonly hasCompletedTour: boolean;
  readonly hasDismissedWelcome: boolean;
  readonly isVoiceNarrationEnabled: boolean;
  readonly lastExportedDxfFile: string | null;
}

interface PersistedTutorialPayload {
  hasDismissedWelcome: boolean;
  hasCompletedTour: boolean;
  completedStepIds: string[];
  isVoiceNarrationEnabled: boolean;
}

const VALID_STEP_IDS = new Set(TUTORIAL_QUEST_STEPS.map((step) => step.id));
const MAX_STEP_INDEX = Math.max(0, TUTORIAL_QUEST_STEPS.length - 1);

const DEFAULT_STATE: TutorialTourState = {
  isActive: false,
  isWelcomeOpen: false,
  currentStepIndex: 0,
  completedStepIds: [],
  hasCompletedTour: false,
  hasDismissedWelcome: false,
  isVoiceNarrationEnabled: true,
  lastExportedDxfFile: null,
};

let state: TutorialTourState = DEFAULT_STATE;
let hasInitializedFirstVisit = false;
const listeners = new Set<() => void>();

function clampStepIndex(index: number): number {
  if (!Number.isFinite(index)) {
    return 0;
  }
  return Math.max(0, Math.min(MAX_STEP_INDEX, Math.floor(index)));
}

function emitChange(): void {
  for (const listener of listeners) {
    listener();
  }
}

function setState(updater: (prev: TutorialTourState) => TutorialTourState): void {
  const next = updater(state);
  if (next === state) {
    return;
  }
  state = next;
  emitChange();
}

function readPersistedState(): Partial<PersistedTutorialPayload> | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(TUTORIAL_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    const completedStepIds = Array.isArray(record.completedStepIds)
      ? record.completedStepIds.filter(
          (id): id is string => typeof id === "string" && VALID_STEP_IDS.has(id),
        )
      : [];

    return {
      hasDismissedWelcome: Boolean(record.hasDismissedWelcome),
      hasCompletedTour: Boolean(record.hasCompletedTour),
      completedStepIds: Array.from(new Set(completedStepIds)),
      isVoiceNarrationEnabled:
        typeof record.isVoiceNarrationEnabled === "boolean" ? record.isVoiceNarrationEnabled : true,
    };
  } catch {
    return null;
  }
}

function writePersistedState(current: TutorialTourState): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const payload: PersistedTutorialPayload = {
      hasDismissedWelcome: current.hasDismissedWelcome,
      hasCompletedTour: current.hasCompletedTour,
      completedStepIds: [...current.completedStepIds],
      isVoiceNarrationEnabled: current.isVoiceNarrationEnabled,
    };
    window.localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Abaikan kegagalan kuota/private mode browser agar UI tetap berjalan mulus.
  }
}

function buildCompletedTourState(prev: TutorialTourState): TutorialTourState {
  const finalStepId = TUTORIAL_QUEST_STEPS[MAX_STEP_INDEX]?.id;
  const completedSet = new Set(prev.completedStepIds);
  if (finalStepId) {
    completedSet.add(finalStepId);
  }
  const next: TutorialTourState = {
    ...prev,
    isActive: false,
    isWelcomeOpen: false,
    hasCompletedTour: true,
    hasDismissedWelcome: true,
    completedStepIds: Array.from(completedSet),
  };
  writePersistedState(next);
  return next;
}

export const tutorialTourActions = {
  /**
   * Mengecek kunjungan pertama di client dan opsional melompat langsung ke misi via URL (?tutorial=1..9 atau true).
   */
  initFirstVisitCheck(forceStart = false, initialStepIndex = 0): void {
    const persisted = readPersistedState();
    const shouldHydrate = !hasInitializedFirstVisit && persisted !== null;

    const mergedDismissed = shouldHydrate
      ? (persisted.hasDismissedWelcome ?? state.hasDismissedWelcome)
      : state.hasDismissedWelcome;
    const mergedCompleted = shouldHydrate
      ? (persisted.hasCompletedTour ?? state.hasCompletedTour)
      : state.hasCompletedTour;
    const mergedStepIds = shouldHydrate
      ? (persisted.completedStepIds ?? [...state.completedStepIds])
      : [...state.completedStepIds];
    const mergedNarration = shouldHydrate
      ? (persisted.isVoiceNarrationEnabled ?? state.isVoiceNarrationEnabled)
      : state.isVoiceNarrationEnabled;

    if (forceStart) {
      hasInitializedFirstVisit = true;
      const targetIndex = clampStepIndex(initialStepIndex);
      setState((prev) => ({
        ...prev,
        hasDismissedWelcome: mergedDismissed,
        hasCompletedTour: mergedCompleted,
        completedStepIds: mergedStepIds,
        isVoiceNarrationEnabled: mergedNarration,
        isActive: true,
        isWelcomeOpen: false,
        currentStepIndex: targetIndex,
      }));
      return;
    }

    if (hasInitializedFirstVisit) {
      return;
    }
    hasInitializedFirstVisit = true;

    const shouldShowWelcome = !mergedDismissed && !mergedCompleted && !state.isActive;
    setState((prev) => ({
      ...prev,
      hasDismissedWelcome: mergedDismissed,
      hasCompletedTour: mergedCompleted,
      completedStepIds: mergedStepIds,
      isVoiceNarrationEnabled: mergedNarration,
      isWelcomeOpen: shouldShowWelcome,
    }));
  },

  /**
   * Memulai atau melanjutkan tutorial dari langkah tertentu (default langkah 1 / indeks 0).
   */
  startTutorial(stepIndex = 0): void {
    const clamped = clampStepIndex(stepIndex);
    setState((prev) => ({
      ...prev,
      isActive: true,
      isWelcomeOpen: false,
      currentStepIndex: clamped,
    }));
  },

  /**
   * Menutup tutorial aktif (atau kartu selamat datang) dan menandai welcome sudah dilihat.
   */
  stopTutorial(markDismissed = true): void {
    setState((prev) => {
      const next: TutorialTourState = {
        ...prev,
        isActive: false,
        isWelcomeOpen: false,
        hasDismissedWelcome: markDismissed ? true : prev.hasDismissedWelcome,
      };
      if (markDismissed) {
        writePersistedState(next);
      }
      return next;
    });
  },

  /**
   * Menutup kartu sambutan pertama tanpa memulai tur.
   */
  dismissWelcome(): void {
    setState((prev) => {
      const next: TutorialTourState = {
        ...prev,
        isWelcomeOpen: false,
        hasDismissedWelcome: true,
      };
      writePersistedState(next);
      return next;
    });
  },

  /**
   * Pindah ke misi berikutnya, atau menuntaskan seluruh tur jika sudah di misi terakhir.
   */
  nextStep(): void {
    setState((prev) => {
      if (prev.currentStepIndex >= MAX_STEP_INDEX) {
        return buildCompletedTourState(prev);
      }

      return {
        ...prev,
        currentStepIndex: clampStepIndex(prev.currentStepIndex + 1),
      };
    });
  },

  /**
   * Menuntaskan seluruh rangkaian tutorial, menandai misi terakhir selesai, dan menutup HUD.
   */
  finishTutorial(): void {
    setState((prev) => buildCompletedTourState(prev));
  },

  /**
   * Kembali ke misi sebelumnya.
   */
  prevStep(): void {
    setState((prev) => ({
      ...prev,
      currentStepIndex: clampStepIndex(prev.currentStepIndex - 1),
    }));
  },

  /**
   * Melompat langsung ke indeks misi tertentu (0..TOTAL_TUTORIAL_STEPS-1).
   */
  goToStep(index: number): void {
    const clamped = clampStepIndex(index);
    setState((prev) => ({
      ...prev,
      currentStepIndex: clamped,
    }));
  },

  /**
   * Menandai misi sebagai selesai. Mengembalikan true jika baru selesai pertama kali.
   */
  markStepCompleted(stepId: string): boolean {
    if (!VALID_STEP_IDS.has(stepId) || state.completedStepIds.includes(stepId)) {
      return false;
    }

    setState((prev) => {
      if (prev.completedStepIds.includes(stepId)) {
        return prev;
      }
      const nextCompleted = [...prev.completedStepIds, stepId];
      const allCompleted = nextCompleted.length >= TUTORIAL_QUEST_STEPS.length;
      const next: TutorialTourState = {
        ...prev,
        completedStepIds: nextCompleted,
        hasCompletedTour: prev.hasCompletedTour || allCompleted,
      };
      writePersistedState(next);
      return next;
    });
    return true;
  },

  /**
   * Mengaktifkan/mematikan narasi suara Ucuy (TTS) selama tutorial berjalan.
   */
  toggleVoiceNarration(enabled?: boolean): void {
    setState((prev) => {
      const nextEnabled = typeof enabled === "boolean" ? enabled : !prev.isVoiceNarrationEnabled;
      const next: TutorialTourState = {
        ...prev,
        isVoiceNarrationEnabled: nextEnabled,
      };
      writePersistedState(next);
      return next;
    });
  },

  /**
   * Mencatat nama file .dxf terakhir yang diunduh sekaligus menuntaskan Misi 8 (Ekspor DXF).
   */
  recordDxfExport(fileName: string): boolean {
    const stepId = "quest-8-export-dxf";
    const isNewlyCompleted = !state.completedStepIds.includes(stepId);

    setState((prev) => {
      const nextCompleted = prev.completedStepIds.includes(stepId)
        ? prev.completedStepIds
        : [...prev.completedStepIds, stepId];
      const allCompleted = nextCompleted.length >= TUTORIAL_QUEST_STEPS.length;
      const next: TutorialTourState = {
        ...prev,
        lastExportedDxfFile: fileName,
        completedStepIds: nextCompleted,
        hasCompletedTour: prev.hasCompletedTour || allCompleted,
      };
      writePersistedState(next);
      return next;
    });

    return isNewlyCompleted;
  },

  /**
   * Mengatur ulang state dan penyimpanan localStorage khusus untuk kebutuhan unit test.
   */
  resetTutorialStateForTests(): void {
    hasInitializedFirstVisit = false;
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(TUTORIAL_STORAGE_KEY);
      } catch {
        // Abaikan pada environment mock minimal.
      }
    }
    state = DEFAULT_STATE;
    emitChange();
  },
};

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getTutorialTourState(): TutorialTourState {
  return state;
}

/**
 * React hook untuk membaca status IBDS Engineer Quest secara reaktif.
 */
export function useTutorialTourStore(): TutorialTourState {
  return useSyncExternalStore(subscribe, getTutorialTourState, getTutorialTourState);
}
