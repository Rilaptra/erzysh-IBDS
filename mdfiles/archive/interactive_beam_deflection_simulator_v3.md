<div align="center">

# 🏗️ Interactive Beam Deflection & Structural Design Simulator

**Simulasi defleksi balok & optimasi desain penampang (Beton Bertulang & Profil Baja IWF/BOX) akibat beban eksternal maupun gaya dalam — dikendalikan lewat gerakan tangan, mouse, dan suara secara _real-time_.**
</div>

---

## 📖 Gambaran Umum

> [!IMPORTANT]
> **Interactive Beam Deflection & Structural Design Simulator** adalah aplikasi rekayasa struktur interaktif yang menyimulasikan **defleksi balok**, **diagram gaya dalam**, serta **optimasi desain penampang Balok Beton Bertulang dan Balok Profil Baja (IWF & BOX)**. Aplikasi ini mendukung **dua mode input pembebanan** — melalui **beban eksternal & berat sendiri (_self-weight_)** secara _real-time_ maupun **input langsung gaya dalam hasil analisis struktur ($P_u, M\_{ux}, M\_{uy}, T_u$)** — serta dapat dikendalikan melalui **gerakan tangan (_motion capture_)**, **mouse/kursor**, dan **perintah suara** yang diterjemahkan oleh **AI assistant**.

> [!NOTE]
> 📌 Dokumen ini bersifat _**living document**_ — rancangan disusun mengikuti alur pengembangan _software_ teknik sipil berbasis AI (mulai dari analisis kebutuhan, spesifikasi input-output terukur, standar desain, hingga rencana pengujian dan dokumentasi GitHub).

---

## ✨ Fitur Utama

### `1` · Pemilihan Material & Mode Input Pembebanan Ganda

Fleksibilitas penuh pada tahap awal permodelan balok:

- **Pilihan Material Balok:**
  - 🧱 **Balok Beton Bertulang (_Reinforced Concrete_)** — desain dimensi dan penulangan berdasarkan standar beton struktural.
  - 🔩 **Balok Profil Baja (_Structural Steel_)** — pemilihan dan optimasi profil **IWF (_Wide Flange_)** maupun **BOX (_Hollow Structural Section_)**.
- **Pilihan Mode Input Pembebanan:**
  - **Mode A — Gaya Eksternal (_External Load Mode_):** Input panjang bentang ($L$), kondisi tumpuan, beban titik ($P$), beban merata ($q$), momen eksternal, serta perhitungan otomatis berat sendiri (_self-weight_). Mendukung interaksi beban _real-time_ menggunakan kursor maupun gestur tangan.
  - **Mode B — Gaya Dalam Langsung (_Direct Internal Forces Mode_):** Input langsung hasil perhitungan gaya dalam terfaktor dari analisis struktur tanpa harus memodelkan beban eksternal dari awal, meliputi:
    - **Axial Load ($P_u$)** — gaya aksial terfaktor (kN)
    - **Momen Sumbu Kuat ($M\_{ux}$)** — momen lentur terfaktor arah sumbu X (kNm)
    - **Momen Sumbu Lemah ($M\_{uy}$)** — momen lentur terfaktor arah sumbu Y (kNm)
    - **Torsi ($T_u$)** — momen puntir/torsi terfaktor (kNm)
    - **Gaya Geser ($V_u$)** & **Panjang Bentang ($L$)** — untuk evaluasi geser, tekuk torsi lateral (_LTB_), dan kontrol lendutan (m)

### `2` · Desain & Optimasi Iteratif Penampang (Beton & Baja)

Algoritma **optimasi iteratif** yang mengevaluasi berbagai kandidat dimensi, penulangan, atau profil standar secara bertahap untuk menghasilkan rekomendasi desain paling aman dan ekonomis:

- **Optimasi Balok Beton Bertulang:** Merekomendasikan dimensi penampang ($b \times h$), konfigurasi & diameter tulangan tarik/tekan, serta tulangan geser/torsi (sengkang).
- **Optimasi Balok Profil Baja (IWF & BOX):** Merekomendasikan profil baja standar yang memenuhi batas geometri maksimum ($H_{\max}$ dan $W_{\max}$) serta merekomendasikan mutu baja yang paling ekonomis dengan target efisiensi kapasitas **$M_u / \phi M_n \ge 90\%$** (namun tetap $\le 100\%$).

### `3` · Pemetaan Warna Defleksi

Menghitung dan menggambarkan tingkat lendutan (_deflection_) sepanjang bentang balok melalui **_pemetaan warna_ (_color contour_) yang intuitif** — layaknya _software_ analisis struktur profesional seperti **SAP2000** — lengkap dengan pengecekan batas lendutan izin ($\Delta_{\max} \le L/\text{batas}$).

### `4` · Visualisasi Diagram Gaya Dalam

Visualisasi **SFD · NFD · BMD · TFD** yang **interaktif dan komprehensif**:

| Diagram | Kepanjangan              | Deskripsi                                                          |
| :-----: | :----------------------- | :----------------------------------------------------------------- |
| **SFD** | _Shear Force Diagram_    | Diagram gaya lintang/geser sepanjang bentang balok                 |
| **NFD** | _Normal Force Diagram_   | Diagram gaya normal (aksial $P_u$) sepanjang balok                 |
| **BMD** | _Bending Moment Diagram_ | Diagram momen lentur ($M_{ux}$ & $M_{uy}$) sepanjang bentang balok |
| **TFD** | _Torsion Force Diagram_  | Diagram momen puntir/torsi ($T_u$) sepanjang bentang balok         |

### `5` · Interaksi Multimodal

Kendalikan seluruh aplikasi lewat **tiga modalitas input** — gestur tangan, mouse/kursor, dan suara — yang dapat saling menggantikan.

---

## 📐 Spesifikasi Teknis Input & Output Perhitungan Struktur

Bagian ini merinci parameter input dan keluaran (_output_) teknis untuk masing-masing mode pembebanan dan jenis material balok.

### 🔄 1. Parameter Input Pembebanan & Geometri Bentang

| Mode Input                      | Parameter yang Diinput Pengguna                                                                                                                                                                                                                                     | Keterangan / Satuan                                                                                                                                    |
| :------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mode A: Gaya Eksternal**      | • Panjang bentang ($L$) & jenis tumpuan<br>• Beban terpusat ($P$) & posisi beban<br>• Beban merata ($q$)<br>• Berat sendiri (_self-weight_ otomatis dari $\gamma_{\text{material}}$)                                                                                | Menghitung reaksi tumpuan, diagram gaya dalam, lendutan _real-time_, lalu meneruskan nilai ekstrem ($P_u, V_u, M_u, T_u$) ke modul desain penampang.   |
| **Mode B: Gaya Dalam Langsung** | • **Axial Load ($P_u$)** — kN<br>• **Momen Lentur Mayor ($M\_{ux}$)** — kNm<br>• **Momen Lentur Minor ($M\_{uy}$)** — kNm<br>• **Torsi ($T_u$)** — kNm<br>• **Gaya Geser ($V_u$)** — kN _(opsional/otomatis dari gradien momen)_<br>• **Panjang Bentang ($L$)** — m | Langsung mengevaluasi kapasitas penampang terhadap kombinasi aksial-lentur biaxial-torsi serta menghitung estimasi kurvatur/lendutan pada bentang $L$. |

---

### 🧱 2. Modul Balok Beton Bertulang (_Reinforced Concrete Beam_)

Mengacu pada prinsip desain kekuatan batas (_Ultimate Strength Design_ / SNI 2847):

| Kategori                       | Parameter                             | Pilihan / Format Input & Output                                                                                                                                                                                                                                                                                     |
| :----------------------------- | :------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Input Material & Penampang** | **Mutu Beton**                        | Pilihan input dalam **$f'\_c$ (MPa)** _(mis. 20, 25, 30, 35 MPa)_ atau **Mutu $K\text{-xxx}$** _(mis. K-225, K-250, K-300, K-350, K-400 dengan konversi otomatis $f'\_c \approx 0{,}083 \times K$)_.                                                                                                                |
|                                | **Selimut Beton (_Concrete Cover_)**  | Tebal bersih selimut beton $d_c$ / $c_c$ (mm) — mis. 25 mm, 40 mm, atau 50 mm sesuai kondisi eksposur.                                                                                                                                                                                                              |
|                                | **Mutu Baja Tulangan**                | • **Tulangan Polos (BJTP):** **BJTP 24** ($f_y = 240\text{ MPa}$) atau **BJTP 30** ($f_y = 295\text{–}300\text{ MPa}$)<br>• **Tulangan Sirip/Ulir (BJTS):** **BJTS 40** ($f_y = 390\text{–}400\text{ MPa}$), **BJTS 50** ($f_y = 490\text{–}500\text{ MPa}$), atau **BJTS 60** ($f_y = 590\text{–}600\text{ MPa}$). |
|                                | **Dimensi Awal _(Opsional)_**         | Lebar ($b$) dan tinggi ($h$) awal jika ingin mode _check_, atau dikosongkan untuk mode _full auto-optimization_.                                                                                                                                                                                                    |
| **Output Optimasi Desain**     | **Rekomendasi Dimensi Penampang**     | Lebar balok ($b$) dan tinggi total ($h$) hasil optimasi rasio ekonomis ($h/b \approx 1{,}5\text{–}2{,}0$) yang memenuhi syarat lendutan dan spasi tulangan.                                                                                                                                                         |
|                                | **Tulangan Tarik & Tekan**            | Jumlah dan **diameter tulangan longitudinal tarik** ($A_s$, mis. `4 D19`) serta **tulangan tekan** ($A'_s$, mis. `2 D16`) beserta pengecekan rasio tulangan ($\rho_{\min} \le \rho \le \rho_{\max}$).                                                                                                               |
|                                | **Tulangan Geser (Sengkang) & Torsi** | **Diameter dan jarak sengkang** (mis. `Ø10 - 150 mm` di tumpuan & `Ø10 - 200 mm` di lapangan) serta kebutuhan tulangan memanjang tambahan akibat torsi ($A_l$) bila $T_u > T_{th}$.                                                                                                                                 |
|                                | **Ringkasan Rasio Kapasitas**         | Nilai kapasitas terfaktor ($\phi M_n, \phi V_n, \phi T_n$), rasio utilisasi ($M_u / \phi M_n$), dan visualisasi sketsa potongan melintang penampang beton.                                                                                                                                                          |

---

### 🔩 3. Modul Balok Profil Baja (_Structural Steel Beam — IWF & BOX_)

Mengacu pada metode LRFD (_Load and Resistance Factor Design_ / SNI 1729) dengan database tabel profil baja standar (IWF dan Hollow/Box):

| Kategori                                | Parameter                              | Pilihan / Format Input & Output                                                                                                                                                                                                                                                                                                                      |
| :-------------------------------------- | :------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Input Material**                      | **Mutu Baja Struktural**               | Pilihan standar: **BJ 34** ($f_y = 210\text{ MPa}, f_u = 340\text{ MPa}$), **BJ 37** ($f_y = 240\text{ MPa}, f_u = 370\text{ MPa}$), **BJ 41** ($f_y = 250\text{ MPa}, f_u = 410\text{ MPa}$), **BJ 50** ($f_y = 290\text{ MPa}, f_u = 500\text{ MPa}$), atau **BJ 55** ($f_y = 410\text{ MPa}, f_u = 550\text{ MPa}$).                              |
| **Input Filter & Batasan (_Optional_)** | **Filter Tipe Profil**                 | Pilihan ruang pencarian: **Hanya IWF**, **Hanya BOX (Hollow)**, atau **Semua Profil (IWF + BOX)** _(otomatis membandingkan efisiensi IWF vs BOX terutama saat ada beban $M\_{uy}$ dan Torsi $T_u$ besar)_.                                                                                                                                           |
|                                         | **Batasan Dimensi Maksimum**           | Input opsional **Tinggi Penampang Maksimum ($H\_{\max}$)** dan **Lebar Penampang Maksimum ($W\_{\max}$ / $B\_{\max}$)** dalam mm (mis. akibat batas ruang plafon atau arsitektural).                                                                                                                                                                 |
| **Output Optimasi Desain**              | **Rekomendasi Profil Penampang**       | Daftar peringkat profil terbaik (mis. `IWF 300x150x6.5x9` atau `BOX 250x250x9`) yang lolos kelangsingan penampang (_compact/non-compact_), tekuk torsi lateral (_LTB_), interaksi aksial-lentur biaxial ($P_u\text{-}M_{ux}\text{-}M_{uy}$), torsi ($T_u$), dan batas dimensi ($H \le H_{\max}, W \le W_{\max}$).                                    |
|                                         | **Rekomendasi Mutu & Profil Ekonomis** | Fitur _Smart Grade & Section Optimizer_: mengevaluasi lintas mutu (**BJ 34 s/d BJ 55**) untuk merekomendasikan kombinasi profil + mutu baja paling ringan/ekonomis dengan **rasio utilisasi optimal $M_u / \phi M_n \ge 90\%$** (mendekati kapasitas penuh tanpa melewati batas 100%, mis. rentang _sweet spot_ $0{,}90 \le \text{DCR} \le 1{,}00$). |

---

## 🖐️ Sistem Interaksi Multimodal

### 🤚 A · Kontrol Gestur Tangan — _Motion Capture_

Kamera menangkap gerakan tangan secara langsung (_hand tracking_ di dalam _browser_), lalu **tangan menggantikan kursor** pada seluruh halaman — tanpa perlu menyentuh mouse.

Kunci desainnya: **kursor virtual bersifat dinamis** — setiap gestur yang terdeteksi akan **mengubah bentuk simbol kursor** secara otomatis, sehingga pengguna selalu tahu "mode apa" yang sedang aktif.

|            Gestur            | Nama         |     Simbol Kursor      | Fungsi                                                                     |
| :--------------------------: | :----------- | :--------------------: | :------------------------------------------------------------------------- |
|      ✋ Telapak terbuka      | _Open Palm_  |     ◎ cincin halus     | Mode pointer — kursor virtual aktif, _hover_ & navigasi                    |
| 🤏 Cubit (jempol + telunjuk) | _Pinch_      |      ⌖ _reticle_       | **Klik** — pilih elemen, tekan tombol, pilih material/profil, mulai _drag_ |
|           ✊ Kepal           | _Fist_       | ▼ panah gaya berdenyut | **Gaya eksternal _real-time_** — beban "dipegang" di ujung tangan (Mode A) |
|       ☝️ Telunjuk saja       | _Point_      |     ▸ panah kecil      | Mode presisi — _pointing_ halus, _snap_ ke node/penampang                  |
|         ✌️ Dua jari          | _Two-Finger_ |   ▣ bingkai jendela    | Grab & pindahkan **floating window**                                       |

> [!TIP]
> 🎯 **Gaya eksternal _real-time_ dengan tangan:** saat berada pada **Mode Input Gaya Eksternal** dan gestur ✊ aktif, vektor gaya mengikuti posisi tangan di atas balok — **lendutan, pemetaan warna, seluruh diagram (SFD/NFD/BMD/TFD), dan rasio utilisasi penampang ($M_u/\phi M_n$) merespons secara langsung** seiring tangan bergerak.

### 🪟 B · Floating Window

Panel-panel mengambang di atas kanvas simulasi yang **bisa dipindah-pindah bebas** via **mouse/kursor** (_drag & drop_ klasik) atau **gestur tangan** (simbol ▣ aktif):

- **Window Konfigurasi Material & Beban** — pilih Beton Bertulang vs Baja (IWF/BOX), serta pilih Mode Gaya Eksternal vs Mode Gaya Dalam ($P_u, M_{ux}, M_{uy}, T_u, L$).
- **Window Parameter & Batasan Desain** — atur mutu beton ($f'_c / K$), selimut, mutu tulangan (BJTP/BJTS), atau mutu baja (BJ34–55), filter IWF/BOX, dan batas $H_{\max} / W_{\max}$.
- **Window Hasil Optimasi & Penampang** — tampilkan sketsa detail tulangan beton ($n\text{-D xx}$, sengkang) atau rekomendasi profil & mutu baja ekonomis ($M_u/\phi M_n \ge 90\%$).
- **Window Diagram Gaya Dalam** — tampilkan SFD, NFD, BMD, dan TFD secara interaktif.
- **Window Gestur & Kamera** — pratinjau _hand tracking_ dan indikator gestur aktif.

### 🎙️ C · Kontrol Suara — _Voice Command_

> [!WARNING]
> ⚠️ **Batasan desain yang disengaja:** kontrol suara **hanya untuk _toggle_ / kontrol diskrit** (nyalakan–matikan window, ganti material Beton/Baja, ganti mode input beban, atau filter IWF/BOX) — **bukan** untuk memasukkan angka kontinu seperti nilai $M_{ux}$ atau panjang bentang secara presisi. Input angka dan parameter kontinu tetap dilakukan lewat UI/mouse/gestur.

Alur: 🎤 ucapan → _speech-to-text_ → **AI menerjemahkan bahasa natural** → dicocokkan ke **Command Registry** → aksi dieksekusi.

| Contoh Ucapan                                            | Command                 | Aksi                                                       |
| :------------------------------------------------------- | :---------------------- | :--------------------------------------------------------- |
| _"Ganti material balok ke beton bertulang"_              | `set.material.rc`       | Mode material → **Beton Bertulang**                        |
| _"Ubah ke balok baja profil IWF saja"_                   | `set.steel.filter.iwf`  | Material **Baja** + filter profil → **IWF Only**           |
| _"Pakai input gaya dalam langsung"_                      | `set.loadmode.internal` | Mode input → **Gaya Dalam ($P_u, M\_{ux}, M\_{uy}, T_u$)** |
| _"Tampilkan diagram momen tekuk"_                        | `toggle.diagram.bmd`    | Panel BMD tampil/sembunyi                                  |
| _"Jalankan optimasi penampang ekonomis"_                 | `toggle.mode.optimize`  | Optimasi iteratif & cek $M_u/\phi M_n \ge 90\%$ aktif      |
| _"Tolong nyalakan window real time untuk gestur tangan"_ | `toggle.window.gesture` | Floating window gestur → **ON**                            |

### 🤖 D · AI Conversational Assistant

AI memiliki **peran ganda**:

1. **🧭 Intent Router** — menerjemahkan ucapan bebas (bahasa natural) ke _command_ yang tersedia di registry.
2. **💬 Rekan Diskusi Rekayasa Struktur** — saat diajak berdiskusi (bukan perintah UI), AI dapat menjelaskan arti hasil optimasi, misalnya alasan mengapa profil **BOX** lebih disarankan dibanding **IWF** ketika input **Torsi ($T_u$)** dan **$M\_{uy}$** besar, atau menjelaskan mengapa mutu **BJ 41** memberikan rasio $M_u/\phi M_n \ge 90\%$ yang lebih ekonomis dibanding **BJ 55** pada bentang tertentu.

### 📊 Matriks Modalitas

| Kemampuan                                                     |    🤚 Gestur Tangan     |     🖱️ Mouse / Keyboard      |    🎤 Suara + AI    |
| :------------------------------------------------------------ | :---------------------: | :--------------------------: | :-----------------: |
| Menggantikan kursor & klik elemen                             |   ✅ _palm_ & _pinch_   |          ✅ standar          |          —          |
| **Gaya eksternal real-time (Mode A)**                         |   ✅ simbol khusus ✊   |       ✅ klik & tahan        |          —          |
| Input nilai $P_u, M_{ux}, M_{uy}, T_u, L, H_{\max}, W_{\max}$ | ✅ _slider_ / _stepper_ | ✅ ketik langsung / _slider_ |          —          |
| Pilih material (Beton / Baja IWF / BOX) & mutu                |           ✅            |              ✅              |  ✅ _toggle_ cepat  |
| Memindah floating window                                      |           ✅            |              ✅              |          —          |
| Diskusi hasil optimasi & rekomendasi mutu                     |            —            |         💬 chat teks         | ✅ percakapan suara |

### ⌨️ Command Registry

| Command                                           | Fungsi                                                                  | Sumber Pemicu |
| :------------------------------------------------ | :---------------------------------------------------------------------- | :------------ |
| `set.material.rc` / `set.material.steel`          | Pilih material Balok Beton Bertulang atau Balok Baja                    | 🎤 · 🖱️ · 🤚  |
| `set.loadmode.external` / `set.loadmode.internal` | Pilih input Gaya Eksternal atau Gaya Dalam ($P_u, M_{ux}, M_{uy}, T_u$) | 🎤 · 🖱️ · 🤚  |
| `set.steel.filter.iwf` / `.box` / `.all`          | Filter profil baja: hanya IWF, hanya BOX, atau keduanya                 | 🎤 · 🖱️       |
| `toggle.window.gesture`                           | Floating window gestur ON/OFF                                           | 🎤 · 🖱️       |
| `toggle.window.load`                              | Floating window input beban/gaya dalam ON/OFF                           | 🎤 · 🖱️ · 🤚  |
| `toggle.diagram.sfd` / `.nfd` / `.bmd` / `.tfd`   | Diagram gaya dalam tampil/sembunyi                                      | 🎤 · 🖱️       |
| `toggle.mode.optimize`                            | Mode optimasi iteratif penampang & mutu ekonomis aktif/nonaktif         | 🎤 · 🖱️       |
| `toggle.cursor.hand` / `toggle.capture.hand`      | Kursor virtual & motion capture kamera ON/OFF                           | 🎤 · 🖱️       |

---

## ⚙️ Arsitektur Alur Sistem

```mermaid
flowchart TB
    subgraph INPUT["1. Input Multimodal"]
        G["Kamera — Gerakan Tangan"]
        M["Mouse & Keyboard"]
        V["Mikrofon — Suara"]
    end

    G --> HT["Hand Tracking + Gesture Classifier"]
    HT --> CUR["Kursor Virtual — Simbol Dinamis"]
    CUR --> UI["Kontrol Antarmuka & Floating Window"]
    M --> UI

    V --> STT["Speech-to-Text"]
    STT --> AI{"AI Assistant"}
    AI -- "cocok dengan Command Registry" --> CMD["Command Executor"]
    AI -- "konsultasi teknik / obrolan" --> CHAT["Balasan AI — Teks + Suara"]
    CMD --> UI

    subgraph MODEL["2. Konfigurasi Beban & Material"]
        UI --> LOAD_MODE{"Mode Pembebanan"}
        LOAD_MODE -- "Mode A: Gaya Eksternal" --> EXT["Beban Eksternal + Berat Sendiri (L)"]
        LOAD_MODE -- "Mode B: Gaya Dalam" --> INT["Input Langsung: Pu, Mux, Muy, Tu, L"]
        EXT --> SOLVER["Solver Mekanika Teknik (SFD, NFD, BMD, TFD, Defleksi)"]
        INT --> SOLVER

        UI --> MAT_MODE{"Pilihan Material"}
    end

    subgraph DESIGN["3. Engine Desain & Optimasi Iteratif"]
        SOLVER --> MAT_MODE
        MAT_MODE -- "Beton Bertulang (SNI 2847)" --> RC_IN["Input: f'c / K-xxx, Selimut, BJTP 24/30, BJTS 40/50/60"]
        RC_IN --> RC_OPT["Optimasi Dimensi (b x h) + Tulangan Tarik/Tekan + Sengkang"]

        MAT_MODE -- "Profil Baja (SNI 1729)" --> ST_IN["Input: BJ 34/37/41/50/55, Filter IWF/BOX, Batas H_max & W_max"]
        ST_IN --> ST_OPT["Optimasi Profil (IWF/BOX) + Rekomendasi Mutu Ekonomis (Mu/ΦMn >= 90%)"]
    end

    RC_OPT --> OUT["Visualisasi Real-Time: Kontur Warna Defleksi · Diagram Gaya Dalam · Detail Penampang"]
    ST_OPT --> OUT
```

> [!NOTE]
> **Fallback yang tetap dijaga:** bila kamera tidak tersedia/ditolak → kontrol otomatis kembali ke mouse; bila mikrofon tidak diizinkan → voice control nonaktif, seluruh fitur analisis struktur dan optimasi beton/baja tetap berfungsi penuh.

---

## 🎓 Kesesuaian dengan Panduan Tugas Besar (Pengembangan Software Teknik Sipil)

Agar proyek ini terukur, tepat guna, dan terhindar dari risiko pengembangan yang sering terjadi pada tugas besar (seperti ruang lingkup terlalu melebar atau minimnya validasi), pengembangan dibagi ke dalam tahapan terstruktur berikut:

### 1. Pemisahan Ruang Lingkup (_Scope Management_: MVP vs Fitur Lanjutan)

|              Tahap              | Fokus Pengembangan                                                | Komponen Fitur                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| :-----------------------------: | :---------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tahap 1 (MVP / Fitur Wajib)** | **Engine Analisis Struktur, Desain Beton/Baja & Visualisasi Web** | • Pemilihan Material (Beton Bertulang vs Baja IWF/BOX)<br>• Dual Input Pembebanan (Gaya Eksternal vs Gaya Dalam $P_u, M_{ux}, M_{uy}, T_u, L$)<br>• Kalkulasi & Optimasi Beton ($f'_c/K$, BJTP/BJTS $\rightarrow$ dimensi, tulangan pokok & sengkang)<br>• Kalkulasi & Optimasi Baja (BJ 34–55, filter IWF/BOX, batas $H_{\max}/W_{\max}$, rasio ekonomis $M_u/\phi M_n \ge 90\%$)<br>• Visualisasi pemetaan warna defleksi & diagram SFD/NFD/BMD/TFD dengan kontrol Mouse/UI standar. |
| **Tahap 2 (Fitur Eksploratif)** | **Interaksi Multimodal & AI Assistant**                           | • _Hand Tracking_ & kursor virtual dinamis via MediaPipe Hands<br>• _Voice Command_ (_toggle_ cepat) via Web Speech API<br>• _AI Conversational Assistant_ sebagai _intent router_ dan asisten diskusi hasil desain.                                                                                                                                                                                                                                                                   |

### 2. Data, Rumus, dan Standar Acuan

- **Mekanika Bahan & Analisis Struktur:** Persamaan garis elastis Euler-Bernoulli / metode integrasi numerik untuk kurva lendutan dan diagram gaya dalam.
- **Beton Bertulang:** Mengacu pada **SNI 2847** (faktor reduksi kekuatan $\phi$, blok tegangan ekuivalen Whitney, kapasitas lentur tunggal/rangkap, geser $V_c + V_s$, dan torsi).
- **Struktur Baja:** Mengacu pada **SNI 1729 (LRFD)** (klasifikasi penampang kompak/non-kompak, kapasitas lentur & _Lateral-Torsional Buckling_, persamaan interaksi aksial-lentur biaxial H1-1a/b, serta torsi penampang terbuka IWF vs tertutup BOX) dengan _dataset_ JSON tabel profil baja standar (SNI/JIS).

### 3. Rencana Pengujian, Validasi, dan Dokumentasi Akhir

- **Verifikasi Perhitungan Manual & Software Pembanding:** Menguji akurasi output aplikasi (momen, lendutan, luas tulangan $A_s$, dan rasio kapasitas profil baja $M_u/\phi M_n$) terhadap lembar hitungan manual (_spreadsheet_) dan contoh kasus **SAP2000**.
- **Pengujian Batas & Validasi Input (_Edge-Case Testing_):** Memastikan aplikasi memberi peringatan yang tepat saat input tidak valid (mis. $H_{\max}$ terlalu kecil sehingga tidak ada profil di tabel yang muat, atau beban melampaui kapasitas maksimum penampang).
- **Keluaran Akhir (_Deliverables_):**
  1. **GitHub Repository** terstruktur (kode sumber, _database_ profil IWF/BOX, riwayat _commit_, dan `README.md`).
  2. **Laporan Pengembangan** (identifikasi masalah, analisis kebutuhan fungsional/nonfungsional, _flowchart_ algoritma optimasi, dan tabel hasil validasi pengujian).
  3. **Buku Panduan (_User Manual_)** cara penggunaan mode input gaya eksternal/dalam, optimasi beton/baja, dan kontrol multimodal.

---

## 📋 Ringkasan Cepat

| Aspek                         | Detail                                                                                                                   |
| :---------------------------- | :----------------------------------------------------------------------------------------------------------------------- |
| **Jenis Aplikasi**            | Simulator defleksi balok & _optimizer_ desain penampang (Beton Bertulang & Baja)                                         |
| **Pilihan Material**          | **Beton Bertulang** ($f'_c$ / $K\text{-xxx}$, BJTP 24/30, BJTS 40/50/60) & **Baja** (IWF & BOX, BJ 34/37/41/50/55)       |
| **Mode Input Beban**          | **1) Gaya Eksternal** + berat sendiri (_real-time_) · **2) Gaya Dalam Langsung** ($P_u, M_{ux}, M_{uy}, T_u, L$)         |
| **Output Balok Beton**        | Rekomendasi dimensi ($b \times h$), diameter & jumlah tulangan tarik/tekan, serta tulangan geser (sengkang)              |
| **Output Balok Baja**         | Rekomendasi profil (filter IWF/BOX, batas $H_{\max}$ & $W_{\max}$) & rekomendasi mutu ekonomis ($M_u/\phi M_n \ge 90\%$) |
| **Visual Defleksi & Diagram** | Pemetaan warna intuitif (gaya _SAP2000_) + Diagram **SFD · NFD · BMD · TFD**                                             |
| **Modalitas Interaksi**       | 🤚 Gerakan tangan (_motion capture_) · 🖱️ Mouse/Keyboard · 🎤 Suara via AI                                               |

---

## 🧭 Catatan Pengembangan

**Changelog:**

|  Versi   | Perubahan                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| :------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **v0.1** | Rencana inti — simulator defleksi, pemetaan warna, optimasi iteratif, SFD/NFD/BMD                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **v0.2** | ➕ Motion capture & kontrol gestur tangan (kursor virtual + simbol dinamis) · floating window · kontrol suara (batasan: toggle saja) · AI assistant                                                                                                                                                                                                                                                                                                                                                |
| **v0.3** | ➕ Pilihan material **Beton Bertulang** vs **Profil Baja (IWF & BOX)** · Dual mode input (**Gaya Eksternal** vs **Gaya Dalam $P_u, M\_{ux}, M\_{uy}, T_u, L$**) · Spesifikasi parameter beton ($f'_c/K$, selimut, BJTP/BJTS, output tulangan tarik/tekan/sengkang & dimensi) · Spesifikasi parameter baja (BJ 34–55, filter IWF/BOX, batas $H_{\max}/W_{\max}$, optimasi profil & mutu ekonomis $M_u/\phi M_n \ge 90\%$) · Penyelarasan tahapan pengembangan & validasi sesuai panduan Tugas Besar |

**Saran teknologi (tidak mengikat):**

- 🧮 _Structural Solver & Database_ → **TypeScript / JavaScript Modular Engine** + JSON Database Tabel Profil Baja (IWF & BOX standar SNI/JIS)
- 🤚 _Hand tracking_ → **MediaPipe Hands** (berjalan lokal di _browser_, tanpa kirim video ke server)
- 🎤 _Speech_ → **Web Speech API** (STT & TTS bawaan _browser_)
- 🤖 NLU + percakapan → **LLM API** dengan _function calling_ ke command registry

---

<div align="center">

_Real-Time · Dual-Material (RC & Steel) · Multimodal · Evolving_

</div>
