/* @ts-self-types="./mechanics_3d_wasm.d.ts" */

/**
 * Static pre-allocated workspace for zero-copy 60 FPS structural mechanics and 3D WebGL extrusion.
 *
 * Initialized once per session with fixed `M = 256` station buffers and pre-reserved mesh buffers.
 * Exposes raw pointers (`*const f64`, `*const f32`, `*const u32`) and lengths so TypeScript and
 * WebGL read `Float64Array` / `Float32Array` / `Uint32Array` views at invariant memory addresses.
 */
export class SolverWorkspace {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    SolverWorkspaceFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_solverworkspace_free(ptr, 0);
  }
  /**
   * Generates a 3D extruded Box (Hollow Structural Section) beam mesh with CCW triangle winding
   * into the pre-allocated workspace buffers.
   * @param {number} h_mm
   * @param {number} b_mm
   * @param {number} t_mm
   * @param {number} allowable_deflection_mm
   * @param {number} visual_scale
   * @returns {number}
   */
  build_box_3d_mesh(h_mm, b_mm, t_mm, allowable_deflection_mm, visual_scale) {
    const ret = wasm.solverworkspace_build_box_3d_mesh(
      this.__wbg_ptr,
      h_mm,
      b_mm,
      t_mm,
      allowable_deflection_mm,
      visual_scale,
    );
    return ret >>> 0;
  }
  /**
   * Generates a 3D extruded Rectangular Reinforced Concrete beam mesh with CCW triangle winding
   * into the pre-allocated workspace buffers.
   * @param {number} bw_mm
   * @param {number} h_mm
   * @param {number} allowable_deflection_mm
   * @param {number} visual_scale
   * @returns {number}
   */
  build_concrete_3d_mesh(bw_mm, h_mm, allowable_deflection_mm, visual_scale) {
    const ret = wasm.solverworkspace_build_concrete_3d_mesh(
      this.__wbg_ptr,
      bw_mm,
      h_mm,
      allowable_deflection_mm,
      visual_scale,
    );
    return ret >>> 0;
  }
  /**
   * Generates a 3D extruded IWF steel beam mesh with 4-segment root fillets and CCW triangle winding
   * into the pre-allocated workspace buffers.
   * @param {number} d_mm
   * @param {number} bf_mm
   * @param {number} tw_mm
   * @param {number} tf_mm
   * @param {number} r_mm
   * @param {number} allowable_deflection_mm
   * @param {number} visual_scale
   * @returns {number}
   */
  build_iwf_3d_mesh(d_mm, bf_mm, tw_mm, tf_mm, r_mm, allowable_deflection_mm, visual_scale) {
    const ret = wasm.solverworkspace_build_iwf_3d_mesh(
      this.__wbg_ptr,
      d_mm,
      bf_mm,
      tw_mm,
      tf_mm,
      r_mm,
      allowable_deflection_mm,
      visual_scale,
    );
    return ret >>> 0;
  }
  /**
   * Generates 3D wireframe rebar cage vertices and indices into the pre-allocated workspace buffers.
   * @param {number} bw_mm
   * @param {number} h_mm
   * @param {number} cover_mm
   * @param {number} stirrup_dia_mm
   * @param {number} stirrup_spacing_mm
   * @param {number} tensile_bar_count
   * @param {number} tensile_bar_dia_mm
   * @param {number} compressive_bar_count
   * @param {number} compressive_bar_dia_mm
   * @param {number} visual_scale
   * @returns {number}
   */
  build_rebar_cage_3d(
    bw_mm,
    h_mm,
    cover_mm,
    stirrup_dia_mm,
    stirrup_spacing_mm,
    tensile_bar_count,
    tensile_bar_dia_mm,
    compressive_bar_count,
    compressive_bar_dia_mm,
    visual_scale,
  ) {
    const ret = wasm.solverworkspace_build_rebar_cage_3d(
      this.__wbg_ptr,
      bw_mm,
      h_mm,
      cover_mm,
      stirrup_dia_mm,
      stirrup_spacing_mm,
      tensile_bar_count,
      tensile_bar_dia_mm,
      compressive_bar_count,
      compressive_bar_dia_mm,
      visual_scale,
    );
    return ret >>> 0;
  }
  /**
   * Clears all queued external loads without deallocating input vector capacities.
   */
  clear_loads() {
    wasm.solverworkspace_clear_loads(this.__wbg_ptr);
  }
  /**
   * Pointer to the 256-element `curvature_per_mm` (`f64`) buffer in WASM linear memory.
   * @returns {number}
   */
  curvature_ptr() {
    const ret = wasm.solverworkspace_curvature_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * Pointer to the 256-element `deflection_mm` (`f64`) buffer in WASM linear memory.
   * @returns {number}
   */
  deflection_ptr() {
    const ret = wasm.solverworkspace_deflection_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * Whether the active support configuration is statically indeterminate.
   * @returns {boolean}
   */
  is_statically_indeterminate() {
    const ret = wasm.solverworkspace_is_statically_indeterminate(this.__wbg_ptr);
    return ret !== 0;
  }
  /**
   * Returns the number of subdivisions per IWF fillet arc (`4`).
   * @returns {number}
   */
  iwf_fillet_segments() {
    const ret = wasm.solverworkspace_iwf_fillet_segments(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * Returns the number of perimeter vertices on an IWF cross-section (`28`).
   * @returns {number}
   */
  iwf_perimeter_vertex_count() {
    const ret = wasm.solverworkspace_iwf_perimeter_vertex_count(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * Last structured error code (`0` = no error).
   * @returns {number}
   */
  last_error_code() {
    const ret = wasm.solverworkspace_last_error_code(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * Last structured error diagnostic string (empty when `last_error_code == 0`).
   * @returns {string}
   */
  last_error_message() {
    let deferred1_0;
    let deferred1_1;
    try {
      const ret = wasm.solverworkspace_last_error_message(this.__wbg_ptr);
      deferred1_0 = ret[0];
      deferred1_1 = ret[1];
      return getStringFromWasm0(ret[0], ret[1]);
    } finally {
      wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
  }
  /**
   * Internal bending moment at left support A (`s = 0`) in kNm (sagging `+`, hogging `-`).
   * @returns {number}
   */
  ma_moment_knm() {
    const ret = wasm.solverworkspace_ma_moment_knm(this.__wbg_ptr);
    return ret;
  }
  /**
   * Signed peak deflection `Delta_max` in mm (strictly negative `< 0` under downward gravity loads).
   * @returns {number}
   */
  max_deflection_mm() {
    const ret = wasm.solverworkspace_max_deflection_mm(this.__wbg_ptr);
    return ret;
  }
  /**
   * Span coordinate `s` in meters where `|Delta_max|` occurs.
   * @returns {number}
   */
  max_deflection_station_m() {
    const ret = wasm.solverworkspace_max_deflection_station_m(this.__wbg_ptr);
    return ret;
  }
  /**
   * Maximum absolute bending moment `|M|_max` in kNm.
   * @returns {number}
   */
  max_moment_abs_knm() {
    const ret = wasm.solverworkspace_max_moment_abs_knm(this.__wbg_ptr);
    return ret;
  }
  /**
   * Span coordinate `s` in meters where `|M|_max` occurs.
   * @returns {number}
   */
  max_moment_station_m() {
    const ret = wasm.solverworkspace_max_moment_station_m(this.__wbg_ptr);
    return ret;
  }
  /**
   * Minimum negative (hogging) bending moment `M_min^-` in kNm.
   * @returns {number}
   */
  max_negative_moment_knm() {
    const ret = wasm.solverworkspace_max_negative_moment_knm(this.__wbg_ptr);
    return ret;
  }
  /**
   * Maximum positive (sagging) bending moment `M_max^+` in kNm.
   * @returns {number}
   */
  max_positive_moment_knm() {
    const ret = wasm.solverworkspace_max_positive_moment_knm(this.__wbg_ptr);
    return ret;
  }
  /**
   * Maximum absolute slope rotation `|theta|_max` in radians.
   * @returns {number}
   */
  max_rotation_abs_rad() {
    const ret = wasm.solverworkspace_max_rotation_abs_rad(this.__wbg_ptr);
    return ret;
  }
  /**
   * Maximum absolute shear force `|V|_max` in kN.
   * @returns {number}
   */
  max_shear_abs_kn() {
    const ret = wasm.solverworkspace_max_shear_abs_kn(this.__wbg_ptr);
    return ret;
  }
  /**
   * Internal bending moment at right support B (`s = L`) in kNm (sagging `+`, hogging `-`).
   * @returns {number}
   */
  mb_moment_knm() {
    const ret = wasm.solverworkspace_mb_moment_knm(this.__wbg_ptr);
    return ret;
  }
  /**
   * Number of `f32` elements currently active in `mesh_colors_f32`.
   * @returns {number}
   */
  mesh_colors_len() {
    const ret = wasm.solverworkspace_mesh_colors_len(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * Pointer to the 3D mesh vertex RGB contour colors (`f32`, `[r0, g0, b0, ...]`) buffer.
   * @returns {number}
   */
  mesh_colors_ptr() {
    const ret = wasm.solverworkspace_mesh_colors_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * Number of `u32` triangle indices currently active in `mesh_indices_u32`.
   * @returns {number}
   */
  mesh_indices_len() {
    const ret = wasm.solverworkspace_mesh_indices_len(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * Pointer to the 3D mesh CCW triangle indices (`u32`) buffer.
   * @returns {number}
   */
  mesh_indices_ptr() {
    const ret = wasm.solverworkspace_mesh_indices_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * Number of `f32` elements currently active in `mesh_normals_f32`.
   * @returns {number}
   */
  mesh_normals_len() {
    const ret = wasm.solverworkspace_mesh_normals_len(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * Pointer to the 3D mesh vertex normals (`f32`, `[nx0, ny0, nz0, ...]`) buffer.
   * @returns {number}
   */
  mesh_normals_ptr() {
    const ret = wasm.solverworkspace_mesh_normals_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * Number of `f32` elements currently active in `mesh_positions_f32`.
   * @returns {number}
   */
  mesh_positions_len() {
    const ret = wasm.solverworkspace_mesh_positions_len(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * Pointer to the 3D mesh vertex positions (`f32`, `[x0, y0, z0, ...]`) buffer.
   * @returns {number}
   */
  mesh_positions_ptr() {
    const ret = wasm.solverworkspace_mesh_positions_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * Equivalent uniform load `q_eq` in kN/m computed during Mode B evaluation.
   * @returns {number}
   */
  mode_b_equivalent_q_kn_per_m() {
    const ret = wasm.solverworkspace_mode_b_equivalent_q_kn_per_m(this.__wbg_ptr);
    return ret;
  }
  /**
   * Pointer to the 256-element `moment_major_knm` (`f64`) buffer in WASM linear memory.
   * @returns {number}
   */
  moment_major_ptr() {
    const ret = wasm.solverworkspace_moment_major_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * Pointer to the 256-element `moment_minor_knm` (`f64`) buffer in WASM linear memory.
   * @returns {number}
   */
  moment_minor_ptr() {
    const ret = wasm.solverworkspace_moment_minor_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * Creates a new [`SolverWorkspace`] with pre-allocated static buffers for `M = 256` stations
   * and 3D WebGL extrusion geometry.
   */
  constructor() {
    const ret = wasm.solverworkspace_new();
    this.__wbg_ptr = ret;
    SolverWorkspaceFinalization.register(this, this.__wbg_ptr, this);
    return this;
  }
  /**
   * Pointer to the 256-element `normal_n_kn` (`f64`) buffer in WASM linear memory.
   * @returns {number}
   */
  normal_ptr() {
    const ret = wasm.solverworkspace_normal_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * Mohr compatibility rotation integral `Phi_A` in kNm.
   * @returns {number}
   */
  phi_a_knm() {
    const ret = wasm.solverworkspace_phi_a_knm(this.__wbg_ptr);
    return ret;
  }
  /**
   * Mohr compatibility rotation integral `Phi_B` in kNm.
   * @returns {number}
   */
  phi_b_knm() {
    const ret = wasm.solverworkspace_phi_b_knm(this.__wbg_ptr);
    return ret;
  }
  /**
   * Pushes an applied external moment (`M` in kNm at `position_m` in meters).
   * @param {number} magnitude_knm
   * @param {number} position_m
   */
  push_applied_moment(magnitude_knm, position_m) {
    wasm.solverworkspace_push_applied_moment(this.__wbg_ptr, magnitude_knm, position_m);
  }
  /**
   * Pushes a uniform downward distributed load (`q` in kN/m on `[start_m, end_m]` in meters).
   * @param {number} magnitude_kn_per_m
   * @param {number} start_m
   * @param {number} end_m
   */
  push_distributed_load(magnitude_kn_per_m, start_m, end_m) {
    wasm.solverworkspace_push_distributed_load(this.__wbg_ptr, magnitude_kn_per_m, start_m, end_m);
  }
  /**
   * Pushes a concentrated downward point load (`P` in kN at `position_m` in meters).
   * @param {number} magnitude_kn
   * @param {number} position_m
   */
  push_point_load(magnitude_kn, position_m) {
    wasm.solverworkspace_push_point_load(this.__wbg_ptr, magnitude_kn, position_m);
  }
  /**
   * Axial horizontal reaction at left support A (`s = 0`) in kN.
   * @returns {number}
   */
  ra_axial_kn() {
    const ret = wasm.solverworkspace_ra_axial_kn(this.__wbg_ptr);
    return ret;
  }
  /**
   * Vertical upward reaction at left support A (`s = 0`) in kN.
   * @returns {number}
   */
  ra_vertical_kn() {
    const ret = wasm.solverworkspace_ra_vertical_kn(this.__wbg_ptr);
    return ret;
  }
  /**
   * Axial horizontal reaction at right support B (`s = L`) in kN.
   * @returns {number}
   */
  rb_axial_kn() {
    const ret = wasm.solverworkspace_rb_axial_kn(this.__wbg_ptr);
    return ret;
  }
  /**
   * Vertical upward reaction at right support B (`s = L`) in kN.
   * @returns {number}
   */
  rb_vertical_kn() {
    const ret = wasm.solverworkspace_rb_vertical_kn(this.__wbg_ptr);
    return ret;
  }
  /**
   * Number of `u32` line indices currently active in `rebar_indices_u32`.
   * @returns {number}
   */
  rebar_indices_len() {
    const ret = wasm.solverworkspace_rebar_indices_len(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * Pointer to the 3D rebar wireframe line segment indices (`u32`) buffer.
   * @returns {number}
   */
  rebar_indices_ptr() {
    const ret = wasm.solverworkspace_rebar_indices_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * Number of `f32` elements currently active in `rebar_positions_f32`.
   * @returns {number}
   */
  rebar_positions_len() {
    const ret = wasm.solverworkspace_rebar_positions_len(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * Pointer to the 3D rebar wireframe vertex positions (`f32`) buffer.
   * @returns {number}
   */
  rebar_positions_ptr() {
    const ret = wasm.solverworkspace_rebar_positions_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * Slope rotation at left support A (`s = 0`) in radians.
   * @returns {number}
   */
  rotation_left_rad() {
    const ret = wasm.solverworkspace_rotation_left_rad(this.__wbg_ptr);
    return ret;
  }
  /**
   * Pointer to the 256-element `rotation_rad` (`f64`) buffer in WASM linear memory.
   * @returns {number}
   */
  rotation_ptr() {
    const ret = wasm.solverworkspace_rotation_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * Slope rotation at right support B (`s = L`) in radians.
   * @returns {number}
   */
  rotation_right_rad() {
    const ret = wasm.solverworkspace_rotation_right_rad(this.__wbg_ptr);
    return ret;
  }
  /**
   * Sets the 3x3 orthogonal coordinate permutation matrix (`row-major`).
   * @param {number} m00
   * @param {number} m01
   * @param {number} m02
   * @param {number} m10
   * @param {number} m11
   * @param {number} m12
   * @param {number} m20
   * @param {number} m21
   * @param {number} m22
   */
  set_axis_permutation_matrix(m00, m01, m02, m10, m11, m12, m20, m21, m22) {
    wasm.solverworkspace_set_axis_permutation_matrix(
      this.__wbg_ptr,
      m00,
      m01,
      m02,
      m10,
      m11,
      m12,
      m20,
      m21,
      m22,
    );
  }
  /**
   * Pointer to the 256-element `shear_v_kn` (`f64`) buffer in WASM linear memory.
   * @returns {number}
   */
  shear_ptr() {
    const ret = wasm.solverworkspace_shear_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * Solves Mode A (Interactive External Loads) in place across all 256 stations.
   *
   * Returns `0` on success, or a structured non-zero error code (`1..=6`) without panicking
   * if `span_m <= 0`, `elastic_modulus_mpa <= 0`, `moment_of_inertia_mm4 <= 0`, or loads are invalid.
   * @param {number} span_m
   * @param {number} support_code
   * @param {number} elastic_modulus_mpa
   * @param {number} moment_of_inertia_mm4
   * @param {number} axial_force_kn
   * @param {number} minor_moment_knm
   * @param {number} torsion_knm
   * @returns {number}
   */
  solve_mode_a(
    span_m,
    support_code,
    elastic_modulus_mpa,
    moment_of_inertia_mm4,
    axial_force_kn,
    minor_moment_knm,
    torsion_knm,
  ) {
    const ret = wasm.solverworkspace_solve_mode_a(
      this.__wbg_ptr,
      span_m,
      support_code,
      elastic_modulus_mpa,
      moment_of_inertia_mm4,
      axial_force_kn,
      minor_moment_knm,
      torsion_knm,
    );
    return ret >>> 0;
  }
  /**
   * Solves Mode B (Direct Factored Internal Forces `P_u, M_ux, M_uy, T_u, V_u`) in place
   * across all 256 stations using the equivalent uniform load interpolator.
   *
   * Returns `0` on success, or a structured non-zero error code (`1..=6`) without panicking.
   * @param {number} span_m
   * @param {number} support_code
   * @param {number} elastic_modulus_mpa
   * @param {number} moment_of_inertia_mm4
   * @param {number} axial_force_pu_kn
   * @param {number} strong_axis_moment_mux_knm
   * @param {number} weak_axis_moment_muy_knm
   * @param {number} torsion_tu_knm
   * @param {number} shear_force_vu_kn
   * @returns {number}
   */
  solve_mode_b(
    span_m,
    support_code,
    elastic_modulus_mpa,
    moment_of_inertia_mm4,
    axial_force_pu_kn,
    strong_axis_moment_mux_knm,
    weak_axis_moment_muy_knm,
    torsion_tu_knm,
    shear_force_vu_kn,
  ) {
    const ret = wasm.solverworkspace_solve_mode_b(
      this.__wbg_ptr,
      span_m,
      support_code,
      elastic_modulus_mpa,
      moment_of_inertia_mm4,
      axial_force_pu_kn,
      strong_axis_moment_mux_knm,
      weak_axis_moment_muy_knm,
      torsion_tu_knm,
      shear_force_vu_kn,
    );
    return ret >>> 0;
  }
  /**
   * Returns the fixed discretization station count (`256`).
   * @returns {number}
   */
  station_count() {
    const ret = wasm.solverworkspace_station_count(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * Pointer to the 256-element `stations_m` (`f64`) buffer in WASM linear memory.
   * @returns {number}
   */
  stations_ptr() {
    const ret = wasm.solverworkspace_stations_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * Pointer to the 256-element `torsion_t_knm` (`f64`) buffer in WASM linear memory.
   * @returns {number}
   */
  torsion_ptr() {
    const ret = wasm.solverworkspace_torsion_ptr(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * Total downward vertical force sum in kN.
   * @returns {number}
   */
  total_downward_load_kn() {
    const ret = wasm.solverworkspace_total_downward_load_kn(this.__wbg_ptr);
    return ret;
  }
}
if (Symbol.dispose) SolverWorkspace.prototype[Symbol.dispose] = SolverWorkspace.prototype.free;
function __wbg_get_imports() {
  const import0 = {
    __proto__: null,
    __wbg___wbindgen_throw_4c88d8bf264fd984: function (arg0, arg1) {
      throw new Error(getStringFromWasm0(arg0, arg1));
    },
    __wbindgen_init_externref_table: function () {
      const table = wasm.__wbindgen_externrefs;
      table.set(0, undefined);
      table.set(1024, undefined);
      table.set(1025, null);
      table.set(1026, true);
      table.set(1027, false);
    },
  };
  return {
    __proto__: null,
    "./mechanics_3d_wasm_bg.js": import0,
  };
}

const SolverWorkspaceFinalization =
  typeof FinalizationRegistry === "undefined"
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry((ptr) => wasm.__wbg_solverworkspace_free(ptr, 1));

function getStringFromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return decodeText(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
  if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
    cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
  }
  return cachedUint8ArrayMemory0;
}

let cachedTextDecoder = new TextDecoder("utf-8", { ignoreBOM: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(bytes) {
  numBytesDecoded += bytes.length;
  if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
    cachedTextDecoder = new TextDecoder("utf-8", { ignoreBOM: true });
    cachedTextDecoder.decode();
    numBytesDecoded = bytes.length;
  }
  return cachedTextDecoder.decode(bytes);
}

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
  wasmInstance = instance;
  wasm = instance.exports;
  wasmModule = module;
  cachedUint8ArrayMemory0 = null;
  wasm.__wbindgen_start();
  return wasm;
}

async function __wbg_load(module, imports) {
  if (typeof Response === "function" && module instanceof Response) {
    if (!module.ok) {
      throw new Error(
        `failed to fetch Wasm: ${module.status} ${module.statusText} fetching '${module.url}'`,
      );
    }

    if (typeof WebAssembly.instantiateStreaming === "function") {
      try {
        return await WebAssembly.instantiateStreaming(module, imports);
      } catch (e) {
        const validResponse = expectedResponseType(module.type);

        if (validResponse && module.headers.get("Content-Type") !== "application/wasm") {
          console.warn(
            "`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n",
            e,
          );
        } else {
          throw e;
        }
      }
    }

    const bytes = await module.arrayBuffer();
    return await WebAssembly.instantiate(bytes, imports);
  } else {
    const instance = await WebAssembly.instantiate(module, imports);

    if (instance instanceof WebAssembly.Instance) {
      return { instance, module };
    } else {
      return instance;
    }
  }

  function expectedResponseType(type) {
    switch (type) {
      case "basic":
      case "cors":
      case "default":
        return true;
    }
    return false;
  }
}

function initSync(module) {
  if (wasm !== undefined) return wasm;

  if (module !== undefined) {
    if (Object.getPrototypeOf(module) === Object.prototype) {
      ({ module } = module);
    } else {
      console.warn("using deprecated parameters for `initSync()`; pass a single object instead");
    }
  }

  const imports = __wbg_get_imports();
  if (!(module instanceof WebAssembly.Module)) {
    module = new WebAssembly.Module(module);
  }
  const instance = new WebAssembly.Instance(module, imports);
  return __wbg_finalize_init(instance, module);
}

let __wbg_init_promise;
async function __wbg_init(module_or_path) {
  if (wasm !== undefined) return wasm;
  if (__wbg_init_promise === undefined) {
    __wbg_init_promise = __wbg_init_once(module_or_path);
    __wbg_init_promise.catch(() => {
      __wbg_init_promise = undefined;
    });
  }
  return __wbg_init_promise;
}

async function __wbg_init_once(module_or_path) {
  if (module_or_path !== undefined) {
    if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
      ({ module_or_path } = module_or_path);
    } else {
      console.warn(
        "using deprecated parameters for the initialization function; pass a single object instead",
      );
    }
  }

  if (module_or_path === undefined) {
    module_or_path = new URL("mechanics_3d_wasm_bg.wasm", import.meta.url);
  }
  const imports = __wbg_get_imports();

  if (
    typeof module_or_path === "string" ||
    (typeof Request === "function" && module_or_path instanceof Request) ||
    (typeof URL === "function" && module_or_path instanceof URL)
  ) {
    module_or_path = fetch(module_or_path);
  }

  const { instance, module } = await __wbg_load(await module_or_path, imports);

  return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
