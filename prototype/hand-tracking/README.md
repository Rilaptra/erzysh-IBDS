# 🏗️ Multimodal Hand Tracking & Structural Simulator (Bun + TypeScript)

Aplikasi pengujian performa dan fitur interaksi multimodal **Hand Tracking (MediaPipe) + Voice Command (Web Speech API)** serta **Interactive Structural Mechanics Simulator (SNI 2847 / SNI 1729)** menggunakan runtime **Bun** dan **TypeScript** dalam mode hemat daya (_Eco Mode_).

Mendukung model Vision resmi Google MediaPipe & Standar Rekayasa Struktur:

- 🖐️ **Google MediaPipe HandLandmarker** (`hand_landmarker.task` float16 - GPU Delegate): Deteksi 21 titik sendi tangan (_landmarks_) secara real-time pada aspect ratio native 4:3.
- 🎤 **Web Speech API (`id-ID`)**: Pengenalan suara bahasa Indonesia dengan _Intent Router_ cerdas untuk kontrol simulator secara hands-free.
- 🧱 **SNI 2847 (Beton Bertulang)**: Desain lentur balok beton otomatis ($b \times h$), konfigurasi tulangan tarik longitudinal D19, dan sengkang geser.
- 🔩 **SNI 1729 (Baja Struktural)**: Optimasi penampang profil IWF & Hollow BOX dengan pencarian biner $O(\log N)$ berdasarkan rasio kapasitas DCR ($M_u / \phi M_n$).
- 📐 **Euler-Bernoulli Numerical Solver (61 Nodes)**: Perhitungan instan BMD (_Bending Moment Diagram_), SFD (_Shear Force Diagram_), dan lendutan elastis ($\Delta_{max}$ vs $L/360$).

---

## 🚀 Fitur Utama

1. **🖐️ 5 Gestur Dasar Nirsentuh (_Knuckle-Anchored Tracking_)**
   - 🖐️ **Palm (`◎` Open Palm)**: Navigasi kursor virtual bebas di layar.
   - 🤏 **Pinch (`⌖` Click Locked)**: Klik tombol UI secara presisi tanpa sentuhan. Dilengkapi algoritma _knuckle-anchored_ (sendi MCP 5 & 9) dan zona _pre-pinch freeze_ sehingga kursor **tidak turun/anjlok** (_zero pinch-dip_) saat jari menjepit.
   - ✊ **Fist (`▼` Real-Time Load)**: Mengatur posisi ($x$) dan besaran beban terpusat ($P_u$) secara langsung di atas balok secara interaktif.
   - ☝️ **Point (`▸` Precision Snap)**: Mengunci kursor pada node kurva balok terdekat untuk menginspeksi nilai eksak lendutan ($\Delta$), momen ($M$), dan gaya lintang ($V$).
   - ✌️ **Two-Finger (`▣` Grab Window)**: Menggeser dan memindahkan jendela melayang (_floating window_) di atas kanvas simulator.

2. **🎤 Multimodal Voice Command (_Hands-Free Intent Router_)**
   - Transkrip suara bahasa Indonesia langsung dipetakan ke aksi struktural:
     - _"Beton"_ / _"Concrete"_ ➔ Beralih ke material Beton Bertulang (SNI 2847).
     - _"Baja"_ / _"Steel"_ ➔ Beralih ke material Baja Struktural (SNI 1729).
     - _"IWF"_ / _"BOX"_ ➔ Filter profil baja yang digunakan.
     - _"Momen"_ / _"BMD"_ ➔ Tampilkan/sembunyikan diagram momen lentur.
     - _"Geser"_ / _"Lintang"_ / _"SFD"_ ➔ Tampilkan/sembunyikan diagram gaya geser.
     - _"Optimasi"_ / _"Ekonomis"_ ➔ Toggle optimizer penampang otomatis.
     - _"Gestur"_ / _"Kamera"_ / _"Beban"_ ➔ Buka/tutup jendela pengaturan.

3. **⚡ Real-Time SAP2000 Stress Contour Visualizer**
   - Kontur warna tegangan balok dinamis (_Single-Draw-Call Gradient_: biru $\to$ hijau $\to$ kuning $\to$ merah) berdasarkan rasio lendutan terhadap batas izin $L/360$.
   - Indikator kapasitas beban DCR dengan status keamanan langsung (_SAFE · SNI OK_ vs _OVERSTRESSED_).

4. **🌿 Eco-Mode Thermal Optimizer (< 45°C)**
   - **Eco 16 FPS Throttler**: Inferensi MediaPipe dibatasi setiap 62ms (16 FPS) pada resolusi video 240×180 (4:3) untuk menjaga CPU & GPU laptop tetap dingin dan hemat daya.
   - **Zero Idle Redraw**: Kanvas hanya dirender ulang saat state berubah (_dirty-flag_), menghemat siklus GPU hingga 0% saat diam.
   - **Bebas CSS Heavy Shaders**: Menghilangkan `backdrop-filter: blur()` untuk menghindari _Gaussian shader overhead_ 60Hz.

---

## 🛠️ Cara Menjalankan

```powershell
cd prototype/hand-tracking

# Jalankan Web Simulator (http://localhost:3000)
bun run server.ts
```

> **Catatan**: Server Bun akan secara otomatis melakukan bundling `engine.ts` ke browser bundle dan menyajikan aplikasi di `http://localhost:3000`.

---

## ⌨️ Debugging & Fallback Keyboard (Mode Tanpa Kamera)

Saat webcam tidak aktif atau sedang diuji di lingkungan terbatas, simulator dapat dikontrol penuh menggunakan mouse dan tombol keyboard:

| Tombol | Gestur Virtual          | Fungsi                                      |
| ------ | ----------------------- | ------------------------------------------- |
| `1`    | 🖐️ **Palm (`◎`)**       | Mode kursor pointer biasa                   |
| `2`    | 🤏 **Pinch (`⌖`)**      | Mode klik tombol / interaksi                |
| `3`    | ✊ **Fist (`▼`)**       | Mode tarik beban terpusat ($P_u$)           |
| `4`    | ☝️ **Point (`▸`)**      | Mode inspeksi nilai node balok              |
| `5`    | ✌️ **Two-Finger (`▣`)** | Mode seret jendela melayang (_drag window_) |

---

## 🌐 Kebutuhan Lingkungan & Dependensi

- **Runtime**: [Bun](https://bun.sh) (v1.1+ / v1.4+)
- **Model Vision**: Google MediaPipe Tasks Vision (`@mediapipe/tasks-vision@0.10.14`) dimuat otomatis secara _on-demand_ via CDN saat tombol kamera ditekan.
- **Port Server**: `3000` (dapat diakses via browser modern seperti Google Chrome atau Microsoft Edge dengan dukungan Web Speech API dan WebRTC).
