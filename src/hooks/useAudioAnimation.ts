import { useEffect, useRef, MutableRef } from 'preact/hooks';

interface UseAudioAnimationProps {
  getLevel: () => number;
  barCount: number;
  barsRef: MutableRef<(HTMLDivElement | null)[]>;
}

const SENSITIVITY_THRESHOLD = 0.7;
const MIN_HEIGHT = 8;
const BASE_HEIGHT = 20;
const MAX_HEIGHT_MULTIPLIER = 60;
const ACTIVE_OPACITY = '1';
const INACTIVE_OPACITY = '0.3';

function updateBar(bar: HTMLDivElement, index: number, barCount: number, level: number) {
  const threshold = (index + 1) / barCount;
  const active = level >= threshold * SENSITIVITY_THRESHOLD;
  const heightMultiplier = (barCount - index) / barCount;
  const height = active
    ? BASE_HEIGHT + level * MAX_HEIGHT_MULTIPLIER * heightMultiplier
    : MIN_HEIGHT;

  bar.style.height = `${height}px`;
  bar.style.opacity = active ? ACTIVE_OPACITY : INACTIVE_OPACITY;
}

export function useAudioAnimation({ getLevel, barCount, barsRef }: UseAudioAnimationProps) {
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const animate = () => {
      const level = getLevel();

      barsRef.current.forEach((bar, i) => {
        if (bar) {
          updateBar(bar, i, barCount, level);
        }
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
    // barsRef is a ref and doesn't need to be in dependencies
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getLevel, barCount]);
}
