//! High-frequency Rust WASM Structural Mechanics, Euler-Bernoulli Deflection, and 3D Mesh Extrusion Engine.
//!
//! Exposes a zero-copy [`SolverWorkspace`] that pre-allocates fixed-capacity linear memory buffers
//! (`M = 256` discrete span stations and reusable WebGL vertex/index buffers) so 60 FPS slider
//! interactions never trigger heap reallocations or memory leaks.

pub mod deflection;
pub mod diagrams;
pub mod extrude_3d;
pub mod rebar_cage_3d;
pub mod supports;

use wasm_bindgen::prelude::*;

use crate::deflection::{
    compute_mode_b_analytical_peak_deflection_mm, compute_mode_b_equivalent_uniform_load,
    solve_euler_bernoulli_deflection_in_place, DeflectionSummary,
};
use crate::diagrams::{compute_internal_force_diagrams_in_place, DiagramExtremaSummary};
use crate::extrude_3d::{
    generate_extruded_mesh_in_place, CrossSectionProfile, IWF_FILLET_SEGMENTS,
    IWF_PERIMETER_VERTEX_COUNT,
};
use crate::rebar_cage_3d::{generate_rebar_cage_in_place, RebarCageConfig};
use crate::supports::{
     solve_support_reactions, validate_beam_stiffness_inputs, AppliedMomentItem,
    DistributedLoadItem, MechanicsError, PointLoadItem, SupportOrientation, SupportReactionsResult,
    STATION_COUNT,
};

/// Pre-allocated vertex float capacity (`X, Y, Z` for up to 21,845 vertices) to guarantee
/// zero-copy pointer stability across all cross-section types (IWF 28-pt, BoxHss, Concrete).
const PREALLOC_MESH_FLOAT_CAPACITY: usize = 65_536;

/// Pre-allocated triangle index capacity (for up to 43,690 triangles).
const PREALLOC_MESH_INDEX_CAPACITY: usize = 131_072;

/// Pre-allocated rebar wireframe float capacity.
const PREALLOC_REBAR_FLOAT_CAPACITY: usize = 65_536;

/// Pre-allocated rebar wireframe line index capacity.
const PREALLOC_REBAR_INDEX_CAPACITY: usize = 131_072;

/// Static pre-allocated workspace for zero-copy 60 FPS structural mechanics and 3D WebGL extrusion.
///
/// Initialized once per session with fixed `M = 256` station buffers and pre-reserved mesh buffers.
/// Exposes raw pointers (`*const f64`, `*const f32`, `*const u32`) and lengths so TypeScript and
/// WebGL read `Float64Array` / `Float32Array` / `Uint32Array` views at invariant memory addresses.
#[wasm_bindgen]
pub struct SolverWorkspace {
    // Input load buffers (reused across frames via clear_loads())
    point_loads: Vec<PointLoadItem>,
    distributed_loads: Vec<DistributedLoadItem>,
    applied_moments: Vec<AppliedMomentItem>,
    axis_matrix: [f64; 9],

    // Fixed M = 256 station output buffers (boxed fixed-size arrays so base pointer never moves)
    stations_m: Box<[f64; STATION_COUNT]>,
    shear_v_kn: Box<[f64; STATION_COUNT]>,
    normal_n_kn: Box<[f64; STATION_COUNT]>,
    moment_major_knm: Box<[f64; STATION_COUNT]>,
    moment_minor_knm: Box<[f64; STATION_COUNT]>,
    torsion_t_knm: Box<[f64; STATION_COUNT]>,
    curvature_per_mm: Box<[f64; STATION_COUNT]>,
    rotation_rad: Box<[f64; STATION_COUNT]>,
    deflection_mm: Box<[f64; STATION_COUNT]>,

    // Reusable 3D WebGL mesh and rebar buffers with fixed pre-reserved capacities
    mesh_positions_f32: Vec<f32>,
    mesh_normals_f32: Vec<f32>,
    mesh_colors_f32: Vec<f32>,
    mesh_indices_u32: Vec<u32>,
    rebar_positions_f32: Vec<f32>,
    rebar_indices_u32: Vec<u32>,
    scratch_triangles: Vec<(usize, usize, usize)>,

    // Latest solved scalar summaries
    reactions: SupportReactionsResult,
    diagram_extrema: DiagramExtremaSummary,
    deflection_summary: DeflectionSummary,
    mode_b_equivalent_q_kn_per_m: f64,

    // Structured error state (0 = OK)
    last_error_code: u32,
    last_error_message: String,
}

impl Default for SolverWorkspace {
    fn default() -> Self {
        Self::new()
    }
}

#[wasm_bindgen]
impl SolverWorkspace {
    /// Creates a new [`SolverWorkspace`] with pre-allocated static buffers for `M = 256` stations
    /// and 3D WebGL extrusion geometry.
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            point_loads: Vec::with_capacity(64),
            distributed_loads: Vec::with_capacity(64),
            applied_moments: Vec::with_capacity(64),
            // Default to Z-Up civil engineering coordinate convention
            axis_matrix: [1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0],
            stations_m: Box::new([0.0; STATION_COUNT]),
            shear_v_kn: Box::new([0.0; STATION_COUNT]),
            normal_n_kn: Box::new([0.0; STATION_COUNT]),
            moment_major_knm: Box::new([0.0; STATION_COUNT]),
            moment_minor_knm: Box::new([0.0; STATION_COUNT]),
            torsion_t_knm: Box::new([0.0; STATION_COUNT]),
            curvature_per_mm: Box::new([0.0; STATION_COUNT]),
            rotation_rad: Box::new([0.0; STATION_COUNT]),
            deflection_mm: Box::new([0.0; STATION_COUNT]),
            mesh_positions_f32: Vec::with_capacity(PREALLOC_MESH_FLOAT_CAPACITY),
            mesh_normals_f32: Vec::with_capacity(PREALLOC_MESH_FLOAT_CAPACITY),
            mesh_colors_f32: Vec::with_capacity(PREALLOC_MESH_FLOAT_CAPACITY),
            mesh_indices_u32: Vec::with_capacity(PREALLOC_MESH_INDEX_CAPACITY),
            rebar_positions_f32: Vec::with_capacity(PREALLOC_REBAR_FLOAT_CAPACITY),
            rebar_indices_u32: Vec::with_capacity(PREALLOC_REBAR_INDEX_CAPACITY),
            scratch_triangles: Vec::with_capacity(64),
            reactions: SupportReactionsResult::default(),
            diagram_extrema: DiagramExtremaSummary::default(),
            deflection_summary: DeflectionSummary::default(),
            mode_b_equivalent_q_kn_per_m: 0.0,
            last_error_code: 0,
            last_error_message: String::new(),
        }
    }

    /// Returns the fixed discretization station count (`256`).
    pub fn station_count(&self) -> usize {
        STATION_COUNT
    }

    /// Returns the number of subdivisions per IWF fillet arc (`4`).
    pub fn iwf_fillet_segments(&self) -> usize {
        IWF_FILLET_SEGMENTS
    }

    /// Returns the number of perimeter vertices on an IWF cross-section (`28`).
    pub fn iwf_perimeter_vertex_count(&self) -> usize {
        IWF_PERIMETER_VERTEX_COUNT
    }

    /// Clears all queued external loads without deallocating input vector capacities.
    pub fn clear_loads(&mut self) {
        self.point_loads.clear();
        self.distributed_loads.clear();
        self.applied_moments.clear();
    }

    /// Pushes a concentrated downward point load (`P` in kN at `position_m` in meters).
    pub fn push_point_load(&mut self, magnitude_kn: f64, position_m: f64) {
        self.point_loads.push(PointLoadItem {
            magnitude_kn,
            position_m,
        });
    }

    /// Pushes a uniform downward distributed load (`q` in kN/m on `[start_m, end_m]` in meters).
    pub fn push_distributed_load(&mut self, magnitude_kn_per_m: f64, start_m: f64, end_m: f64) {
        self.distributed_loads.push(DistributedLoadItem {
            magnitude_kn_per_m,
            start_m,
            end_m,
        });
    }

    /// Pushes an applied external moment (`M` in kNm at `position_m` in meters).
    pub fn push_applied_moment(&mut self, magnitude_knm: f64, position_m: f64) {
        self.applied_moments.push(AppliedMomentItem {
            magnitude_knm,
            position_m,
        });
    }

    /// Sets the 3x3 orthogonal coordinate permutation matrix (`row-major`).
    #[allow(clippy::too_many_arguments)]
    pub fn set_axis_permutation_matrix(
        &mut self,
        m00: f64,
        m01: f64,
        m02: f64,
        m10: f64,
        m11: f64,
        m12: f64,
        m20: f64,
        m21: f64,
        m22: f64,
    ) {
        self.axis_matrix = [m00, m01, m02, m10, m11, m12, m20, m21, m22];
    }

    /// Solves Mode A (Interactive External Loads) in place across all 256 stations.
    ///
    /// Returns `0` on success, or a structured non-zero error code (`1..=6`) without panicking
    /// if `span_m <= 0`, `elastic_modulus_mpa <= 0`, `moment_of_inertia_mm4 <= 0`, or loads are invalid.
    #[allow(clippy::too_many_arguments)]
    pub fn solve_mode_a(
        &mut self,
        span_m: f64,
        support_code: u8,
        elastic_modulus_mpa: f64,
        moment_of_inertia_mm4: f64,
        axial_force_kn: f64,
        minor_moment_knm: f64,
        torsion_knm: f64,
    ) -> u32 {
        match self.solve_mode_a_internal(
            span_m,
            support_code,
            elastic_modulus_mpa,
            moment_of_inertia_mm4,
            axial_force_kn,
            minor_moment_knm,
            torsion_knm,
        ) {
            Ok(()) => {
                self.last_error_code = 0;
                self.last_error_message.clear();
                0
            }
            Err(err) => {
                let code = err.code();
                self.last_error_code = code;
                self.last_error_message = err.to_string();
                code
            }
        }
    }

    /// Solves Mode B (Direct Factored Internal Forces `P_u, M_ux, M_uy, T_u, V_u`) in place
    /// across all 256 stations using the equivalent uniform load interpolator.
    ///
    /// Returns `0` on success, or a structured non-zero error code (`1..=6`) without panicking.
    #[allow(clippy::too_many_arguments)]
    pub fn solve_mode_b(
        &mut self,
        span_m: f64,
        support_code: u8,
        elastic_modulus_mpa: f64,
        moment_of_inertia_mm4: f64,
        axial_force_pu_kn: f64,
        strong_axis_moment_mux_knm: f64,
        weak_axis_moment_muy_knm: f64,
        torsion_tu_knm: f64,
        shear_force_vu_kn: f64,
    ) -> u32 {
        match self.solve_mode_b_internal(
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
            Ok(()) => {
                self.last_error_code = 0;
                self.last_error_message.clear();
                0
            }
            Err(err) => {
                let code = err.code();
                self.last_error_code = code;
                self.last_error_message = err.to_string();
                code
            }
        }
    }

    /// Generates a 3D extruded IWF steel beam mesh with 4-segment root fillets and CCW triangle winding
    /// into the pre-allocated workspace buffers.
    #[allow(clippy::too_many_arguments)]
    pub fn build_iwf_3d_mesh(
        &mut self,
        d_mm: f64,
        bf_mm: f64,
        tw_mm: f64,
        tf_mm: f64,
        r_mm: f64,
        allowable_deflection_mm: f64,
        visual_scale: f64,
    ) -> u32 {
        let profile = CrossSectionProfile::Iwf {
            d_mm,
            bf_mm,
            tw_mm,
            tf_mm,
            r_mm,
        };
        self.run_mesh_extrusion(profile, allowable_deflection_mm, visual_scale)
    }

    /// Generates a 3D extruded Box (Hollow Structural Section) beam mesh with CCW triangle winding
    /// into the pre-allocated workspace buffers.
    pub fn build_box_3d_mesh(
        &mut self,
        h_mm: f64,
        b_mm: f64,
        t_mm: f64,
        allowable_deflection_mm: f64,
        visual_scale: f64,
    ) -> u32 {
        let profile = CrossSectionProfile::BoxHss { h_mm, b_mm, t_mm };
        self.run_mesh_extrusion(profile, allowable_deflection_mm, visual_scale)
    }

    /// Generates a 3D extruded Rectangular Reinforced Concrete beam mesh with CCW triangle winding
    /// into the pre-allocated workspace buffers.
    pub fn build_concrete_3d_mesh(
        &mut self,
        bw_mm: f64,
        h_mm: f64,
        allowable_deflection_mm: f64,
        visual_scale: f64,
    ) -> u32 {
        let profile = CrossSectionProfile::RectangularConcrete { bw_mm, h_mm };
        self.run_mesh_extrusion(profile, allowable_deflection_mm, visual_scale)
    }

    /// Generates 3D wireframe rebar cage vertices and indices into the pre-allocated workspace buffers.
    #[allow(clippy::too_many_arguments)]
    pub fn build_rebar_cage_3d(
        &mut self,
        bw_mm: f64,
        h_mm: f64,
        cover_mm: f64,
        stirrup_dia_mm: f64,
        stirrup_spacing_mm: f64,
        tensile_bar_count: usize,
        tensile_bar_dia_mm: f64,
        compressive_bar_count: usize,
        compressive_bar_dia_mm: f64,
        visual_scale: f64,
    ) -> u32 {
        let cfg = RebarCageConfig {
            bw_mm,
            h_mm,
            cover_mm,
            stirrup_dia_mm,
            stirrup_spacing_mm,
            tensile_bar_count,
            tensile_bar_dia_mm,
            compressive_bar_count,
            compressive_bar_dia_mm,
        };
        match generate_rebar_cage_in_place(
            cfg,
            &self.stations_m,
            &self.rotation_rad,
            &self.deflection_mm,
            visual_scale,
            &self.axis_matrix,
            &mut self.rebar_positions_f32,
            &mut self.rebar_indices_u32,
        ) {
            Ok(()) => {
                self.last_error_code = 0;
                self.last_error_message.clear();
                0
            }
            Err(err) => {
                let code = err.code();
                self.last_error_code = code;
                self.last_error_message = err.to_string();
                code
            }
        }
    }

    // ========================================================================
    // Zero-Copy Linear Memory Pointers & Lengths
    // ========================================================================

    /// Pointer to the 256-element `stations_m` (`f64`) buffer in WASM linear memory.
    pub fn stations_ptr(&self) -> *const f64 {
        self.stations_m.as_ptr()
    }

    /// Pointer to the 256-element `shear_v_kn` (`f64`) buffer in WASM linear memory.
    pub fn shear_ptr(&self) -> *const f64 {
        self.shear_v_kn.as_ptr()
    }

    /// Pointer to the 256-element `normal_n_kn` (`f64`) buffer in WASM linear memory.
    pub fn normal_ptr(&self) -> *const f64 {
        self.normal_n_kn.as_ptr()
    }

    /// Pointer to the 256-element `moment_major_knm` (`f64`) buffer in WASM linear memory.
    pub fn moment_major_ptr(&self) -> *const f64 {
        self.moment_major_knm.as_ptr()
    }

    /// Pointer to the 256-element `moment_minor_knm` (`f64`) buffer in WASM linear memory.
    pub fn moment_minor_ptr(&self) -> *const f64 {
        self.moment_minor_knm.as_ptr()
    }

    /// Pointer to the 256-element `torsion_t_knm` (`f64`) buffer in WASM linear memory.
    pub fn torsion_ptr(&self) -> *const f64 {
        self.torsion_t_knm.as_ptr()
    }

    /// Pointer to the 256-element `curvature_per_mm` (`f64`) buffer in WASM linear memory.
    pub fn curvature_ptr(&self) -> *const f64 {
        self.curvature_per_mm.as_ptr()
    }

    /// Pointer to the 256-element `rotation_rad` (`f64`) buffer in WASM linear memory.
    pub fn rotation_ptr(&self) -> *const f64 {
        self.rotation_rad.as_ptr()
    }

    /// Pointer to the 256-element `deflection_mm` (`f64`) buffer in WASM linear memory.
    pub fn deflection_ptr(&self) -> *const f64 {
        self.deflection_mm.as_ptr()
    }

    /// Pointer to the 3D mesh vertex positions (`f32`, `[x0, y0, z0, ...]`) buffer.
    pub fn mesh_positions_ptr(&self) -> *const f32 {
        self.mesh_positions_f32.as_ptr()
    }

    /// Number of `f32` elements currently active in `mesh_positions_f32`.
    pub fn mesh_positions_len(&self) -> usize {
        self.mesh_positions_f32.len()
    }

    /// Pointer to the 3D mesh vertex normals (`f32`, `[nx0, ny0, nz0, ...]`) buffer.
    pub fn mesh_normals_ptr(&self) -> *const f32 {
        self.mesh_normals_f32.as_ptr()
    }

    /// Number of `f32` elements currently active in `mesh_normals_f32`.
    pub fn mesh_normals_len(&self) -> usize {
        self.mesh_normals_f32.len()
    }

    /// Pointer to the 3D mesh vertex RGB contour colors (`f32`, `[r0, g0, b0, ...]`) buffer.
    pub fn mesh_colors_ptr(&self) -> *const f32 {
        self.mesh_colors_f32.as_ptr()
    }

    /// Number of `f32` elements currently active in `mesh_colors_f32`.
    pub fn mesh_colors_len(&self) -> usize {
        self.mesh_colors_f32.len()
    }

    /// Pointer to the 3D mesh CCW triangle indices (`u32`) buffer.
    pub fn mesh_indices_ptr(&self) -> *const u32 {
        self.mesh_indices_u32.as_ptr()
    }

    /// Number of `u32` triangle indices currently active in `mesh_indices_u32`.
    pub fn mesh_indices_len(&self) -> usize {
        self.mesh_indices_u32.len()
    }

    /// Pointer to the 3D rebar wireframe vertex positions (`f32`) buffer.
    pub fn rebar_positions_ptr(&self) -> *const f32 {
        self.rebar_positions_f32.as_ptr()
    }

    /// Number of `f32` elements currently active in `rebar_positions_f32`.
    pub fn rebar_positions_len(&self) -> usize {
        self.rebar_positions_f32.len()
    }

    /// Pointer to the 3D rebar wireframe line segment indices (`u32`) buffer.
    pub fn rebar_indices_ptr(&self) -> *const u32 {
        self.rebar_indices_u32.as_ptr()
    }

    /// Number of `u32` line indices currently active in `rebar_indices_u32`.
    pub fn rebar_indices_len(&self) -> usize {
        self.rebar_indices_u32.len()
    }

    // ========================================================================
    // Scalar Summary & Diagnostic Getters
    // ========================================================================

    /// Vertical upward reaction at left support A (`s = 0`) in kN.
    pub fn ra_vertical_kn(&self) -> f64 {
        self.reactions.ra_vertical_kn
    }

    /// Vertical upward reaction at right support B (`s = L`) in kN.
    pub fn rb_vertical_kn(&self) -> f64 {
        self.reactions.rb_vertical_kn
    }

    /// Internal bending moment at left support A (`s = 0`) in kNm (sagging `+`, hogging `-`).
    pub fn ma_moment_knm(&self) -> f64 {
        self.reactions.ma_moment_knm
    }

    /// Internal bending moment at right support B (`s = L`) in kNm (sagging `+`, hogging `-`).
    pub fn mb_moment_knm(&self) -> f64 {
        self.reactions.mb_moment_knm
    }

    /// Axial horizontal reaction at left support A (`s = 0`) in kN.
    pub fn ra_axial_kn(&self) -> f64 {
        self.reactions.ra_axial_kn
    }

    /// Axial horizontal reaction at right support B (`s = L`) in kN.
    pub fn rb_axial_kn(&self) -> f64 {
        self.reactions.rb_axial_kn
    }

    /// Total downward vertical force sum in kN.
    pub fn total_downward_load_kn(&self) -> f64 {
        self.reactions.total_downward_load_kn
    }

    /// Mohr compatibility rotation integral `Phi_A` in kNm.
    pub fn phi_a_knm(&self) -> f64 {
        self.reactions.phi_a_knm
    }

    /// Mohr compatibility rotation integral `Phi_B` in kNm.
    pub fn phi_b_knm(&self) -> f64 {
        self.reactions.phi_b_knm
    }

    /// Whether the active support configuration is statically indeterminate.
    pub fn is_statically_indeterminate(&self) -> bool {
        self.reactions.is_statically_indeterminate
    }

    /// Maximum absolute shear force `|V|_max` in kN.
    pub fn max_shear_abs_kn(&self) -> f64 {
        self.diagram_extrema.max_shear_abs_kn
    }

    /// Maximum positive (sagging) bending moment `M_max^+` in kNm.
    pub fn max_positive_moment_knm(&self) -> f64 {
        self.diagram_extrema.max_positive_moment_knm
    }

    /// Minimum negative (hogging) bending moment `M_min^-` in kNm.
    pub fn max_negative_moment_knm(&self) -> f64 {
        self.diagram_extrema.max_negative_moment_knm
    }

    /// Maximum absolute bending moment `|M|_max` in kNm.
    pub fn max_moment_abs_knm(&self) -> f64 {
        self.diagram_extrema.max_moment_abs_knm
    }

    /// Span coordinate `s` in meters where `|M|_max` occurs.
    pub fn max_moment_station_m(&self) -> f64 {
        self.diagram_extrema.max_moment_station_m
    }

    /// Signed peak deflection `Delta_max` in mm (strictly negative `< 0` under downward gravity loads).
    pub fn max_deflection_mm(&self) -> f64 {
        self.deflection_summary.max_deflection_mm
    }

    /// Span coordinate `s` in meters where `|Delta_max|` occurs.
    pub fn max_deflection_station_m(&self) -> f64 {
        self.deflection_summary.max_deflection_station_m
    }

    /// Maximum absolute slope rotation `|theta|_max` in radians.
    pub fn max_rotation_abs_rad(&self) -> f64 {
        self.deflection_summary.max_rotation_abs_rad
    }

    /// Slope rotation at left support A (`s = 0`) in radians.
    pub fn rotation_left_rad(&self) -> f64 {
        self.deflection_summary.rotation_left_rad
    }

    /// Slope rotation at right support B (`s = L`) in radians.
    pub fn rotation_right_rad(&self) -> f64 {
        self.deflection_summary.rotation_right_rad
    }

    /// Equivalent uniform load `q_eq` in kN/m computed during Mode B evaluation.
    pub fn mode_b_equivalent_q_kn_per_m(&self) -> f64 {
        self.mode_b_equivalent_q_kn_per_m
    }

    /// Last structured error code (`0` = no error).
    pub fn last_error_code(&self) -> u32 {
        self.last_error_code
    }

    /// Last structured error diagnostic string (empty when `last_error_code == 0`).
    pub fn last_error_message(&self) -> String {
        self.last_error_message.clone()
    }
}

impl SolverWorkspace {
    #[allow(clippy::too_many_arguments)]
    fn solve_mode_a_internal(
        &mut self,
        span_m: f64,
        support_code: u8,
        elastic_modulus_mpa: f64,
        moment_of_inertia_mm4: f64,
        axial_force_kn: f64,
        minor_moment_knm: f64,
        torsion_knm: f64,
    ) -> Result<(), MechanicsError> {
        validate_beam_stiffness_inputs(span_m, elastic_modulus_mpa, moment_of_inertia_mm4)?;
        let orientation = SupportOrientation::from_code(support_code)?;

        let reactions = solve_support_reactions(
            span_m,
            orientation,
            &self.point_loads,
            &self.distributed_loads,
            &self.applied_moments,
            axial_force_kn,
        )?;

        let extrema = compute_internal_force_diagrams_in_place(
            span_m,
            &reactions,
            &self.point_loads,
            &self.distributed_loads,
            &self.applied_moments,
            axial_force_kn,
            minor_moment_knm,
            torsion_knm,
            &mut self.stations_m,
            &mut self.shear_v_kn,
            &mut self.normal_n_kn,
            &mut self.moment_major_knm,
            &mut self.moment_minor_knm,
            &mut self.torsion_t_knm,
        )?;

        let defl = solve_euler_bernoulli_deflection_in_place(
            span_m,
            elastic_modulus_mpa,
            moment_of_inertia_mm4,
            orientation,
            &reactions,
            &self.point_loads,
            &self.distributed_loads,
            &self.applied_moments,
            &self.stations_m,
            &self.moment_major_knm,
            &mut self.curvature_per_mm,
            &mut self.rotation_rad,
            &mut self.deflection_mm,
        )?;

        self.reactions = reactions;
        self.diagram_extrema = extrema;
        self.deflection_summary = defl;
        self.mode_b_equivalent_q_kn_per_m = 0.0;
        Ok(())
    }

    #[allow(clippy::too_many_arguments)]
    fn solve_mode_b_internal(
        &mut self,
        span_m: f64,
        support_code: u8,
        elastic_modulus_mpa: f64,
        moment_of_inertia_mm4: f64,
        axial_force_pu_kn: f64,
        strong_axis_moment_mux_knm: f64,
        weak_axis_moment_muy_knm: f64,
        torsion_tu_knm: f64,
        shear_force_vu_kn: f64,
    ) -> Result<(), MechanicsError> {
        validate_beam_stiffness_inputs(span_m, elastic_modulus_mpa, moment_of_inertia_mm4)?;
        if !shear_force_vu_kn.is_finite() {
            return Err(MechanicsError::InvalidLoadParameter(
                "shear_force_vu_kn",
                shear_force_vu_kn,
            ));
        }

        let orientation = SupportOrientation::from_code(support_code)?;
        let q_eq = compute_mode_b_equivalent_uniform_load(
            span_m,
            strong_axis_moment_mux_knm,
            orientation,
        )?;

        self.clear_loads();
        if q_eq > 0.0 {
            self.push_distributed_load(q_eq, 0.0, span_m);
        }

        self.solve_mode_a_internal(
            span_m,
            support_code,
            elastic_modulus_mpa,
            moment_of_inertia_mm4,
            axial_force_pu_kn,
            weak_axis_moment_muy_knm,
            torsion_tu_knm,
        )?;

        self.mode_b_equivalent_q_kn_per_m = q_eq;
        let analytical_peak = compute_mode_b_analytical_peak_deflection_mm(
            span_m,
            elastic_modulus_mpa,
            moment_of_inertia_mm4,
            strong_axis_moment_mux_knm,
            orientation,
        )?;
        self.deflection_summary.max_deflection_mm = analytical_peak;
        if shear_force_vu_kn.abs() > self.diagram_extrema.max_shear_abs_kn {
            self.diagram_extrema.max_shear_abs_kn = shear_force_vu_kn.abs();
        }
        Ok(())
    }

    fn run_mesh_extrusion(
        &mut self,
        profile: CrossSectionProfile,
        allowable_deflection_mm: f64,
        visual_scale: f64,
    ) -> u32 {
        match generate_extruded_mesh_in_place(
            profile,
            &self.stations_m,
            &self.rotation_rad,
            &self.deflection_mm,
            self.deflection_summary.max_deflection_mm.abs(),
            allowable_deflection_mm,
            visual_scale,
            &self.axis_matrix,
            &mut self.mesh_positions_f32,
            &mut self.mesh_normals_f32,
            &mut self.mesh_colors_f32,
            &mut self.mesh_indices_u32,
            &mut self.scratch_triangles,
        ) {
            Ok(()) => {
                self.last_error_code = 0;
                self.last_error_message.clear();
                0
            }
            Err(err) => {
                let code = err.code();
                self.last_error_code = code;
                self.last_error_message = err.to_string();
                code
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const E_STEEL_MPA: f64 = 200_000.0;
    const I_TEST_MM4: f64 = 100_000_000.0; // 1e8 mm^4 -> EI = 2e13 N*mm^2

    #[test]
    fn test_guard_clauses_reject_non_positive_stiffness_without_panic() {
        let mut ws = SolverWorkspace::new();
        ws.push_point_load(50.0, 3.0);

        // L <= 0
        assert_eq!(
            ws.solve_mode_a(0.0, 2, E_STEEL_MPA, I_TEST_MM4, 0.0, 0.0, 0.0),
            1
        );
        assert_eq!(
            ws.solve_mode_a(-5.0, 2, E_STEEL_MPA, I_TEST_MM4, 0.0, 0.0, 0.0),
            1
        );
        // E <= 0
        assert_eq!(ws.solve_mode_a(6.0, 2, 0.0, I_TEST_MM4, 0.0, 0.0, 0.0), 2);
        assert_eq!(
            ws.solve_mode_a(6.0, 2, -200_000.0, I_TEST_MM4, 0.0, 0.0, 0.0),
            2
        );
        // I <= 0
        assert_eq!(ws.solve_mode_a(6.0, 2, E_STEEL_MPA, 0.0, 0.0, 0.0, 0.0), 3);
        assert_eq!(
            ws.solve_mode_a(6.0, 2, E_STEEL_MPA, -100.0, 0.0, 0.0, 0.0),
            3
        );
    }

    #[test]
    fn test_simply_supported_uniform_and_point_load_negative_deflection() {
        let mut ws = SolverWorkspace::new();
        let l_m = 6.0;
        let q = 10.0; // 10 kN/m
        ws.push_distributed_load(q, 0.0, l_m);

        let code = ws.solve_mode_a(l_m, 2, E_STEEL_MPA, I_TEST_MM4, 0.0, 0.0, 0.0);
        assert_eq!(code, 0);
        assert!((ws.ra_vertical_kn() - 30.0).abs() < 1e-9);
        assert!((ws.rb_vertical_kn() - 30.0).abs() < 1e-9);
        assert!((ws.max_positive_moment_knm() - 45.0).abs() < 1e-9);

        // Analytical: -5 * q * L^4 / (384 * E * I) = -8.4375 mm
        let expected_defl = -8.4375;
        assert!(ws.max_deflection_mm() < 0.0);
        assert!((ws.max_deflection_mm() - expected_defl).abs() < 1e-6);

        // Point load P = 60 kN at midspan a = 3.0 m
        ws.clear_loads();
        ws.push_point_load(60.0, 3.0);
        assert_eq!(
            ws.solve_mode_a(l_m, 3, E_STEEL_MPA, I_TEST_MM4, 0.0, 0.0, 0.0),
            0
        );
        assert!((ws.max_positive_moment_knm() - 90.0).abs() < 1e-9);
        // Analytical: -P * L^3 / (48 * E * I) = -60000 * 6000^3 / (48 * 2e13) = -13.5 mm
        assert!((ws.max_deflection_mm() - (-13.5)).abs() < 1e-6);
    }

    #[test]
    fn test_cantilever_left_and_right_orientations() {
        let mut ws = SolverWorkspace::new();
        let l_m = 4.0;
        let p_kn = 20.0;

        // 1. Cantilever Left (Fixed at s=0, Free at s=4.0m) with tip load at s=4.0m
        ws.push_point_load(p_kn, l_m);
        assert_eq!(
            ws.solve_mode_a(l_m, 0, E_STEEL_MPA, I_TEST_MM4, 0.0, 0.0, 0.0),
            0
        );
        assert!((ws.ra_vertical_kn() - 20.0).abs() < 1e-9);
        assert!((ws.ma_moment_knm() - (-80.0)).abs() < 1e-9);
        // Analytical: -P * L^3 / (3 * E * I) = -20000 * 4000^3 / (3 * 2e13) = -21.333333333333332 mm
        let expected = -(20_000.0 * 4000.0_f64.powi(3)) / (3.0 * 2.0e13);
        assert!((ws.max_deflection_mm() - expected).abs() < 1e-6);

        // 2. Cantilever Right (Free at s=0, Fixed at s=4.0m) with tip load at s=0.0m
        ws.clear_loads();
        ws.push_point_load(p_kn, 0.0);
        assert_eq!(
            ws.solve_mode_a(l_m, 1, E_STEEL_MPA, I_TEST_MM4, 0.0, 0.0, 0.0),
            0
        );
        assert!((ws.rb_vertical_kn() - 20.0).abs() < 1e-9);
        assert!((ws.mb_moment_knm() - (-80.0)).abs() < 1e-9);
        assert!((ws.max_deflection_mm() - expected).abs() < 1e-6);
    }

    #[test]
    fn test_indeterminate_fixed_fixed_and_propped_cantilevers() {
        let mut ws = SolverWorkspace::new();
        let l_m = 6.0;
        let q = 12.0; // 12 kN/m
        ws.push_distributed_load(q, 0.0, l_m);

        // Fixed-Fixed (code 4): M_A = M_B = -q*L^2/12 = -36 kNm, M_mid = +q*L^2/24 = +18 kNm
        assert_eq!(
            ws.solve_mode_a(l_m, 4, E_STEEL_MPA, I_TEST_MM4, 0.0, 0.0, 0.0),
            0
        );
        assert!((ws.ma_moment_knm() - (-36.0)).abs() < 1e-9);
        assert!((ws.mb_moment_knm() - (-36.0)).abs() < 1e-9);
        assert!((ws.max_positive_moment_knm() - 18.0).abs() < 1e-9);
        // Analytical: -q * L^4 / (384 * E * I) = -12 * 6000^4 / (384 * 2e13) = -2.025 mm
        assert!((ws.max_deflection_mm() - (-2.025)).abs() < 1e-6);

        // Fixed-Roller (code 5): M_A = -q*L^2/8 = -54 kNm, R_A = 5/8*q*L = 45 kN, R_B = 3/8*q*L = 27 kN
        assert_eq!(
            ws.solve_mode_a(l_m, 5, E_STEEL_MPA, I_TEST_MM4, 0.0, 0.0, 0.0),
            0
        );
        assert!((ws.ma_moment_knm() - (-54.0)).abs() < 1e-9);
        assert!((ws.ra_vertical_kn() - 45.0).abs() < 1e-9);
        assert!((ws.rb_vertical_kn() - 27.0).abs() < 1e-9);
        // Max positive moment = 9/128 * q * L^2 = 30.375 kNm
        assert!((ws.max_positive_moment_knm() - 30.375).abs() < 1e-6);
    }

    #[test]
    fn test_zero_copy_pointer_stability_and_ccw_winding() {
        let mut ws = SolverWorkspace::new();
        let defl_ptr_before = ws.deflection_ptr();
        let pos_ptr_before = ws.mesh_positions_ptr();
        let idx_ptr_before = ws.mesh_indices_ptr();

        ws.push_distributed_load(15.0, 0.0, 6.0);
        assert_eq!(
            ws.solve_mode_a(6.0, 2, E_STEEL_MPA, I_TEST_MM4, 0.0, 0.0, 0.0),
            0
        );
        assert_eq!(
            ws.build_iwf_3d_mesh(300.0, 150.0, 6.5, 9.0, 13.0, 16.67, 10.0),
            0
        );

        // Verify pointers did not reallocate across solves
        assert_eq!(ws.deflection_ptr(), defl_ptr_before);
        assert_eq!(ws.mesh_positions_ptr(), pos_ptr_before);
        assert_eq!(ws.mesh_indices_ptr(), idx_ptr_before);

        // Verify every single triangle has positive outward normal dot product (CCW winding)
        let tri_count = ws.mesh_indices_len() / 3;
        assert!(tri_count > 1000);
        for t in 0..tri_count {
            let i0 = ws.mesh_indices_u32[t * 3] as usize;
            let i1 = ws.mesh_indices_u32[t * 3 + 1] as usize;
            let i2 = ws.mesh_indices_u32[t * 3 + 2] as usize;

            let p0 = [
                ws.mesh_positions_f32[i0 * 3],
                ws.mesh_positions_f32[i0 * 3 + 1],
                ws.mesh_positions_f32[i0 * 3 + 2],
            ];
            let p1 = [
                ws.mesh_positions_f32[i1 * 3],
                ws.mesh_positions_f32[i1 * 3 + 1],
                ws.mesh_positions_f32[i1 * 3 + 2],
            ];
            let p2 = [
                ws.mesh_positions_f32[i2 * 3],
                ws.mesh_positions_f32[i2 * 3 + 1],
                ws.mesh_positions_f32[i2 * 3 + 2],
            ];
            let n0 = [
                ws.mesh_normals_f32[i0 * 3],
                ws.mesh_normals_f32[i0 * 3 + 1],
                ws.mesh_normals_f32[i0 * 3 + 2],
            ];

            let e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
            let e2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
            let cross = [
                e1[1] * e2[2] - e1[2] * e2[1],
                e1[2] * e2[0] - e1[0] * e2[2],
                e1[0] * e2[1] - e1[1] * e2[0],
            ];
            let dot = cross[0] * n0[0] + cross[1] * n0[1] + cross[2] * n0[2];
            assert!(
                dot >= 0.0,
                "Triangle {} violated CCW winding (dot = {})",
                t,
                dot
            );
        }
    }
}
