//! 3D wireframe rebar cage generator for reinforced concrete beams (SNI 2847:2019),
//! sweeping longitudinal tensile/compressive bars and closed rectangular stirrups along the
//! deflected elastic curve without reallocating heap memory.

use crate::supports::{MechanicsError, STATION_COUNT};

/// Parameters defining a reinforced concrete beam's 3D rebar cage geometry.
#[derive(Debug, Clone, Copy)]
pub struct RebarCageConfig {
    /// Concrete web width b_w in mm.
    pub bw_mm: f64,
    /// Concrete total depth h in mm.
    pub h_mm: f64,
    /// Clear concrete cover c_cover in mm.
    pub cover_mm: f64,
    /// Stirrup bar diameter d_stirrup in mm.
    pub stirrup_dia_mm: f64,
    /// Stirrup center-to-center spacing s_stirrup in mm.
    pub stirrup_spacing_mm: f64,
    /// Number of bottom longitudinal tensile rebars.
    pub tensile_bar_count: usize,
    /// Diameter of bottom tensile rebars d_b in mm.
    pub tensile_bar_dia_mm: f64,
    /// Number of top longitudinal compressive / hanger rebars.
    pub compressive_bar_count: usize,
    /// Diameter of top compressive rebars in mm.
    pub compressive_bar_dia_mm: f64,
}

impl RebarCageConfig {
    /// Validates rebar cage geometric parameters.
    pub fn validate(&self) -> Result<(), MechanicsError> {
        if !self.bw_mm.is_finite() || self.bw_mm <= 0.0 {
            return Err(MechanicsError::InvalidSectionDimension("bw_mm", self.bw_mm));
        }
        if !self.h_mm.is_finite() || self.h_mm <= 0.0 {
            return Err(MechanicsError::InvalidSectionDimension("h_mm", self.h_mm));
        }
        if !self.cover_mm.is_finite() || self.cover_mm < 0.0 {
            return Err(MechanicsError::InvalidSectionDimension(
                "cover_mm",
                self.cover_mm,
            ));
        }
        if !self.stirrup_spacing_mm.is_finite() || self.stirrup_spacing_mm <= 0.0 {
            return Err(MechanicsError::InvalidSectionDimension(
                "stirrup_spacing_mm",
                self.stirrup_spacing_mm,
            ));
        }
        Ok(())
    }
}

#[inline]
fn map_point_to_world(
    s_mm: f64,
    u_sec: f64,
    v_sec: f64,
    theta_rad: f64,
    v_center_mm: f64,
    axis_matrix: &[f64; 9],
) -> [f32; 3] {
    let sin_t = theta_rad.sin();
    let cos_t = theta_rad.cos();
    let s = s_mm - v_sec * sin_t;
    let u = u_sec;
    let v = v_center_mm + v_sec * cos_t;

    let x = axis_matrix[0] * s + axis_matrix[1] * u + axis_matrix[2] * v;
    let y = axis_matrix[3] * s + axis_matrix[4] * u + axis_matrix[5] * v;
    let z = axis_matrix[6] * s + axis_matrix[7] * u + axis_matrix[8] * v;
    [x as f32, y as f32, z as f32]
}

/// Computes lateral `u_sec` coordinates for `bar_count` bars centered within `[-u_limit, +u_limit]`.
fn compute_layer_u_offsets(bar_count: usize, u_limit: f64, out_u: &mut [f64; 16]) -> usize {
    let count = bar_count.min(16);
    if count == 0 {
        return 0;
    }
    if count == 1 {
        out_u[0] = 0.0;
        return 1;
    }
    let step = (2.0 * u_limit) / ((count - 1) as f64);
    for i in 0..count {
        out_u[i] = -u_limit + (i as f64) * step;
    }
    count
}

/// Generates 3D line-segment vertices and index pairs for longitudinal rebars and closed stirrup rings
/// into pre-allocated workspace buffers (`rebar_positions_f32`, `rebar_indices_u32`).
///
/// # Errors
/// Returns [`MechanicsError`] if section or spacing dimensions are non-positive.
#[allow(clippy::too_many_arguments)]
pub fn generate_rebar_cage_in_place(
    config: RebarCageConfig,
    stations_m: &[f64; STATION_COUNT],
    rotation_rad: &[f64; STATION_COUNT],
    deflection_mm: &[f64; STATION_COUNT],
    visual_scale: f64,
    axis_matrix: &[f64; 9],
    rebar_positions_f32: &mut Vec<f32>,
    rebar_indices_u32: &mut Vec<u32>,
) -> Result<(), MechanicsError> {
    config.validate()?;
    let scale = if visual_scale.is_finite() && visual_scale >= 0.0 {
        visual_scale
    } else {
        1.0
    };

    rebar_positions_f32.clear();
    rebar_indices_u32.clear();

    let half_b = 0.5 * config.bw_mm;
    let half_h = 0.5 * config.h_mm;
    let stirrup_offset = config.cover_mm + 0.5 * config.stirrup_dia_mm;
    let stirrup_u = (half_b - stirrup_offset).max(10.0);
    let stirrup_v = (half_h - stirrup_offset).max(10.0);

    // 1. Longitudinal bottom tensile rebars
    let bot_v = -(half_h
        - config.cover_mm
        - config.stirrup_dia_mm
        - 0.5 * config.tensile_bar_dia_mm)
        .max(5.0);
    let bot_u_limit = (half_b
        - config.cover_mm
        - config.stirrup_dia_mm
        - 0.5 * config.tensile_bar_dia_mm)
        .max(5.0);
    let mut bot_u_coords = [0.0_f64; 16];
    let n_bot = compute_layer_u_offsets(config.tensile_bar_count, bot_u_limit, &mut bot_u_coords);

    for i in 0..n_bot {
        let u_sec = bot_u_coords[i];
        let base_v = (rebar_positions_f32.len() / 3) as u32;
        for m in 0..STATION_COUNT {
            let s_mm = stations_m[m] * 1000.0;
            let pos = map_point_to_world(
                s_mm,
                u_sec,
                bot_v,
                rotation_rad[m],
                scale * deflection_mm[m],
                axis_matrix,
            );
            rebar_positions_f32.extend_from_slice(&pos);
            if m > 0 {
                let curr = base_v + (m as u32);
                rebar_indices_u32.push(curr - 1);
                rebar_indices_u32.push(curr);
            }
        }
    }

    // 2. Longitudinal top compressive / hanger rebars
    let top_v = (half_h
        - config.cover_mm
        - config.stirrup_dia_mm
        - 0.5 * config.compressive_bar_dia_mm)
        .max(5.0);
    let top_u_limit = (half_b
        - config.cover_mm
        - config.stirrup_dia_mm
        - 0.5 * config.compressive_bar_dia_mm)
        .max(5.0);
    let mut top_u_coords = [0.0_f64; 16];
    let n_top = compute_layer_u_offsets(
        config.compressive_bar_count,
        top_u_limit,
        &mut top_u_coords,
    );

    for i in 0..n_top {
        let u_sec = top_u_coords[i];
        let base_v = (rebar_positions_f32.len() / 3) as u32;
        for m in 0..STATION_COUNT {
            let s_mm = stations_m[m] * 1000.0;
            let pos = map_point_to_world(
                s_mm,
                u_sec,
                top_v,
                rotation_rad[m],
                scale * deflection_mm[m],
                axis_matrix,
            );
            rebar_positions_f32.extend_from_slice(&pos);
            if m > 0 {
                let curr = base_v + (m as u32);
                rebar_indices_u32.push(curr - 1);
                rebar_indices_u32.push(curr);
            }
        }
    }

    // 3. Closed rectangular stirrup loops along the span at s_stirrup spacing
    let span_mm = stations_m[STATION_COUNT - 1] * 1000.0;
    let ds_mm = span_mm / ((STATION_COUNT - 1) as f64);
    let spacing_mm = config.stirrup_spacing_mm.max(25.0);
    let start_s_mm = config.cover_mm.min(0.25 * span_mm);
    let end_s_mm = (span_mm - start_s_mm).max(start_s_mm);

    let ring_corners = [
        (stirrup_u, stirrup_v),
        (-stirrup_u, stirrup_v),
        (-stirrup_u, -stirrup_v),
        (stirrup_u, -stirrup_v),
    ];

    let mut s_curr = start_s_mm;
    let mut max_rings = 0usize;
    while s_curr <= end_s_mm + 1e-6 && max_rings < 512 {
        max_rings += 1;
        let exact_idx = (s_curr / ds_mm).clamp(0.0, (STATION_COUNT - 1) as f64);
        let m0 = (exact_idx.floor() as usize).min(STATION_COUNT - 1);
        let m1 = (m0 + 1).min(STATION_COUNT - 1);
        let frac = exact_idx - (m0 as f64);

        let theta = rotation_rad[m0] + frac * (rotation_rad[m1] - rotation_rad[m0]);
        let defl = deflection_mm[m0] + frac * (deflection_mm[m1] - deflection_mm[m0]);
        let v_center = scale * defl;

        let base_v = (rebar_positions_f32.len() / 3) as u32;
        for &(u_sec, v_sec) in &ring_corners {
            let pos = map_point_to_world(s_curr, u_sec, v_sec, theta, v_center, axis_matrix);
            rebar_positions_f32.extend_from_slice(&pos);
        }
        rebar_indices_u32.extend_from_slice(&[
            base_v,
            base_v + 1,
            base_v + 1,
            base_v + 2,
            base_v + 2,
            base_v + 3,
            base_v + 3,
            base_v,
        ]);

        s_curr += spacing_mm;
    }

    Ok(())
}
