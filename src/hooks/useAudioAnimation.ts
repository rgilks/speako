import { useEffect, useRef, MutableRef } from 'preact/hooks';

interface UseAudioAnimationProps {
  getLevel: () => number;
  barCount: number;
  barsRef: MutableRef<(HTMLDivElement | null)[]>;
}

export function useAudioAnimation({ getLevel, barCount, barsRef }: UseAudioAnimationProps) {
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const animate = () => {
      const level = getLevel();

      barsRef.current.forEach((bar: HTMLDivElement | null, i: number) => {
        if (!bar) return;
        const threshold = (i + 1) / barCount;
        const active = level >= threshold * 0.7; // Adjusted for sensitivity
        const height = active ? 20 + level * 60 * ((barCount - i) / barCount) : 8;
        bar.style.height = `${height}px`;
        bar.style.opacity = active ? '1' : '0.3';
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [getLevel, barCount, barsRef]);
}
