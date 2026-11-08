//! 3D cross-section mesh extruder with rigid parallel-transport sweep, 4-segment IWF root fillets,
//! guaranteed Counter-Clockwise (CCW) triangle winding, dynamic XYZ axis permutation, and SAP2000
//! deflection contour coloring.

use std::f64::consts::FRAC_PI_2;

use crate::supports::{MechanicsError, STATION_COUNT};

/// Number of angular subdivisions per 90-degree root fillet arc on IWF steel profiles.
pub const IWF_FILLET_SEGMENTS: usize = 4;

/// Number of perimeter vertices in a 2D IWF cross-section with 4-segment root fillets:
/// 8 straight flange corners + 4 fillets * (4 + 1) vertices = 28 vertices.
pub const IWF_PERIMETER_VERTEX_COUNT: usize = 8 + 4 * (IWF_FILLET_SEGMENTS + 1);

/// Cross-section profile types supported by the 3D mesh extruder.
#[derive(Debug, Clone, Copy)]
pub enum CrossSectionProfile {
    /// Hot-rolled Wide Flange / I-Beam (IWF / H-Beam) with root fillets.
    Iwf {
        /// Total depth d in mm.
        d_mm: f64,
        /// Flange width b_f in mm.
        bf_mm: f64,
        /// Web thickness t_w in mm.
        tw_mm: f64,
        /// Flange thickness t_f in mm.
        tf_mm: f64,
        /// Root fillet radius r in mm.
        r_mm: f64,
    },
    /// Hollow Structural Section (Box / Rectangular Tube).
    BoxHss {
        /// Total outer height H in mm.
        h_mm: f64,
        /// Total outer width B in mm.
        b_mm: f64,
        /// Wall thickness t in mm.
        t_mm: f64,
    },
    /// Solid Rectangular Reinforced Concrete Beam section.
    RectangularConcrete {
        /// Web width b_w in mm.
        bw_mm: f64,
        /// Total depth h in mm.
        h_mm: f64,
    },
}

impl CrossSectionProfile {
    /// Validates cross-section dimensions before generating 2D contours or 3D meshes.
    pub fn validate(&self) -> Result<(), MechanicsError> {
        match *self {
            Self::Iwf {
                d_mm,
                bf_mm,
                tw_mm,
                tf_mm,
                r_mm,
            } => {
                if !d_mm.is_finite() || d_mm <= 0.0 {
                    return Err(MechanicsError::InvalidSectionDimension("d_mm", d_mm));
                }
                if !bf_mm.is_finite() || bf_mm <= 0.0 {
                    return Err(MechanicsError::InvalidSectionDimension("bf_mm", bf_mm));
                }
                if !tw_mm.is_finite() || tw_mm <= 0.0 || tw_mm >= bf_mm {
                    return Err(MechanicsError::InvalidSectionDimension("tw_mm", tw_mm));
                }
                if !tf_mm.is_finite() || tf_mm <= 0.0 || 2.0 * tf_mm >= d_mm {
                    return Err(MechanicsError::InvalidSectionDimension("tf_mm", tf_mm));
                }
                if !r_mm.is_finite() || r_mm < 0.0 {
                    return Err(MechanicsError::InvalidSectionDimension("r_mm", r_mm));
                }
                Ok(())
            }
            Self::BoxHss { h_mm, b_mm, t_mm } => {
                if !h_mm.is_finite() || h_mm <= 0.0 {
                    return Err(MechanicsError::InvalidSectionDimension("h_mm", h_mm));
                }
                if !b_mm.is_finite() || b_mm <= 0.0 {
                    return Err(MechanicsError::InvalidSectionDimension("b_mm", b_mm));
                }
                if !t_mm.is_finite() || t_mm <= 0.0 || 2.0 * t_mm >= h_mm.min(b_mm) {
                    return Err(MechanicsError::InvalidSectionDimension("t_mm", t_mm));
                }
                Ok(())
            }
            Self::RectangularConcrete { bw_mm, h_mm } => {
                if !bw_mm.is_finite() || bw_mm <= 0.0 {
                    return Err(MechanicsError::InvalidSectionDimension("bw_mm", bw_mm));
                }
                if !h_mm.is_finite() || h_mm <= 0.0 {
                    return Err(MechanicsError::InvalidSectionDimension("h_mm", h_mm));
                }
                Ok(())
            }
        }
    }
}

/// Generates the 28-vertex Counter-Clockwise (CCW) 2D contour `(u_sec, v_sec)` for an IWF section,
/// subdividing each of the 4 root fillet arcs (`r_mm`) into exactly [`IWF_FILLET_SEGMENTS`] = 4 segments.
pub fn build_iwf_ccw_contour_28(
    d_mm: f64,
    bf_mm: f64,
    tw_mm: f64,
    tf_mm: f64,
    r_mm: f64,
) -> [(f64, f64); IWF_PERIMETER_VERTEX_COUNT] {
    let half_d = 0.5 * d_mm;
    let half_bf = 0.5 * bf_mm;
    let half_tw = 0.5 * tw_mm;
    let inner_v = half_d - tf_mm;

    // Clamp fillet radius to available geometric clearance so contour never self-intersects
    let max_r = (half_bf - half_tw)
        .min(inner_v)
        .max(0.0)
        * 0.95;
    let r = r_mm.clamp(0.0, max_r);

    let mut pts = [(0.0_f64, 0.0_f64); IWF_PERIMETER_VERTEX_COUNT];
    let mut idx = 0;

    // 1. Top flange outer corners (right to left for CCW in (u, v))
    pts[idx] = (half_bf, half_d);
    idx += 1;
    pts[idx] = (-half_bf, half_d);
    idx += 1;

    // 2. Top-left flange underside outer corner
    pts[idx] = (-half_bf, inner_v);
    idx += 1;

    // 3. Top-left root fillet arc (center at (-half_tw - r, inner_v - r), angle pi/2 -> 0)
    let tl_cu = -half_tw - r;
    let tl_cv = inner_v - r;
    for seg in 0..=IWF_FILLET_SEGMENTS {
        let t = (seg as f64) / (IWF_FILLET_SEGMENTS as f64);
        let angle = FRAC_PI_2 * (1.0 - t);
        pts[idx] = (tl_cu + r * angle.cos(), tl_cv + r * angle.sin());
        idx += 1;
    }

    // 4. Bottom-left root fillet arc (center at (-half_tw - r, -inner_v + r), angle 0 -> -pi/2)
    let bl_cu = -half_tw - r;
    let bl_cv = -inner_v + r;
    for seg in 0..=IWF_FILLET_SEGMENTS {
        let t = (seg as f64) / (IWF_FILLET_SEGMENTS as f64);
        let angle = -FRAC_PI_2 * t;
        pts[idx] = (bl_cu + r * angle.cos(), bl_cv + r * angle.sin());
        idx += 1;
    }

    // 5. Bottom-left flange topside outer corner
    pts[idx] = (-half_bf, -inner_v);
    idx += 1;

    // 6. Bottom flange outer corners (left to right)
    pts[idx] = (-half_bf, -half_d);
    idx += 1;
    pts[idx] = (half_bf, -half_d);
    idx += 1;

    // 7. Bottom-right flange topside outer corner
    pts[idx] = (half_bf, -inner_v);
    idx += 1;

    // 8. Bottom-right root fillet arc (center at (+half_tw + r, -inner_v + r), angle -pi/2 -> -pi)
    let br_cu = half_tw + r;
    let br_cv = -inner_v + r;
    for seg in 0..=IWF_FILLET_SEGMENTS {
        let t = (seg as f64) / (IWF_FILLET_SEGMENTS as f64);
        let angle = -FRAC_PI_2 * (1.0 + t);
        pts[idx] = (br_cu + r * angle.cos(), br_cv + r * angle.sin());
        idx += 1;
    }

    // 9. Top-right root fillet arc (center at (+half_tw + r, +inner_v - r), angle pi -> pi/2)
    let tr_cu = half_tw + r;
    let tr_cv = inner_v - r;
    for seg in 0..=IWF_FILLET_SEGMENTS {
        let t = (seg as f64) / (IWF_FILLET_SEGMENTS as f64);
        let angle = FRAC_PI_2 * (2.0 - t);
        pts[idx] = (tr_cu + r * angle.cos(), tr_cv + r * angle.sin());
        idx += 1;
    }

    // 10. Top-right flange underside outer corner
    pts[idx] = (half_bf, inner_v);

    pts
}

/// Evaluates the 5-stop SAP2000 RGB contour color (`[r, g, b]` in `0.0..=1.0`) for a given
/// deflection magnitude `|v_m|`, peak deflection `|Delta_max|`, and allowable limit `Delta_allow`.
///
/// Color stops per `structural_mechanics_and_deflection_solver_spec.md` §5.3:
/// - `0.00` -> Blue `#3B82F6`
/// - `0.25` -> Cyan `#06B6D4`
/// - `0.50` -> Green `#10B981`
/// - `0.75` -> Yellow `#EAB308`
/// - `>= 1.00` -> Red `#EF4444`
#[inline]
pub fn evaluate_sap2000_contour_rgb(
    abs_v_mm: f64,
    max_abs_deflection_mm: f64,
    allowable_deflection_mm: f64,
) -> [f32; 3] {
    let denom = max_abs_deflection_mm
        .max(allowable_deflection_mm)
        .max(1e-6);
    let ratio = (abs_v_mm / denom).clamp(0.0, 1.5);

    const STOPS: [(f64, [f64; 3]); 5] = [
        (0.00, [0.231, 0.510, 0.965]), // #3B82F6 Blue
        (0.25, [0.024, 0.714, 0.831]), // #06B6D4 Cyan
        (0.50, [0.063, 0.725, 0.506]), // #10B981 Green
        (0.75, [0.918, 0.702, 0.031]), // #EAB308 Yellow
        (1.00, [0.937, 0.267, 0.267]), // #EF4444 Red
    ];

    if ratio >= 1.0 {
        return [
            STOPS[4].1[0] as f32,
            STOPS[4].1[1] as f32,
            STOPS[4].1[2] as f32,
        ];
    }

    for i in 0..4 {
        let (t0, c0) = STOPS[i];
        let (t1, c1) = STOPS[i + 1];
        if ratio >= t0 && ratio <= t1 {
            let alpha = (ratio - t0) / (t1 - t0);
            return [
                (c0[0] + alpha * (c1[0] - c0[0])) as f32,
                (c0[1] + alpha * (c1[1] - c0[1])) as f32,
                (c0[2] + alpha * (c1[2] - c0[2])) as f32,
            ];
        }
    }

    [
        STOPS[0].1[0] as f32,
        STOPS[0].1[1] as f32,
        STOPS[0].1[2] as f32,
    ]
}

#[inline]
fn apply_axis_matrix(s: f64, u: f64, v: f64, axis_matrix: &[f64; 9]) -> [f32; 3] {
    let x = axis_matrix[0] * s + axis_matrix[1] * u + axis_matrix[2] * v;
    let y = axis_matrix[3] * s + axis_matrix[4] * u + axis_matrix[5] * v;
    let z = axis_matrix[6] * s + axis_matrix[7] * u + axis_matrix[8] * v;
    [x as f32, y as f32, z as f32]
}

#[inline]
fn cross_f32(a: [f32; 3], b: [f32; 3]) -> [f32; 3] {
    [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]
}

#[inline]
fn sub_f32(a: [f32; 3], b: [f32; 3]) -> [f32; 3] {
    [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

#[inline]
fn dot_f32(a: [f32; 3], b: [f32; 3]) -> f32 {
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

#[inline]
fn normalize_f32(v: [f32; 3]) -> [f32; 3] {
    let len = (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]).sqrt();
    if len > 1e-12 {
        [v[0] / len, v[1] / len, v[2] / len]
    } else {
        [0.0, 0.0, 1.0]
    }
}

/// Pushes a single triangle `(i0, i1, i2)` into `indices_u32`, automatically enforcing
/// Counter-Clockwise (CCW) vertex winding with respect to the true outward normal `expected_normal`.
#[inline]
fn push_ccw_triangle(
    positions_f32: &[f32],
    indices_u32: &mut Vec<u32>,
    i0: u32,
    i1: u32,
    i2: u32,
    expected_normal: [f32; 3],
) {
    let b0 = (i0 as usize) * 3;
    let b1 = (i1 as usize) * 3;
    let b2 = (i2 as usize) * 3;
    let p0 = [
        positions_f32[b0],
        positions_f32[b0 + 1],
        positions_f32[b0 + 2],
    ];
    let p1 = [
        positions_f32[b1],
        positions_f32[b1 + 1],
        positions_f32[b1 + 2],
    ];
    let p2 = [
        positions_f32[b2],
        positions_f32[b2 + 1],
        positions_f32[b2 + 2],
    ];

    let geom_normal = cross_f32(sub_f32(p1, p0), sub_f32(p2, p0));
    if dot_f32(geom_normal, expected_normal) < 0.0 {
        indices_u32.push(i0);
        indices_u32.push(i2);
        indices_u32.push(i1);
    } else {
        indices_u32.push(i0);
        indices_u32.push(i1);
        indices_u32.push(i2);
    }
}

/// Ear-clipping 2D polygon triangulator for simple Counter-Clockwise (CCW) polygons `(u, v)`.
/// Produces `K - 2` non-overlapping triangles without introducing Steiner vertices.
fn triangulate_ccw_polygon_2d(contour: &[(f64, f64)], out_triangles: &mut Vec<(usize, usize, usize)>) {
    out_triangles.clear();
    let n = contour.len();
    if n < 3 {
        return;
    }

    // Fixed-stack index list (max contour size <= 32)
    let mut active = [0usize; 32];
    let mut count = n.min(32);
    for i in 0..count {
        active[i] = i;
    }

    let cross_2d = |a: (f64, f64), b: (f64, f64), c: (f64, f64)| -> f64 {
        (b.0 - a.0) * (c.1 - a.1) - (b.1 - a.1) * (c.0 - a.0)
    };

    let point_in_triangle = |p: (f64, f64), a: (f64, f64), b: (f64, f64), c: (f64, f64)| -> bool {
        let c1 = cross_2d(a, b, p);
        let c2 = cross_2d(b, c, p);
        let c3 = cross_2d(c, a, p);
        let eps = -1e-9;
        c1 >= eps && c2 >= eps && c3 >= eps
    };

    let mut guard = 0;
    while count > 3 && guard < 256 {
        guard += 1;
        let mut ear_found = false;

        for i in 0..count {
            let prev_idx = active[(i + count - 1) % count];
            let curr_idx = active[i];
            let next_idx = active[(i + 1) % count];

            let a = contour[prev_idx];
            let b = contour[curr_idx];
            let c = contour[next_idx];

            // Must be a strictly convex (CCW) corner
            if cross_2d(a, b, c) <= 1e-9 {
                continue;
            }

            let mut contains_other = false;
            for j in 0..count {
                let test_idx = active[j];
                if test_idx == prev_idx || test_idx == curr_idx || test_idx == next_idx {
                    continue;
                }
                let p = contour[test_idx];
                if (p.0 - a.0).hypot(p.1 - a.1) < 1e-8
                    || (p.0 - b.0).hypot(p.1 - b.1) < 1e-8
                    || (p.0 - c.0).hypot(p.1 - c.1) < 1e-8
                {
                    continue;
                }
                if point_in_triangle(p, a, b, c) {
                    contains_other = true;
                    break;
                }
            }

            if !contains_other {
                out_triangles.push((prev_idx, curr_idx, next_idx));
                for k in i..(count - 1) {
                    active[k] = active[k + 1];
                }
                count -= 1;
                ear_found = true;
                break;
            }
        }

        if !ear_found {
            // Fallback fan for degenerate nearly-collinear vertices
            out_triangles.push((active[0], active[1], active[2]));
            for k in 1..(count - 1) {
                active[k] = active[k + 1];
            }
            count -= 1;
        }
    }

    if count == 3 {
        out_triangles.push((active[0], active[1], active[2]));
    }
}

/// Sweeps a rigid 2D cross-section along a single closed contour loop across all 256 stations,
/// appending side wall vertices/normals/colors/indices into the pre-allocated workspace buffers.
///
/// If `outward_sign > 0.0`, the contour is an outer boundary; if `< 0.0`, it is an inner cavity wall.
#[allow(clippy::too_many_arguments)]
fn extrude_contour_side_walls(
    contour: &[(f64, f64)],
    outward_sign: f64,
    stations_m: &[f64; STATION_COUNT],
    rotation_rad: &[f64; STATION_COUNT],
    deflection_mm: &[f64; STATION_COUNT],
    station_colors: &[[f32; 3]; STATION_COUNT],
    visual_scale: f64,
    axis_matrix: &[f64; 9],
    positions_f32: &mut Vec<f32>,
    normals_f32: &mut Vec<f32>,
    colors_f32: &mut Vec<f32>,
    indices_u32: &mut Vec<u32>,
) {
    let k_len = contour.len();
    let base_vertex = (positions_f32.len() / 3) as u32;

    // Precompute smooth outward 2D vertex normals in (u, v) for each contour point
    let mut vertex_normals_2d = [(0.0_f64, 0.0_f64); 32];
    for k in 0..k_len {
        let prev = contour[(k + k_len - 1) % k_len];
        let curr = contour[k];
        let next = contour[(k + 1) % k_len];

        // For a CCW loop in (u, v), outward normal of edge (p0 -> p1) is +(dv, -du) * outward_sign
        let du1 = curr.0 - prev.0;
        let dv1 = curr.1 - prev.1;
        let len1 = du1.hypot(dv1).max(1e-12);
        let n1 = ( (dv1 / len1) * outward_sign, (-du1 / len1) * outward_sign );

        let du2 = next.0 - curr.0;
        let dv2 = next.1 - curr.1;
        let len2 = du2.hypot(dv2).max(1e-12);
        let n2 = ( (dv2 / len2) * outward_sign, (-du2 / len2) * outward_sign );

        let nu = n1.0 + n2.0;
        let nv = n1.1 + n2.1;
        let n_len = nu.hypot(nv).max(1e-12);
        vertex_normals_2d[k] = (nu / n_len, nv / n_len);
    }

    for m in 0..STATION_COUNT {
        let s_mm = stations_m[m] * 1000.0;
        let theta = rotation_rad[m];
        let sin_t = theta.sin();
        let cos_t = theta.cos();
        let v_center_mm = visual_scale * deflection_mm[m];
        let rgb = station_colors[m];

        for k in 0..k_len {
            let (u_sec, v_sec) = contour[k];
            let s_pt = s_mm - v_sec * sin_t;
            let u_pt = u_sec;
            let v_pt = v_center_mm + v_sec * cos_t;

            let pos = apply_axis_matrix(s_pt, u_pt, v_pt, axis_matrix);
            positions_f32.extend_from_slice(&pos);

            let (nu_sec, nv_sec) = vertex_normals_2d[k];
            let ns = -nv_sec * sin_t;
            let nu = nu_sec;
            let nv = nv_sec * cos_t;
            let norm = normalize_f32(apply_axis_matrix(ns, nu, nv, axis_matrix));
            normals_f32.extend_from_slice(&norm);
            colors_f32.extend_from_slice(&rgb);
        }
    }

    let k_u32 = k_len as u32;
    for m in 0..((STATION_COUNT - 1) as u32) {
        let row_curr = base_vertex + m * k_u32;
        let row_next = base_vertex + (m + 1) * k_u32;

        for k in 0..k_u32 {
            let k_next = (k + 1) % k_u32;
            let i00 = row_curr + k;
            let i10 = row_next + k;
            let i11 = row_next + k_next;
            let i01 = row_curr + k_next;

            let n_idx = (i00 as usize) * 3;
            let expected_normal = [
                normals_f32[n_idx],
                normals_f32[n_idx + 1],
                normals_f32[n_idx + 2],
            ];

            push_ccw_triangle(positions_f32, indices_u32, i00, i10, i11, expected_normal);
            push_ccw_triangle(positions_f32, indices_u32, i00, i11, i01, expected_normal);
        }
    }
}

/// Appends flat planar end-caps at `s = 0` (`m = 0`) and `s = L` (`m = M - 1`) for a solid
/// cross-section contour (IWF or Rectangular Concrete) with outward normals `mp t_m`.
#[allow(clippy::too_many_arguments)]
fn append_solid_end_caps(
    contour: &[(f64, f64)],
    cap_triangles: &[(usize, usize, usize)],
    stations_m: &[f64; STATION_COUNT],
    rotation_rad: &[f64; STATION_COUNT],
    deflection_mm: &[f64; STATION_COUNT],
    station_colors: &[[f32; 3]; STATION_COUNT],
    visual_scale: f64,
    axis_matrix: &[f64; 9],
    positions_f32: &mut Vec<f32>,
    normals_f32: &mut Vec<f32>,
    colors_f32: &mut Vec<f32>,
    indices_u32: &mut Vec<u32>,
) {
    for &(m, dir_sign) in &[(0usize, -1.0_f64), (STATION_COUNT - 1, 1.0_f64)] {
        let base_vertex = (positions_f32.len() / 3) as u32;
        let s_mm = stations_m[m] * 1000.0;
        let theta = rotation_rad[m];
        let sin_t = theta.sin();
        let cos_t = theta.cos();
        let v_center_mm = visual_scale * deflection_mm[m];
        let rgb = station_colors[m];

        // Outward tangent normal along beam axis (+/- t_m)
        let cap_normal = normalize_f32(apply_axis_matrix(
            dir_sign * cos_t,
            0.0,
            dir_sign * sin_t,
            axis_matrix,
        ));

        for &(u_sec, v_sec) in contour {
            let s_pt = s_mm - v_sec * sin_t;
            let u_pt = u_sec;
            let v_pt = v_center_mm + v_sec * cos_t;
            let pos = apply_axis_matrix(s_pt, u_pt, v_pt, axis_matrix);
            positions_f32.extend_from_slice(&pos);
            normals_f32.extend_from_slice(&cap_normal);
            colors_f32.extend_from_slice(&rgb);
        }

        for &(t0, t1, t2) in cap_triangles {
            push_ccw_triangle(
                positions_f32,
                indices_u32,
                base_vertex + (t0 as u32),
                base_vertex + (t1 as u32),
                base_vertex + (t2 as u32),
                cap_normal,
            );
        }
    }
}

/// Appends annular hollow end-caps at `s = 0` and `s = L` for a BoxHss cross-section.
#[allow(clippy::too_many_arguments)]
fn append_box_annular_end_caps(
    outer_contour: &[(f64, f64); 4],
    inner_contour: &[(f64, f64); 4],
    stations_m: &[f64; STATION_COUNT],
    rotation_rad: &[f64; STATION_COUNT],
    deflection_mm: &[f64; STATION_COUNT],
    station_colors: &[[f32; 3]; STATION_COUNT],
    visual_scale: f64,
    axis_matrix: &[f64; 9],
    positions_f32: &mut Vec<f32>,
    normals_f32: &mut Vec<f32>,
    colors_f32: &mut Vec<f32>,
    indices_u32: &mut Vec<u32>,
) {
    for &(m, dir_sign) in &[(0usize, -1.0_f64), (STATION_COUNT - 1, 1.0_f64)] {
        let base_vertex = (positions_f32.len() / 3) as u32;
        let s_mm = stations_m[m] * 1000.0;
        let theta = rotation_rad[m];
        let sin_t = theta.sin();
        let cos_t = theta.cos();
        let v_center_mm = visual_scale * deflection_mm[m];
        let rgb = station_colors[m];

        let cap_normal = normalize_f32(apply_axis_matrix(
            dir_sign * cos_t,
            0.0,
            dir_sign * sin_t,
            axis_matrix,
        ));

        for &(u_sec, v_sec) in outer_contour.iter().chain(inner_contour.iter()) {
            let s_pt = s_mm - v_sec * sin_t;
            let u_pt = u_sec;
            let v_pt = v_center_mm + v_sec * cos_t;
            let pos = apply_axis_matrix(s_pt, u_pt, v_pt, axis_matrix);
            positions_f32.extend_from_slice(&pos);
            normals_f32.extend_from_slice(&cap_normal);
            colors_f32.extend_from_slice(&rgb);
        }

        for k in 0..4u32 {
            let k_next = (k + 1) % 4;
            let o0 = base_vertex + k;
            let o1 = base_vertex + k_next;
            let i0 = base_vertex + 4 + k;
            let i1 = base_vertex + 4 + k_next;

            push_ccw_triangle(positions_f32, indices_u32, o0, o1, i1, cap_normal);
            push_ccw_triangle(positions_f32, indices_u32, o0, i1, i0, cap_normal);
        }
    }
}

/// Generates the complete 3D extruded beam mesh into pre-allocated workspace buffers (`positions_f32`,
/// `normals_f32`, `colors_f32`, `indices_u32`) without reallocating heap memory.
///
/// Guarantees:
/// - Rigid cross-section sweep (`s = s_m - v_sec * sin(theta_m)`, `v = alpha * v_m + v_sec * cos(theta_m)`).
/// - 4 subdivisions per root fillet arc on IWF profiles (`28` perimeter vertices).
/// - Counter-Clockwise (CCW) triangle winding order on every side wall and end-cap triangle.
///
/// # Errors
/// Returns [`MechanicsError`] if cross-section dimensions or scale parameters are invalid.
#[allow(clippy::too_many_arguments)]
pub fn generate_extruded_mesh_in_place(
    profile: CrossSectionProfile,
    stations_m: &[f64; STATION_COUNT],
    rotation_rad: &[f64; STATION_COUNT],
    deflection_mm: &[f64; STATION_COUNT],
    max_abs_deflection_mm: f64,
    allowable_deflection_mm: f64,
    visual_scale: f64,
    axis_matrix: &[f64; 9],
    positions_f32: &mut Vec<f32>,
    normals_f32: &mut Vec<f32>,
    colors_f32: &mut Vec<f32>,
    indices_u32: &mut Vec<u32>,
    scratch_triangles: &mut Vec<(usize, usize, usize)>,
) -> Result<(), MechanicsError> {
    profile.validate()?;
    let scale = if visual_scale.is_finite() && visual_scale >= 0.0 {
        visual_scale
    } else {
        1.0
    };

    positions_f32.clear();
    normals_f32.clear();
    colors_f32.clear();
    indices_u32.clear();

    let mut station_colors = [[0.0_f32; 3]; STATION_COUNT];
    for m in 0..STATION_COUNT {
        station_colors[m] = evaluate_sap2000_contour_rgb(
            deflection_mm[m].abs(),
            max_abs_deflection_mm,
            allowable_deflection_mm,
        );
    }

    match profile {
        CrossSectionProfile::Iwf {
            d_mm,
            bf_mm,
            tw_mm,
            tf_mm,
            r_mm,
        } => {
            let contour = build_iwf_ccw_contour_28(d_mm, bf_mm, tw_mm, tf_mm, r_mm);
            extrude_contour_side_walls(
                &contour,
                1.0,
                stations_m,
                rotation_rad,
                deflection_mm,
                &station_colors,
                scale,
                axis_matrix,
                positions_f32,
                normals_f32,
                colors_f32,
                indices_u32,
            );
            triangulate_ccw_polygon_2d(&contour, scratch_triangles);
            append_solid_end_caps(
                &contour,
                scratch_triangles,
                stations_m,
                rotation_rad,
                deflection_mm,
                &station_colors,
                scale,
                axis_matrix,
                positions_f32,
                normals_f32,
                colors_f32,
                indices_u32,
            );
        }
        CrossSectionProfile::RectangularConcrete { bw_mm, h_mm } => {
            let half_b = 0.5 * bw_mm;
            let half_h = 0.5 * h_mm;
            let contour = [
                (half_b, half_h),
                (-half_b, half_h),
                (-half_b, -half_h),
                (half_b, -half_h),
            ];
            extrude_contour_side_walls(
                &contour,
                1.0,
                stations_m,
                rotation_rad,
                deflection_mm,
                &station_colors,
                scale,
                axis_matrix,
                positions_f32,
                normals_f32,
                colors_f32,
                indices_u32,
            );
            let rect_tris = [(0, 1, 2), (0, 2, 3)];
            append_solid_end_caps(
                &contour,
                &rect_tris,
                stations_m,
                rotation_rad,
                deflection_mm,
                &station_colors,
                scale,
                axis_matrix,
                positions_f32,
                normals_f32,
                colors_f32,
                indices_u32,
            );
        }
        CrossSectionProfile::BoxHss { h_mm, b_mm, t_mm } => {
            let half_b = 0.5 * b_mm;
            let half_h = 0.5 * h_mm;
            let inner_b = half_b - t_mm;
            let inner_h = half_h - t_mm;
            let outer_contour = [
                (half_b, half_h),
                (-half_b, half_h),
                (-half_b, -half_h),
                (half_b, -half_h),
            ];
            let inner_contour = [
                (inner_b, inner_h),
                (-inner_b, inner_h),
                (-inner_b, -inner_h),
                (inner_b, -inner_h),
            ];
            extrude_contour_side_walls(
                &outer_contour,
                1.0,
                stations_m,
                rotation_rad,
                deflection_mm,
                &station_colors,
                scale,
                axis_matrix,
                positions_f32,
                normals_f32,
                colors_f32,
                indices_u32,
            );
            extrude_contour_side_walls(
                &inner_contour,
                -1.0,
                stations_m,
                rotation_rad,
                deflection_mm,
                &station_colors,
                scale,
                axis_matrix,
                positions_f32,
                normals_f32,
                colors_f32,
                indices_u32,
            );
            append_box_annular_end_caps(
                &outer_contour,
                &inner_contour,
                stations_m,
                rotation_rad,
                deflection_mm,
                &station_colors,
                scale,
                axis_matrix,
                positions_f32,
                normals_f32,
                colors_f32,
                indices_u32,
            );
        }
    }

    Ok(())
}
