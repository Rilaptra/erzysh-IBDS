# Spesifikasi Perhitungan & Optimasi Balok Beton Bertulang (SNI 2847:2019)

> **Catatan Batasan Ruang Lingkup Optimasi Beton (`Scope Note`):**
> Pada aplikasi **Interactive Beam Deflection & Structural Design Simulator**, modul perhitungan dan optimasi balok beton bertulang **difokuskan secara murni pada beban lentur ($M_u$) dan gaya geser ($V_u$)** tanpa mengikutsertakan efek gaya aksial ($P_u / N_u$) maupun torsi ($T_u$).
> Oleh karena itu, algoritma optimasi beton bertulang pada `src/core/concrete/` bekerja khusus untuk:
>
> 1. **Menghitung diameter tulangan pokok dan jumlah tulangan tarik ($A_s$) serta tulangan tekan ($A'\_s$) yang paling efisien** berdasarkan momen lentur terfaktor ($M_u$) menggunakan metode blok tegangan ekuivalen Whitney, sekaligus memverifikasi syarat regangan tarik netto ($\epsilon_t$), rasio tulangan minimum ($A_{s,\min}$), dan spasi bersih antar tulangan dalam lebar balok ($b_w$).
> 2. **Menghitung diameter tulangan sengkang dan jarak spasinya ($s$) yang efisien** berdasarkan gaya geser terfaktor ($V_u$) dan kuat geser beton standar ($V_c$).
> 3. **Memverifikasi batas lendutan izin maksimum** sesuai Tabel 24.2.2 SNI 2847:2019.

### 1. Pemetaan Modul Perhitungan Beton Bertulang (SNI 2847:2019)

| Modul Fungsi                          | Fokus Kalkulasi                                                                                 | Acuan SNI 2847:2019                                |  Kompleksitas  |
| :------------------------------------ | :---------------------------------------------------------------------------------------------- | :------------------------------------------------- | :------------: |
| Konversi Material                     | Konversi $K\text{-xxx}$ ke $f'_c$, $E_c, E_s, \epsilon_{ty}, \beta_1$                           | Pasal 19.2.2.1 & Tabel 22.2.2.4.3                  |     $O(1)$     |
| Desain Lentur Whitney                 | Jumlah & diameter tulangan tarik $A_s$ dan tekan $A'_s$, regangan $\epsilon_t$, faktor $\phi$   | Pasal 9.6.1.2, Pasal 22.2, Tabel 21.2.1 & 21.2.2   |     $O(1)$     |
| Desain Geser & Sengkang               | Kuat geser beton standar $V_c$, kebutuhan geser sengkang $V_s$, diameter & spasi $s$            | Pasal 22.5.5.1, Pasal 22.5.10.5.3, Tabel 9.7.6.2.2 |     $O(K)$     |
| Optimasi Penampang & Susunan Tulangan | Iterasi dimensi ekonomis $b_w \times h$, pemilihan kombinasi $n\text{-D}xx$, & kontrol lendutan | Pasal 24.2.2, Tabel 24.2.2, & Pasal 25.2.1         | $O(D \cdot R)$ |

Parameter input material pada simulator meliputi:

- **Mutu Beton:** Input dalam $f'_c$ ($\text{MPa}$) atau $K\text{-xxx}$ ($\text{kg/cm}^2$) dengan konversi standar $f'_c = 0,083 \times K$ serta modulus elastisitas beton normal $E_c = 4700 \sqrt{f'_c}$ ($\text{MPa}$) sesuai Pasal 19.2.2.1.b.
- **Tebal Selimut Beton Bersih ($c_c$):** Misalnya $25\text{ mm}$, $40\text{ mm}$ (standar balok terlindung cuaca sesuai Tabel 20.6.1.3.1), atau $50\text{ mm}$.
- **Mutu Baja Tulangan ($E_s = 200000\text{ MPa}$):** Tulangan polos (**BJTP 24** dengan $f_{yt} = 240\text{ MPa}$, **BJTP 30** dengan $f_{yt} = 300\text{ MPa}$) untuk sengkang, serta tulangan sirip/ulir (**BJTS 40** dengan $f_y = 400\text{ MPa}$, **BJTS 50** dengan $f_y = 500\text{ MPa}$, **BJTS 60** dengan $f_y = 600\text{ MPa}$) untuk tulangan longitudinal tarik/tekan maupun sengkang.

### 2. Faktor Blok Tegangan Whitney ($\beta_1$) & Faktor Reduksi Kekuatan ($\phi$)

1. **Faktor Tinggi Blok Tegangan Tekan Ekuivalen ($\beta_1$ — Tabel 22.2.2.4.3):**
   $$\beta_1 = \begin{cases} 0,85 & \text{untuk } 17 \le f'_c \le 28\text{ MPa} \\ 0,85 - \dfrac{0,05 (f'_c - 28)}{7} & \text{untuk } 28 < f'_c < 55\text{ MPa} \\ 0,65 & \text{untuk } f'_c \ge 55\text{ MPa} \end{cases}$$

2. **Faktor Reduksi Kekuatan ($\phi$ — Tabel 21.2.1 & Tabel 21.2.2):**
   - **Geser pada balok:** $\phi_v = 0,75$.
   - **Lentur pada balok:** Ditentukan berdasarkan regangan tarik netto $\epsilon_t$ pada tulangan tarik terjauh saat beton mencapai regangan tekan batas $\epsilon_{cu} = 0,003$ (dengan $\epsilon_{ty} = f_y / E_s$):
     $$\phi(\epsilon_t) = \begin{cases} 0,65 & \text{untuk } \epsilon_t \le \epsilon_{ty} \text{ (Terkendali Tekan)} \\ 0,65 + 0,25 \dfrac{(\epsilon_t - \epsilon_{ty})}{(0,005 - \epsilon_{ty})} & \text{untuk } \epsilon_{ty} < \epsilon_t < 0,005 \text{ (Zona Transisi)} \\ 0,90 & \text{untuk } \epsilon_t \ge 0,005 \text{ (Terkendali Tarik — Target Desain Balok)} \end{cases}$$

### 3. Desain & Optimasi Tulangan Lentur Tarik ($A_s$) dan Tekan ($A'_s$)

Perhitungan kebutuhan luas tulangan lentur pada balok persegi dengan lebar $b_w$, tinggi total $h$, tinggi efektif tarik $d = h - c_c - d_{\text{sengkang}} - \frac{d_b}{2}$, dan jarak pusat tulangan tekan ke serat tekan terjauh $d' = c_c + d_{\text{sengkang}} + \frac{d_b}{2}$ mengikuti langkah berikut:

1. **Batas Penampang Terkendali Tarik Maksimum ($\epsilon_t = 0,005$ dan $\phi = 0,90$):**
   $$c_{\max} = \frac{\epsilon_{cu}}{\epsilon_{cu} + 0,005} d = \frac{0,003}{0,003 + 0,005} d = 0,375 d, \qquad a_{\max} = \beta_1 c_{\max}$$

2. **Kapasitas Momen Nominal Maksimum Tulangan Tunggal ($M\_{n,\max}$):**
   $$M_{n,\max} = 0,85 f'_c a_{\max} b_w \left(d - \frac{a_{\max}}{2}\right)$$

3. **Kondisi 1 — Desain Tulangan Tunggal (Apabila $\dfrac{|M_u|}{0,90} \le M\_{n,\max}$):**
   Penampang hanya memerlukan tulangan tarik ($A'_s = 0$). Tinggi blok tekan $a$ dan luas tulangan tarik perlu $A_{s,\text{perlu}}$ dihitung dengan:
   $$a = d - \sqrt{d^2 - \frac{2 |M_u|}{0,85 \cdot 0,90 \cdot f'_c b_w}}, \qquad A_{s,\text{perlu}} = \frac{0,85 f'_c a b_w}{f_y}$$

4. **Kondisi 2 — Desain Tulangan Rangkap (Apabila $\dfrac{|M_u|}{0,90} > M\_{n,\max}$):**
   Agar penampang tetap daktail ($\epsilon_t \ge 0,005$ dan $\phi = 0,90$) tanpa memperbesar dimensi balok, kelebihan momen nominal $\Delta M_n = \frac{|M_u|}{0,90} - M_{n,\max}$ dipikul oleh pasangan tulangan tekan ($A'_s$) dan tambahan tulangan tarik ($A_{s2}$):
   $$\epsilon'_s = 0,003 \left(1 - \frac{d'}{c_{\max}}\right), \qquad f'_s = \min\left(E_s \epsilon'_s, f_y\right)$$
   $$A'_{s,\text{perlu}} = \frac{\Delta M_n}{f'_s (d - d')}, \qquad A_{s,\text{perlu}} = \frac{0,85 f'_c a_{\max} b_w}{f_y} + \frac{\Delta M_n}{f_y (d - d')}$$

5. **Batas Tulangan Minimum ($A\_{s,\min}$ — Pasal 9.6.1.2):**
   Luas tulangan tarik terpasang wajib memenuhi batas minimum:
   $$A_{s,\min} = \max\left(\frac{0,25 \sqrt{f'_c}}{f_y} b_w d, \; \frac{1,4}{f_y} b_w d\right)$$

6. **Pemilihan Kombinasi Diameter & Jumlah Tulangan Efisien ($n\text{-D}xx$):**
   Untuk setiap kandidat diameter tulangan ulir standar $d_b \in \{13, 16, 19, 22, 25, 29, 32\}\text{ mm}$ dengan luas satu batang $A_b = \frac{1}{4}\pi d_b^2$:
   - Jumlah batang minimum: $n = \max\left(2, \; \left\lceil \frac{\max(A_{s,\text{perlu}}, A_{s,\min})}{A_b} \right\rceil\right)$.
   - **Kontrol Spasi Bersih Antar Tulangan (Pasal 25.2.1):** Jarak bersih horizontal antar tulangan sejajar dalam satu lapis wajib memenuhi $s_{\text{bersih}} \ge \max(25\text{ mm}, d_b)$. Jumlah batang maksimum per lapis pada lebar $b_w$ adalah:
     $$n_{\text{maks/lapis}} = \left\lfloor \frac{b_w - 2 c_c - 2 d_{\text{sengkang}} + s_{\text{min}}}{d_b + s_{\text{min}}} \right\rfloor$$
   - Kombinasi $(n, d_b)$ yang paling efisien adalah yang memberikan luas terpasang $A_{s,\text{pasang}} = n A_b$ paling mendekati $A_{s,\text{perlu}}$ (rasio efisiensi $\frac{M_u}{\phi M_n}$ tertinggi yang tetap $\le 1,0$) dan muat dalam $1$ hingga maksimal $2$ lapis tulangan.

### 4. Desain & Optimasi Tulangan Geser / Sengkang (Pasal 22.5.5.1 & Tabel 9.7.6.2.2)

Perhitungan diameter sengkang ($d_s \in \{8, 10, 12, 13\}\text{ mm}$) dan jarak spasinya ($s$) dilakukan murni berdasarkan gaya geser terfaktor $V_u$:

1. **Kuat Geser Nominal Beton Standar ($V_c$ — Persamaan 22.5.5.1):**
   Untuk beton normal ($\lambda = 1,0$) tanpa pengaruh gaya aksial:
   $$V_c = 0,17 \lambda \sqrt{f'_c} b_w d, \qquad \phi_v V_c = 0,75 V_c$$

2. **Kebutuhan Kuat Geser Tulangan Sengkang ($V_s$ — Pasal 22.5.1.1 & 22.5.1.2):**
   - Apabila $V_u \le 0,5 \phi_v V_c$: Secara teoritis tidak diperlukan sengkang geser, namun dipasang sengkang praktis pada spasi maksimum $s_{\max}$.
   - Apabila $0,5 \phi_v V_c < V_u \le \phi_v V_c$: Diperlukan sengkang geser minimum ($A_{v,\min}$) sesuai Pasal 9.6.3.3.
   - Apabila $V_u > \phi_v V_c$: Tulangan sengkang wajib memikul gaya geser sebesar:
     $$V_s = \frac{V_u}{\phi_v} - V_c$$
   - **Batas Maksimum Kapasitas Penampang (Pasal 22.5.1.2):** Nilai $V_s$ tidak boleh melampaui $V_{s,\max} = 0,66 \sqrt{f'_c} b_w d$. Jika $V_s > V_{s,\max}$, maka dimensi penampang ($b_w \times h$) wajib diperbesar.

3. **Perhitungan Jarak Spasi Sengkang ($s$) & Batas Spasi Maksimum ($s\_{\max}$):**
   Untuk sengkang tertutup $n_{\text{kaki}}$ kaki (umumnya $2$ kaki, sehingga $A_v = 2 \times \frac{1}{4}\pi d_s^2$), jarak spasi sengkang dihitung dari nilai terkecil antara kebutuhan kekuatan geser, kebutuhan tulangan geser minimum, dan batas spasi geometri Tabel 9.7.6.2.2:
   $$s_{\text{kuat}} = \frac{A_v f_{yt} d}{V_s}, \qquad s_{A_{v,\min}} = \min\left(\frac{A_v f_{yt}}{0,062 \sqrt{f'_c} b_w}, \; \frac{A_v f_{yt}}{0,35 b_w}\right)$$

   | Kondisi Kuat Geser Sengkang ($V_s$)                       | Spasi Maksimum Geometri ($s_{\max}$) — Tabel 9.7.6.2.2       |
   | :-------------------------------------------------------- | :----------------------------------------------------------- |
   | $V_s \le 0,33 \sqrt{f'_c} b_w d$                          | $s_{\max} = \min\left(\dfrac{d}{2}, \; 600\text{ mm}\right)$ |
   | $0,33 \sqrt{f'_c} b_w d < V_s \le 0,66 \sqrt{f'_c} b_w d$ | $s_{\max} = \min\left(\dfrac{d}{4}, \; 300\text{ mm}\right)$ |

   Spasi sengkang desain diambil sebesar $s = \min\left(s_{\text{kuat}}, s_{A_{v,\min}}, s_{\max}\right)$ dan dibulatkan ke bawah ke kelipatan praktis $10\text{ mm}$ atau $25\text{ mm}$ (misalnya $\varnothing 10 - 150\text{ mm}$).

### 5. Batas Lendutan Izin Maksimum (Pasal 24.2.2 & Tabel 24.2.2)

Kontrol lendutan balok pada simulator mengacu pada batas lendutan izin Tabel 24.2.2:

| Jenis Komponen   | Kondisi Elemen Nonstruktural                       | Jenis Lendutan yang Diperhitungkan                     |    Batas Izin    |
| :--------------- | :------------------------------------------------- | :----------------------------------------------------- | :--------------: |
| Atap datar       | Tidak memikul elemen nonstruktural rentan rusak    | Lendutan seketika akibat beban hidup $L_r$ atau $R$    | $\dfrac{L}{180}$ |
| Lantai           | Tidak memikul elemen nonstruktural rentan rusak    | Lendutan seketika akibat beban hidup $L$               | $\dfrac{L}{360}$ |
| Atap atau lantai | Memikul elemen nonstruktural yang mungkin rusak    | Lendutan total setelah pemasangan elemen nonstruktural | $\dfrac{L}{480}$ |
| Atap atau lantai | Memikul elemen nonstruktural yang tidak akan rusak | Lendutan total setelah pemasangan elemen nonstruktural | $\dfrac{L}{240}$ |
