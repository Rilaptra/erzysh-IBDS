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
 * Standard canonical wake words including Ucuy personal name.
 */
export const WAKE_WORDS = [
  "halo cuy",
  "oi cuy",
  "hey cuy",
  "woi cuy",
  "halo ucuy",
  "oi ucuy",
  "hey ucuy",
  "woi ucuy",
  "ucuy",
] as const;

export type WakeWord = (typeof WAKE_WORDS)[number];

export interface WakeWordMatchResult {
  /** Whether the transcript contains an activation wake word. */
  readonly matched: boolean;
  /** The normalized canonical wake word detected. */
  readonly wakeWord?: WakeWord;
  /** The exact raw matched wake phrase from the user's speech. */
  readonly rawMatch?: string;
  /** Any trailing command transcript after stripping the wake word (e.g. "ubah ke baja"). */
  readonly remainingText?: string;
}

/**
 * Normalizes text and tests if transcript starts with or contains any of the wake words:
 * "halo cuy", "oi cuy", "hey cuy", "woi cuy", "halo ucuy", "oi ucuy", "hey ucuy", "woi ucuy", "ucuy".
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
  // e.g. "halo cuy", "halo ucuy", "ucuy", "oi ucuy", "woi ucuy", "hey ucuy"
  const prefixRegex =
    /^\s*(?:(halo+|o+i+|o+y+|he+y+|he+i+|wo+i+|wo+y+)\s+)?(ucuy+|cuy+|kuy+|coy+|cui+)[\s,!:?.-]*/i;
  const prefixMatch = prefixRegex.exec(trimmed);

  if (prefixMatch) {
    const rawMatch = prefixMatch[0].trim().replace(/[\s,!:?.-]+$/, "");
    const greeting = prefixMatch[1] ? prefixMatch[1].toLowerCase() : "";
    const targetName = prefixMatch[2]!.toLowerCase();
    const isUcuyTarget = targetName.startsWith("ucuy");
    const remainingText = trimmed.slice(prefixMatch[0].length).trim();

    let wakeWord: WakeWord = isUcuyTarget ? "halo ucuy" : "halo cuy";
    if (!greeting && isUcuyTarget) {
      wakeWord = "ucuy";
    } else if (greeting.startsWith("oi") || greeting.startsWith("oy")) {
      wakeWord = isUcuyTarget ? "oi ucuy" : "oi cuy";
    } else if (greeting.startsWith("he")) {
      wakeWord = isUcuyTarget ? "hey ucuy" : "hey cuy";
    } else if (greeting.startsWith("wo")) {
      wakeWord = isUcuyTarget ? "woi ucuy" : "woi cuy";
    }

    return {
      matched: true,
      wakeWord,
      rawMatch,
      remainingText,
    };
  }

  // Fallback: Wake word anywhere in the transcript (e.g. "tolong, halo ucuy!")
  const anywhereRegex =
    /\b(?:(halo+|o+i+|o+y+|he+y+|he+i+|wo+i+|wo+y+)\s+)?(ucuy+|cuy+|kuy+|coy+|cui+)\b/i;
  const anywhereMatch = anywhereRegex.exec(trimmed);

  if (anywhereMatch) {
    const greeting = anywhereMatch[1] ? anywhereMatch[1].toLowerCase() : "";
    const targetName = anywhereMatch[2]!.toLowerCase();
    const isUcuyTarget = targetName.startsWith("ucuy");
    const matchIndex = anywhereMatch.index;
    const matchLength = anywhereMatch[0].length;

    let wakeWord: WakeWord = isUcuyTarget ? "halo ucuy" : "halo cuy";
    if (!greeting && isUcuyTarget) {
      wakeWord = "ucuy";
    } else if (greeting.startsWith("oi") || greeting.startsWith("oy")) {
      wakeWord = isUcuyTarget ? "oi ucuy" : "oi cuy";
    } else if (greeting.startsWith("he")) {
      wakeWord = isUcuyTarget ? "hey ucuy" : "hey cuy";
    } else if (greeting.startsWith("wo")) {
      wakeWord = isUcuyTarget ? "woi ucuy" : "woi cuy";
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
