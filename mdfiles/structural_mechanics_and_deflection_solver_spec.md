# 📐 Spesifikasi Mekanika Struktur, Solver Lendutan (Rust WASM), & Visualisasi Hybrid 3D/2D

> **Dokumen Spesifikasi Inti (`mdfiles/structural_mechanics_and_deflection_solver_spec.md`)**
> Dokumen ini merupakan acuan matematika, algoritma numerik, dan spesifikasi visual untuk **Engine Mekanika Struktur & Renderer 3D/2D** pada **Interactive Beam Deflection & Structural Design Simulator**.
> Mengikuti arsitektur **Opsi B (Hybrid Rust WASM + TypeScript)**:
>
> - **Rust WebAssembly (`crates/mechanics-3d-wasm/`):** Menangani komputasi _real-time_ 60–120 FPS meliputi perhitungan reaksi tumpuan (statis tertentu & tak tentu), array diagram gaya dalam (SFD, NFD, BMD, TFD), integrasi kurva elastis Euler-Bernoulli, transformasi sistem koordinat dinamis (`Y-Up` / `Z-Up` / Kustom), serta pembuatan _3D Extruded Mesh Buffer_ & _3D Rebar Cage Wireframe_ tanpa alokasi _Garbage Collector_.
>
> - **TypeScript Core (`src/core/concrete/`, `src/core/steel/`, & `src/core/exporters/`):** Menangani evaluasi dan optimasi penampang berdasarkan standar **SNI 2847:2019** (Beton) dan **SNI 1729:2020** (Baja IWF & BOX), serta ekspor multi-format ke perangkat lunak CAD/BIM/CAE eksternal (detail di `mdfiles/cad_bim_cae_export_specification.md`).

## 🧭 1. Konvensi Tanda (Lendutan Negatif) & Sistem Koordinat Sumbu Dinamis ($X, Y, Z$)

### 1.1. Sumbu Intrinsik Balok $(s, u, v)$ & Konvensi Lendutan Negatif ($\Delta < 0$)

Di dalam solver internal Rust WASM, perhitungan dilakukan pada koordinat intrinsik balok $(s, u, v)$ dengan aturan tanda yang konsisten terhadap hukum kalkulus dan mekanika teknik:

| Besaran Intrinsik               |              Simbol              | Arah Positif ($+$) & Negatif ($-$)                                                                         | Peran pada Visualisasi 3D, 2D, & Ekspor CAD/CAE                                                                                                                                                                          |
| :------------------------------ | :------------------------------: | :--------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sumbu Memanjang Balok**       |               $s$                | Dari ujung kiri A ($s = 0$) ke ujung kanan B ($s = L$)                                                     | Sumbu utama bentang balok dan absis grafik SFD/NFD/BMD/TFD                                                                                                                                                               |
| **Sumbu Vertikal (Atas–Bawah)** |               $v$                | Ke atas = Positif ($+$), **Ke bawah (searah gravitasi) = Negatif ($-$)**                                   | **Lendutan ke bawah akibat beban gravitasi selalu bernilai NEGATIF ($v(s) < 0$ atau $\Delta < 0$)**; lendutan ke atas (_uplift/camber_) bernilai positif ($v(s) > 0$)                                                    |
| **Sumbu Lateral (Lebar)**       |               $u$                | Mengikuti aturan tangan kanan ($\hat{\mathbf{s}} \times \hat{\mathbf{v}} = \hat{\mathbf{u}}$)              | Sumbu lebar penampang ($B$ atau $b_w$) pada _extrusion_ 3D                                                                                                                                                               |
| **Gaya Aksial Dalam**           |          $N(s)$ / $P_u$          | Tarik = Positif ($+$), Tekan = Negatif ($-$)                                                               | Digunakan pada diagram NFD dan evaluasi biaxial baja                                                                                                                                                                     |
| **Gaya Geser Dalam**            |          $V(s)$ / $V_u$          | Geser jarum jam (kiri naik, kanan turun) = Positif ($+$)                                                   | Digunakan pada diagram SFD dan desain sengkang/geser                                                                                                                                                                     |
| **Momen Lentur Mayor**          | $M_{\text{major}}(s)$ / $M_{ux}$ | Serat bawah tertarik (_sagging_ / senyum) = Positif ($+$), serat atas tertarik (_hogging_) = Negatif ($-$) | Karena $\frac{d^2 v}{ds^2} = +\frac{M_{\text{major}}(s)}{E I_{\text{major}}}$, momen positif (_sagging_) secara alami menghasilkan kurva cekung ke atas dengan **nilai lendutan negatif ($v < 0$)** di sepanjang bentang |
| **Momen Torsi Dalam**           |          $T(s)$ / $T_u$          | Puntiran terhadap sumbu memanjang aturan tangan kanan = Positif ($+$)                                      | Digunakan pada diagram TFD dan evaluasi torsi profil baja                                                                                                                                                                |

### 1.2. Sistem Koordinat Global Dinamis (`Y-Up` vs `Z-Up` / Kustom $X\text{-}Y\text{-}Z$)

Karena perangkat lunak rekayasa menggunakan konvensi sumbu vertikal (_Up-Axis_) yang berbeda-beda, pengguna dapat mengganti orientasi sumbu global $(X, Y, Z)$ secara langsung di kanvas melalui **Coordinate Axis Switcher**:

| Mode Preset Koordinat                    |      Sumbu Memanjang ($s$)      |               Sumbu Vertikal / Atas–Bawah ($v$)               |                          Sumbu Lateral / Lebar ($u$)                           | Kompatibilitas Software Eksternal                                         |
| :--------------------------------------- | :-----------------------------: | :-----------------------------------------------------------: | :----------------------------------------------------------------------------: | :------------------------------------------------------------------------ |
| **Mode `Z-Up` (Standar Struktur & BIM)** |   **$X$** ($0 \rightarrow L$)   |   **$Z$** ($+Z$ Atas, **Lendutan ke bawah = $-\Delta_Z$**)    |                           **$Y$** (Lebar $B / b_w$)                            | **SAP2000, ETABS, Autodesk Revit, AutoCAD 3D, IDEA StatiCa, Tekla, IFC4** |
| **Mode `Y-Up` (Standar WebGL & MCAD)**   |   **$X$** ($0 \rightarrow L$)   |   **$Y$** ($+Y$ Atas, **Lendutan ke bawah = $-\Delta_Y$**)    |                           **$Z$** (Lebar $B / b_w$)                            | **SolidWorks, Three.js / WebGL, STAAD.Pro, ANSYS**                        |
| **Mode `Custom Axis Mapping`**           | Pilihan bebas $\in \{X, Y, Z\}$ | Pilihan bebas $\in \{X, Y, Z\}$ (tegak lurus sumbu memanjang) | Otomatis $\hat{\mathbf{e}}_{\text{len}} \times \hat{\mathbf{e}}_{\text{vert}}$ | Menyesuaikan orientasi UCS (_User Coordinate System_) proyek pengguna     |

Transformasi dari koordinat intrinsik balok $(s, u, v)$ ke koordinat dunia 3D $(X, Y, Z)$ dilakukan di Rust WASM menggunakan matriks permutasi ortogonal $\mathbf{P}_{\text{axis}}$:

$$
\begin{bmatrix} X \\ Y \\ Z \end{bmatrix} = \mathbf{P}_{\text{axis}} \begin{bmatrix} s \\ u \\ v \end{bmatrix}, \qquad \text{dengan } \mathbf{P}_{\text{Y-Up}} = \begin{bmatrix} 1 & 0 & 0 \\ 0 & 0 & 1 \\ 0 & 1 & 0 \end{bmatrix}, \quad \mathbf{P}_{\text{Z-Up}} = \begin{bmatrix} 1 & 0 & 0 \\ 0 & 1 & 0 \\ 0 & 0 & 1 \end{bmatrix}
$$

Saat pengguna mengubah sumbu vertikal dari $Y$ menjadi $Z$ (atau sebaliknya), _3D Axis Gizmo_ di pojok kanvas, label koordinat di _floating window_, serta orientasi file ekspor (`.dxf`, `.s2k`, `.ifc`, `.step`) otomatis menyesuaikan secara instan tanpa perlu menghitung ulang matriks kekakuan balok.

## 🏛️ 2. Klasifikasi & Rumus Reaksi untuk 5 Jenis Tumpuan (8 Variasi Orientasi)

Simulator mendukung **5 kategori tumpuan klasik** (yang membentuk **8 variasi orientasi** antara ujung kiri A pada $s = 0$ dan ujung kanan B pada $s = L$).

### 2.1. Matriks Kondisi Batas (_Boundary Conditions_) & Derajat Ketidaktentuan

| ID Konfigurasi     | Nama Tumpuan (A di $s=0$ — B di $s=L$)   | Status Statika Lentur  | Kondisi Batas di Ujung A ($s = 0$) | Kondisi Batas di Ujung B ($s = L$) | Kekangan Aksial Horizontal ($u_s$)            |
| :----------------- | :--------------------------------------- | :--------------------: | :--------------------------------- | :--------------------------------- | :-------------------------------------------- |
| `CANTILEVER_LEFT`  | **Kantilever Kiri** (Jepit A — Bebas B)  | Statis Tertentu ($0$)  | $v(0) = 0, \; \theta(0) = 0$       | $V(L) = 0, \; M(L) = 0$            | Ditahan di A ($R_{As} = -\sum F_s$)           |
| `CANTILEVER_RIGHT` | **Kantilever Kanan** (Bebas A — Jepit B) | Statis Tertentu ($0$)  | $V(0) = 0, \; M(0) = 0$            | $v(L) = 0, \; \theta(L) = 0$       | Ditahan di B ($R_{Bs} = -\sum F_s$)           |
| `PINNED_ROLLER`    | **Sendi–Rol** (Sendi A — Rol B)          | Statis Tertentu ($0$)  | $v(0) = 0, \; M(0) = 0$            | $v(L) = 0, \; M(L) = 0$            | Ditahan di Sendi A ($R_{As} = -\sum F_s$)     |
| `ROLLER_PINNED`    | **Rol–Sendi** (Rol A — Sendi B)          | Statis Tertentu ($0$)  | $v(0) = 0, \; M(0) = 0$            | $v(L) = 0, \; M(L) = 0$            | Ditahan di Sendi B ($R_{Bs} = -\sum F_s$)     |
| `FIXED_FIXED`      | **Jepit–Jepit** (Jepit A — Jepit B)      | Statis Tak Tentu ($2$) | $v(0) = 0, \; \theta(0) = 0$       | $v(L) = 0, \; \theta(L) = 0$       | Ditahan di A & B (proporsional kekakuan $EA$) |
| `FIXED_ROLLER`     | **Jepit–Rol** (Jepit A — Rol B)          | Statis Tak Tentu ($1$) | $v(0) = 0, \; \theta(0) = 0$       | $v(L) = 0, \; M(L) = 0$            | Ditahan di Jepit A ($R_{As} = -\sum F_s$)     |
| `ROLLER_FIXED`     | **Rol–Jepit** (Rol A — Jepit B)          | Statis Tak Tentu ($1$) | $v(0) = 0, \; M(0) = 0$            | $v(L) = 0, \; \theta(L) = 0$       | Ditahan di Jepit B ($R_{Bs} = -\sum F_s$)     |
| `FIXED_PINNED`     | **Jepit–Sendi** (Jepit A — Sendi B)      | Statis Tak Tentu ($1$) | $v(0) = 0, \; \theta(0) = 0$       | $v(L) = 0, \; M(L) = 0$            | Ditahan di A & B ($u_A = 0, u_B = 0$)         |
| `PINNED_FIXED`     | **Sendi–Jepit** (Sendi A — Jepit B)      | Statis Tak Tentu ($1$) | $v(0) = 0, \; M(0) = 0$            | $v(L) = 0, \; \theta(L) = 0$       | Ditahan di A & B ($u_A = 0, u_B = 0$)         |

> **Catatan Rekayasa (`Jepit–Rol` vs `Jepit–Sendi`):**
> Berdasarkan teori balok elastis orde pertama Euler-Bernoulli, tumpuan Sendi maupun Rol di ujung non-jepit sama-sama mengizinkan rotasi bebas ($M = 0$) dan menahan translasi vertikal ($v = 0$). Oleh karena itu, distribusi gaya geser $V(s)$, momen lentur $M(s)$, dan kurva lendutan vertikal $v(s)$ untuk **Jepit–Sendi identik dengan Jepit–Rol** (begitu pula **Sendi–Jepit identik dengan Rol–Jepit**). Perbedaan keduanya terletak pada **reaksi gaya aksial horizontal ($N_u$)** dan **visualisasi simbol tumpuan 2D di layar** (segitiga Sendi tanpa roda vs segitiga Rol dengan 2 roda).

### 2.2. Rumus Analitis Eksak (_Closed-Form Reference_) dengan Konvensi Lendutan Negatif ($\Delta_{\max} < 0$)

Tabel berikut menyajikan rumus analitis eksak reaksi vertikal ke atas ($R_A, R_B$), momen jepit ujung ($M_A, M_B$), dan **lendutan ekstrem ke bawah ($\Delta\_{\max} < 0$)** akibat beban gravitasi:

#### A. Akibat Beban Merata Penuh $q$ ke Bawah (Termasuk Berat Sendiri $q_{\text{sw}} = \gamma \cdot A$) Sepanjang Bentang $L$

| Jenis Tumpuan                  | Reaksi Vertikal $R_A$ (di $s=0$) | Reaksi Vertikal $R_B$ (di $s=L$) | Momen Ujung $M_A$ (di $s=0$) | Momen Ujung $M_B$ (di $s=L$) |   Momen Lapangan Maksimum $M_{\text{pos,max}}$   | Lendutan Maksimum ke Bawah $\Delta_{\max}$ (Bertanda Minus) |
| :----------------------------- | :------------------------------: | :------------------------------: | :--------------------------: | :--------------------------: | :----------------------------------------------: | :---------------------------------------------------------: |
| **Kantilever Kiri** (Jepit A)  |              $q L$               |               $0$                |     $-\dfrac{q L^2}{2}$      |             $0$              |             $0$ (seluruhnya negatif)             |            $-\dfrac{q L^4}{8 E I}$ (di $s = L$)             |
| **Kantilever Kanan** (Jepit B) |               $0$                |              $q L$               |             $0$              |     $-\dfrac{q L^2}{2}$      |             $0$ (seluruhnya negatif)             |            $-\dfrac{q L^4}{8 E I}$ (di $s = 0$)             |
| **Sendi–Rol / Rol–Sendi**      |         $\dfrac{q L}{2}$         |         $\dfrac{q L}{2}$         |             $0$              |             $0$              |       $+\dfrac{q L^2}{8}$ (di $s = 0,5 L$)       |        $-\dfrac{5 q L^4}{384 E I}$ (di $s = 0,5 L$)         |
| **Jepit–Jepit**                |         $\dfrac{q L}{2}$         |         $\dfrac{q L}{2}$         |     $-\dfrac{q L^2}{12}$     |     $-\dfrac{q L^2}{12}$     |      $+\dfrac{q L^2}{24}$ (di $s = 0,5 L$)       |         $-\dfrac{q L^4}{384 E I}$ (di $s = 0,5 L$)          |
| **Jepit–Rol / Jepit–Sendi**    |        $\dfrac{5 q L}{8}$        |        $\dfrac{3 q L}{8}$        |     $-\dfrac{q L^2}{8}$      |             $0$              | $+\dfrac{9 q L^2}{128}$ (di $s = \frac{3}{8} L$) |        $-\dfrac{q L^4}{185 E I}$ (di $s = 0,5785 L$)        |
| **Rol–Jepit / Sendi–Jepit**    |        $\dfrac{3 q L}{8}$        |        $\dfrac{5 q L}{8}$        |             $0$              |     $-\dfrac{q L^2}{8}$      | $+\dfrac{9 q L^2}{128}$ (di $s = \frac{5}{8} L$) |        $-\dfrac{q L^4}{185 E I}$ (di $s = 0,4215 L$)        |

#### B. Akibat Beban Terpusat $P$ ke Bawah pada Jarak $a$ dari Tumpuan A (dengan $b = L - a$)

| Jenis Tumpuan                  |  Momen Ujung $M_A$ (di $s=0$)   |  Momen Ujung $M_B$ (di $s=L$)   |  Reaksi Vertikal $R_A$ (di $s=0$)  |  Reaksi Vertikal $R_B$ (di $s=L$)  |     Lendutan di Titik Beban / Tengah ($\Delta < 0$)     |
| :----------------------------- | :-----------------------------: | :-----------------------------: | :--------------------------------: | :--------------------------------: | :-----------------------------------------------------: |
| **Kantilever Kiri** (Jepit A)  |             $-P a$              |               $0$               |                $P$                 |                $0$                 |     $-\dfrac{P a^2 (3 L - a)}{6 E I}$ (di $s = L$)      |
| **Kantilever Kanan** (Jepit B) |               $0$               |             $-P b$              |                $0$                 |                $P$                 |     $-\dfrac{P b^2 (3 L - b)}{6 E I}$ (di $s = 0$)      |
| **Sendi–Rol / Rol–Sendi**      |               $0$               |               $0$               |          $\dfrac{P b}{L}$          |          $\dfrac{P a}{L}$          |       $-\dfrac{P a^2 b^2}{3 E I L}$ (di $s = a$)        |
| **Jepit–Jepit**                |     $-\dfrac{P a b^2}{L^2}$     |     $-\dfrac{P a^2 b}{L^2}$     |   $\dfrac{P b^2 (3a + b)}{L^3}$    |   $\dfrac{P a^2 (a + 3b)}{L^3}$    |      $-\dfrac{P a^3 b^3}{3 E I L^3}$ (di $s = a$)       |
| **Jepit–Rol / Jepit–Sendi**    | $-\dfrac{P a b (L + b)}{2 L^2}$ |               $0$               | $\dfrac{P b (3 L^2 - b^2)}{2 L^3}$ |  $\dfrac{P a^2 (3 L - a)}{2 L^3}$  | $-\dfrac{P a^2 b^3 (3 L + a)}{12 E I L^3}$ (di $s = a$) |
| **Rol–Jepit / Sendi–Jepit**    |               $0$               | $-\dfrac{P a b (L + a)}{2 L^2}$ |  $\dfrac{P b^2 (3 L - b)}{2 L^3}$  | $\dfrac{P a (3 L^2 - a^2)}{2 L^3}$ | $-\dfrac{P a^3 b^2 (3 L + b)}{12 E I L^3}$ (di $s = a$) |

### 2.3. Metode Umum Superposisi & Kompatibilitas Fleksibilitas Diskrit di Rust WASM

Pada **Mode A (Gaya Eksternal Interaktif)**, pengguna dapat menambahkan kombinasi beban titik $P_i$, beban merata parsial $q_j$ pada rentang $[s_{1j}, s_{2j}]$, dan momen eksternal $M_k$ secara bebas. Solver menerapkan **Metode Fleksibilitas Konsisten (_Consistent Deformation Method_)** dalam 3 langkah berkecepatan $O(M)$:

1. **Langkah 1 — Hitung Kurva Momen Statis Dasar $M_0(s)$ pada Struktur Primer Sendi–Rol:**
   Dengan fungsi singularitas Macaulay $\langle s - a \rangle^n = \max(0, s - a)^n$, gaya geser $V_0(s)$ dan momen lentur $M_0(s)$ akibat seluruh beban eksternal pada struktur dasar Sendi–Rol dihitung untuk setiap titik diskrit $s_m = \frac{m}{M-1} L$:

   $$
   R_{A0} = \frac{1}{L}\left[ \sum_i P_i (L - a_i) + \sum_j q_j (s_{2j} - s_{1j})\left(L - \frac{s_{1j} + s_{2j}}{2}\right) - \sum_k M_k \right]
   $$

   $$
   M_0(s) = R_{A0} s - \sum_i P_i \langle s - a_i \rangle^1 - \sum_j \frac{q_j}{2}\left(\langle s - s_{1j} \rangle^2 - \langle s - s_{2j} \rangle^2\right) + \sum_k M_k \langle s - a_k \rangle^0
   $$

2. **Langkah 2 — Tentukan Momen Ujung Jepit ($M_A, M_B$) Berdasarkan Integral Mohr ($\Phi_A, \Phi_B$):**
   Hitung dua integral momen terhadap sumbu $s$ menggunakan aturan trapesium pada array $M_0(s)$:

   $$
   \Phi_A = \frac{1}{L} \int_0^L M_0(s) \left(1 - \frac{s}{L}\right) ds, \qquad \Phi_B = \frac{1}{L} \int_0^L M_0(s) \left(\frac{s}{L}\right) ds
   $$

   Maka untuk setiap konfigurasi tumpuan non-kantilever, momen ujung di A dan B adalah:
   - **Sendi–Rol / Rol–Sendi:** $M_A = 0, \quad M_B = 0$
   - **Jepit–Rol / Jepit–Sendi:** $M_A = -\frac{3}{L} \Phi_A, \quad M_B = 0$
   - **Rol–Jepit / Sendi–Jepit:** $M_A = 0, \quad M_B = -\frac{3}{L} \Phi_B$
   - **Jepit–Jepit:** $M_A = -\frac{2}{L} (2 \Phi_A - \Phi_B), \quad M_B = -\frac{2}{L} (2 \Phi_B - \Phi_A)$
     _(Untuk Kantilever Kiri/Kanan, momen dihitung langsung dari kesetimbangan statis terhadap ujung bebas)._

3. **Langkah 3 — Superposisi Momen Akhir $M\_{\text{major}}(s)$ dan Reaksi Vertikal Akhir ($R_A, R_B$):**

   $$
   M_{\text{major}}(s) = M_0(s) + M_A \left(1 - \frac{s}{L}\right) + M_B \left(\frac{s}{L}\right)
   $$

   $$
   R_A = R_{A0} + \frac{M_B - M_A}{L}, \qquad R_B = \left(\sum F_{\text{down}}\right) - R_A
   $$

## 📊 3. Solver Euler-Bernoulli (Lendutan Bertanda Negatif) & Interpolator Mode B

### 3.1. Integrasi Numerik Trapesium Ganda Euler-Bernoulli ($O(M)$)

Hubungan kelengkungan penampang $\kappa(s)$, rotasi $\theta(s)$, dan simpangan vertikal $v(s)$ (di mana $+v$ ke atas dan **$-v$ ke bawah**) mengikuti persamaan diferensial garis elastis Euler-Bernoulli:

$$
\frac{d^2 v}{ds^2} = \kappa(s) = +\frac{M_{\text{major}}(s)}{E I_{\text{major}}}
$$

> **Verifikasi Tanda Matematis:** Ketika beban gravitasi menekan balok Sendi–Rol ke bawah, momen lapangan bernilai positif ($M_{\text{major}}(s) > 0$, _sagging_), sehingga kurva melengkung cekung ke atas ($\frac{d^2 v}{ds^2} > 0$). Dengan syarat batas $v(0) = 0$ dan $v(L) = 0$, seluruh nilai $v(s)$ di antara kedua tumpuan secara otomatis **bernilai negatif ($v(s) < 0$)**. Demikian pula pada balok Kantilever Kiri, momen bernilai negatif ($M_{\text{major}}(s) < 0$, _hogging_) dengan $v(0) = 0, \theta(0) = 0$, sehingga integrasi ganda secara otomatis menghasilkan **nilai lendutan ujung yang negatif ($v(L) < 0$)**.

Pada array `f64` berukuran $M = 256$ titik dengan jarak antar-node $\Delta s = \frac{L}{M - 1}$:

1. **Integrasi Pertama (Rotasi Tanpa Konstanta Awal $\tilde{\theta}\_m$):**

   $$
   \tilde{\theta}_0 = 0, \qquad \tilde{\theta}_m = \tilde{\theta}_{m-1} + \frac{1}{2}\left(\kappa_{m-1} + \kappa_m\right) \Delta s \quad \text{untuk } m = 1 \dots M-1
   $$

2. **Integrasi Kedua (Simpangan Vertikal Tanpa Konstanta Awal $\tilde{v}\_m$):**

   $$
   \tilde{v}_0 = 0, \qquad \tilde{v}_m = \tilde{v}_{m-1} + \frac{1}{2}\left(\tilde{\theta}_{m-1} + \tilde{\theta}_m\right) \Delta s \quad \text{untuk } m = 1 \dots M-1
   $$

3. **Penentuan Konstanta Batas ($C_1$ dan $C_2$) Sesuai Jenis Tumpuan:**
   Karena $v(s) = \tilde{v}(s) + C_1 s + C_2$ dan $\theta(s) = \tilde{\theta}(s) + C_1$:
   - **Kantilever Kiri (`CANTILEVER_LEFT`):** Karena $v(0) = 0$ dan $\theta(0) = 0$, maka $C_1 = 0$ dan $C_2 = 0$.
   - **Kantilever Kanan (`CANTILEVER_RIGHT`):** Karena $\theta(L) = 0$ dan $v(L) = 0$, maka $C_1 = -\tilde{\theta}_{M-1}$ dan $C_2 = -\tilde{v}_{M-1} - C_1 L$.
   - **Seluruh Tumpuan dengan Perletakan di Kedua Ujung (`PINNED_ROLLER`, `ROLLER_PINNED`, `FIXED_FIXED`, `FIXED_ROLLER`, `ROLLER_FIXED`, `FIXED_PINNED`, `PINNED_FIXED`):** Karena $v(0) = 0$ dan $v(L) = 0$, maka:

     $$
     C_2 = 0, \qquad C_1 = -\frac{\tilde{v}_{M-1}}{L}
     $$

4. **Koreksi Array Akhir & Pencarian Lendutan Ekstrem Bertanda ($\Delta\_{\max} < 0$):**
   Indeks titik lendutan ekstrem $m^*$ dicari dari simpangan mutlak terbesar, namun nilai $\Delta_{\max}$ yang dilaporkan ke pengguna **tetap mempertahankan tanda negatifnya** (sedangkan pengecekan batas izin SNI membandingkan nilai mutlak $|\Delta_{\max}| \le \Delta_{\text{izin}}$):

   $$
   \theta_m = \tilde{\theta}_m + C_1, \qquad v_m = \tilde{v}_m + C_1 s_m + C_2
   $$

   $$
   m^* = \arg\max_{0 \le m < M} |v_m|, \qquad \Delta_{\max} = v_{m^*} \quad (\text{bernilai } < 0 \text{ untuk lendutan ke bawah}), \qquad \text{Status Lulus: } |\Delta_{\max}| \le \frac{L}{\text{batas}}
   $$

### 3.2. Interpolator Kurva untuk Mode B (Input Gaya Dalam Langsung)

Pada **Mode B**, pengguna memasukkan nilai gaya dalam terfaktor skalar ($P_u, M_{ux}, M_{uy}, T_u, V_u$) dan panjang bentang $L$ beserta pilihan jenis tumpuan. Sistem memetakan beban merata ekuivalen $q_{\text{eq}}$ ke arah bawah yang menghasilkan momen maksimum $|M_{ux}|$, sehingga **lendutan ekstrem $\Delta\_{\max}$ selalu bertanda negatif**:

- **Sendi–Rol / Rol–Sendi:** $q_{\text{eq}} = \frac{8 |M_{ux}|}{L^2} \implies \Delta_{\max} = -\frac{5 |M_{ux}| L^2}{48 E I_{\text{major}}}$.
- **Jepit–Jepit:** $q_{\text{eq}} = \frac{12 |M_{ux}|}{L^2} \implies \Delta_{\max} = -\frac{|M_{ux}| L^2}{32 E I_{\text{major}}}$.
- **Jepit–Rol / Jepit–Sendi / Rol–Jepit / Sendi–Jepit:** $q_{\text{eq}} = \frac{8 |M_{ux}|}{L^2} \implies \Delta_{\max} = -\frac{8 |M_{ux}| L^2}{185 E I_{\text{major}}}$.
- **Kantilever Kiri / Kanan:** $q_{\text{eq}} = \frac{2 |M_{ux}|}{L^2} \implies \Delta_{\max} = -\frac{|M_{ux}| L^2}{4 E I_{\text{major}}}$.

## 🧊 4. Algoritma Ekstrusi Balok 3D Tanpa Distorsi & Pemetaan Sumbu (`mesh_3d.rs`)

### 4.1. Transformasi Koordinat _Rigid Cross-Section Sweep_ dengan Matriks Permutasi Sumbu

Pada setiap stasiun $m \in [0, M-1]$ di sepanjang bentang $L$, pusat berat penampang berada pada simpangan vertikal negatif $v_m \le 0$. Setiap titik sudut poligon 2D penampang lokal $(u_{\text{sec}}, v_{\text{sec}})$ (di mana $u_{\text{sec}} \in [-B/2, B/2]$ dan $v_{\text{sec}} \in [-H/2, H/2]$) pertama-tama dihitung pada koordinat intrinsik $(s, u, v)$, lalu dikalikan dengan matriks orientasi sumbu pilihan pengguna $\mathbf{P}_{\text{axis}}$ (`Y-Up`, `Z-Up`, atau Kustom):

$$
\begin{bmatrix} s(m, u_{\text{sec}}, v_{\text{sec}}) \\ u(m, u_{\text{sec}}, v_{\text{sec}}) \\ v(m, u_{\text{sec}}, v_{\text{sec}}) \end{bmatrix} = \begin{bmatrix} s_m - v_{\text{sec}} \sin\theta_m \\ u_{\text{sec}} \\ \alpha_{\text{scale}} v_m + v_{\text{sec}} \cos\theta_m \end{bmatrix}, \qquad \begin{bmatrix} X \\ Y \\ Z \end{bmatrix} = \mathbf{P}_{\text{axis}} \begin{bmatrix} s \\ u \\ v \end{bmatrix}
$$

Karena $v_m < 0$ untuk lendutan ke bawah, maka baik pada mode **`Y-Up`** (di mana $Y = v < 0$) maupun **`Z-Up`** (di mana $Z = v < 0$), kurva balok 3D secara visual melengkung ke arah bawah sesuai arah gravitasi.

Warna setiap _vertex_ di stasiun $m$ diinterpolasi dari rasio lendutan $\hat{\delta}_m = \frac{|v_m|}{\max(|\Delta_{\max}|, \Delta_{\text{izin}})}$ menggunakan skala warna **SAP2000 Contour** (`Biru #3B82F6` pada `0,00 mm` $\rightarrow$ `Cyan #06B6D4` $\rightarrow$ `Hijau #10B981` $\rightarrow$ `Kuning #EAB308` $\rightarrow$ `Merah #EF4444` pada nilai terendah `$-\Delta_{\max}$`).

### 4.2. Spesifikasi Visual 3D Berdasarkan Material Balok

1. **Tampilan 3D Balok Baja (IWF & BOX):**
   - Poligon 2D profil IWF (12 titik sudut utama + segmen busur _fillet_ $r$) atau BOX (kontur luar $B \times H$ dan lubang dalam $(B - 2t) \times (H - 2t)$) diekstrusi dari $m = 0$ hingga $m = M-1$ membentuk _triangle strip mesh_ 3D utuh dengan _end-cap_ tertutup di ujung A dan B.
2. **Tampilan 3D Balok Beton Bertulang — Mode 1 (_Solid Concrete + Detailed End Cross-Section_):**
   - Selubung luar balok dirender sebagai prisma persegi panjang 3D ($b_w \times h$) yang melengkung mengikuti kurva lendutan negatif $v(s)$.
   - Pada kedua bidang tutup ujung (_end-caps_ di $s = 0$ dan $s = L$), digambar **detail potongan melintang beton bertulang** yang memperlihatkan cincin sengkang tertutup dan bulatan baja tulangan tarik ($A_s$) serta tulangan tekan ($A'_s$).
3. **Tampilan 3D Balok Beton Bertulang — Mode 2 (_Wireframe / X-Ray Rebar & Stirrup Cage_):**
   - Selubung beton diubah menjadi _wireframe_ semi-transparan tipis (`opacity: 0.18`, garis tepi `#64748B`), memperlihatkan batang silinder 3D tulangan memanjang dan deretan cincin sengkang tertutup $(b_w - 2c_c) \times (h - 2c_c)$ yang ditempatkan berulang pada setiap kelipatan jarak spasi $s_k = c_c + k \cdot s_{\text{stirrup}}$.

## 🎨 5. Spesifikasi Visual Kanvas, Tumpuan 2D, & Tata Letak UI (Hasil Ekstraksi Referensi)

### 5.1. Tema Latar Belakang Kanvas (_Erzysh Dark Void & Subtle Grid_ — Gambar 1 & 2)

- **Warna Dasar Kanvas (_Base Void Background_):** Hitam karbon pekat `#0A0A0A` (`rgb(10, 10, 10)`).
- **Pola Grid Teknik (_Technical Background Grid_):** Grid ortogonal persegi dengan ukuran sel `40px x 40px`, garis selebar `1px` berwarna `#1F2020` / `rgba(255, 255, 255, 0.045)` di area pusat yang memudar secara halus ke `#0A0A0A` di tepi layar menggunakan `radial-gradient` _vignette mask_.
- **Pendaran Cahaya Atmosferik (_Ambient Center Glow_):** Lapisan pendaran _radial glow_ lembut bernuansa _Dark Teal/Cyan_ (`#0A0E0E` hingga `rgba(6, 182, 212, 0.07)`) tepat di belakang area kerja balok 3D.
- **Gaya Panel & Tombol UI:** Kartu/jendela menggunakan latar belakang `#0F1416` (`rgba(15, 20, 22, 0.85)`) dengan `backdrop-filter: blur(12px)` dan _border_ tipis `#1F2937` (`1px solid rgba(148, 163, 184, 0.14)`). Aksen primer menggunakan gradasi _Cyan-to-Violet_ (`linear-gradient(90deg, #06B6D4 0%, #3B82F6 50%, #8B5CF6 100%)`).

### 5.2. Geometri & Gaya Simbol Tumpuan 2D (Berdasarkan Gambar 3)

Simbol tumpuan dirender dalam **2D (SVG/Canvas Vector Overlay)** yang dikunci tepat pada proyeksi layar titik ujung balok 3D, mempertahankan bentuk klasik **Gambar 3** dengan peningkatan estetika _slate-metallic_ yang menyatu dengan latar `#0A0A0A`:

1. **Palet Warna Simbol Tumpuan:**
   - **Garis Luar (_Stroke_):** `#94A3B8` (_Slate 400_, tebal `2.5px`, `stroke-linecap: round`, `stroke-linejoin: round`) dengan efek pendaran lembut `drop-shadow(0 0 6px rgba(148, 163, 184, 0.22))`.
   - **Isian Bidang (_Fill_):** Gradasi `#334155` ke `#1E293B` (_Slate 700–800_).
   - **Garis Bantu Datum Vertikal:** Garis putus-putus vertikal (`stroke-dasharray: 4 4`, warna `#6D7C90`, tebal `1.5px`) yang turun dari titik tumpuan sebagai penanda sumbu posisi tumpuan.
2. **Bentuk Spesifik Tiap Tumpuan (Sesuai Gambar 3):**
   - **Tumpuan Jepit (_Fixed Support_):** Garis dinding vertikal tegas di ujung balok (`tinggi = 1,8 H_balok`) dengan **6 garis arsiran diagonal ($45^\circ$)** di sisi luar dinding, ditambah garis putus-putus datum vertikal di bawahnya.
   - **Tumpuan Sendi (_Pinned Support_):** Segitiga sama kaki (`lebar alas = 32px`, `tinggi = 28px`) dengan puncak menempel tepat di permukaan bawah balok, _fill_ `#334155`, _stroke_ `#94A3B8`, dan garis putus-putus datum vertikal tepat di tengah alasnya.
   - **Tumpuan Rol (_Roller Support_):** Segitiga sama kaki identik dengan Sendi, dilengkapi **garis landasan horizontal** berjarak `4px` di bawah alas segitiga dan **2 lingkaran roda simetris** (`radius = 4.5px`, _fill_ `#334155`, _stroke_ `#94A3B8`) di bawahnya, serta garis putus-putus datum vertikal di tengahnya.

### 5.3. Tata Letak HUD Defleksi, Gizmo Sumbu $X\text{-}Y\text{-}Z$, & 3 Mode Diagram 2D

1. **Posisi Elemen HUD Defleksi & Pengaturan Sumbu:**
   - **Sisi Kanan Layar (_Right Edge HUD_):** _Vertical Colorbar Legend_ gradasi kontur defleksi yang menampilkan skala bertanda negatif dari `0,00 mm` (Biru di atas) hingga nilai terendah `$-\Delta_{\max}$ mm` (Merah di bawah), dilengkapi tombol _quick-switch_ orientasi sumbu **`Z-Up` / `Y-Up` / `Custom XYZ`** beserta _3D Axis Gizmo_.
   - **Kiri Bawah Layar (_Bottom-Left HUD_):** Kartu ringkas indikator **Lendutan Maksimum ($\Delta\_{\max} = -xx,xx\text{ mm}$)** pada sumbu vertikal aktif ($Z$ atau $Y$), posisi stasiun $x(\Delta_{\max})$, batas lendutan izin ($-L/\text{batas}$), dan _badge_ status `AMAN (OK)` / `MELEBIHI BATAS (NG)`.
   - **Floating Windows & Bar Kondisional:** Posisi awal 6 _Floating Windows_ ditata proporsional di tepi layar oleh sistem agar area tengah balok 3D tetap terbuka. _Top Bar / Bottom Dock_ hanya ditampilkan bila ruang layar masih terasa kosong.
2. **3 Mode Tampilan Grafik Gaya Dalam 2D (SFD, NFD, BMD, TFD):**
   - **Mode 1 — Bertumpuk Sejajar di As Balok (_In-Place Beam Axis Overlay_):** Grafik digambar langsung berimpit pada sumbu memanjang balok di kanvas utama dengan _checkbox toggle_ aktif/nonaktif per diagram.
   - **Mode 2 — Sejajar Menurun secara Vertikal (_Stacked Vertical Alignment_):** Keempat diagram disusun berbaris rapi dari atas ke bawah tepat di bawah balok dengan skala panjang horizontal $1:1$ terhadap bentang balok $L$.
   - **Mode 3 — Jendela Mengambang Khusus (_Dedicated Floating Window_):** Seluruh grafik ditampilkan di dalam _Floating Window Diagram Gaya Dalam_ yang dapat digeser bebas.

## 📦 6. Integrasi Ekspor Multi-Format CAD / BIM / CAE

Geometri penampang hasil optimasi (Baja IWF, Baja BOX, maupun Beton Bertulang + Tulangan/Sengkang) beserta model balok 3D dan gaya dalamnya dapat diekspor langsung mengikuti **sistem koordinat sumbu ($X, Y, Z$) yang sedang dipilih pengguna** ke berbagai perangkat lunak rekayasa (spesifikasi teknis lengkap diuraikan di dalam `mdfiles/cad_bim_cae_export_specification.md`):

- **AutoCAD / Civil 3D / BricsCAD:** `.dxf` (2D Section & 3D Mesh) dan `.lsp` (AutoLISP Parametric Script).
- **SAP2000 & ETABS:** `.s2k` (Text Model lengkap dengan Material, Frame Section, Joint Restraints 5 jenis tumpuan, & Loads).
- **Autodesk Revit & Tekla Structures:** `.ifc` (`IFC4` BIM Model: `IfcBeam`, `IfcIShapeProfileDef`, `IfcRectangleHollowProfileDef`, `IfcReinforcingBar`) dan `.txt` (Revit Family Type Catalog).
- **IDEA StatiCa:** `.ifc`, `.dxf` (Cross-Section Import), dan `.saf` / `.iom` (Structural Analysis Format / IDEA Open Model XML).
- **SolidWorks / Inventor / Fusion 360 / ANSYS:** `.step` / `.stp` (ISO 10303-21 AP214 B-Rep Solid) dan `.stl` / `.obj` (3D Mesh).
