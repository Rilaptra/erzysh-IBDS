/* tslint:disable */
/* eslint-disable */

/**
 * Static pre-allocated workspace for zero-copy 60 FPS structural mechanics and 3D WebGL extrusion.
 *
 * Initialized once per session with fixed `M = 256` station buffers and pre-reserved mesh buffers.
 * Exposes raw pointers (`*const f64`, `*const f32`, `*const u32`) and lengths so TypeScript and
 * WebGL read `Float64Array` / `Float32Array` / `Uint32Array` views at invariant memory addresses.
 */
export class SolverWorkspace {
  free(): void;
  [Symbol.dispose](): void;
  /**
   * Generates a 3D extruded Box (Hollow Structural Section) beam mesh with CCW triangle winding
   * into the pre-allocated workspace buffers.
   */
  build_box_3d_mesh(
    h_mm: number,
    b_mm: number,
    t_mm: number,
    allowable_deflection_mm: number,
    visual_scale: number,
  ): number;
  /**
   * Generates a 3D extruded Rectangular Reinforced Concrete beam mesh with CCW triangle winding
   * into the pre-allocated workspace buffers.
   */
  build_concrete_3d_mesh(
    bw_mm: number,
    h_mm: number,
    allowable_deflection_mm: number,
    visual_scale: number,
  ): number;
  /**
   * Generates a 3D extruded IWF steel beam mesh with 4-segment root fillets and CCW triangle winding
   * into the pre-allocated workspace buffers.
   */
  build_iwf_3d_mesh(
    d_mm: number,
    bf_mm: number,
    tw_mm: number,
    tf_mm: number,
    r_mm: number,
    allowable_deflection_mm: number,
    visual_scale: number,
  ): number;
  /**
   * Generates 3D wireframe rebar cage vertices and indices into the pre-allocated workspace buffers.
   */
  build_rebar_cage_3d(
    bw_mm: number,
    h_mm: number,
    cover_mm: number,
    stirrup_dia_mm: number,
    stirrup_spacing_mm: number,
    tensile_bar_count: number,
    tensile_bar_dia_mm: number,
    compressive_bar_count: number,
    compressive_bar_dia_mm: number,
    visual_scale: number,
  ): number;
  /**
   * Clears all queued external loads without deallocating input vector capacities.
   */
  clear_loads(): void;
  /**
   * Pointer to the 256-element `curvature_per_mm` (`f64`) buffer in WASM linear memory.
   */
  curvature_ptr(): number;
  /**
   * Pointer to the 256-element `deflection_mm` (`f64`) buffer in WASM linear memory.
   */
  deflection_ptr(): number;
  /**
   * Whether the active support configuration is statically indeterminate.
   */
  is_statically_indeterminate(): boolean;
  /**
   * Returns the number of subdivisions per IWF fillet arc (`4`).
   */
  iwf_fillet_segments(): number;
  /**
   * Returns the number of perimeter vertices on an IWF cross-section (`28`).
   */
  iwf_perimeter_vertex_count(): number;
  /**
   * Last structured error code (`0` = no error).
   */
  last_error_code(): number;
  /**
   * Last structured error diagnostic string (empty when `last_error_code == 0`).
   */
  last_error_message(): string;
  /**
   * Internal bending moment at left support A (`s = 0`) in kNm (sagging `+`, hogging `-`).
   */
  ma_moment_knm(): number;
  /**
   * Signed peak deflection `Delta_max` in mm (strictly negative `< 0` under downward gravity loads).
   */
  max_deflection_mm(): number;
  /**
   * Span coordinate `s` in meters where `|Delta_max|` occurs.
   */
  max_deflection_station_m(): number;
  /**
   * Maximum absolute bending moment `|M|_max` in kNm.
   */
  max_moment_abs_knm(): number;
  /**
   * Span coordinate `s` in meters where `|M|_max` occurs.
   */
  max_moment_station_m(): number;
  /**
   * Minimum negative (hogging) bending moment `M_min^-` in kNm.
   */
  max_negative_moment_knm(): number;
  /**
   * Maximum positive (sagging) bending moment `M_max^+` in kNm.
   */
  max_positive_moment_knm(): number;
  /**
   * Maximum absolute slope rotation `|theta|_max` in radians.
   */
  max_rotation_abs_rad(): number;
  /**
   * Maximum absolute shear force `|V|_max` in kN.
   */
  max_shear_abs_kn(): number;
  /**
   * Internal bending moment at right support B (`s = L`) in kNm (sagging `+`, hogging `-`).
   */
  mb_moment_knm(): number;
  /**
   * Number of `f32` elements currently active in `mesh_colors_f32`.
   */
  mesh_colors_len(): number;
  /**
   * Pointer to the 3D mesh vertex RGB contour colors (`f32`, `[r0, g0, b0, ...]`) buffer.
   */
  mesh_colors_ptr(): number;
  /**
   * Number of `u32` triangle indices currently active in `mesh_indices_u32`.
   */
  mesh_indices_len(): number;
  /**
   * Pointer to the 3D mesh CCW triangle indices (`u32`) buffer.
   */
  mesh_indices_ptr(): number;
  /**
   * Number of `f32` elements currently active in `mesh_normals_f32`.
   */
  mesh_normals_len(): number;
  /**
   * Pointer to the 3D mesh vertex normals (`f32`, `[nx0, ny0, nz0, ...]`) buffer.
   */
  mesh_normals_ptr(): number;
  /**
   * Number of `f32` elements currently active in `mesh_positions_f32`.
   */
  mesh_positions_len(): number;
  /**
   * Pointer to the 3D mesh vertex positions (`f32`, `[x0, y0, z0, ...]`) buffer.
   */
  mesh_positions_ptr(): number;
  /**
   * Equivalent uniform load `q_eq` in kN/m computed during Mode B evaluation.
   */
  mode_b_equivalent_q_kn_per_m(): number;
  /**
   * Pointer to the 256-element `moment_major_knm` (`f64`) buffer in WASM linear memory.
   */
  moment_major_ptr(): number;
  /**
   * Pointer to the 256-element `moment_minor_knm` (`f64`) buffer in WASM linear memory.
   */
  moment_minor_ptr(): number;
  /**
   * Creates a new [`SolverWorkspace`] with pre-allocated static buffers for `M = 256` stations
   * and 3D WebGL extrusion geometry.
   */
  constructor();
  /**
   * Pointer to the 256-element `normal_n_kn` (`f64`) buffer in WASM linear memory.
   */
  normal_ptr(): number;
  /**
   * Mohr compatibility rotation integral `Phi_A` in kNm.
   */
  phi_a_knm(): number;
  /**
   * Mohr compatibility rotation integral `Phi_B` in kNm.
   */
  phi_b_knm(): number;
  /**
   * Pushes an applied external moment (`M` in kNm at `position_m` in meters).
   */
  push_applied_moment(magnitude_knm: number, position_m: number): void;
  /**
   * Pushes a uniform downward distributed load (`q` in kN/m on `[start_m, end_m]` in meters).
   */
  push_distributed_load(magnitude_kn_per_m: number, start_m: number, end_m: number): void;
  /**
   * Pushes a concentrated downward point load (`P` in kN at `position_m` in meters).
   */
  push_point_load(magnitude_kn: number, position_m: number): void;
  /**
   * Axial horizontal reaction at left support A (`s = 0`) in kN.
   */
  ra_axial_kn(): number;
  /**
   * Vertical upward reaction at left support A (`s = 0`) in kN.
   */
  ra_vertical_kn(): number;
  /**
   * Axial horizontal reaction at right support B (`s = L`) in kN.
   */
  rb_axial_kn(): number;
  /**
   * Vertical upward reaction at right support B (`s = L`) in kN.
   */
  rb_vertical_kn(): number;
  /**
   * Number of `u32` line indices currently active in `rebar_indices_u32`.
   */
  rebar_indices_len(): number;
  /**
   * Pointer to the 3D rebar wireframe line segment indices (`u32`) buffer.
   */
  rebar_indices_ptr(): number;
  /**
   * Number of `f32` elements currently active in `rebar_positions_f32`.
   */
  rebar_positions_len(): number;
  /**
   * Pointer to the 3D rebar wireframe vertex positions (`f32`) buffer.
   */
  rebar_positions_ptr(): number;
  /**
   * Slope rotation at left support A (`s = 0`) in radians.
   */
  rotation_left_rad(): number;
  /**
   * Pointer to the 256-element `rotation_rad` (`f64`) buffer in WASM linear memory.
   */
  rotation_ptr(): number;
  /**
   * Slope rotation at right support B (`s = L`) in radians.
   */
  rotation_right_rad(): number;
  /**
   * Sets the 3x3 orthogonal coordinate permutation matrix (`row-major`).
   */
  set_axis_permutation_matrix(
    m00: number,
    m01: number,
    m02: number,
    m10: number,
    m11: number,
    m12: number,
    m20: number,
    m21: number,
    m22: number,
  ): void;
  /**
   * Pointer to the 256-element `shear_v_kn` (`f64`) buffer in WASM linear memory.
   */
  shear_ptr(): number;
  /**
   * Solves Mode A (Interactive External Loads) in place across all 256 stations.
   *
   * Returns `0` on success, or a structured non-zero error code (`1..=6`) without panicking
   * if `span_m <= 0`, `elastic_modulus_mpa <= 0`, `moment_of_inertia_mm4 <= 0`, or loads are invalid.
   */
  solve_mode_a(
    span_m: number,
    support_code: number,
    elastic_modulus_mpa: number,
    moment_of_inertia_mm4: number,
    axial_force_kn: number,
    minor_moment_knm: number,
    torsion_knm: number,
  ): number;
  /**
   * Solves Mode B (Direct Factored Internal Forces `P_u, M_ux, M_uy, T_u, V_u`) in place
   * across all 256 stations using the equivalent uniform load interpolator.
   *
   * Returns `0` on success, or a structured non-zero error code (`1..=6`) without panicking.
   */
  solve_mode_b(
    span_m: number,
    support_code: number,
    elastic_modulus_mpa: number,
    moment_of_inertia_mm4: number,
    axial_force_pu_kn: number,
    strong_axis_moment_mux_knm: number,
    weak_axis_moment_muy_knm: number,
    torsion_tu_knm: number,
    shear_force_vu_kn: number,
  ): number;
  /**
   * Returns the fixed discretization station count (`256`).
   */
  station_count(): number;
  /**
   * Pointer to the 256-element `stations_m` (`f64`) buffer in WASM linear memory.
   */
  stations_ptr(): number;
  /**
   * Pointer to the 256-element `torsion_t_knm` (`f64`) buffer in WASM linear memory.
   */
  torsion_ptr(): number;
  /**
   * Total downward vertical force sum in kN.
   */
  total_downward_load_kn(): number;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_solverworkspace_free: (a: number, b: number) => void;
  readonly solverworkspace_build_box_3d_mesh: (
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
  ) => number;
  readonly solverworkspace_build_concrete_3d_mesh: (
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
  ) => number;
  readonly solverworkspace_build_iwf_3d_mesh: (
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
    g: number,
    h: number,
  ) => number;
  readonly solverworkspace_build_rebar_cage_3d: (
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
    g: number,
    h: number,
    i: number,
    j: number,
    k: number,
  ) => number;
  readonly solverworkspace_clear_loads: (a: number) => void;
  readonly solverworkspace_curvature_ptr: (a: number) => number;
  readonly solverworkspace_deflection_ptr: (a: number) => number;
  readonly solverworkspace_is_statically_indeterminate: (a: number) => number;
  readonly solverworkspace_iwf_fillet_segments: (a: number) => number;
  readonly solverworkspace_iwf_perimeter_vertex_count: (a: number) => number;
  readonly solverworkspace_last_error_code: (a: number) => number;
  readonly solverworkspace_last_error_message: (a: number) => [number, number];
  readonly solverworkspace_ma_moment_knm: (a: number) => number;
  readonly solverworkspace_max_deflection_mm: (a: number) => number;
  readonly solverworkspace_max_deflection_station_m: (a: number) => number;
  readonly solverworkspace_max_moment_abs_knm: (a: number) => number;
  readonly solverworkspace_max_moment_station_m: (a: number) => number;
  readonly solverworkspace_max_negative_moment_knm: (a: number) => number;
  readonly solverworkspace_max_positive_moment_knm: (a: number) => number;
  readonly solverworkspace_max_rotation_abs_rad: (a: number) => number;
  readonly solverworkspace_max_shear_abs_kn: (a: number) => number;
  readonly solverworkspace_mb_moment_knm: (a: number) => number;
  readonly solverworkspace_mesh_colors_len: (a: number) => number;
  readonly solverworkspace_mesh_colors_ptr: (a: number) => number;
  readonly solverworkspace_mesh_indices_len: (a: number) => number;
  readonly solverworkspace_mesh_indices_ptr: (a: number) => number;
  readonly solverworkspace_mesh_normals_len: (a: number) => number;
  readonly solverworkspace_mesh_normals_ptr: (a: number) => number;
  readonly solverworkspace_mesh_positions_len: (a: number) => number;
  readonly solverworkspace_mesh_positions_ptr: (a: number) => number;
  readonly solverworkspace_mode_b_equivalent_q_kn_per_m: (a: number) => number;
  readonly solverworkspace_moment_major_ptr: (a: number) => number;
  readonly solverworkspace_moment_minor_ptr: (a: number) => number;
  readonly solverworkspace_new: () => number;
  readonly solverworkspace_normal_ptr: (a: number) => number;
  readonly solverworkspace_phi_a_knm: (a: number) => number;
  readonly solverworkspace_phi_b_knm: (a: number) => number;
  readonly solverworkspace_push_applied_moment: (a: number, b: number, c: number) => void;
  readonly solverworkspace_push_distributed_load: (
    a: number,
    b: number,
    c: number,
    d: number,
  ) => void;
  readonly solverworkspace_push_point_load: (a: number, b: number, c: number) => void;
  readonly solverworkspace_ra_axial_kn: (a: number) => number;
  readonly solverworkspace_ra_vertical_kn: (a: number) => number;
  readonly solverworkspace_rb_axial_kn: (a: number) => number;
  readonly solverworkspace_rb_vertical_kn: (a: number) => number;
  readonly solverworkspace_rebar_indices_len: (a: number) => number;
  readonly solverworkspace_rebar_indices_ptr: (a: number) => number;
  readonly solverworkspace_rebar_positions_len: (a: number) => number;
  readonly solverworkspace_rebar_positions_ptr: (a: number) => number;
  readonly solverworkspace_rotation_left_rad: (a: number) => number;
  readonly solverworkspace_rotation_ptr: (a: number) => number;
  readonly solverworkspace_rotation_right_rad: (a: number) => number;
  readonly solverworkspace_set_axis_permutation_matrix: (
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
    g: number,
    h: number,
    i: number,
    j: number,
  ) => void;
  readonly solverworkspace_shear_ptr: (a: number) => number;
  readonly solverworkspace_solve_mode_a: (
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
    g: number,
    h: number,
  ) => number;
  readonly solverworkspace_solve_mode_b: (
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
    g: number,
    h: number,
    i: number,
    j: number,
  ) => number;
  readonly solverworkspace_station_count: (a: number) => number;
  readonly solverworkspace_stations_ptr: (a: number) => number;
  readonly solverworkspace_torsion_ptr: (a: number) => number;
  readonly solverworkspace_total_downward_load_kn: (a: number) => number;
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init(
  module_or_path?:
    { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>,
): Promise<InitOutput>;
