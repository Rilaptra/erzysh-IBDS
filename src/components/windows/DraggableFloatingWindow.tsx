/**
 * @file DraggableFloatingWindow.tsx
 * @description Floating window shell for Desktop Workstation mode:
 * - Draggable via pointer events on the header
 * - e.stopPropagation() on onPointerDown to isolate events from the 3D WebGL camera and background
 * - Bring-to-front z-index management
 * - Minimize and close controls
 * - Styled with Erzysh Dark Void Theme (glassmorphism backdrop blur)
 */

"use client";

import React, {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
  useRef,
  useState,
} from "react";

import {
  floatingWindowActions,
  type FloatingWindowId,
  useFloatingWindowStore,
} from "@/state/floating-window-store";

export interface DraggableFloatingWindowProps {
  readonly id: FloatingWindowId;
  readonly children: ReactNode;
  readonly defaultWidth?: number;
  readonly maxHeight?: number;
  readonly className?: string;
  readonly style?: CSSProperties;
}

/**
 * Draggable Floating Window Component.
 */
export function DraggableFloatingWindow({
  id,
  children,
  defaultWidth = 360,
  maxHeight = 600,
  className,
  style,
}: DraggableFloatingWindowProps): ReactElement | null {
  const store = useFloatingWindowStore();
  const windowState = store.windows[id];

  const dragRef = useRef<{
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  if (!windowState || !windowState.isOpen) {
    return null;
  }

  const { title, isMinimized, x, y, zIndex, width } = windowState;

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    // CRITICAL: Stop propagation to prevent 3D camera orbit/pan or background click
    e.stopPropagation();
    floatingWindowActions.bringToFront(id);

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: x,
      initialY: y,
    };
    setIsDragging(true);

    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Ignore if synthetic
    }
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (!dragRef.current) return;
    e.stopPropagation();

    const deltaX = e.clientX - dragRef.current.startX;
    const deltaY = e.clientY - dragRef.current.startY;

    const newX = Math.max(8, dragRef.current.initialX + deltaX);
    const newY = Math.max(8, dragRef.current.initialY + deltaY);

    floatingWindowActions.updatePosition(id, newX, newY);
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (!dragRef.current) return;
    e.stopPropagation();
    dragRef.current = null;
    setIsDragging(false);

    try {
      if ((e.target as HTMLElement).hasPointerCapture(e.pointerId)) {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }
  };

  return (
    <div
      className={className}
      data-component="DraggableFloatingWindow"
      data-window-id={id}
      onPointerDown={(e) => {
        // Prevent clicking inside the window body from rotating the 3D camera
        e.stopPropagation();
        floatingWindowActions.bringToFront(id);
      }}
      style={{
        position: "absolute",
        left: `${x}px`,
        top: `${y}px`,
        width: `${width || defaultWidth}px`,
        zIndex,
        background: "rgba(15, 20, 22, 0.88)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: "1px solid rgba(148, 163, 184, 0.16)",
        borderRadius: 10,
        boxShadow: "0 12px 36px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.04)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        transition: isDragging ? "none" : "box-shadow 0.2s ease",
        ...style,
      }}
    >
      {/* Draggable Window Header */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          background: "rgba(30, 41, 59, 0.5)",
          borderBottom: isMinimized ? "none" : "1px solid rgba(148, 163, 184, 0.12)",
          cursor: isDragging ? "grabbing" : "grab",
          userSelect: "none",
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: "#E2E8F0", letterSpacing: 0.3 }}>
          {title}
        </span>

        {/* Action Buttons: Minimize & Close */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              floatingWindowActions.toggleMinimize(id);
            }}
            title={isMinimized ? "Perbesar Jendela" : "Kecilkan Jendela"}
            style={{
              border: "none",
              background: "transparent",
              color: "#94A3B8",
              cursor: "pointer",
              padding: "2px 6px",
              fontSize: 12,
              borderRadius: 4,
            }}
          >
            {isMinimized ? "□" : "—"}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              floatingWindowActions.closeWindow(id);
            }}
            title="Tutup Jendela"
            style={{
              border: "none",
              background: "transparent",
              color: "#94A3B8",
              cursor: "pointer",
              padding: "2px 6px",
              fontSize: 13,
              borderRadius: 4,
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Window Body */}
      {!isMinimized ? (
        <div
          style={{
            padding: 12,
            maxHeight: `${maxHeight}px`,
            overflowY: "auto",
            scrollbarWidth: "thin",
            color: "#CBD5E1",
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export default DraggableFloatingWindow;
