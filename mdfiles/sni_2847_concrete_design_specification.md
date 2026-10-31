### 1. Pemetaan Modul Perhitungan Beton Bertulang (SNI 2847:2019)

Modul desain balok beton bertulang menerima input dari Mode A (Gaya Eksternal) maupun Mode B (Gaya Dalam Langsung $P_u, M_{ux}, M_{uy}, T_u, V_u, L$) untuk menentukan dimensi ekonomis serta konfigurasi tulangan pokok dan sengkang.

| Modul Fungsi            | Fokus Kalkulasi                                                          | Acuan SNI 2847:2019                     | Kompleksitas   |
| ----------------------- | ------------------------------------------------------------------------ | --------------------------------------- | -------------- |
| Konversi Material       | Konversi $K\text{-xxx}$ ke $f'_c$, $E_c, E_s, \epsilon_{ty}, \beta_1$    | Pasal 21.2.2.1 & Pasal 22.7.2           | $O(1)$         |
| Desain Lentur Whitney   | Tulangan tarik $A_s$, tekan $A'_s$, regangan $\epsilon_t$, faktor $\phi$ | Tabel 21.2.1 & Tabel 21.2.2             | $O(1)$         |
| Desain Geser & Sengkang | Kuat geser beton $V_c$ (tanpa/dengan aksial) & spasi $s_{\max}$          | Pasal 22.5.5, 22.5.6, Tabel 9.7.6.2.2   | $O(K)$         |
| Evaluasi Torsi          | Ambang torsi $T_{th}$, retak $T_{cr}$, sengkang tertutup                 | Pasal 22.7.1 s/d 22.7.5 & Pasal 9.7.6.3 | $O(1)$         |
| Optimasi Penampang      | Iterasi dimensi $b \times h$ dan kontrol lendutan izin                   | Pasal 24.2.2 & Tabel 24.2.2             | $O(D \cdot R)$ |

Penjelasan parameter input material pada simulator meliputi pilihan mutu beton dalam $f'_c$ (MPa) atau $K\text{-xxx}$ dengan konversi $f'_c \approx 0,083 \times K$, tebal selimut beton bersih, serta mutu baja tulangan polos (BJTP 24, BJTP 30) dan tulangan sirip/ulir (BJTS 40, BJTS 50, BJTS 60).

### 2. Faktor Reduksi Kekuatan ($\phi$) & Klasifikasi Regangan (Tabel 21.2.1 & Tabel 21.2.2)

Berdasarkan Tabel 21.2.1 dan Pasal 21.2.2, faktor reduksi kekuatan $\phi$ ditetapkan menurut jenis gaya yang bekerja:

- Momen, gaya aksial, atau kombinasi momen dan gaya aksial menggunakan $\phi = 0,65$ hingga $0,90$ sesuai Tabel 21.2.2.

- Gaya geser menggunakan $\phi_v = 0,75$ dan torsi menggunakan $\phi_t = 0,75$.

- Tumpu (_bearing_) menggunakan $\phi = 0,65$, zona angkur pascatarik $\phi = 0,85$, serta model _strut-and-tie_ $\phi = 0,75$.

- Batas regangan tekan beton pada serat tekan terjauh diambil sebesar $\epsilon_{cu} = 0,003$, sedangkan regangan leleh tulangan ulir adalah $\epsilon_{ty} = \frac{f_y}{E_s}$ (untuk mutu $420\text{ MPa}$ diizinkan mengambil $\epsilon_{ty} = 0,002$).

Untuk komponen struktur dengan tulangan transversal berupa sengkang biasa (bukan spiral), nilai $\phi$ dihitung dari regangan tarik netto $\epsilon_t$ pada tulangan tarik terjauh sesuai Tabel 21.2.2:

$$\phi(\epsilon_t) = \begin{cases} 0,65 & \text{untuk } \epsilon_t \le \epsilon_{ty} \text{ (Terkontrol Tekan)} \\ 0,65 + 0,25 \dfrac{(\epsilon_t - \epsilon_{ty})}{(0,005 - \epsilon_{ty})} & \text{untuk } \epsilon_{ty} < \epsilon_t < 0,005 \text{ (Zona Transisi)} \\ 0,90 & \text{untuk } \epsilon_t \ge 0,005 \text{ (Tegangan Terkontrol)} \end{cases}$$

### 3. Desain Lentur Blok Tegangan Ekuivalen Whitney

Perhitungan kapasitas lentur balok persegi dengan lebar $b_w$, tinggi total $h$, tinggi efektif $d$, dan jarak serat tekan terjauh ke tulangan tarik terjauh $d_t$ mengikuti tahapan berikut:

1. Menentukan tinggi garis netral batas terkendali tarik ($\epsilon_t = 0,005$ dan $\epsilon_{cu} = 0,003$):

$$c_{\max} = \frac{0,003}{0,003 + 0,005} d_t = 0,375 d_t, \qquad a_{\max} = \beta_1 c_{\max}$$

2. Menghitung kapasitas momen nominal maksimum penampang bertulangan tunggal:

$$M_{n,\max} = 0,85 f'_c a_{\max} b_w \left(d - \frac{a_{\max}}{2}\right)$$

3. Apabila $\frac{\vert{}M_{ux}\vert{}}{0,90} \le M_{n,\max}$, penampang didesain sebagai tulangan tunggal ($A'_s = 0$) dengan tinggi blok tekan $a$ dan luas tulangan tarik $A_s$:

$$a = d - \sqrt{d^2 - \frac{2 \vert{}M_{ux}\vert{}}{0,85 \phi f'_c b_w}}, \qquad A_s = \frac{0,85 f'_c a b_w}{f_y}$$

4. Apabila $\frac{\vert{}M_{ux}\vert{}}{0,90} > M_{n,\max}$, penampang didesain sebagai tulangan rangkap dengan memisahkan momen sisa $\Delta M_n = \frac{\vert{}M_{ux}\vert{}}{0,90} - M_{n,\max}$ yang dipikul oleh pasangan tulangan tekan $A'_s$ dan tambahan tulangan tarik $A_{s2}$:

$$\epsilon'_s = 0,003 \left(1 - \frac{d'}{c_{\max}}\right), \qquad f'_s = \min\left(E_s \epsilon'_s, f_y\right)$$

$$A'_s = \frac{\Delta M_n}{f'_s (d - d')}, \qquad A_s = \frac{0,85 f'_c a_{\max} b_w}{f_y} + \frac{\Delta M_n}{f_y (d - d')}$$

### 4. Kekuatan Geser Beton ($V_c$) & Spasi Sengkang (Pasal 22.5.5, 22.5.6, & Tabel 9.7.6.2.2)

Kuat geser nominal yang disumbangkan oleh beton ($V_c$) dibedakan berdasarkan keberadaan gaya aksial terfaktor $N_u \equiv P_u$ (positif untuk tekan):

- Untuk komponen nonprategang tanpa gaya aksial ($N_u = 0$), Persamaan (22.5.5.1) menetapkan:

$$V_c = 0,17 \lambda \sqrt{f'_c} b_w d$$

- Untuk perhitungan metode detail tanpa gaya aksial sesuai Tabel 22.5.5.1, nilai $V_c$ diambil dari nilai terkecil di antara tiga persamaan berikut:

$$V_c = \min \begin{cases} \left[0,16 \lambda \sqrt{f'_c} + 17 \rho_w \dfrac{V_u d}{M_u}\right] b_w d & \text{(a)} \\ \left[0,16 \lambda \sqrt{f'_c} + 17 \rho_w\right] b_w d & \text{(b)} \\ 0,29 \lambda \sqrt{f'_c} b_w d & \text{(c)} \end{cases}$$

- Untuk komponen nonprategang dengan gaya aksial tekan ($N_u > 0$), Persamaan (22.5.6.1) menetapkan:

$$V_c = 0,17 \left(1 + \frac{N_u}{14 A_g}\right) \lambda \sqrt{f'_c} b_w d$$

- Untuk perhitungan metode detail dengan gaya aksial tekan sesuai Tabel 22.5.6.1, nilai $V_c$ diambil dari nilai terkecil antara butir (a) dan (b) (dengan syarat $M_u - N_u \frac{(4h - d)}{8} > 0$ pada butir a):

$$V_c = \min \begin{cases} \left[0,16 \lambda \sqrt{f'_c} + 17 \rho_w \dfrac{V_u d}{M_u - N_u \frac{(4h - d)}{8}}\right] b_w d & \text{(a)} \\ 0,29 \lambda \sqrt{f'_c} b_w d \sqrt{1 + \dfrac{0,29 N_u}{A_g}} & \text{(b)} \end{cases}$$

Kebutuhan tulangan geser dihitung dari $V_s = \frac{V_u}{\phi_v} - V_c$, dan spasi sengkang maksimum $s_{\max}$ pada balok nonprategang wajib mematuhi Tabel 9.7.6.2.2:

| Kondisi Kuat Geser Tulangan ($V_s$) | Spasi Maksimum Sengkang ($s_{\max}$) Balok Nonprategang | Spasi Maksimum Balok Prategang                  |
| ----------------------------------- | ------------------------------------------------------- | ----------------------------------------------- |
| $V_s \le 0,33 \sqrt{f'_c} b_w d$    | $\min\left(\dfrac{d}{2}, 600\text{ mm}\right)$          | $\min\left(\dfrac{3h}{4}, 600\text{ mm}\right)$ |
| $V_s > 0,33 \sqrt{f'_c} b_w d$      | $\min\left(\dfrac{d}{4}, 300\text{ mm}\right)$          | $\min\left(\dfrac{3h}{8}, 300\text{ mm}\right)$ |

### 5. Desain Kekuatan Torsi (Pasal 22.7 & Pasal 9.7.6.3)

Desain torsi didasarkan pada analogi rangka batang ruang tabung dinding tipis dengan aliran geser $q = \tau t$ dan tegangan geser $\tau = \frac{T}{2 A_o t}$:

- Berdasarkan Pasal 22.7.2.1 dan R22.7.2.2, nilai $\sqrt{f'_c}$ untuk perhitungan torsi dibatasi maksimum $8,3\text{ MPa}$, serta tegangan leleh tulangan torsi $f_y$ dan $f_{yt}$ dibatasi maksimum $420\text{ MPa}$.

- Berdasarkan Pasal 22.7.1.1, apabila $T_u < \phi_t T_{th}$ ($\phi_t = 0,75$), pengaruh torsi dapat diabaikan.

- Sesuai Tabel 22.7.4.1(a), ambang batas torsi $T_{th}$ untuk penampang solid nonprategang dengan luas bruto yang dibatasi keliling luar $A_{cp}$ dan keliling luar $p_{cp}$ adalah:

$$T_{th} = \begin{cases} 0,083 \lambda \sqrt{f'_c} \left(\dfrac{A_{cp}^2}{p_{cp}}\right) & \text{tanpa gaya aksial — Tabel 22.7.4.1(a) butir a)} \\ 0,083 \lambda \sqrt{f'_c} \left(\dfrac{A_{cp}^2}{p_{cp}}\right) \sqrt{1 + \dfrac{N_u}{0,33 A_g \lambda \sqrt{f'_c}}} & \text{dengan gaya aksial } N_u \text{ — Tabel 22.7.4.1(a) butir c)} \end{cases}$$

- Untuk penampang berongga sesuai Tabel 22.7.4.1(b), variabel $A_{cp}$ pada rumus $T_{th}$ digantikan oleh luas bersih $A_g$.

- Sesuai Pasal 22.7.3.1 dan 22.7.3.2, torsi kesetimbangan wajib didesain memikul $T_u$ penuh, sedangkan torsi kompatibilitas pada struktur statis tak tentu boleh direduksi menjadi $\phi_t T_{cr}$.

- Sesuai Pasal 9.7.6.3.1 dan R9.7.6.3.1, sengkang torsi transversal harus berupa sengkang tertutup penuh dan tidak boleh disusun dari sepasang sengkang-U yang disambung lewatan karena selimut beton luar dapat terlepas pada gaya torsi tinggi.

### 6. Batas Lendutan Izin Maksimum (Pasal 24.2.2 & Tabel 24.2.2)

Kontrol lendutan balok pada simulator mengacu pada batas lendutan izin Tabel 24.2.2:

| Jenis Komponen   | Kondisi Elemen Nonstruktural                       | Jenis Lendutan yang Diperhitungkan                     | Batas Izin       |
| ---------------- | -------------------------------------------------- | ------------------------------------------------------ | ---------------- |
| Atap datar       | Tidak memikul elemen nonstruktural rentan rusak    | Lendutan seketika akibat $L_r$ dan $R$ maksimum        | $\dfrac{l}{180}$ |
| Lantai           | Tidak memikul elemen nonstruktural rentan rusak    | Lendutan seketika akibat beban hidup $L$               | $\dfrac{l}{360}$ |
| Atap atau lantai | Memikul elemen nonstruktural yang mungkin rusak    | Lendutan total setelah pemasangan elemen nonstruktural | $\dfrac{l}{480}$ |
| Atap atau lantai | Memikul elemen nonstruktural yang tidak akan rusak | Lendutan total setelah pemasangan elemen nonstruktural | $\dfrac{l}{240}$ |
