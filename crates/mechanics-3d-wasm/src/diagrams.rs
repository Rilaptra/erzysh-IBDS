//! Internal force diagram evaluator (SFD, NFD, BMD, TFD) across M = 256 discrete span stations.

use crate::supports::{
    evaluate_simple_span_moment_m0, evaluate_simple_span_shear_v0, AppliedMomentItem,
    DistributedLoadItem, MechanicsError, PointLoadItem, SupportReactionsResult, STATION_COUNT,
};

/// Summary of extreme internal forces along the beam span `[0, L]`.
#[derive(Debug, Clone, Copy, Default)]
pub struct DiagramExtremaSummary {
    /// Maximum absolute shear force |V|_max in kN.
    pub max_shear_abs_kn: f64,
    /// Maximum positive (sagging) bending moment M_max^+ in kNm (>= 0).
    pub max_positive_moment_knm: f64,
    /// Minimum negative (hogging) bending moment M_min^- in kNm (<= 0).
    pub max_negative_moment_knm: f64,
    /// Maximum absolute bending moment |M|_max in kNm.
    pub max_moment_abs_knm: f64,
    /// Span coordinate s in meters where |M|_max occurs.
    pub max_moment_station_m: f64,
    /// Maximum absolute axial force |N|_max in kN.
    pub max_normal_abs_kn: f64,
    /// Maximum absolute torsional moment |T|_max in kNm.
    pub max_torsion_abs_knm: f64,
}

/// Evaluates the superimposed major-axis bending moment `M_major(s)` in kNm at arbitrary coordinate `s` (in meters).
///
/// Follows the flexibility superposition equation:
/// `M_major(s) = M_0(s) + M_A * (1 - s / L) + M_B * (s / L)`
#[inline]
pub fn evaluate_superimposed_moment_at(
    s: f64,
    span_m: f64,
    reactions: &SupportReactionsResult,
    point_loads: &[PointLoadItem],
    distributed_loads: &[DistributedLoadItem],
    applied_moments: &[AppliedMomentItem],
) -> f64 {
    let m0 = evaluate_simple_span_moment_m0(
        s,
        span_m,
        reactions.ra0_simple_kn,
        point_loads,
        distributed_loads,
        applied_moments,
    );
    let ratio = (s / span_m).clamp(0.0, 1.0);
    m0 + reactions.ma_moment_knm * (1.0 - ratio) + reactions.mb_moment_knm * ratio
}

/// Evaluates the superimposed vertical shear force `V(s)` in kN at arbitrary coordinate `s` (in meters).
///
/// Follows the derivative of the superimposed bending moment:
/// `V(s) = V_0(s) + (M_B - M_A) / L`
#[inline]
pub fn evaluate_superimposed_shear_at(
    s: f64,
    span_m: f64,
    reactions: &SupportReactionsResult,
    point_loads: &[PointLoadItem],
    distributed_loads: &[DistributedLoadItem],
) -> f64 {
    let v0 = evaluate_simple_span_shear_v0(
        s,
        span_m,
        reactions.ra0_simple_kn,
        point_loads,
        distributed_loads,
    );
    v0 + (reactions.mb_moment_knm - reactions.ma_moment_knm) / span_m
}

/// Populates the 256-node internal force arrays (`stations_m`, `shear_v_kn`, `normal_n_kn`,
/// `moment_major_knm`, `moment_minor_knm`, `torsion_t_knm`) in place without heap allocations.
///
/// # Arguments
/// * `span_m` - Clear span length L in meters (`L > 0`).
/// * `reactions` - Solved boundary support reactions and end moments.
/// * `point_loads` - Slice of concentrated vertical point loads.
/// * `distributed_loads` - Slice of uniform distributed vertical loads.
/// * `applied_moments` - Slice of concentrated external moments.
/// * `axial_force_kn` - Constant axial force N in kN (positive = tension).
/// * `minor_moment_knm` - Minor-axis bending moment M_minor in kNm.
/// * `torsion_knm` - Torsional moment T in kNm.
/// * `stations_m` - Output buffer of 256 station coordinates in meters.
/// * `shear_v_kn` - Output buffer of 256 shear forces V(s) in kN.
/// * `normal_n_kn` - Output buffer of 256 axial forces N(s) in kN.
/// * `moment_major_knm` - Output buffer of 256 strong-axis moments M_major(s) in kNm.
/// * `moment_minor_knm` - Output buffer of 256 weak-axis moments M_minor(s) in kNm.
/// * `torsion_t_knm` - Output buffer of 256 torsional moments T(s) in kNm.
///
/// # Errors
/// Returns [`MechanicsError::InvalidSpanLength`] if `span_m <= 0` or is non-finite.
#[allow(clippy::too_many_arguments)]
pub fn compute_internal_force_diagrams_in_place(
    span_m: f64,
    reactions: &SupportReactionsResult,
    point_loads: &[PointLoadItem],
    distributed_loads: &[DistributedLoadItem],
    applied_moments: &[AppliedMomentItem],
    axial_force_kn: f64,
    minor_moment_knm: f64,
    torsion_knm: f64,
    stations_m: &mut [f64; STATION_COUNT],
    shear_v_kn: &mut [f64; STATION_COUNT],
    normal_n_kn: &mut [f64; STATION_COUNT],
    moment_major_knm: &mut [f64; STATION_COUNT],
    moment_minor_knm: &mut [f64; STATION_COUNT],
    torsion_t_knm: &mut [f64; STATION_COUNT],
) -> Result<DiagramExtremaSummary, MechanicsError> {
    if !span_m.is_finite() || span_m <= 0.0 {
        return Err(MechanicsError::InvalidSpanLength(span_m));
    }

    let ds = span_m / ((STATION_COUNT - 1) as f64);
    let mut max_shear_abs_kn = 0.0_f64;
    let mut max_positive_moment_knm = 0.0_f64;
    let mut max_negative_moment_knm = 0.0_f64;
    let mut max_moment_abs_knm = 0.0_f64;
    let mut max_moment_station_m = 0.0_f64;

    for m in 0..STATION_COUNT {
        let s = if m == STATION_COUNT - 1 {
            span_m
        } else {
            (m as f64) * ds
        };
        let v = evaluate_superimposed_shear_at(s, span_m, reactions, point_loads, distributed_loads);
        let mom = evaluate_superimposed_moment_at(
            s,
            span_m,
            reactions,
            point_loads,
            distributed_loads,
            applied_moments,
        );

        stations_m[m] = s;
        shear_v_kn[m] = v;
        normal_n_kn[m] = axial_force_kn;
        moment_major_knm[m] = mom;
        moment_minor_knm[m] = minor_moment_knm;
        torsion_t_knm[m] = torsion_knm;

        let v_abs = v.abs();
        if v_abs > max_shear_abs_kn {
            max_shear_abs_kn = v_abs;
        }
        if mom > max_positive_moment_knm {
            max_positive_moment_knm = mom;
        }
        if mom < max_negative_moment_knm {
            max_negative_moment_knm = mom;
        }
        let mom_abs = mom.abs();
        if mom_abs > max_moment_abs_knm {
            max_moment_abs_knm = mom_abs;
            max_moment_station_m = s;
        }
    }

    // Also inspect exact concentrated load positions and zero-shear crossings between stations
    // so peak bending moments (e.g. P*L/4 at s = L/2) are captured with zero grid-sampling loss.
    let mut inspect_station = |s_cand: f64| {
        let s_clamped = s_cand.clamp(0.0, span_m);
        let mom = evaluate_superimposed_moment_at(
            s_clamped,
            span_m,
            reactions,
            point_loads,
            distributed_loads,
            applied_moments,
        );
        if mom > max_positive_moment_knm {
            max_positive_moment_knm = mom;
        }
        if mom < max_negative_moment_knm {
            max_negative_moment_knm = mom;
        }
        let mom_abs = mom.abs();
        if mom_abs > max_moment_abs_knm {
            max_moment_abs_knm = mom_abs;
            max_moment_station_m = s_clamped;
        }
    };

    inspect_station(0.5 * span_m);
    for pl in point_loads {
        inspect_station(pl.position_m);
    }
    for m in 1..STATION_COUNT {
        let v_prev = shear_v_kn[m - 1];
        let v_curr = shear_v_kn[m];
        if (v_prev >= 0.0 && v_curr <= 0.0) || (v_prev <= 0.0 && v_curr >= 0.0) {
            let denom = v_prev - v_curr;
            if denom.abs() > 1e-12 {
                let s_zero = stations_m[m - 1] + (v_prev / denom) * ds;
                inspect_station(s_zero);
            }
        }
    }

    Ok(DiagramExtremaSummary {
        max_shear_abs_kn,
        max_positive_moment_knm,
        max_negative_moment_knm,
        max_moment_abs_knm,
        max_moment_station_m,
        max_normal_abs_kn: axial_force_kn.abs(),
        max_torsion_abs_knm: torsion_knm.abs(),
    })
}
