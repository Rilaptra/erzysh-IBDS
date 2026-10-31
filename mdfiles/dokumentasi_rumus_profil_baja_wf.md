# Dokumentasi Perhitungan Properti Penampang Baja WF (Wide Flange)

Dokumen ini memuat panduan lengkap dan rumus matematika untuk menghitung seluruh properti geometri penampang baja profil **Wide Flange (WF)** secara otomatis berdasarkan 5 parameter dimensi utama sesuai standar tabel profil baja (JIS G 3192 / SNI).

---

## 1. Parameter Input & Konversi Satuan

Pada tabel standar baja, dimensi utama diberikan dalam satuan milimeter ($\text{mm}$). Sedangkan output properti penampang disajikan dalam satuan sentimeter ($\text{cm}$, $\text{cm}^2$, $\text{cm}^3$, dan $\text{cm}^4$).

Agar perhitungan langsung menghasilkan satuan yang sesuai dengan tabel, seluruh parameter input dibagi $10$ terlebih dahulu:

| Simbol Tabel | Nama Parameter                   | Satuan Input | Variabel Rumus ($\text{cm}$) |     Rumus Konversi     | Keterangan                                                  |
| :----------- | :------------------------------- | :----------: | :--------------------------: | :--------------------: | :---------------------------------------------------------- |
| $H$          | _Height_ (Tinggi Profil)         | $\text{mm}$  |             $h$              |   $h = \frac{H}{10}$   | Tinggi total dari sisi luar sayap atas ke bawah             |
| $B$          | _Breadth_ (Lebar Sayap)          | $\text{mm}$  |             $b$              |   $b = \frac{B}{10}$   | Lebar total pelat sayap (_flange_)                          |
| $t_1$        | _Web Thickness_ (Tebal Badan)    | $\text{mm}$  |            $t_w$             | $t_w = \frac{t_1}{10}$ | Tebal pelat badan vertikal di tengah                        |
| $t_2$        | _Flange Thickness_ (Tebal Sayap) | $\text{mm}$  |            $t_f$             | $t_f = \frac{t_2}{10}$ | Tebal pelat sayap horizontal atas dan bawah                 |
| $r$          | _Root Radius_ (Jari-jari Sudut)  | $\text{mm}$  |            $r_c$             |  $r_c = \frac{r}{10}$  | Jari-jari lengkungan di $4$ sudut pertemuan badan dan sayap |

> **Catatan Penamaan Simbol $r_c$:**
> Kolom $r$ di sebelah $t_2$ pada tabel disimbolkan menjadi $r_c$ (_corner radius_ dalam $\text{cm}$) di dalam rumus agar tidak tertukar dengan simbol jari-jari girasi $r_x$ dan $r_y$.

---

## 2. Konstanta Geometri Lengkungan Sudut (_Fillet_)

Profil baja WF hasil canai panas (_hot-rolled_) memiliki $4$ lengkungan sudut (_fillet_) dengan jari-jari $r_c$ di pertemuan antara badan (_web_) dan sayap (_flange_). Lengkungan ini menambah luas dan kekakuan penampang.

Untuk $1$ buah lengkungan sudut, berlaku konstanta geometri berikut:

1. **Luas $1$ sudut lengkung ($a_f$):**
   $$a_f = \left(1 - \frac{\pi}{4}\right) r_c^2 \approx 0.214602 \cdot r_c^2$$

2. **Jarak titik berat lengkungan terhadap sisi lurus badan/sayap ($c$):**
   $$c = \left(\frac{10 - 3\pi}{12 - 3\pi}\right) r_c \approx 0.223402 \cdot r_c$$

3. **Momen inersia pribadi $1$ sudut lengkung terhadap titik beratnya ($I\_{f0}$):**
   $$I_{f0} = \left[1 - \frac{5\pi}{16} - \left(1 - \frac{\pi}{4}\right)\left(\frac{10 - 3\pi}{12 - 3\pi}\right)^2\right] r_c^4 \approx 0.007542 \cdot r_c^4$$

---

## 3. Rumus Properti Penampang (Berurutan)

### 3.1. Luas Penampang (_Section Area_ - $A$)

Luas penampang merupakan jumlah luas dari $2$ pelat sayap, $1$ pelat badan bersih, dan $4$ lengkungan sudut.

- **Satuan:** $\text{cm}^2$
- **Rumus:**
  $$A = 2 b t_f + (h - 2 t_f) t_w + 4 a_f$$
  atau dalam bentuk jabaran langsung:
  $$A = 2 b t_f + (h - 2 t_f) t_w + (4 - \pi) r_c^2$$

---

### 3.2. Berat Satuan (_Unit Weight_ - $W$)

Berat profil per meter panjang dihitung berdasarkan massa jenis baja standar sebesar $\rho = 7850\text{ kg/m}^3$ (atau $0.785\text{ kg/cm}^2\text{/m}$).

- **Satuan:** $\text{kg/m}$
- **Rumus:**
  $$W = A \times 0.785$$

---

### 3.3. Momen Inersia (_Geometrical Moment of Inertia_ - $I_x$ dan $I_y$)

Ukuran kekakuan penampang dalam menahan lenturan terhadap sumbu kuat ($x$) dan sumbu lemah ($y$).

- **Satuan:** $\text{cm}^4$
- **Momen Inersia Sumbu Kuat ($I_x$):**
  $$I_x = \frac{b h^3 - (b - t_w)(h - 2 t_f)^3}{12} + 4 \left[ I_{f0} + a_f \left(\frac{h}{2} - t_f - c\right)^2 \right]$$

- **Momen Inersia Sumbu Lemah ($I_y$):**
  $$I_y = \frac{2 t_f b^3 + (h - 2 t_f) t_w^3}{12} + 4 \left[ I_{f0} + a_f \left(\frac{t_w}{2} + c\right)^2 \right]$$

---

### 3.4. Jari-jari Girasi (_Radius of Gyration_ - $r_x$ dan $r_y$)

Properti penampang yang digunakan untuk menentukan rasio kelangsingan kolom terhadap bahaya tekuk (_buckling_).

- **Satuan:** $\text{cm}$
- **Rumus:**
  $$r_x = \sqrt{\frac{I_x}{A}}$$
  $$r_y = \sqrt{\frac{I_y}{A}}$$

---

### 3.5. Modulus Penampang Elastis (_Modulus of Section_ - $S_x$ dan $S_y$)

Digunakan untuk menghitung kapasitas momen lentur batas elastis (kondisi leleh pertama pada serat terluar penampang).

- **Satuan:** $\text{cm}^3$
- **Rumus:**
  $$S_x = \frac{I_x}{h / 2} = \frac{2 I_x}{h}$$
  $$S_y = \frac{I_y}{b / 2} = \frac{2 I_y}{b}$$

---

### 3.6. Modulus Penampang Plastis (_Modulus Plastis_ - $Z_x$ dan $Z_y$)

Digunakan untuk menghitung kapasitas momen lentur plastis nominal ($M_n = Z \cdot f_y$) pada desain baja metode LRFD (SNI 1729). Pada tabel referensi standar, nilai $Z_x$ dan $Z_y$ dihitung dari segmen persegi utama (tanpa menyertakan sudut _fillet_):

- **Satuan:** $\text{cm}^3$
- **Rumus Standar Tabel:**
  $$Z_x = b t_f (h - t_f) + \frac{1}{4} t_w (h - 2 t_f)^2$$
  $$Z_y = \frac{1}{2} t_f b^2 + \frac{1}{4} (h - 2 t_f) t_w^2$$

_(Opsional) Jika ingin menyertakan kontribusi 4 sudut lengkung secara eksak:_
$$Z_{x,\text{eksak}} = Z_x + 4 a_f \left(\frac{h}{2} - t_f - c\right)$$
$$Z_{y,\text{eksak}} = Z_y + 4 a_f \left(\frac{t_w}{2} + c\right)$$

---

## 4. Contoh Perhitungan Validasi

Mengambil sampel baris pertama dari tabel: **WF $100 \times 100 \times 17.2$**

- **Input ($\text{mm}$):** $H = 100$, $B = 100$, $t_1 = 6$, $t_2 = 8$, $r = 10$
- **Konversi ($\text{cm}$):** $h = 10$, $b = 10$, $t_w = 0.6$, $t_f = 0.8$, $r_c = 1.0$
- **Konstanta Fillet:** $a_f = 0.2146\text{ cm}^2$, $c = 0.2234\text{ cm}$, $I_{f0} = 0.00754\text{ cm}^4$

| Properti                  | Substitusi Perhitungan                                                 | Hasil Rumus | Angka di Tabel | Status |
| :------------------------ | :--------------------------------------------------------------------- | :---------: | :------------: | :----: |
| **$A$ ($\text{cm}^2$)**   | $2(10)(0.8) + (10 - 1.6)(0.6) + 4(0.2146)$                             |  $21.898$   |     $21.9$     | Sesuai |
| **$W$ ($\text{kg/m}$)**   | $21.898 \times 0.785$                                                  |   $17.19$   |     $17.2$     | Sesuai |
| **$I_x$ ($\text{cm}^4$)** | $\frac{10(10^3) - 9.4(8.4^3)}{12} + 4[0.00754 + 0.2146(3.9766)^2]$     |  $382.58$   |     $383$      | Sesuai |
| **$I_y$ ($\text{cm}^4$)** | $\frac{2(0.8)(10^3) + 8.4(0.6^3)}{12} + 4[0.00754 + 0.2146(0.5234)^2]$ |  $133.72$   |     $134$      | Sesuai |
| **$r_x$ ($\text{cm}$)**   | $\sqrt{382.58 / 21.898}$                                               |   $4.180$   |     $4.18$     | Sesuai |
| **$r_y$ ($\text{cm}$)**   | $\sqrt{133.72 / 21.898}$                                               |   $2.471$   |     $2.47$     | Sesuai |
| **$S_x$ ($\text{cm}^3$)** | $382.58 / (10 / 2)$                                                    |   $76.52$   |     $76.5$     | Sesuai |
| **$S_y$ ($\text{cm}^3$)** | $133.72 / (10 / 2)$                                                    |   $26.74$   |     $26.7$     | Sesuai |
| **$Z_x$ ($\text{cm}^3$)** | $10(0.8)(9.2) + 0.25(0.6)(8.4^2)$                                      |   $84.18$   |     $84.2$     | Sesuai |
| **$Z_y$ ($\text{cm}^3$)** | $0.5(0.8)(10^2) + 0.25(8.4)(0.6^2)$                                    |   $40.76$   |     $40.8$     | Sesuai |
