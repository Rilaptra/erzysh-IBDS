/* tslint:disable */
/* eslint-disable */
export const memory: WebAssembly.Memory;
export const __wbg_solverworkspace_free: (a: number, b: number) => void;
export const solverworkspace_build_box_3d_mesh: (
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number,
) => number;
export const solverworkspace_build_concrete_3d_mesh: (
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
) => number;
export const solverworkspace_build_iwf_3d_mesh: (
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number,
  g: number,
  h: number,
) => number;
export const solverworkspace_build_rebar_cage_3d: (
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
export const solverworkspace_clear_loads: (a: number) => void;
export const solverworkspace_curvature_ptr: (a: number) => number;
export const solverworkspace_deflection_ptr: (a: number) => number;
export const solverworkspace_is_statically_indeterminate: (a: number) => number;
export const solverworkspace_iwf_fillet_segments: (a: number) => number;
export const solverworkspace_iwf_perimeter_vertex_count: (a: number) => number;
export const solverworkspace_last_error_code: (a: number) => number;
export const solverworkspace_last_error_message: (a: number) => [number, number];
export const solverworkspace_ma_moment_knm: (a: number) => number;
export const solverworkspace_max_deflection_mm: (a: number) => number;
export const solverworkspace_max_deflection_station_m: (a: number) => number;
export const solverworkspace_max_moment_abs_knm: (a: number) => number;
export const solverworkspace_max_moment_station_m: (a: number) => number;
export const solverworkspace_max_negative_moment_knm: (a: number) => number;
export const solverworkspace_max_positive_moment_knm: (a: number) => number;
export const solverworkspace_max_rotation_abs_rad: (a: number) => number;
export const solverworkspace_max_shear_abs_kn: (a: number) => number;
export const solverworkspace_mb_moment_knm: (a: number) => number;
export const solverworkspace_mesh_colors_len: (a: number) => number;
export const solverworkspace_mesh_colors_ptr: (a: number) => number;
export const solverworkspace_mesh_indices_len: (a: number) => number;
export const solverworkspace_mesh_indices_ptr: (a: number) => number;
export const solverworkspace_mesh_normals_len: (a: number) => number;
export const solverworkspace_mesh_normals_ptr: (a: number) => number;
export const solverworkspace_mesh_positions_len: (a: number) => number;
export const solverworkspace_mesh_positions_ptr: (a: number) => number;
export const solverworkspace_mode_b_equivalent_q_kn_per_m: (a: number) => number;
export const solverworkspace_moment_major_ptr: (a: number) => number;
export const solverworkspace_moment_minor_ptr: (a: number) => number;
export const solverworkspace_new: () => number;
export const solverworkspace_normal_ptr: (a: number) => number;
export const solverworkspace_phi_a_knm: (a: number) => number;
export const solverworkspace_phi_b_knm: (a: number) => number;
export const solverworkspace_push_applied_moment: (a: number, b: number, c: number) => void;
export const solverworkspace_push_distributed_load: (
  a: number,
  b: number,
  c: number,
  d: number,
) => void;
export const solverworkspace_push_point_load: (a: number, b: number, c: number) => void;
export const solverworkspace_ra_axial_kn: (a: number) => number;
export const solverworkspace_ra_vertical_kn: (a: number) => number;
export const solverworkspace_rb_axial_kn: (a: number) => number;
export const solverworkspace_rb_vertical_kn: (a: number) => number;
export const solverworkspace_rebar_indices_len: (a: number) => number;
export const solverworkspace_rebar_indices_ptr: (a: number) => number;
export const solverworkspace_rebar_positions_len: (a: number) => number;
export const solverworkspace_rebar_positions_ptr: (a: number) => number;
export const solverworkspace_rotation_left_rad: (a: number) => number;
export const solverworkspace_rotation_ptr: (a: number) => number;
export const solverworkspace_rotation_right_rad: (a: number) => number;
export const solverworkspace_set_axis_permutation_matrix: (
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
export const solverworkspace_shear_ptr: (a: number) => number;
export const solverworkspace_solve_mode_a: (
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number,
  g: number,
  h: number,
) => number;
export const solverworkspace_solve_mode_b: (
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
export const solverworkspace_station_count: (a: number) => number;
export const solverworkspace_stations_ptr: (a: number) => number;
export const solverworkspace_torsion_ptr: (a: number) => number;
export const solverworkspace_total_downward_load_kn: (a: number) => number;
export const __wbindgen_externrefs: WebAssembly.Table;
export const __wbindgen_free: (a: number, b: number, c: number) => void;
export const __wbindgen_start: () => void;
