/**
 * @file clap-detector-and-wake-words.test.ts
 * @description Unit tests for Wake Word Detection ("halo cuy", "oi cuy", "hey cuy", "woi cuy")
 * and Double Clap ("Dua Kali Tepuk") Detection Engine.
 */

import { describe, expect, test } from "bun:test";

import { ClapDetectionEngine, type ClapDetectorConfig } from "@/core/audio/clap-detector";
import { routeVoiceTranscriptToCommand } from "@/hooks/use-web-speech-command";
import { isPureWakeWord, matchWakeWord, WAKE_WORDS } from "@/lib/wake-word-detector";

// ============================================================================
// Helper synthetic audio frame generator
// ============================================================================

/**
 * Creates a synthetic audio buffer with specified peak and shape.
 * @param peak Peak amplitude (0.0 - 1.0)
 * @param type "CLAP" (impulsive spike, high crest factor) | "VOICE" (sustained wave, low crest factor) | "SILENCE"
 */
function createSyntheticFrame(
  peak: number,
  type: "CLAP" | "VOICE" | "SILENCE" = "CLAP",
  length: number = 256,
): Float32Array {
  const buffer = new Float32Array(length);
  if (type === "SILENCE") {
    // Ambient noise near zero
    for (let i = 0; i < length; i++) {
      buffer[i] = (Math.random() - 0.5) * 0.02;
    }
    return buffer;
  }

  if (type === "VOICE") {
    // Sustained sine wave (RMS is high, peak/RMS is low ~ 1.41)
    for (let i = 0; i < length; i++) {
      buffer[i] = peak * Math.sin((2 * Math.PI * i * 4) / length);
    }
    return buffer;
  }

  // Impulsive CLAP: brief spike at center, nearly zero elsewhere (high crest factor > 3.0)
  for (let i = 0; i < length; i++) {
    buffer[i] = (Math.random() - 0.5) * 0.01;
  }
  buffer[Math.floor(length / 2)] = peak;
  buffer[Math.floor(length / 2) + 1] = peak * 0.7;
  buffer[Math.floor(length / 2) - 1] = -peak * 0.6;
  return buffer;
}

// ============================================================================
// Test Suite: Wake Word Detector
// ============================================================================

describe("Voice Command Wake Words Detection Engine", () => {
  describe("1. Canonical Wake Word Matching", () => {
    test("matches all 4 required canonical wake words exactly", () => {
      for (const word of WAKE_WORDS) {
        const res = matchWakeWord(word);
        expect(res.matched).toBe(true);
        expect(res.wakeWord).toBe(word);
        expect(res.remainingText).toBe("");
        expect(isPureWakeWord(word)).toBe(true);
      }
    });

    test("matches case-insensitively", () => {
      expect(matchWakeWord("HALO CUY").matched).toBe(true);
      expect(matchWakeWord("Oi Cuy").matched).toBe(true);
      expect(matchWakeWord("hEy CuY").matched).toBe(true);
      expect(matchWakeWord("WOI CUY").matched).toBe(true);
    });

    test("handles punctuation cleanly", () => {
      const res1 = matchWakeWord("Halo cuy!");
      expect(res1.matched).toBe(true);
      expect(res1.wakeWord).toBe("halo cuy");

      const res2 = matchWakeWord("Oi cuy,");
      expect(res2.matched).toBe(true);
      expect(res2.wakeWord).toBe("oi cuy");

      const res3 = matchWakeWord("Hey cuy?!");
      expect(res3.matched).toBe(true);
      expect(res3.wakeWord).toBe("hey cuy");

      const res4 = matchWakeWord("Woi cuy...");
      expect(res4.matched).toBe(true);
      expect(res4.wakeWord).toBe("woi cuy");
    });
  });

  describe("2. Indonesian STT Phonetic Variations", () => {
    test("matches common phonetic variations for 'halo cuy'", () => {
      expect(matchWakeWord("halo kuy").matched).toBe(true);
      expect(matchWakeWord("halo coy").matched).toBe(true);
      expect(matchWakeWord("halo cui").matched).toBe(true);
    });

    test("matches common phonetic variations for 'oi cuy'", () => {
      expect(matchWakeWord("oy cuy").matched).toBe(true);
      expect(matchWakeWord("oii cuy").matched).toBe(true);
      expect(matchWakeWord("oi kuy").matched).toBe(true);
      expect(matchWakeWord("oy kuy").matched).toBe(true);
    });

    test("matches common phonetic variations for 'hey cuy'", () => {
      expect(matchWakeWord("hei cuy").matched).toBe(true);
      expect(matchWakeWord("heyy cuy").matched).toBe(true);
      expect(matchWakeWord("hey kuy").matched).toBe(true);
      expect(matchWakeWord("hei kuy").matched).toBe(true);
    });

    test("matches common phonetic variations for 'woi cuy'", () => {
      expect(matchWakeWord("woy cuy").matched).toBe(true);
      expect(matchWakeWord("woii cuy").matched).toBe(true);
      expect(matchWakeWord("woi kuy").matched).toBe(true);
      expect(matchWakeWord("woy kuy").matched).toBe(true);
    });
  });

  describe("3. Wake Word Compound Extraction", () => {
    test("extracts wake word and trailing command instructions", () => {
      const res = matchWakeWord("halo cuy ubah ke material baja");
      expect(res.matched).toBe(true);
      expect(res.wakeWord).toBe("halo cuy");
      expect(res.remainingText).toBe("ubah ke material baja");
      expect(isPureWakeWord("halo cuy ubah ke material baja")).toBe(false);
    });

    test("extracts wake word with comma and trailing command", () => {
      const res = matchWakeWord("oi cuy, tampilkan diagram momen bmd");
      expect(res.matched).toBe(true);
      expect(res.wakeWord).toBe("oi cuy");
      expect(res.remainingText).toBe("tampilkan diagram momen bmd");
    });

    test("extracts wake word occurring mid-sentence", () => {
      const res = matchWakeWord("tolong halo cuy bentang 10 meter");
      expect(res.matched).toBe(true);
      expect(res.wakeWord).toBe("halo cuy");
      expect(res.remainingText).toBe("tolong bentang 10 meter");
    });

    test("rejects non-wake phrases cleanly", () => {
      expect(matchWakeWord("halo teman").matched).toBe(false);
      expect(matchWakeWord("selamat pagi").matched).toBe(false);
      expect(matchWakeWord("ganti ke baja").matched).toBe(false);
      expect(matchWakeWord("").matched).toBe(false);
    });
  });
});

// ============================================================================
// Test Suite: Double Clap ("Dua Kali Tepuk") Detection Engine
// ============================================================================

describe("Double Clap ('Dua Kali Tepuk') Acoustic Detection Engine", () => {
  test("ignores silence and low ambient room noise", () => {
    const engine = new ClapDetectionEngine();
    const silentFrame = createSyntheticFrame(0.02, "SILENCE");

    for (let t = 0; t < 1000; t += 20) {
      const detected = engine.processAudioFrame(silentFrame, t);
      expect(detected).toBe(false);
      expect(engine.getState()).toBe("IDLE");
    }
  });

  test("ignores continuous vocal speech (low crest factor despite high peak)", () => {
    const engine = new ClapDetectionEngine();
    const voiceFrame = createSyntheticFrame(0.85, "VOICE");

    for (let t = 0; t < 1000; t += 20) {
      const detected = engine.processAudioFrame(voiceFrame, t);
      expect(detected).toBe(false);
      expect(engine.getState()).toBe("IDLE");
    }
  });

  test("single clap transitions to WAITING_FOR_SECOND_CLAP and times out after maxInterval", () => {
    const engine = new ClapDetectionEngine({ minIntervalMs: 150, maxIntervalMs: 850 });
    const clapFrame = createSyntheticFrame(0.8, "CLAP");
    const silentFrame = createSyntheticFrame(0.01, "SILENCE");

    // First clap at t = 100ms
    const detected1 = engine.processAudioFrame(clapFrame, 100);
    expect(detected1).toBe(false);
    expect(engine.getState()).toBe("WAITING_FOR_SECOND_CLAP");

    // Silence for 800ms
    engine.processAudioFrame(silentFrame, 500);
    expect(engine.getState()).toBe("WAITING_FOR_SECOND_CLAP");

    // Times out at t = 1000ms (elapsed 900ms > 850ms)
    engine.processAudioFrame(silentFrame, 1000);
    expect(engine.getState()).toBe("IDLE");
  });

  test("ignores second transient inside refractory window (< 150ms)", () => {
    const engine = new ClapDetectionEngine({ minIntervalMs: 150, maxIntervalMs: 850 });
    const clapFrame = createSyntheticFrame(0.8, "CLAP");

    // Clap 1 at t = 100ms
    engine.processAudioFrame(clapFrame, 100);
    expect(engine.getState()).toBe("WAITING_FOR_SECOND_CLAP");

    // Acoustic ringing / echo at t = 160ms (elapsed 60ms < 150ms)
    const detectedEcho = engine.processAudioFrame(clapFrame, 160);
    expect(detectedEcho).toBe(false);
    expect(engine.getState()).toBe("WAITING_FOR_SECOND_CLAP");
  });

  test("detects DOUBLE CLAP when second clap occurs within valid window (150ms - 850ms)", () => {
    const engine = new ClapDetectionEngine({ minIntervalMs: 150, maxIntervalMs: 850 });
    const clapFrame = createSyntheticFrame(0.85, "CLAP");
    const silentFrame = createSyntheticFrame(0.01, "SILENCE");

    // Clap 1 at t = 100ms
    expect(engine.processAudioFrame(clapFrame, 100)).toBe(false);
    expect(engine.getState()).toBe("WAITING_FOR_SECOND_CLAP");

    // Silence at t = 200ms
    expect(engine.processAudioFrame(silentFrame, 200)).toBe(false);

    // Clap 2 at t = 420ms (elapsed 320ms, within [150ms, 850ms])
    const detected = engine.processAudioFrame(clapFrame, 420);
    expect(detected).toBe(true); // DOUBLE CLAP DETECTED!
    expect(engine.getState()).toBe("COOLDOWN");
  });

  test("cooldown prevents multi-triggering from subsequent claps", () => {
    const engine = new ClapDetectionEngine({
      minIntervalMs: 150,
      maxIntervalMs: 850,
      cooldownMs: 1000,
    });
    const clapFrame = createSyntheticFrame(0.85, "CLAP");

    // Double clap
    engine.processAudioFrame(clapFrame, 100);
    const doubleClap = engine.processAudioFrame(clapFrame, 400);
    expect(doubleClap).toBe(true);
    expect(engine.getState()).toBe("COOLDOWN");

    // Subsequent clap during cooldown at t = 700ms
    const duringCooldown = engine.processAudioFrame(clapFrame, 700);
    expect(duringCooldown).toBe(false);

    // Cooldown expires at t = 1500ms (1100ms after detection)
    const afterCooldown = engine.processAudioFrame(clapFrame, 1500);
    expect(afterCooldown).toBe(false);
    expect(engine.getState()).toBe("WAITING_FOR_SECOND_CLAP"); // Starts fresh attempt!
  });

  test("reset() cleanly resets engine to IDLE", () => {
    const engine = new ClapDetectionEngine();
    const clapFrame = createSyntheticFrame(0.85, "CLAP");

    engine.processAudioFrame(clapFrame, 100);
    expect(engine.getState()).toBe("WAITING_FOR_SECOND_CLAP");

    engine.reset();
    expect(engine.getState()).toBe("IDLE");
  });
});

// ============================================================================
// Test Suite: Command Router Integration with Wake Words & Double Clap
// ============================================================================

describe("Intent Router Wake Word & Clap Integration", () => {
  test("routes 'halo cuy' to UNMUTE_VOICE_COMMAND with friendly confirmation", () => {
    const res = routeVoiceTranscriptToCommand("halo cuy");
    expect(res).not.toBeNull();
    expect(res?.commandId).toBe("UNMUTE_VOICE_COMMAND");
    expect(res?.spokenConfirmation).toContain("Halo cuy!");
  });

  test("routes 'oi cuy' to UNMUTE_VOICE_COMMAND", () => {
    const res = routeVoiceTranscriptToCommand("oi cuy");
    expect(res).not.toBeNull();
    expect(res?.commandId).toBe("UNMUTE_VOICE_COMMAND");
    expect(res?.spokenConfirmation).toContain("Oi cuy!");
  });

  test("routes 'hey cuy' to UNMUTE_VOICE_COMMAND", () => {
    const res = routeVoiceTranscriptToCommand("hey cuy");
    expect(res).not.toBeNull();
    expect(res?.commandId).toBe("UNMUTE_VOICE_COMMAND");
    expect(res?.spokenConfirmation).toContain("Hey cuy!");
  });

  test("routes 'woi cuy' to UNMUTE_VOICE_COMMAND", () => {
    const res = routeVoiceTranscriptToCommand("woi cuy");
    expect(res).not.toBeNull();
    expect(res?.commandId).toBe("UNMUTE_VOICE_COMMAND");
    expect(res?.spokenConfirmation).toContain("Woi cuy!");
  });

  test("routes 'dua kali tepuk' to UNMUTE_VOICE_COMMAND", () => {
    const res = routeVoiceTranscriptToCommand("dua kali tepuk");
    expect(res).not.toBeNull();
    expect(res?.commandId).toBe("UNMUTE_VOICE_COMMAND");
    expect(res?.spokenConfirmation).toContain("Tepuk tangan terdeteksi");
  });

  test("routes compound wake word command 'halo cuy ubah ke material baja'", () => {
    const res = routeVoiceTranscriptToCommand("halo cuy ubah ke material baja");
    expect(res).not.toBeNull();
    expect(res?.commandId).toBe("SWITCH_MATERIAL_STEEL");
    expect(res?.spokenConfirmation).toContain("Halo cuy!");
  });

  test("routes compound wake word command 'oi cuy tampilkan bidang momen bmd'", () => {
    const res = routeVoiceTranscriptToCommand("oi cuy tampilkan bidang momen bmd");
    expect(res).not.toBeNull();
    expect(res?.commandId).toBe("TOGGLE_DIAGRAM_BMD");
    expect(res?.spokenConfirmation).toContain("Halo cuy!");
  });
});
