import type { CalculationSourceItem } from "@/types/presentation-types";

export const CALCULATION_SOURCES: readonly CalculationSourceItem[] = [
  {
    id: "mechanics-euler-bernoulli",
    domain: "Mekanika Balok & Lendutan",
    standard: "Euler-Bernoulli Orde-1 · Macaulay · Kompatibilitas Mohr (M = 256)",
    summary:
      "Integrasi trapesium ganda pada 256 stasiun diskrit di Rust WASM dengan konvensi lendutan gravitasi negatif (Δ < 0) dan superposisi momen ujung statis tak tentu.",
    equations: [
      {
        label: "Persamaan Garis Elastis & Momen Ujung Statis Tak Tentu",
        latex:
          "\\frac{d^2 v}{ds^2} = +\\frac{M_{\\text{major}}(s)}{EI}, \\qquad M_A^{\\text{FF}} = -\\frac{2}{L}(2\\Phi_A - \\Phi_B), \\qquad M_A^{\\text{FR}} = -\\frac{3}{L}\\Phi_A",
      },
      {
        label: "Interpolasi Defleksi Mode B (Sendi-Rol, Jepit-Jepit, Kantilever)",
        latex:
          "\\Delta_{\\max,\\text{SS}} = -\\frac{5|M_{ux}|L^2}{48EI}, \\qquad \\Delta_{\\max,\\text{FF}} = -\\frac{|M_{ux}|L^2}{32EI}, \\qquad \\Delta_{\\max,\\text{Cant}} = -\\frac{|M_{ux}|L^2}{4EI}",
      },
    ],
    codeRefs: [
      "crates/mechanics-3d-wasm/src/supports.rs",
      "crates/mechanics-3d-wasm/src/deflection.rs",
      "src/core/mechanics/euler-bernoulli-deflection-solver.ts",
    ],
  },
  {
    id: "steel-section-geometry",
    domain: "Geometri Profil Baja & Fillet",
    standard: "JIS G 3192 / SNI 07-2054 (90 IWF) · JIS G 3466 (23 BOX) · AISC Design Guide 9",
    summary:
      "Katalog hanya menyimpan 5 dimensi primer (H, B, tw, tf, r); seluruh properti turunan termasuk kontribusi 4 sudut fillet dan torsi Bredt dihitung otomatis saat compile-time oleh Bun Macro.",
    equations: [
      {
        label: "Konstanta Fillet, Warping Cw & Jari-Jari Girasi Efektif rts (IWF)",
        latex:
          "a_f = \\left(1 - \\frac{\\pi}{4}\\right)r_c^2, \\qquad C_w = \\frac{I_y h_o^2}{4}, \\qquad r_{ts} = \\sqrt{\\frac{I_y h_o}{2 S_x}}",
      },
      {
        label: "Konstanta Torsi Saint-Venant Bredt & Parameter C (BOX / PSR)",
        latex:
          "J = \\frac{2 t_w (b - t_w)^2 (h - t_w)^2}{b + h - 2 t_w}, \\qquad C = 2(b - t_w)(h - t_w)t_w - 4.5(4 - \\pi)t_w^3",
      },
    ],
    codeRefs: [
      "src/data/steel-iwf-catalog.json",
      "src/data/steel-box-catalog.json",
      "src/core/steel/iwf-geometric-properties.ts",
      "src/macros/precompute-steel-catalog.macro.ts",
    ],
  },
  {
    id: "steel-sni-1729",
    domain: "Desain Struktur Baja",
    standard: "SNI 1729:2020 (Adopsi ANSI/AISC 360-16) · Bab B4, F, G, H",
    summary:
      "Evaluasi DFBT (LRFD) penuh untuk 5 mutu baja (BJ 34–55, E = 200.000 MPa) mencakup kelangsingan Tabel B4.1b, 3 zona LTB Bab F, geser Bab G, interaksi biaksial H1, dan torsi H3.",
    equations: [
      {
        label: "Kapasitas Plastis & Batas Panjang LTB (Pasal F2, φb = 0.90)",
        latex:
          "M_p = F_y Z_x, \\qquad L_p = 1.76 r_y \\sqrt{\\frac{E}{F_y}}, \\qquad \\text{DCR} = \\frac{M_u}{\\phi_b M_n} \\in [0.90, 1.00]",
      },
      {
        label: "Interaksi Aksial-Lentur (H1-1a) & Kombinasi Torsi BOX (H3-6)",
        latex:
          "\\frac{P_r}{P_c} + \\frac{8}{9}\\left(\\frac{M_{rx}}{M_{cx}} + \\frac{M_{ry}}{M_{cy}}\\right) \\le 1.0, \\qquad \\left(\\frac{P_r}{P_c} + \\frac{M_r}{M_c}\\right) + \\left(\\frac{V_r}{V_c} + \\frac{T_r}{T_c}\\right)^2 \\le 1.0",
      },
    ],
    codeRefs: [
      "src/core/steel/section-compactness-classifier.ts",
      "src/core/steel/lateral-torsional-buckling-solver.ts",
      "src/core/steel/biaxial-interaction-evaluator.ts",
      "src/core/steel/steel-section-optimizer.ts",
    ],
  },
  {
    id: "concrete-sni-2847",
    domain: "Desain Beton Bertulang",
    standard: "SNI 2847:2019 · Pasal 9.6, 19.2, 21.2, 22.2, 22.5, 24.2, 25.2",
    isBeta: true,
    summary:
      "Optimasi murni lentur (Mu) dengan blok tegangan tekan ekuivalen Whitney 1–2 lapis (εt ≥ 0.005, φ = 0.90) serta sengkang geser (Vu) dengan batas web crushing Vs,max.",
    equations: [
      {
        label: "Konversi Mutu K-xxx, Modulus Ec & Batas Tulangan Minimum",
        latex:
          "f'_c = 0.083 K, \\qquad E_c = 4700\\sqrt{f'_c}, \\qquad A_{s,\\min} = \\max\\!\\left(\\frac{0.25\\sqrt{f'_c}}{f_y}, \\frac{1.4}{f_y}\\right) b_w d",
      },
      {
        label: "Kuat Geser Beton Standar & Batas Web Crushing (φv = 0.75)",
        latex:
          "V_c = 0.17 \\lambda \\sqrt{f'_c} b_w d, \\qquad V_{s,\\max} = 0.66 \\sqrt{f'_c} b_w d, \\qquad s = \\frac{A_v f_{yt} d}{V_s}",
      },
    ],
    codeRefs: [
      "src/core/concrete/concrete-grade-converter.ts",
      "src/core/concrete/whitney-flexural-designer.ts",
      "src/core/concrete/shear-stirrup-designer.ts",
      "src/core/concrete/concrete-section-optimizer.ts",
    ],
  },
  {
    id: "branded-units-integrity",
    domain: "Integritas Satuan Fisika",
    standard: "Nominal TypeScript Branded Units (Compile-Time Safety)",
    summary:
      "Seluruh besaran mekanika (kN, kNm, N, Nmm, MPa, mm, m, DCR) dibungkus tipe nominal ketat sehingga kesalahan pencampuran satuan terdeteksi saat bun check -b sebelum aplikasi berjalan.",
    equations: [
      {
        label: "Konversi Eksplisit Terverifikasi Kompilator",
        latex:
          "1\\ \\text{kN}\\cdot\\text{m} = 10^6\\ \\text{N}\\cdot\\text{mm}, \\qquad 1\\ \\text{MPa} = 1\\ \\text{N/mm}^2",
      },
    ],
    codeRefs: ["src/types/branded-units.ts"],
  },
];
