// Gemini Live Playground - Full-Duplex Audio, Web Speech STT & Hands-Free Engine

let currentMode = "bidi"; // 'bidi' (Live WebSocket) or 'stream' (SSE)
let isLiveCallActive = false; // For raw PCM streaming
let isSttListening = false; // For Web Speech API STT
let liveWebSocket = null;
let pendingSendQueue = [];
let speechRecognition = null;

// Output Audio Engine (24kHz PCM from Gemini Live)
let playbackContext = null;
let nextPlayTime = 0;
let totalAudioChunks = 0;
let totalAudioBytes = 0;

// Input Audio Engine (16kHz PCM Microphone to Gemini Live)
let inputAudioContext = null;
let micStream = null;
let micProcessor = null;

// Auto-Send Timer State
let autoSendInterval = null;
let countdownRemaining = 0;
let speechSilenceTimeout = null;

// Double Clap Detector State
let clapAudioContext = null;
let clapStream = null;
let clapProcessor = null;
let clapHighpass = null;
let clapBandpass = null;
let clapAnalyser = null;
let tableFilter = null;
let tableAnalyser = null;
let muteGain = null;
let clapCount = 0;
let firstClapTime = 0;
let clapResetTimeout = null;
let clapCooldownUntil = 0;
let toastTimeout = null;

// DOM Elements
const statusBadge = document.getElementById("statusBadge");
const statusText = document.getElementById("statusText");
const keyText = document.getElementById("keyText");
const modeStreamBtn = document.getElementById("modeStreamBtn");
const modeBidiBtn = document.getElementById("modeBidiBtn");
const modelSelect = document.getElementById("modelSelect");
const voiceSelect = document.getElementById("voiceSelect");
const micModeSelect = document.getElementById("micModeSelect");
const autoSendDelaySelect = document.getElementById("autoSendDelaySelect");
const clapToggle = document.getElementById("clapToggle");
const clapOptions = document.getElementById("clapOptions");
const clapSensitivitySelect = document.getElementById("clapSensitivitySelect");
const clapStatusText = document.getElementById("clapStatusText");
const toastNotification = document.getElementById("toastNotification");
const countdownBanner = document.getElementById("countdownBanner");
const countdownProgressBar = document.getElementById("countdownProgressBar");
const countdownText = document.getElementById("countdownText");
const cancelAutoSendBtn = document.getElementById("cancelAutoSendBtn");

const systemPrompt = document.getElementById("systemPrompt");
const statStatus = document.getElementById("statStatus");
const statChunks = document.getElementById("statChunks");
const statBytes = document.getElementById("statBytes");
const statLatency = document.getElementById("statLatency");
const clearChatBtn = document.getElementById("clearChatBtn");
const messagesContainer = document.getElementById("messagesContainer");
const promptInput = document.getElementById("promptInput");
const sendBtn = document.getElementById("sendBtn");
const micBtn = document.getElementById("micBtn");
const canvas = document.getElementById("audioVisualizer");
const canvasCtx = canvas.getContext("2d");

// SFD & BMD Modal Elements
const sfdBmdModal = document.getElementById("sfdBmdModal");
const closeSfdBmdBtn = document.getElementById("closeSfdBmdBtn");
const modalDoneBtn = document.getElementById("modalDoneBtn");
const sfdCanvas = document.getElementById("sfdCanvas");
const bmdCanvas = document.getElementById("bmdCanvas");

// Ensure Output AudioContext is initialized & resumed
function getPlaybackContext() {
  if (!playbackContext) {
    playbackContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 24000,
    });
  }
  if (playbackContext.state === "suspended") {
    playbackContext.resume();
  }
  return playbackContext;
}

// Audio Chime Synthesizer for Hands-free & Double Clap
function playChime(type) {
  try {
    const ctx = getPlaybackContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (type === "clap_first") {
      // Subtle tick for first clap
      osc.type = "sine";
      osc.frequency.setValueAtTime(650, now);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === "mic_start") {
      // Cheerful rising tone (Ding-dong)
      osc.type = "triangle";
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.12); // G5
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.start(now);
      osc.stop(now + 0.14);
    } else if (type === "mic_send") {
      // High confirmation tone
      osc.type = "sine";
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.14); // C6
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.start(now);
      osc.stop(now + 0.16);
    } else if (type === "timer_cancel") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(280, now + 0.1);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    }
  } catch (e) {
    console.warn("Chime error:", e);
  }
}

// Toast notification display
function showToast(message, duration = 2500) {
  if (!toastNotification) return;
  toastNotification.innerHTML = message;
  toastNotification.classList.remove("hidden");
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toastNotification.classList.add("hidden");
  }, duration);
}

// ==========================================
// SFD & BMD Interactive Window Controls
// ==========================================
function openSfdBmdWindow() {
  if (!sfdBmdModal) return;
  sfdBmdModal.classList.remove("hidden");
  playChime("mic_send");
  showToast("🏗️ Window SFD & BMD Berhasil Diaktifkan!", 2500);

  setTimeout(() => {
    drawSfdDiagram(sfdCanvas);
    drawBmdDiagram(bmdCanvas);
  }, 60);
}

function closeSfdBmdWindow() {
  if (!sfdBmdModal) return;
  sfdBmdModal.classList.add("hidden");
  playChime("timer_cancel");
  showToast("Window SFD & BMD Ditutup", 1500);
}

if (closeSfdBmdBtn) closeSfdBmdBtn.addEventListener("click", closeSfdBmdWindow);
if (modalDoneBtn) modalDoneBtn.addEventListener("click", closeSfdBmdWindow);

function drawSfdDiagram(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const midY = h / 2;
  const padX = 60;
  const spanW = w - padX * 2;
  const xMid = padX + spanW / 2;

  // Sumbu Netral (Baseline)
  ctx.strokeStyle = "#484f58";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padX, midY);
  ctx.lineTo(w - padX, midY);
  ctx.stroke();

  // Skala: V_max = 48.5 kN -> 50px
  const maxV = 48.5;
  const scaleY = 48 / maxV;
  const y0 = midY - 48.5 * scaleY;
  const y3minus = midY - 12.5 * scaleY;
  const y3plus = midY - -12.5 * scaleY;
  const y6 = midY - -48.5 * scaleY;

  // Arsiran Daerah Geser Positif (+V)
  ctx.fillStyle = "rgba(63, 185, 80, 0.22)";
  ctx.strokeStyle = "#3fb950";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(padX, midY);
  ctx.lineTo(padX, y0);
  ctx.lineTo(xMid, y3minus);
  ctx.lineTo(xMid, midY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Arsiran Daerah Geser Negatif (-V)
  ctx.fillStyle = "rgba(248, 81, 73, 0.22)";
  ctx.strokeStyle = "#f85149";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(xMid, midY);
  ctx.lineTo(xMid, y3plus);
  ctx.lineTo(w - padX, y6);
  ctx.lineTo(w - padX, midY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Garis loncatan beban titik P di x=3m
  ctx.strokeStyle = "#e3b341";
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(xMid, y3minus);
  ctx.lineTo(xMid, y3plus);
  ctx.stroke();
  ctx.setLineDash([]);

  // Nilai Anotasi
  ctx.fillStyle = "#3fb950";
  ctx.font = "bold 12px 'JetBrains Mono', monospace";
  ctx.fillText("+48.5 kN", padX - 10, y0 - 8);
  ctx.fillText("+12.5 kN", xMid - 65, y3minus - 6);

  ctx.fillStyle = "#f85149";
  ctx.fillText("-12.5 kN", xMid + 8, y3plus + 16);
  ctx.fillText("-48.5 kN", w - padX - 45, y6 + 18);

  ctx.fillStyle = "#8b949e";
  ctx.font = "11px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("Tumpuan A (x=0)", padX - 15, midY + 18);
  ctx.fillText("Beban P = 25kN (x=3m)", xMid - 60, midY - 6);
  ctx.fillText("Tumpuan B (x=6m)", w - padX - 60, midY + 18);
}

function drawBmdDiagram(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const baseY = 25;
  const padX = 60;
  const spanW = w - padX * 2;
  const xMid = padX + spanW / 2;

  // Sumbu Netral Balok
  ctx.strokeStyle = "#484f58";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padX, baseY);
  ctx.lineTo(w - padX, baseY);
  ctx.stroke();

  // Momen Maksimum = 91.5 kNm di tengah bentang
  const maxM = 91.5;
  const scaleY = 90 / maxM;
  const peakY = baseY + maxM * scaleY;

  // Kurva Parabola Momen
  ctx.fillStyle = "rgba(56, 139, 253, 0.22)";
  ctx.strokeStyle = "#58a6ff";
  ctx.lineWidth = 2.5;

  ctx.beginPath();
  ctx.moveTo(padX, baseY);
  ctx.quadraticCurveTo(padX + spanW * 0.25, baseY + 60, xMid, peakY);
  ctx.quadraticCurveTo(padX + spanW * 0.75, baseY + 60, w - padX, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Titik Puncak M_maks
  ctx.fillStyle = "#388bfd";
  ctx.beginPath();
  ctx.arc(xMid, peakY, 5, 0, Math.PI * 2);
  ctx.fill();

  // Nilai Anotasi Momen
  ctx.fillStyle = "#58a6ff";
  ctx.font = "bold 13px 'JetBrains Mono', monospace";
  ctx.fillText("M_maks = +91.5 kNm", xMid - 65, peakY + 22);

  ctx.fillStyle = "#8b949e";
  ctx.font = "11px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("M = 0", padX - 10, baseY - 8);
  ctx.fillText("M = 0", w - padX - 25, baseY - 8);
}

// Seamless PCM 24kHz Audio Player
function playPcmChunk(base64Data) {
  try {
    const ctx = getPlaybackContext();
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const binary = atob(base64Data);
    const len = binary.length;
    const alignedLen = len - (len % 2);
    if (alignedLen === 0) return;

    const bytes = new Uint8Array(alignedLen);
    for (let i = 0; i < alignedLen; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    // 16-bit linear PCM (little-endian) to Float32 (-1.0 to 1.0)
    const int16 = new Int16Array(bytes.buffer, bytes.byteOffset, alignedLen / 2);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768.0;
    }

    const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
    audioBuffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    if (nextPlayTime < now) {
      nextPlayTime = now + 0.04; // 40ms jitter buffer
    }
    source.start(nextPlayTime);
    nextPlayTime += audioBuffer.duration;
  } catch (err) {
    console.error("PCM Audio playback error:", err);
  }
}

// ==========================================
// Auto-Send Timer with Countdown & Instant Mode
// ==========================================
function handleSpeechActivity() {
  const mode = autoSendDelaySelect ? autoSendDelaySelect.value : "instant";

  if (mode === "instant") {
    // Mode INSTAN: Mengirim langsung begitu ada jeda nafas/selesai bicara (380ms)
    cancelAutoSendCountdown();
    if (speechSilenceTimeout) clearTimeout(speechSilenceTimeout);

    speechSilenceTimeout = setTimeout(() => {
      const text = promptInput.value.trim();
      if (text && isSttListening) {
        console.log("⚡ Auto-send Instan terpicu:", text);
        showToast("⚡ Selesai bicara -> Langsung kirim! 🚀", 1200);
        stopSttListening();
        handleSend();
      }
    }, 380);
  } else {
    // Mode Durasi Tertentu (1.5s, 2.5s, 4.0s): Tampilkan banner countdown
    if (speechSilenceTimeout) {
      clearTimeout(speechSilenceTimeout);
      speechSilenceTimeout = null;
    }
    startAutoSendCountdown();
  }
}

function startAutoSendCountdown() {
  const mode = autoSendDelaySelect ? autoSendDelaySelect.value : "instant";
  if (mode === "instant") return;

  const delayMs = Number(mode);
  if (delayMs <= 0) {
    cancelAutoSendCountdown();
    return; // Mode manual
  }

  cancelAutoSendCountdown();

  countdownRemaining = delayMs;
  countdownBanner.classList.remove("hidden");
  countdownProgressBar.style.width = "100%";
  countdownText.textContent = `⏱️ Mengirim dalam ${(countdownRemaining / 1000).toFixed(1)}s...`;

  const intervalStep = 100;
  autoSendInterval = setInterval(() => {
    countdownRemaining -= intervalStep;
    if (countdownRemaining <= 0) {
      cancelAutoSendCountdown();
      console.log("⏱️ Countdown selesai -> Mengirim pesan otomatis.");
      stopSttListening();
      if (promptInput.value.trim()) {
        handleSend();
      }
    } else {
      const pct = (countdownRemaining / delayMs) * 100;
      countdownProgressBar.style.width = `${pct}%`;
      countdownText.textContent = `⏱️ Mengirim dalam ${(countdownRemaining / 1000).toFixed(1)}s...`;
    }
  }, intervalStep);
}

function cancelAutoSendCountdown() {
  if (speechSilenceTimeout) {
    clearTimeout(speechSilenceTimeout);
    speechSilenceTimeout = null;
  }
  if (autoSendInterval) {
    clearInterval(autoSendInterval);
    autoSendInterval = null;
  }
  if (countdownBanner) {
    countdownBanner.classList.add("hidden");
  }
}

if (cancelAutoSendBtn) {
  cancelAutoSendBtn.addEventListener("click", () => {
    cancelAutoSendCountdown();
    playChime("timer_cancel");
    showToast("✕ Pengiriman otomatis dibatalkan. Pesan tetap di kolom input.");
  });
}

promptInput.addEventListener("input", () => {
  // If user is editing/typing manually, cancel countdown
  if (autoSendInterval || speechSilenceTimeout) {
    cancelAutoSendCountdown();
  }
});

// ==========================================
// 1. Browser Native Web Speech API (STT)
// ==========================================
function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn("Browser ini tidak mendukung Web Speech API.");
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = true; // Jangan terputus di tengah kalimat
  recognition.interimResults = true; // Real-time transkripsi
  recognition.lang = "id-ID"; // Deteksi bahasa Indonesia

  recognition.onstart = () => {
    isSttListening = true;
    micBtn.classList.add("recording");
    setStatus("busy", "🎙️ Mendengarkan suara (Web Speech STT)...");
  };

  recognition.onresult = (event) => {
    let transcript = "";
    for (let i = 0; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    promptInput.value = transcript;
    promptInput.scrollTop = promptInput.scrollHeight;

    // Reset dan trigger auto-send timer / instant trigger
    handleSpeechActivity();
  };

  recognition.onspeechend = () => {
    const mode = autoSendDelaySelect ? autoSendDelaySelect.value : "instant";
    if (mode === "instant") {
      if (speechSilenceTimeout) clearTimeout(speechSilenceTimeout);
      const text = promptInput.value.trim();
      if (text && isSttListening) {
        console.log("⚡ Speechend Instan terpicu:", text);
        showToast("⚡ Selesai bicara -> Langsung kirim! 🚀", 1200);
        stopSttListening();
        handleSend();
      }
    }
  };

  recognition.onerror = (err) => {
    console.warn("Speech Recognition Error:", err.error || err);
    if (err.error !== "no-speech") {
      stopSttListening();
    }
  };

  recognition.onend = () => {
    const mode = autoSendDelaySelect ? autoSendDelaySelect.value : "instant";
    if (mode === "instant" && isSttListening) {
      const text = promptInput.value.trim();
      if (text) {
        showToast("⚡ Selesai bicara -> Mengirim...", 1000);
        stopSttListening();
        handleSend();
        return;
      }
    }

    if (isSttListening) {
      // Reconnect continuous listening if still active
      try {
        recognition.start();
      } catch {}
    } else {
      micBtn.classList.remove("recording");
      promptInput.placeholder = "Ketik pesan atau klik mic untuk bicara...";
      setStatus("ready", "Gemini Live Siap");
    }
  };

  return recognition;
}

function startSttListening() {
  getPlaybackContext();
  if (!speechRecognition) {
    speechRecognition = setupSpeechRecognition();
  }
  if (!speechRecognition) {
    alert("Browser Google Chrome kamu mendukung Web Speech API, pastikan izin mikrofon diizinkan!");
    return;
  }
  try {
    cancelAutoSendCountdown();
    promptInput.value = "";
    promptInput.placeholder = "Mendengarkan ucapanmu...";
    speechRecognition.start();
    isSttListening = true;
    micBtn.classList.add("recording");
    setStatus("busy", "🎙️ Mendengarkan suara (Web Speech STT)...");
  } catch (e) {
    console.warn("Gagal start STT:", e);
    stopSttListening();
  }
}

function stopSttListening() {
  isSttListening = false;
  micBtn.classList.remove("recording");
  promptInput.placeholder = "Ketik pesan atau klik mic untuk bicara...";
  if (speechRecognition) {
    try {
      speechRecognition.stop();
    } catch {}
  }
  setStatus("ready", "Gemini Live Siap");
}

// ==========================================
// 2. Double-Clap Gesture Detector (Tepuk Tangan 2x)
// ==========================================
function initClapDetector() {
  if (!clapToggle) return;

  clapToggle.addEventListener("change", async () => {
    if (clapToggle.checked) {
      await startClapListening();
    } else {
      stopClapListening();
    }
  });

  if (clapSensitivitySelect) {
    clapSensitivitySelect.addEventListener("change", () => {
      showToast(
        `Sensitivitas tepukan: ${clapSensitivitySelect.options[clapSensitivitySelect.selectedIndex].text}`,
      );
    });
  }
}

async function startClapListening() {
  try {
    getPlaybackContext();
    clapOptions.style.display = "block";
    clapStatusText.textContent = "Mengakses mic & inisialisasi filter...";

    clapStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });

    clapAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = clapAudioContext.createMediaStreamSource(clapStream);

    // 1. High-Pass Filter: Memotong getaran meja / sub-bass (< 1300 Hz)
    clapHighpass = clapAudioContext.createBiquadFilter();
    clapHighpass.type = "highpass";
    clapHighpass.frequency.value = 1300;
    clapHighpass.Q.value = 0.8;

    // 2. Band-Pass Filter: Mengisolasi frekuensi tajam tepukan tangan (1.8 kHz - 4.5 kHz)
    clapBandpass = clapAudioContext.createBiquadFilter();
    clapBandpass.type = "bandpass";
    clapBandpass.frequency.value = 2600;
    clapBandpass.Q.value = 1.2;

    // 3. FFT Analyser untuk frekuensi tinggi tepukan
    clapAnalyser = clapAudioContext.createAnalyser();
    clapAnalyser.fftSize = 256;
    clapAnalyser.smoothingTimeConstant = 0.1;
    const clapFreqData = new Uint8Array(clapAnalyser.frequencyBinCount);

    // 4. Low-Pass Filter & Analyser untuk memantau ketukan meja (< 750 Hz)
    tableFilter = clapAudioContext.createBiquadFilter();
    tableFilter.type = "lowpass";
    tableFilter.frequency.value = 750;
    tableAnalyser = clapAudioContext.createAnalyser();
    tableAnalyser.fftSize = 256;
    const tableFreqData = new Uint8Array(tableAnalyser.frequencyBinCount);

    // 5. ScriptProcessor untuk analisis waktu & gelombang
    clapProcessor = clapAudioContext.createScriptProcessor(1024, 1, 1);

    // 6. Mute Gain agar mic tidak feedback/keluar ke speaker
    muteGain = clapAudioContext.createGain();
    muteGain.gain.value = 0;

    // Rangkaian Audio Graph:
    // Jalur A (Deteksi Meja): source -> tableFilter -> tableAnalyser
    source.connect(tableFilter);
    tableFilter.connect(tableAnalyser);

    // Jalur B (Deteksi Tepukan): source -> highpass -> bandpass -> clapAnalyser -> processor -> mute -> destination
    source.connect(clapHighpass);
    clapHighpass.connect(clapBandpass);
    clapBandpass.connect(clapAnalyser);
    clapAnalyser.connect(clapProcessor);
    clapProcessor.connect(muteGain);
    muteGain.connect(clapAudioContext.destination);

    clapProcessor.onaudioprocess = (e) => {
      const now = Date.now();
      if (now < clapCooldownUntil) return;

      const input = e.inputBuffer.getChannelData(0);
      let peak = 0;
      let sumSq = 0;

      for (let i = 0; i < input.length; i++) {
        const absVal = Math.abs(input[i]);
        if (absVal > peak) peak = absVal;
        sumSq += absVal * absVal;
      }

      const rms = Math.sqrt(sumSq / input.length);
      const crestFactor = peak / (rms + 0.0001);

      // Baca spektrum frekuensi
      tableAnalyser.getByteFrequencyData(tableFreqData);
      clapAnalyser.getByteFrequencyData(clapFreqData);

      // Hitung energi frekuensi rendah (Ketukan meja: 0 - 700 Hz)
      let tableSum = 0;
      for (let i = 0; i < 8; i++) {
        tableSum += tableFreqData[i];
      }
      const tableEnergy = tableSum / 8;

      // Hitung energi frekuensi tinggi (Tepukan tangan: 1.8 kHz - 4.5 kHz)
      let clapSum = 0;
      for (let i = 10; i < 26; i++) {
        clapSum += clapFreqData[i];
      }
      const clapEnergy = clapSum / 16;

      // 🛡️ REJECT KETUKAN MEJA:
      // Ketukan meja memiliki energi bass/low dominan (> 65) dan energi tepukan rendah.
      if (tableEnergy > 60 && tableEnergy > clapEnergy * 1.5) {
        if (clapStatusText.textContent !== "🛡️ Ketukan meja diabaikan") {
          clapStatusText.textContent = "🛡️ Ketukan meja diabaikan";
          setTimeout(() => {
            if (clapToggle.checked && clapCount === 0) {
              clapStatusText.textContent = "👂 Siap mendengarkan tepukan...";
            }
          }, 600);
        }
        return; // ABAIKAN KETUKAN MEJA!
      }

      // Ambang batas sensitivitas tepukan tangan
      const sens = clapSensitivitySelect ? clapSensitivitySelect.value : "medium";
      let peakThresh = 0.2;
      let crestThresh = 2.2;
      let minClapEnergy = 60;

      if (sens === "low") {
        peakThresh = 0.34;
        crestThresh = 2.6;
        minClapEnergy = 90;
      } else if (sens === "high") {
        peakThresh = 0.12;
        crestThresh = 1.8;
        minClapEnergy = 35;
      }

      // Kriteria Tepukan Tangan Valid
      const isClap =
        peak >= peakThresh && crestFactor >= crestThresh && clapEnergy >= minClapEnergy;

      if (isClap) {
        // Debounce dalam 140ms (abaikan pantulan akustik dari tepukan yang sama)
        if (clapCount === 1 && now - firstClapTime < 140) {
          return;
        }

        if (clapCount === 0) {
          // Tepukan Pertama
          clapCount = 1;
          firstClapTime = now;
          playChime("clap_first");
          clapStatusText.textContent = "👏 1x Tepukan... tepuk sekali lagi!";
          showToast("👏 1x Tepuk... (Tepuk 1x lagi!)", 1000);

          if (clapResetTimeout) clearTimeout(clapResetTimeout);
          clapResetTimeout = setTimeout(() => {
            clapCount = 0;
            if (clapToggle.checked) {
              clapStatusText.textContent = "👂 Siap mendengarkan tepukan...";
            }
          }, 850);
        } else if (clapCount === 1) {
          // Tepukan Kedua dalam rentang 140ms s/d 850ms
          if (now - firstClapTime >= 140 && now - firstClapTime <= 850) {
            if (clapResetTimeout) clearTimeout(clapResetTimeout);
            clapCount = 0;
            clapCooldownUntil = now + 900; // Cooldown agar tidak langsung terpicu ulang
            clapStatusText.textContent = "🎉 2x Tepukan Diterima!";

            setTimeout(() => {
              if (clapToggle.checked) {
                clapStatusText.textContent = "👂 Siap mendengarkan tepukan...";
              }
            }, 1200);

            // Eksekusi aksi Hands-Free!
            if (isSttListening || isLiveCallActive) {
              // Jika sedang mendengar -> Tepuk 2x untuk KIRIM LANGSUNG!
              playChime("mic_send");
              showToast("👏 👏 Tepuk 2x: Mengirim ke Gemini Live! 🚀");
              cancelAutoSendCountdown();

              if (isSttListening) {
                stopSttListening();
                const text = promptInput.value.trim();
                if (text) {
                  handleSend();
                }
              } else if (isLiveCallActive) {
                stopLiveMicStreaming();
              }
            } else {
              // Jika sedang diam -> Tepuk 2x untuk MULAI BICARA!
              playChime("mic_start");
              showToast("👏 👏 Tepuk 2x: Mikrofon Aktif! Silakan bicara... 🎙️");
              handleMicToggle();
            }
          }
        }
      }
    };

    clapStatusText.textContent = "👂 Siap mendengarkan tepukan...";
    showToast("👏 Deteksi Tepuk Tangan Aktif (Filter meja aktif)!");
  } catch (err) {
    console.error("Clap detector error:", err);
    clapToggle.checked = false;
    clapOptions.style.display = "none";
    clapStatusText.textContent = "Gagal mengakses mic";
    alert("Gagal mengaktifkan deteksi tepuk tangan: " + err.message);
  }
}

function stopClapListening() {
  clapOptions.style.display = "none";
  clapStatusText.textContent = "Nonaktif";
  if (clapResetTimeout) clearTimeout(clapResetTimeout);
  clapCount = 0;

  if (clapProcessor) {
    try {
      clapProcessor.disconnect();
    } catch {}
    clapProcessor = null;
  }
  if (clapHighpass) {
    try {
      clapHighpass.disconnect();
    } catch {}
    clapHighpass = null;
  }
  if (clapBandpass) {
    try {
      clapBandpass.disconnect();
    } catch {}
    clapBandpass = null;
  }
  if (clapAnalyser) {
    try {
      clapAnalyser.disconnect();
    } catch {}
    clapAnalyser = null;
  }
  if (tableFilter) {
    try {
      tableFilter.disconnect();
    } catch {}
    tableFilter = null;
  }
  if (tableAnalyser) {
    try {
      tableAnalyser.disconnect();
    } catch {}
    tableAnalyser = null;
  }
  if (muteGain) {
    try {
      muteGain.disconnect();
    } catch {}
    muteGain = null;
  }
  if (clapAudioContext) {
    try {
      clapAudioContext.close();
    } catch {}
    clapAudioContext = null;
  }
  if (clapStream) {
    clapStream.getTracks().forEach((t) => t.stop());
    clapStream = null;
  }
  showToast("Deteksi tepuk tangan dinonaktifkan.");
}

// ==========================================
// 3. Raw PCM Microphone Streaming (Audio-to-Audio)
// ==========================================
async function startLiveMicStreaming() {
  try {
    getPlaybackContext();
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    inputAudioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 16000,
    });
    const source = inputAudioContext.createMediaStreamSource(micStream);
    micProcessor = inputAudioContext.createScriptProcessor(2048, 1, 1);

    micProcessor.onaudioprocess = (e) => {
      if (!isLiveCallActive || !liveWebSocket || liveWebSocket.readyState !== WebSocket.OPEN)
        return;

      const input = e.inputBuffer.getChannelData(0);
      const pcm16 = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      let binary = "";
      const bytes = new Uint8Array(pcm16.buffer);
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      liveWebSocket.send(
        JSON.stringify({
          realtimeInput: {
            mediaChunks: [
              {
                mimeType: "audio/pcm;rate=16000",
                data: base64,
              },
            ],
          },
        }),
      );
    };

    source.connect(micProcessor);
    micProcessor.connect(inputAudioContext.destination);

    isLiveCallActive = true;
    micBtn.classList.add("recording");
    setStatus("busy", "🎙️ Mic Aktif (PCM Live Streaming)...");
    appendSystemMessage("🎙️ Sesi Suara Langsung (Raw PCM) Aktif! Langsung bicara apa saja...");
  } catch (err) {
    console.error("Mic access error:", err);
    alert("Gagal mengakses mikrofon: " + err.message);
    stopLiveMicStreaming();
  }
}

function stopLiveMicStreaming() {
  isLiveCallActive = false;
  micBtn.classList.remove("recording");
  if (micProcessor) {
    try {
      micProcessor.disconnect();
    } catch {}
    micProcessor = null;
  }
  if (inputAudioContext) {
    try {
      inputAudioContext.close();
    } catch {}
    inputAudioContext = null;
  }
  if (micStream) {
    micStream.getTracks().forEach((t) => t.stop());
    micStream = null;
  }
  setStatus("ready", "Gemini Live Siap");
}

// Toggle Mic handler according to selected mode
function handleMicToggle() {
  getPlaybackContext();
  const micMode = micModeSelect ? micModeSelect.value : "stt";

  if (micMode === "stt") {
    // Mode Browser Web Speech STT
    if (isLiveCallActive) stopLiveMicStreaming();
    if (isSttListening) {
      stopSttListening();
      const text = promptInput.value.trim();
      if (text) {
        startAutoSendCountdown();
      }
    } else {
      startSttListening();
    }
  } else {
    // Mode Raw PCM Streaming
    if (isSttListening) stopSttListening();
    if (isLiveCallActive) {
      stopLiveMicStreaming();
    } else {
      startLiveMicStreaming();
    }
  }
}

// Initialize Application
async function init() {
  speechRecognition = setupSpeechRecognition();
  initClapDetector();

  try {
    const res = await fetch("/api/config");
    const data = await res.json();
    if (data.hasKey) {
      keyText.textContent = data.maskedKey;
      setStatus("ready", "Gemini Connected");
      connectBidiWebSocket();
    } else {
      keyText.textContent = "No API Key";
      setStatus("error", "API Key Missing");
    }
  } catch (err) {
    keyText.textContent = "Error";
    setStatus("error", "Server Disconnected");
  }

  initVisualizer();

  document.body.addEventListener(
    "click",
    () => {
      getPlaybackContext();
    },
    { once: false },
  );
}

function setStatus(type, text) {
  statusText.textContent = text;
  statStatus.textContent = text;
  const dot = statusBadge.querySelector(".status-dot");
  if (type === "ready") {
    dot.style.background = "#3fb950";
    dot.style.boxShadow = "0 0 8px #3fb950";
  } else if (type === "busy") {
    dot.style.background = "#d29922";
    dot.style.boxShadow = "0 0 8px #d29922";
  } else {
    dot.style.background = "#f85149";
    dot.style.boxShadow = "0 0 8px #f85149";
  }
}

// Mode Selection
modeStreamBtn.addEventListener("click", () => {
  currentMode = "stream";
  modeStreamBtn.classList.add("active");
  modeBidiBtn.classList.remove("active");
  if (liveWebSocket) {
    liveWebSocket.close();
    liveWebSocket = null;
  }
  if (isLiveCallActive) stopLiveMicStreaming();
  if (isSttListening) stopSttListening();
  cancelAutoSendCountdown();
  setStatus("ready", "Live Stream Mode (SSE)");
  appendSystemMessage("⚡ Mode diubah ke Live Streaming (Text Token Stream).");
});

modeBidiBtn.addEventListener("click", () => {
  currentMode = "bidi";
  modeBidiBtn.classList.add("active");
  modeStreamBtn.classList.remove("active");
  connectBidiWebSocket();
});

modelSelect.addEventListener("change", () => {
  if (currentMode === "bidi") connectBidiWebSocket();
});

voiceSelect.addEventListener("change", () => {
  if (currentMode === "bidi") connectBidiWebSocket();
});

if (micModeSelect) {
  micModeSelect.addEventListener("change", () => {
    if (isSttListening) stopSttListening();
    if (isLiveCallActive) stopLiveMicStreaming();
    cancelAutoSendCountdown();
    if (micModeSelect.value === "stt") {
      appendSystemMessage(
        "🌐 Menggunakan mode Browser STT (Web Speech API). Suara akan diubah ke teks otomatis.",
      );
    } else {
      appendSystemMessage(
        "🎙️ Menggunakan mode Raw PCM Streaming (Audio-in langsung ke Gemini Live).",
      );
    }
  });
}

// WebSocket Connection Management
let isSetupComplete = false;

function connectBidiWebSocket() {
  if (liveWebSocket) {
    try {
      liveWebSocket.close();
    } catch {}
    liveWebSocket = null;
  }
  isSetupComplete = false;

  setStatus("busy", "Menghubungkan WS...");
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}/ws/live`;

  liveWebSocket = new WebSocket(wsUrl);

  liveWebSocket.onopen = () => {
    setStatus("busy", "Handshake Gemini...");
    const selectedModel = modelSelect.value;
    const cleanModel = selectedModel.startsWith("models/")
      ? selectedModel
      : `models/${selectedModel}`;
    const isTranscribe = cleanModel.includes("transcribe");
    const isThinking = cleanModel.includes("extended-thinking");

    const genConfig = {
      responseModalities: isTranscribe ? ["TEXT"] : ["AUDIO"],
    };

    if (!isTranscribe) {
      genConfig.speechConfig = {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voiceSelect.value || "Aoede",
          },
        },
      };
    }

    if (isThinking) {
      genConfig.thinkingConfig = { thinkingLevel: 1 };
    }

    const setupMsg = {
      setup: {
        model: cleanModel,
        generationConfig: genConfig,
        tools: [
          {
            functionDeclarations: [
              {
                name: "activate_window",
                description:
                  "Mengaktifkan atau membuka window tampilan analisis teknik seperti SFD (Shear Force Diagram) dan BMD (Bending Moment Diagram).",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    target: {
                      type: "STRING",
                      description: "Nama window yang ingin diaktifkan, misalnya 'SFD_BMD'.",
                    },
                  },
                  required: ["target"],
                },
              },
              {
                name: "close_window",
                description: "Menutup window atau modal tampilan yang sedang terbuka di layar.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    target: {
                      type: "STRING",
                      description: "Nama window yang ingin ditutup, misalnya 'SFD_BMD'.",
                    },
                  },
                  required: ["target"],
                },
              },
            ],
          },
        ],
        systemInstruction: {
          parts: [
            {
              text:
                systemPrompt.value +
                " Kamu memiliki tool 'activate_window' untuk mengaktifkan window SFD dan BMD. Jika user meminta mengaktifkan atau membuka window SFD dan BMD, panggil fungsi activate_window dengan target 'SFD_BMD'. Jika user meminta menutupnya, panggil close_window dengan target 'SFD_BMD'.",
            },
          ],
        },
      },
    };

    liveWebSocket.send(JSON.stringify(setupMsg));
    appendSystemMessage(
      `🔌 Menghubungkan ke ${cleanModel} (Voice: ${voiceSelect.value || "Aoede"})...`,
    );
  };

  liveWebSocket.onmessage = async (event) => {
    try {
      let rawText = "";
      if (typeof event.data === "string") {
        rawText = event.data;
      } else if (event.data instanceof Blob) {
        rawText = await event.data.text();
      } else if (event.data instanceof ArrayBuffer) {
        rawText = new TextDecoder("utf-8").decode(event.data);
      }

      const data = JSON.parse(rawText);

      if (data.setupComplete) {
        isSetupComplete = true;
        setStatus("ready", "Gemini Live Siap");
        appendSystemMessage(
          "✅ Gemini Live Siap! Bicara via mic, gunakan timer otomatis, atau tepuk tangan 2x 👏",
        );

        while (pendingSendQueue.length > 0) {
          const msg = pendingSendQueue.shift();
          liveWebSocket.send(JSON.stringify(msg));
        }
      }

      if (data.serverContent) {
        const parts = data.serverContent.modelTurn?.parts;
        if (parts) {
          for (const p of parts) {
            // Audio Stream Chunk (PCM 24kHz)
            if (p.inlineData && p.inlineData.data) {
              totalAudioChunks++;
              totalAudioBytes += Math.round((p.inlineData.data.length * 3) / 4);
              statChunks.textContent = `${totalAudioChunks}`;
              statBytes.textContent = `${(totalAudioBytes / 1024).toFixed(1)} KB`;

              updateLiveAudioBubble(totalAudioChunks, totalAudioBytes);
              playPcmChunk(p.inlineData.data);
            }
            // Transcript Text Chunk
            if (p.text) {
              appendGeminiTextChunk(p.text);
            }
          }
        }

        if (data.serverContent.turnComplete) {
          activeLiveBubble = null;
          setStatus("ready", "Gemini Live Siap");
          sendBtn.disabled = false;
        }
      }

      // Handle Gemini Live Tool Calls (Function Calling)
      if (data.toolCall && data.toolCall.functionCalls) {
        for (const call of data.toolCall.functionCalls) {
          console.log("🎯 Tool Call dari Gemini Live:", call.name, call.args);
          let toolOutput = { status: "success" };

          if (call.name === "activate_window") {
            openSfdBmdWindow();
            appendSystemMessage(`⚙️ Tool Use: Membuka window ${call.args?.target || "SFD_BMD"}`);
            toolOutput = {
              status: "success",
              window: call.args?.target || "SFD_BMD",
              message: "Window SFD dan BMD telah berhasil diaktifkan dan tampil di layar pengguna.",
            };
          } else if (call.name === "close_window") {
            closeSfdBmdWindow();
            appendSystemMessage("⚙️ Tool Use: Menutup window SFD & BMD");
            toolOutput = {
              status: "success",
              message: "Window telah berhasil ditutup.",
            };
          }

          // Kirim respons balik ke Gemini Live agar Gemini merespons dengan suara
          liveWebSocket.send(
            JSON.stringify({
              toolResponse: {
                functionResponses: [
                  {
                    id: call.id,
                    response: { output: toolOutput },
                  },
                ],
              },
            }),
          );
        }
      }

      if (data.type === "gemini_error") {
        setStatus("error", "Error Gemini WS");
        appendSystemMessage(`❌ Error: ${data.error}`);
        sendBtn.disabled = false;
      }

      if (data.type === "gemini_closed") {
        setStatus("error", `WS Closed (${data.code})`);
        appendSystemMessage(
          `ℹ️ Gemini Live WebSocket ditutup: "${data.reason || "Code " + data.code}"`,
        );
        sendBtn.disabled = false;
      }
    } catch (e) {
      console.log("Raw WS message error:", e);
    }
  };

  liveWebSocket.onerror = () => {
    setStatus("error", "Live WS Error");
    sendBtn.disabled = false;
  };

  liveWebSocket.onclose = () => {
    setStatus("busy", "Live WS Closed");
    isSetupComplete = false;
    sendBtn.disabled = false;
  };
}

// Send Message Handler
let sendStartTime = 0;
async function handleSend() {
  cancelAutoSendCountdown();

  const text = promptInput.value.trim();
  if (!text) return;

  getPlaybackContext();

  promptInput.value = "";
  sendBtn.disabled = true;
  sendStartTime = Date.now();

  appendUserMessage(text);

  // Predefined Keyword Interceptor (Instant local UI trigger fallback)
  const lowerText = text.toLowerCase();
  if (
    (lowerText.includes("aktifkan") ||
      lowerText.includes("buka") ||
      lowerText.includes("tampilkan") ||
      lowerText.includes("munculkan")) &&
    (lowerText.includes("sfd") || lowerText.includes("bmd"))
  ) {
    openSfdBmdWindow();
  } else if (
    lowerText.includes("tutup") &&
    (lowerText.includes("sfd") || lowerText.includes("bmd") || lowerText.includes("window"))
  ) {
    closeSfdBmdWindow();
  }

  if (currentMode === "stream") {
    // Standard SSE text stream
    setStatus("busy", "Streaming text...");
    const geminiMsg = appendGeminiMessagePlaceholder("✨");
    let firstToken = 0;

    try {
      const res = await fetch("/api/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          model: modelSelect.value,
          systemPrompt: systemPrompt.value,
        }),
      });

      if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let fullResponse = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.substring(6).trim();
            if (dataStr === "[DONE]") break;

            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.text) {
                if (!firstToken) {
                  firstToken = Date.now() - sendStartTime;
                  statLatency.textContent = `${firstToken}ms`;
                }
                fullResponse += parsed.text;
                geminiMsg.textContent = fullResponse;
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
              }
            } catch {}
          }
        }
      }

      const totalTime = Date.now() - sendStartTime;
      statLatency.textContent = `${totalTime}ms`;
      setStatus("ready", "Ready");
    } catch (err) {
      geminiMsg.textContent = `❌ Terjadi kesalahan: ${err.message}`;
      setStatus("error", "Error streaming");
    } finally {
      sendBtn.disabled = false;
      promptInput.focus();
    }
  } else {
    // Gemini Live Bidi Mode: Native Voice Response
    setStatus("busy", "Gemini Menjawab...");
    createLiveAudioPlaceholder();

    const clientMsg = {
      clientContent: {
        turns: [
          {
            role: "user",
            parts: [{ text }],
          },
        ],
        turnComplete: true,
      },
    };

    if (liveWebSocket && liveWebSocket.readyState === WebSocket.OPEN && isSetupComplete) {
      liveWebSocket.send(JSON.stringify(clientMsg));
    } else {
      console.log("Socket not open or setup not complete, queuing message...");
      pendingSendQueue.push(clientMsg);
      if (!liveWebSocket || liveWebSocket.readyState === WebSocket.CLOSED) {
        connectBidiWebSocket();
      }
    }
  }
}

// UI Bubble Helpers
function appendUserMessage(text) {
  const row = document.createElement("div");
  row.className = "message-row user";
  row.innerHTML = `
    <div class="message-content">${escapeHtml(text)}</div>
    <div class="message-avatar">👤</div>
  `;
  messagesContainer.appendChild(row);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

let activeLiveBubble = null;
function createLiveAudioPlaceholder() {
  const row = document.createElement("div");
  row.className = "message-row gemini";
  row.innerHTML = `
    <div class="message-avatar">🎙️</div>
    <div class="message-content live-audio-bubble">
      <div class="audio-pulse-indicator">
        <span class="sound-wave-icon" style="font-size:18px;">🔊</span>
        <span class="live-status-text" style="font-weight:600; color:#58a6ff;">Menunggu streaming suara balasan...</span>
      </div>
      <div class="live-transcript" style="display:none; margin-top:8px; font-size:13px; color:#c9d1d9;"></div>
    </div>
  `;
  messagesContainer.appendChild(row);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  activeLiveBubble = row.querySelector(".message-content");
  return activeLiveBubble;
}

function updateLiveAudioBubble(chunks, bytes) {
  if (!activeLiveBubble) {
    createLiveAudioPlaceholder();
  }
  const statusText = activeLiveBubble.querySelector(".live-status-text");
  if (statusText) {
    statusText.style.color = "#3fb950";
    statusText.textContent = `Memutar Suara Native Gemini Live (Chunk #${chunks} • ${(bytes / 1024).toFixed(0)} KB PCM 24kHz)`;
  }
}

function appendGeminiTextChunk(chunk) {
  if (!activeLiveBubble) {
    createLiveAudioPlaceholder();
  }
  const transcriptDiv = activeLiveBubble.querySelector(".live-transcript");
  if (transcriptDiv) {
    transcriptDiv.style.display = "block";
    transcriptDiv.textContent += chunk;
  }
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function appendGeminiMessagePlaceholder(avatar = "✨") {
  const row = document.createElement("div");
  row.className = "message-row gemini";
  row.innerHTML = `
    <div class="message-avatar">${avatar}</div>
    <div class="message-content">...</div>
  `;
  messagesContainer.appendChild(row);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  return row.querySelector(".message-content");
}

function appendSystemMessage(text) {
  const div = document.createElement("div");
  div.style.textAlign = "center";
  div.style.fontSize = "12px";
  div.style.color = "#8b949e";
  div.style.margin = "8px 0";
  div.textContent = text;
  messagesContainer.appendChild(div);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Microphone Button Toggle: Start / Stop Live Call or STT
micBtn.addEventListener("click", () => {
  handleMicToggle();
});

// Canvas Audio Visualizer
let animId = null;
function initVisualizer() {
  let step = 0;
  function draw() {
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    const count = 40;
    const barWidth = canvas.width / count;
    const isPlayingAudio = playbackContext && nextPlayTime > playbackContext.currentTime;
    const isMicActive = isLiveCallActive || isSttListening;

    for (let i = 0; i < count; i++) {
      const activeMultiplier = isMicActive ? 1.8 : isPlayingAudio ? 1.4 : 0.3;
      const height =
        Math.sin(step + i * 0.25) * 12 * activeMultiplier +
        (isMicActive || isPlayingAudio ? 12 : 3);
      const y = (canvas.height - height) / 2;

      if (isMicActive) {
        canvasCtx.fillStyle = `hsl(${10 + i * 5}, 90%, 60%)`;
      } else if (isPlayingAudio) {
        canvasCtx.fillStyle = `hsl(${140 + i * 4}, 85%, 55%)`;
      } else {
        canvasCtx.fillStyle = `rgba(56, 139, 253, ${0.2 + (i % 2) * 0.2})`;
      }

      canvasCtx.fillRect(i * barWidth, y, barWidth - 4, Math.max(height, 2));
    }
    step += isMicActive || isPlayingAudio ? 0.15 : 0.05;
    animId = requestAnimationFrame(draw);
  }
  draw();
}

// Event Listeners
sendBtn.addEventListener("click", () => {
  getPlaybackContext();
  handleSend();
});

promptInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    getPlaybackContext();
    handleSend();
  }
});

clearChatBtn.addEventListener("click", () => {
  cancelAutoSendCountdown();
  totalAudioChunks = 0;
  totalAudioBytes = 0;
  statChunks.textContent = "0";
  statBytes.textContent = "0 KB";
  statLatency.textContent = "-";
  messagesContainer.innerHTML = `
    <div class="welcome-card">
      <div class="welcome-icon">🎙️</div>
      <h2>Percakapan Dibersihkan</h2>
      <p>Klik tombol mic untuk mulai ngobrol secara live, ketik pesan, atau tepuk tangan 2x 👏</p>
    </div>
  `;
});

// Quick Tags
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("tag-btn")) {
    getPlaybackContext();
    promptInput.value = e.target.getAttribute("data-prompt");
    handleSend();
  }
});

// Start
init();
