import Lenis from "lenis";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export interface LenisController {
  lenis: Lenis;
  raf: (time: number) => void;
}

export const initLenis = () => {
  const lenis = new Lenis({
    duration: 1.2,
    easing: (t: number) => Math.min(1, 1.001 - 2 ** (-10 * t)),
    orientation: "vertical",
    smoothWheel: true,
  });

  const raf = (time: number) => {
    lenis.raf(time * 1000);
  };

  gsap.ticker.add(raf);
  gsap.ticker.lagSmoothing(0);
  lenis.on("scroll", ScrollTrigger.update);

  return { lenis, raf } satisfies LenisController;
};

export const destroyLenis = (controller: LenisController | null) => {
  if (!controller) return;

  controller.lenis.off("scroll", ScrollTrigger.update);
  gsap.ticker.remove(controller.raf);
  controller.lenis.destroy();
};
