import { describe, expect, it } from "bun:test";

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
  computeLoadLayout,
  createBeamLoadProjector,
} from "@/components/canvas/LoadVisualization2DOverlay";
import type { DistributedLoad, PointLoad } from "@/types/beam-loading-modes";
import type {
  CoordinateSystemMode,
  Kilonewton,
  KilonewtonPerMeter,
  Meter,
} from "@/types/branded-units";

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

function makeDistributedLoad(
  id: string,
  startM: number,
  endM: number,
  magKnM: number,
): DistributedLoad {
  return {
    id,
    startPosition: startM as Meter,
    endPosition: endM as Meter,
    magnitude: magKnM as KilonewtonPerMeter,
  };
}

function makePointLoad(id: string, posM: number, magKn: number): PointLoad {
  return {
    id,
    position: posM as Meter,
    magnitude: magKn as Kilonewton,
  };
}

describe("LoadVisualization2DOverlay 3D projection & collision avoidance", () => {
  it("projects load arrows vertically along 3D world gravity in ISOMETRIC_3D (Z-Up) without sideways tilt", () => {
    const snapshot = buildSnapshot({ coordinateMode: "Z-Up", preset: "ISOMETRIC_3D" });
    const projector = createBeamLoadProjector(snapshot, snapshot.endAScreen, snapshot.endBScreen);
    expect(projector).not.toBeNull();

    const layout = computeLoadLayout(
      6,
      [makePointLoad("P1", 3, 25)],
      [makeDistributedLoad("Q1", 0, 6, 10)],
      projector!,
    );

    expect(layout.point).toHaveLength(1);
    expect(layout.distributed).toHaveLength(1);

    // Point load at midspan must point straight down along 3D gravity (not tilted sideways by beam slope).
    const p1 = layout.point[0]!;
    expect(Math.abs(p1.dirX)).toBeLessThan(0.08);
    expect(p1.dirY).toBeGreaterThan(0.99);

    // Every distributed load arrow must align with 3D vertical gravity (allowing natural 3-point perspective convergence at span ends).
    for (const arrow of layout.distributed[0]!.arrows) {
      expect(Math.abs(arrow.dirX)).toBeLessThan(0.16);
      expect(arrow.dirY).toBeGreaterThan(0.985);
    }

    // Midspan projection must match true 3D perspective projection of the top flange (accounting for foreshortening).
    const projectedMid = projector!.project(0.5, 0)!;
    const expectedMid = projectWorldToScreen(
      snapshot.viewProjection,
      [3_000, 0, 150],
      snapshot.widthCss,
      snapshot.heightCss,
    )!;
    expect(Math.abs(projectedMid.x - expectedMid.x)).toBeLessThan(0.5);
    expect(Math.abs(projectedMid.y - expectedMid.y)).toBeLessThan(0.5);
  });

  it("respects Y-Up coordinate mode in ISOMETRIC_3D and FRONT_2D", () => {
    for (const preset of ["ISOMETRIC_3D", "FRONT_2D"] as const) {
      const snapshot = buildSnapshot({ coordinateMode: "Y-Up", preset });
      const projector = createBeamLoadProjector(snapshot, snapshot.endAScreen, snapshot.endBScreen);
      expect(projector).not.toBeNull();

      const layout = computeLoadLayout(6, [makePointLoad("P1", 3, 20)], [], projector!);
      const p1 = layout.point[0]!;
      expect(p1.dirY).toBeGreaterThan(0.99);
      if (preset === "FRONT_2D") {
        expect(Math.abs(p1.dirX)).toBeLessThan(1e-4);
      }
    }
  });

  it("separates Q1 badge from P1 vertical arrow shaft and avoids P/Q badge overlap", () => {
    const snapshot = buildSnapshot({ coordinateMode: "Z-Up", preset: "ISOMETRIC_3D" });
    const projector = createBeamLoadProjector(snapshot, snapshot.endAScreen, snapshot.endBScreen)!;

    const layout = computeLoadLayout(
      6,
      [makePointLoad("P1", 3, 25)],
      [makeDistributedLoad("Q1", 0, 6, 10)],
      projector,
    );

    const q1 = layout.distributed[0]!;
    const p1 = layout.point[0]!;

    // Red P1 shaft must not slice through the orange Q1 badge.
    const shaftX = p1.end.x;
    const shaftSlicesQBadge = shaftX >= q1.labelRect.left && shaftX <= q1.labelRect.right;
    expect(shaftSlicesQBadge).toBe(false);

    // P1 badge and Q1 badge must not overlap.
    const badgesOverlap =
      p1.labelRect.left < q1.labelRect.right &&
      p1.labelRect.right > q1.labelRect.left &&
      p1.labelRect.top < q1.labelRect.bottom &&
      p1.labelRect.bottom > q1.labelRect.top;
    expect(badgesOverlap).toBe(false);

    // P1 tail must rise above Q1's top bar at midspan.
    const midQTop = (q1.p1Top.y + q1.p2Top.y) * 0.5;
    expect(p1.start.y).toBeLessThan(midQTop - 15);
  });

  it("staggers closely spaced point load badges vertically so they never collide", () => {
    const snapshot = buildSnapshot({ coordinateMode: "Z-Up", preset: "FRONT_2D" });
    const projector = createBeamLoadProjector(snapshot, snapshot.endAScreen, snapshot.endBScreen)!;

    const layout = computeLoadLayout(
      6,
      [makePointLoad("P1", 2.9, 15), makePointLoad("P2", 3.1, 20)],
      [makeDistributedLoad("Q1", 0, 6, 10)],
      projector,
    );

    expect(layout.point).toHaveLength(2);
    const [p1, p2] = layout.point;
    const overlap =
      p1!.labelRect.left < p2!.labelRect.right &&
      p1!.labelRect.right > p2!.labelRect.left &&
      p1!.labelRect.top < p2!.labelRect.bottom &&
      p1!.labelRect.bottom > p2!.labelRect.top;
    expect(overlap).toBe(false);
    expect(p2!.labelPos.y).toBeLessThan(p1!.labelPos.y);
  });
});
