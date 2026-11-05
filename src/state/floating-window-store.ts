/**
 * @file floating-window-store.ts
 * @description State store for Desktop Workstation draggable floating windows.
 * Tracks (x, y) coordinates, z-index layering, open/closed/minimized states,
 * and smart edge layout to prevent covering the central 3D extruded beam stage.
 */

import { useSyncExternalStore } from "react";

/**
 * Unique identifiers for the 6 core floating windows.
 */
export type FloatingWindowId =
  | "MATERIAL_LOAD_MODE"
  | "REALTIME_LOAD_INPUT"
  | "SNI_DESIGN_PARAMETERS"
  | "OPTIMIZATION_RESULTS"
  | "INTERNAL_FORCE_DIAGRAMS"
  | "GESTURE_AI_ASSISTANT";

/**
 * Geometry and state definition for an individual floating window.
 */
export interface FloatingWindowState {
  readonly id: FloatingWindowId;
  readonly title: string;
  readonly isOpen: boolean;
  readonly isMinimized: boolean;
  readonly x: number;
  readonly y: number;
  readonly zIndex: number;
  readonly width: number;
  readonly height?: number;
}

/**
 * Complete floating window manager state.
 */
export interface FloatingWindowManagerState {
  readonly windows: Readonly<Record<FloatingWindowId, FloatingWindowState>>;
  readonly maxZIndex: number;
  readonly activeWindowCount: number;
  /** Whether the workspace screen is clear enough to show minimal top/bottom status bars. */
  readonly showComplementaryBars: boolean;
}

/**
 * Initial positions arranged proportionally at the screen borders (leaving center 3D beam open).
 */
const DEFAULT_WINDOWS: Record<FloatingWindowId, FloatingWindowState> = {
  MATERIAL_LOAD_MODE: {
    id: "MATERIAL_LOAD_MODE",
    title: "1. Material & Mode Pembebanan",
    isOpen: true,
    isMinimized: false,
    x: 24,
    y: 24,
    zIndex: 10,
    width: 340,
  },
  REALTIME_LOAD_INPUT: {
    id: "REALTIME_LOAD_INPUT",
    title: "2. Beban & Tumpuan Balok (Mode A / B)",
    isOpen: true,
    isMinimized: false,
    x: 24,
    y: 240,
    zIndex: 11,
    width: 340,
  },
  SNI_DESIGN_PARAMETERS: {
    id: "SNI_DESIGN_PARAMETERS",
    title: "3. Parameter Desain SNI & Filter",
    isOpen: false,
    isMinimized: false,
    x: 24,
    y: 450,
    zIndex: 12,
    width: 340,
  },
  OPTIMIZATION_RESULTS: {
    id: "OPTIMIZATION_RESULTS",
    title: "4. Hasil Optimasi & Ekspor CAD/CAE",
    isOpen: true,
    isMinimized: false,
    x: 390,
    y: 24,
    zIndex: 13,
    width: 420,
  },
  INTERNAL_FORCE_DIAGRAMS: {
    id: "INTERNAL_FORCE_DIAGRAMS",
    title: "5. Diagram Gaya Dalam (SFD / BMD / NFD)",
    isOpen: false,
    isMinimized: false,
    x: 390,
    y: 380,
    zIndex: 14,
    width: 480,
  },
  GESTURE_AI_ASSISTANT: {
    id: "GESTURE_AI_ASSISTANT",
    title: "6. Gestur Tangan & Asisten Rekayasa AI",
    isOpen: false,
    isMinimized: false,
    x: 840,
    y: 24,
    zIndex: 15,
    width: 360,
  },
};

function calculateActiveCount(windows: Record<FloatingWindowId, FloatingWindowState>): number {
  return Object.values(windows).filter((w) => w.isOpen && !w.isMinimized).length;
}

let currentState: FloatingWindowManagerState = {
  windows: DEFAULT_WINDOWS,
  maxZIndex: 20,
  activeWindowCount: calculateActiveCount(DEFAULT_WINDOWS),
  showComplementaryBars: calculateActiveCount(DEFAULT_WINDOWS) <= 2,
};

const listeners = new Set<() => void>();

function emitChange(): void {
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Floating window management actions.
 */
export const floatingWindowActions = {
  openWindow(id: FloatingWindowId): void {
    const target = currentState.windows[id];
    if (!target) return;
    const nextZ = currentState.maxZIndex + 1;
    const updatedWindows = {
      ...currentState.windows,
      [id]: {
        ...target,
        isOpen: true,
        isMinimized: false,
        zIndex: nextZ,
      },
    };
    currentState = {
      ...currentState,
      windows: updatedWindows,
      maxZIndex: nextZ,
      activeWindowCount: calculateActiveCount(updatedWindows),
      showComplementaryBars: calculateActiveCount(updatedWindows) <= 2,
    };
    emitChange();
  },

  closeWindow(id: FloatingWindowId): void {
    const target = currentState.windows[id];
    if (!target) return;
    const updatedWindows = {
      ...currentState.windows,
      [id]: {
        ...target,
        isOpen: false,
      },
    };
    currentState = {
      ...currentState,
      windows: updatedWindows,
      activeWindowCount: calculateActiveCount(updatedWindows),
      showComplementaryBars: calculateActiveCount(updatedWindows) <= 2,
    };
    emitChange();
  },

  toggleWindow(id: FloatingWindowId): void {
    const target = currentState.windows[id];
    if (!target) return;
    if (target.isOpen && !target.isMinimized) {
      floatingWindowActions.closeWindow(id);
    } else {
      floatingWindowActions.openWindow(id);
    }
  },

  toggleMinimize(id: FloatingWindowId): void {
    const target = currentState.windows[id];
    if (!target) return;
    const updatedWindows = {
      ...currentState.windows,
      [id]: {
        ...target,
        isMinimized: !target.isMinimized,
      },
    };
    currentState = {
      ...currentState,
      windows: updatedWindows,
      activeWindowCount: calculateActiveCount(updatedWindows),
      showComplementaryBars: calculateActiveCount(updatedWindows) <= 2,
    };
    emitChange();
  },

  bringToFront(id: FloatingWindowId): void {
    const target = currentState.windows[id];
    if (!target) return;
    const nextZ = currentState.maxZIndex + 1;
    currentState = {
      ...currentState,
      maxZIndex: nextZ,
      windows: {
        ...currentState.windows,
        [id]: {
          ...target,
          zIndex: nextZ,
        },
      },
    };
    emitChange();
  },

  updatePosition(id: FloatingWindowId, x: number, y: number): void {
    const target = currentState.windows[id];
    if (!target) return;
    currentState = {
      ...currentState,
      windows: {
        ...currentState.windows,
        [id]: {
          ...target,
          x: Math.max(0, x),
          y: Math.max(0, y),
        },
      },
    };
    emitChange();
  },

  resetLayout(): void {
    currentState = {
      windows: DEFAULT_WINDOWS,
      maxZIndex: 20,
      activeWindowCount: calculateActiveCount(DEFAULT_WINDOWS),
      showComplementaryBars: calculateActiveCount(DEFAULT_WINDOWS) <= 2,
    };
    emitChange();
  },
};

/**
 * Hook to read floating windows state reactively.
 * @returns FloatingWindowManagerState snapshot.
 */
export function useFloatingWindowStore(): FloatingWindowManagerState {
  return useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    () => currentState,
    () => currentState,
  );
}
