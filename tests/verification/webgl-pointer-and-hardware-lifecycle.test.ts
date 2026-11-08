/**
 * @file webgl-pointer-and-hardware-lifecycle.test.ts
 * @description Empirical Challenger 2 verification suite for:
 * 1. WebGL 3D Orbit/Zoom isolation:
 *    - DraggableFloatingWindow: setPointerCapture, releasePointerCapture, stopPropagation on header & body.
 *    - DeflectionHudAndColorbar: stopPropagation on vertical colorbar Card and max deflection Card.
 *    - CoordinateAxisSwitcher: stopPropagation on root Card.
 *    - ProfileAndModelExportModal: stopPropagation on DialogContent.
 *    - SelectContent dropdown portals: stopPropagation on all dropdown portals across forms.
 * 2. Hardware and Audio state machines:
 *    - HandTrackingCameraPreview: persistent <video> and <canvas> DOM nodes (display: isMinimized ? "none" : "block").
 *    - DesktopWorkstationView: isMuted={voice.isMuted} passed cleanly to VoiceCommandStatusToast.
 */

import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

import React from "react";
import { renderToString } from "react-dom/server";

import { CoordinateAxisSwitcher } from "@/components/canvas/CoordinateAxisSwitcher";
import { DeflectionHudAndColorbar } from "@/components/canvas/DeflectionHudAndColorbar";
import { HandTrackingCameraPreview } from "@/components/windows/HandTrackingCameraPreview";
import { meter, millimeter } from "@/types/branded-units";
import type { HandTrackingState } from "@/types/hand-gesture-cursor-types";

const SRC_ROOT = path.resolve(__dirname, "../../src");

function readSourceFile(relativePath: string): string {
  const fullPath = path.join(SRC_ROOT, relativePath);
  return fs.readFileSync(fullPath, "utf-8");
}

describe("Empirical Challenger 2 Verification Suite", () => {
  describe("1. Pointer Event Propagation & 3D WebGL Orbit/Zoom Isolation", () => {
    test("DraggableFloatingWindow has pointer capture and stopPropagation on header and body", () => {
      const src = readSourceFile("components/windows/DraggableFloatingWindow.tsx");

      // Verify setPointerCapture and releasePointerCapture
      expect(src).toContain("setPointerCapture(e.pointerId)");
      expect(src).toContain("releasePointerCapture(e.pointerId)");

      // Verify stopPropagation on pointer down handler for header
      expect(src).toMatch(
        /handlePointerDown\s*=\s*\([^)]*\)\s*:\s*void\s*=>\s*\{[^}]*e\.stopPropagation\(\)/s,
      );

      // Verify stopPropagation on pointer move and up handlers
      expect(src).toMatch(
        /handlePointerMove\s*=\s*\([^)]*\)\s*:\s*void\s*=>\s*\{[^}]*e\.stopPropagation\(\)/s,
      );
      expect(src).toMatch(
        /handlePointerUp\s*=\s*\([^)]*\)\s*:\s*void\s*=>\s*\{[^}]*e\.stopPropagation\(\)/s,
      );

      // Verify stopPropagation on the root Card (window body / background container)
      expect(src).toMatch(/<Card[^>]*onPointerDown=\{[^}]*e\.stopPropagation\(\)[^}]*\}/s);

      // Verify CardHeader has onPointerDown={handlePointerDown}
      expect(src).toContain("onPointerDown={handlePointerDown}");
    });

    test("DeflectionHudAndColorbar has onPointerDown={(e) => e.stopPropagation()} on both HUD elements", () => {
      const src = readSourceFile("components/canvas/DeflectionHudAndColorbar.tsx");

      // Count occurrences of stopPropagation on Card elements
      const matches = src.match(/onPointerDown=\{(?:\(e\)|e)\s*=>\s*e\.stopPropagation\(\)\}/g);
      expect(matches).not.toBeNull();
      // Must exist on both HUD elements: vertical colorbar Card and maximum deflection Card
      expect(matches!.length).toBeGreaterThanOrEqual(2);

      // Verify root container is pointer-events-none so canvas underneath gets clicks outside HUD
      expect(src).toContain("pointer-events-none absolute inset-0");

      // Verify both Cards have pointer-events-auto
      const cardPointerAutoMatches = src.match(/pointer-events-auto/g);
      expect(cardPointerAutoMatches).not.toBeNull();
      expect(cardPointerAutoMatches!.length).toBeGreaterThanOrEqual(2);
    });

    test("DeflectionHudAndColorbar renders correctly in DOM with isolated pointer events", () => {
      const html = renderToString(
        React.createElement(DeflectionHudAndColorbar, {
          maxDeflectionMm: millimeter(-12.45),
          maxDeflectionStationM: meter(4.5),
          compliance: {
            isCompliant: true,
            absDeflectionMm: millimeter(12.45),
            allowableLimitMm: millimeter(22.22),
            deflectionDcr: 0.56,
            statusBadge: "SAFE · SNI OK",
            advisory: "Memenuhi batas lendutan izin L/360",
          },
          limitDenominator: 360,
        }),
      );

      expect(html).toContain('data-component="DeflectionHudAndColorbar"');
      expect(html).toContain("pointer-events-none");
      expect(html).toContain("pointer-events-auto");
      expect(html).toContain("LENDUTAN (mm)");
      expect(html).toContain("LENDUTAN MAKSIMUM");
      expect(html).toContain("12.45");
      expect(html).toContain("AMAN (OK)");
    });

    test("CoordinateAxisSwitcher has onPointerDown={(e) => e.stopPropagation()}", () => {
      const src = readSourceFile("components/canvas/CoordinateAxisSwitcher.tsx");

      // Verify stopPropagation is present on the root Card
      expect(src).toMatch(/onPointerDown=\{(?:\(e\)|e)\s*=>\s*e\.stopPropagation\(\)\}/);

      // Verify pointer-events-auto
      expect(src).toContain("pointer-events-auto");
    });

    test("CoordinateAxisSwitcher renders correctly in DOM", () => {
      const html = renderToString(React.createElement(CoordinateAxisSwitcher));
      expect(html).toContain('data-component="CoordinateAxisSwitcher"');
      expect(html).toContain("pointer-events-auto");
      expect(html).toContain("Z-Up");
      expect(html).toContain("Y-Up");
    });

    test("ProfileAndModelExportModal intercepts onPointerDown on DialogContent", () => {
      const src = readSourceFile("components/results/ProfileAndModelExportModal.tsx");

      // Verify stopPropagation on DialogContent
      expect(src).toMatch(/<DialogContent[^>]*onPointerDown=\{[^}]*e\.stopPropagation\(\)[^}]*\}/s);
    });

    test("All SelectContent usages across form components intercept onPointerDown with stopPropagation", () => {
      const formFiles = [
        "components/forms/MaterialAndLoadModeSelector.tsx",
        "components/forms/ExternalLoadInteractiveForm.tsx",
        "components/forms/ConcreteDesignParametersForm.tsx",
        "components/forms/SteelDesignParametersForm.tsx",
      ];

      for (const formFile of formFiles) {
        const src = readSourceFile(formFile);
        let count = 0;
        const parts = src.split("<SelectContent").slice(1);
        for (const part of parts) {
          count++;
          // First 200 characters of each <SelectContent block contains the opening tag attributes
          const tagHead = part.slice(0, 200);
          expect(tagHead).toMatch(/onPointerDown=\{(?:\(e\)|e)\s*=>\s*e\.stopPropagation\(\)\}/);
        }

        expect(count).toBeGreaterThan(0);
      }
    });
  });

  describe("2. Hardware & Multimodal Lifecycle State Machines", () => {
    test("HandTrackingCameraPreview preserves video and canvas DOM elements without conditional unmounting", () => {
      const src = readSourceFile("components/windows/HandTrackingCameraPreview.tsx");

      // Verify viewport container uses CSS display toggle rather than React conditional unmounting
      expect(src).toMatch(/display:\s*isMinimized\s*\?\s*"none"\s*:\s*"block"/);

      // Ensure that neither <video nor <canvas is wrapped inside {!isMinimized && ...}
      expect(src).not.toMatch(/\{!isMinimized\s*&&[\s\S]*?<video/);
      expect(src).not.toMatch(/\{!isMinimized\s*&&[\s\S]*?<canvas/);

      // Verify videoRef and canvasRef are attached
      expect(src).toContain("ref={videoRef}");
      expect(src).toContain("ref={canvasRef}");
    });

    test("HandTrackingCameraPreview renders persistent video and canvas elements in DOM", () => {
      const dummyState: HandTrackingState = {
        isRunning: false,
        handedness: "None",
        activeGesture: "NONE",
        cursorSymbol: "○",
        screenCoordinates: { x: 0, y: 0 },
        normalizedCoordinates: { x: 0.5, y: 0.5 },
        isPinching: false,
        pinchDistance: 1.0,
        fps: 0,
        isEcoMode: true,
      };

      const html = renderToString(
        React.createElement(HandTrackingCameraPreview, {
          state: dummyState,
          onToggleRunning: () => {},
          onToggleEcoMode: () => {},
          videoRef: { current: null },
          canvasRef: { current: null },
        }),
      );

      // Assert video and canvas tags are rendered in DOM
      expect(html).toContain("<video");
      expect(html).toContain("<canvas");
      expect(html).toContain("display:block");
    });

    test("DesktopWorkstationView passes isMuted={voice.isMuted} cleanly and binds hardware refs", () => {
      const src = readSourceFile("components/adaptive/DesktopWorkstationView.tsx");

      // Verify hook invocations
      expect(src).toContain("const tracking = useMediapipeHandTracking();");
      expect(src).toContain("const voice = useWebSpeechCommand();");

      // Verify voice.isMuted passed into VoiceCommandStatusToast
      expect(src).toMatch(/<VoiceCommandStatusToast[\s\S]*?isMuted=\{voice\.isMuted\}[\s\S]*?\/>/);

      // Verify webcam hardware refs passed into HandTrackingCameraPreview
      expect(src).toMatch(
        /<HandTrackingCameraPreview[\s\S]*?videoRef=\{tracking\.videoRef\}[\s\S]*?canvasRef=\{tracking\.canvasRef\}[\s\S]*?\/>/,
      );
    });

    test("VoiceCommandStatusToast handles isMuted prop and falls back to !isListening", () => {
      const src = readSourceFile("components/assistant/VoiceCommandStatusToast.tsx");

      // Verify isMuted is an optional prop in the interface
      expect(src).toContain("readonly isMuted?: boolean;");

      // Verify fallback state resolution
      expect(src).toMatch(
        /isMutedState\s*=\s*isMuted\s*!==\s*undefined\s*\?\s*isMuted\s*:\s*!isListening/,
      );

      // Verify UI text matches mute state
      expect(src).toContain('"Mikrofon Dijeda"');
    });
  });
});
