import { describe, expect, it } from "bun:test";

import React from "react";
import { renderToString } from "react-dom/server";

import {
  buildCameraMatrices,
  computeOrbitCameraBasis,
  type OrbitCameraState,
  projectWorldToScreen,
  resolveUpVector,
  type Vec3Tuple,
  type ViewportProjectionSnapshot,
} from "@/components/canvas/Beam3DExtrudedViewport";
import {
  buildProjectedDiagram3D,
  createBeamDiagramProjector,
  downsampleDiagramIndices,
  MultiModeDiagram2DOverlay,
} from "@/components/canvas/MultiModeDiagram2DOverlay";
import type { ZeroCopyStationViews } from "@/core/mechanics/wasm-mechanics-bridge";
import type { CoordinateSystemMode } from "@/types/branded-units";

function buildSnapshot(options: {
  coordinateMode: CoordinateSystemMode;
  preset: "ISOMETRIC_3D" | "FRONT_2D";
  spanMm?: number;
  halfHeightMm?: number;
  widthCss?: number;
  heightCss?: number;
}): ViewportProjectionSnapshot {
  const {
    coordinateMode,
    preset,
    spanMm = 6_000,
    halfHeightMm = 150,
    widthCss = 1280,
    heightCss = 720,
  } = options;

  const up = resolveUpVector(coordinateMode);
  const basis = computeOrbitCameraBasis(up, [1, 0, 0]);
  const center: Vec3Tuple = [spanMm * 0.5, 0, 0];
  const beamTopAWorld: Vec3Tuple = [
    up[0] * halfHeightMm,
    up[1] * halfHeightMm,
    up[2] * halfHeightMm,
  ];
  const beamTopBWorld: Vec3Tuple = [
    spanMm + up[0] * halfHeightMm,
    up[1] * halfHeightMm,
    up[2] * halfHeightMm,
  ];

  const camera: OrbitCameraState =
    preset === "ISOMETRIC_3D"
      ? {
          target: center,
          distance: 10_500,
          yaw: -0.62,
          pitch: 0.42,
          orthographic: false,
          preset: "ISOMETRIC_3D",
        }
      : {
          target: center,
          distance: 10_500,
          yaw: 0,
          pitch: 0,
          orthographic: true,
          preset: "FRONT_2D",
        };

  const matrices = {
    view: new Float32Array(16),
    projection: new Float32Array(16),
    viewProjection: new Float32Array(16),
  };
  const { halfHeight } = buildCameraMatrices(camera, basis, widthCss / heightCss, 3_200, matrices);

  return {
    viewProjection: new Float32Array(matrices.viewProjection),
    widthCss,
    heightCss,
    isOrthographic: camera.orthographic,
    worldUnitsPerPixel: (2 * halfHeight) / heightCss,
    cameraPreset: preset,
    endAScreen: projectWorldToScreen(matrices.viewProjection, [0, 0, 0], widthCss, heightCss),
    endBScreen: projectWorldToScreen(matrices.viewProjection, [spanMm, 0, 0], widthCss, heightCss),
    worldUp: up,
    beamTopAWorld,
    beamTopBWorld,
  };
}

function makeMockStationViews(count = 256, spanM = 6): ZeroCopyStationViews {
  const stationsM = new Float64Array(count);
  const shearForceKn = new Float64Array(count);
  const normalForceKn = new Float64Array(count);
  const bendingMomentMajorKnm = new Float64Array(count);
  const bendingMomentMinorKnm = new Float64Array(count);
  const torsionMomentKnm = new Float64Array(count);
  const curvaturePerMm = new Float64Array(count);
  const rotationRad = new Float64Array(count);
  const deflectionMm = new Float64Array(count);

  const q = 10; // kN/m
  for (let i = 0; i < count; i++) {
    const x = (i / (count - 1)) * spanM;
    stationsM[i] = x;
    // Linear SFD crossing zero at midspan (+30 kN -> -30 kN)
    shearForceKn[i] = q * (spanM * 0.5 - x);
    // Fixed-fixed style BMD with hogging (-30 kNm) at ends and sagging (+15 kNm) at midspan
    bendingMomentMajorKnm[i] = (q * x * (spanM - x)) / 2 - (q * spanM * spanM) / 12;
    // Constant positive axial force
    normalForceKn[i] = 12.5;
    // Linear torsion crossing zero
    torsionMomentKnm[i] = 8 * (1 - (2 * x) / spanM);
  }

  return {
    stationsPtr: 0,
    deflectionPtr: 0,
    stationsM,
    shearForceKn,
    normalForceKn,
    bendingMomentMajorKnm,
    bendingMomentMinorKnm,
    torsionMomentKnm,
    curvaturePerMm,
    rotationRad,
    deflectionMm,
  };
}

describe("MultiModeDiagram2DOverlay 3D beam-axis projection", () => {
  it("projects BMD baseline along the diagonal 3D beam endpoints in ISOMETRIC_3D (Z-Up and Y-Up)", () => {
    for (const coordinateMode of ["Z-Up", "Y-Up"] as const) {
      const snapshot = buildSnapshot({ coordinateMode, preset: "ISOMETRIC_3D" });
      const projector = createBeamDiagramProjector(
        snapshot,
        snapshot.endAScreen,
        snapshot.endBScreen,
      );
      expect(projector).not.toBeNull();

      // Beam ends in ISOMETRIC_3D must be diagonal on screen, NOT a flat horizontal line.
      expect(Math.abs(projector!.endB.y - projector!.endA.y)).toBeGreaterThan(40);
      expect(Math.abs(projector!.endB.x - projector!.endA.x)).toBeGreaterThan(150);

      // Projected centerline endpoints must align closely with the 3D beam centroid projections.
      expect(Math.abs(projector!.endA.x - snapshot.endAScreen!.x)).toBeLessThan(1.5);
      expect(Math.abs(projector!.endA.y - snapshot.endAScreen!.y)).toBeLessThan(1.5);
      expect(Math.abs(projector!.endB.x - snapshot.endBScreen!.x)).toBeLessThan(1.5);
      expect(Math.abs(projector!.endB.y - snapshot.endBScreen!.y)).toBeLessThan(1.5);

      // Positive ordinate at midspan must rise upward along 3D worldUp (~55-70px visually).
      const midBase = projector!.project(0.5, 0)!;
      const midPeak = projector!.project(0.5, projector!.peakHeightPx)!;
      const risePx = Math.hypot(midPeak.x - midBase.x, midPeak.y - midBase.y);
      expect(midPeak.y).toBeLessThan(midBase.y - 45);
      expect(risePx).toBeGreaterThan(50);
      expect(risePx).toBeLessThan(75);
    }
  });

  it("splits positive and negative regions cleanly at interpolated zero-crossings (SFD and hogging/sagging BMD)", () => {
    const snapshot = buildSnapshot({ coordinateMode: "Z-Up", preset: "ISOMETRIC_3D" });
    const projector = createBeamDiagramProjector(
      snapshot,
      snapshot.endAScreen,
      snapshot.endBScreen,
    )!;
    const views = makeMockStationViews(256, 6);

    // SFD: +30 kN at x=0 to -30 kN at x=6 -> 1 positive segment + 1 negative segment meeting at midspan.
    const sfd = buildProjectedDiagram3D("sfd", views.stationsM, views.shearForceKn, projector, 6)!;
    expect(sfd.segments).toHaveLength(2);
    expect(sfd.segments[0]!.sign).toBe("positive");
    expect(sfd.segments[1]!.sign).toBe("negative");

    const posEnd = sfd.segments[0]!.points[sfd.segments[0]!.points.length - 1]!;
    const negStart = sfd.segments[1]!.points[0]!;
    const midBaseline = projector.project(0.5, 0)!;
    expect(Math.abs(posEnd.x - negStart.x)).toBeLessThan(0.5);
    expect(Math.abs(posEnd.y - negStart.y)).toBeLessThan(0.5);
    expect(Math.abs(posEnd.x - midBaseline.x)).toBeLessThan(1.0);
    expect(Math.abs(posEnd.y - midBaseline.y)).toBeLessThan(1.0);

    // Hogging-sagging-hogging BMD: negative -> positive -> negative (3 segments).
    const bmd = buildProjectedDiagram3D(
      "bmd",
      views.stationsM,
      views.bendingMomentMajorKnm,
      projector,
      6,
    )!;
    expect(bmd.segments).toHaveLength(3);
    expect(bmd.segments.map((s) => s.sign)).toEqual(["negative", "positive", "negative"]);
    expect(bmd.positivePeak).not.toBeNull();
    expect(bmd.negativePeak).not.toBeNull();
  });

  it("downsamples dense station arrays to <= 80 points while keeping extrema and zero-crossing brackets", () => {
    const views = makeMockStationViews(512, 6);
    const indices = downsampleDiagramIndices(views.stationsM, views.shearForceKn, 80);

    expect(indices.length).toBeLessThanOrEqual(80);
    expect(indices[0]).toBe(0);
    expect(indices[indices.length - 1]).toBe(511);
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]!).toBeGreaterThan(indices[i - 1]!);
    }
  });

  it("renders all 4 diagrams (bmd, sfd, nfd, tfd) in IN_PLACE_BEAM_AXIS mode without SingleDiagramCard wrapper", () => {
    const snapshot = buildSnapshot({ coordinateMode: "Z-Up", preset: "ISOMETRIC_3D" });
    const views = makeMockStationViews(256, 6);

    const html = renderToString(
      React.createElement(MultiModeDiagram2DOverlay, {
        stationViews: views,
        displayMode: "IN_PLACE_BEAM_AXIS",
        visibility: { bmd: true, sfd: true, nfd: true, tfd: true },
        projection: snapshot,
        spanLengthM: 6,
        endAScreen: snapshot.endAScreen,
        endBScreen: snapshot.endBScreen,
      }),
    );

    expect(html).toContain('data-display-mode="IN_PLACE_BEAM_AXIS"');
    expect(html).toContain('data-diagram-baseline="true"');
    expect(html).toContain('data-diagram-key="bmd"');
    expect(html).toContain('data-diagram-key="sfd"');
    expect(html).toContain('data-diagram-key="nfd"');
    expect(html).toContain('data-diagram-key="tfd"');
    expect(html).toContain('data-diagram-pill="bmd"');
    expect(html).toContain('data-diagram-pill="sfd"');
    expect(html).toContain('data-diagram-pill="nfd"');
    expect(html).toContain('data-diagram-pill="tfd"');
    // Must NOT render the old flat rectangular HTML SingleDiagramCard box or clipPath hack.
    expect(html).not.toContain('data-component="SingleDiagramCard"');
    expect(html).not.toContain("<clipPath");
  });

  it("keeps STACKED_VERTICAL mode rendering SingleDiagramCard intact and supports fallback without projection", () => {
    const snapshot = buildSnapshot({ coordinateMode: "Z-Up", preset: "FRONT_2D" });
    const views = makeMockStationViews(128, 6);

    const stackedHtml = renderToString(
      React.createElement(MultiModeDiagram2DOverlay, {
        stationViews: views,
        displayMode: "STACKED_VERTICAL",
        visibility: { bmd: true, sfd: true, nfd: false, tfd: false },
        projection: snapshot,
        endAScreen: snapshot.endAScreen,
        endBScreen: snapshot.endBScreen,
      }),
    );

    expect(stackedHtml).toContain('data-display-mode="STACKED_VERTICAL"');
    expect(stackedHtml).toContain('data-component="SingleDiagramCard"');

    // Fallback without 3D projection snapshot still renders IN_PLACE_BEAM_AXIS cleanly.
    const fallbackHtml = renderToString(
      React.createElement(MultiModeDiagram2DOverlay, {
        stationViews: views,
        displayMode: "IN_PLACE_BEAM_AXIS",
        visibility: { bmd: true, sfd: false, nfd: false, tfd: false },
        projection: null,
        endAScreen: { x: 200, y: 420, depth: 0, insideFrustum: true },
        endBScreen: { x: 960, y: 300, depth: 0, insideFrustum: true },
      }),
    );

    expect(fallbackHtml).toContain('data-diagram-baseline="true"');
    expect(fallbackHtml).toContain('data-diagram-key="bmd"');
    expect(fallbackHtml).not.toContain('data-component="SingleDiagramCard"');
  });
});
