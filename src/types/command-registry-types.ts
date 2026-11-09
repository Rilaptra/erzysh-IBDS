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
  | "VIEWPORT_CAMERA"
  | "PARAMETER";

/**
 * Strict union of all executable command identifiers covering every UI button and parameter.
 */
export type CommandId =
  // Material Selection
  | "SWITCH_MATERIAL_CONCRETE"
  | "SWITCH_MATERIAL_STEEL"

  // Steel Profile Type Filtering & Selection
  | "FILTER_STEEL_IWF"
  | "FILTER_STEEL_BOX"
  | "FILTER_STEEL_ALL"
  | "SELECT_STEEL_PROFILE"

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

  // Numerical Parameter Adjustments & Load Controls
  | "SET_SPAN_LENGTH"
  | "ADD_POINT_LOAD"
  | "REMOVE_POINT_LOAD"
  | "ADD_DISTRIBUTED_LOAD"
  | "REMOVE_DISTRIBUTED_LOAD"
  | "CLEAR_ALL_LOADS"
  | "TOGGLE_SELF_WEIGHT"
  | "SET_CONCRETE_FC"
  | "SET_CONCRETE_DIMENSIONS"
  | "SET_REBAR_GRADES"
  | "SET_STEEL_GRADE"
  | "SET_STEEL_UNBRACED_LENGTH"
  | "SET_DEFLECTION_LIMIT"
  | "SET_DIRECT_FORCES"

  // Simulation Actions
  | "RUN_OPTIMIZATION"
  | "RESET_SIMULATION"

  // 3D Viewport, Camera Views & Coordinate System
  | "SET_VIEW_ISOMETRIC"
  | "SET_VIEW_FRONT"
  | "FIT_CAMERA_VIEW"
  | "SET_CONCRETE_VIEW_SOLID"
  | "SET_CONCRETE_VIEW_WIREFRAME"
  | "SET_COORDINATE_Z_UP"
  | "SET_COORDINATE_Y_UP"

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
  | "TOGGLE_EXPORT_MODAL"
  | "OPEN_WINDOW"
  | "CLOSE_WINDOW"
  | "OPEN_ALL_WINDOWS"
  | "CLOSE_ALL_WINDOWS"
  | "RESET_WINDOWS_LAYOUT"
  | "MUTE_VOICE_COMMAND"
  | "UNMUTE_VOICE_COMMAND"

  // AI Consultation & Conversational Q&A
  | "AI_CONSULTATION";

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
 * Individual action item in a multi-command compound execution payload.
 */
export interface IntentActionItem {
  /** Unique command identifier. */
  readonly commandId: CommandId;
  /** Parameters specific to this command action. */
  readonly extractedParameters?: Record<string, unknown>;
  /** Optional human-readable action label or confirmation snippet. */
  readonly label?: string;
}

/**
 * Intent router classification payload from LLM or Web Speech STT.
 */
export interface IntentRouterResult {
  /** Classified command ID (or primary command if multiple actions). */
  readonly commandId: CommandId;
  /** Confidence score in range [0.0, 1.0]. */
  readonly confidence: number;
  /** Parsed arguments extracted from natural language input. */
  readonly extractedParameters: Record<string, unknown>;
  /** Original raw user transcript. */
  readonly rawTranscript: string;
  /** Fluid AI-generated next action suggestions based on context. */
  readonly suggestions?: readonly string[];
  /** Optional natural speech confirmation or technical guidance. */
  readonly spokenConfirmation?: string;
  /**
   * Optional ordered list of multiple discrete actions when the user utterance contains
   * compound instructions (e.g. "ganti ke beton dan munculkan jendela dimensi dan gaya dalam").
   */
  readonly actions?: readonly IntentActionItem[];
  /** Optional status or informational message. */
  readonly message?: string;
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

// ============================================================================
// Contextual Suggestion Utilities
// ============================================================================

/**
 * Returns 3-4 context-aware command suggestions based on the last executed command.
 */
export function generateContextualSuggestions(
  commandId: CommandId,
  _params: Record<string, unknown> = {},
): readonly string[] {
  switch (commandId) {
    case "SWITCH_MATERIAL_CONCRETE":
      return [
        "Lihat wireframe tulangan balok",
        "Atur mutu beton fc 35 MPa",
        "Tampilkan tampak depan 2D",
        "Tambahkan beban titik 60 kN",
      ];
    case "SWITCH_MATERIAL_STEEL":
      return [
        "Filter profil IWF baja",
        "Pilih profil IWF 300x150",
        "Optimalkan penampang profil",
        "Ekspor ke AutoCAD DXF",
      ];
    case "SET_VIEW_ISOMETRIC":
    case "SET_VIEW_FRONT":
    case "FIT_CAMERA_VIEW":
      return [
        "Tampilkan diagram momen BMD",
        "Lihat wireframe tulangan",
        "Beralih ke tampilan 3D isometrik",
        "Fit tampilan balok",
      ];
    case "SET_CONCRETE_VIEW_WIREFRAME":
    case "SET_CONCRETE_VIEW_SOLID":
      return [
        "Tampilkan solid potongan",
        "Tampak depan 2D",
        "Ubah mutu beton fc 30 MPa",
        "Ekspor model BIM IFC",
      ];
    case "ADD_POINT_LOAD":
    case "ADD_DISTRIBUTED_LOAD":
    case "CLEAR_ALL_LOADS":
    case "REMOVE_POINT_LOAD":
    case "REMOVE_DISTRIBUTED_LOAD":
      return [
        "Tampilkan bidang momen BMD",
        "Tampilkan gaya geser SFD",
        "Optimasi penampang profil",
        "Atur tumpuan ke Jepit-Rol",
      ];
    case "TOGGLE_DIAGRAM_BMD":
    case "TOGGLE_DIAGRAM_SFD":
    case "TOGGLE_DIAGRAM_NFD":
    case "TOGGLE_DIAGRAM_TFD":
      return [
        "Mode diagram vertikal stacked",
        "Mode diagram in-place sejajar balok",
        "Buka jendela optimasi",
        "Ekspor file SAP2000",
      ];
    case "SET_SPAN_LENGTH":
      return [
        "Tambah beban titik 50 kN",
        "Tambah beban merata 20 kN/m",
        "Hitung optimasi profil",
        "Tampilkan diagram geser SFD",
      ];
    case "EXPORT_DXF":
    case "EXPORT_SAP2000":
    case "EXPORT_IFC":
    case "EXPORT_IDEA_STATICA":
    case "EXPORT_SOLIDWORKS_STEP":
      return [
        "Buka modal ekspor CAD",
        "Ekspor model IDEA StatiCa",
        "Ekspor file 3D SolidWorks",
        "Kembali ke 3D isometrik",
      ];
    case "OPEN_WINDOW":
    case "CLOSE_WINDOW":
    case "OPEN_ALL_WINDOWS":
    case "CLOSE_ALL_WINDOWS":
    case "RESET_WINDOWS_LAYOUT":
      return [
        "Buka jendela beban",
        "Buka jendela parameter",
        "Tutup semua jendela",
        "Reset posisi jendela",
      ];
    case "TOGGLE_CAMERA_PREVIEW":
      return [
        "Mode hemat eco 16 FPS",
        "Tutup video kamera",
        "Buka jendela asisten AI",
        "Fit tampilan balok",
      ];
    case "AI_CONSULTATION":
      return [
        "Tanya saran optimasi balok",
        "Hitung optimasi profil",
        "Tampilkan diagram momen BMD",
        "Buka jendela dimensi dan parameter",
      ];
    default:
      return [
        "Beralih ke material baja",
        "Tampilkan diagram momen BMD",
        "Atur bentang balok 8 meter",
        "Ekspor ke AutoCAD DXF",
      ];
  }
}
