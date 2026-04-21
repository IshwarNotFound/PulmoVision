export const EASE = {
  enter: [0.25, 0.46, 0.45, 0.94],
  linear: "none",
  cinematic: [0.43, 0.195, 0.02, 0.96],
  count: "power2.out",
  settle: [0.34, 1.56, 0.64, 1],
} as const;

export const fadeBlurUp = {
  initial: { opacity: 0, y: 8, filter: "blur(4px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -8, filter: "blur(4px)" },
  transition: {
    duration: 0.7,
    ease: [0.25, 0.46, 0.45, 0.94],
  },
};

export const scanReveal = {
  initial: { clipPath: "inset(0 100% 0 0)" },
  animate: { clipPath: "inset(0 0% 0 0)" },
  transition: { duration: 0.8, ease: [0.76, 0, 0.24, 1] },
};

export const staggerContainer = {
  animate: { transition: { staggerChildren: 0.06 } },
};

export const charReveal = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
};
