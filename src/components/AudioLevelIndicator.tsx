import { useRef } from 'preact/hooks';
import { useAudioAnimation } from '../hooks/useAudioAnimation';

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

  useAudioAnimation({ getLevel, barCount, barsRef });

  return (
    <div className="audio-level-bars">
      {Array.from({ length: barCount }, (_, i) => (
        <div
          key={i}
          ref={(el) => {
            barsRef.current[i] = el;
          }}
          className="audio-bar"
          style={{
            animationDelay: `${i * 50}ms`,
          }}
        />
      ))}
    </div>
  );
}
