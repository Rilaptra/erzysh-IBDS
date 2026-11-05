# Changelog

## [0.5.1] - 2026-11-05

### 🛠️ Maintenance

- Manual patch release v0.5.1.

## [0.5.0] - 2026-11-04

### ✨ Added

- **CI/CD**: Implemented automated CI Quality Gate (`.github/workflows/ci-quality-gate.yml`) for formatting, TypeScript, data validation, and unit tests.
- **CI/CD**: Added automated Web Release pipeline (`.github/workflows/release.yml`) for GitHub Releases.
- **DevOps**: Introduced a comprehensive automated release pipeline (`bun commit` / `scripts/release.ts`) with AI-driven versioning, changelog generation, and conventional commit message creation.
- **DevOps**: Added `bun lint` (`scripts/verify.ts`) for code verification and `bun sync-version` (`scripts/sync-version.ts`) for version synchronization.
- **Tooling**: Integrated `@rilaptra/tui` for enhanced CLI user interface and `ZyLog` for structured logging in development scripts.

## [0.4.0] - 2026-11-05

### ✨ Added

- **Step 1 Scaffolding & Static Type Contracts**: Added `branded-units.ts`, `beam-loading-modes.ts` (5 support categories, 8 orientations, Mode A & Mode B), `concrete-sni2847-types.ts`, `steel-sni1729-types.ts`, `hand-gesture-cursor-types.ts`, `command-registry-types.ts`, and `analytics-telemetry-types.ts`.
- **Step 2 Primary Catalogs & Bun Compile-Time Macros**: Added 90 JIS G 3192 / SNI 07-2054 IWF profiles (`steel-iwf-catalog.json`), 23 JIS G 3466 BOX profiles (`steel-box-catalog.json`), BJ 34–55 grades, and BJTP/BJTS rebar catalogs.
- **Exact Steel Section Geometry Engine**: Implemented `computeIwfSectionProperties` (with 4 corner fillet constants $a_f, c, I_{f0}$) and `computeBoxSectionProperties` in `src/core/steel/iwf-geometric-properties.ts`, validated against WF 100x100x17.2 reference tables.
- **DevOps & Automated Release Pipeline**: Added `bun commit` (`scripts/release.ts`), `bun lint` (`scripts/verify.ts`), `scripts/sync-version.ts`, and `ZyLog` (`@rilaptra/tui`).
