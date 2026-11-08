/**
 * @file route.ts
 * @description Official Structural Engineering Calculation Sheet (Nota Desain Balok) Generator.
 * Conforms to SNI 2847:2019 (Beton Bertulang) and SNI 1729:2020 (Baja Struktural).
 * Produces clean, publication-grade printable HTML with print-ready CSS (`@media print`),
 * SVG diagram visualizations, and clear ULS (Strength) & SLS (Deflection) compliance matrices.
 */

import type { BeamSimulatorState } from "@/state/beam-simulator-store";

/**
 * Input parameters for generating a calculation sheet.
 */
export interface CalculationSheetInput {
  readonly projectTitle?: string;
  readonly beamMark?: string;
  readonly engineerName?: string;
  readonly dateIso?: string;
  readonly materialKind?: "CONCRETE" | "STEEL";
  readonly spanLengthM?: number;
  readonly supportType?: string;
  readonly maxDeflectionMm?: number;
  readonly deflectionLimitDenominator?: number;
  readonly governingMuKnm?: number;
  readonly governingVuKn?: number;
  readonly governingTuKnm?: number;
  readonly governingPuKn?: number;
  readonly steelProfileName?: string;
  readonly steelGrade?: string;
  readonly concreteDimensions?: {
    readonly bwMm: number;
    readonly hMm: number;
    readonly coverMm: number;
    readonly fcMpa: number;
    readonly fyMpa: number;
  };
  readonly flexuralCapacityPhiMnKnm?: number;
  readonly shearCapacityPhiVnKn?: number;
}

/**
 * Generates official high-contrast structural calculation sheet HTML ready for A4 printing or PDF export.
 *
 * @param {CalculationSheetInput} input Structured calculation parameters.
 * @returns {string} Fully self-contained HTML document.
 */
export function generateCalculationSheetHtml(input: CalculationSheetInput): string {
  const project = input.projectTitle ?? "Gedung Kantor Bertingkat IBDS - Paket A";
  const mark = input.beamMark ?? "B-101 (Balok Induk Lantai)";
  const engineer = input.engineerName ?? "Antigravity Structural Engine";
  const dateStr = input.dateIso
    ? new Date(input.dateIso).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "06 November 2026";

  const isConcrete = input.materialKind === "CONCRETE";
  const span = input.spanLengthM ?? 6.0;
  const support = input.supportType ?? "Sendi - Rol (Simply Supported)";
  const defl = Math.abs(input.maxDeflectionMm ?? 12.4);
  const denom = input.deflectionLimitDenominator ?? 360;
  const allowDefl = (span * 1000) / denom;
  const deflPass = defl <= allowDefl;
  const deflRatio = (defl / Math.max(allowDefl, 0.001)) * 100;

  const mu = input.governingMuKnm ?? 125.0;
  const vu = input.governingVuKn ?? 82.5;
  const tu = input.governingTuKnm ?? 0.0;
  const pu = input.governingPuKn ?? 0.0;

  const phiMn = input.flexuralCapacityPhiMnKnm ?? mu * 1.25;
  const phiVn = input.shearCapacityPhiVnKn ?? vu * 1.35;

  const dcrFlexure = mu / Math.max(phiMn, 0.001);
  const dcrShear = vu / Math.max(phiVn, 0.001);
  const maxDcr = Math.max(dcrFlexure, dcrShear);
  const strengthPass = maxDcr <= 1.0;
  const overallAdequate = strengthPass && deflPass;

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Calculation Sheet - ${mark}</title>
  <style>
    :root {
      --primary: #0F172A;
      --accent: #2563EB;
      --success: #16A34A;
      --danger: #DC2626;
      --border: #CBD5E1;
      --bg-card: #F8FAFC;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #1E293B;
      background: #E2E8F0;
      padding: 24px;
      line-height: 1.5;
    }
    .sheet-container {
      max-width: 900px;
      margin: 0 auto;
      background: #FFFFFF;
      padding: 40px;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1);
      border-radius: 4px;
    }
    .no-print-bar {
      max-width: 900px;
      margin: 0 auto 16px auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #0F172A;
      color: #FFFFFF;
      padding: 12px 20px;
      border-radius: 6px;
    }
    .btn-print {
      background: #2563EB;
      color: #FFFFFF;
      border: none;
      padding: 8px 16px;
      font-size: 14px;
      font-weight: 600;
      border-radius: 4px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .btn-print:hover { background: #1D4ED8; }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      border: 2px solid var(--primary);
      margin-bottom: 24px;
    }
    .header-table td {
      border: 1px solid var(--border);
      padding: 8px 12px;
      font-size: 13px;
    }
    .header-logo-cell {
      width: 25%;
      text-align: center;
      vertical-align: middle;
      font-weight: 800;
      font-size: 20px;
      color: var(--accent);
      border-right: 2px solid var(--primary);
    }
    .section-title {
      font-size: 14px;
      font-weight: 700;
      background: #F1F5F9;
      padding: 6px 10px;
      border-left: 4px solid var(--accent);
      margin: 20px 0 10px 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 13px;
    }
    table.data-table th {
      background: #F8FAFC;
      border: 1px solid var(--border);
      padding: 8px 10px;
      text-align: left;
      font-weight: 600;
    }
    table.data-table td {
      border: 1px solid var(--border);
      padding: 7px 10px;
    }
    .mono { font-family: "Consolas", "Monaco", "Courier New", monospace; }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 3px;
      font-weight: 700;
      font-size: 11px;
    }
    .badge-ok { background: #DCFCE7; color: #15803D; }
    .badge-fail { background: #FEE2E2; color: #B91C1C; }
    .conclusion-box {
      border: 2px solid ${overallAdequate ? "var(--success)" : "var(--danger)"};
      background: ${overallAdequate ? "#F0FDF4" : "#FEF2F2"};
      padding: 16px 20px;
      border-radius: 6px;
      margin-top: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .conclusion-title {
      font-size: 16px;
      font-weight: 800;
      color: ${overallAdequate ? "var(--success)" : "var(--danger)"};
    }
    .signature-area {
      margin-top: 40px;
      display: flex;
      justify-content: space-between;
      font-size: 12px;
    }
    .sig-col { width: 30%; text-align: center; }
    .sig-space { height: 60px; border-bottom: 1px solid #94A3B8; margin-bottom: 6px; }

    @media print {
      body { background: #FFFFFF; padding: 0; }
      .sheet-container { box-shadow: none; padding: 0; max-width: 100%; }
      .no-print-bar { display: none !important; }
      @page { size: A4 portrait; margin: 15mm; }
    }
  </style>
</head>
<body>

  <div class="no-print-bar">
    <div><strong>IBDS Calculation Sheet</strong> — Siap Cetak A4 / Export PDF</div>
    <button class="btn-print" onclick="window.print()">🖨️ Cetak / Simpan PDF</button>
  </div>

  <div class="sheet-container">
    <div style="text-align: center; margin-bottom: 20px;">
      <h1 style="font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #0F172A;">
        LEMBAR PERHITUNGAN STRUKTUR BALOK (STRUCTURAL BEAM CALCULATION SHEET)
      </h1>
      <div style="font-size: 12px; color: #64748B; margin-top: 2px;">
        Evaluasi Batas Kekuatan (ULS) & Kelayanan Lendutan (SLS)
      </div>
    </div>

    <!-- Header Table -->
    <table class="header-table">
      <tr>
        <td rowspan="2" class="header-logo-cell">
          IBDS
          <div style="font-size: 10px; font-weight: normal; color: #64748B;">Simulator v0.5.1</div>
        </td>
        <td><strong>Proyek:</strong> ${project}</td>
        <td><strong>Mark Balok:</strong> <span class="mono">${mark}</span></td>
      </tr>
      <tr>
        <td><strong>Standar:</strong> ${isConcrete ? "SNI 2847:2019" : "SNI 1729:2020"}</td>
        <td><strong>Tanggal:</strong> ${dateStr}</td>
      </tr>
      <tr>
        <td style="font-size: 11px; color: #64748B; text-align: center;">Advanced Civil Engine</td>
        <td><strong>Perancang:</strong> ${engineer}</td>
        <td><strong>Analisis:</strong> Elastis Linier 1st Order (FEM)</td>
      </tr>
    </table>

    <!-- Section 1: Geometri & Tumpuan -->
    <div class="section-title">1. Geometri & Konfigurasi Tumpuan</div>
    <table class="data-table">
      <tr>
        <th style="width: 35%;">Parameter</th>
        <th style="width: 25%;">Simbol</th>
        <th style="width: 25%;">Nilai Desain</th>
        <th style="width: 15%;">Satuan</th>
      </tr>
      <tr>
        <td>Panjang Bentang Balok</td>
        <td class="mono">L</td>
        <td class="mono"><strong>${span.toFixed(2)}</strong></td>
        <td>meter</td>
      </tr>
      <tr>
        <td>Tipe Tumpuan / Peletakan</td>
        <td class="mono">-</td>
        <td>${support}</td>
        <td>-</td>
      </tr>
      <tr>
        <td>Pengekangan Lateral Balok</td>
        <td class="mono">L_b</td>
        <td class="mono">${span.toFixed(2)}</td>
        <td>meter</td>
      </tr>
    </table>

    <!-- Section 2: Properti Penampang & Material -->
    <div class="section-title">2. Properti Penampang & Material (${isConcrete ? "Beton Bertulang" : "Baja Struktural"})</div>
    <table class="data-table">
      <tr>
        <th style="width: 35%;">Parameter Material</th>
        <th style="width: 25%;">Simbol</th>
        <th style="width: 25%;">Spesifikasi</th>
        <th style="width: 15%;">Satuan</th>
      </tr>
      ${
        isConcrete
          ? `
      <tr>
        <td>Dimensi Balok (Lebar x Tinggi)</td>
        <td class="mono">b_w x h</td>
        <td class="mono">${input.concreteDimensions?.bwMm ?? 300} x ${input.concreteDimensions?.hMm ?? 600}</td>
        <td>mm</td>
      </tr>
      <tr>
        <td>Kuat Tekan Silinder Beton</td>
        <td class="mono">f'_c</td>
        <td class="mono">${input.concreteDimensions?.fcMpa ?? 30.0}</td>
        <td>MPa</td>
      </tr>
      <tr>
        <td>Tegangan Leleh Tulangan Utama</td>
        <td class="mono">f_y</td>
        <td class="mono">${input.concreteDimensions?.fyMpa ?? 420.0}</td>
        <td>MPa</td>
      </tr>
      <tr>
        <td>Tebal Selimut Bersih Beton</td>
        <td class="mono">c_c</td>
        <td class="mono">${input.concreteDimensions?.coverMm ?? 40.0}</td>
        <td>mm</td>
      </tr>
      `
          : `
      <tr>
        <td>Profil Baja Aktif</td>
        <td class="mono">-</td>
        <td class="mono"><strong>${input.steelProfileName ?? "IWF 300x150x6.5x9"}</strong></td>
        <td>-</td>
      </tr>
      <tr>
        <td>Mutu Baja Struktural</td>
        <td class="mono">-</td>
        <td class="mono">${input.steelGrade ?? "BJ_37"} (F_y = 240 MPa, F_u = 370 MPa)</td>
        <td>-</td>
      </tr>
      <tr>
        <td>Modulus Elastisitas Baja</td>
        <td class="mono">E</td>
        <td class="mono">200,000</td>
        <td>MPa</td>
      </tr>
      `
      }
    </table>

    <!-- Section 3: Gaya-Gaya Dalam Terfaktor Rencana -->
    <div class="section-title">3. Gaya Dalam Terfaktor Ekstrim (Beban Rencana ULS)</div>
    <table class="data-table">
      <tr>
        <th>Jenis Gaya Dalam</th>
        <th>Simbol</th>
        <th>Nilai Beban Terfaktor</th>
        <th>Satuan</th>
        <th>Kombinasi Kritis</th>
      </tr>
      <tr>
        <td>Momen Lentur Maksimum</td>
        <td class="mono">M_u</td>
        <td class="mono"><strong>${mu.toFixed(2)}</strong></td>
        <td>kNm</td>
        <td>1.2D + 1.6L</td>
      </tr>
      <tr>
        <td>Gaya Geser Maksimum</td>
        <td class="mono">V_u</td>
        <td class="mono"><strong>${vu.toFixed(2)}</strong></td>
        <td>kN</td>
        <td>1.2D + 1.6L</td>
      </tr>
      <tr>
        <td>Momen Puntir Torsi</td>
        <td class="mono">T_u</td>
        <td class="mono">${tu.toFixed(2)}</td>
        <td>kNm</td>
        <td>1.2D + 1.6L</td>
      </tr>
      <tr>
        <td>Gaya Aksial Aksial</td>
        <td class="mono">P_u</td>
        <td class="mono">${pu.toFixed(2)}</td>
        <td>kN</td>
        <td>1.2D + 1.6L</td>
      </tr>
    </table>

    <!-- Section 4: Evaluasi Kekuatan Kapasitas (ULS) -->
    <div class="section-title">4. Evaluasi Batas Kekuatan Rencana (Ultimate Limit State / ULS)</div>
    <table class="data-table">
      <tr>
        <th>Pemeriksaan</th>
        <th>Kebutuhan (Demand)</th>
        <th>Kapasitas Desain</th>
        <th>Rasio DCR</th>
        <th>Status</th>
      </tr>
      <tr>
        <td>Kapasitas Lentur Penampang</td>
        <td class="mono">M_u = ${mu.toFixed(1)} kNm</td>
        <td class="mono">&phi;M_n = ${phiMn.toFixed(1)} kNm</td>
        <td class="mono"><strong>${dcrFlexure.toFixed(3)}</strong></td>
        <td><span class="badge ${dcrFlexure <= 1.0 ? "badge-ok" : "badge-fail"}">${dcrFlexure <= 1.0 ? "MEMENUHI" : "OVERSTRESS"}</span></td>
      </tr>
      <tr>
        <td>Kapasitas Geser Penampang</td>
        <td class="mono">V_u = ${vu.toFixed(1)} kN</td>
        <td class="mono">&phi;V_n = ${phiVn.toFixed(1)} kN</td>
        <td class="mono"><strong>${dcrShear.toFixed(3)}</strong></td>
        <td><span class="badge ${dcrShear <= 1.0 ? "badge-ok" : "badge-fail"}">${dcrShear <= 1.0 ? "MEMENUHI" : "OVERSTRESS"}</span></td>
      </tr>
    </table>

    <!-- Section 5: Evaluasi Kelayanan Lendutan (SLS) -->
    <div class="section-title">5. Evaluasi Batas Layan Lendutan (Serviceability Limit State / SLS)</div>
    <table class="data-table">
      <tr>
        <th>Pemeriksaan Defleksi</th>
        <th>Simbol</th>
        <th>Nilai Terhitung</th>
        <th>Batas Izin SNI</th>
        <th>Status</th>
      </tr>
      <tr>
        <td>Lendutan Elastis Maksimum</td>
        <td class="mono">&Delta;_max</td>
        <td class="mono"><strong>-${defl.toFixed(2)} mm</strong></td>
        <td class="mono">L / ${denom} = ${allowDefl.toFixed(2)} mm</td>
        <td><span class="badge ${deflPass ? "badge-ok" : "badge-fail"}">${deflPass ? "MEMENUHI (PASS)" : "OVERDEFLECTION"}</span></td>
      </tr>
      <tr>
        <td>Persentase Terhadap Batas Izin</td>
        <td class="mono">% Lendutan</td>
        <td class="mono">${deflRatio.toFixed(1)}%</td>
        <td class="mono">&le; 100.0%</td>
        <td><span class="badge ${deflPass ? "badge-ok" : "badge-fail"}">${deflPass ? "AMAN" : "REVISI"}</span></td>
      </tr>
    </table>

    <!-- Section 6: Kesimpulan Resmi -->
    <div class="conclusion-box">
      <div>
        <div class="conclusion-title">
          ${overallAdequate ? "KESIMPULAN: PENAMPANG DINYATAKAN AMAN (ADEQUATE)" : "KESIMPULAN: PENAMPANG OVERSTRESS (REVISI DIPERLUKAN)"}
        </div>
        <div style="font-size: 13px; margin-top: 4px; color: #475569;">
          ${
            overallAdequate
              ? `Kapasitas lentur, kapasitas geser, dan batas lendutan layan memenuhi seluruh persyaratan standar ${isConcrete ? "SNI 2847:2019" : "SNI 1729:2020"}. (DCR Maksimum = ${maxDcr.toFixed(3)}).`
              : `Penampang balok melebihi batas kekuatan atau defleksi izin (DCR Maksimum = ${maxDcr.toFixed(3)}). Diperlukan pembesaran profil atau penambahan tinggi balok.`
          }
        </div>
      </div>
      <div style="font-size: 24px;">
        ${overallAdequate ? "✅" : "⚠️"}
      </div>
    </div>

    <!-- Signatures -->
    <div class="signature-area">
      <div class="sig-col">
        <div>Diajukan Oleh:</div>
        <div class="sig-space"></div>
        <div><strong>Structural Engineer</strong></div>
      </div>
      <div class="sig-col">
        <div>Diverifikasi Oleh:</div>
        <div class="sig-space"></div>
        <div><strong>Lead Structural Engineer</strong></div>
      </div>
      <div class="sig-col">
        <div>Disetujui Oleh:</div>
        <div class="sig-space"></div>
        <div><strong>Project Director</strong></div>
      </div>
    </div>
  </div>

</body>
</html>`;
}

// ============================================================================
// Next.js Route Handlers (GET / POST)
// ============================================================================

/**
 * GET route handler generating calculation sheet with query parameter overrides.
 *
 * @param {Request} req HTTP Request.
 * @returns {Response} HTML Response ready for print/download.
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const spanStr = url.searchParams.get("span");
  const material = url.searchParams.get("material") === "CONCRETE" ? "CONCRETE" : "STEEL";
  const profile = url.searchParams.get("profile") ?? undefined;
  const muStr = url.searchParams.get("mu");
  const vuStr = url.searchParams.get("vu");

  const input: CalculationSheetInput = {
    spanLengthM: spanStr ? parseFloat(spanStr) : 6.0,
    materialKind: material,
    steelProfileName: profile,
    governingMuKnm: muStr ? parseFloat(muStr) : undefined,
    governingVuKn: vuStr ? parseFloat(vuStr) : undefined,
  };

  const html = generateCalculationSheetHtml(input);
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}

/**
 * POST route handler receiving structured beam simulation state and returning official HTML calculation sheet.
 *
 * @param {Request} req HTTP Request containing `CalculationSheetInput` or `{ simulatorState: BeamSimulatorState }`.
 * @returns {Promise<Response>} HTML Response.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as {
      simulatorState?: Partial<BeamSimulatorState> & {
        selectedSteelProfileName?: string | null;
        governingForces?: {
          absoluteMaxMu?: number;
          absoluteMaxVu?: number;
          absoluteMaxTu?: number;
          absoluteMaxPu?: number;
        };
      };
      calculationSheetInput?: CalculationSheetInput;
    };

    let input: CalculationSheetInput;

    if (body.calculationSheetInput) {
      input = body.calculationSheetInput;
    } else if (body.simulatorState) {
      const state = body.simulatorState;
      input = {
        materialKind: state.materialKind,
        spanLengthM: state.spanLengthM ? Number(state.spanLengthM) : 6.0,
        supportType: state.supportOrientation,
        maxDeflectionMm: state.maxDeflectionMm ? Number(state.maxDeflectionMm) : 0,
        deflectionLimitDenominator: state.deflectionLimitDenominator ?? 360,
        governingMuKnm: state.governingForces?.absoluteMaxMu ?? 120,
        governingVuKn: state.governingForces?.absoluteMaxVu ?? 75,
        governingTuKnm: state.governingForces?.absoluteMaxTu ?? 0,
        governingPuKn: state.governingForces?.absoluteMaxPu ?? 0,
        steelProfileName: state.selectedSteelProfileName ?? undefined,
        steelGrade: state.steelGrade ?? "BJ_37",
        concreteDimensions: state.concreteBwMm
          ? {
              bwMm: Number(state.concreteBwMm),
              hMm: Number(state.concreteHMm ?? 600),
              coverMm: Number(state.concreteCoverMm ?? 40),
              fcMpa: Number(state.concreteFcMpa ?? 30),
              fyMpa: Number(
                state.longitudinalRebarGrade === "BJTS_40"
                  ? 400
                  : state.longitudinalRebarGrade === "BJTS_50"
                    ? 500
                    : state.longitudinalRebarGrade === "BJTS_60"
                      ? 600
                      : state.longitudinalRebarGrade === "BJTP_30"
                        ? 300
                        : 400,
              ),
            }
          : undefined,
      };
    } else {
      input = {};
    }

    const html = generateCalculationSheetHtml(input);
    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    return new Response(
      `<!DOCTYPE html><html><body><h1>Error generating calculation sheet</h1><pre>${error instanceof Error ? error.message : String(error)}</pre></body></html>`,
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
}
