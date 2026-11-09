# Changelog

## [0.6.3] - 2026-11-09

### ✨ Added

- 🎙️ Multi-command natural language parsing and compound intent execution in Gemini intent router.
- 💡 Context-aware dynamic suggestion generator providing 3-4 smart follow-up action buttons.
- ⚙️ Comprehensive `.env.example` documentation covering Gemini Live voice personas, SNI parameters, and MediaPipe hand tracking FPS.

## [0.6.2] - 2026-11-08

### ✨ Added

- 📖 Comprehensive User Manual (`USER_MANUAL.md`) covering complete step-by-step operation from SNI 2847:2019 concrete and SNI 1729:2020 steel design to multimodal AI voice and hand gesture controls.

### 🛠️ Maintenance

- 🔗 Updated live deployment URLs and release badges in `README.md` to point to `erzysh-ibds.vercel.app`.

## [0.6.1] - 2026-11-08

### 🛠️ Maintenance

- Update Next.js development type reference paths in next-env.ts
- Refresh build timestamp and version metadata

## [0.6.0] - 2026-11-08

### ✨ Added

- 🎨 Migrate global stylesheet to Tailwind CSS v4 `@theme` tokens and Erzysh Dark Void theme
- ⚡ Integrate shadcn UI primitives (`Card`, `Tabs`, `Button`, `Badge`, `ScrollArea`, `Empty`) across mobile & desktop workstation views

### 🛠️ Maintenance

- 🧹 Clean up component styles in `AndroidCompanionView`, `DesktopWorkstationView`, and `StructuralAiAssistantPanel` using utility classes

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
