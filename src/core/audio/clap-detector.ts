/**
 * @file clap-detector.ts
 * @description High-reliability Double Clap ("Dua Kali Tepuk") Detection Engine using Web Audio API.
 *
 * Algorithm Details:
 * 1. Analyzes time-domain acoustic audio frames for sharp impulsive transients.
 * 2. Uses Peak-to-RMS (Crest Factor) ratio and absolute peak thresholds to distinguish
 *    abrupt mechanical claps from continuous human speech, ambient noise, or music.
 * 3. State machine tracks inter-clap intervals:
 *    - First clap detected -> starts interval timer.
 *    - Refractory window (150ms): ignores acoustic reverberation/echo from the first clap.
 *    - Valid second clap window (150ms - 850ms): triggers DOUBLE CLAP confirmation.
 *    - Timeout (> 850ms): drops back to IDLE without false triggering.
 *    - Post-detection cooldown (1000ms): prevents multi-triggering from subsequent claps.
 */

export interface ClapDetectorConfig {
  /** Minimum normalized peak amplitude [0.0 - 1.0] to qualify as a clap spike (default: 0.32). */
  readonly peakThreshold?: number;
  /** Minimum crest factor (peak / rms) to distinguish claps from vocal speech (default: 2.6). */
  readonly minCrestFactor?: number;
  /** Minimum interval in milliseconds between clap 1 and clap 2 (refractory window, default: 150ms). */
  readonly minIntervalMs?: number;
  /** Maximum interval in milliseconds between clap 1 and clap 2 (timeout window, default: 850ms). */
  readonly maxIntervalMs?: number;
  /** Cooldown period in milliseconds after a successful double clap (default: 1000ms). */
  readonly cooldownMs?: number;
}

export type ClapDetectorState = "IDLE" | "WAITING_FOR_SECOND_CLAP" | "COOLDOWN";

/**
 * Pure, deterministic mathematical Clap Detection State Machine.
 * Can be run in headless node/bun unit tests with synthetic audio buffers.
 */
export class ClapDetectionEngine {
  public readonly peakThreshold: number;
  public readonly minCrestFactor: number;
  public readonly minIntervalMs: number;
  public readonly maxIntervalMs: number;
  public readonly cooldownMs: number;

  private state: ClapDetectorState = "IDLE";
  private firstClapTimestamp: number = 0;
  private cooldownStartTimestamp: number = 0;

  constructor(config: ClapDetectorConfig = {}) {
    this.peakThreshold = config.peakThreshold ?? 0.32;
    this.minCrestFactor = config.minCrestFactor ?? 2.6;
    this.minIntervalMs = config.minIntervalMs ?? 150;
    this.maxIntervalMs = config.maxIntervalMs ?? 850;
    this.cooldownMs = config.cooldownMs ?? 1000;
  }

  /**
   * Current lifecycle state of the clap detector.
   */
  public getState(): ClapDetectorState {
    return this.state;
  }

  /**
   * Resets the engine to initial IDLE state.
   */
  public reset(): void {
    this.state = "IDLE";
    this.firstClapTimestamp = 0;
    this.cooldownStartTimestamp = 0;
  }

  /**
   * Evaluates an audio buffer frame in time domain (PCM samples in [-1.0, 1.0]).
   *
   * @param samples Float32Array or array of normalized audio samples [-1.0 .. 1.0].
   * @param timestampMs Timestamp in milliseconds (defaults to performance.now() or Date.now()).
   * @returns true if a valid DOUBLE CLAP was completed on this frame, false otherwise.
   */
  public processAudioFrame(
    samples: Float32Array | readonly number[],
    timestampMs: number = typeof performance !== "undefined" ? performance.now() : Date.now(),
  ): boolean {
    if (!samples || samples.length === 0) {
      return false;
    }

    // Handle COOLDOWN timer
    if (this.state === "COOLDOWN") {
      if (timestampMs - this.cooldownStartTimestamp >= this.cooldownMs) {
        this.state = "IDLE";
      } else {
        return false;
      }
    }

    // Compute peak amplitude and Root-Mean-Square (RMS)
    let sumSquares = 0;
    let peak = 0;
    const len = samples.length;

    for (let i = 0; i < len; i++) {
      const absVal = Math.abs(samples[i] ?? 0);
      if (absVal > peak) {
        peak = absVal;
      }
      sumSquares += absVal * absVal;
    }

    const rms = Math.sqrt(sumSquares / len);
    const crestFactor = rms > 1e-4 ? peak / rms : 0;

    // A valid clap transient must have significant peak and sharp crest factor
    const isClapTransient = peak >= this.peakThreshold && crestFactor >= this.minCrestFactor;

    switch (this.state) {
      case "IDLE": {
        if (isClapTransient) {
          this.state = "WAITING_FOR_SECOND_CLAP";
          this.firstClapTimestamp = timestampMs;
        }
        return false;
      }

      case "WAITING_FOR_SECOND_CLAP": {
        const elapsed = timestampMs - this.firstClapTimestamp;

        // Timed out: more than maxIntervalMs passed without a second clap
        if (elapsed > this.maxIntervalMs) {
          if (isClapTransient) {
            // This new clap becomes the first clap of a new attempt
            this.firstClapTimestamp = timestampMs;
          } else {
            this.state = "IDLE";
            this.firstClapTimestamp = 0;
          }
          return false;
        }

        // Refractory period: acoustic reflections / room ringing of first clap are ignored
        if (elapsed < this.minIntervalMs) {
          return false;
        }

        // Within valid double-clap window [minIntervalMs .. maxIntervalMs]
        if (isClapTransient) {
          this.state = "COOLDOWN";
          this.cooldownStartTimestamp = timestampMs;
          this.firstClapTimestamp = 0;
          return true; // DOUBLE CLAP DETECTED!
        }

        return false;
      }

      default:
        return false;
    }
  }
}

/**
 * Browser Web Audio API microphone stream manager for continuous clap detection.
 */
export class BrowserClapDetector {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private analyserNode: AnalyserNode | null = null;
  private engine: ClapDetectionEngine;
  private pollIntervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning: boolean = false;
  private onDoubleClapCallback: (() => void) | null = null;
  private isAcousticPlayingCheck?: () => boolean;

  constructor(config: ClapDetectorConfig = {}) {
    this.engine = new ClapDetectionEngine(config);
  }

  /**
   * Whether the clap detector is actively capturing and analyzing microphone audio.
   */
  public get isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Starts listening to browser microphone stream for double clap events.
   *
   * @param onDoubleClap Callback executed when a valid double clap is detected.
   * @param isAcousticPlaying Optional callback returning true when speaker audio is active to prevent echo false triggers.
   */
  public async start(
    onDoubleClap: () => void,
    isAcousticPlaying?: () => boolean,
  ): Promise<boolean> {
    if (typeof window === "undefined" || !navigator?.mediaDevices?.getUserMedia) {
      return false;
    }

    if (this.isRunning) {
      this.onDoubleClapCallback = onDoubleClap;
      this.isAcousticPlayingCheck = isAcousticPlaying;
      return true;
    }

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return false;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      this.mediaStream = stream;
      this.audioContext = new AudioCtx();
      if (this.audioContext.state === "suspended") {
        void this.audioContext.resume();
      }

      const source = this.audioContext.createMediaStreamSource(stream);
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.1;
      source.connect(analyser);

      this.analyserNode = analyser;
      this.onDoubleClapCallback = onDoubleClap;
      this.isAcousticPlayingCheck = isAcousticPlaying;
      this.isRunning = true;
      this.engine.reset();

      const buffer = new Float32Array(analyser.fftSize);

      // Analyze at 50Hz (every 20ms) for responsive transient capture
      this.pollIntervalId = setInterval(() => {
        if (!this.isRunning || !this.analyserNode) return;

        // Skip if speaker is currently outputting sound (prevents feedback self-trigger)
        if (this.isAcousticPlayingCheck && this.isAcousticPlayingCheck()) {
          return;
        }

        this.analyserNode.getFloatTimeDomainData(buffer);
        const detected = this.engine.processAudioFrame(
          buffer,
          typeof performance !== "undefined" ? performance.now() : Date.now(),
        );

        if (detected && this.onDoubleClapCallback) {
          this.onDoubleClapCallback();
        }
      }, 20);

      return true;
    } catch {
      this.stop();
      return false;
    }
  }

  /**
   * Stops microphone capture and cleans up all active audio tracks.
   */
  public stop(): void {
    this.isRunning = false;

    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignore
        }
      });
      this.mediaStream = null;
    }

    if (this.audioContext && this.audioContext.state !== "closed") {
      try {
        void this.audioContext.close();
      } catch {
        // Ignore
      }
      this.audioContext = null;
    }

    this.analyserNode = null;
    this.engine.reset();
  }

  /**
   * Complete destruction for hook teardown.
   */
  public destroy(): void {
    this.stop();
    this.onDoubleClapCallback = null;
    this.isAcousticPlayingCheck = undefined;
  }
}
