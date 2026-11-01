# 🎨 Spesifikasi Visual UI/UX, Tata Letak Viewport 3D/2D, & Interaksi Multimodal

> **Dokumen Spesifikasi Tampilan & Pengalaman Pengguna (`mdfiles/ui_ux_visual_layout_and_interaction_spec.md`)**
> Dokumen ini mengunci seluruh detail tampilan visual yang dilihat langsung oleh mata pengguna pada **Interactive Beam Deflection & Structural Design Simulator** di dalam repositori **`Tubes/`**.
> Seluruh spesifikasi warna, pola grid latar belakang, bentuk tumpuan 2D, ekstrusi balok 3D, penataan _Floating Windows_, hingga posisi _Colorbar Legend_ dan lendutan maksimum ($-\Delta_{\max}$) dirancang mengacu pada **Gambar Referensi 1, 2, dan 3** yang telah ditetapkan.

## 🌌 1. Sistem Desain & Tema Latar Belakang Kanvas (_Erzysh Dark Void Theme_)

Berdasarkan hasil ekstraksi piksel dari **Gambar 1 dan Gambar 2**, kanvas utama simulator menggunakan tema gelap rekayasa presisi tinggi (_Dark Engineering CAD/CAE Theme_) agar warna kontur defleksi 3D dan garis diagram 2D tampil tajam:

| Token Desain            | Nilai Warna / CSS Eksak                                                                             | Fungsi Visual pada Layar                                                                                                                |
| :---------------------- | :-------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------- |
| **`--bg-canvas-void`**  | `#0A0A0A` (`rgb(10, 10, 10)`)                                                                       | Warna dasar latar belakang kanvas utama (100vw $\times$ 100vh)                                                                          |
| **`--bg-grid-line`**    | `#1F2020` / `rgba(255, 255, 255, 0.045)`                                                            | Garis grid ortogonal (`1px`) dengan ukuran kotak `40px x 40px` yang memudar ke tepi layar menggunakan `radial-gradient` _vignette mask_ |
| **`--bg-ambient-glow`** | `radial-gradient(circle, rgba(6, 182, 212, 0.075) 0%, rgba(10, 14, 14, 0.02) 45%, transparent 75%)` | Pendaran cahaya _Dark Teal/Cyan_ lembut tepat di belakang panggung balok 3D                                                             |
| **`--surface-window`**  | `rgba(15, 20, 22, 0.86)` + `backdrop-filter: blur(12px)`                                            | Latar belakang panel _Floating Windows_ dan kartu HUD                                                                                   |
| **`--border-subtle`**   | `1px solid rgba(148, 163, 184, 0.14)` (`#1E293B`)                                                   | Garis tepi halus untuk _Floating Windows_, kartu indikator, dan tombol sekunder                                                         |
| **`--accent-gradient`** | `linear-gradient(90deg, #06B6D4 0%, #3B82F6 50%, #8B5CF6 100%)`                                     | Aksen utama untuk _header badge_, indikator aktif, dan sorotan elemen interaktif                                                        |
| **`--support-stroke`**  | `#94A3B8` (_Slate 400_, tebal `2.5px`)                                                              | Garis luar simbol tumpuan 2D (Sendi, Rol, Jepit) sesuai Gambar 3                                                                        |
| **`--support-fill`**    | `linear-gradient(180deg, #334155 0%, #1E293B 100%)`                                                 | Isian bidang segitiga/roda simbol tumpuan 2D sesuai Gambar 3                                                                            |

## 🧊 2. Arsitektur Visual Hybrid: Balok 3D + Tumpuan & Grafik 2D

Tampilan utama simulator menggabungkan **panggung 3D WebGL** untuk geometri balok dengan **lapisan vektor 2D (SVG/Canvas Overlay)** yang terkunci pada proyeksi koordinat layar untuk simbol tumpuan dan grafik gaya dalam:

```
+--------------------------------------------------------------------------------------------------+
| [Opsional Top Bar: Hanya tampil jika ruang layar kosong / mayoritas floating window ditutup]     |
|                                                                                                  |
|  +-----------------------+                                                       +------------+  |
|  | Window 1: Material &  |                  [PANGGUNG UTAMA 3D/2D]               | COLORBAR   |  |
|  | Mode Pembebanan       |                                                       | LEGEND     |  |
|  +-----------------------+              P = 50 kN      q = 15 kN/m               | (Defleksi) |  |
|                                             |        |||||||||||||||             |            |  |
|  +-----------------------+        /|========V=======================\            |  0,00 mm   |  |
|  | Window 2: Parameter   |       /|  [BALOK 3D MELENGKUNG (IWF/BETON)]           |  [Biru]    |  |
|  | Desain SNI & Filter   |      /|          \                       /            |  [Cyan]    |  |
|  +-----------------------+     /|            \_____[ -Δ_max ]______/             |  [Hijau]   |  |
|                                :                                   /\            |  [Kuning]  |  |
|                                :  (Jepit 2D)                      /__\ (Rol 2D)  |  [Merah]   |  |
|                                :                                  o  o           | -14,20 mm  |  |
|                                                                   :              |            |  |
|                                [Mode Diagram 2D: Di As Balok / Vertikal Bawah]   +------------+  |
|                                                                                  | Gizmo XYZ  |  |
|  +-----------------------------------+   +-----------------------------------+   | [Z-Up/Y-Up]|  |
|  | KARTU LENDUTAN MAKSIMUM (Kiri Bwh)|   | Window 3: Hasil Optimasi SNI &    |   +------------+  |
|  | Δ_max = -14,20 mm  (di x = 3,47m) |   | Tombol Export (.dxf/.s2k/.ifc/..)|                   |
|  | Batas Izin L/360 = -16,67 mm [OK] |   +-----------------------------------+                   |
|  +-----------------------------------+                                                           |
+--------------------------------------------------------------------------------------------------+
```

### 2.1. Visualisasi Balok 3D Berdasarkan Jenis Material (`Beam3DExtrudedViewport.tsx`)

Balok dirender dalam 3D dengan menarik (_extrude_) penampang 2D dari ujung A ($s = 0$) ke ujung B ($s = L$). Penampang **tidak mengalami perubahan bentuk/distorsi lokal (_no cross-section shape distortion_)** dan hanya melengkung secara mulus mengikuti kurva lendutan negatif ($v(s) \le 0$):

1. **Mode Tampilan Profil Baja 3D (IWF & BOX):**
   - Menampilkan profil **IWF** (lengkap dengan sayap atas-bawah, badan vertikal, dan 4 lengkungan _fillet_ $r$) atau **BOX** (tabung persegi/persegi panjang berongga) yang ditarik sepanjang garis elastis dari ujung A ke ujung B.
   - Permukaan 3D profil baja diwarnai secara kontinu menggunakan gradasi **SAP2000 Color Contour** berdasarkan nilai lendutan di setiap titik stasiun $s_m$.
2. **Mode Tampilan Balok Beton Bertulang 3D (Memiliki 2 Sub-Mode Toggle):**
   - **Sub-Mode 1 — _Solid Concrete + End Cross-Section View_:**
     - Menampilkan balok beton persegi panjang utuh ($b_w \times h$) yang ditarik dari ujung A ke ujung B dan melengkung mengikuti kurva lendutan.
     - Pada penampang ujung A dan B (_end-caps_), ditampilkan **gambar potongan melintang beton bertulang** yang memperlihatkan garis sengkang tertutup serta lingkaran tulangan tarik ($A_s$) di bawah dan tulangan tekan ($A'_s$) di atas.
   - **Sub-Mode 2 — _Wireframe / X-Ray Rebar & Stirrup Cage View_:**
     - Selubung luar beton diubah menjadi _wireframe_ semi-transparan (`opacity: 0.18`, garis tepi `#64748B`), sehingga pengguna dapat melihat langsung **ilustrasi 3D penempatan tulangan pokok memanjang dan barisan cincin sengkang** di sepanjang bentang balok sesuai jarak spasi hasil optimasi ($s_{\text{stirrup}}$).

### 2.2. Visualisasi Simbol Tumpuan 2D (`SupportSymbols2DOverlay.tsx` — Berdasarkan Gambar 3)

Simbol tumpuan dirender dalam **2D** tepat pada proyeksi titik perletakan balok dengan geometri yang mengacu pada **Gambar 3**, ditingkatkan menggunakan palet warna _slate-metallic_ agar serasi dengan latar belakang `#0A0A0A`:

- **Tumpuan Jepit (_Fixed Support_):** Dinding vertikal tegas berwarna `#94A3B8` di sisi ujung balok dengan **6 garis arsiran miring ($45^\circ$)** ke arah luar, dilengkapi garis bantu putus-putus vertikal (`#6D7C90`) ke arah bawah.
- **Tumpuan Sendi (_Pinned Support_):** Segitiga sama kaki dengan garis tepi `#94A3B8` (`2.5px`) dan isian gradasi gelap `#334155` $\rightarrow$ `#1E293B` yang puncaknya menyentuh tepi bawah balok, dilengkapi garis bantu putus-putus vertikal di sumbu tengahnya.
- **Tumpuan Rol (_Roller Support_):** Segitiga sama kaki seperti tumpuan Sendi, ditambah **garis landasan horizontal** dan **2 lingkaran roda kecil** di bawah alas segitiga, lengkap dengan garis bantu putus-putus vertikal di sumbu tengahnya.
- Mendukung seluruh **5 konfigurasi tumpuan (8 variasi orientasi)**: Kantilever (Kiri/Kanan), Sendi–Rol / Rol–Sendi, Jepit–Jepit, Jepit–Rol / Rol–Jepit, dan Jepit–Sendi / Sendi–Jepit.

### 2.3. Tiga Mode Visualisasi Grafik Gaya Dalam 2D (`MultiModeDiagram2DOverlay.tsx`)

Seluruh grafik gaya dalam (**SFD, NFD, BMD, TFD**) dirender dalam **2D** dan mendukung **3 mode penempatan** yang dapat dipilih atau dikombinasikan pengguna:

1. **Mode 1 — Bertumpuk Tepat Sejajar di As Balok (_In-Place Axis Overlay_):**
   - Kurva diagram digambar langsung menempel pada sumbu memanjang balok di kanvas utama.
   - Dilengkapi tombol _checklist_ cepat (`[x] BMD`, `[x] SFD`, `[ ] NFD`, `[ ] TFD`) agar pengguna bebas menyalakan/mematikan diagram tertentu tanpa saling bertumpukan.
2. **Mode 2 — Sejajar Menurun ke Bawah secara Vertikal (_Stacked Vertical Charts_):**
   - Diagram SFD, BMD, NFD, dan TFD disusun berbaris vertikal dari atas ke bawah tepat di bawah balok dengan panjang bentang yang sejajar $1:1$ terhadap ujung A dan B balok, dihubungkan oleh garis bantu putus-putus vertikal dari titik tumpuan.
3. **Mode 3 — Jendela Mengambang Khusus (_Dedicated Floating Window_):**
   - Seluruh grafik ditempatkan di dalam _Floating Window Diagram Gaya Dalam_ tersendiri yang dapat digeser bebas di layar.

## 🧭 3. Penempatan HUD Defleksi, Gizmo Sumbu $X\text{-}Y\text{-}Z$, & 6 Floating Windows

### 3.1. Elemen HUD Tetap di Kanvas Utama

1. **Sisi Kanan Layar — _Colorbar Legend_ & _Coordinate Axis Switcher_:**
   - Menampilkan batang gradasi warna vertikal (**Biru `#3B82F6` $\rightarrow$ Cyan `#06B6D4` $\rightarrow$ Hijau `#10B981` $\rightarrow$ Kuning `#EAB308` $\rightarrow$ Merah `#EF4444`**) dengan label angka lendutan bertanda minus dari `0,00 mm` di puncak hingga `$-\Delta_{\max}$ mm` di dasar.
   - Tepat di bawah _Colorbar_, terdapat _3D Axis Gizmo_ interaktif dan pemilih orientasi sumbu (**`Z-Up`** vs **`Y-Up`** vs **`Custom XYZ`**) untuk mengubah sumbu vertikal atas-bawah secara instan.
2. **Sisi Kiri Bawah Layar — _Kartu Lendutan Maksimum ($\Delta\_{\max}$)_:**
   - Menampilkan angka **$\Delta\_{\max} = -xx,xx\text{ mm}$** (bertanda negatif untuk lendutan ke bawah), posisi stasiun $x$, perbandingan terhadap batas izin SNI ($|\Delta_{\max}| \le L/\text{batas}$), serta _badge_ status kelayanan.

### 3.2. Manajemen Tata Letak 6 Floating Windows (Desktop) & Aturan Kondisional Bar

- **Penataan Proporsional Otomatis:** Keenam _Floating Windows_ (1: _Material & Mode Beban_, 2: _Beban Real-Time Mode A_, 3: _Parameter Desain SNI_, 4: _Hasil Optimasi & Ekspor CAD/CAE_, 5: _Diagram Gaya Dalam_, 6: _Kamera Gestur & AI Assistant_) ditata secara otomatis di area tepi kiri, kanan-bawah, dan atas agar **tidak pernah menutupi objek balok 3D di tengah layar**.
- **Aturan Kondisional _Top Bar / Bottom Dock_:** Apabila sebagian besar _Floating Windows_ sedang aktif dan layar sudah terlihat penuh, _Top Bar / Bottom Dock_ otomatis disembunyikan agar tidak mempersempit ruang pandang. Bar tersebut hanya dimunculkan dengan gaya minimalis apabila banyak window yang ditutup dan layar masih terlihat kosong.
- **Tampilan _Android Companion_:** Diatur secara otomatis dalam tata letak _mobile_ satu kolom (_Bottom Sheet_ / _Tabbed Card View_) yang berfokus pada input **Mode B (Gaya Dalam)**, hasil optimasi SNI, pratinjau penampang, dan diskusi AI.
