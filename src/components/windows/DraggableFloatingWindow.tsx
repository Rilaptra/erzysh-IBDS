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

import { MinusIcon, SquareIcon, XIcon } from "lucide-react";
import React, {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
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

  if (!windowState) {
    return null;
  }

  // Keep GESTURE_AI_ASSISTANT mounted in DOM when closed so <video> and <canvas> refs never detach
  if (!windowState.isOpen && id !== "GESTURE_AI_ASSISTANT") {
    return null;
  }

  const { title, isMinimized, x, y, zIndex, width, isOpen } = windowState;

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
    <Card
      data-component="DraggableFloatingWindow"
      data-window-id={id}
      className={cn(
        "bg-card/90 border-border/40 absolute gap-0 overflow-hidden py-0 shadow-2xl backdrop-blur-md select-none",
        isDragging ? "transition-none" : "transition-shadow duration-200",
        className,
      )}
      onPointerDown={(e) => {
        // Prevent clicking inside the window body from rotating the 3D camera
        e.stopPropagation();
        floatingWindowActions.bringToFront(id);
      }}
      style={{
        display: isOpen ? undefined : "none",
        left: `${x}px`,
        top: `${y}px`,
        width: `${width || defaultWidth}px`,
        zIndex,
        ...style,
      }}
    >
      {/* Draggable Window Header */}
      <CardHeader
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={cn(
          "bg-muted/40 border-border/30 flex flex-row items-center justify-between rounded-t-xl border-b px-3 py-2",
          isMinimized && "rounded-b-xl border-b-0",
          isDragging ? "cursor-grabbing" : "cursor-grab",
        )}
      >
        <CardTitle className="text-foreground text-xs font-bold tracking-wider">{title}</CardTitle>

        {/* Action Buttons: Minimize & Close */}
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={(e) => {
              e.stopPropagation();
              floatingWindowActions.toggleMinimize(id);
            }}
            title={isMinimized ? "Perbesar Jendela" : "Kecilkan Jendela"}
          >
            {isMinimized ? <SquareIcon className="size-3" /> : <MinusIcon className="size-3" />}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={(e) => {
              e.stopPropagation();
              floatingWindowActions.closeWindow(id);
            }}
            title="Tutup Jendela"
          >
            <XIcon className="size-3.5" />
          </Button>
        </div>
      </CardHeader>

      {/* Window Body (kept mounted when minimized for GESTURE_AI_ASSISTANT to preserve webcam stream) */}
      {!isMinimized || id === "GESTURE_AI_ASSISTANT" ? (
        <CardContent
          className="overflow-y-auto p-3 text-slate-300"
          style={{
            display: isMinimized ? "none" : undefined,
            maxHeight: `min(${maxHeight}px, calc(100dvh - 7rem))`,
            scrollbarWidth: "thin",
          }}
        >
          {children}
        </CardContent>
      ) : null}
    </Card>
  );
}

export default DraggableFloatingWindow;
