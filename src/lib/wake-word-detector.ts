/**
 * @file wake-word-detector.ts
 * @description Detection engine for Voice Command wake words in Indonesian:
 * - "halo cuy"
 * - "oi cuy"
 * - "hey cuy"
 * - "woi cuy"
 *
 * Supports robust phonetic variations common in browser Web Speech API:
 * - "kuy", "coy", "cui"
 * - "oy", "hei", "woy", "heyy", "woii", "oii"
 * Allows seamless command compounding (e.g. "halo cuy ubah ke baja struktural").
 */

/**
 * Standard canonical wake words.
 */
export const WAKE_WORDS = ["halo cuy", "oi cuy", "hey cuy", "woi cuy"] as const;

export type WakeWord = (typeof WAKE_WORDS)[number];

export interface WakeWordMatchResult {
  /** Whether the transcript contains an activation wake word. */
  readonly matched: boolean;
  /** The normalized canonical wake word detected ("halo cuy" | "oi cuy" | "hey cuy" | "woi cuy"). */
  readonly wakeWord?: WakeWord;
  /** The exact raw matched wake phrase from the user's speech. */
  readonly rawMatch?: string;
  /** Any trailing command transcript after stripping the wake word (e.g. "ubah ke baja"). */
  readonly remainingText?: string;
}

/**
 * Normalizes text and tests if transcript starts with or contains any of the wake words:
 * "halo cuy", "oi cuy", "hey cuy", "woi cuy" (and common phonetic variations in Indonesian STT).
 *
 * @param transcript Spoken text from speech recognition.
 * @returns {@link WakeWordMatchResult}
 */
export function matchWakeWord(transcript: string): WakeWordMatchResult {
  const trimmed = transcript.trim();
  if (!trimmed) {
    return { matched: false };
  }

  // Regex matching beginning of utterance or standalone clause:
  // e.g. "halo cuy", "halo kuy", "oi cuy", "oy cuy", "oii cuy", "hey cuy", "hei cuy", "heyy cuy", "woi cuy", "woy cuy", "woii cuy"
  const prefixRegex =
    /^\s*(halo+|o+i+|o+y+|he+y+|he+i+|wo+i+|wo+y+)\s+(cuy+|kuy+|coy+|cui+)[\s,!:?.-]*/i;
  const prefixMatch = prefixRegex.exec(trimmed);

  if (prefixMatch) {
    const rawMatch = prefixMatch[0].trim().replace(/[\s,!:?.-]+$/, "");
    const greeting = prefixMatch[1]!.toLowerCase();
    const remainingText = trimmed.slice(prefixMatch[0].length).trim();

    let wakeWord: WakeWord = "halo cuy";
    if (greeting.startsWith("oi") || greeting.startsWith("oy")) {
      wakeWord = "oi cuy";
    } else if (greeting.startsWith("he")) {
      wakeWord = "hey cuy";
    } else if (greeting.startsWith("wo")) {
      wakeWord = "woi cuy";
    }

    return {
      matched: true,
      wakeWord,
      rawMatch,
      remainingText,
    };
  }

  // Fallback: Wake word anywhere in the transcript (e.g. "tolong, halo cuy!")
  const anywhereRegex = /\b(halo+|o+i+|o+y+|he+y+|he+i+|wo+i+|wo+y+)\s+(cuy+|kuy+|coy+|cui+)\b/i;
  const anywhereMatch = anywhereRegex.exec(trimmed);

  if (anywhereMatch) {
    const greeting = anywhereMatch[1]!.toLowerCase();
    const matchIndex = anywhereMatch.index;
    const matchLength = anywhereMatch[0].length;

    let wakeWord: WakeWord = "halo cuy";
    if (greeting.startsWith("oi") || greeting.startsWith("oy")) {
      wakeWord = "oi cuy";
    } else if (greeting.startsWith("he")) {
      wakeWord = "hey cuy";
    } else if (greeting.startsWith("wo")) {
      wakeWord = "woi cuy";
    }

    const beforeText = trimmed.slice(0, matchIndex).trim();
    const afterText = trimmed
      .slice(matchIndex + matchLength)
      .replace(/^[\s,!:?.-]+/, "")
      .trim();
    const remainingText = [beforeText, afterText].filter(Boolean).join(" ");

    return {
      matched: true,
      wakeWord,
      rawMatch: anywhereMatch[0].trim(),
      remainingText,
    };
  }

  return { matched: false };
}

/**
 * Returns true if the string is purely a wake word without additional command instructions.
 */
export function isPureWakeWord(transcript: string): boolean {
  const res = matchWakeWord(transcript);
  return res.matched && (!res.remainingText || res.remainingText.length === 0);
}
