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

### 5. Katalog Lengkap & Nyata Profil Baja IWF / H-Beam (JIS G 3192 / SNI 07-2054)

Tabel berikut memuat seluruh 78 profil dari daftar awalmu (dengan penghapusan satu duplikasi ketik pada WF 300 x 300 x 106) ditambah ekspansi profil standar nyata JIS G 3192 / SNI 07-2054 hingga seri 1000 mm (WF 1008 x 302).

| Profil Katalog ($H \times B \times w$) | Dimensi $H \times B$ ($\text{mm}$) | $t_w$ ($\text{mm}$) | $t_f$ ($\text{mm}$) | $r$ ($\text{mm}$) | Luas $A$ ($\text{cm}^2$) | $I_x$ ($\text{cm}^4$) | $I_y$ ($\text{cm}^4$) | $S_x$ ($\text{cm}^3$) | $S_y$ ($\text{cm}^3$) |
| -------------------------------------- | ---------------------------------- | ------------------- | ------------------- | ----------------- | ------------------------ | --------------------- | --------------------- | --------------------- | --------------------- |
| WF 100 x 50 x 9,3                      | 100 x 50                           | 5,0                 | 7,0                 | 7,0               | 11,85                    | 187                   | 14,8                  | 37,5                  | 5,91                  |
| WF 100 x 100 x 17,2                    | 100 x 100                          | 6,0                 | 8,0                 | 8,0               | 21,90                    | 383                   | 134                   | 76,5                  | 26,7                  |
| WF 125 x 60 x 13,2                     | 125 x 60                           | 6,0                 | 8,0                 | 8,0               | 16,84                    | 413                   | 29,2                  | 66,1                  | 9,73                  |
| WF 125 x 125 x 23,8                    | 125 x 125                          | 6,5                 | 9,0                 | 9,0               | 30,31                    | 847                   | 293                   | 136                   | 47,0                  |
| WF 150 x 75 x 14                       | 150 x 75                           | 5,0                 | 7,0                 | 7,0               | 17,85                    | 666                   | 49,5                  | 88,8                  | 13,2                  |
| WF 148 x 100 x 21,1                    | 148 x 100                          | 6,0                 | 9,0                 | 9,0               | 26,84                    | 1020                  | 151                   | 138                   | 30,1                  |
| WF 150 x 100 x 21,1                    | 150 x 100                          | 6,0                 | 9,0                 | 9,0               | 26,84                    | 1030                  | 150                   | 138                   | 30,1                  |
| WF 150 x 150 x 31,5                    | 150 x 150                          | 7,0                 | 10,0                | 10,0              | 40,14                    | 1640                  | 563                   | 219                   | 75,1                  |
| WF 175 x 90 x 18,1                     | 175 x 90                           | 5,0                 | 8,0                 | 8,0               | 23,04                    | 1210                  | 97,5                  | 138                   | 21,7                  |
| WF 175 x 125 x 23,3                    | 175 x 125                          | 5,5                 | 8,0                 | 8,0               | 29,65                    | 1610                  | 261                   | 184                   | 41,8                  |
| WF 175 x 175 x 40,2                    | 175 x 175                          | 7,5                 | 11,0                | 11,0              | 51,21                    | 2880                  | 984                   | 330                   | 112                   |
| WF 198 x 99 x 18,2                     | 198 x 99                           | 4,5                 | 7,0                 | 7,0               | 23,18                    | 1580                  | 114                   | 160                   | 23,0                  |
| WF 200 x 100 x 18,2                    | 200 x 100                          | 4,5                 | 7,0                 | 7,0               | 23,18                    | 1620                  | 117                   | 162                   | 23,4                  |
| WF 200 x 100 x 21,3                    | 200 x 100                          | 5,5                 | 8,0                 | 8,0               | 27,16                    | 1840                  | 134                   | 184                   | 26,8                  |
| WF 194 x 150 x 30,6                    | 194 x 150                          | 6,0                 | 9,0                 | 9,0               | 39,01                    | 2690                  | 507                   | 277                   | 67,6                  |
| WF 200 x 150 x 30,6                    | 200 x 150                          | 6,0                 | 9,0                 | 9,0               | 39,01                    | 2860                  | 506                   | 286                   | 67,5                  |
| WF 200 x 200 x 49,9                    | 200 x 200                          | 8,0                 | 12,0                | 12,0              | 63,53                    | 4720                  | 1600                  | 472                   | 160                   |
| WF 200 x 200 x 56,2                    | 200 x 204                          | 12,0                | 12,0                | 12,0              | 71,53                    | 4980                  | 1700                  | 498                   | 167                   |
| WF 200 x 200 x 65,7                    | 208 x 202                          | 10,0                | 16,0                | 16,0              | 83,69                    | 6530                  | 2200                  | 628                   | 218                   |
| WF 250 x 125 x 25,7                    | 248 x 124                          | 5,0                 | 8,0                 | 8,0               | 32,68                    | 3540                  | 255                   | 285                   | 41,1                  |
| WF 250 x 125 x 29,6                    | 250 x 125                          | 6,0                 | 9,0                 | 9,0               | 37,66                    | 4050                  | 294                   | 324                   | 47,0                  |
| WF 250 x 175 x 44,1                    | 244 x 175                          | 7,0                 | 11,0                | 11,0              | 56,24                    | 6120                  | 984                   | 502                   | 113                   |
| WF 250 x 250 x 64,4                    | 244 x 252                          | 11,0                | 11,0                | 11,0              | 82,06                    | 8790                  | 2940                  | 720                   | 233                   |
| WF 250 x 250 x 66,5                    | 248 x 249                          | 8,0                 | 13,0                | 13,0              | 84,73                    | 9930                  | 3350                  | 801                   | 269                   |
| WF 250 x 250 x 72,4                    | 250 x 250                          | 9,0                 | 14,0                | 14,0              | 92,18                    | 10800                 | 3650                  | 867                   | 292                   |
| WF 250 x 250 x 82,2                    | 250 x 255                          | 14,0                | 14,0                | 14,0              | 104,7                    | 11500                 | 3880                  | 919                   | 304                   |
| WF 300 x 150 x 32                      | 298 x 149                          | 5,5                 | 8,0                 | 8,0               | 40,80                    | 6320                  | 442                   | 424                   | 59,3                  |
| WF 300 x 150 x 36,7                    | 300 x 150                          | 6,5                 | 9,0                 | 9,0               | 46,78                    | 7210                  | 508                   | 481                   | 67,7                  |
| WF 300 x 200 x 56,8                    | 294 x 200                          | 8,0                 | 12,0                | 12,0              | 72,38                    | 11300                 | 1600                  | 771                   | 160                   |
| WF 300 x 200 x 65,4                    | 298 x 201                          | 9,0                 | 14,0                | 14,0              | 83,36                    | 13300                 | 1900                  | 893                   | 189                   |
| WF 300 x 300 x 84,5                    | 294 x 302                          | 12,0                | 12,0                | 12,0              | 107,7                    | 16900                 | 5520                  | 1150                  | 365                   |
| WF 300 x 300 x 87                      | 298 x 299                          | 9,0                 | 14,0                | 14,0              | 110,8                    | 18800                 | 6240                  | 1260                  | 418                   |
| WF 300 x 300 x 94                      | 300 x 300                          | 10,0                | 15,0                | 15,0              | 119,8                    | 20400                 | 6750                  | 1360                  | 450                   |
| WF 300 x 300 x 106 (a)                 | 300 x 305                          | 15,0                | 15,0                | 15,0              | 134,8                    | 21500                 | 7100                  | 1440                  | 466                   |
| WF 300 x 300 x 106 (b)                 | 304 x 301                          | 11,0                | 17,0                | 17,0              | 135,4                    | 23400                 | 7730                  | 1540                  | 514                   |
| WF 300 x 300 x 132                     | 310 x 305                          | 15,0                | 20,0                | 20,0              | 168,4                    | 29000                 | 9540                  | 1870                  | 626                   |
| WF 350 x 175 x 41,4                    | 346 x 174                          | 6,0                 | 9,0                 | 9,0               | 52,68                    | 11100                 | 792                   | 641                   | 91,0                  |
| WF 350 x 175 x 49,6                    | 350 x 175                          | 7,0                 | 11,0                | 11,0              | 63,14                    | 13600                 | 984                   | 775                   | 112                   |
| WF 350 x 250 x 69,2                    | 336 x 249                          | 8,0                 | 12,0                | 12,0              | 88,15                    | 18700                 | 3090                  | 1110                  | 248                   |
| WF 350 x 250 x 79,7                    | 340 x 250                          | 9,0                 | 14,0                | 14,0              | 101,5                    | 21700                 | 3650                  | 1280                  | 292                   |
| WF 350 x 350 x 106                     | 338 x 351                          | 13,0                | 13,0                | 13,0              | 135,3                    | 28200                 | 9380                  | 1670                  | 534                   |
| WF 350 x 350 x 115                     | 344 x 348                          | 10,0                | 16,0                | 16,0              | 146,0                    | 33300                 | 11200                 | 1940                  | 646                   |
| WF 350 x 350 x 131                     | 344 x 354                          | 16,0                | 16,0                | 16,0              | 166,6                    | 35300                 | 11800                 | 2050                  | 669                   |
| WF 350 x 350 x 137                     | 350 x 350                          | 12,0                | 19,0                | 19,0              | 173,9                    | 40300                 | 13600                 | 2300                  | 776                   |
| WF 350 x 350 x 156                     | 350 x 357                          | 19,0                | 19,0                | 19,0              | 198,4                    | 42800                 | 14400                 | 2450                  | 809                   |
| WF 350 x 350 x 159                     | 356 x 352                          | 14,0                | 22,0                | 22,0              | 202,2                    | 47600                 | 16000                 | 2670                  | 909                   |
| WF 400 x 200 x 56,6                    | 396 x 199                          | 7,0                 | 11,0                | 11,0              | 72,16                    | 20000                 | 1450                  | 1010                  | 145                   |
| WF 400 x 200 x 66                      | 400 x 200                          | 8,0                 | 13,0                | 13,0              | 84,12                    | 23700                 | 1740                  | 1190                  | 174                   |
| WF 400 x 300 x 94,3                    | 386 x 299                          | 9,0                 | 14,0                | 14,0              | 120,1                    | 33700                 | 6240                  | 1740                  | 418                   |
| WF 400 x 300 x 107                     | 390 x 300                          | 10,0                | 16,0                | 16,0              | 136,0                    | 38700                 | 7210                  | 1980                  | 481                   |
| WF 400 x 400 x 140                     | 388 x 402                          | 15,0                | 15,0                | 15,0              | 178,5                    | 49000                 | 16300                 | 2520                  | 809                   |
| WF 400 x 400 x 147                     | 394 x 398                          | 11,0                | 18,0                | 18,0              | 186,8                    | 56100                 | 18900                 | 2850                  | 951                   |
| WF 400 x 400 x 168                     | 394 x 405                          | 18,0                | 18,0                | 18,0              | 214,4                    | 59700                 | 20000                 | 3030                  | 988                   |
| WF 400 x 400 x 172                     | 400 x 400                          | 13,0                | 21,0                | 21,0              | 218,7                    | 66600                 | 22400                 | 3330                  | 1120                  |
| WF 400 x 400 x 197                     | 400 x 408                          | 21,0                | 21,0                | 21,0              | 250,7                    | 70900                 | 23800                 | 3540                  | 1170                  |
| WF 400 x 400 x 200                     | 406 x 403                          | 16,0                | 24,0                | 24,0              | 254,9                    | 78000                 | 26200                 | 3840                  | 1300                  |
| WF 400 x 400 x 232                     | 414 x 405                          | 18,0                | 28,0                | 28,0              | 295,4                    | 92800                 | 31000                 | 4480                  | 1530                  |
| WF 400 x 400 x 283                     | 428 x 407                          | 20,0                | 35,0                | 35,0              | 360,7                    | 119000                | 39400                 | 5570                  | 1930                  |
| WF 400 x 400 x 415                     | 458 x 417                          | 30,0                | 50,0                | 50,0              | 528,6                    | 187000                | 60500                 | 8170                  | 2900                  |
| WF 400 x 400 x 605                     | 498 x 432                          | 45,0                | 70,0                | 70,0              | 770,1                    | 298000                | 94400                 | 12000                 | 4370                  |
| WF 450 x 200 x 66,2                    | 446 x 199                          | 8,0                 | 12,0                | 12,0              | 84,30                    | 28700                 | 1580                  | 1290                  | 159                   |
| WF 450 x 200 x 76                      | 450 x 200                          | 9,0                 | 14,0                | 14,0              | 96,76                    | 33500                 | 1870                  | 1490                  | 187                   |
| WF 450 x 300 x 106                     | 434 x 299                          | 10,0                | 15,0                | 15,0              | 135,1                    | 46800                 | 6690                  | 2160                  | 448                   |
| WF 450 x 300 x 124                     | 440 x 300                          | 11,0                | 18,0                | 18,0              | 157,4                    | 56100                 | 8110                  | 2550                  | 541                   |
| WF 500 x 200 x 79,5                    | 496 x 199                          | 9,0                 | 14,0                | 14,0              | 101,3                    | 41900                 | 1840                  | 1690                  | 185                   |
| WF 500 x 200 x 89,6                    | 500 x 200                          | 10,0                | 16,0                | 16,0              | 114,2                    | 47800                 | 2140                  | 1910                  | 214                   |
| WF 500 x 200 x 103                     | 506 x 201                          | 11,0                | 19,0                | 19,0              | 131,3                    | 56500                 | 2580                  | 2230                  | 257                   |
| WF 500 x 300 x 114                     | 482 x 300                          | 11,0                | 15,0                | 15,0              | 145,5                    | 60400                 | 6760                  | 2510                  | 451                   |
| WF 500 x 300 x 128                     | 488 x 300                          | 11,0                | 18,0                | 18,0              | 163,5                    | 71000                 | 8110                  | 2910                  | 541                   |
| WF 600 x 200 x 94,6                    | 596 x 199                          | 10,0                | 15,0                | 15,0              | 120,5                    | 68700                 | 1980                  | 2310                  | 199                   |
| WF 600 x 200 x 106                     | 600 x 200                          | 11,0                | 17,0                | 17,0              | 134,4                    | 77600                 | 2280                  | 2590                  | 228                   |
| WF 600 x 200 x 120                     | 606 x 201                          | 12,0                | 20,0                | 20,0              | 152,5                    | 90400                 | 2720                  | 2980                  | 271                   |
| WF 600 x 200 x 134                     | 612 x 202                          | 13,0                | 23,0                | 23,0              | 170,7                    | 103000                | 3180                  | 3380                  | 315                   |
| WF 600 x 300 x 137                     | 582 x 300                          | 12,0                | 17,0                | 17,0              | 174,5                    | 103000                | 7670                  | 3530                  | 511                   |
| WF 600 x 300 x 151                     | 588 x 300                          | 12,0                | 20,0                | 20,0              | 192,5                    | 118000                | 9020                  | 4020                  | 601                   |
| WF 600 x 300 x 175                     | 594 x 302                          | 14,0                | 23,0                | 23,0              | 222,4                    | 137000                | 10600                 | 4620                  | 701                   |
| WF 700 x 300 x 166                     | 692 x 300                          | 13,0                | 20,0                | 20,0              | 211,5                    | 172000                | 9020                  | 4980                  | 602                   |
| WF 700 x 300 x 185                     | 700 x 300                          | 13,0                | 24,0                | 24,0              | 235,5                    | 201000                | 10800                 | 5760                  | 722                   |
| WF 700 x 300 x 215                     | 708 x 302                          | 15,0                | 28,0                | 28,0              | 273,6                    | 237000                | 12900                 | 6700                  | 853                   |
| WF 800 x 300 x 191                     | 792 x 300                          | 14,0                | 22,0                | 22,0              | 243,4                    | 254000                | 9930                  | 6410                  | 662                   |
| WF 800 x 300 x 210                     | 800 x 300                          | 14,0                | 26,0                | 26,0              | 267,4                    | 292000                | 11700                 | 7290                  | 782                   |
| WF 800 x 300 x 241                     | 808 x 302                          | 16,0                | 30,0                | 30,0              | 307,6                    | 339000                | 13800                 | 8390                  | 915                   |
| WF 900 x 300 x 213                     | 890 x 299                          | 15,0                | 23,0                | 23,0              | 270,9                    | 345000                | 10300                 | 7760                  | 688                   |
| WF 900 x 300 x 243                     | 900 x 300                          | 16,0                | 28,0                | 28,0              | 309,8                    | 411000                | 12600                 | 9140                  | 843                   |
| WF 900 x 300 x 286                     | 912 x 302                          | 18,0                | 34,0                | 34,0              | 364,0                    | 498000                | 15700                 | 10900                 | 1040                  |
| WF 918 x 303 x 307                     | 918 x 303                          | 19,0                | 37,0                | 37,0              | 391,2                    | 541000                | 17200                 | 11800                 | 1140                  |
| WF 990 x 300 x 258                     | 990 x 300                          | 16,0                | 28,0                | 28,0              | 328,4                    | 512000                | 12600                 | 10300                 | 843                   |
| WF 1000 x 300 x 272                    | 1000 x 300                         | 16,0                | 32,0                | 32,0              | 346,8                    | 566000                | 14400                 | 11300                 | 963                   |
| WF 1000 x 300 x 315                    | 1000 x 300                         | 19,0                | 36,0                | 36,0              | 401,2                    | 644000                | 16300                 | 12900                 | 1085                  |
| WF 1008 x 302 x 355                    | 1008 x 302                         | 21,0                | 40,0                | 40,0              | 452,2                    | 732000                | 18400                 | 14500                 | 1218                  |

Setiap baris profil di atas menggunakan dimensi gilas panas aktual dari standar pabrikasi JIS G 3192 / SNI 07-2054, di mana empat profil terakhir merupakan seri 918 mm hingga 1008 mm untuk mendukung beban jembatan atau gelagar bentang besar.

### 6. Katalog Nyata Profil Baja BOX / PSR (JIS G 3466)

Tabel berikut menyajikan 23 profil baja berongga bujur sangkar (SHS) dan persegi panjang (RHS) standar JIS G 3466 untuk evaluasi beban torsi $T_u$ dan lentur biaxial.

| Profil BOX ($H \times B \times t$) | Tipe | Berat $w$ (kg/m) | Luas $A$ ($\text{cm}^2$) | $I_x$ ($\text{cm}^4$) | $I_y$ ($\text{cm}^4$) | $Z_x$ ($\text{cm}^3$) | Torsi $C$ ($\text{cm}^3$) |
| ---------------------------------- | ---- | ---------------- | ------------------------ | --------------------- | --------------------- | --------------------- | ------------------------- |
| BOX 100 x 100 x 4,5                | SHS  | 13,1             | 16,7                     | 249                   | 249                   | 58,6                  | 90,3                      |
| BOX 100 x 100 x 6,0                | SHS  | 17,0             | 21,6                     | 311                   | 311                   | 74,9                  | 116                       |
| BOX 125 x 125 x 6,0                | SHS  | 21,7             | 27,6                     | 638                   | 638                   | 121                   | 187                       |
| BOX 150 x 100 x 6,0                | RHS  | 21,7             | 27,6                     | 842                   | 448                   | 137                   | 166                       |
| BOX 150 x 150 x 6,0                | SHS  | 26,4             | 33,6                     | 1150                  | 1150                  | 179                   | 276                       |
| BOX 150 x 150 x 9,0                | SHS  | 38,0             | 48,4                     | 1560                  | 1560                  | 253                   | 396                       |
| BOX 200 x 100 x 6,0                | RHS  | 26,4             | 33,6                     | 1710                  | 584                   | 213                   | 216                       |
| BOX 200 x 150 x 9,0                | RHS  | 45,1             | 57,4                     | 3160                  | 2010                  | 386                   | 485                       |
| BOX 200 x 200 x 9,0                | SHS  | 52,1             | 66,4                     | 3990                  | 3990                  | 476                   | 737                       |
| BOX 200 x 200 x 12,0               | SHS  | 66,9             | 85,2                     | 4890                  | 4890                  | 601                   | 941                       |
| BOX 250 x 150 x 9,0                | RHS  | 52,1             | 66,4                     | 5430                  | 2460                  | 538                   | 575                       |
| BOX 250 x 250 x 9,0                | SHS  | 66,3             | 84,4                     | 8090                  | 8090                  | 764                   | 1180                      |
| BOX 250 x 250 x 12,0               | SHS  | 85,7             | 109,2                    | 10100                 | 10100                 | 977                   | 1520                      |
| BOX 300 x 200 x 9,0                | RHS  | 66,3             | 84,4                     | 10300                 | 5570                  | 839                   | 1020                      |
| BOX 300 x 200 x 12,0               | RHS  | 85,7             | 109,2                    | 12900                 | 6930                  | 1070                  | 1310                      |
| BOX 300 x 300 x 12,0               | SHS  | 105,0            | 133,2                    | 18100                 | 18100                 | 1450                  | 2240                      |
| BOX 350 x 350 x 12,0               | SHS  | 123,0            | 157,2                    | 29500                 | 29500                 | 2010                  | 3100                      |
| BOX 350 x 350 x 16,0               | SHS  | 160,0            | 203,8                    | 37000                 | 37000                 | 2580                  | 4010                      |
| BOX 400 x 200 x 12,0               | RHS  | 105,0            | 133,2                    | 26500                 | 8980                  | 1670                  | 1680                      |
| BOX 400 x 400 x 12,0               | SHS  | 142,0            | 181,2                    | 44800                 | 44800                 | 2660                  | 4100                      |
| BOX 400 x 400 x 16,0               | SHS  | 185,0            | 235,8                    | 56700                 | 56700                 | 3440                  | 5330                      |
| BOX 500 x 500 x 16,0               | SHS  | 235,0            | 299,8                    | 115000                | 115000                | 5520                  | 8530                      |
| BOX 500 x 500 x 22,0               | SHS  | 315,0            | 401,2                    | 149000                | 149000                | 7300                  | 11400                     |

Seluruh nilai konstanta torsi $C$ pada tabel di atas dihitung menggunakan rumusan konservatif Catatan Pengguna Pasal H3.1 yaitu $C = 2(B - t)(H - t)t - 4,5(4 - \pi)t^3$.
