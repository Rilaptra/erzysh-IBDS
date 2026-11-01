# 🌟 Gemini Live API Playground (Bun + TypeScript)

Aplikasi pengujian performa dan fitur **Google Gemini Live API** menggunakan runtime **Bun** dan **TypeScript**.

Mendukung model **Live API** resmi Google AI Studio:

- 🎙️ **Gemini 3.8 Live** (`models/gemini-3.8-live`): Model flagship real-time low-latency dengan audio dua arah (24kHz PCM).
- 🧠 **Gemini 3.8 Live Extended Thinking** (`models/gemini-3.8-live-extended-thinking`): Model Live dengan penalaran mendalam dan thinking level.
- 🗣️ **Gemini 2.5 Flash Native Audio Dialog** (`models/gemini-2.5-flash-native-audio-preview-12-2025`): Model dialog suara native.
- 📝 **Gemini 3.5 Transcribe Live** (`models/gemini-3.5-transcribe-live`): Model transkripsi real-time berlatensi sangat rendah.

---

## 🚀 Fitur Utama

1. **🎙️ Native Audio 24kHz Streaming via WebSocket (`BidiGenerateContent`)**
   - Terhubung langsung ke endpoint WebSocket Live API Google.
   - Pemutaran audio streaming PCM 24kHz 16-bit secara seamless dan jernih menggunakan Web Audio API.
   - Pilihan voice persona: _Aoede, Puck, Charon, Kore, Fenrir_.

2. **⚡ Real-time Canvas Visualizer**
   - Visualisasi gelombang audio responsif saat pengguna berbicara atau saat model membalas.

3. **💬 Input Suara Mikrofon & Teks**
   - Bicara langsung via mic browser menggunakan Web Speech API atau ketik prompt teks.

---

## 🛠️ Cara Menjalankan

```powershell
cd C:\Users\user\.gemini\antigravity\scratch\gemini-live-test

# 1. Jalankan Web Playground (http://localhost:3000)
bun run start

# 2. Jalankan Smoke Test Otomatis untuk Semua Model Live
bun run test-live
```

---

## 🔑 Konfigurasi API Key

Tersimpan otomatis di [.env](.env):

```env
GEMINI_API_KEY=AQ.Ab8RN6L-NaEOGB3nfkRzZocVSOhPan56BjTz-ZXarHzf_8ZVig
PORT=3000
```
