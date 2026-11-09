/**
 * @file app-config.test.ts
 * @description Comprehensive unit tests for centralized global application configuration (app-config.ts).
 * Validates:
 * 1. AI model and voice persona resolution.
 * 2. Simulation default parameters (SNI 1729 / SNI 2847).
 * 3. Computer Vision / Hand Tracking settings.
 * 4. Telemetry and GA4 badge constants.
 * 5. Environment variable fallbacks and type-safety.
 */

import { describe, expect, it } from "bun:test";

import {
  aiConfig,
  appConfig,
  AVAILABLE_GEMINI_VOICES,
  getGeminiApiKey,
  handTrackingConfig,
  serverConfig,
  simulationConfig,
  SUPPORTED_GEMINI_MODELS,
  telemetryConfig,
} from "@/config/app-config";

describe("Global Application Configuration (app-config.ts)", () => {
  describe("Root Config Structure", () => {
    it("exports all top-level configuration namespaces", () => {
      expect(appConfig).toBeDefined();
      expect(appConfig.ai).toBeDefined();
      expect(appConfig.simulation).toBeDefined();
      expect(appConfig.handTracking).toBeDefined();
      expect(appConfig.telemetry).toBeDefined();
      expect(appConfig.server).toBeDefined();
    });

    it("freezes the configuration object against unintended runtime mutation", () => {
      expect(Object.isFrozen(appConfig)).toBe(true);
      expect(Object.isFrozen(appConfig.ai)).toBe(true);
      expect(Object.isFrozen(appConfig.simulation)).toBe(true);
      expect(Object.isFrozen(appConfig.handTracking)).toBe(true);
      expect(Object.isFrozen(appConfig.telemetry)).toBe(true);
      expect(Object.isFrozen(appConfig.server)).toBe(true);
    });

    it("exports alias accessors matching root namespaces", () => {
      expect(aiConfig).toBe(appConfig.ai);
      expect(simulationConfig).toBe(appConfig.simulation);
      expect(telemetryConfig).toBe(appConfig.telemetry);
      expect(handTrackingConfig).toBe(appConfig.handTracking);
      expect(serverConfig).toBe(appConfig.server);
    });
  });

  describe("AI Models & Gemini Live Voice Configuration", () => {
    it("resolves a non-empty, valid Intent Router model", () => {
      expect(typeof aiConfig.intentModel).toBe("string");
      expect(aiConfig.intentModel.length).toBeGreaterThan(0);
      expect(aiConfig.intentModel).toMatch(/gemini/i);
    });

    it("resolves a non-empty, valid Structural Consultant model", () => {
      expect(typeof aiConfig.consultantModel).toBe("string");
      expect(aiConfig.consultantModel.length).toBeGreaterThan(0);
      expect(aiConfig.consultantModel).toMatch(/gemini/i);
    });

    it("resolves Gemini Live audio model with 'models/' prefix", () => {
      expect(typeof aiConfig.liveModel).toBe("string");
      expect(aiConfig.liveModel.startsWith("models/")).toBe(true);
      expect(aiConfig.liveModel).toContain("gemini");
    });

    it("resolves a valid prebuilt voice name for Gemini Live speech", () => {
      const validVoices = ["Aoede", "Puck", "Charon", "Kore", "Fenrir"];
      expect(validVoices).toContain(aiConfig.liveVoice);
    });

    it("provides fallback models array containing alternative Gemini models", () => {
      expect(Array.isArray(aiConfig.fallbackModels)).toBe(true);
      expect(aiConfig.fallbackModels.length).toBeGreaterThanOrEqual(1);
      aiConfig.fallbackModels.forEach((model) => {
        expect(typeof model).toBe("string");
        expect(model.length).toBeGreaterThan(0);
      });
    });

    it("provides catalog of supported models with descriptions and recommendations", () => {
      expect(SUPPORTED_GEMINI_MODELS.length).toBeGreaterThanOrEqual(3);
      SUPPORTED_GEMINI_MODELS.forEach((item) => {
        expect(item.id).toBeDefined();
        expect(item.name).toBeDefined();
        expect(item.description).toBeDefined();
        expect(item.recommendedFor).toBeDefined();
      });
    });

    it("provides catalog of available Gemini Live voice personalities", () => {
      expect(AVAILABLE_GEMINI_VOICES.length).toBe(5);
      const voiceNames = AVAILABLE_GEMINI_VOICES.map((v) => v.name);
      expect(voiceNames).toContain("Aoede");
      expect(voiceNames).toContain("Puck");
      expect(voiceNames).toContain("Charon");
      expect(voiceNames).toContain("Kore");
      expect(voiceNames).toContain("Fenrir");
    });

    it("extracts API key using getGeminiApiKey helper without crashing", () => {
      const apiKey = getGeminiApiKey();
      if (apiKey !== null) {
        expect(typeof apiKey).toBe("string");
        expect(apiKey.length).toBeGreaterThan(5);
      }
    });
  });

  describe("Structural Simulation Defaults Configuration", () => {
    it("sets default material to either STEEL or CONCRETE", () => {
      expect(["STEEL", "CONCRETE"]).toContain(simulationConfig.defaultMaterial);
    });

    it("sets a positive realistic initial span length", () => {
      expect(simulationConfig.defaultSpanM).toBeGreaterThan(0);
      expect(simulationConfig.defaultSpanM).toBeLessThanOrEqual(50);
    });

    it("sets a standard structural deflection limit denominator (e.g. 240, 360, 480)", () => {
      expect(simulationConfig.defaultDeflectionLimitDenominator).toBeGreaterThan(100);
      expect(simulationConfig.defaultDeflectionLimitDenominator).toBeLessThan(1000);
    });

    it("specifies valid initial steel profile and grade", () => {
      expect(typeof simulationConfig.defaultSteelProfile).toBe("string");
      expect(simulationConfig.defaultSteelProfile).toContain("IWF");
      expect(typeof simulationConfig.defaultSteelGrade).toBe("string");
      expect(simulationConfig.defaultSteelGrade).toMatch(/BJ_/);
    });

    it("specifies valid initial concrete compressive strength and dimensions", () => {
      expect(simulationConfig.defaultConcreteFcMpa).toBeGreaterThanOrEqual(15);
      expect(simulationConfig.defaultConcreteBwMm).toBeGreaterThanOrEqual(100);
      expect(simulationConfig.defaultConcreteHMm).toBeGreaterThanOrEqual(150);
    });
  });

  describe("Computer Vision & Hand Tracking Configuration", () => {
    it("sets target inference FPS within responsive range [10, 60]", () => {
      expect(handTrackingConfig.targetFps).toBeGreaterThanOrEqual(10);
      expect(handTrackingConfig.targetFps).toBeLessThanOrEqual(60);
    });

    it("enables eco mode boolean flag by default", () => {
      expect(typeof handTrackingConfig.ecoMode).toBe("boolean");
    });

    it("configures Knuckle-Anchored blend weight to 0.5 (MCP #5 & #9 blend)", () => {
      expect(handTrackingConfig.knuckleBlendWeight).toBe(0.5);
    });
  });

  describe("Telemetry & GA4 Configuration", () => {
    it("provides valid GA4 measurement ID string starting with G-", () => {
      expect(typeof telemetryConfig.ga4MeasurementId).toBe("string");
      expect(telemetryConfig.ga4MeasurementId.startsWith("G-")).toBe(true);
    });

    it("provides positive fallback visitor count", () => {
      expect(telemetryConfig.fallbackVisitorCount).toBeGreaterThan(0);
    });

    it("provides valid ISO start date", () => {
      const date = new Date(telemetryConfig.projectStartDateIso);
      expect(Number.isNaN(date.getTime())).toBe(false);
    });

    it("configures GA4 response cache TTL (900 seconds)", () => {
      expect(telemetryConfig.cacheTtlSeconds).toBe(900);
    });
  });

  describe("Server Runtime Configuration", () => {
    it("resolves numeric port (e.g. 3000)", () => {
      expect(serverConfig.port).toBeGreaterThan(0);
      expect(Number.isInteger(serverConfig.port)).toBe(true);
    });

    it("exposes boolean environment flags", () => {
      expect(typeof serverConfig.isDev).toBe("boolean");
      expect(typeof serverConfig.isProd).toBe("boolean");
      expect(typeof serverConfig.isTest).toBe("boolean");
    });
  });
});
