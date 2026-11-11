# 📖 BUKU PANDUAN PENGGUNA (USER MANUAL)

## Interactive 3D Beam Deflection & Structural Design Simulator (IBDS)

### Platform Rekayasa Struktur 3D/2D Interaktif & Optimasi Desain Penampang SNI

---

> **Mata Kuliah:** Aplikasi Komputer Teknik Sipil  
> **Aplikasi:** Interactive 3D Beam Deflection & Structural Design Simulator (IBDS)  
> **Versi Aplikasi:** v0.6.1-alpha (Build 2026)  
> **Pengembang:** Rizqi Lasheva Purnama Putra (Erzy.sh)  
> **Akses Live Demo (Web / PWA):** [https://erzysh-ibds.vercel.app](https://erzysh-ibds.vercel.app)  
> **Repositori Sumber (GitHub):** [https://github.com/Rilaptra/erzysh-IBDS](https://github.com/Rilaptra/erzysh-IBDS)

---

## DAFTAR ISI

1. [BAB 1: GAMBARAN UMUM & INFORMASI APLIKASI](#bab-1-gambaran-umum--informasi-aplikasi)
   - 1.1 Deskripsi Produk
   - 1.2 Tujuan & Manfaat Praktis
   - 1.3 Pengguna Sasaran (Target Audience)
   - 1.4 Standar Rekayasa & Acuan Regulasi
   - 1.5 Spesifikasi Perangkat & Kebutuhan Sistem
2. [BAB 2: AKSES DAN CARA PENGGUNAAN APLIKASI](#bab-2-akses-dan-cara-penggunaan-aplikasi)
   - 2.1 Akses Langsung via Web Browser
   - 2.2 Instalasi Progressive Web App (PWA) di Desktop Windows/macOS
   - 2.3 Instalasi Progressive Web App (PWA) di Smartphone Android
3. [BAB 3: PENGENALAN RUANG KERJA & ANTARMUKA PENGGUNA](#bab-3-pengenalan-ruang-kerja--antarmuka-pengguna)
   - 3.1 Panggung Kanvas 3D WebGL (Erzysh Dark Void `#0A0A0A`)
   - 3.2 Palang Navigasi Cepat (Quick Dock Bar)
   - 3.3 Sistem Jendela Mengambang (Floating Windows)
   - 3.4 Pengalih Sumbu Koordinat Dinamis (Z-Up vs Y-Up)
   - 3.5 HUD Defleksi & Colorbar Kontur Gaya Dalam
4. [BAB 4: PANDUAN PENGOPERASIAN LANGKAH DEMI LANGKAH](#bab-4-panduan-pengoperasian-langkah-demi-langkah)
   - 4.1 Langkah 1: Memilih Material & Mode Pembebanan
   - 4.2 Langkah 2: Mengatur Bentang & 5 Kategori Tumpuan
   - 4.3 Langkah 3: Menginput Beban Balok (Mode A vs Mode B)
   - 4.4 Langkah 4: Membaca & Menavigasi Diagram Gaya Dalam 2D (SFD, BMD, NFD, TFD)
   - 4.5 Langkah 5: Optimasi Penampang Beton Bertulang (SNI 2847:2019)
   - 4.6 Langkah 6: Optimasi Penampang Profil Baja IWF & BOX (SNI 1729:2020)
   - 4.7 Langkah 7: Ekspor Hasil Desain ke Software CAD, BIM, & CAE Industri
5. [BAB 5: PANDUAN FITUR KONTROL MULTIMODAL & ASISTEN AI](#bab-5-panduan-fitur-kontrol-multimodal--asisten-ai)
   - 5.1 Kontrol Gerakan Tangan Tanpa Sentuh (MediaPipe Hand Tracking)
   - 5.2 Kontrol Perintah Suara (Voice Commands) & Daftar Perintah
   - 5.3 Asisten AI Konsultan Rekayasa Struktur
   - 5.4 Konfigurasi Kunci API Google Gemini & Sistem Failover Cadangan (Backup Keys)
6. [BAB 6: PEMELIHARAAN SISTEM, TROUBLESHOOTING & FAQ](#bab-6-pemeliharaan-sistem-troubleshooting--faq)
   - 6.1 Kendala Akselerasi Hardware WebGL
   - 6.2 Kendala Izin Kamera & Pelacakan Tangan
   - 6.3 Kendala Pengenalan Suara (Microphone)
   - 6.4 Kendala Pembacaan File Ekspor di Software Eksternal
7. [BAB 7: GLOSARIUM ISTILAH & NOTASI STANDAR TEKNIK SIPIL](#bab-7-glosarium-istilah--notasi-standar-teknik-sipil)

---

# BAB 1: GAMBARAN UMUM & INFORMASI APLIKASI

### 1.1 Deskripsi Produk

**Interactive 3D Beam Deflection & Structural Design Simulator (IBDS)** adalah platform rekayasa struktur generasi baru berbasis Web dan Progressive Web App (PWA). Aplikasi ini dirancang untuk menyelesaikan dua tantangan utama dalam rekayasa struktur:

1. **Analisis Mekanika Struktur:** Menyelesaikan lendutan elastis balok prismatik dan diagram gaya dalam (SFD, BMD, NFD, TFD) secara _real-time_ (60–120 FPS) menggunakan komputasi intensif **Rust WebAssembly (`wasm32-unknown-unknown`)** dengan metode kompatibilitas Mohr dan fungsi singularitas Macaulay.
2. **Optimasi Desain Penampang:** Mengotomatiskan pemilihan dimensi serta penulangan beton bertulang berdasarkan **SNI 2847:2019** serta seleksi profil baja struktural IWF/BOX berdasarkan **SNI 1729:2020** untuk mencapai rasio efisiensi kapasitas optimum ($0{,}90 \le \text{DCR} \le 1{,}00$).

### 1.2 Tujuan & Manfaat Praktis

- **Mengeliminasi Human Error:** Menggantikan perhitungan manual yang memakan waktu dan rentan salah hitung pada kombinasi pembebanan statis tertentu dan statis tak tentu.
- **Visualisasi Intuitif 3D:** Memperlihatkan deformasi fisik balok tanpa distorsi penampang secara nyata di ruang 3D, lengkap dengan kontur warna tegangan bergaya software industri seperti SAP2000.
- **Interoperabilitas Lengkap:** Memungkinkan hasil rancangan langsung diekspor ke berbagai software standar industri (AutoCAD, SAP2000, Revit, SolidWorks, IDEA StatiCa) tanpa perlu menggambar ulang dari awal.

### 1.3 Pengguna Sasaran (Target Audience)

1. **Mahasiswa Teknik Sipil:** Sebagai media pembelajaran interaktif mekanika bahan, analisis struktur, perancangan struktur beton, dan perancangan struktur baja.
2. **Dosen & Praktisi Akademik:** Alat bantu visualisasi di ruang kuliah untuk mendemonstrasikan perilaku lendutan balok dan batas keruntuhan penampang secara langsung.
3. **Insinyur Perencana Struktur (Structural Engineer):** Alat bantu verifikasi awal (_preliminary design tool_) untuk menentukan dimensi penampang yang paling hemat dan aman sebelum dimodelkan secara kompleks.

### 1.4 Standar Rekayasa & Acuan Regulasi

Aplikasi ini beroperasi dengan mengacu secara ketat pada regulasi teknis resmi di Indonesia:

- **SNI 2847:2019:** Persyaratan Beton Struktural untuk Bangunan Gedung (Blok Tegangan Ekuivalen Whitney, kontrol regangan tarik netto $\epsilon_t \ge 0{,}005$, dan perancangan sengkang geser).
- **SNI 1729:2020:** Spesifikasi untuk Bangunan Gedung Baja Struktural (Klasifikasi kelangsingan penampang Tabel B4.1b, Tekuk Torsi Lateral / LTB Bab F, dan interaksi beban lentur-aksial-torsi Bab H).
- **JIS G 3192 / JIS G 3466:** Standar dimensi profil baja struktural IWF (I-Beam Wide Flange) dan Hollow Structural Sections (HSS BOX).

### 1.5 Spesifikasi Perangkat & Kebutuhan Sistem

| Komponen              | Spesifikasi Minimum                                  | Spesifikasi Rekomendasi                                          |
| :-------------------- | :--------------------------------------------------- | :--------------------------------------------------------------- |
| **Sistem Operasi**    | Windows 10/11, macOS Catalina+, Android 10+, iOS 14+ | Windows 11 64-bit atau Android 13+                               |
| **Browser Web**       | Chrome 90+, Edge 90+, Safari 14+, Firefox 90+        | Google Chrome atau Microsoft Edge Versi Terbaru                  |
| **Akselerasi Grafis** | WebGL 2.0 didukung hardware                          | GPU terdedikasi / GPU terintegrasi modern (Iris Xe, Radeon, RTX) |
| **Perangkat Input**   | Keyboard & Mouse / Layar Sentuh                      | Mouse + Webcam 720p (Gestur) + Mikrofon (Suara)                  |
| **Koneksi Internet**  | Diperlukan saat pemuatan awal pertama kali           | Offline PWA (setelah terpasang sepenuhnya di cache)              |

---

# BAB 2: AKSES DAN CARA PENGGUNAAN APLIKASI

Aplikasi IBDS dirancang dengan arsitektur **Adaptive Progressive Web App (PWA)** sehingga dapat digunakan secara langsung melalui peramban web maupun diinstal sebagai aplikasi native mandiri di komputer desktop dan smartphone Android.

### 2.1 Akses Langsung via Web Browser

1. Buka peramban modern pilihan Anda (disarankan **Google Chrome** atau **Microsoft Edge**).
2. Ketikkan alamat resmi pada bilah alamat URL:  
   👉 **`https://erzysh-ibds.vercel.app`**
3. Tekan **Enter**. Aplikasi akan memuat runtime WebAssembly dalam 1–2 detik dan menampilkan layar kerja 3D bertema _Erzysh Dark Void_.

### 2.2 Instalasi Progressive Web App (PWA) di Desktop Windows/macOS

Memasang aplikasi sebagai PWA memberikan kenyamanan ruang kerja tanpa gangguan address bar browser (_full-screen app experience_):

1. Buka alamat `https://erzysh-ibds.vercel.app` di Google Chrome atau Microsoft Edge.
2. Perhatikan ikon **Instal Aplikasi** (ikon layar monitor dengan tanda panah ke bawah) yang muncul di sebelah kanan bilah URL.
3. Klik tombol **Instal** ketika jendela _pop-up_ muncul.
4. Pintasan aplikasi **IBDS 3D Beam Simulator** akan otomatis terpasang di Desktop dan Start Menu Windows Anda.
5. Aplikasi kini dapat dibuka secara langsung tanpa membuka tab browser terlebih dahulu.

### 2.3 Instalasi Progressive Web App (PWA) di Smartphone Android

Aplikasi IBDS menyediakan tampilan khusus mobile yang dioptimalkan untuk input sentuh cepat (Touch-First Direct Forces Mode):

1. Buka `https://erzysh-ibds.vercel.app` melalui **Chrome for Android**.
2. Ketuk ikon menu titik tiga (**⋮**) di pojok kanan atas browser.
3. Pilih opsi **Tambahkan ke Layar Utama** (_Add to Home Screen_) atau **Instal Aplikasi**.
4. Ikon aplikasi IBDS akan muncul di laci aplikasi ponsel Anda dan dapat diakses selayaknya aplikasi Android (.apk) mandiri.

---

# BAB 3: PENGENALAN RUANG KERJA & ANTARMUKA PENGGUNA

Antarmuka kerja IBDS mengadopsi estetika rekayasa modern bertema gelap (**Erzysh Dark Void `#0A0A0A`**) yang nyaman di mata untuk sesi kerja berdurasi panjang, dilengkapi grid ortogonal presisi dan aksen pendaran Cyan/Teal.

```
+---------------------------------------------------------------------------------------------+
| [Quick Dock Bar: 1.Material | 2.Beban | 3.Parameter | 4.Optimasi | 5.Diagram | 6.AI & Gestur]  |
|                                                                                             |
|  +-------------------------+      +---------------------------+     +--------------------+  |
|  | [1] Jendela Material    |      |    VIEWPORT 3D WEBGL      |     | [Colorbar Legend]  |  |
|  | - Beton SNI 2847        |      |    (Balok Terdeformasi    |     | 0.00 mm (Biru)     |  |
|  | - Baja SNI 1729         |      |     60-120 FPS Kontur)    |     | ...                |  |
|  +-------------------------+      +---------------------------+     | -14.20 mm (Merah)  |  |
|  +-------------------------+                                        +--------------------+  |
|  | [2] Jendela Beban Balok |                                                                |
|  | - Bentang L & Tumpuan   |      +---------------------------+                             |
|  | - Beban P & q           |      | 3D Axis Gizmo (Z-Up/Y-Up) |                             |
|  +-------------------------+      +---------------------------+                             |
|                                                                                             |
|  [HUD Defleksi: Delta_max = -14.20 mm (L/422)]                      [Status: 60 FPS | WASM] |
+---------------------------------------------------------------------------------------------+
```

### 3.1 Panggung Kanvas 3D WebGL (Erzysh Dark Void `#0A0A0A`)

Pusat layar menyajikan model balok 3D interaktif yang diekstrusi mengikuti garis lengkung elastis:

- **Navigasi Kamera 3D:**
  - **Putar Kamera (Orbit):** Klik dan seret tombol kiri mouse pada area kanvas kosong.
  - **Geser Kamera (Pan):** Klik dan seret tombol kanan mouse atau tombol tengah (scroll click).
  - **Perbesar/Perkecil (Zoom):** Gulirkan roda mouse (_mouse wheel_).
- **Gradasi Warna Kontur:** Gradasi warna pada permukaan balok mencerminkan intensitas lendutan lokal sesuai standar visualisasi finite element analysis (FEA).

### 3.2 Palang Navigasi Cepat (Quick Dock Bar)

Terletak di bagian atas layar (`z-index: 40`), palang ini selalu dapat diakses untuk membuka atau menutup 6 jendela kerja secara instan:

1. `1. Material`: Memilih antara Beton Bertulang atau Baja Struktural & Mode Pembebanan.
2. `2. Beban`: Mengatur bentang balok, jenis tumpuan, serta beban terpusat/merata.
3. `3. Parameter`: Mengatur mutu material ($f'_c, f_y, E$) dan selimut beton.
4. `4. Optimasi`: Menampilkan hasil perhitungan tulangan beton atau profil baja terbaik.
5. `5. Diagram`: Mengontrol tampilan diagram 2D (SFD, BMD, NFD, TFD).
6. `6. AI & Gestur`: Mengaktifkan pelacakan tangan webcam dan perintah suara.

### 3.3 Sistem Jendela Mengambang (Floating Windows)

Setiap panel di dalam aplikasi dirancang sebagai jendela mengambang modular:

- **Menggeser (Drag):** Klik pada bilah judul jendela (_header_) dan seret ke posisi mana pun di layar.
- **Meminimalkan (Minimize):** Klik ikon strip (`–`) di kanan atas jendela untuk menyembunyikan isi panel.
- **Menutup (Close):** Klik ikon silang (`×`) untuk menutup jendela (bisa dibuka kembali lewat Quick Dock Bar).
- **Fokus Otomatis:** Mengetuk jendela apa pun akan otomatis membawanya ke lapisan paling depan (_auto-z-index_).

### 3.4 Pengalih Sumbu Koordinat Dinamis (Z-Up vs Y-Up)

Di sudut kanan bawah viewport, terdapat tombol **3D Axis Switcher**:

- **Mode Z-Up (Default Rekayasa Sipil):** Sumbu $Z$ mengarah ke atas (vertikal), sumbu $X$ sepanjang bentang balok, dan sumbu $Y$ mengarah ke samping. Ini adalah konvensi resmi **SAP2000, AutoCAD, ETABS, dan Revit**.
- **Mode Y-Up (Default Grafika Komputer):** Sumbu $Y$ mengarah ke atas, sumbu $X$ horizontal, dan sumbu $Z$ kedalaman. Ini adalah konvensi **WebGL, Three.js, Blender, dan SolidWorks**.

### 3.5 HUD Defleksi & Colorbar Kontur Gaya Dalam

- **Kartu HUD Defleksi Maksimum (Kiri Bawah):** Menampilkan nilai lendutan terbesar balok dengan konvensi tanda negatif gravitasi ($\Delta_{\max} < 0$, misal `-14.20 mm`), rasio bentang izin (misal $\Delta = L/422$), serta status kelayakan lendutan terhadap batas izin $\Delta_{\text{izin}} = L/360$ atau $L/240$.
- **Colorbar Kontur Vertikal (Kanan Layar):** Indikator spektrum warna kontur dari nilai deformasi minimum (Biru Cyan) hingga deformasi maksimum (Merah Terang).

---

# BAB 4: PANDUAN PENGOPERASIAN LANGKAH DEMI LANGKAH

Berikut adalah alur operasional standar dari awal pemodelan hingga keluaran dokumen desain rekayasa.

### 4.1 Langkah 1: Memilih Material & Mode Pembebanan

1. Klik tombol **1. Material** pada Quick Dock Bar untuk memunculkan jendela material.
2. Pada tab **Tipe Material**, pilih salah satu opsi:
   - 🧱 **Beton Bertulang (SNI 2847:2019):** Untuk balok beton bertulang penampang persegi dengan konfigurasi tulangan lentur tarik, tulangan tekan, dan sengkang geser.
   - 🔩 **Profil Baja Struktural (SNI 1729:2020):** Untuk balok baja profil IWF (Wide Flange) atau BOX (Hollow Structural Section).
3. Pada tab **Paradigma Pembebanan**, pilih metode input:
   - **Mode A (Gaya Eksternal Interaktif):** Pengguna menginput beban titik ($P$) dan beban merata ($q$). Solver WASM akan menghitung reaksi tumpuan, gaya dalam, dan lendutan secara simultan.
   - **Mode B (Gaya Dalam Langsung):** Pengguna langsung menginput nilai gaya hasil analisis struktur global ($M_{ux}, M_{uy}, P_u, V_u, T_u$). Sangat cocok untuk verifikasi cepat dimensi penampang.

### 4.2 Langkah 2: Mengatur Bentang & 5 Kategori Tumpuan

1. Buka jendela **2. Beban**.
2. Masukkan panjang bentang balok ($L$) dalam satuan meter (misal `6.00 m`). Rentang bentang yang didukung adalah $0{,}5\text{ m}$ hingga $30\text{ m}$.
3. Pilih salah satu dari **5 Kategori Tumpuan (8 Variasi Orientasi)**:
   - **Sendi–Rol / Rol–Sendi (`PINNED_ROLLER`):** Tumpuan statis tertentu balok sederhana (_simply supported beam_).
   - **Kantilever (`CANTILEVER`):** Jepit di ujung kiri dan bebas di ujung kanan, atau sebaliknya.
   - **Jepit–Jepit (`FIXED_FIXED`):** Kedua ujung balok terjepit sempurna (statis tak tentu derajat 3).
   - **Jepit–Rol / Rol–Jepit (`FIXED_ROLLER`):** Satu ujung jepit dan satu ujung rol (statis tak tentu derajat 1).
   - **Jepit–Sendi / Sendi–Jepit (`FIXED_PINNED`):** Satu ujung jepit dan satu ujung sendi.
4. **Berat Sendiri Balok (_Include Self-Weight_):** Aktifkan opsi centang jika ingin beban berat sendiri penampang balok dihitung secara otomatis oleh sistem berdasarkan kerapatan massa material ($\gamma_{\text{beton}} = 24\text{ kN/m}^3$ atau $\gamma_{\text{baja}} = 78{,}5\text{ kN/m}^3$).

### 4.3 Langkah 3: Menginput Beban Balok (Mode A vs Mode B)

Jika Anda menggunakan **Mode A (Gaya Eksternal)**:

1. **Beban Terpusat (_Point Loads_ $P$):**
   - Klik **Tambah Beban Titik**.
   - Masukkan besar gaya $P$ dalam $\text{kN}$ (nilai positif mengarah ke bawah searah gravitasi).
   - Masukkan posisi jarak beban $x$ dari tumpuan kiri ($0 \le x \le L$).
2. **Beban Merata (_Distributed Loads_ $q$):**
   - Klik **Tambah Beban Merata**.
   - Masukkan intensitas beban $q$ dalam $\text{kN/m}$.
   - Tentukan posisi awal ($x_{\text{start}}$) dan posisi akhir ($x_{\text{end}}$) beban merata.
3. Perhatikan kanvas 3D: Balok akan langsung melengkung secara _real-time_ seketika slider atau angka beban diubah!

### 4.4 Langkah 4: Membaca & Menavigasi Diagram Gaya Dalam 2D (SFD, BMD, NFD, TFD)

1. Buka jendela **5. Diagram** pada Quick Dock Bar.
2. Centang diagram yang ingin ditampilkan:
   - 🔴 **SFD (Shear Force Diagram):** Diagram bidang gaya lintang/geser $V(x)$.
   - 🔵 **BMD (Bending Moment Diagram):** Diagram bidang momen lentur $M(x)$ lengkap dengan posisi momen puncak $M_{\max}$.
   - 🟢 **NFD (Normal Force Diagram):** Diagram bidang gaya aksial $N(x)$.
   - 🟡 **TFD (Torsional Force Diagram):** Diagram bidang momen torsi $T(x)$.
3. Pilih **Mode Tampilan Diagram**:
   - **Mode 1 (As Balok / In-Place):** Diagram menempel tepat pada sumbu balok 3D.
   - **Mode 2 (Bertumpuk Vertikal / Stacked):** Setiap diagram disusun berjajar dari atas ke bawah secara rapi.
   - **Mode 3 (Jendela Khusus / Window):** Diagram ditampilkan di panel 2D tersendiri untuk inspeksi presisi tinggi.

### 4.5 Langkah 5: Optimasi Penampang Beton Bertulang (SNI 2847:2019)

Jika Anda memilih material **Beton Bertulang**:

1. Buka jendela **3. Parameter** dan atur properti material:
   - Mutu kuat tekan beton $f'_c$ (misal $25\text{ MPa}$ atau $30\text{ MPa}$).
   - Mutu kuat leleh baja tulangan lentur $f_y$ (misal $420\text{ MPa}$ standar BJTS 420).
   - Mutu tulangan sengkang geser $f_{yt}$ (misal $280\text{ MPa}$ atau $420\text{ MPa}$).
   - Tebal selimut beton bersih $c_c$ (misal $40\text{ mm}$ untuk balok eksterior/interior).
   - Dimensi awal balok: Lebar $b_w$ (misal $300\text{ mm}$) dan Tinggi total $h$ (misal $500\text{ mm}$).
2. Buka jendela **4. Optimasi**. Sistem akan otomatis menghitung:
   - **Kebutuhan Tulangan Tarik ($A_s$):** Jumlah dan diameter batang tulangan (misal `4 D 19`).
   - **Tulangan Tekan ($A'\_s$):** Batang tulangan tekan jika momen lentur membutuhkan penampang ganda atau tulangan praktis gantung sengkang (misal `2 D 13`).
   - **Sengkang Geser ($V_u$ vs $\phi V_c + \phi V_s$):** Diameter dan jarak spasi sengkang tertutup (misal `D10 - 125 mm`) sesuai ketentuan spasi maksimum SNI 2847 Pasal 9.7.6.
   - **Kontrol Regangan Tarik Netto ($\epsilon_t$):** Memastikan penampang terkontrol tarik ($\epsilon_t \ge 0{,}005$) sehingga faktor reduksi kekuatan lentur $\phi = 0{,}90$.
3. **Pilihan Tampilan 3D Balok Beton:**
   - **Solid Mode:** Balok beton ditampilkan utuh dengan visualisasi potongan melintang di kedua ujungnya.
   - **X-Ray Rebar Cage Mode:** Selubung beton menjadi transparan dan menampilkan rangkaian sangkar tulangan memanjang 3D beserta barisan cincin sengkang di sepanjang bentang.

### 4.6 Langkah 6: Optimasi Penampang Profil Baja IWF & BOX (SNI 1729:2020)

Jika Anda memilih material **Baja Struktural**:

1. Buka jendela **3. Parameter** dan pilih mutu baja:
   - Pilihan standar: **BJ 37** ($f_y = 240\text{ MPa}$), **BJ 41** ($f_y = 250\text{ MPa}$), atau **BJ 55** ($f_y = 410\text{ MPa}$).
   - Panjang bentang tak tertumpu lateral ($L_b$) untuk evaluasi Tekuk Torsi Lateral (LTB).
2. Buka jendela **4. Optimasi**. Sistem akan mengevaluasi katalog profil baja secara otomatis dan menampilkan **Tabel Pemeringkatan Efisiensi Profil**:
   - Menghitung kapasitas momen nominal $\phi M_n$ berdasarkan kelangsingan sayap/badan dan panjang tak tertumpu $L_b$ terhadap batas plastis $L_p$ dan batas inelastis $L_r$.
   - Menghitung **Rasio Kapasitas (Demand-to-Capacity Ratio / DCR)**:
     $$\text{DCR} = \frac{M_u}{\phi M_n}$$
   - Profil diurutkan berdasarkan berat per meter ($W$) teringan yang memiliki rasio efisiensi aman:
     $$0{,}90 \le \text{DCR} \le 1{,}00$$
   - Profil yang tidak aman ($\text{DCR} > 1{,}00$) diberi tanda bahaya **OVERSTRESSED** berwarna merah.

### 4.7 Langkah 7: Ekspor Hasil Desain ke Software CAD, BIM, & CAE Industri

Setelah pemodelan dan optimasi selesai, Anda dapat mengekspor model ke software teknik lain:

1. Klik tombol **Ekspor CAD / BIM** di bagian bawah jendela Optimasi atau tekan shortcut keyboard `Ctrl + E`.
2. Dialog modal **Profile & Model Exporter** akan terbuka.
3. Pilih format file yang dibutuhkan:
   - 📐 **AutoCAD (`.dxf`):** Menghasilkan file gambar kerja 2D universal (format DXF AC1009) yang berisi geometri penampang presisi, dimensi, dan tulangan yang siap dibuka di AutoCAD 2007 s/d 2026.
   - 🏢 **Autodesk Revit / BIM (`.ifc`):** Menghasilkan model BIM IFC4 (_Design Transfer View_) yang berisi entitas kolom/balok struktural lengkap dengan metadata material dan properti profil.
   - 📊 **CSI SAP2000 (`.s2k`):** Menghasilkan script input teks SAP2000 lengkap dengan definisi joint koordinat, frame connectivity, material concrete/steel, dan load cases.
   - ⚙️ **SolidWorks / Fusion 360 (`.step`):** Menghasilkan file B-Rep 3D solid AP214 ISO 10303-21 yang dapat diedit di software mechanical CAD.
   - ⚡ **IDEA StatiCa (`.iom.xml`):** Menghasilkan file Open Model XML untuk analisis sambungan baja tingkat lanjut.
   - 🖨️ **3D Printing (`.stl`):** Menghasilkan jaring segitiga 3D balok melengkung untuk dicetak menggunakan printer 3D fisik.
   - 📄 **Lembar Kalkulasi (.PDF):** Mengunduh lembar laporan perhitungan teknik resmi berformat PDF lengkap dengan rumus, data input, dan diagram hasil.
4. Klik tombol **Unduh Berkas** pada format yang dipilih. File akan langsung tersimpan di folder _Downloads_ komputer Anda.

---

# BAB 5: PANDUAN FITUR KONTROL MULTIMODAL & ASISTEN AI

Salah satu keunggulan utama IBDS adalah kemampuan berinteraksi secara hands-free tanpa menyentuh keyboard dan mouse, sangat bermanfaat saat presentasi di depan kelas atau di meja kerja lab.

### 5.1 Kontrol Gerakan Tangan Tanpa Sentuh (MediaPipe Hand Tracking)

Fitur ini memanfaatkan kecerdasan buatan visi komputer (MediaPipe) untuk mendeteksi gestur tangan Anda melalui webcam:

1. Buka jendela **6. AI & Gestur** pada Quick Dock Bar.
2. Geser tombol toggle **Aktifkan Kamera Gestur Tangan** ke posisi **ON**.
3. Browser akan meminta izin akses kamera. Klik **Izinkan (_Allow_)**.
4. Jendela pratinjau kamera akan muncul di sudut kanan bawah memperlihatkan titik-titik persendian tangan (21 landmark tangan).
5. **Daftar Gestur Tangan:**
   - **Kursor Mengambang (Hover / Point):** Arahkan ujung jari telunjuk ke arah layar untuk menggerakkan kursor virtual berwarna Cyan.
   - **Mencubit (Pinch Gesture):** Rapatkan ujung jari telunjuk dan ibu jari untuk melakukan klik, memilih tombol, atau menarik (_drag_) posisi beban di atas balok 3D.
   - **Mengepal (Fist Gesture):** Mengepalkan tangan untuk menahan posisi kamera 3D.
   - **Buka Telapak Tangan (Open Palm):** Merotasi sudut pandang kamera 3D ke posisi semula.

### 5.2 Kontrol Perintah Suara (Voice Commands) & Daftar Perintah

Aplikasi dilengkapi pengenal suara terus-menerus (_Continuous Web Speech Recognition_) yang mendukung Bahasa Indonesia dan Bahasa Inggris:

1. Pada jendela **6. AI & Gestur**, aktifkan toggle **Dengarkan Suara (Voice Command)**.
2. Berikan izin akses mikrofon browser ketika diminta.
3. Ucapkan perintah dengan suara jelas. Setiap perintah yang berhasil dikenali akan dibalas dengan nada _chime_ lembut dan notifikasi hijau di pojok layar.
4. **Tabel Perintah Suara Lengkap:**

| Kategori        | Contoh Perintah Bahasa Indonesia             | Contoh Perintah Bahasa Inggris  | Aksi yang Dijalankan                     |
| :-------------- | :------------------------------------------- | :------------------------------ | :--------------------------------------- |
| **Material**    | _"ganti ke beton"_, _"pilih material beton"_ | _"switch to concrete"_          | Mengubah material ke Beton Bertulang     |
|                 | _"ganti ke baja"_, _"pilih profil baja"_     | _"switch to steel"_             | Mengubah material ke Baja Profil         |
| **Tumpuan**     | _"tumpuan kantilever"_, _"ubah jepit bebas"_ | _"set cantilever"_              | Mengubah tumpuan ke Kantilever           |
|                 | _"tumpuan sendi rol"_, _"balok sederhana"_   | _"set pinned roller"_           | Mengubah tumpuan ke Sendi-Rol            |
|                 | _"tumpuan jepit jepit"_                      | _"set fixed fixed"_             | Mengubah tumpuan ke Jepit-Jepit          |
| **Diagram**     | _"tampilkan sfd"_, _"buka diagram geser"_    | _"toggle sfd"_, _"show shear"_  | Menyalakan/mematikan diagram SFD         |
|                 | _"tampilkan bmd"_, _"diagram momen"_         | _"toggle bmd"_, _"show moment"_ | Menyalakan/mematikan diagram BMD         |
|                 | _"tampilkan nfd"_, _"diagram aksial"_        | _"toggle nfd"_                  | Menyalakan/mematikan diagram NFD         |
| **Filter Baja** | _"filter iwf"_, _"hanya baja wf"_            | _"filter iwf"_                  | Menyaring katalog hanya profil IWF       |
|                 | _"filter box"_, _"hanya profil pipa hollow"_ | _"filter box"_                  | Menyaring katalog hanya profil BOX       |
|                 | _"tampilkan semua baja"_                     | _"filter all steel"_            | Menampilkan seluruh katalog baja         |
| **Simulasi**    | _"jalankan optimasi"_, _"hitung penampang"_  | _"run optimization"_            | Memicu algoritma optimasi penampang      |
|                 | _"reset simulasi"_, _"kembalikan awal"_      | _"reset simulation"_            | Mengembalikan parameter ke nilai default |
| **Ekspor**      | _"ekspor autocad"_, _"unduh dxf"_            | _"export dxf"_                  | Mengunduh file AutoCAD DXF               |
|                 | _"ekspor sap2000"_, _"unduh s2k"_            | _"export sap2000"_              | Mengunduh file script SAP2000 S2K        |
|                 | _"ekspor bim"_, _"unduh ifc"_                | _"export ifc"_                  | Mengunduh model Revit IFC                |

### 5.3 Asisten AI Konsultan Rekayasa Struktur

Di dalam jendela **6. AI & Gestur**, terdapat panel percakapan langsung dengan AI Konsultan Struktur:

- Anda dapat menanyakan pertanyaan teknis seperti:
  - _"Mengapa profil IWF 300x150x6.5x9 mengalami keruntuhan LTB pada bentang 6 meter?"_
  - _"Berapa batas lendutan izin untuk balok pemikul dinding bata menurut SNI?"_
  - _"Jelaskan cara kerja blok tegangan ekivalen Whitney pada beton bertulang!"_
- AI akan menjawab secara ilmiah dengan mencantumkan pasal-pasal standar SNI terkait dan memberikan saran optimasi dimensi penampang.

### 5.4 Konfigurasi Kunci API Google Gemini & Sistem Failover Cadangan (Backup Keys)

Layanan AI pada IBDS (Intent Router, Konsultan Struktur, Live Speech Voice Synthesis, dan Release Pipeline) ditenagai oleh **Google Gemini API**. Google AI Studio Free Tier menerapkan batas laju kuota gratis (15 permintaan per menit / 1.500 permintaan per hari).

Untuk memastikan aplikasi tidak pernah terhenti atau error saat kuota kunci utama habis (HTTP 429 _Too Many Requests_ / `RESOURCE_EXHAUSTED` atau HTTP 400 _API_KEY_INVALID_), IBDS dilengkapi dengan **Sistem Failover dan Rotasi Kunci Cadangan Otomatis** dengan enkripsi header keamanan `x-goog-api-key` dan _progressive cooldown backoff_.

#### 1. Cara Menambahkan Kunci Cadangan di File `.env`

Buka file `.env` di folder proyek, Anda dapat memilih salah satu metode konfigurasi yang paling nyaman:

- **Metode A: Kunci Cadangan Tunggal (Paling Praktis)**

  ```bash
  # Kunci Utama
  GEMINI_API_KEY=AIzaSyD-KunciUtamaGoogleStudio1234567
  # Kunci Cadangan (Fallback otomatis)
  GEMINI_API_KEY_BACKUP=AIzaSyB-KunciCadanganGoogleStudio9876543
  ```

- **Metode B: Multi-Kunci Dipisahkan Tanda Koma (`GEMINI_API_KEYS`)**

  ```bash
  GEMINI_API_KEYS=AIzaSy-KunciUtama,AIzaSy-KunciCadangan1,AIzaSy-KunciCadangan2
  ```

- **Metode C: Kunci Terindeks (`GEMINI_API_KEY_1..10`)**
  ```bash
  GEMINI_API_KEY_1=AIzaSy-Kunci1
  GEMINI_API_KEY_2=AIzaSy-Kunci2
  GEMINI_API_KEY_3=AIzaSy-Kunci3
  ```

> [!NOTE]
> Sistem secara cerdas memfilter placeholder bawaan (`your_gemini_api_key_here`), menghapus tanda kutip (`"..."` atau `'...'`), memangkas spasi berlebih, dan menduplikasi kunci secara otomatis.

#### 2. Cara Kerja Sistem Failover

1. **Deteksi Laju Kuota & Kegagalan Kredensial:** Mengenali respons HTTP 429 (`RESOURCE_EXHAUSTED`), HTTP 401 (`UNAUTHENTICATED`), HTTP 403 (`PERMISSION_DENIED`), dan HTTP 400 (`API_KEY_INVALID`).
2. **Rotasi Instan Tanpa Delay:** Begitu terdeteksi, kunci yang terkena limit langsung diberi status _cooldown_ dan sistem seketika memindahkan permintaan ke kunci cadangan berikutnya.
3. **Progressive Backoff Scaling:** Durasi cooldown berskala eksponensial (60s $\to$ 120s $\to$ 240s $\to$ maks 900s) jika kunci berulang kali gagal, dan otomatis di-reset saat panggilan berhasil.
4. **Keamanan Kredensial:** Kunci API dikirim melalui HTTP Header `x-goog-api-key`, mengeliminasi paparan token di query URL dan log error browser/server.
5. **Jaminan Fallback Offline:** Jika seluruh kunci API habis atau perangkat offline, aplikasi secara otomatis beralih ke engine deterministik lokal (RegEx Intent Matcher & Heuristik SNI 2847 / SNI 1729) sehingga antarmuka tetap berjalan 100% lancar tanpa crash.

#### 3. Verifikasi Konfigurasi Kunci Cadangan

Jalankan pengujian unit mandiri melalui terminal:

```bash
bun test tests/config/app-config.test.ts tests/ai/gemini-api-failover.test.ts
```

Jika konfigurasi valid, seluruh 50+ pengujian unit rotasi kunci dan failover akan berstatus **`pass`**.

---

# BAB 6: PEMELIHARAAN SISTEM, TROUBLESHOOTING & FAQ

### 6.1 Kendala Akselerasi Hardware WebGL

- **Gejala:** Kanvas 3D berwarna hitam pekat, atau muncul pesan _"WebGL context lost"_.
- **Penyebab:** Akselerasi perangkat keras (_Hardware Acceleration_) dinonaktifkan di peramban web atau driver GPU komputer belum diperbarui.
- **Solusi:**
  1. Pada Google Chrome/Edge, buka menu **Settings** $\to$ **System**.
  2. Pastikan opsi **"Use graphics acceleration when available"** dalam posisi **AKTIF (ON)**.
  3. Ketikkan `chrome://gpu` pada bilah alamat untuk memastikan status _WebGL 2.0_ berstatus _Hardware Accelerated_.
  4. Lakukan restart browser.

### 6.2 Kendala Izin Kamera & Pelacakan Tangan

- **Gejala:** Kamera tidak menyala atau muncul ikon gembok/silang merah pada bilah alamat browser.
- **Penyebab:** Izin akses webcam diblokir secara permanen oleh pengaturan keamanan situs.
- **Solusi:**
  1. Klik ikon pengaturan perizinan di sebelah kiri bilah URL (ikon slider atau gembok).
  2. Ubah perizinan **Camera** menjadi **Allow (Izinkan)**.
  3. Lakukan _refresh_ halaman (tekan `F5`).
  4. Pastikan pencahayaan ruangan memadai agar kecerdasan buatan MediaPipe dapat mendeteksi persendian telapak tangan Anda dengan kontras yang baik.

### 6.3 Kendala Pengenalan Suara (Microphone)

- **Gejala:** Suara perintah telah diucapkan tetapi tidak memicu aksi atau status menampilkan _"Voice Listening Muted"_.
- **Penyebab:** Mikrofon salah memilih input device atau browser memblokir audio permission.
- **Solusi:**
  1. Periksa izin mikrofon di bilah URL browser dan pilih **Allow**.
  2. Buka Pengaturan Suara Windows (_Sound Settings_) dan pastikan mikrofon default yang aktif menghasilkan input bar volume ketika Anda berbicara.
  3. Pastikan tidak ada software meeting (Zoom/Teams) yang mengunci akses eksklusif mikrofon Anda (_Exclusive Mic Mode_).

### 6.4 Kendala Pembacaan File Ekspor di Software Eksternal

- **Kendala AutoCAD (.dxf):** File `.dxf` dari IBDS menggunakan standar **AutoCAD Release 12 / AC1009 ASCII**, standar paling kompatibel di dunia. File ini dijamin dapat dibuka langsung oleh versi AutoCAD apa pun dari AutoCAD 2000 hingga AutoCAD 2026 tanpa perlu konverter tambahan.
- **Kendala SolidWorks (.step):** Jika SolidWorks meminta opsi import, pilih opsi **"Default B-Rep Surface/Solid"** dengan unit milimeter.
- **Kendala SAP2000 (.s2k):** Buka SAP2000, pilih menu **File $\to$ Import $\to$ SAP2000 .s2k Text File**. Jangan gunakan menu _Open_, melainkan menu _Import_.

---

# BAB 7: GLOSARIUM ISTILAH & NOTASI STANDAR TEKNIK SIPIL

| Simbol / Istilah     | Nama Besaran & Satuan                             | Penjelasan Fisis & Acuan                                                                       |
| :------------------- | :------------------------------------------------ | :--------------------------------------------------------------------------------------------- |
| **$L$**              | Panjang Bentang ($\text{m}$ / $\text{mm}$)        | Jarak horizontal bersih antara dua sumbu tumpuan balok.                                        |
| **$P$**              | Beban Terpusat ($\text{kN}$)                      | Gaya titik eksternal yang bekerja tegak lurus sumbu batang.                                    |
| **$q$**              | Beban Merata ($\text{kN/m}$)                      | Intensitas beban terbagi rata di sepanjang bentang balok.                                      |
| **$M_u$**            | Momen Lentur Terfaktor ($\text{kN}\cdot\text{m}$) | Momen lentur ultimate hasil kombinasi pembebanan struktur.                                     |
| **$V_u$**            | Gaya Geser Terfaktor ($\text{kN}$)                | Gaya lintang maksimum terfaktor yang harus dipikul sengkang.                                   |
| **$\Delta\_{\max}$** | Lendutan Maksimum ($\text{mm}$)                   | Deformasi translasi vertikal terbesar balok (konvensi $\Delta < 0$).                           |
| **$L/\Delta$**       | Rasio Kelayakan Lendutan                          | Perbandingan bentang terhadap defleksi izin (standar: $L/360$ atau $L/240$).                   |
| **$f'\_c$**          | Kuat Tekan Beton ($\text{MPa}$)                   | Kuat tekan karakteristik silinder beton umur 28 hari (SNI 2847).                               |
| **$f_y$**            | Kuat Leleh Baja Tulangan ($\text{MPa}$)           | Tegangan leleh baja tulangan memanjang lentur (BJTS).                                          |
| **$A_s$**            | Luas Tulangan Tarik ($\text{mm}^2$)               | Kebutuhan total luas penampang batang tulangan lentur tarik.                                   |
| **$A'\_s$**          | Luas Tulangan Tekan ($\text{mm}^2$)               | Kebutuhan tulangan baja pada serat beton yang mengalami tekan.                                 |
| **$s$**              | Jarak Spasi Sengkang ($\text{mm}$)                | Jarak as-ke-as antar sengkang geser tertutup arah memanjang.                                   |
| **$\epsilon_t$**     | Regangan Tarik Netto                              | Regangan pada serat tulangan baja tarik terluar (batas $\ge 0{,}005$).                         |
| **$\phi$**           | Faktor Reduksi Kekuatan                           | Koefisien reduksi keamanan SNI ($\phi = 0{,}90$ lentur, $\phi = 0{,}75$ geser).                |
| **$E$**              | Modulus Elastisitas ($\text{MPa}$)                | Kekakuan elastis bahan ($E_{\text{baja}} = 200.000\text{ MPa}$, $E_c = 4700\sqrt{f'_c}$).      |
| **$I_x$**            | Momen Inersia Penampang ($\text{mm}^4$)           | Momen inersia sumbu kuat penampang terhadap sumbu lentur utama.                                |
| **LTB**              | _Lateral-Torsional Buckling_                      | Fenomena tekuk torsi lateral pada balok profil baja tak terkekang.                             |
| **$L_b$**            | _Unbraced Length_ ($\text{mm}$)                   | Jarak bebas antar pengekang lateral pada balok baja.                                           |
| **DCR**              | _Demand-to-Capacity Ratio_                        | Rasio efisiensi kapasitas ($M_u / \phi M_n$). Target aman: $0{,}90 \le \text{DCR} \le 1{,}00$. |
| **WASM**             | _WebAssembly_                                     | Format instruksi biner komputasi berperforma mendekati native di browser.                      |

---

> **Catatan Konversi ke Dokumen Word (.docx):**  
> Dokumen ini disusun dengan hierarki Markdown standar (`#`, `##`, `###`), tabel Markdown, alert block, dan formula matematis KaTeX. Dokumen ini dapat langsung diimpor ke aplikasi konverter dokumen seperti Pandoc, Typora, VS Code Markdown to DOCX Converter, atau AI pengolah dokumen untuk menghasilkan berkas **Buku Panduan Pengguna (.docx)** resmi siap cetak.
