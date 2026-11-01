# 📦 Spesifikasi Ekspor Multi-Format CAD, BIM, & CAE (`src/core/exporters/`)

> **Dokumen Spesifikasi Interoperabilitas & Ekspor (`mdfiles/cad_bim_cae_export_specification.md`)**
> Dokumen ini mendefinisikan arsitektur dan struktur format _file_ untuk fitur **Multi-Software Profile & Structural Model Exporter** pada **Interactive Beam Deflection & Structural Design Simulator**.
> Seluruh _exporter_ berjalan secara _native_ di sisi klien/server menggunakan TypeScript dan buffer geometri dari Rust WASM (`crates/mechanics-3d-wasm/`) **tanpa memerlukan lisensi atau instalasi perangkat lunak pihak ketiga di server**, serta secara otomatis menghormati orientasi sumbu koordinat (**`Z-Up`**, **`Y-Up`**, atau **Kustom** $X\text{-}Y\text{-}Z$) yang dipilih pengguna.

## 🗺️ 1. Matriks Kompatibilitas Ekstensi File & Software Tujuan

Tabel berikut memetakan setiap perangkat lunak teknik sipil dan mesin ke format _file_ standar industri yang dihasilkan oleh simulator:

| Perangkat Lunak Tujuan                         | Ekstensi File Utama                                     | Standar / Skema Format                                     | Data yang Diekspor oleh Simulator                                                                                                                                                                                                                                                                          |
| ---------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AutoCAD, Civil 3D, BricsCAD**                | **`.dxf`** & **`.lsp`**                                 | AutoCAD DXF (AC1015 / R2000 ASCII) & AutoLISP              | • **2D Cross-Section DXF:** Poligon profil IWF (dengan busur _fillet_ $r$), BOX, atau Beton + lingkaran tulangan $A_s, A'_s$ + sengkang lengkap dengan garis dimensi pada _layer_ terpisah. • **3D Beam DXF & `.lsp`:** Geometri balok 3D utuh atau terdefleksi.                                           |
| **SAP2000 & ETABS (CSI)**                      | **`.s2k`**                                              | CSI SAP2000 Text Model Input File                          | • Properti Material (`BJ 34–55`, Beton $f'_c$, Tulangan `BJTS/BJTP`) • Properti Penampang (`I/Wide Flange`, `Box/Tube`, atau `Concrete Rectangular` + susunan tulangan) • Koordinat Titik, Kondisi Tumpuan (`Restraints` sesuai 5 jenis tumpuan), dan Pembebanan (`Frame Loads`).                          |
| **Autodesk Revit, Tekla Structures, ArchiCAD** | **`.ifc`** & **`.txt`**                                 | ISO 16739 `IFC4` (STEP Physical File) & Revit Type Catalog | • **Model BIM `.ifc`:** Entitas `IfcBeam` dengan `IfcIShapeProfileDef`, `IfcRectangleHollowProfileDef`, atau `IfcRectangleProfileDef` + `IfcReinforcingBar` (tulangan memanjang & sengkang 3D). • **Revit Type Catalog `.txt`:** Parameter dimensi keluarga profil untuk diimpor langsung ke Revit Family. |
| **IDEA StatiCa (Connection & Member)**         | **`.iom.xml`**, **`.saf.xlsx`**, **`.dxf`**, **`.ifc`** | IDEA Open Model XML, Nemetschek SAF, DXF 2D, & IFC4        | • **Cross-Section DXF:** Untuk diimpor langsung ke _IDEA StatiCa Cross-Sectional Editor_. • **Model & Gaya Dalam (`.iom.xml` / `.ifc`):** Membawa profil baja terpilih, mutu baja, serta gaya dalam terfaktor ($N \equiv P_u, V_z \equiv V_u, M_y \equiv M_{ux}, M_z \equiv M_{uy}, T \equiv T_u$).        |
| **SolidWorks, Inventor, Fusion 360, ANSYS**    | **`.step`** (**`.stp`**) & **`.stl`**                   | ISO 10303-21 `AP214` (B-Rep Solid) & Binary/ASCII STL      | • **`.step` / `.stp`:** Benda padat 3D analitis (_Boundary Representation_ / `EXTRUDED_AREA_SOLID`) untuk profil IWF, BOX, maupun Beton + Tulangan. • **`.stl`:** _Triangle mesh_ 3D langsung dari buffer Rust WASM (mendukung ekspor bentuk balok yang sedang melengkung terdefleksi).                    |

## 📐 2. Spesifikasi Teknis Tiap Generator Format (`src/core/exporters/`)

### 2.1. Generator AutoCAD `.dxf` & `.lsp` (`dxf-autocad-exporter.ts`)

Generator menghasilkan file ASCII `.dxf` murni yang terbagi dalam 4 _Layer_ standar gambar teknik struktural:

1. **`S-SECT-OUTLINE` (Warna 7 / Putih — Garis Tebal `0.35 mm`):**

   - Untuk **Profil IWF:** Menggunakan entitas `LWPOLYLINE` tertutup dengan 16 titik simpul, di mana 4 sudut pertemuan badan (_web_) dan sayap (_flange_) menggunakan nilai _bulge_ busur lingkaran eksak:

     $$
     \text{bulge} = \tan\left(\frac{\Delta\theta}{4}\right) = \tan\left(\frac{\pi / 2}{4}\right) = \sqrt{2} - 1 \approx 0,41421356
     $$

   - Untuk **Profil BOX:** Dua `LWPOLYLINE` tertutup konsentris (kontur luar $B \times H$ dengan jari-jari sudut luar $r_{\text{out}} = 2t$ dan kontur dalam $(B - 2t) \times (H - 2t)$ dengan $r_{\text{in}} = t$).

   - Untuk **Beton Bertulang:** `LWPOLYLINE` persegi panjang luar $b_w \times h$.

2. **`S-REBAR-STIRRUP` (Warna 3 / Hijau — Garis `0.25 mm`):**

   - Cincin sengkang tertutup pada jarak selimut bersih $c_c$ dari tepi beton.

3. **`S-REBAR-MAIN` (Warna 1 / Merah — Garis Tebal / Hatch):**

   - Entitas `CIRCLE` dengan pusat $(u_i, v_i)$ dan jari-jari $r_b = d_b / 2$ untuk setiap batang tulangan tarik ($A_s$) di bagian bawah dan tulangan tekan ($A'_s$) di bagian atas.

4. **`S-ANNO-DIMS` (Warna 4 / Cyan):**

   - Teks anotasi otomatis nama profil/dimensi, mutu material, jumlah & diameter tulangan (`4 D19`), spasi sengkang (`Ø10 - 150 mm`), dan nilai lendutan maksimum ($\Delta_{\max} = -xx,xx\text{ mm}$).

### 2.2. Generator SAP2000 & ETABS `.s2k` (`s2k-sap2000-exporter.ts`)

Menghasilkan _file_ teks `.s2k` yang mematuhi skema tabel _database_ CSI SAP2000 (menggunakan orientasi sumbu `Z-Up` standar SAP2000 di mana sumbu vertikal adalah $+Z$ dan lendutan ke bawah bernilai $-Z$):

```
File Contoh Struktur Tabel .s2k yang Dihasilkan:
TABLE:  "PROGRAM CONTROL"
   ProgramName=SAP2000   Version=24.0.0   CurrUnits="KN, mm, C"

TABLE:  "MATERIAL PROPERTIES 02 - BASIC MECHANICAL PROPERTIES"
   Material=BJ41   UnitWeight=7.85E-05   UnitMass=8.00E-09   E1=200000   G12=76923.08   U12=0.3

TABLE:  "FRAME SECTION PROPERTIES 01 - GENERAL"
   SectionName="IWF-300x150x6.5x9"   Material=BJ41   Shape="I/Wide Flange"   t3=300   t2=150   tf=9   tw=6.5   t2b=150   tfb=9   FilletRadius=9

TABLE:  "JOINT COORDINATES"
   Joint=1   CoordSys=GLOBAL   CoordType=Cartesian   XorR=0     Y=0   Z=0
   Joint=2   CoordSys=GLOBAL   CoordType=Cartesian   XorR=6000  Y=0   Z=0

TABLE:  "JOINT RESTRAINT ASSIGNMENTS"
   Joint=1   U1=Yes   U2=Yes   U3=Yes   R1=Yes   R2=No    R3=No
   Joint=2   U1=No    U2=Yes   U3=Yes   R1=Yes   R2=No    R3=No

```

Pemetaan otomatis **5 Jenis Tumpuan Simulator ke `JOINT RESTRAINT ASSIGNMENTS` SAP2000** (dalam bidang lentur $X\text{-}Z$):

- **Jepit (_Fixed_):** `U1=Yes  U2=Yes  U3=Yes  R1=Yes  R2=Yes  R3=Yes`

- **Sendi (_Pinned_):** `U1=Yes  U2=Yes  U3=Yes  R1=Yes  R2=No   R3=No`

- **Rol (_Roller_):** `U1=No   U2=Yes  U3=Yes  R1=Yes  R2=No   R3=No`

- **Bebas (_Free_):** `U1=No   U2=No   U3=No   R1=No   R2=No   R3=No`

### 2.3. Generator BIM `.ifc` (`IFC4` — Revit, Tekla, & IDEA StatiCa) (`ifc4-bim-revit-exporter.ts`)

Menghasilkan _file_ ASCII `ISO-10303-21` dengan skema `IFC4` yang dapat dibuka langsung di **Autodesk Revit**, **Tekla Structures**, dan **IDEA StatiCa**:

- **Untuk Balok Baja IWF:** Menggunakan entitas parametrik asli `IFCIISHAPEPROFILEDEF(.AREA., 'IWF 300x150', #, B, H, tw, tf, r, $, $)` yang diekstrusi sepanjang $L$ menggunakan `IFCEXTRUDEDAREASOLID`.

- **Untuk Balok Baja BOX (PSR):** Menggunakan `IFCRECTANGLEHOLLOWPROFILEDEF(.AREA., 'BOX 250x250x9', #, B, H, t, r_in, r_out)`.

- **Untuk Balok Beton Bertulang:** Menggunakan `IFCRECTANGLEPROFILEDEF` untuk badan beton $b_w \times h$, dilengkapi entitas `IFCREINFORCINGBAR` untuk setiap batang tulangan tarik ($A_s$), tulangan tekan ($A'_s$), dan sengkang tertutup sepanjang bentang $L$.

### 2.4. Generator SolidWorks / MCAD `.step` (`.stp`) & `.stl` (`step-solidworks-exporter.ts`)

- **Format `.step` (`ISO-10303-21 AP214`):** Membangun kurva tertutup `COMPOSITE_CURVE` (terdiri atas `LINE` dan `CIRCLE` untuk sudut _fillet_ $r$) pada bidang penampang ujung A, lalu mengekstrusinya menjadi benda padat `EXTRUDED_AREA_SOLID` sepanjang vektor sumbu memanjang balok sesuai orientasi koordinat (`Y-Up` atau `Z-Up`) yang dipilih pengguna. File `.step` ini terbaca sebagai _native solid feature_ di **SolidWorks**, **Autodesk Inventor**, dan **Fusion 360**.

- **Format `.stl` (3D Mesh Terdefleksi):** Mengonversi secara langsung _vertex & index buffer_ (`Float32Array`) dari memori linear Rust WASM menjadi _binary/ASCII STL_, sehingga pengguna dapat mengekspor bentuk 3D balok yang sedang melengkung akibat lendutan ($\Delta < 0$) maupun kerangka 3D tulangan/sengkang untuk keperluan pencetakan 3D (_3D printing_) atau presentasi visual.

### 2.5. Generator IDEA StatiCa `.iom.xml` & `.saf` (`ideastatica-exporter.ts`)

Untuk memfasilitasi analisis sambungan atau elemen lebih lanjut di **IDEA StatiCa**, simulator mengekspor paket data yang berisi:

1. File `.dxf` 2D penampang atau `.ifc` 3D member.

2. File XML **IDEA Open Model (`.iom.xml`)** yang merangkum geometri batang (`LineSegment3D`), referensi material (`BJ 34–55`), profil penampang, serta nilai gaya dalam ekstrem hasil perhitungan simulator ($N = P_u$, $V_z = V_u$, $M_y = M_{ux}$, $M_z = M_{uy}$, $T_x = T_u$) pada titik kritis.
