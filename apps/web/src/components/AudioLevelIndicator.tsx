import { useEffect, useRef } from 'preact/hooks';

interface AudioLevelIndicatorProps {
  getLevel: () => number;
  barCount?: number;
}

/**
 * Real-time audio level visualization with animated bars.
 * Polls `getLevel()` at ~60fps via requestAnimationFrame.
 */
export function AudioLevelIndicator({ getLevel, barCount = 5 }: AudioLevelIndicatorProps) {
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const animate = () => {
      const level = getLevel();
      
      // Each bar represents a different threshold
      barsRef.current.forEach((bar, i) => {
        if (!bar) return;
        const threshold = (i + 1) / barCount;
        const active = level >= threshold * 0.7; // Adjusted for sensitivity
        const height = active ? 20 + (level * 60 * ((barCount - i) / barCount)) : 8;
        bar.style.height = `${height}px`;
        bar.style.opacity = active ? '1' : '0.3';
      });
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [getLevel, barCount]);

  return (
    <div className="audio-level-bars">
      {Array.from({ length: barCount }, (_, i) => (
        <div
          key={i}
          ref={(el) => { barsRef.current[i] = el; }}
          className="audio-bar"
          style={{
            animationDelay: `${i * 50}ms`,
          }}
        />
      ))}
    </div>
  );
}
