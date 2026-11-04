/**
 * @file command-registry-types.ts
 * @description Schema and registry contract for discrete voice commands and
 * AI Intent Router function calling.
 */

// ============================================================================
// Command Identifiers & Categories
// ============================================================================

/**
 * Functional category groupings for registry commands.
 */
export type CommandCategory =
  | "MATERIAL"
  | "STEEL_FILTER"
  | "DIAGRAM"
  | "DIAGRAM_MODE"
  | "SUPPORT"
  | "LOADING_MODE"
  | "ACTION"
  | "EXPORT"
  | "UI_WINDOW"
  | "PARAMETER";

/**
 * Strict union of all executable command identifiers.
 */
export type CommandId =
  // Material Selection
  | "SWITCH_MATERIAL_CONCRETE"
  | "SWITCH_MATERIAL_STEEL"

  // Steel Profile Type Filtering
  | "FILTER_STEEL_IWF"
  | "FILTER_STEEL_BOX"
  | "FILTER_STEEL_ALL"

  // Internal Force Diagram Toggles
  | "TOGGLE_DIAGRAM_SFD"
  | "TOGGLE_DIAGRAM_BMD"
  | "TOGGLE_DIAGRAM_NFD"
  | "TOGGLE_DIAGRAM_TFD"

  // Diagram Display Layout Modes
  | "SET_DIAGRAM_MODE_IN_PLACE"
  | "SET_DIAGRAM_MODE_STACKED"
  | "SET_DIAGRAM_MODE_WINDOW"

  // Support Category Configuration
  | "SET_SUPPORT_CANTILEVER"
  | "SET_SUPPORT_PINNED_ROLLER"
  | "SET_SUPPORT_FIXED_FIXED"
  | "SET_SUPPORT_FIXED_ROLLER"
  | "SET_SUPPORT_FIXED_PINNED"

  // Loading Mode Paradigms
  | "SWITCH_MODE_EXTERNAL_LOADS"
  | "SWITCH_MODE_DIRECT_FORCES"

  // Numerical Parameter Adjustments
  | "SET_SPAN_LENGTH"
  | "ADD_POINT_LOAD"
  | "SET_CONCRETE_FC"
  | "SET_STEEL_GRADE"

  // Simulation Actions
  | "RUN_OPTIMIZATION"
  | "RESET_SIMULATION"

  // File Exporters
  | "EXPORT_DXF"
  | "EXPORT_SAP2000"
  | "EXPORT_IFC"
  | "EXPORT_IDEA_STATICA"
  | "EXPORT_SOLIDWORKS_STEP"

  // UI & Windows
  | "TOGGLE_CAMERA_PREVIEW"
  | "TOGGLE_AI_ASSISTANT"
  | "TOGGLE_ECO_MODE"
  | "TOGGLE_EXPORT_MODAL";

// ============================================================================
// Command Definition Contracts
// ============================================================================

/**
 * Metadata definition of an executable command in the registry.
 */
export interface CommandDefinition {
  /** Unique command identifier. */
  readonly id: CommandId;
  /** Functional category grouping. */
  readonly category: CommandCategory;
  /** Human-readable title in Indonesian. */
  readonly label: string;
  /** Technical description of the resulting state mutation. */
  readonly description: string;
  /** Trigger keywords in Indonesian (id-ID) for Web Speech API regex matching. */
  readonly keywordsId: readonly string[];
  /** Trigger keywords in English (en-US). */
  readonly keywordsEn: readonly string[];
  /** Parameter signature schema if the command accepts arguments. */
  readonly parametersSchema?: Record<string, unknown>;
}

/**
 * Result payload returned after command dispatch.
 */
export interface CommandExecutionResult {
  /** Whether the command was found and executed without errors. */
  readonly success: boolean;
  /** Identifier of the attempted command. */
  readonly commandId: CommandId;
  /** Diagnostic status or confirmation message. */
  readonly message: string;
  /** High-resolution timestamp of completion in milliseconds. */
  readonly timestamp: number;
  /** Optional mutated state or calculation output payload. */
  readonly payload?: unknown;
}

/**
 * Intent router classification payload from LLM or Web Speech STT.
 */
export interface IntentRouterResult {
  /** Classified command ID. */
  readonly commandId: CommandId;
  /** Confidence score in range [0.0, 1.0]. */
  readonly confidence: number;
  /** Parsed arguments extracted from natural language input. */
  readonly extractedParameters: Record<string, unknown>;
  /** Original raw user transcript. */
  readonly rawTranscript: string;
}

// ============================================================================
// Custom Error Hierarchy
// ============================================================================

/**
 * Custom error thrown when command dispatch, lookup, or argument validation fails.
 */
export class CommandRegistryError extends Error {
  public readonly commandId?: CommandId;

  constructor(message: string, commandId?: CommandId) {
    super(`[CommandRegistryError]${commandId ? ` Command '${commandId}':` : ""} ${message}`);
    this.name = "CommandRegistryError";
    this.commandId = commandId;
  }
}
