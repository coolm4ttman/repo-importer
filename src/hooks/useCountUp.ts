import { useEffect, useRef, useState } from "react";

/**
 * Animated count-up hook using requestAnimationFrame with ease-out cubic curve.
 * @param target - The target number to count up to
 * @param duration - Animation duration in milliseconds (default 1500)
 * @returns The current animated value
 */
export function useCountUp(target: number, duration = 1500): number {
  const [value, setValue] = useState(0);
  const prevTarget = useRef(0);
  const rafId = useRef<number>(0);

  useEffect(() => {
    const start = prevTarget.current;
    const delta = target - start;

    if (delta === 0) return;

    const startTime = performance.now();

    function easeOutCubic(t: number): number {
      return 1 - Math.pow(1 - t, 3);
    }

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutCubic(progress);
      const current = Math.round(start + delta * easedProgress);

      setValue(current);

      if (progress < 1) {
        rafId.current = requestAnimationFrame(animate);
      } else {
        prevTarget.current = target;
      }
    }

    rafId.current = requestAnimationFrame(animate);

    return () => {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, [target, duration]);

  return value;
}
