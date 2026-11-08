/**
 * @file multimodal-interactions.test.ts
 * @description Comprehensive unit and integration test suite for the Multimodal Interaction subsystem:
 * 1. Knuckle-Anchored Algorithm (Blend weight 0.5 of MCP #5 and MCP #9, Zero Pinch-Dip validation).
 * 2. Real-time classification of 5 discrete gestures: OPEN_PALM, PINCH_CLICK, FIST_LOAD, POINT_PRECISION, TWO_FINGER_GRAB.
 * 3. Web Speech Command Natural Language Intent Router (Indonesian & English keyword parsing).
 * 4. Simulator state mutation via executeRegistryCommand.
 * 5. Structured Error hierarchy handling (HandTrackingError, CommandRegistryError).
 */

import { describe, expect, test } from "bun:test";

import {
  classifyHandGesture,
  computeKnuckleAnchor,
  euclideanDistance2D,
} from "@/hooks/use-mediapipe-hand-tracking";
import {
  executeRegistryCommand,
  routeVoiceTranscriptToCommand,
} from "@/hooks/use-web-speech-command";
import { getBeamSimulatorSnapshot } from "@/state/beam-simulator-store";
import type { Meter } from "@/types/branded-units";
import { type CommandId, CommandRegistryError } from "@/types/command-registry-types";
import { HandTrackingError, type NormalizedLandmark } from "@/types/hand-gesture-cursor-types";

// ============================================================================
// Helper Mock Landmark Factory
// ============================================================================

/**
 * Creates a base 21-landmark array representing a neutral open human hand facing camera.
 * Wrist at (0.5, 0.8), fingers pointing upwards (lower y).
 */
function createBaseOpenPalmLandmarks(): NormalizedLandmark[] {
  return [
    // 0: Wrist
    { x: 0.5, y: 0.8, z: 0 },
    // Thumb: 1, 2, 3, 4
    { x: 0.44, y: 0.72, z: 0 },
    { x: 0.4, y: 0.64, z: 0 },
    { x: 0.36, y: 0.54, z: 0 },
    { x: 0.32, y: 0.44, z: 0 }, // Thumb tip
    // Index: 5 (MCP), 6 (PIP), 7 (DIP), 8 (TIP)
    { x: 0.46, y: 0.54, z: 0 },
    { x: 0.46, y: 0.42, z: 0 },
    { x: 0.46, y: 0.32, z: 0 },
    { x: 0.46, y: 0.22, z: 0 }, // Index tip (extended)
    // Middle: 9 (MCP), 10 (PIP), 11 (DIP), 12 (TIP)
    { x: 0.52, y: 0.54, z: 0 },
    { x: 0.52, y: 0.4, z: 0 },
    { x: 0.52, y: 0.3, z: 0 },
    { x: 0.52, y: 0.2, z: 0 }, // Middle tip (extended)
    // Ring: 13 (MCP), 14 (PIP), 15 (DIP), 16 (TIP)
    { x: 0.58, y: 0.56, z: 0 },
    { x: 0.58, y: 0.44, z: 0 },
    { x: 0.58, y: 0.34, z: 0 },
    { x: 0.58, y: 0.24, z: 0 }, // Ring tip (extended)
    // Pinky: 17 (MCP), 18 (PIP), 19 (DIP), 20 (TIP)
    { x: 0.63, y: 0.58, z: 0 },
    { x: 0.63, y: 0.48, z: 0 },
    { x: 0.63, y: 0.4, z: 0 },
    { x: 0.63, y: 0.32, z: 0 }, // Pinky tip (extended)
  ];
}

// ============================================================================
// Test Suite
// ============================================================================

describe("Step 7: Multimodal Interactions & Voice Command Registry", () => {
  describe("1. Mathematical Knuckle-Anchored Algorithm (Zero Pinch-Dip)", () => {
    test("computes 2D Euclidean distance correctly", () => {
      const a = { x: 0.0, y: 0.0 };
      const b = { x: 3.0, y: 4.0 };
      expect(euclideanDistance2D(a, b)).toBeCloseTo(5.0, 5);
    });

    test("blends Index MCP (#5) and Middle MCP (#9) at exactly 50% weight (0.5)", () => {
      const landmarks = createBaseOpenPalmLandmarks();
      const indexMcp = landmarks[5]!;
      const middleMcp = landmarks[9]!;

      // Index MCP = (0.46, 0.54), Middle MCP = (0.52, 0.54)
      const expectedBlendedX = 1 - (indexMcp.x * 0.5 + middleMcp.x * 0.5); // 1 - 0.49 = 0.51
      const expectedBlendedY = indexMcp.y * 0.5 + middleMcp.y * 0.5; // 0.54

      const result = computeKnuckleAnchor(landmarks, {
        anchorBlendWeight: 0.5,
        prePinchFreezeThreshold: 0.055,
        clickPinchThreshold: 0.038,
        clickReleaseThreshold: 0.048,
        smoothingAlpha: 0.35,
      });

      expect(result.rawAnchorX).toBeCloseTo(expectedBlendedX, 5);
      expect(result.rawAnchorY).toBeCloseTo(expectedBlendedY, 5);
    });

    test("remaps camera active zone [0.14 .. 0.86] to full screen [0.0 .. 1.0]", () => {
      const landmarks = createBaseOpenPalmLandmarks();
      const result = computeKnuckleAnchor(landmarks);

      // (0.51 - 0.14) / 0.72 = 0.37 / 0.72 = ~0.5138
      expect(result.normalizedX).toBeGreaterThanOrEqual(0.0);
      expect(result.normalizedX).toBeLessThanOrEqual(1.0);
      expect(result.normalizedY).toBeGreaterThanOrEqual(0.0);
      expect(result.normalizedY).toBeLessThanOrEqual(1.0);
    });

    test("proves Zero Pinch-Dip: cursor anchor does not move when fingertip dips to pinch", () => {
      const openHand = createBaseOpenPalmLandmarks();
      const initialAnchor = computeKnuckleAnchor(openHand);

      // Simulate pinch action: index finger dips downwards and curls to touch thumb tip
      const pinchingHand = createBaseOpenPalmLandmarks();
      const thumbTip = pinchingHand[4]!;

      // Fingertip moves significantly down (y drops from 0.22 to 0.44 = 22% viewport jump)
      pinchingHand[8] = { x: thumbTip.x + 0.01, y: thumbTip.y + 0.01, z: 0 };

      // Crucially, Knuckles MCP #5 and #9 remain static in space
      const pinchAnchor = computeKnuckleAnchor(pinchingHand);

      // Verify that fingertip dropped drastically
      const tipDipDistance = Math.abs(pinchingHand[8].y - openHand[8]!.y);
      expect(tipDipDistance).toBeGreaterThan(0.2);

      // Verify that the knuckle-anchored virtual cursor experienced ZERO dip!
      expect(pinchAnchor.normalizedY).toBeCloseTo(initialAnchor.normalizedY, 5);
      expect(pinchAnchor.normalizedX).toBeCloseTo(initialAnchor.normalizedX, 5);
      expect(pinchAnchor.isPinching).toBe(true);
    });

    test("throws HandTrackingError when landmarks array has fewer than 21 elements", () => {
      expect(() => {
        computeKnuckleAnchor([]);
      }).toThrow(HandTrackingError);

      expect(() => {
        computeKnuckleAnchor(new Array(15).fill({ x: 0, y: 0, z: 0 }));
      }).toThrow(HandTrackingError);
    });
  });

  describe("2. Discrete Hand Gesture Classifier (5 Gesture Modes)", () => {
    test("classifies OPEN_PALM (◎) when all 5 fingers are fully extended", () => {
      const landmarks = createBaseOpenPalmLandmarks();
      const gesture = classifyHandGesture(landmarks);
      expect(gesture).toBe("OPEN_PALM");
    });

    test("classifies PINCH_CLICK (⌖) when thumb and index tips make contact while middle finger stays extended", () => {
      const landmarks = createBaseOpenPalmLandmarks();
      const thumbTip = landmarks[4]!;

      // Bring index tip into contact with thumb tip
      landmarks[8] = { x: thumbTip.x + 0.01, y: thumbTip.y + 0.01, z: 0 };

      const gesture = classifyHandGesture(landmarks);
      expect(gesture).toBe("PINCH_CLICK");
    });

    test("classifies FIST_LOAD (▼) when all fingers are retracted into palm", () => {
      const landmarks = createBaseOpenPalmLandmarks();
      // Curl all four finger tips below their PIP joints towards wrist
      landmarks[8] = { x: 0.46, y: 0.62, z: 0 }; // Index tip curled
      landmarks[12] = { x: 0.52, y: 0.62, z: 0 }; // Middle tip curled
      landmarks[16] = { x: 0.58, y: 0.62, z: 0 }; // Ring tip curled
      landmarks[20] = { x: 0.63, y: 0.64, z: 0 }; // Pinky tip curled

      const gesture = classifyHandGesture(landmarks);
      expect(gesture).toBe("FIST_LOAD");
    });

    test("classifies POINT_PRECISION (▸) when only index finger is extended", () => {
      const landmarks = createBaseOpenPalmLandmarks();
      // Keep index tip extended (y = 0.22), curl middle, ring, pinky
      landmarks[12] = { x: 0.52, y: 0.62, z: 0 };
      landmarks[16] = { x: 0.58, y: 0.62, z: 0 };
      landmarks[20] = { x: 0.63, y: 0.64, z: 0 };

      const gesture = classifyHandGesture(landmarks);
      expect(gesture).toBe("POINT_PRECISION");
    });

    test("classifies TWO_FINGER_GRAB (▣) when index and middle are extended and ring & pinky are curled", () => {
      const landmarks = createBaseOpenPalmLandmarks();
      // Keep index (y = 0.22) and middle (y = 0.20) extended, curl ring & pinky
      landmarks[16] = { x: 0.58, y: 0.62, z: 0 };
      landmarks[20] = { x: 0.63, y: 0.64, z: 0 };

      const gesture = classifyHandGesture(landmarks);
      expect(gesture).toBe("TWO_FINGER_GRAB");
    });

    test("returns NONE when landmark array is empty or insufficient", () => {
      expect(classifyHandGesture([])).toBe("NONE");
    });
  });

  describe("3. Web Speech Natural Language Intent Router", () => {
    test("routes Indonesian material selection commands", () => {
      const cmdBeton = routeVoiceTranscriptToCommand("ubah ke material beton bertulang");
      expect(cmdBeton?.commandId).toBe("SWITCH_MATERIAL_CONCRETE");

      const cmdBaja = routeVoiceTranscriptToCommand("ganti material balok baja struktural");
      expect(cmdBaja?.commandId).toBe("SWITCH_MATERIAL_STEEL");
    });

    test("routes English material selection commands", () => {
      const cmdConcrete = routeVoiceTranscriptToCommand("switch to concrete beam");
      expect(cmdConcrete?.commandId).toBe("SWITCH_MATERIAL_CONCRETE");

      const cmdSteel = routeVoiceTranscriptToCommand("use structural steel");
      expect(cmdSteel?.commandId).toBe("SWITCH_MATERIAL_STEEL");
    });

    test("routes steel profile filtering commands (IWF, BOX, ALL)", () => {
      expect(routeVoiceTranscriptToCommand("filter profil iwf")?.commandId).toBe(
        "FILTER_STEEL_IWF",
      );
      expect(routeVoiceTranscriptToCommand("ganti ke profil box hollow")?.commandId).toBe(
        "FILTER_STEEL_BOX",
      );
      expect(routeVoiceTranscriptToCommand("tampilkan semua profil baja")?.commandId).toBe(
        "FILTER_STEEL_ALL",
      );
    });

    test("routes internal force diagram toggles (BMD, SFD, NFD, TFD)", () => {
      expect(routeVoiceTranscriptToCommand("tampilkan bidang momen bmd")?.commandId).toBe(
        "TOGGLE_DIAGRAM_BMD",
      );
      expect(routeVoiceTranscriptToCommand("sembunyikan diagram geser sfd")?.commandId).toBe(
        "TOGGLE_DIAGRAM_SFD",
      );
      expect(routeVoiceTranscriptToCommand("toggle diagram aksial normal")?.commandId).toBe(
        "TOGGLE_DIAGRAM_NFD",
      );
      expect(routeVoiceTranscriptToCommand("buka grafik momen torsi")?.commandId).toBe(
        "TOGGLE_DIAGRAM_TFD",
      );
    });

    test("routes diagram display mode configurations", () => {
      expect(routeVoiceTranscriptToCommand("mode diagram sumbu as balok")?.commandId).toBe(
        "SET_DIAGRAM_MODE_IN_PLACE",
      );
      expect(routeVoiceTranscriptToCommand("diagram vertikal stacked")?.commandId).toBe(
        "SET_DIAGRAM_MODE_STACKED",
      );
      expect(routeVoiceTranscriptToCommand("mode diagram jendela floating")?.commandId).toBe(
        "SET_DIAGRAM_MODE_WINDOW",
      );
    });

    test("routes support configuration commands (Sendi-Rol, Jepit-Rol, Jepit-Jepit, Kantilever)", () => {
      expect(routeVoiceTranscriptToCommand("tumpuan sendi rol")?.commandId).toBe(
        "SET_SUPPORT_PINNED_ROLLER",
      );
      expect(routeVoiceTranscriptToCommand("tumpuan jepit rol")?.commandId).toBe(
        "SET_SUPPORT_FIXED_ROLLER",
      );
      expect(routeVoiceTranscriptToCommand("tumpuan jepit jepit")?.commandId).toBe(
        "SET_SUPPORT_FIXED_FIXED",
      );
      expect(routeVoiceTranscriptToCommand("tumpuan jepit sendi")?.commandId).toBe(
        "SET_SUPPORT_FIXED_PINNED",
      );
      expect(routeVoiceTranscriptToCommand("balok kantilever")?.commandId).toBe(
        "SET_SUPPORT_CANTILEVER",
      );
    });

    test("extracts numerical span length parameters accurately", () => {
      const match1 = routeVoiceTranscriptToCommand("bentang 8 meter");
      expect(match1?.commandId).toBe("SET_SPAN_LENGTH");
      expect(match1?.extractedParameters.spanLengthM).toBe(8);

      const match2 = routeVoiceTranscriptToCommand("panjang bentang 12.5 meter");
      expect(match2?.commandId).toBe("SET_SPAN_LENGTH");
      expect(match2?.extractedParameters.spanLengthM).toBe(12.5);

      const match3 = routeVoiceTranscriptToCommand("span 6,5 m");
      expect(match3?.commandId).toBe("SET_SPAN_LENGTH");
      expect(match3?.extractedParameters.spanLengthM).toBe(6.5);
    });

    test("extracts numerical point load parameters accurately", () => {
      const match = routeVoiceTranscriptToCommand("tambah beban titik 75 kn");
      expect(match?.commandId).toBe("ADD_POINT_LOAD");
      expect(match?.extractedParameters.magnitudeKn).toBe(75);
    });

    test("extracts concrete fc parameter accurately", () => {
      const match = routeVoiceTranscriptToCommand("mutu beton fc 35 mpa");
      expect(match?.commandId).toBe("SET_CONCRETE_FC");
      expect(match?.extractedParameters.fcMpa).toBe(35);
    });

    test("extracts steel grade parameter accurately", () => {
      const match = routeVoiceTranscriptToCommand("mutu baja bj 50");
      expect(match?.commandId).toBe("SET_STEEL_GRADE");
      expect(match?.extractedParameters.steelGrade).toBe("BJ_50");
    });

    test("routes simulation optimization & export commands", () => {
      expect(routeVoiceTranscriptToCommand("optimalkan profil penampang")?.commandId).toBe(
        "RUN_OPTIMIZATION",
      );
      expect(routeVoiceTranscriptToCommand("reset simulasi")?.commandId).toBe("RESET_SIMULATION");
      expect(routeVoiceTranscriptToCommand("ekspor dxf autocad")?.commandId).toBe("EXPORT_DXF");
      expect(routeVoiceTranscriptToCommand("export file sap2000 s2k")?.commandId).toBe(
        "EXPORT_SAP2000",
      );
      expect(routeVoiceTranscriptToCommand("ekspor bim ifc")?.commandId).toBe("EXPORT_IFC");
    });

    test("returns null for non-structural conversational input", () => {
      expect(routeVoiceTranscriptToCommand("selamat pagi apa kabar")).toBeNull();
      expect(routeVoiceTranscriptToCommand("")).toBeNull();
    });
  });

  describe("4. Direct Simulator State Mutation via Command Dispatcher", () => {
    test("mutates material state to CONCRETE and STEEL", () => {
      const resConcrete = executeRegistryCommand("SWITCH_MATERIAL_CONCRETE");
      expect(resConcrete.success).toBe(true);
      expect(getBeamSimulatorSnapshot().materialKind).toBe("CONCRETE");

      const resSteel = executeRegistryCommand("SWITCH_MATERIAL_STEEL");
      expect(resSteel.success).toBe(true);
      expect(getBeamSimulatorSnapshot().materialKind).toBe("STEEL");
    });

    test("mutates span length parameter directly", () => {
      const resSpan = executeRegistryCommand("SET_SPAN_LENGTH", { spanLengthM: 9.0 });
      expect(resSpan.success).toBe(true);
      expect(getBeamSimulatorSnapshot().spanLengthM).toBe(9.0 as Meter);
    });

    test("mutates support orientation directly", () => {
      const resSupport = executeRegistryCommand("SET_SUPPORT_FIXED_ROLLER");
      expect(resSupport.success).toBe(true);
      expect(getBeamSimulatorSnapshot().supportOrientation).toBe("FIXED_ROLLER");
    });

    test("mutates diagram visibility flags directly", () => {
      const initialBmd = getBeamSimulatorSnapshot().visibleDiagrams.bmd;
      const resToggle = executeRegistryCommand("TOGGLE_DIAGRAM_BMD");
      expect(resToggle.success).toBe(true);
      expect(getBeamSimulatorSnapshot().visibleDiagrams.bmd).toBe(!initialBmd);
    });

    test("handles unknown CommandId with CommandRegistryError", () => {
      expect(() => {
        executeRegistryCommand("UNKNOWN_COMMAND_ID" as unknown as CommandId);
      }).toThrow(CommandRegistryError);
    });
  });
});
