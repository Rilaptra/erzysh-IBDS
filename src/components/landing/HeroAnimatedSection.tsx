/**
 * @file HeroAnimatedSection.tsx
 * @description Client-side GSAP choreography for the landing page hero section:
 * - Staggered GPU-composited entrance timeline (badge, headline, subtitle, CTAs, visual)
 * - Continuous subtle idle animations (floating badge, breathing accent, levitating CTA)
 * - Strict gsap.context() cleanup & prefers-reduced-motion guard for low-RAM devices.
 */

"use client";

import gsap from "gsap";
import { type ReactElement, type ReactNode, useEffect, useRef } from "react";

export interface HeroAnimatedSectionProps {
  readonly children: ReactNode;
  readonly className?: string;
}

export function HeroAnimatedSection({
  children,
  className,
}: HeroAnimatedSectionProps): ReactElement {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl.from("[data-hero='badge']", {
        y: -16,
        scale: 0.92,
        opacity: 0,
        duration: 0.55,
        ease: "back.out(1.7)",
      })
        .from(
          "[data-hero='title']",
          {
            y: 26,
            opacity: 0,
            duration: 0.65,
          },
          "-=0.3",
        )
        .from(
          "[data-hero='subtitle']",
          {
            y: 18,
            opacity: 0,
            duration: 0.55,
          },
          "-=0.38",
        )
        .from(
          "[data-hero='cta']",
          {
            y: 18,
            scale: 0.94,
            opacity: 0,
            duration: 0.5,
            stagger: 0.08,
            ease: "back.out(1.4)",
          },
          "-=0.32",
        )
        .from(
          "[data-hero='visual']",
          {
            y: 28,
            scale: 0.97,
            opacity: 0,
            duration: 0.7,
          },
          "-=0.35",
        )
        .add(() => {
          // Idle animations (GPU transform only)
          gsap.to("[data-hero='badge']", {
            y: -3,
            duration: 2.6,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
          });

          gsap.to("[data-hero='accent']", {
            y: -2,
            scale: 1.02,
            duration: 3.0,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
          });

          gsap.to("[data-hero='cta-primary']", {
            y: -3,
            duration: 2.2,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
          });

          gsap.to("[data-hero='cta-arrow']", {
            x: 3,
            duration: 1.1,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
          });

          gsap.to("[data-hero='cta-secondary']", {
            y: -2,
            duration: 2.6,
            stagger: 0.25,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
          });
        });
    }, root);

    return () => {
      ctx.revert();
    };
  }, []);

  return (
    <section ref={containerRef} className={className}>
      {children}
    </section>
  );
}

export default HeroAnimatedSection;
