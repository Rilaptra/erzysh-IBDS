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
 * Windows start at y: 64 to clear the top Quick Dock Bar (top: 14px .. 52px).
 */
const DEFAULT_WINDOWS: Record<FloatingWindowId, FloatingWindowState> = {
  MATERIAL_LOAD_MODE: {
    id: "MATERIAL_LOAD_MODE",
    title: "1. Material & Mode Pembebanan",
    isOpen: true,
    isMinimized: false,
    x: 24,
    y: 64,
    zIndex: 10,
    width: 340,
  },
  REALTIME_LOAD_INPUT: {
    id: "REALTIME_LOAD_INPUT",
    title: "2. Beban & Tumpuan Balok (Mode A / B)",
    isOpen: true,
    isMinimized: false,
    x: 24,
    y: 280,
    zIndex: 11,
    width: 340,
  },
  SNI_DESIGN_PARAMETERS: {
    id: "SNI_DESIGN_PARAMETERS",
    title: "3. Parameter Desain SNI & Filter",
    isOpen: false,
    isMinimized: false,
    x: 24,
    y: 490,
    zIndex: 12,
    width: 340,
  },
  OPTIMIZATION_RESULTS: {
    id: "OPTIMIZATION_RESULTS",
    title: "4. Hasil Optimasi & Ekspor CAD/CAE",
    isOpen: true,
    isMinimized: false,
    x: 390,
    y: 64,
    zIndex: 13,
    width: 420,
  },
  INTERNAL_FORCE_DIAGRAMS: {
    id: "INTERNAL_FORCE_DIAGRAMS",
    title: "5. Diagram Gaya Dalam (SFD / BMD / NFD)",
    isOpen: false,
    isMinimized: false,
    x: 390,
    y: 420,
    zIndex: 14,
    width: 480,
  },
  GESTURE_AI_ASSISTANT: {
    id: "GESTURE_AI_ASSISTANT",
    title: "6. Gestur Tangan & Asisten Rekayasa AI",
    isOpen: false,
    isMinimized: false,
    x: 840,
    y: 64,
    zIndex: 15,
    width: 360,
  },
};

function calculateActiveCount(windows: Record<FloatingWindowId, FloatingWindowState>): number {
  return Object.values(windows).filter((w) => w.isOpen && !w.isMinimized).length;
}

let currentState: FloatingWindowManagerState = {
  windows: DEFAULT_WINDOWS,
  maxZIndex: 16,
  activeWindowCount: calculateActiveCount(DEFAULT_WINDOWS),
  showComplementaryBars: true,
};

const listeners = new Set<() => void>();

function emitChange(): void {
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Reorders window z-indices so that the target window is on top while keeping
 * all window z-indices bounded between 10 and 15 (never overflowing HUD layers z-30+).
 */
function reorderWindowsWithTop(
  windows: Record<FloatingWindowId, FloatingWindowState>,
  topId: FloatingWindowId,
): Record<FloatingWindowId, FloatingWindowState> {
  const allIds = Object.keys(windows) as FloatingWindowId[];
  allIds.sort((a, b) => windows[a].zIndex - windows[b].zIndex);
  const reordered = allIds.filter((id) => id !== topId).concat(topId);

  const updated: Record<FloatingWindowId, FloatingWindowState> = { ...windows };
  reordered.forEach((id, index) => {
    updated[id] = {
      ...updated[id],
      zIndex: 10 + index,
    };
  });
  return updated;
}

/**
 * Floating window management actions.
 */
export const floatingWindowActions = {
  openWindow(id: FloatingWindowId): void {
    const target = currentState.windows[id];
    if (!target) return;
    const reorderedWindows = reorderWindowsWithTop(currentState.windows, id);
    const updatedWindows = {
      ...reorderedWindows,
      [id]: {
        ...reorderedWindows[id],
        isOpen: true,
        isMinimized: false,
      },
    };
    currentState = {
      ...currentState,
      windows: updatedWindows,
      maxZIndex: 16,
      activeWindowCount: calculateActiveCount(updatedWindows),
      showComplementaryBars: true,
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
      showComplementaryBars: true,
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
      showComplementaryBars: true,
    };
    emitChange();
  },

  bringToFront(id: FloatingWindowId): void {
    const target = currentState.windows[id];
    if (!target) return;
    const updatedWindows = reorderWindowsWithTop(currentState.windows, id);
    currentState = {
      ...currentState,
      maxZIndex: 16,
      windows: updatedWindows,
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
      maxZIndex: 16,
      activeWindowCount: calculateActiveCount(DEFAULT_WINDOWS),
      showComplementaryBars: true,
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
