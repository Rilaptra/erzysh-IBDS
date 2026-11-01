### 1. Pemetaan Modul Perhitungan Balok Baja IWF & BOX (SNI 1729:2020)

Modul balok baja mengevaluasi profil IWF (_Wide Flange_) dan BOX (_Hollow Structural Section_ / PSR) menggunakan metode DFBT (LRFD) dengan mutu baja BJ 34, BJ 37, BJ 41, BJ 50, dan BJ 55 serta target efisiensi rasio kapasitas $\frac{M_u}{\phi M_n} \ge 90\%$.

| Modul Fungsi            | Fokus Kalkulasi                                                   | Acuan SNI 1729:2020                                      | Kompleksitas |
| ----------------------- | ----------------------------------------------------------------- | -------------------------------------------------------- | ------------ |
| Klasifikasi Penampang   | Rasio lebar-tebal ($\lambda, \lambda_p, \lambda_r$) sayap & badan | Tabel B4.1b (Kasus 10, 11, 13, Catatan d)                | $O(1)$       |
| Kapasitas Lentur & LTB  | Momen nominal $M_n$ profil IWF & PSR/BOX                          | Pasal F2, F3, F6, dan F7                                 | $O(1)$       |
| Interaksi Aksial-Lentur | Evaluasi kombinasi aksial tekan/tarik & lentur biaxial            | Bab H, Pasal H1.1 & H1.2 (Pers. H1-1a/b)                 | $O(1)$       |
| Evaluasi Torsi & Geser  | Torsi PSR/BOX ($T_n = F_{cr}C$) & kombinasi Non-PSR               | Bab H, Pasal H3.1, H3.2, dan H3.3                        | $O(1)$       |
| Optimasi Profil & Mutu  | Pencarian biner katalog & _Smart Grade Optimizer_                 | Integrasi Bab B, F, G, H ($\text{DCR} \in [0.90, 1.00]$) | $O(\log N)$  |

Properti material standar baja struktural yang digunakan pada simulator adalah modulus elastisitas $E = 200000\text{ MPa}$ serta lima pilihan mutu: BJ 34 ($F_y = 210\text{ MPa}, F_u = 340\text{ MPa}$), BJ 37 ($F_y = 240\text{ MPa}, F_u = 370\text{ MPa}$), BJ 41 ($F_y = 250\text{ MPa}, F_u = 410\text{ MPa}$), BJ 50 ($F_y = 290\text{ MPa}, F_u = 500\text{ MPa}$), dan BJ 55 ($F_y = 410\text{ MPa}, F_u = 550\text{ MPa}$).

### 2. Klasifikasi Kelangsingan Penampang (Tabel B4.1b)

Berdasarkan Tabel B4.1b untuk komponen struktur yang mengalami lentur:

- Untuk sayap profil I gilas panas yang mengalami lentur sumbu mayor (Kasus 10) maupun sumbu lemah (Kasus 13), rasio kelangsingan diambil sebesar $\lambda_f = \frac{b_f}{2 t_f}$ dengan batas kompak $\lambda_{pf} = 0,38 \sqrt{\frac{E}{F_y}}$ dan batas nonkompak $\lambda_{rf} = 1,00 \sqrt{\frac{E}{F_y}}$.

- Untuk sayap dan badan profil struktur berongga (PSR / BOX) persegi panjang sesuai Catatan (d) Tabel B4.1b, lebar bersih $b$ dan tinggi bersih $h$ adalah jarak bersih dikurangi radius sudut bagian dalam pada setiap sisi. Jika radius sudut tidak diketahui, $b$ dan $h$ diambil sebagai dimensi terluar yang sesuai dikurangi tiga kali ketebalan dinding ($b = B - 3t$ dan $h = H - 3t$).

### 3. Kapasitas Lentur & Tekuk Torsi-Lateral / LTB (Pasal F2, F3, F6, & F7)

#### A. Profil I Kompak & Nonkompak/Langsing — Sumbu Mayor (Pasal F2 & F3)

Kekuatan lentur nominal $M_n$ diambil dari nilai terendah antara keadaan batas leleh, tekuk torsi-lateral (LTB), dan tekuk lokal sayap tekan ($\phi_b = 0,90$):

1. Keadaan Batas Leleh (Persamaan F2-1):

$$M_n = M_p = F_y Z_x$$

2. Keadaan Batas Tekuk Torsi-Lateral / LTB (Persamaan F2-2 s/d F2-8a):
   Dengan batas panjang tak terbreis $L_p$ dan $L_r$ serta koefisien $c = 1$ untuk profil I simetris ganda:

$$L_p = 1,76 r_y \sqrt{\frac{E}{F_y}} \quad \text{(F2-5)}, \qquad r_{ts}^2 = \frac{\sqrt{I_y C_w}}{S_x} = \frac{I_y h_o}{2 S_x} \quad \text{(F2-7)}$$

$$L_r = 1,95 r_{ts} \frac{E}{0,7 F_y} \sqrt{\frac{J c}{S_x h_o} + \sqrt{\left(\frac{J c}{S_x h_o}\right)^2 + 6,76 \left(\frac{0,7 F_y}{E}\right)^2}} \quad \text{(F2-6)}$$

- Apabila $L_b \le L_p$, keadaan batas LTB tidak berlaku ($M_n = M_p$).

- Apabila $L_p < L_b \le L_r$ (Persamaan F2-2):

$$M_n = C_b \left[M_p - (M_p - 0,7 F_y S_x)\left(\frac{L_b - L_p}{L_r - L_p}\right)\right] \le M_p$$

- Apabila $L_b > L_r$ (Persamaan F2-3 & F2-4):

$$F_{cr} = \frac{C_b \pi^2 E}{\left(\frac{L_b}{r_{ts}}\right)^2} \sqrt{1 + 0,078 \frac{J c}{S_x h_o} \left(\frac{L_b}{r_{ts}}\right)^2}, \qquad M_n = F_{cr} S_x \le M_p$$

3. Keadaan Batas Tekuk Lokal Sayap Tekan (Pasal F3.2):

- Untuk penampang dengan sayap nonkompak (Persamaan F3-1):

$$M_n = M_p - (M_p - 0,7 F_y S_x)\left(\frac{\lambda - \lambda_{pf}}{\lambda_{rf} - \lambda_{pf}}\right)$$

- Untuk penampang dengan sayap langsing (Persamaan F3-2), di mana $k_c = \frac{4}{\sqrt{h/t_w}}$ dibatasi tidak lebih kecil dari $0,35$ dan tidak lebih besar dari $0,76$:

$$M_n = \frac{0,9 E k_c S_x}{\lambda^2}$$

#### B. Profil I — Lentur Sumbu Minor (Pasal F6)

Untuk lentur terhadap sumbu lemah, kapasitas penampang sayap nonkompak dan sayap langsing dihitung dengan Persamaan (F6-2) s/d (F6-4):

$$M_n = M_p - (M_p - 0,7 F_y S_y)\left(\frac{\lambda - \lambda_{pf}}{\lambda_{rf} - \lambda_{pf}}\right) \quad \text{(F6-2)}, \qquad M_n = F_{cr} S_y = \frac{0,69 E}{\left(b / t_f\right)^2} S_y \quad \text{(F6-3 \& F6-4)}$$

#### C. PSR Bujur Sangkar, Persegi Panjang, & Boks (Pasal F7)

Untuk profil berongga BOX / PSR, nilai $M_n$ diambil dari nilai terendah antara leleh, tekuk lokal sayap, tekuk lokal badan, dan LTB:

1. Leleh (Persamaan F7-1):

$$M_n = M_p = F_y Z$$

2. Tekuk Lokal Sayap Nonkompak & Langsing (Persamaan F7-2 s/d F7-5):

- Sayap nonkompak (Persamaan F7-2):

$$M_n = M_p - (M_p - F_y S)\left(3,57 \frac{b}{t_f}\sqrt{\frac{F_y}{E}} - 4,0\right) \le M_p$$

- Sayap langsing (Persamaan F7-3): $M_n = F_y S_e$, dengan lebar efektif sayap tekan $b_e$ untuk PSR (Persamaan F7-4) dan penampang berbentuk boks (Persamaan F7-5):

$$b_e = 1,92 t_f \sqrt{\frac{E}{F_y}}\left[1 - \frac{0,38}{b/t_f}\sqrt{\frac{E}{F_y}}\right] \le b \quad \text{(F7-4)}, \qquad b_e = 1,92 t_f \sqrt{\frac{E}{F_y}}\left[1 - \frac{0,34}{b/t_f}\sqrt{\frac{E}{F_y}}\right] \le b \quad \text{(F7-5)}$$

3. Tekuk Lokal Badan Nonkompak (Persamaan F7-6):

$$M_n = M_p - (M_p - F_y S)\left(0,305 \frac{h}{t_w}\sqrt{\frac{F_y}{E}} - 0,738\right) \le M_p$$

4. Tekuk Torsi Lateral pada PSR/Boks (Persamaan F7-10 s/d F7-13):

$$L_p = 0,13 E r_y \frac{\sqrt{J A_g}}{M_p} \quad \text{(F7-12)}, \qquad L_r = 2 E r_y \frac{\sqrt{J A_g}}{0,7 F_y S_x} \quad \text{(F7-13)}$$

- Apabila $L_p < L_b \le L_r$ (Persamaan F7-10):

$$M_n = C_b \left[M_p - (M_p - 0,7 F_y S_x)\left(\frac{L_b - L_p}{L_r - L_p}\right)\right] \le M_p$$

- Apabila $L_b > L_r$ (Persamaan F7-11):

$$M_n = 2 E C_b \frac{\sqrt{J A_g}}{L_b / r_y} \le M_p$$

### 4. Kombinasi Gaya Aksial, Lentur Biaxial, & Torsi (Bab H)

#### A. Interaksi Aksial dan Lentur Simetris Ganda (Pasal H1.1 & H1.2)

Untuk komponen struktur yang memikul kombinasi lentur dan gaya aksial tekan maupun tarik ($\phi_c = 0,90$, $\phi_b = 0,90$), rasio interaksi dievaluasi dengan Persamaan (H1-1a) dan (H1-1b):

$$\text{DCR}_{H1} = \begin{cases} \dfrac{P_r}{P_c} + \dfrac{8}{9}\left(\dfrac{M_{rx}}{M_{cx}} + \dfrac{M_{ry}}{M_{cy}}\right) \le 1,0 & \text{apabila } \dfrac{P_r}{P_c} \ge 0,2 \quad \text{(H1-1a)} \\ \dfrac{P_r}{2 P_c} + \left(\dfrac{M_{rx}}{M_{cx}} + \dfrac{M_{ry}}{M_{cy}}\right) \le 1,0 & \text{apabila } \dfrac{P_r}{P_c} < 0,2 \quad \text{(H1-1b)} \end{cases}$$

#### B. Kekuatan Torsi & Interaksi Gabungan PSR Persegi Panjang / BOX (Pasal H3.1 & H3.2)

Berdasarkan Pasal H3.1 ($\phi_T = 0,90$), kekuatan torsi nominal PSR ditentukan sebesar $T_n = F_{cr} C$ (Persamaan H3-1) dengan konstanta torsi $C = 2(B - t)(H - t)t - 4,5(4 - \pi)t^3$:

- Tegangan kritis torsi $F_{cr}$ untuk PSR persegi panjang ditentukan berdasarkan rasio $h/t$ sesuai Persamaan (H3-3) s/d (H3-5):

$$F_{cr} = \begin{cases} 0,6 F_y & \text{apabila } \dfrac{h}{t} \le 2,45 \sqrt{\dfrac{E}{F_y}} \quad \text{(H3-3)} \\ \dfrac{0,6 F_y \left(2,45 \sqrt{E / F_y}\right)}{(h/t)} & \text{apabila } 2,45 \sqrt{\dfrac{E}{F_y}} < \dfrac{h}{t} \le 3,07 \sqrt{\dfrac{E}{F_y}} \quad \text{(H3-4)} \\ \dfrac{0,458 \pi^2 E}{(h/t)^2} & \text{apabila } 3,07 \sqrt{\dfrac{E}{F_y}} < \dfrac{h}{t} \le 260 \quad \text{(H3-5)} \end{cases}$$

- Berdasarkan Pasal H3.2, apabila kekuatan torsi perlu $T_r \le 0,20 T_c$, efek torsi dapat diabaikan dan evaluasi kembali ke Pasal H1. Apabila $T_r > 0,20 T_c$, interaksi gabungan wajib memenuhi Persamaan (H3-6):

$$\left(\frac{P_r}{P_c} + \frac{M_r}{M_c}\right) + \left(\frac{V_r}{V_c} + \frac{T_r}{T_c}\right)^2 \le 1,0 \quad \text{(H3-6)}$$

#### C. Komponen Struktur Non-PSR (IWF) dengan Tegangan Kombinasi & Torsi (Pasal H3.3)

Untuk profil terbuka seperti IWF ($\phi_T = 0,90$), tegangan kombinasi dibatasi oleh leleh tegangan normal $F_n = F_y$ (Persamaan H3-7), leleh geser $F_n = 0,6 F_y$ (Persamaan H3-8), dan tegangan tekuk $F_n = F_{cr}$ (Persamaan H3-9).

### 5. Katalog Dimensi Primer Profil Baja IWF / H-Beam (JIS G 3192 / SNI 07-2054)

> **Arsitektur Hemat _Context Window_ & _Compile-Time Precomputation_:**
> Untuk menjaga ukuran _file_ dan penggunaan _context window_ AI tetap minimal serta bebas dari inkonsistensi pembulatan angka tabel, katalog di bawah ini **hanya menyimpan 5 parameter dimensi primer** ($H, B, t_1, t_2, r$ dalam $\text{mm}$).
> Seluruh properti penampang turunan ($A, W, I_x, I_y, r_x, r_y, S_x, S_y, Z_x, Z_y, h_o, J, C_w,$ dan $r_{ts}$) dihitung secara deterministik saat _compile-time_ oleh **Bun Macro** (`src/macros/precompute-steel-catalog.macro.ts`) menggunakan rumus resmi pada dokumen `mdfiles/dokumentasi_rumus_profil_baja_wf.md`.

| Profil Katalog ($H \times B \times w$) | Tinggi $H$ ($\text{mm}$) | Lebar $B$ ($\text{mm}$) | Tebal Badan $t_1 / t_w$ ($\text{mm}$) | Tebal Sayap $t_2 / t_f$ ($\text{mm}$) | Radius Sudut $r$ ($\text{mm}$) |
| :------------------------------------- | :----------------------: | :---------------------: | :-----------------------------------: | :-----------------------------------: | :----------------------------: |
| WF 100 x 50 x 9,3                      |           100            |           50            |                  5,0                  |                  7,0                  |              7,0               |
| WF 100 x 100 x 17,2                    |           100            |           100           |                  6,0                  |                  8,0                  |              8,0               |
| WF 125 x 60 x 13,2                     |           125            |           60            |                  6,0                  |                  8,0                  |              8,0               |
| WF 125 x 125 x 23,8                    |           125            |           125           |                  6,5                  |                  9,0                  |              9,0               |
| WF 150 x 75 x 14                       |           150            |           75            |                  5,0                  |                  7,0                  |              7,0               |
| WF 148 x 100 x 21,1                    |           148            |           100           |                  6,0                  |                  9,0                  |              9,0               |
| WF 150 x 100 x 21,1                    |           150            |           100           |                  6,0                  |                  9,0                  |              9,0               |
| WF 150 x 150 x 31,5                    |           150            |           150           |                  7,0                  |                 10,0                  |              10,0              |
| WF 175 x 90 x 18,1                     |           175            |           90            |                  5,0                  |                  8,0                  |              8,0               |
| WF 175 x 125 x 23,3                    |           175            |           125           |                  5,5                  |                  8,0                  |              8,0               |
| WF 175 x 175 x 40,2                    |           175            |           175           |                  7,5                  |                 11,0                  |              11,0              |
| WF 198 x 99 x 18,2                     |           198            |           99            |                  4,5                  |                  7,0                  |              7,0               |
| WF 200 x 100 x 18,2                    |           200            |           100           |                  4,5                  |                  7,0                  |              7,0               |
| WF 200 x 100 x 21,3                    |           200            |           100           |                  5,5                  |                  8,0                  |              8,0               |
| WF 194 x 150 x 30,6                    |           194            |           150           |                  6,0                  |                  9,0                  |              9,0               |
| WF 200 x 150 x 30,6                    |           200            |           150           |                  6,0                  |                  9,0                  |              9,0               |
| WF 200 x 200 x 49,9                    |           200            |           200           |                  8,0                  |                 12,0                  |              12,0              |
| WF 200 x 200 x 56,2                    |           200            |           204           |                 12,0                  |                 12,0                  |              12,0              |
| WF 200 x 200 x 65,7                    |           208            |           202           |                 10,0                  |                 16,0                  |              16,0              |
| WF 250 x 125 x 25,7                    |           248            |           124           |                  5,0                  |                  8,0                  |              8,0               |
| WF 250 x 125 x 29,6                    |           250            |           125           |                  6,0                  |                  9,0                  |              9,0               |
| WF 250 x 175 x 44,1                    |           244            |           175           |                  7,0                  |                 11,0                  |              11,0              |
| WF 250 x 250 x 64,4                    |           244            |           252           |                 11,0                  |                 11,0                  |              11,0              |
| WF 250 x 250 x 66,5                    |           248            |           249           |                  8,0                  |                 13,0                  |              13,0              |
| WF 250 x 250 x 72,4                    |           250            |           250           |                  9,0                  |                 14,0                  |              14,0              |
| WF 250 x 250 x 82,2                    |           250            |           255           |                 14,0                  |                 14,0                  |              14,0              |
| WF 300 x 150 x 32                      |           298            |           149           |                  5,5                  |                  8,0                  |              8,0               |
| WF 300 x 150 x 36,7                    |           300            |           150           |                  6,5                  |                  9,0                  |              9,0               |
| WF 300 x 200 x 56,8                    |           294            |           200           |                  8,0                  |                 12,0                  |              12,0              |
| WF 300 x 200 x 65,4                    |           298            |           201           |                  9,0                  |                 14,0                  |              14,0              |
| WF 300 x 300 x 84,5                    |           294            |           302           |                 12,0                  |                 12,0                  |              12,0              |
| WF 300 x 300 x 87                      |           298            |           299           |                  9,0                  |                 14,0                  |              14,0              |
| WF 300 x 300 x 94                      |           300            |           300           |                 10,0                  |                 15,0                  |              15,0              |
| WF 300 x 300 x 106 (a)                 |           300            |           305           |                 15,0                  |                 15,0                  |              15,0              |
| WF 300 x 300 x 106 (b)                 |           304            |           301           |                 11,0                  |                 17,0                  |              17,0              |
| WF 300 x 300 x 132                     |           310            |           305           |                 15,0                  |                 20,0                  |              20,0              |
| WF 350 x 175 x 41,4                    |           346            |           174           |                  6,0                  |                  9,0                  |              9,0               |
| WF 350 x 175 x 49,6                    |           350            |           175           |                  7,0                  |                 11,0                  |              11,0              |
| WF 350 x 250 x 69,2                    |           336            |           249           |                  8,0                  |                 12,0                  |              12,0              |
| WF 350 x 250 x 79,7                    |           340            |           250           |                  9,0                  |                 14,0                  |              14,0              |
| WF 350 x 350 x 106                     |           338            |           351           |                 13,0                  |                 13,0                  |              13,0              |
| WF 350 x 350 x 115                     |           344            |           348           |                 10,0                  |                 16,0                  |              16,0              |
| WF 350 x 350 x 131                     |           344            |           354           |                 16,0                  |                 16,0                  |              16,0              |
| WF 350 x 350 x 137                     |           350            |           350           |                 12,0                  |                 19,0                  |              19,0              |
| WF 350 x 350 x 156                     |           350            |           357           |                 19,0                  |                 19,0                  |              19,0              |
| WF 350 x 350 x 159                     |           356            |           352           |                 14,0                  |                 22,0                  |              22,0              |
| WF 400 x 200 x 56,6                    |           396            |           199           |                  7,0                  |                 11,0                  |              11,0              |
| WF 400 x 200 x 66                      |           400            |           200           |                  8,0                  |                 13,0                  |              13,0              |
| WF 400 x 300 x 94,3                    |           386            |           299           |                  9,0                  |                 14,0                  |              14,0              |
| WF 400 x 300 x 107                     |           390            |           300           |                 10,0                  |                 16,0                  |              16,0              |
| WF 400 x 400 x 140                     |           388            |           402           |                 15,0                  |                 15,0                  |              15,0              |
| WF 400 x 400 x 147                     |           394            |           398           |                 11,0                  |                 18,0                  |              18,0              |
| WF 400 x 400 x 168                     |           394            |           405           |                 18,0                  |                 18,0                  |              18,0              |
| WF 400 x 400 x 172                     |           400            |           400           |                 13,0                  |                 21,0                  |              21,0              |
| WF 400 x 400 x 197                     |           400            |           408           |                 21,0                  |                 21,0                  |              21,0              |
| WF 400 x 400 x 200                     |           406            |           403           |                 16,0                  |                 24,0                  |              24,0              |
| WF 400 x 400 x 232                     |           414            |           405           |                 18,0                  |                 28,0                  |              28,0              |
| WF 400 x 400 x 283                     |           428            |           407           |                 20,0                  |                 35,0                  |              35,0              |
| WF 400 x 400 x 415                     |           458            |           417           |                 30,0                  |                 50,0                  |              50,0              |
| WF 400 x 400 x 605                     |           498            |           432           |                 45,0                  |                 70,0                  |              70,0              |
| WF 450 x 200 x 66,2                    |           446            |           199           |                  8,0                  |                 12,0                  |              12,0              |
| WF 450 x 200 x 76                      |           450            |           200           |                  9,0                  |                 14,0                  |              14,0              |
| WF 450 x 300 x 106                     |           434            |           299           |                 10,0                  |                 15,0                  |              15,0              |
| WF 450 x 300 x 124                     |           440            |           300           |                 11,0                  |                 18,0                  |              18,0              |
| WF 500 x 200 x 79,5                    |           496            |           199           |                  9,0                  |                 14,0                  |              14,0              |
| WF 500 x 200 x 89,6                    |           500            |           200           |                 10,0                  |                 16,0                  |              16,0              |
| WF 500 x 200 x 103                     |           506            |           201           |                 11,0                  |                 19,0                  |              19,0              |
| WF 500 x 300 x 114                     |           482            |           300           |                 11,0                  |                 15,0                  |              15,0              |
| WF 500 x 300 x 128                     |           488            |           300           |                 11,0                  |                 18,0                  |              18,0              |
| WF 600 x 200 x 94,6                    |           596            |           199           |                 10,0                  |                 15,0                  |              15,0              |
| WF 600 x 200 x 106                     |           600            |           200           |                 11,0                  |                 17,0                  |              17,0              |
| WF 600 x 200 x 120                     |           606            |           201           |                 12,0                  |                 20,0                  |              20,0              |
| WF 600 x 200 x 134                     |           612            |           202           |                 13,0                  |                 23,0                  |              23,0              |
| WF 600 x 300 x 137                     |           582            |           300           |                 12,0                  |                 17,0                  |              17,0              |
| WF 600 x 300 x 151                     |           588            |           300           |                 12,0                  |                 20,0                  |              20,0              |
| WF 600 x 300 x 175                     |           594            |           302           |                 14,0                  |                 23,0                  |              23,0              |
| WF 700 x 300 x 166                     |           692            |           300           |                 13,0                  |                 20,0                  |              20,0              |
| WF 700 x 300 x 185                     |           700            |           300           |                 13,0                  |                 24,0                  |              24,0              |
| WF 700 x 300 x 215                     |           708            |           302           |                 15,0                  |                 28,0                  |              28,0              |
| WF 800 x 300 x 191                     |           792            |           300           |                 14,0                  |                 22,0                  |              22,0              |
| WF 800 x 300 x 210                     |           800            |           300           |                 14,0                  |                 26,0                  |              26,0              |
| WF 800 x 300 x 241                     |           808            |           302           |                 16,0                  |                 30,0                  |              30,0              |
| WF 900 x 300 x 213                     |           890            |           299           |                 15,0                  |                 23,0                  |              23,0              |
| WF 900 x 300 x 243                     |           900            |           300           |                 16,0                  |                 28,0                  |              28,0              |
| WF 900 x 300 x 286                     |           912            |           302           |                 18,0                  |                 34,0                  |              34,0              |
| WF 918 x 303 x 307                     |           918            |           303           |                 19,0                  |                 37,0                  |              37,0              |
| WF 990 x 300 x 258                     |           990            |           300           |                 16,0                  |                 28,0                  |              28,0              |
| WF 1000 x 300 x 272                    |           1000           |           300           |                 16,0                  |                 32,0                  |              32,0              |
| WF 1000 x 300 x 315                    |           1000           |           300           |                 19,0                  |                 36,0                  |              36,0              |
| WF 1008 x 302 x 355                    |           1008           |           302           |                 21,0                  |                 40,0                  |              40,0              |

Setiap baris profil di atas menggunakan dimensi gilas panas aktual dari standar pabrikasi JIS G 3192 / SNI 07-2054 (total 89 profil standar dari WF 100 hingga WF 1008).

### 6. Katalog Dimensi Primer Profil Baja BOX / PSR (JIS G 3466)

Tabel berikut menyajikan 23 profil baja berongga bujur sangkar (SHS) dan persegi panjang (RHS) standar JIS G 3466. Sama seperti katalog IWF, hanya dimensi primer ($H, B, t$ dalam $\text{mm}$) yang disimpan di dalam JSON, sedangkan properti penampang ($A, W, I_x, I_y, S_x, S_y, Z_x, Z_y$), konstanta torsi Saint-Venant ($J$), dan konstanta torsi plastis/elastis ($C$) dihitung secara otomatis menggunakan rumus pada Bagian 4 dokumen `mdfiles/dokumentasi_rumus_profil_baja_wf.md`.

| Profil BOX ($H \times B \times t$) | Tipe Penampang | Tinggi $H$ ($\text{mm}$) | Lebar $B$ ($\text{mm}$) | Tebal Dinding $t$ ($\text{mm}$) |
| :--------------------------------- | :------------: | :----------------------: | :---------------------: | :-----------------------------: |
| BOX 100 x 100 x 4,5                |      SHS       |           100            |           100           |               4,5               |
| BOX 100 x 100 x 6,0                |      SHS       |           100            |           100           |               6,0               |
| BOX 125 x 125 x 6,0                |      SHS       |           125            |           125           |               6,0               |
| BOX 150 x 100 x 6,0                |      RHS       |           150            |           100           |               6,0               |
| BOX 150 x 150 x 6,0                |      SHS       |           150            |           150           |               6,0               |
| BOX 150 x 150 x 9,0                |      SHS       |           150            |           150           |               9,0               |
| BOX 200 x 100 x 6,0                |      RHS       |           200            |           100           |               6,0               |
| BOX 200 x 150 x 9,0                |      RHS       |           200            |           150           |               9,0               |
| BOX 200 x 200 x 9,0                |      SHS       |           200            |           200           |               9,0               |
| BOX 200 x 200 x 12,0               |      SHS       |           200            |           200           |              12,0               |
| BOX 250 x 150 x 9,0                |      RHS       |           250            |           150           |               9,0               |
| BOX 250 x 250 x 9,0                |      SHS       |           250            |           250           |               9,0               |
| BOX 250 x 250 x 12,0               |      SHS       |           250            |           250           |              12,0               |
| BOX 300 x 200 x 9,0                |      RHS       |           300            |           200           |               9,0               |
| BOX 300 x 200 x 12,0               |      RHS       |           300            |           200           |              12,0               |
| BOX 300 x 300 x 12,0               |      SHS       |           300            |           300           |              12,0               |
| BOX 350 x 350 x 12,0               |      SHS       |           350            |           350           |              12,0               |
| BOX 350 x 350 x 16,0               |      SHS       |           350            |           350           |              16,0               |
| BOX 400 x 200 x 12,0               |      RHS       |           400            |           200           |              12,0               |
| BOX 400 x 400 x 12,0               |      SHS       |           400            |           400           |              12,0               |
| BOX 400 x 400 x 16,0               |      SHS       |           400            |           400           |              16,0               |
| BOX 500 x 500 x 16,0               |      SHS       |           500            |           500           |              16,0               |
| BOX 500 x 500 x 22,0               |      SHS       |           500            |           500           |              22,0               |
