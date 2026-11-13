/**
 * @file analytics-and-api.test.ts
 * @description Comprehensive unit and integration test suite for:
 * - Google Analytics 4 (GA4) custom epoch visitor flex counter and formatting.
 * - RS256 Web Crypto token utilities and credential validation.
 * - Natural language AI Intent Router rule-based matching and parameter extraction.
 * - Structural Engineering AI Consultant SNI 2847/1729 advisory logic.
 * - Official Structural Calculation Sheet HTML report generator.
 * - PWA Web App Manifest metadata generator.
 */

import { describe, expect, it } from "bun:test";

import {
  matchRuleBasedIntent,
  POST as intentRouterPostHandler,
} from "@/app/api/ai/intent-router/route";
import {
  generateDeterministicConsultantAdvice,
  POST as consultantPostHandler,
} from "@/app/api/ai/structural-consultant/route";
import {
  base64UrlEncode,
  GET as visitorsGetHandler,
  pemToDer,
} from "@/app/api/analytics/visitors/route";
import {
  generateCalculationSheetHtml,
  GET as calculationSheetGetHandler,
  POST as calculationSheetPostHandler,
} from "@/app/api/report/calculation-sheet/route";
import manifest from "@/app/manifest";
import { isValidGa4MeasurementId } from "@/components/telemetry/GoogleAnalyticsScriptLoader";
import {
  DEFAULT_FALLBACK_VISITOR_COUNT,
  formatVisitorBadge,
  getValidatedGa4Credentials,
  HARDCODED_START_DATE,
} from "@/config/analytics-config";
import { AnalyticsTelemetryError } from "@/types/analytics-telemetry-types";

// ============================================================================
// 1. GA4 Configuration & Badge Formatting Tests
// ============================================================================

describe("Step 7: Analytics & Telemetry Engine Tests", () => {
  describe("Visitor Badge Formatting Utilities", () => {
    it("formats standard visitor count with default launch epoch", () => {
      const badge = formatVisitorBadge(1420, "2026-11-01T00:00:00.000Z");
      expect(badge).toBe("Visited 1,420 times since 01 Nov 2026");
    });

    it("formats zero visitor count correctly", () => {
      const badge = formatVisitorBadge(0, "2026-11-01T00:00:00.000Z");
      expect(badge).toBe("Visited 0 times since 01 Nov 2026");
    });

    it("formats large numbers with proper comma grouping", () => {
      const badge = formatVisitorBadge(1250890, "2026-11-01T00:00:00.000Z");
      expect(badge).toBe("Visited 1,250,890 times since 01 Nov 2026");
    });

    it("throws AnalyticsTelemetryError on negative or non-finite counts", () => {
      expect(() => formatVisitorBadge(-5)).toThrow(AnalyticsTelemetryError);
      expect(() => formatVisitorBadge(NaN)).toThrow(AnalyticsTelemetryError);
      expect(() => formatVisitorBadge(Infinity)).toThrow(AnalyticsTelemetryError);
    });

    it("throws AnalyticsTelemetryError on invalid date strings", () => {
      expect(() => formatVisitorBadge(100, "invalid-date")).toThrow(AnalyticsTelemetryError);
    });
  });

  describe("GA4 Service Account Credential Validator", () => {
    it("validates and parses correct credentials", () => {
      const mockEnv = {
        GA4_SERVICE_ACCOUNT_EMAIL: "test@project.iam.gserviceaccount.com",
        GA4_PRIVATE_KEY:
          "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQD\n-----END PRIVATE KEY-----",
        GA4_PROPERTY_ID: "987654321",
      };

      const creds = getValidatedGa4Credentials(mockEnv);
      expect(creds.clientEmail).toBe("test@project.iam.gserviceaccount.com");
      expect(creds.propertyId).toBe("987654321");
      expect(creds.privateKey).toContain("-----BEGIN PRIVATE KEY-----");
    });

    it("throws AnalyticsTelemetryError when email is missing", () => {
      expect(() =>
        getValidatedGa4Credentials({
          GA4_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----",
          GA4_PROPERTY_ID: "123",
        }),
      ).toThrow(AnalyticsTelemetryError);
    });

    it("throws AnalyticsTelemetryError when private key is missing or non-PEM", () => {
      expect(() =>
        getValidatedGa4Credentials({
          GA4_SERVICE_ACCOUNT_EMAIL: "a@b.com",
          GA4_PROPERTY_ID: "123",
        }),
      ).toThrow(AnalyticsTelemetryError);

      expect(() =>
        getValidatedGa4Credentials({
          GA4_SERVICE_ACCOUNT_EMAIL: "a@b.com",
          GA4_PRIVATE_KEY: "invalid-key-without-header",
          GA4_PROPERTY_ID: "123",
        }),
      ).toThrow(AnalyticsTelemetryError);
    });

    it("throws AnalyticsTelemetryError when property ID is missing", () => {
      expect(() =>
        getValidatedGa4Credentials({
          GA4_SERVICE_ACCOUNT_EMAIL: "a@b.com",
          GA4_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----",
        }),
      ).toThrow(AnalyticsTelemetryError);
    });
  });

  describe("Web Crypto RS256 Zero-Dependency Helpers", () => {
    it("encodes string to RFC 7515 base64url without plus, slash, or padding", () => {
      const encoded = base64UrlEncode('{"alg":"RS256","typ":"JWT"}');
      expect(encoded).not.toContain("+");
      expect(encoded).not.toContain("/");
      expect(encoded).not.toContain("=");
      expect(encoded).toBe("eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9");
    });

    it("encodes Uint8Array binary bytes to base64url", () => {
      const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      expect(base64UrlEncode(bytes)).toBe("SGVsbG8");
    });

    it("extracts DER binary buffer from PEM string", () => {
      const mockPem = "-----BEGIN PRIVATE KEY-----\nAQIDBAU=\n-----END PRIVATE KEY-----";
      const der = pemToDer(mockPem);
      expect(der).toBeInstanceOf(Uint8Array);
      expect(der.length).toBe(5);
    });
  });

  describe("GET /api/analytics/visitors Route Handler", () => {
    it("returns 200 with fallback visitor count in unconfigured environment", async () => {
      const keysToClear = [
        "GA4_SERVICE_ACCOUNT_EMAIL",
        "GA4_PRIVATE_KEY",
        "GA4_PROPERTY_ID",
        "NEXT_PUBLIC_GA4_FALLBACK_VISITORS",
      ];
      const savedBun: Record<string, string | undefined> = {};
      const savedProc: Record<string, string | undefined> = {};

      for (const k of keysToClear) {
        savedBun[k] = Bun.env[k];
        savedProc[k] = process.env[k];
        delete Bun.env[k];
        delete process.env[k];
      }

      try {
        const response = await visitorsGetHandler();
        expect(response.status).toBe(200);

        const json = (await response.json()) as {
          totalVisitors: number;
          startDate: string;
          formattedBadge: string;
          status: string;
        };

        expect(json.totalVisitors).toBe(DEFAULT_FALLBACK_VISITOR_COUNT);
        expect(json.startDate).toBe(HARDCODED_START_DATE);
        expect(json.formattedBadge).toBe(
          formatVisitorBadge(DEFAULT_FALLBACK_VISITOR_COUNT, HARDCODED_START_DATE),
        );
        expect(json.status).toBe("fallback");
      } finally {
        for (const k of keysToClear) {
          if (savedBun[k] !== undefined) Bun.env[k] = savedBun[k];
          if (savedProc[k] !== undefined) process.env[k] = savedProc[k];
        }
      }
    });

    it("returns real live visitor count from GA4 when configured", async () => {
      const keysToManage = ["GA4_SERVICE_ACCOUNT_EMAIL", "GA4_PRIVATE_KEY", "GA4_PROPERTY_ID"];
      const savedBun: Record<string, string | undefined> = {};
      const savedProc: Record<string, string | undefined> = {};
      const originalFetch = globalThis.fetch;

      for (const k of keysToManage) {
        savedBun[k] = Bun.env[k];
        savedProc[k] = process.env[k];
      }

      try {
        // Generate an ephemeral PKCS#8 RSA keypair so Web Crypto RS256 signing runs offline
        const keyPair = await crypto.subtle.generateKey(
          {
            name: "RSASSA-PKCS1-v1_5",
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256",
          },
          true,
          ["sign", "verify"],
        );
        const pkcs8Buffer = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
        const pkcs8Bytes = new Uint8Array(pkcs8Buffer);
        let binary = "";
        for (let i = 0; i < pkcs8Bytes.byteLength; i++) {
          binary += String.fromCharCode(pkcs8Bytes[i]!);
        }
        const pemKey = `-----BEGIN PRIVATE KEY-----\n${btoa(binary)}\n-----END PRIVATE KEY-----`;

        const testPropertyId = "987654321";
        Bun.env.GA4_SERVICE_ACCOUNT_EMAIL = "test-sa@example.iam.gserviceaccount.com";
        process.env.GA4_SERVICE_ACCOUNT_EMAIL = "test-sa@example.iam.gserviceaccount.com";
        Bun.env.GA4_PRIVATE_KEY = pemKey;
        process.env.GA4_PRIVATE_KEY = pemKey;
        Bun.env.GA4_PROPERTY_ID = testPropertyId;
        process.env.GA4_PROPERTY_ID = testPropertyId;

        globalThis.fetch = (async (input: string | URL | Request) => {
          const url = String(input);
          if (url.includes("oauth2.googleapis.com/token")) {
            return new Response(JSON.stringify({ access_token: "mock-ga4-token" }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }
          if (url.includes(`properties/${testPropertyId}:runReport`)) {
            return new Response(
              JSON.stringify({
                rows: [{ metricValues: [{ value: "1337" }] }],
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" },
              },
            );
          }
          return new Response("Not Found", { status: 404 });
        }) as typeof fetch;

        const response = await visitorsGetHandler();
        expect(response.status).toBe(200);

        const json = (await response.json()) as {
          totalVisitors: number;
          status: string;
        };
        expect(json.status).toBe("fresh");
        expect(json.totalVisitors).toBe(1337);
      } finally {
        globalThis.fetch = originalFetch;
        for (const k of keysToManage) {
          if (savedBun[k] !== undefined) {
            Bun.env[k] = savedBun[k];
          } else {
            delete Bun.env[k];
          }
          if (savedProc[k] !== undefined) {
            process.env[k] = savedProc[k];
          } else {
            delete process.env[k];
          }
        }
      }
    });
  });

  describe("Google Analytics Measurement ID Validator", () => {
    it("validates real GA4 measurement IDs", () => {
      expect(isValidGa4MeasurementId("G-ABCD1234EF")).toBe(true);
      expect(isValidGa4MeasurementId("G-9876543210")).toBe(true);
    });

    it("rejects dummy placeholders or empty strings", () => {
      expect(isValidGa4MeasurementId("")).toBe(false);
      expect(isValidGa4MeasurementId(undefined)).toBe(false);
      expect(isValidGa4MeasurementId("G-XXXXXXXXXX")).toBe(false);
      expect(isValidGa4MeasurementId("G-YOUR_MEASUREMENT_ID")).toBe(false);
      expect(isValidGa4MeasurementId("UA-12345-1")).toBe(false); // Legacy Universal Analytics
    });
  });
});

// ============================================================================
// 2. AI Intent Router Tests (Indonesian & English Spoken Commands)
// ============================================================================

describe("Step 7: AI Natural Language Intent Router Tests", () => {
  describe("Rule-Based Command Matching & Parameter Extractions", () => {
    it("routes material switching commands in Indonesian and English", () => {
      const r1 = matchRuleBasedIntent("ganti ke material beton bertulang");
      expect(r1?.commandId).toBe("SWITCH_MATERIAL_CONCRETE");
      expect(r1?.confidence).toBeGreaterThanOrEqual(0.9);

      const r2 = matchRuleBasedIntent("switch to steel");
      expect(r2?.commandId).toBe("SWITCH_MATERIAL_STEEL");
      expect(r2?.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it("routes steel profile filtering commands", () => {
      const r1 = matchRuleBasedIntent("filter profil iwf");
      expect(r1?.commandId).toBe("FILTER_STEEL_IWF");

      const r2 = matchRuleBasedIntent("gunakan profil hollow box");
      expect(r2?.commandId).toBe("FILTER_STEEL_BOX");

      const r3 = matchRuleBasedIntent("tampilkan semua profil baja");
      expect(r3?.commandId).toBe("FILTER_STEEL_ALL");
    });

    it("routes internal force diagram toggles", () => {
      const r1 = matchRuleBasedIntent("tampilkan diagram momen bmd");
      expect(r1?.commandId).toBe("TOGGLE_DIAGRAM_BMD");

      const r2 = matchRuleBasedIntent("aktifkan diagram geser sfd");
      expect(r2?.commandId).toBe("TOGGLE_DIAGRAM_SFD");

      const r3 = matchRuleBasedIntent("lihat diagram aksial nfd");
      expect(r3?.commandId).toBe("TOGGLE_DIAGRAM_NFD");

      const r4 = matchRuleBasedIntent("tampilkan momen torsi tfd");
      expect(r4?.commandId).toBe("TOGGLE_DIAGRAM_TFD");
    });

    it("routes support boundary condition changes", () => {
      const r1 = matchRuleBasedIntent("ubah peletakan ke tumpuan kantilever");
      expect(r1?.commandId).toBe("SET_SUPPORT_CANTILEVER");

      const r2 = matchRuleBasedIntent("set support pinned roller sederhana");
      expect(r2?.commandId).toBe("SET_SUPPORT_PINNED_ROLLER");

      const r3 = matchRuleBasedIntent("tumpuan jepit jepit");
      expect(r3?.commandId).toBe("SET_SUPPORT_FIXED_FIXED");
    });

    it("extracts span length parameter accurately", () => {
      const r1 = matchRuleBasedIntent("ubah panjang bentang balok menjadi 12 meter");
      expect(r1?.commandId).toBe("SET_SPAN_LENGTH");
      expect(r1?.extractedParameters.spanLengthM).toBe(12);

      const r2 = matchRuleBasedIntent("span 8.5 m");
      expect(r2?.commandId).toBe("SET_SPAN_LENGTH");
      expect(r2?.extractedParameters.spanLengthM).toBe(8.5);
    });

    it("extracts point load magnitude parameter accurately", () => {
      const r = matchRuleBasedIntent("tambah beban titik 75 kn");
      expect(r?.commandId).toBe("ADD_POINT_LOAD");
      expect(r?.extractedParameters.magnitudeKn).toBe(75);
    });

    it("extracts concrete strength fc parameter", () => {
      const r1 = matchRuleBasedIntent("mutu beton fc 35 mpa");
      expect(r1?.commandId).toBe("SET_CONCRETE_FC");
      expect(r1?.extractedParameters.fcMpa).toBe(35);

      const r2 = matchRuleBasedIntent("mutu beton k-300");
      expect(r2?.commandId).toBe("SET_CONCRETE_FC");
      expect(r2?.extractedParameters.historicalGrade).toBe("K-300");
    });

    it("extracts steel grade parameter", () => {
      const r1 = matchRuleBasedIntent("mutu baja bj 50");
      expect(r1?.commandId).toBe("SET_STEEL_GRADE");
      expect(r1?.extractedParameters.steelGrade).toBe("BJ_50");

      const r2 = matchRuleBasedIntent("gunakan baja bj 37");
      expect(r2?.commandId).toBe("SET_STEEL_GRADE");
      expect(r2?.extractedParameters.steelGrade).toBe("BJ_37");
    });

    it("routes multi-format exporter commands", () => {
      expect(matchRuleBasedIntent("ekspor gambar autocad dxf")?.commandId).toBe("EXPORT_DXF");
      expect(matchRuleBasedIntent("export model sap2000 s2k")?.commandId).toBe("EXPORT_SAP2000");
      expect(matchRuleBasedIntent("ekspor bim ifc revit")?.commandId).toBe("EXPORT_IFC");
      expect(matchRuleBasedIntent("ekspor ke idea statica")?.commandId).toBe("EXPORT_IDEA_STATICA");
      expect(matchRuleBasedIntent("export step 3d solidworks")?.commandId).toBe(
        "EXPORT_SOLIDWORKS_STEP",
      );
    });

    it("routes UI and window controls", () => {
      expect(matchRuleBasedIntent("buka preview kamera")?.commandId).toBe("TOGGLE_CAMERA_PREVIEW");
      expect(matchRuleBasedIntent("tanya asisten ai")?.commandId).toBe("TOGGLE_AI_ASSISTANT");
      expect(matchRuleBasedIntent("aktifkan eco mode")?.commandId).toBe("TOGGLE_ECO_MODE");
    });

    it("returns null for completely empty or whitespace transcripts", () => {
      expect(matchRuleBasedIntent("")).toBeNull();
      expect(matchRuleBasedIntent("   ")).toBeNull();
    });
  });

  describe("POST /api/ai/intent-router Route Handler", () => {
    it("returns 400 when transcript is missing or empty", async () => {
      const req = new Request("http://localhost:3000/api/ai/intent-router", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const res = await intentRouterPostHandler(req);
      expect(res.status).toBe(400);
    });

    it("classifies command and returns IntentRouterResult with 200", async () => {
      const req = new Request("http://localhost:3000/api/ai/intent-router", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: "ubah bentang 14 meter" }),
      });

      const res = await intentRouterPostHandler(req);
      expect(res.status).toBe(200);

      const json = (await res.json()) as {
        commandId: string;
        confidence: number;
        extractedParameters: { spanLengthM?: number };
      };

      expect(json.commandId).toBe("SET_SPAN_LENGTH");
      expect(json.confidence).toBeGreaterThan(0.9);
      expect(json.extractedParameters.spanLengthM).toBe(14);
    });
  });
});

// ============================================================================
// 3. Structural AI Consultant Tests (SNI 2847 & SNI 1729)
// ============================================================================

describe("Step 7: Structural Engineering AI Consultant Tests", () => {
  it("provides detailed IWF vs BOX comparison citing SNI 1729:2020", () => {
    const advice = generateDeterministicConsultantAdvice("Bandingkan profil IWF vs BOX", {
      spanLengthM: 8 as any,
      maxDeflectionMm: 14 as any,
      steelProfileName: "IWF 400x200x8x13",
    });

    expect(advice.reply).toContain("Perbandingan Profil Baja SNI 1729:2020");
    expect(advice.reply).toContain("Lateral-Torsional Buckling / LTB");
    expect(advice.reply).toContain("St. Venant");
    expect(advice.sources).toContain("SNI 1729:2020 Bab F (Desain Komponen Struktur untuk Lentur)");
  });

  it("evaluates stirrup and shear reinforcement citing SNI 2847:2019 Pasal 22.5", () => {
    const advice = generateDeterministicConsultantAdvice("Rekomendasi tulangan geser", {
      governingForces: { absoluteMaxVu: 95 } as any,
      concreteFcMpa: 30 as any,
    });

    expect(advice.reply).toContain("Penulangan Geser Balok (SNI 2847:2019");
    expect(advice.reply).toContain("Web Crushing Limit");
    expect(advice.reply).toContain("s_{\\max}");
  });

  it("evaluates beam deflection against L/360 limit", () => {
    const advicePass = generateDeterministicConsultantAdvice("Periksa batas lendutan L/360", {
      spanLengthM: 6 as any, // allowDefl = 6000 / 360 = 16.67 mm
      maxDeflectionMm: 10 as any, // 10 < 16.67 mm -> PASS
      deflectionLimitDenominator: 360,
    });

    expect(advicePass.codeCompliance.deflectionCompliant).toBe(true);
    expect(advicePass.reply).toContain("MEMENUHI SYARAT (PASS)");

    const adviceFail = generateDeterministicConsultantAdvice("Periksa batas lendutan L/360", {
      spanLengthM: 6 as any,
      maxDeflectionMm: 25 as any, // 25 > 16.67 mm -> FAIL
      deflectionLimitDenominator: 360,
    });

    expect(adviceFail.codeCompliance.deflectionCompliant).toBe(false);
    expect(adviceFail.reply).toContain("MELEBIHI BATAS IZIN (FAIL)");
  });

  it("POST /api/ai/structural-consultant returns structured response with 200", async () => {
    const req = new Request("http://localhost:3000/api/ai/structural-consultant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "Bandingkan IWF vs BOX",
        simulatorState: { spanLengthM: 6 },
      }),
    });

    const res = await consultantPostHandler(req);
    expect(res.status).toBe(200);

    const json = (await res.json()) as { reply: string; sources: string[] };
    expect(json.reply).toContain("IWF");
    expect(json.sources.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// 4. Official Structural Calculation Sheet Tests
// ============================================================================

describe("Step 7: Structural Calculation Sheet Generator Tests", () => {
  it("generates publication-grade HTML with project header, tables, and conclusion", () => {
    const html = generateCalculationSheetHtml({
      projectTitle: "Gedung Uji Coba Antigravity",
      beamMark: "B-201",
      materialKind: "STEEL",
      spanLengthM: 8.0,
      steelProfileName: "IWF 400x200x8x13",
      steelGrade: "BJ_37",
      governingMuKnm: 210,
      governingVuKn: 120,
      flexuralCapacityPhiMnKnm: 280,
      shearCapacityPhiVnKn: 160,
      maxDeflectionMm: 18.5,
      deflectionLimitDenominator: 360,
    });

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("LEMBAR PERHITUNGAN STRUKTUR BALOK");
    expect(html).toContain("Gedung Uji Coba Antigravity");
    expect(html).toContain("B-201");
    expect(html).toContain("IWF 400x200x8x13");
    expect(html).toContain("SNI 1729:2020");
    expect(html).toContain("Ultimate Limit State / ULS");
    expect(html).toContain("Serviceability Limit State / SLS");
    expect(html).toContain("@media print");
    expect(html).toContain("PENAMPANG DINYATAKAN AMAN");
  });

  it("flags OVERSTRESS when demand exceeds capacity", () => {
    const html = generateCalculationSheetHtml({
      governingMuKnm: 350,
      flexuralCapacityPhiMnKnm: 250, // DCR = 1.4 -> OVERSTRESS
    });

    expect(html).toContain("OVERSTRESS");
    expect(html).toContain("PENAMPANG OVERSTRESS");
  });

  it("handles GET /api/report/calculation-sheet with query parameters", async () => {
    const req = new Request(
      "http://localhost:3000/api/report/calculation-sheet?span=7.5&material=CONCRETE&mu=180",
    );
    const res = await calculationSheetGetHandler(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");

    const html = await res.text();
    expect(html).toContain("7.50");
    expect(html).toContain("SNI 2847:2019");
  });

  it("handles POST /api/report/calculation-sheet with structured simulation state", async () => {
    const req = new Request("http://localhost:3000/api/report/calculation-sheet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        simulatorState: {
          materialKind: "STEEL",
          spanLengthM: 9.0,
          selectedSteelProfileName: "IWF 450x200x9x14",
          governingForces: {
            absoluteMaxMu: 240,
            absoluteMaxVu: 110,
          },
        },
      }),
    });

    const res = await calculationSheetPostHandler(req);
    expect(res.status).toBe(200);

    const html = await res.text();
    expect(html).toContain("IWF 450x200x9x14");
    expect(html).toContain("9.00");
  });
});

// ============================================================================
// 5. PWA Web App Manifest Tests
// ============================================================================

describe("Step 7: PWA Web App Manifest Generator Tests", () => {
  it("generates valid W3C Web App Manifest metadata", () => {
    const pwaManifest = manifest();

    expect(pwaManifest.name).toBe("IBDS - Interactive Beam Simulator");
    expect(pwaManifest.short_name).toBe("IBDS");
    expect(pwaManifest.display).toBe("standalone");
    expect(pwaManifest.theme_color).toBe("#0A0A0A");
    expect(pwaManifest.background_color).toBe("#0A0A0A");
    expect(pwaManifest.icons).toBeDefined();
    expect(pwaManifest.icons?.length).toBeGreaterThanOrEqual(2);

    const icon192 = pwaManifest.icons?.find((i) => i.sizes === "192x192");
    expect(icon192?.src).toBe("/icons/icon-192x192.png");

    const icon512 = pwaManifest.icons?.find((i) => i.sizes === "512x512");
    expect(icon512?.src).toBe("/icons/icon-512x512.png");
  });
});
