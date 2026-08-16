"use client";

import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export function LandingMotion({ children }: { children: ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const intro = gsap.utils.toArray<HTMLElement>("[data-enter]", scope.current);
    const stages = gsap.utils.toArray<HTMLElement>("[data-workflow-stage]", scope.current);

    if (reduceMotion) {
      gsap.set([...intro, ...stages], { autoAlpha: 1, y: 0 });
      return;
    }

    gsap.timeline({ defaults: { ease: "power3.out" } })
      .fromTo(intro, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.65, stagger: 0.1, clearProps: "transform,opacity,visibility" });

    if (window.matchMedia("(min-width: 40rem)").matches) {
      gsap.fromTo(stages, { autoAlpha: 0, y: 12 }, {
        autoAlpha: 1,
        y: 0,
        duration: 0.48,
        stagger: 0.08,
        ease: "power3.out",
        clearProps: "transform,opacity,visibility",
        scrollTrigger: { trigger: ".workflow-list", start: "top 82%", once: true },
      });
    }
  }, { scope });

  return <div ref={scope} className="landing-motion-root">{children}</div>;
}
