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
        y: -10,
        scale: 0.95,
        opacity: 0,
        duration: 0.35,
        ease: "back.out(1.5)",
      })
        .from(
          "[data-hero='title']",
          {
            y: 16,
            opacity: 0,
            duration: 0.42,
          },
          "-=0.25",
        )
        .from(
          "[data-hero='subtitle']",
          {
            y: 12,
            opacity: 0,
            duration: 0.38,
          },
          "-=0.28",
        )
        .from(
          "[data-hero='cta']",
          {
            y: 12,
            scale: 0.96,
            opacity: 0,
            duration: 0.35,
            stagger: 0.05,
            ease: "back.out(1.3)",
          },
          "-=0.26",
        )
        .from(
          "[data-hero='visual']",
          {
            y: 16,
            scale: 0.98,
            opacity: 0,
            duration: 0.45,
          },
          "-=0.35",
        )
        .add(() => {
          // Idle animations (GPU transform only)
          gsap.to("[data-hero='badge']", {
            y: -2.5,
            duration: 2.6,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
          });

          gsap.to("[data-hero='accent']", {
            y: -1.5,
            scale: 1.015,
            duration: 3.0,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
          });

          gsap.to("[data-hero='cta-primary']", {
            y: -2.5,
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
            y: -1.5,
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
