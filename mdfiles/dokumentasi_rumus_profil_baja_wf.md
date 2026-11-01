# Dokumentasi Perhitungan Properti Penampang Baja WF (Wide Flange) & BOX (PSR)

Dokumen ini memuat panduan lengkap dan rumus matematika resmi untuk menghitung seluruh properti geometri, inersia, modulus plastis, hingga konstanta torsi dan _warping_ penampang baja profil **Wide Flange (IWF)** dan **Hollow Structural Section (BOX / PSR)** secara otomatis dari parameter dimensi utamanya.

Seluruh rumus mengacu pada standar nasional dan internasional resmi:

- **SNI 1729:2020** (_Spesifikasi untuk Bangunan Gedung Baja Struktural_ — adopsi identik **ANSI/AISC 360-16**), khususnya Bab B4, Bab F (Pasal F2, F3, F6, F7), dan Bab H (Pasal H1 & H3).
- **AISC Design Guide 9** (_Torsional Analysis of Structural Steel Members_, Seaburg & Carter / El-Darwish & Johnston, 1965) untuk konstanta torsi Saint-Venant ($J$) dan konstanta _warping_ ($C_w$).
- **JIS G 3192 / SNI 07-2054** untuk geometri profil IWF gilas panas (_hot-rolled_) dan **JIS G 3466** untuk profil baja berongga persegi/persegi panjang (SHS/RHS).

## 1. Parameter Input & Konversi Satuan Profil IWF

Pada katalog JSON (`src/data/steel-iwf-catalog.json`) dan tabel standar baja, hanya **5 parameter dimensi utama** yang disimpan dalam satuan milimeter ($\text{mm}$) untuk menghemat ukuran data dan _context window_. Seluruh properti penampang turunan dihitung secara otomatis saat _compile-time_ menggunakan **Bun Macro** (`src/macros/precompute-steel-catalog.macro.ts`) dalam satuan sentimeter ($\text{cm}$, $\text{cm}^2$, $\text{cm}^3$, $\text{cm}^4$, dan $\text{cm}^6$).

Agar perhitungan langsung menghasilkan satuan yang sesuai dengan tabel katalog standar, seluruh parameter input dibagi $10$ terlebih dahulu:

| Simbol Tabel  | Nama Parameter                   | Satuan Input | Variabel Rumus ($\text{cm}$) |     Rumus Konversi      | Keterangan                                                  |
| :------------ | :------------------------------- | :----------: | :--------------------------: | :---------------------: | :---------------------------------------------------------- |
| $H$           | _Height_ (Tinggi Profil)         | $\text{mm}$  |             $h$              |   $h = \dfrac{H}{10}$   | Tinggi total dari sisi luar sayap atas ke bawah             |
| $B$           | _Breadth_ (Lebar Sayap)          | $\text{mm}$  |             $b$              |   $b = \dfrac{B}{10}$   | Lebar total pelat sayap (_flange_)                          |
| $t_1$ ($t_w$) | _Web Thickness_ (Tebal Badan)    | $\text{mm}$  |            $t_w$             | $t_w = \dfrac{t_1}{10}$ | Tebal pelat badan vertikal di tengah                        |
| $t_2$ ($t_f$) | _Flange Thickness_ (Tebal Sayap) | $\text{mm}$  |            $t_f$             | $t_f = \dfrac{t_2}{10}$ | Tebal pelat sayap horizontal atas dan bawah                 |
| $r$           | _Root Radius_ (Jari-jari Sudut)  | $\text{mm}$  |            $r_c$             |  $r_c = \dfrac{r}{10}$  | Jari-jari lengkungan di $4$ sudut pertemuan badan dan sayap |

> **Catatan Penamaan Simbol $r_c$:**
> Kolom $r$ di sebelah $t_2$ pada tabel disimbolkan menjadi $r_c$ (_corner radius_ dalam $\text{cm}$) di dalam rumus agar tidak tertukar dengan simbol jari-jari girasi $r_x$, $r_y$, dan $r_{ts}$.

## 2. Konstanta Geometri Lengkungan Sudut (_Fillet_) IWF

Profil baja WF hasil canai panas (_hot-rolled_) memiliki $4$ lengkungan sudut (_fillet_) dengan jari-jari $r_c$ di pertemuan antara badan (_web_) dan sayap (_flange_). Lengkungan ini menambah luas, momen inersia, dan kekakuan torsi penampang.

Untuk $1$ buah lengkungan sudut (_spandrel_ kuadran lingkaran), berlaku konstanta geometri eksak berikut:

1. **Luas $1$ sudut lengkung ($a_f$):**
   $$a_f = \left(1 - \frac{\pi}{4}\right) r_c^2 \approx 0,214602 \cdot r_c^2$$

2. **Jarak titik berat lengkungan terhadap sisi lurus badan/sayap ($c$):**
   $$c = \left(\frac{10 - 3\pi}{12 - 3\pi}\right) r_c \approx 0,223402 \cdot r_c$$

3. **Momen inersia pribadi $1$ sudut lengkung terhadap sumbu titik beratnya ($I\_{f0}$):**
   $$I_{f0} = \left[1 - \frac{5\pi}{16} - \left(1 - \frac{\pi}{4}\right)\left(\frac{10 - 3\pi}{12 - 3\pi}\right)^2\right] r_c^4 \approx 0,007542 \cdot r_c^4$$

## 3. Rumus Properti Penampang Profil IWF (Lengkap dengan Parameter LTB & Torsi SNI 1729:2020)

### 3.1. Luas Penampang (_Section Area_ — $A$)

Luas penampang merupakan jumlah luas dari $2$ pelat sayap, $1$ pelat badan bersih, dan $4$ lengkungan sudut.

- **Satuan:** $\text{cm}^2$
- **Rumus:**
  $$A = 2 b t_f + (h - 2 t_f) t_w + 4 a_f = 2 b t_f + (h - 2 t_f) t_w + (4 - \pi) r_c^2$$

### 3.2. Berat Satuan (_Unit Weight_ — $W$)

Berat profil per meter panjang dihitung berdasarkan massa jenis baja karbon struktural standar JIS G 3192 sebesar $\rho = 7850\text{ kg/m}^3$ (atau $0,785\text{ kg/cm}^2\text{/m}$).

- **Satuan:** $\text{kg/m}$
- **Rumus:**
  $$W = A \times 0,785$$

### 3.3. Momen Inersia (_Geometrical Moment of Inertia_ — $I_x$ dan $I_y$)

Ukuran kekakuan penampang dalam menahan lenturan terhadap sumbu kuat ($x$) dan sumbu lemah ($y$) menggunakan Teorema Sumbu Sejajar (_Steiner_):

- **Satuan:** $\text{cm}^4$
- **Momen Inersia Sumbu Kuat ($I_x$):**
  $$I_x = \frac{b h^3 - (b - t_w)(h - 2 t_f)^3}{12} + 4 \left[ I_{f0} + a_f \left(\frac{h}{2} - t_f - c\right)^2 \right]$$

- **Momen Inersia Sumbu Lemah ($I_y$):**
  $$I_y = \frac{2 t_f b^3 + (h - 2 t_f) t_w^3}{12} + 4 \left[ I_{f0} + a_f \left(\frac{t_w}{2} + c\right)^2 \right]$$

### 3.4. Jari-jari Girasi (_Radius of Gyration_ — $r_x$ dan $r_y$)

Properti penampang yang digunakan untuk menentukan rasio kelangsingan terhadap bahaya tekuk (_buckling_) dan panjang batas $L_p$ pada SNI 1729:2020 Persamaan (F2-5).

- **Satuan:** $\text{cm}$
- **Rumus:**
  $$r_x = \sqrt{\frac{I_x}{A}}, \qquad r_y = \sqrt{\frac{I_y}{A}}$$

### 3.5. Modulus Penampang Elastis (_Elastic Section Modulus_ — $S_x$ dan $S_y$)

Digunakan untuk menghitung kapasitas momen lentur batas elastis dan tekuk torsi-lateral (LTB) pada SNI 1729:2020 Persamaan (F2-2) s/d (F2-6).

- **Satuan:** $\text{cm}^3$
- **Rumus:**
  $$S_x = \frac{I_x}{h / 2} = \frac{2 I_x}{h}, \qquad S_y = \frac{I_y}{b / 2} = \frac{2 I_y}{b}$$

### 3.6. Modulus Penampang Plastis (_Plastic Section Modulus_ — $Z_x$ dan $Z_y$)

Digunakan untuk menghitung kapasitas momen plastis nominal ($M_p = F_y Z$) pada SNI 1729:2020 Persamaan (F2-1) dan (F6-1).

- **Satuan:** $\text{cm}^3$
- **Rumus Standar Tabel (Segmen Persegi Utama):**
  $$Z_x = b t_f (h - t_f) + \frac{1}{4} t_w (h - 2 t_f)^2$$
  $$Z_y = \frac{1}{2} t_f b^2 + \frac{1}{4} (h - 2 t_f) t_w^2$$
- **Rumus Eksak (Menyertakan Kontribusi 4 Sudut _Fillet_):**
  $$Z_{x,\text{eksak}} = Z_x + 4 a_f \left(\frac{h}{2} - t_f - c\right), \qquad Z_{y,\text{eksak}} = Z_y + 4 a_f \left(\frac{t_w}{2} + c\right)$$

### 3.7. Jarak Antar Titik Berat Sayap (_Distance Between Flange Centroids_ — $h_o$) & Tinggi Bersih Badan ($h_c$)

Variabel $h_o$ wajib digunakan dalam perhitungan Tekuk Torsi-Lateral (LTB) sesuai **SNI 1729:2020 Pasal F2 (Persamaan F2-4, F2-6, dan F2-7)**, sedangkan $h_c$ digunakan untuk klasifikasi kelangsingan badan ($\lambda_w = h_c / t_w$) pada **Tabel B4.1b Kasus 15**.

- **Satuan:** $\text{cm}$
- **Rumus:**
  $$h_o = h - t_f$$
  $$h_c = h - 2 t_f - 2 r_c$$

### 3.8. Konstanta Torsi Saint-Venant (_Torsional Constant_ — $J$)

Digunakan pada evaluasi LTB balok IWF (**SNI 1729:2020 Persamaan F2-4 & F2-6**) dan tegangan torsi penampang terbuka (**Pasal H3.3**).

- **Satuan:** $\text{cm}^4$
- **Rumus Aproksimasi Dinding Tipis Standar (SNI 1729 / Mekanika Bahan Klasik):**
  $$J_{\text{std}} = \frac{2 b t_f^3 + (h - 2 t_f) t_w^3}{3}$$
- **Rumus Eksak dengan Kontribusi _Fillet_ Pertemuan Sayap-Badan (El-Darwish & Johnston, 1965 / AISC Design Guide 9 Appendix C):**
  Untuk profil I gilas panas dengan sudut lengkung $r_c$, pertemuan T antara sayap dan badan meningkatkan kekakuan torsi secara signifikan:
  $$J = \frac{2 b t_f^3 + (h - t_f) t_w^3}{3} + 2 \alpha D^4 - 0,420 t_f^4$$
  dengan faktor bentuk $\alpha$ dan diameter lingkaran dalam (_inscribed circle_) $D$:
  $$\alpha = \frac{t_w}{t_f}\left(0,15 + 0,10 \frac{r_c}{t_f}\right), \qquad D = \frac{(t_f + r_c)^2 + t_w\left(r_c + \frac{t_w}{4}\right)}{2 r_c + t_f}$$
  _(Catatan Implementasi Engine: Gunakan $J\_{\text{std}}$ untuk kompatibilitas konservatif buku teks standar, atau $J$ El-Darwish bila memverifikasi terhadap database profil AISC/SAP2000)._

### 3.9. Konstanta Pilin / _Warping_ (_Warping Constant_ — $C_w$)

Mengukur ketahanan penampang profil I terhadap torsi non-seragam (_warping torsion_) sesuai **SNI 1729:2020 Penjelasan Pasal F2 & AISC Design Guide 9 Persamaan (C.3-2)**.

- **Satuan:** $\text{cm}^6$
- **Rumus Resmi Profil I Simetris Ganda:**
  $$C_w = \frac{I_y h_o^2}{4} = \frac{I_y (h - t_f)^2}{4}$$

### 3.10. Jari-jari Girasi Efektif untuk LTB (_Effective Radius of Gyration_ — $r_{ts}$)

Digunakan langsung untuk menghitung batas panjang tak terkekang inelastis $L_r$ dan tegangan kritis tekuk torsi-lateral $F_{cr}$ pada **SNI 1729:2020 Persamaan (F2-4), (F2-6), dan (F2-7)**.

- **Satuan:** $\text{cm}$
- **Rumus Resmi SNI 1729:2020 Persamaan (F2-7):**
  $$r_{ts} = \sqrt{\frac{\sqrt{I_y C_w}}{S_x}} = \sqrt{\frac{I_y h_o}{2 S_x}}$$

## 4. Rumus Properti Penampang Baja Berongga BOX / PSR (SHS & RHS — JIS G 3466 & SNI 1729:2020)

Untuk profil struktur berongga persegi (_Square Hollow Section_ / SHS) dan persegi panjang (_Rectangular Hollow Section_ / RHS) dengan dimensi luar $H$ ($ ext{mm}$), $B$ ($ ext{mm}$), dan tebal dinding $t$ ($ ext{mm}$), konversi ke satuan $\text{cm}$ dilakukan dengan $h = H/10$, $b = B/10$, dan $t_w = t/10$:

1. **Dimensi Bersih Dinding Rata untuk Klasifikasi Kelangsingan (SNI 1729:2020 Tabel B4.1b Catatan d):**
   Jika jari-jari sudut dalam tidak diketahui, lebar dan tinggi bersih diambil sebagai dimensi luar dikurangi $3$ kali tebal dinding:
   $$b_{\text{flat}} = b - 3 t_w, \qquad h_{\text{flat}} = h - 3 t_w$$

2. **Luas Penampang ($A$), Momen Inersia ($I_x, I_y$), dan Modulus ($S_x, S_y, Z_x, Z_y$) dengan Sudut Lengkung Standar JIS G 3466 ($r\_{\text{out}} = 2 t_w, r\_{\text{in}} = t_w$):**
   - **Luas Penampang ($ ext{cm}^2$):**
     $$A = 2 t_w (b + h - 2 t_w) - (4 - \pi) \left(r_{\text{out}}^2 - r_{\text{in}}^2\right) = 2 t_w (b + h - 2 t_w) - 3(4 - \pi) t_w^2$$
   - **Berat Satuan ($ ext{kg/m}$):**
     $$W = A \times 0,785$$
   - **Modulus Plastis Pendekatan Konservatif Kotak Berongga ($ ext{cm}^3$):**
     $$Z_x = \frac{b h^2 - (b - 2 t_w)(h - 2 t_w)^2}{4}, \qquad Z_y = \frac{h b^2 - (h - 2 t_w)(b - 2 t_w)^2}{4}$$

3. **Konstanta Torsi Saint-Venant Penampang Tertutup ($J$ — Rumus Pertama Bredt):**
   Digunakan pada persamaan LTB profil BOX (**SNI 1729:2020 Persamaan F7-10 s/d F7-13**):
   $$J = \frac{2 t_w (b - t_w)^2 (h - t_w)^2}{b + h - 2 t_w} \quad (\text{cm}^4)$$

4. **Konstanta Torsi PSR ($C$ — SNI 1729:2020 Catatan Pengguna Pasal H3.1):**
   Digunakan untuk menghitung kapasitas torsi nominal $T_n = F_{cr} C$ pada **SNI 1729:2020 Persamaan (H3-1)**:
   $$C = 2 (b - t_w)(h - t_w) t_w - 4,5 (4 - \pi) t_w^3 \quad (\text{cm}^3)$$

## 5. Contoh Perhitungan Validasi Lengkap (WF 100 x 100 x 17.2)

Mengambil sampel baris dari katalog standar: **WF $100 \times 100 \times 17,2$**

- **Input ($\text{mm}$):** $H = 100$, $B = 100$, $t_1 = 6$, $t_2 = 8$, $r = 10$
- **Konversi ($\text{cm}$):** $h = 10$, $b = 10$, $t_w = 0,6$, $t_f = 0,8$, $r_c = 1,0$
- **Konstanta Fillet:** $a_f = 0,2146\text{ cm}^2$, $c = 0,2234\text{ cm}$, $I_{f0} = 0,00754\text{ cm}^4$

| Properti                              | Substitusi Perhitungan                                                 | Hasil Rumus | Angka di Tabel / Acuan | Status |
| :------------------------------------ | :--------------------------------------------------------------------- | :---------: | :--------------------: | :----: |
| **$A$ ($\text{cm}^2$)**               | $2(10)(0,8) + (10 - 1,6)(0,6) + 4(0,2146)$                             |  $21,898$   |         $21,9$         | Sesuai |
| **$W$ ($\text{kg/m}$)**               | $21,898 \times 0,785$                                                  |   $17,19$   |         $17,2$         | Sesuai |
| **$I_x$ ($\text{cm}^4$)**             | $\frac{10(10^3) - 9,4(8,4^3)}{12} + 4[0,00754 + 0,2146(3,9766)^2]$     |  $382,58$   |         $383$          | Sesuai |
| **$I_y$ ($\text{cm}^4$)**             | $\frac{2(0,8)(10^3) + 8,4(0,6^3)}{12} + 4[0,00754 + 0,2146(0,5234)^2]$ |  $133,72$   |         $134$          | Sesuai |
| **$r_x$ ($\text{cm}$)**               | $\sqrt{382,58 / 21,898}$                                               |   $4,180$   |         $4,18$         | Sesuai |
| **$r_y$ ($\text{cm}$)**               | $\sqrt{133,72 / 21,898}$                                               |   $2,471$   |         $2,47$         | Sesuai |
| **$S_x$ ($\text{cm}^3$)**             | $382,58 / (10 / 2)$                                                    |   $76,52$   |         $76,5$         | Sesuai |
| **$S_y$ ($\text{cm}^3$)**             | $133,72 / (10 / 2)$                                                    |   $26,74$   |         $26,7$         | Sesuai |
| **$Z_x$ ($\text{cm}^3$)**             | $10(0,8)(9,2) + 0,25(0,6)(8,4^2)$                                      |   $84,18$   |         $84,2$         | Sesuai |
| **$Z_y$ ($\text{cm}^3$)**             | $0,5(0,8)(10^2) + 0,25(8,4)(0,6^2)$                                    |   $40,76$   |         $40,8$         | Sesuai |
| **$h_o$ ($\text{cm}$)**               | $10 - 0,8$                                                             |   $9,20$    |  $9,20$ (SNI 1729 F2)  | Valid  |
| **$J\_{\text{std}}$ ($\text{cm}^4$)** | $\frac{2(10)(0,8^3) + 8,4(0,6^3)}{3}$                                  |   $4,018$   | $4,02$ (Dinding Tipis) | Valid  |
| **$C_w$ ($\text{cm}^6$)**             | $\frac{133,72 \times (9,20)^2}{4}$                                     |  $2829,5$   |  $2830$ (SNI 1729 F2)  | Valid  |
| **$r\_{ts}$ ($\text{cm}$)**           | $\sqrt{\frac{133,72 \times 9,20}{2 \times 76,52}}$                     |   $2,835$   |  $2,84$ (Pers. F2-7)   | Valid  |
