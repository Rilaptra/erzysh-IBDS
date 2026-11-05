//! Euler-Bernoulli O(M) double numerical integrator with negative gravity deflection
//! convention (Delta < 0) and Mode B direct internal force interpolator.

use crate::diagrams::evaluate_superimposed_moment_at;
use crate::supports::{
    validate_beam_stiffness_inputs, AppliedMomentItem, DistributedLoadItem, MechanicsError,
    PointLoadItem, SupportOrientation, SupportReactionsResult, STATION_COUNT,
};

/// Summary metrics from the Euler-Bernoulli deflection and rotation solver.
#[derive(Debug, Clone, Copy, Default)]
pub struct DeflectionSummary {
    /// Signed peak deflection Delta_max in mm (negative under downward gravity loads).
    pub max_deflection_mm: f64,
    /// Span coordinate s in meters where |Delta_max| occurs.
    pub max_deflection_station_m: f64,
    /// Maximum absolute rotation |theta|_max in radians.
    pub max_rotation_abs_rad: f64,
    /// End rotation at left support A (s=0) in radians.
    pub rotation_left_rad: f64,
    /// End rotation at right support B (s=L) in radians.
    pub rotation_right_rad: f64,
}

/// Integrates Euler-Bernoulli curvature `kappa(s) = M_major(s) / (E * I_major)` twice along
/// the `M = 256` span stations in place without allocating heap memory.
///
/// Downward gravity loads produce positive sagging moments `M > 0` on simple spans, which
/// satisfy `d^2v / ds^2 = +M / (E*I)` and boundary conditions `v(0) = 0, v(L) = 0`, yielding
/// strictly negative vertical deflections `v(s) < 0` (`Delta_max < 0`).
///
/// # Errors
/// Returns [`MechanicsError`] if `span_m <= 0`, `elastic_modulus_mpa <= 0`, or `moment_of_inertia_mm4 <= 0`.
#[allow(clippy::too_many_arguments)]
pub fn solve_euler_bernoulli_deflection_in_place(
    span_m: f64,
    elastic_modulus_mpa: f64,
    moment_of_inertia_mm4: f64,
    orientation: SupportOrientation,
    reactions: &SupportReactionsResult,
    point_loads: &[PointLoadItem],
    distributed_loads: &[DistributedLoadItem],
    applied_moments: &[AppliedMomentItem],
    stations_m: &[f64; STATION_COUNT],
    moment_major_knm: &[f64; STATION_COUNT],
    curvature_per_mm: &mut [f64; STATION_COUNT],
    rotation_rad: &mut [f64; STATION_COUNT],
    deflection_mm: &mut [f64; STATION_COUNT],
) -> Result<DeflectionSummary, MechanicsError> {
    validate_beam_stiffness_inputs(span_m, elastic_modulus_mpa, moment_of_inertia_mm4)?;

    // Flexural rigidity EI in N*mm^2; M in kNm converts to N*mm via 1e6.
    let ei_nmm2 = elastic_modulus_mpa * moment_of_inertia_mm4;
    let k_factor = 1_000_000.0 / ei_nmm2;

    let span_mm = span_m * 1000.0;
    let ds_m = span_m / ((STATION_COUNT - 1) as f64);
    let ds_mm = span_mm / ((STATION_COUNT - 1) as f64);
    let half_ds_m = 0.5 * ds_m;
    let half_ds_mm = 0.5 * ds_mm;

    for m in 0..STATION_COUNT {
        curvature_per_mm[m] = moment_major_knm[m] * k_factor;
    }

    // Helper closure evaluating exact curvature kappa(s) in mm^-1 at any sub-station s (in meters)
    let eval_kappa = |s_m: f64| -> f64 {
        let mom_knm = evaluate_superimposed_moment_at(
            s_m,
            span_m,
            reactions,
            point_loads,
            distributed_loads,
            applied_moments,
        );
        mom_knm * k_factor
    };

    rotation_rad[0] = 0.0;
    deflection_mm[0] = 0.0;

    // Integrate panel-by-panel using two composite Simpson sub-panels per grid step [s_{m-1}, s_m].
    // This remains strictly O(M) with zero heap allocations while capturing midspan kinks (s = L/2)
    // and quartic deflection polynomials to machine precision.
    let mut mid_rotations_rad = [0.0_f64; STATION_COUNT - 1];
    let mut mid_deflections_mm = [0.0_f64; STATION_COUNT - 1];

    for m in 1..STATION_COUNT {
        let s0_m = stations_m[m - 1];
        let s_mid_m = s0_m + half_ds_m;
        let s1_m = stations_m[m];

        // Sub-panel 1: [s0_m, s_mid_m] of length half_ds_mm
        let k0 = curvature_per_mm[m - 1];
        let k_q1 = eval_kappa(0.5 * (s0_m + s_mid_m));
        let k_mid = eval_kappa(s_mid_m);

        let theta0 = rotation_rad[m - 1];
        let theta_q1 = theta0 + (half_ds_mm / 24.0) * (5.0 * k0 + 8.0 * k_q1 - k_mid);
        let theta_mid = theta0 + (half_ds_mm / 6.0) * (k0 + 4.0 * k_q1 + k_mid);
        let v_mid =
            deflection_mm[m - 1] + (half_ds_mm / 6.0) * (theta0 + 4.0 * theta_q1 + theta_mid);

        mid_rotations_rad[m - 1] = theta_mid;
        mid_deflections_mm[m - 1] = v_mid;

        // Sub-panel 2: [s_mid_m, s1_m] of length half_ds_mm
        let k_q3 = eval_kappa(0.5 * (s_mid_m + s1_m));
        let k1 = curvature_per_mm[m];

        let theta_q3 = theta_mid + (half_ds_mm / 24.0) * (5.0 * k_mid + 8.0 * k_q3 - k1);
        let theta1 = theta_mid + (half_ds_mm / 6.0) * (k_mid + 4.0 * k_q3 + k1);
        let v1 = v_mid + (half_ds_mm / 6.0) * (theta_mid + 4.0 * theta_q3 + theta1);

        rotation_rad[m] = theta1;
        deflection_mm[m] = v1;
    }

    // Apply boundary condition integration constants C_1 (rad) and C_2 (mm)
    let (c1_rad, c2_mm) = match orientation {
        SupportOrientation::CantileverLeft => (0.0, 0.0),
        SupportOrientation::CantileverRight => {
            let c1 = -rotation_rad[STATION_COUNT - 1];
            let c2 = -deflection_mm[STATION_COUNT - 1] - c1 * span_mm;
            (c1, c2)
        }
        SupportOrientation::PinnedRoller
        | SupportOrientation::RollerPinned
        | SupportOrientation::FixedFixed
        | SupportOrientation::FixedRoller
        | SupportOrientation::RollerFixed
        | SupportOrientation::FixedPinned
        | SupportOrientation::PinnedFixed => {
            let c1 = -deflection_mm[STATION_COUNT - 1] / span_mm;
            (c1, 0.0)
        }
    };

    let mut max_deflection_mm = 0.0_f64;
    let mut max_deflection_abs = 0.0_f64;
    let mut max_deflection_station_m = 0.0_f64;
    let mut max_rotation_abs_rad = 0.0_f64;

    for m in 0..STATION_COUNT {
        let s_mm = stations_m[m] * 1000.0;
        let theta = rotation_rad[m] + c1_rad;
        let mut v = deflection_mm[m] + c1_rad * s_mm + c2_mm;

        // Enforce exact zero displacement at restrained supports to eliminate floating-point drift
        if m == 0 && !matches!(orientation, SupportOrientation::CantileverRight) {
            v = 0.0;
        }
        if m == STATION_COUNT - 1 && !matches!(orientation, SupportOrientation::CantileverLeft) {
            v = 0.0;
        }

        rotation_rad[m] = theta;
        deflection_mm[m] = v;

        let v_abs = v.abs();
        if v_abs > max_deflection_abs {
            max_deflection_abs = v_abs;
            max_deflection_mm = v;
            max_deflection_station_m = stations_m[m];
        }
        let theta_abs = theta.abs();
        if theta_abs > max_rotation_abs_rad {
            max_rotation_abs_rad = theta_abs;
        }
    }

    // Check panel midpoints (including exact midspan s = L/2 at m = 128) for peak deflection
    for m in 1..STATION_COUNT {
        let s_mid_m = stations_m[m - 1] + half_ds_m;
        let s_mid_mm = s_mid_m * 1000.0;
        let v_mid = mid_deflections_mm[m - 1] + c1_rad * s_mid_mm + c2_mm;
        let v_mid_abs = v_mid.abs();
        if v_mid_abs > max_deflection_abs {
            max_deflection_abs = v_mid_abs;
            max_deflection_mm = v_mid;
            max_deflection_station_m = s_mid_m;
        }
        let theta_mid = mid_rotations_rad[m - 1] + c1_rad;
        if theta_mid.abs() > max_rotation_abs_rad {
            max_rotation_abs_rad = theta_mid.abs();
        }
    }

    Ok(DeflectionSummary {
        max_deflection_mm,
        max_deflection_station_m,
        max_rotation_abs_rad,
        rotation_left_rad: rotation_rad[0],
        rotation_right_rad: rotation_rad[STATION_COUNT - 1],
    })
}

/// Computes the Mode B equivalent downward uniform load intensity `q_eq` (in kN/m)
/// from a directly specified factored bending moment `M_ux` (in kNm) and support orientation.
///
/// Per `structural_mechanics_and_deflection_solver_spec.md` §4:
/// - Simply Supported (`PINNED_ROLLER`, `ROLLER_PINNED`): `q_eq = 8 * |M_ux| / L^2`
/// - Fixed-Fixed (`FIXED_FIXED`): `q_eq = 12 * |M_ux| / L^2`
/// - Propped Cantilever (`FIXED_ROLLER`, `ROLLER_FIXED`, `FIXED_PINNED`, `PINNED_FIXED`): `q_eq = 8 * |M_ux| / L^2`
/// - Cantilever (`CANTILEVER_LEFT`, `CANTILEVER_RIGHT`): `q_eq = 2 * |M_ux| / L^2`
pub fn compute_mode_b_equivalent_uniform_load(
    span_m: f64,
    strong_axis_moment_mux_knm: f64,
    orientation: SupportOrientation,
) -> Result<f64, MechanicsError> {
    if !span_m.is_finite() || span_m <= 0.0 {
        return Err(MechanicsError::InvalidSpanLength(span_m));
    }
    if !strong_axis_moment_mux_knm.is_finite() {
        return Err(MechanicsError::InvalidLoadParameter(
            "strong_axis_moment_mux_knm",
            strong_axis_moment_mux_knm,
        ));
    }

    let m_abs = strong_axis_moment_mux_knm.abs();
    let l2 = span_m * span_m;
    let coeff = match orientation {
        SupportOrientation::PinnedRoller | SupportOrientation::RollerPinned => 8.0,
        SupportOrientation::FixedFixed => 12.0,
        SupportOrientation::FixedRoller
        | SupportOrientation::RollerFixed
        | SupportOrientation::FixedPinned
        | SupportOrientation::PinnedFixed => 8.0,
        SupportOrientation::CantileverLeft | SupportOrientation::CantileverRight => 2.0,
    };

    Ok(coeff * m_abs / l2)
}

/// Computes the Mode B closed-form peak negative deflection `Delta_max` (in mm, `<= 0`)
/// directly from `|M_ux|`, span length `L`, elastic modulus `E`, and moment of inertia `I`.
///
/// Closed-form coefficients per `structural_mechanics_and_deflection_solver_spec.md` §4:
/// - Simply Supported: `-5 * |M_ux| * L^2 / (48 * E * I)`
/// - Fixed-Fixed: `-1 * |M_ux| * L^2 / (32 * E * I)`
/// - Propped Cantilever: `-8 * |M_ux| * L^2 / (185 * E * I)`
/// - Cantilever: `-1 * |M_ux| * L^2 / (4 * E * I)`
pub fn compute_mode_b_analytical_peak_deflection_mm(
    span_m: f64,
    elastic_modulus_mpa: f64,
    moment_of_inertia_mm4: f64,
    strong_axis_moment_mux_knm: f64,
    orientation: SupportOrientation,
) -> Result<f64, MechanicsError> {
    validate_beam_stiffness_inputs(span_m, elastic_modulus_mpa, moment_of_inertia_mm4)?;
    if !strong_axis_moment_mux_knm.is_finite() {
        return Err(MechanicsError::InvalidLoadParameter(
            "strong_axis_moment_mux_knm",
            strong_axis_moment_mux_knm,
        ));
    }

    let m_nmm = strong_axis_moment_mux_knm.abs() * 1_000_000.0;
    if m_nmm == 0.0 {
        return Ok(0.0);
    }
    let l_mm = span_m * 1000.0;
    let ei_nmm2 = elastic_modulus_mpa * moment_of_inertia_mm4;
    let base = (m_nmm * l_mm * l_mm) / ei_nmm2;

    let ratio = match orientation {
        SupportOrientation::PinnedRoller | SupportOrientation::RollerPinned => -5.0 / 48.0,
        SupportOrientation::FixedFixed => -1.0 / 32.0,
        SupportOrientation::FixedRoller
        | SupportOrientation::RollerFixed
        | SupportOrientation::FixedPinned
        | SupportOrientation::PinnedFixed => -8.0 / 185.0,
        SupportOrientation::CantileverLeft | SupportOrientation::CantileverRight => -1.0 / 4.0,
    };

    Ok(ratio * base)
}
