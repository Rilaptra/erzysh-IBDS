/**
 * @file concrete-grade-converter.ts
 * @description Material grade converter and constitutive property calculator
 * for concrete and steel reinforcement per Indonesian National Standard SNI 2847:2019.
 * Handles cylinder fc' and historical cube K-xxx conversions, modulus of elasticity (Ec),
 * Whitney stress block factor (beta1), and rebar yield parameters.
 */

import { megapascal } from "@/types/branded-units";
import type { Megapascal } from "@/types/branded-units";
import { ConcreteDesignError } from "@/types/concrete-sni2847-types";
import type {
  ConcreteCubeGrade,
  ConcreteCylinderGrade,
  RebarGradeProperties,
  RebarNominalBar,
  RebarSteelGrade,
} from "@/types/concrete-sni2847-types";

// ============================================================================
// Standard Material Catalogs & Conversion Constants
// ============================================================================

/** Modulus of elasticity of reinforcing steel Es in MPa per SNI 2847:2019 Pasal 20.2.2.2. */
export const REBAR_ELASTIC_MODULUS_ES_MPA = 200_000 as const;

/** Concrete ultimate compressive strain epsilon_cu per SNI 2847:2019 Pasal 22.2.2.1. */
export const CONCRETE_EPSILON_CU = 0.003 as const;

/** Minimum concrete compressive strength for structural applications per SNI 2847:2019 Pasal 19.2.1.1. */
export const MIN_STRUCTURAL_FC_MPA = 17.0 as const;

/** Standard cylinder compressive strength mapping (in MPa). */
export const STANDARD_CYLINDER_GRADES: Record<ConcreteCylinderGrade, number> = {
  FC_20: 20.0,
  FC_25: 25.0,
  FC_30: 30.0,
  FC_35: 35.0,
  FC_40: 40.0,
  FC_45: 45.0,
  FC_50: 50.0,
};

/** Historical Indonesian cube grade mapping (K-xxx in kg/cm²). */
export const STANDARD_CUBE_GRADES: Record<ConcreteCubeGrade, number> = {
  K_175: 175.0,
  K_200: 200.0,
  K_225: 225.0,
  K_250: 250.0,
  K_300: 300.0,
  K_350: 350.0,
  K_400: 400.0,
  K_500: 500.0,
};

/** Reinforcing steel grade mechanical properties per SNI 2052:2017 & SNI 2847:2019. */
export const REBAR_GRADES_CATALOG: Record<RebarSteelGrade, RebarGradeProperties> = {
  BJTP_24: {
    grade: "BJTP_24",
    fy: megapascal(240),
    fu: megapascal(390),
    type: "PLAIN",
  },
  BJTP_30: {
    grade: "BJTP_30",
    fy: megapascal(300),
    fu: megapascal(450),
    type: "PLAIN",
  },
  BJTS_40: {
    grade: "BJTS_40",
    fy: megapascal(400),
    fu: megapascal(570),
    type: "DEFORMED",
  },
  BJTS_50: {
    grade: "BJTS_50",
    fy: megapascal(500),
    fu: megapascal(650),
    type: "DEFORMED",
  },
  BJTS_60: {
    grade: "BJTS_60",
    fy: megapascal(600),
    fu: megapascal(750),
    type: "DEFORMED",
  },
};

/** Standard nominal bar diameters for longitudinal and transverse reinforcement. */
export const STANDARD_NOMINAL_BARS: readonly RebarNominalBar[] = [
  { diameter: 8 as any, area: 50.265 as any, unitWeightKgPerM: 0.395 },
  { diameter: 10 as any, area: 78.54 as any, unitWeightKgPerM: 0.617 },
  { diameter: 12 as any, area: 113.097 as any, unitWeightKgPerM: 0.888 },
  { diameter: 13 as any, area: 132.732 as any, unitWeightKgPerM: 1.042 },
  { diameter: 16 as any, area: 201.062 as any, unitWeightKgPerM: 1.578 },
  { diameter: 19 as any, area: 283.529 as any, unitWeightKgPerM: 2.226 },
  { diameter: 22 as any, area: 380.133 as any, unitWeightKgPerM: 2.984 },
  { diameter: 25 as any, area: 490.874 as any, unitWeightKgPerM: 3.853 },
  { diameter: 29 as any, area: 660.52 as any, unitWeightKgPerM: 5.185 },
  { diameter: 32 as any, area: 804.248 as any, unitWeightKgPerM: 6.313 },
];

// ============================================================================
// Core Conversion Functions
// ============================================================================

/**
 * Converts a historical Indonesian cube compressive strength K (kg/cm²) to equivalent cylinder fc' (MPa).
 * Follows the standard empirical relationship fc' = 0.083 * K.
 *
 * @param cubeGradeOrValue Cube grade key (e.g., "K_250") or numeric strength in kg/cm².
 * @returns Equivalent cylinder compressive strength fc' in MPa.
 * @throws {ConcreteDesignError} If K value is non-positive or non-finite.
 * @example
 * convertCubeToCylinderMpa("K_250"); // returns 20.75 MPa
 * convertCubeToCylinderMpa(300); // returns 24.9 MPa
 */
export function convertCubeToCylinderMpa(cubeGradeOrValue: ConcreteCubeGrade | number): Megapascal {
  let kValue: number;
  if (typeof cubeGradeOrValue === "string") {
    kValue = STANDARD_CUBE_GRADES[cubeGradeOrValue];
    if (kValue === undefined) {
      throw new ConcreteDesignError(
        "cubeGrade",
        cubeGradeOrValue,
        `Unrecognized concrete cube grade: '${cubeGradeOrValue}'.`,
      );
    }
  } else {
    kValue = cubeGradeOrValue;
  }

  if (!Number.isFinite(kValue) || kValue <= 0) {
    throw new ConcreteDesignError(
      "K (kg/cm2)",
      kValue,
      "Concrete cube strength must be a strictly positive finite number.",
    );
  }

  const fcMpa = Number((0.083 * kValue).toFixed(2));
  return megapascal(fcMpa);
}

/**
 * Resolves standard cylinder compressive strength from a grade key or numeric value.
 *
 * @param cylinderGradeOrValue Cylinder grade key (e.g., "FC_25") or numeric fc' in MPa.
 * @returns Cylinder compressive strength fc' in MPa.
 * @throws {ConcreteDesignError} If fc' is non-positive or below minimum structural threshold (17 MPa).
 * @example
 * resolveCylinderFcMpa("FC_30"); // returns 30 MPa
 */
export function resolveCylinderFcMpa(
  cylinderGradeOrValue: ConcreteCylinderGrade | number,
): Megapascal {
  let fcMpa: number;
  if (typeof cylinderGradeOrValue === "string") {
    fcMpa = STANDARD_CYLINDER_GRADES[cylinderGradeOrValue];
    if (fcMpa === undefined) {
      throw new ConcreteDesignError(
        "cylinderGrade",
        cylinderGradeOrValue,
        `Unrecognized concrete cylinder grade: '${cylinderGradeOrValue}'.`,
      );
    }
  } else {
    fcMpa = cylinderGradeOrValue;
  }

  if (!Number.isFinite(fcMpa) || fcMpa <= 0) {
    throw new ConcreteDesignError(
      "fc",
      fcMpa,
      "Concrete cylinder strength must be a strictly positive finite number.",
    );
  }

  if (fcMpa < MIN_STRUCTURAL_FC_MPA) {
    throw new ConcreteDesignError(
      "fc",
      fcMpa,
      `Concrete cylinder strength fc' (${fcMpa} MPa) is below the minimum structural threshold of 17 MPa per SNI 2847:2019 Pasal 19.2.1.1.`,
    );
  }

  return megapascal(fcMpa);
}

/**
 * Calculates the modulus of elasticity of normal-weight concrete Ec per SNI 2847:2019 Pasal 19.2.2.1.b.
 * Formula: Ec = 4700 * sqrt(fc') in MPa.
 *
 * @param fc Concrete cylinder compressive strength in MPa.
 * @returns Modulus of elasticity Ec in MPa.
 * @throws {ConcreteDesignError} If fc is <= 0 or non-finite.
 * @example
 * calculateConcreteModulusEc(megapascal(25)); // returns 23500 MPa
 */
export function calculateConcreteModulusEc(fc: Megapascal | number): Megapascal {
  if (!Number.isFinite(fc) || fc <= 0) {
    throw new ConcreteDesignError(
      "fc",
      fc,
      "Compressive strength must be strictly positive to calculate modulus of elasticity.",
    );
  }
  const ec = Math.round(4700 * Math.sqrt(fc));
  return megapascal(ec);
}

/**
 * Calculates Whitney equivalent rectangular stress block factor beta1 per SNI 2847:2019 Table 22.2.2.4.3.
 *
 * - For 17 <= fc' <= 28 MPa: beta1 = 0.85
 * - For 28 < fc' < 55 MPa: beta1 = 0.85 - 0.05 * (fc' - 28) / 7
 * - For fc' >= 55 MPa: beta1 = 0.65
 *
 * @param fc Concrete cylinder compressive strength in MPa.
 * @returns Dimensionless factor beta1 in range [0.65, 0.85].
 * @throws {ConcreteDesignError} If fc is <= 0 or non-finite.
 * @example
 * calculateWhitneyBeta1(megapascal(25)); // returns 0.85
 * calculateWhitneyBeta1(megapascal(35)); // returns 0.80
 */
export function calculateWhitneyBeta1(fc: Megapascal | number): number {
  if (!Number.isFinite(fc) || fc <= 0) {
    throw new ConcreteDesignError(
      "fc",
      fc,
      "Compressive strength must be strictly positive to compute beta1.",
    );
  }

  if (fc <= 28.0) {
    return 0.85;
  }
  if (fc >= 55.0) {
    return 0.65;
  }
  const beta1 = 0.85 - (0.05 * (fc - 28.0)) / 7.0;
  return Number(Math.max(0.65, Math.min(0.85, beta1)).toFixed(4));
}

/**
 * Retrieves the mechanical properties of a specified reinforcing steel grade.
 *
 * @param grade Rebar steel grade identifier.
 * @returns Full RebarGradeProperties object.
 * @throws {ConcreteDesignError} If grade is unrecognized.
 * @example
 * getRebarProperties("BJTS_40"); // returns { grade: "BJTS_40", fy: 400, fu: 570, type: "DEFORMED" }
 */
export function getRebarProperties(grade: RebarSteelGrade): RebarGradeProperties {
  const prop = REBAR_GRADES_CATALOG[grade];
  if (!prop) {
    throw new ConcreteDesignError(
      "rebarGrade",
      grade,
      `Unrecognized reinforcing steel grade: '${grade}'.`,
    );
  }
  return prop;
}

/**
 * Finds a standard nominal bar specification matching the requested diameter.
 *
 * @param diameterMm Nominal diameter in mm.
 * @returns RebarNominalBar metadata.
 * @throws {ConcreteDesignError} If diameter is not in standard catalog.
 * @example
 * getNominalBar(16); // returns { diameter: 16, area: 201.062, unitWeightKgPerM: 1.578 }
 */
export function getNominalBar(diameterMm: number): RebarNominalBar {
  const bar = STANDARD_NOMINAL_BARS.find((b) => Number(b.diameter) === diameterMm);
  if (!bar) {
    throw new ConcreteDesignError(
      "diameterMm",
      diameterMm,
      `Standard nominal bar with diameter ${diameterMm} mm not found in catalog. Available: ${STANDARD_NOMINAL_BARS.map((b) => b.diameter).join(", ")}.`,
    );
  }
  return bar;
}
