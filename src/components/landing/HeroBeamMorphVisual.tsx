/**
 * @file HeroBeamMorphVisual.tsx
 * @description Interactive + Auto-Morphing FEA Beam & BMD SVG showcase for the landing page hero.
 * - Auto mode: zero-JS native SVG SMIL path morphing (<animate attributeName="d">).
 * - Interactive mode: drag/tap anywhere on the beam to move point load P along the 6.0 m span,
 *   or switch load magnitude presets (25 / 50 / 100 kN) with live Euler-Bernoulli readouts.
 */

"use client";

import { type PointerEvent, type ReactElement, useRef, useState } from "react";

import { glassPanelClass } from "@/components/landing/ErzyshPageShell";
import { cn } from "@/lib/utils";

const ANIM_DUR = "4.8s";
const KEY_TIMES = "0;0.42;0.76;1";
const KEY_SPLINES = "0.45 0 0.25 1;0.45 0 0.25 1;0.45 0 0.25 1";

const SPAN_M = 6.0;
const DIST_LOAD_KN_M = 15.0;
const BEAM_X_START = 70;
const BEAM_X_END = 530;
const BEAM_WIDTH_PX = BEAM_X_END - BEAM_X_START;
const LOAD_PRESETS = [25, 50, 100] as const;

export function HeroBeamMorphVisual(): ReactElement {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isAuto, setIsAuto] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [loadPosM, setLoadPosM] = useState(3.0);
  const [loadKn, setLoadKn] = useState<number>(50);

  const updateLoadFromPointer = (clientX: number): void => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0) return;

    const svgX = ((clientX - rect.left) / rect.width) * 600;
    const clampedRatio = Math.max(0.08, Math.min(0.92, (svgX - BEAM_X_START) / BEAM_WIDTH_PX));
    const nextPosM = Math.round(clampedRatio * SPAN_M * 20) / 20;

    setIsAuto(false);
    setLoadPosM(nextPosM);
  };

  const handlePointerDown = (e: PointerEvent<SVGSVGElement>): void => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    updateLoadFromPointer(e.clientX);
  };

  const handlePointerMove = (e: PointerEvent<SVGSVGElement>): void => {
    if (!isDragging) return;
    updateLoadFromPointer(e.clientX);
  };

  const handlePointerUp = (e: PointerEvent<SVGSVGElement>): void => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setIsDragging(false);
  };

  // Interactive Euler-Bernoulli mechanics at load position a
  const a = loadPosM;
  const b = SPAN_M - a;
  const momentKnm = (DIST_LOAD_KN_M * a * b) / 2 + (loadKn * a * b) / SPAN_M;
  // Scaled deflection (calibrated so P=50 kN @ a=3.0m -> -13.26 mm)
  const deflectionMm = -((momentKnm / 142.5) * 13.26);

  const loadSvgX = BEAM_X_START + (a / SPAN_M) * BEAM_WIDTH_PX;
  // Quadratic Bezier control point shifted toward load position for realistic asymmetric sag
  const ctrlX = BEAM_X_START + (0.5 * 0.45 + (a / SPAN_M) * 0.55) * BEAM_WIDTH_PX;
  const sagPx = Math.min(62, Math.max(12, (Math.abs(deflectionMm) / 13.26) * 44));
  const arrowDropPx = Math.min(28, sagPx * 0.52);
  const bmdPeakY = 175 + Math.min(68, Math.max(18, (momentKnm / 142.5) * 62));

  return (
    <div
      data-hero="visual"
      className={cn(glassPanelClass, "relative mx-auto mt-12 max-w-3xl overflow-hidden p-3 sm:p-4")}
    >
      {/* Animated top shimmer bar */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-cyan-400/70 to-transparent"
      />

      {/* Interactive Toolbar Header */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-cyan-500/15 pb-2 font-mono text-[10px]">
        <div className="flex items-center gap-2 text-cyan-300">
          <span className="inline-flex size-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
          <span>FEA_INTERACTIVE // {isAuto ? "AUTO_MORPH" : "MANUAL_DRAG"}</span>
        </div>

        <div className="flex items-center gap-1">
          {LOAD_PRESETS.map((preset) => {
            const active = !isAuto && loadKn === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setIsAuto(false);
                  setLoadKn(preset);
                }}
                className={cn(
                  "cursor-pointer rounded px-1.5 py-0.5 transition-colors",
                  active
                    ? "bg-cyan-400/20 text-cyan-200 ring-1 ring-cyan-400/50"
                    : "text-slate-400 hover:bg-cyan-500/10 hover:text-cyan-300",
                )}
              >
                {preset}kN
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setIsAuto(true);
              setLoadPosM(3.0);
              setLoadKn(50);
            }}
            className={cn(
              "cursor-pointer rounded px-1.5 py-0.5 transition-colors",
              isAuto
                ? "bg-violet-500/25 text-violet-200 ring-1 ring-violet-400/50"
                : "text-slate-400 hover:bg-violet-500/15 hover:text-violet-300",
            )}
          >
            Auto
          </button>
        </div>
      </div>

      {/* Main Interactive SVG Morph Canvas */}
      <div className="relative overflow-hidden rounded-md border border-cyan-500/10 bg-[#040811]/90">
        {/* Subtle sweeping laser scanline (CSS transform only) */}
        <div
          aria-hidden="true"
          className="erzysh-scanline pointer-events-none absolute inset-y-0 w-24 bg-linear-to-r from-transparent via-cyan-400/8 to-transparent"
        />

        <svg
          ref={svgRef}
          viewBox="0 0 600 245"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={cn(
            "h-auto w-full touch-none select-none",
            isDragging ? "cursor-grabbing" : "cursor-grab",
          )}
          role="img"
          aria-label="Simulasi interaktif defleksi balok 3D dan diagram momen lentur — geser beban untuk melihat perubahan"
        >
          <defs>
            <linearGradient id="feaBeamGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="28%" stopColor="#10b981" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="72%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>

            <linearGradient id="bmdFillGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.06" />
            </linearGradient>

            <filter id="cyanGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background blueprint micro-grid */}
          <g stroke="#122338" strokeWidth="0.6" opacity="0.7">
            <line x1="70" y1="20" x2="70" y2="230" strokeDasharray="3 3" />
            <line
              x1={isAuto ? 300 : loadSvgX}
              y1="20"
              x2={isAuto ? 300 : loadSvgX}
              y2="230"
              strokeDasharray="3 3"
              stroke={isAuto ? "#122338" : "#22d3ee"}
              strokeOpacity={isAuto ? 0.7 : 0.35}
            />
            <line x1="530" y1="20" x2="530" y2="230" strokeDasharray="3 3" />
            <line x1="35" y1="92" x2="565" y2="92" strokeDasharray="4 4" />
            <line x1="35" y1="175" x2="565" y2="175" />
          </g>

          {/* Distributed Load (q) Subtle Dashed Envelope */}
          <g stroke="#38bdf8" strokeWidth="1" opacity="0.45">
            {[115, 160, 205, 250, 350, 395, 440, 485].map((x) => (
              <g key={x}>
                <line x1={x} y1="42" x2={x} y2="72" />
                <path d={`M ${x - 3} 67 L ${x} 73 L ${x + 3} 67`} fill="none" />
              </g>
            ))}
            <line x1="115" y1="42" x2="485" y2="42" strokeDasharray="4 2" />
          </g>

          {/* Point Load Arrow P (Auto Morph or Interactive Drag) */}
          <g
            filter="url(#cyanGlow)"
            transform={isAuto ? undefined : `translate(${loadSvgX - 300}, ${arrowDropPx})`}
          >
            {isAuto ? (
              <animateTransform
                attributeName="transform"
                type="translate"
                dur={ANIM_DUR}
                repeatCount="indefinite"
                keyTimes={KEY_TIMES}
                calcMode="spline"
                keySplines={KEY_SPLINES}
                values="0 0; 0 24; 0 6; 0 0"
              />
            ) : null}
            <line x1="300" y1="22" x2="300" y2="76" stroke="#22d3ee" strokeWidth="2.5" />
            <polygon points="294,70 306,70 300,82" fill="#22d3ee" />
            <rect
              x="266"
              y="7"
              width="68"
              height="16"
              rx="4"
              fill="#0a1628"
              stroke="#22d3ee"
              strokeOpacity="0.65"
              strokeWidth="0.9"
            />
            <text
              x="300"
              y="18"
              textAnchor="middle"
              fill="#67e8f9"
              fontSize="8.5"
              fontFamily="monospace"
              fontWeight="bold"
            >
              P = {isAuto ? 50 : loadKn} kN
            </text>
          </g>

          {/* Morphing Extruded Beam Body (FEA Spectrum) */}
          <path
            d={
              isAuto
                ? "M 70 86 Q 300 86 530 86 L 530 98 Q 300 98 70 98 Z"
                : `M 70 86 Q ${ctrlX} ${86 + sagPx} 530 86 L 530 98 Q ${ctrlX} ${98 + sagPx} 70 98 Z`
            }
            fill="url(#feaBeamGrad)"
            fillOpacity="0.88"
            stroke="#67e8f9"
            strokeOpacity="0.5"
            strokeWidth="1"
            filter="url(#cyanGlow)"
          >
            {isAuto ? (
              <animate
                attributeName="d"
                dur={ANIM_DUR}
                repeatCount="indefinite"
                keyTimes={KEY_TIMES}
                calcMode="spline"
                keySplines={KEY_SPLINES}
                values="
                  M 70 86 Q 300 86 530 86 L 530 98 Q 300 98 70 98 Z;
                  M 70 86 Q 300 138 530 86 L 530 98 Q 300 150 70 98 Z;
                  M 70 86 Q 300 99 530 86 L 530 98 Q 300 111 70 98 Z;
                  M 70 86 Q 300 86 530 86 L 530 98 Q 300 98 70 98 Z
                "
              />
            ) : null}
          </path>

          {/* Morphing Neutral Axis Centerline */}
          <path
            d={isAuto ? "M 70 92 Q 300 92 530 92" : `M 70 92 Q ${ctrlX} ${92 + sagPx} 530 92`}
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.65"
            strokeWidth="1"
            strokeDasharray="5 3"
          >
            {isAuto ? (
              <animate
                attributeName="d"
                dur={ANIM_DUR}
                repeatCount="indefinite"
                keyTimes={KEY_TIMES}
                calcMode="spline"
                keySplines={KEY_SPLINES}
                values="
                  M 70 92 Q 300 92 530 92;
                  M 70 92 Q 300 144 530 92;
                  M 70 92 Q 300 105 530 92;
                  M 70 92 Q 300 92 530 92
                "
              />
            ) : null}
          </path>

          {/* Left Support: Pinned Triangle */}
          <g stroke="#22d3ee" strokeWidth="1.5" fill="#091526">
            <polygon points="70,99 61,115 79,115" />
            <line x1="56" y1="118" x2="84" y2="118" strokeOpacity="0.7" />
          </g>

          {/* Right Support: Roller Triangle + Circle */}
          <g stroke="#8b5cf6" strokeWidth="1.5" fill="#091526">
            <polygon points="530,99 521,112 539,112" />
            <circle cx="525" cy="116" r="2.2" />
            <circle cx="535" cy="116" r="2.2" />
            <line x1="516" y1="120" x2="544" y2="120" strokeOpacity="0.7" />
          </g>

          {/* Deflection Hotspot Node */}
          <circle
            cx={isAuto ? 300 : loadSvgX}
            cy={isAuto ? 92 : 92 + sagPx * 0.5}
            r="4.5"
            fill="#f59e0b"
            stroke="#ffffff"
            strokeWidth="1.2"
          >
            {isAuto ? (
              <>
                <animate
                  attributeName="cy"
                  dur={ANIM_DUR}
                  repeatCount="indefinite"
                  keyTimes={KEY_TIMES}
                  calcMode="spline"
                  keySplines={KEY_SPLINES}
                  values="92;118;99;92"
                />
                <animate
                  attributeName="r"
                  dur={ANIM_DUR}
                  repeatCount="indefinite"
                  keyTimes={KEY_TIMES}
                  values="3.5;5.5;4;3.5"
                />
              </>
            ) : null}
          </circle>

          {/* Morphing Bending Moment Diagram (BMD) */}
          <path
            d={
              isAuto
                ? "M 70 175 Q 300 175 530 175 L 530 175 L 70 175 Z"
                : `M 70 175 Q ${ctrlX} ${bmdPeakY} 530 175 L 530 175 L 70 175 Z`
            }
            fill="url(#bmdFillGrad)"
            stroke="#38bdf8"
            strokeWidth="1.6"
          >
            {isAuto ? (
              <animate
                attributeName="d"
                dur={ANIM_DUR}
                repeatCount="indefinite"
                keyTimes={KEY_TIMES}
                calcMode="spline"
                keySplines={KEY_SPLINES}
                values="
                  M 70 175 Q 300 175 530 175 L 530 175 L 70 175 Z;
                  M 70 175 Q 300 242 530 175 L 530 175 L 70 175 Z;
                  M 70 175 Q 300 192 530 175 L 530 175 L 70 175 Z;
                  M 70 175 Q 300 175 530 175 L 530 175 L 70 175 Z
                "
              />
            ) : null}
          </path>

          {/* Labels & Live Telemetry */}
          <text x="74" y="169" fill="#64748b" fontSize="8.5" fontFamily="monospace">
            BMD (M_u) · {isAuto ? "Geser / klik balok untuk uji beban" : `x = ${a.toFixed(2)} m`}
          </text>
          <text
            x="300"
            y="232"
            textAnchor="middle"
            fill="#c4b5fd"
            fontSize="9"
            fontFamily="monospace"
            fontWeight="bold"
          >
            {isAuto ? (
              <>
                <animate
                  attributeName="opacity"
                  dur={ANIM_DUR}
                  repeatCount="indefinite"
                  keyTimes={KEY_TIMES}
                  values="0.35;1;0.55;0.35"
                />
                M_max = 142.5 kNm · δ_max = -13.26 mm
              </>
            ) : (
              `M_max = ${momentKnm.toFixed(1)} kNm · δ = ${deflectionMm.toFixed(2)} mm`
            )}
          </text>
        </svg>
      </div>
    </div>
  );
}

export default HeroBeamMorphVisual;
