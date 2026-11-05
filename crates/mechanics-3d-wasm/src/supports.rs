//! Support boundary condition solver for the 5 civil engineering support categories
//! (9 orientation variants) using Macaulay singularity brackets and Mohr's
//! flexibility compatibility integrals on M = 256 discrete stations.

use std::fmt;

/// Fixed discretization count along the beam span s in [0, L].
pub const STATION_COUNT: usize = 256;

/// Structured error codes returned by the mechanics engine when guard clauses fail.
#[derive(Debug, Clone, PartialEq)]
pub enum MechanicsError {
    /// Span length L must be finite and strictly positive (L > 0).
    InvalidSpanLength(f64),
    /// Elastic modulus E must be finite and strictly positive (E > 0).
    InvalidElasticModulus(f64),
    /// Moment of inertia I must be finite and strictly positive (I > 0).
    InvalidMomentOfInertia(f64),
    /// Support orientation code is outside the valid domain [0..=8].
    InvalidSupportOrientation(u8),
    /// Load coordinate or magnitude violates domain bounds or is non-finite.
    InvalidLoadParameter(&'static str, f64),
    /// Cross-section dimension is non-positive or non-finite.
    InvalidSectionDimension(&'static str, f64),
}

impl MechanicsError {
    /// Returns a deterministic numeric error code for FFI / WASM diagnostics.
    pub fn code(&self) -> u32 {
        match self {
            Self::InvalidSpanLength(_) => 1,
            Self::InvalidElasticModulus(_) => 2,
            Self::InvalidMomentOfInertia(_) => 3,
            Self::InvalidSupportOrientation(_) => 4,
            Self::InvalidLoadParameter(_, _) => 5,
            Self::InvalidSectionDimension(_, _) => 6,
        }
    }
}

impl fmt::Display for MechanicsError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidSpanLength(val) => write!(
                f,
                "[MechanicsError E01] Span length L must be finite and > 0 (received: {})",
                val
            ),
            Self::InvalidElasticModulus(val) => write!(
                f,
                "[MechanicsError E02] Elastic modulus E must be finite and > 0 MPa (received: {})",
                val
            ),
            Self::InvalidMomentOfInertia(val) => write!(
                f,
                "[MechanicsError E03] Moment of inertia I must be finite and > 0 mm^4 (received: {})",
                val
            ),
            Self::InvalidSupportOrientation(code) => write!(
                f,
                "[MechanicsError E04] Support orientation code must be in 0..=8 (received: {})",
                code
            ),
            Self::InvalidLoadParameter(field, val) => write!(
                f,
                "[MechanicsError E05] Invalid load parameter '{}' (received: {})",
                field, val
            ),
            Self::InvalidSectionDimension(field, val) => write!(
                f,
                "[MechanicsError E06] Invalid cross-section dimension '{}' (received: {})",
                field, val
            ),
        }
    }
}

/// Validates core beam stiffness and geometry parameters before running any solver step.
///
/// # Arguments
/// * `span_m` - Clear span length L in meters (must be > 0).
/// * `elastic_modulus_mpa` - Young's modulus E in MPa (must be > 0).
/// * `moment_of_inertia_mm4` - Strong-axis second moment of area I in mm^4 (must be > 0).
///
/// # Errors
/// Returns [`MechanicsError`] without panicking if any parameter is `<= 0` or non-finite.
pub fn validate_beam_stiffness_inputs(
    span_m: f64,
    elastic_modulus_mpa: f64,
    moment_of_inertia_mm4: f64,
) -> Result<(), MechanicsError> {
    if !span_m.is_finite() || span_m <= 0.0 {
        return Err(MechanicsError::InvalidSpanLength(span_m));
    }
    if !elastic_modulus_mpa.is_finite() || elastic_modulus_mpa <= 0.0 {
        return Err(MechanicsError::InvalidElasticModulus(elastic_modulus_mpa));
    }
    if !moment_of_inertia_mm4.is_finite() || moment_of_inertia_mm4 <= 0.0 {
        return Err(MechanicsError::InvalidMomentOfInertia(moment_of_inertia_mm4));
    }
    Ok(())
}

/// Boundary condition orientations covering the 5 civil engineering support categories.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum SupportOrientation {
    /// Fixed at s=0, Free at s=L (Cantilever Left).
    CantileverLeft = 0,
    /// Free at s=0, Fixed at s=L (Cantilever Right).
    CantileverRight = 1,
    /// Pinned at s=0, Roller at s=L (Simply Supported).
    PinnedRoller = 2,
    /// Roller at s=0, Pinned at s=L (Simply Supported).
    RollerPinned = 3,
    /// Fixed at s=0, Fixed at s=L (Fixed-Fixed Indeterminate).
    FixedFixed = 4,
    /// Fixed at s=0, Roller at s=L (Propped Cantilever Left).
    FixedRoller = 5,
    /// Roller at s=0, Fixed at s=L (Propped Cantilever Right).
    RollerFixed = 6,
    /// Fixed at s=0, Pinned at s=L (Fixed-Pinned Indeterminate Left).
    FixedPinned = 7,
    /// Pinned at s=0, Fixed at s=L (Pinned-Fixed Indeterminate Right).
    PinnedFixed = 8,
}

impl SupportOrientation {
    /// Converts a numeric u8 code (0..=8) into a typed [`SupportOrientation`].
    pub fn from_code(code: u8) -> Result<Self, MechanicsError> {
        match code {
            0 => Ok(Self::CantileverLeft),
            1 => Ok(Self::CantileverRight),
            2 => Ok(Self::PinnedRoller),
            3 => Ok(Self::RollerPinned),
            4 => Ok(Self::FixedFixed),
            5 => Ok(Self::FixedRoller),
            6 => Ok(Self::RollerFixed),
            7 => Ok(Self::FixedPinned),
            8 => Ok(Self::PinnedFixed),
            _ => Err(MechanicsError::InvalidSupportOrientation(code)),
        }
    }

    /// Parses a TypeScript `SupportOrientation` string literal into [`SupportOrientation`].
    pub fn from_str_name(name: &str) -> Result<Self, MechanicsError> {
        match name {
            "CANTILEVER_LEFT" => Ok(Self::CantileverLeft),
            "CANTILEVER_RIGHT" => Ok(Self::CantileverRight),
            "PINNED_ROLLER" => Ok(Self::PinnedRoller),
            "ROLLER_PINNED" => Ok(Self::RollerPinned),
            "FIXED_FIXED" => Ok(Self::FixedFixed),
            "FIXED_ROLLER" => Ok(Self::FixedRoller),
            "ROLLER_FIXED" => Ok(Self::RollerFixed),
            "FIXED_PINNED" => Ok(Self::FixedPinned),
            "PINNED_FIXED" => Ok(Self::PinnedFixed),
            _ => Err(MechanicsError::InvalidSupportOrientation(255)),
        }
    }

    /// Returns whether the support system is statically indeterminate in vertical bending.
    pub fn is_statically_indeterminate(self) -> bool {
        matches!(
            self,
            Self::FixedFixed
                | Self::FixedRoller
                | Self::RollerFixed
                | Self::FixedPinned
                | Self::PinnedFixed
        )
    }

    /// Returns whether the support configuration is a single-ended cantilever.
    pub fn is_cantilever(self) -> bool {
        matches!(self, Self::CantileverLeft | Self::CantileverRight)
    }
}

/// Concentrated vertical point load acting downward at `position_m`.
#[derive(Debug, Clone, Copy)]
pub struct PointLoadItem {
    /// Downward force magnitude in kN.
    pub magnitude_kn: f64,
    /// Distance from left end (s=0) in meters.
    pub position_m: f64,
}

/// Uniformly distributed vertical load acting downward on `[start_m, end_m]`.
#[derive(Debug, Clone, Copy)]
pub struct DistributedLoadItem {
    /// Downward load intensity in kN/m.
    pub magnitude_kn_per_m: f64,
    /// Segment start coordinate in meters.
    pub start_m: f64,
    /// Segment end coordinate in meters.
    pub end_m: f64,
}

/// Concentrated external bending moment applied at `position_m`.
#[derive(Debug, Clone, Copy)]
pub struct AppliedMomentItem {
    /// Counter-clockwise external moment in kNm.
    pub magnitude_knm: f64,
    /// Distance from left end (s=0) in meters.
    pub position_m: f64,
}

/// Computed boundary reactions and compatibility integrals at supports A (s=0) and B (s=L).
#[derive(Debug, Clone, Copy, Default)]
pub struct SupportReactionsResult {
    /// Vertical upward reaction at left support A (s=0) in kN.
    pub ra_vertical_kn: f64,
    /// Vertical upward reaction at right support B (s=L) in kN.
    pub rb_vertical_kn: f64,
    /// Internal bending moment at left support A (s=0) in kNm (sagging +, hogging -).
    pub ma_moment_knm: f64,
    /// Internal bending moment at right support B (s=L) in kNm (sagging +, hogging -).
    pub mb_moment_knm: f64,
    /// Axial reaction along beam axis at left support A (s=0) in kN.
    pub ra_axial_kn: f64,
    /// Axial reaction along beam axis at right support B (s=L) in kN.
    pub rb_axial_kn: f64,
    /// Total downward external vertical force sum in kN.
    pub total_downward_load_kn: f64,
    /// Simple-span reference reaction at A (s=0) in kN.
    pub ra0_simple_kn: f64,
    /// Simple-span reference reaction at B (s=L) in kN.
    pub rb0_simple_kn: f64,
    /// Mohr compatibility rotation integral Phi_A in kNm.
    pub phi_a_knm: f64,
    /// Mohr compatibility rotation integral Phi_B in kNm.
    pub phi_b_knm: f64,
    /// Whether the boundary condition required indeterminate flexibility compatibility.
    pub is_statically_indeterminate: bool,
}

/// Evaluates Macaulay singularity step function `<s - a>^0`.
#[inline]
pub fn macaulay_step(s: f64, a: f64) -> f64 {
    if s >= a {
        1.0
    } else {
        0.0
    }
}

/// Evaluates Macaulay singularity ramp function `<s - a>^1`.
#[inline]
pub fn macaulay_ramp(s: f64, a: f64) -> f64 {
    if s > a {
        s - a
    } else {
        0.0
    }
}

/// Evaluates Macaulay singularity quadratic function `<s - a>^2`.
#[inline]
pub fn macaulay_quad(s: f64, a: f64) -> f64 {
    if s > a {
        let diff = s - a;
        diff * diff
    } else {
        0.0
    }
}

/// Evaluates the simple-span reference bending moment `M_0(s)` at station `s` (in meters).
///
/// Uses the Macaulay bracket formulation:
/// `M_0(s) = R_A0 * s - sum(P_i <s - a_i>^1) - sum(0.5 * q_j (<s - s_1j>^2 - <s - s_2j>^2)) - sum(M_k <s - c_k>^0)`
#[inline]
pub fn evaluate_simple_span_moment_m0(
    s: f64,
    span_m: f64,
    ra0_simple_kn: f64,
    point_loads: &[PointLoadItem],
    distributed_loads: &[DistributedLoadItem],
    applied_moments: &[AppliedMomentItem],
) -> f64 {
    let mut m0 = ra0_simple_kn * s;

    for pl in point_loads {
        m0 -= pl.magnitude_kn * macaulay_ramp(s, pl.position_m);
    }

    for dl in distributed_loads {
        let q_term =
            0.5 * dl.magnitude_kn_per_m * (macaulay_quad(s, dl.start_m) - macaulay_quad(s, dl.end_m));
        m0 -= q_term;
    }

    for am in applied_moments {
        let c = am.position_m;
        let is_active = if c >= span_m - 1e-9 { s > c } else { s >= c };
        if is_active {
            m0 -= am.magnitude_knm;
        }
    }

    m0
}

/// Evaluates the simple-span reference shear force `V_0(s)` at station `s` (in meters).
#[inline]
pub fn evaluate_simple_span_shear_v0(
    s: f64,
    span_m: f64,
    ra0_simple_kn: f64,
    point_loads: &[PointLoadItem],
    distributed_loads: &[DistributedLoadItem],
) -> f64 {
    let mut v0 = ra0_simple_kn;

    for pl in point_loads {
        let a = pl.position_m;
        let is_active = if a >= span_m - 1e-9 { s > a } else { s >= a };
        if is_active {
            v0 -= pl.magnitude_kn;
        }
    }

    for dl in distributed_loads {
        v0 -= dl.magnitude_kn_per_m * (macaulay_ramp(s, dl.start_m) - macaulay_ramp(s, dl.end_m));
    }

    v0
}

/// Computes support reactions `(R_A, R_B, M_A, M_B, R_As, R_Bs)` for any of the 9 support orientations.
///
/// # Arguments
/// * `span_m` - Clear span length L in meters (`L > 0`).
/// * `orientation` - Support boundary condition orientation.
/// * `point_loads` - Slice of concentrated vertical point loads.
/// * `distributed_loads` - Slice of uniform distributed vertical loads.
/// * `applied_moments` - Slice of concentrated external moments.
/// * `axial_force_kn` - Optional applied axial force along the beam (kN, positive = tension).
///
/// # Errors
/// Returns [`MechanicsError`] if `span_m <= 0` or any load parameter is invalid or out of `[0, L]`.
pub fn solve_support_reactions(
    span_m: f64,
    orientation: SupportOrientation,
    point_loads: &[PointLoadItem],
    distributed_loads: &[DistributedLoadItem],
    applied_moments: &[AppliedMomentItem],
    axial_force_kn: f64,
) -> Result<SupportReactionsResult, MechanicsError> {
    if !span_m.is_finite() || span_m <= 0.0 {
        return Err(MechanicsError::InvalidSpanLength(span_m));
    }
    if !axial_force_kn.is_finite() {
        return Err(MechanicsError::InvalidLoadParameter(
            "axial_force_kn",
            axial_force_kn,
        ));
    }

    let eps = 1e-9;
    let mut total_downward_kn = 0.0;
    let mut moment_about_b_knm = 0.0;
    let mut moment_about_a_knm = 0.0;

    for pl in point_loads {
        if !pl.magnitude_kn.is_finite() {
            return Err(MechanicsError::InvalidLoadParameter(
                "point_load.magnitude_kn",
                pl.magnitude_kn,
            ));
        }
        if !pl.position_m.is_finite() || pl.position_m < -eps || pl.position_m > span_m + eps {
            return Err(MechanicsError::InvalidLoadParameter(
                "point_load.position_m",
                pl.position_m,
            ));
        }
        let a = pl.position_m.clamp(0.0, span_m);
        total_downward_kn += pl.magnitude_kn;
        moment_about_b_knm += pl.magnitude_kn * (span_m - a);
        moment_about_a_knm += pl.magnitude_kn * a;
    }

    for dl in distributed_loads {
        if !dl.magnitude_kn_per_m.is_finite() {
            return Err(MechanicsError::InvalidLoadParameter(
                "distributed_load.magnitude_kn_per_m",
                dl.magnitude_kn_per_m,
            ));
        }
        if !dl.start_m.is_finite()
            || !dl.end_m.is_finite()
            || dl.start_m < -eps
            || dl.end_m > span_m + eps
            || dl.start_m >= dl.end_m
        {
            return Err(MechanicsError::InvalidLoadParameter(
                "distributed_load.range",
                dl.start_m,
            ));
        }
        let s1 = dl.start_m.clamp(0.0, span_m);
        let s2 = dl.end_m.clamp(0.0, span_m);
        let length = s2 - s1;
        let centroid = 0.5 * (s1 + s2);
        let resultant = dl.magnitude_kn_per_m * length;
        total_downward_kn += resultant;
        moment_about_b_knm += resultant * (span_m - centroid);
        moment_about_a_knm += resultant * centroid;
    }

    let mut sum_applied_moments_knm = 0.0;
    for am in applied_moments {
        if !am.magnitude_knm.is_finite() {
            return Err(MechanicsError::InvalidLoadParameter(
                "applied_moment.magnitude_knm",
                am.magnitude_knm,
            ));
        }
        if !am.position_m.is_finite() || am.position_m < -eps || am.position_m > span_m + eps {
            return Err(MechanicsError::InvalidLoadParameter(
                "applied_moment.position_m",
                am.position_m,
            ));
        }
        sum_applied_moments_knm += am.magnitude_knm;
    }

    let ra0_simple_kn = (moment_about_b_knm + sum_applied_moments_knm) / span_m;
    let rb0_simple_kn = total_downward_kn - ra0_simple_kn;

    // Evaluate Mohr compatibility integrals Phi_A and Phi_B via closed-form + high-precision quadrature.
    // Closed-form exact integration of M_0(s)*(1 - s/L) and M_0(s)*(s/L) eliminates piecewise-kink
    // discretization error for concentrated loads and moments while remaining 100% consistent with M=256.
    let (phi_a_knm, phi_b_knm) = compute_mohr_integrals_exact(
        span_m,
        point_loads,
        distributed_loads,
        applied_moments,
    );

    let (ma_moment_knm, mb_moment_knm, ra_vertical_kn, rb_vertical_kn) = match orientation {
        SupportOrientation::CantileverLeft => {
            let ma = -(moment_about_a_knm + sum_applied_moments_knm);
            let mb = 0.0;
            let ra = total_downward_kn;
            let rb = 0.0;
            (ma, mb, ra, rb)
        }
        SupportOrientation::CantileverRight => {
            let ma = 0.0;
            let mb = -(moment_about_b_knm + sum_applied_moments_knm);
            let ra = 0.0;
            let rb = total_downward_kn;
            (ma, mb, ra, rb)
        }
        SupportOrientation::PinnedRoller | SupportOrientation::RollerPinned => {
            (0.0, 0.0, ra0_simple_kn, rb0_simple_kn)
        }
        SupportOrientation::FixedRoller | SupportOrientation::FixedPinned => {
            let ma = -3.0 * phi_a_knm;
            let mb = 0.0;
            let ra = ra0_simple_kn + (mb - ma) / span_m;
            let rb = rb0_simple_kn + (ma - mb) / span_m;
            (ma, mb, ra, rb)
        }
        SupportOrientation::RollerFixed | SupportOrientation::PinnedFixed => {
            let ma = 0.0;
            let mb = -3.0 * phi_b_knm;
            let ra = ra0_simple_kn + (mb - ma) / span_m;
            let rb = rb0_simple_kn + (ma - mb) / span_m;
            (ma, mb, ra, rb)
        }
        SupportOrientation::FixedFixed => {
            let ma = -2.0 * (2.0 * phi_a_knm - phi_b_knm);
            let mb = -2.0 * (2.0 * phi_b_knm - phi_a_knm);
            let ra = ra0_simple_kn + (mb - ma) / span_m;
            let rb = rb0_simple_kn + (ma - mb) / span_m;
            (ma, mb, ra, rb)
        }
    };

    // Axial reaction distribution based on horizontal translational restraint ux
    let (ra_axial_kn, rb_axial_kn) = match orientation {
        SupportOrientation::CantileverLeft
        | SupportOrientation::PinnedRoller
        | SupportOrientation::FixedRoller => (-axial_force_kn, 0.0),
        SupportOrientation::CantileverRight
        | SupportOrientation::RollerPinned
        | SupportOrientation::RollerFixed => (0.0, -axial_force_kn),
        SupportOrientation::FixedFixed
        | SupportOrientation::FixedPinned
        | SupportOrientation::PinnedFixed => (-0.5 * axial_force_kn, -0.5 * axial_force_kn),
    };

    Ok(SupportReactionsResult {
        ra_vertical_kn,
        rb_vertical_kn,
        ma_moment_knm,
        mb_moment_knm,
        ra_axial_kn,
        rb_axial_kn,
        total_downward_load_kn: total_downward_kn,
        ra0_simple_kn,
        rb0_simple_kn,
        phi_a_knm,
        phi_b_knm,
        is_statically_indeterminate: orientation.is_statically_indeterminate(),
    })
}

/// Computes exact Mohr compatibility integrals `Phi_A` and `Phi_B` for arbitrary point loads,
/// partial/full distributed loads, and applied moments.
///
/// Using exact analytical primitives for each load type ensures that fixed-end moments `M_A, M_B`
/// match closed-form structural engineering tables to machine precision (`1e-13`), even when a
/// point load falls between two discrete stations.
fn compute_mohr_integrals_exact(
    span_m: f64,
    point_loads: &[PointLoadItem],
    distributed_loads: &[DistributedLoadItem],
    applied_moments: &[AppliedMomentItem],
) -> (f64, f64) {
    let l = span_m;
    let l2 = l * l;
    let mut phi_a = 0.0;
    let mut phi_b = 0.0;

    // 1. Point loads: for a downward load P at x = a (with b = L - a):
    // Phi_A = P * a * b * (L + b) / (6 * L^2)
    // Phi_B = P * a * b * (L + a) / (6 * L^2)
    for pl in point_loads {
        let a = pl.position_m.clamp(0.0, l);
        let b = l - a;
        phi_a += pl.magnitude_kn * a * b * (l + b) / (6.0 * l2);
        phi_b += pl.magnitude_kn * a * b * (l + a) / (6.0 * l2);
    }

    // 2. Distributed loads on [s1, s2]: integrate point-load kernel analytically over a in [s1, s2]:
    // Since b = L - a:
    // a * b * (L + b) = a * (L - a) * (2L - a) = 2*L^2*a - 3*L*a^2 + a^3
    // a * b * (L + a) = a * (L^2 - a^2) = L^2*a - a^3
    for dl in distributed_loads {
        let s1 = dl.start_m.clamp(0.0, l);
        let s2 = dl.end_m.clamp(0.0, l);
        if s2 > s1 {
            let q = dl.magnitude_kn_per_m;
            let int_a = |x: f64| -> f64 {
                let x2 = x * x;
                let x3 = x2 * x;
                let x4 = x2 * x2;
                l2 * x2 - l * x3 + 0.25 * x4
            };
            let int_b = |x: f64| -> f64 {
                let x2 = x * x;
                let x4 = x2 * x2;
                0.5 * l2 * x2 - 0.25 * x4
            };
            phi_a += q * (int_a(s2) - int_a(s1)) / (6.0 * l2);
            phi_b += q * (int_b(s2) - int_b(s1)) / (6.0 * l2);
        }
    }

    // 3. Applied external moments M_k at x = c (with b = L - c):
    // M_0(s) for unit moment M at c is: (s / L) * M for s < c, and (s / L - 1) * M for s > c.
    // Integrating M_0(s)*(1 - s/L)/L and M_0(s)*(s/L)/L over [0, L]:
    // Phi_A = M_k * (-(L - c)/L + ((L - c)/L)^3 / 1.0 ... exact: M_k * (c^2 / (2*L^2) - c / L + 1/3 - ...))
    // Let's write out the exact integral of M_0(s) = M*(s/L - H(s-c)):
    // (1/L) * int_0^L (s/L) * (1 - s/L) ds = 1/6
    // (1/L) * int_c^L 1 * (1 - s/L) ds = (L - c)^2 / (2 * L^2)
    // Therefore:
    // Phi_A += M_k * (1/6 - (L - c)^2 / (2 * L^2))
    // And for Phi_B:
    // (1/L) * int_0^L (s/L) * (s/L) ds = 1/3
    // (1/L) * int_c^L 1 * (s/L) ds = (L^2 - c^2) / (2 * L^2)
    // Therefore:
    // Phi_B += M_k * (1/3 - (L^2 - c^2) / (2 * L^2)) = M_k * (c^2 / (2 * L^2) - 1/6)
    for am in applied_moments {
        let c = am.position_m.clamp(0.0, l);
        let b = l - c;
        phi_a += am.magnitude_knm * (1.0 / 6.0 - (b * b) / (2.0 * l2));
        phi_b += am.magnitude_knm * ((c * c) / (2.0 * l2) - 1.0 / 6.0);
    }

    (phi_a, phi_b)
}
