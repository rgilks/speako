import { useEffect } from 'preact/hooks';
import { RefObject } from 'preact';

interface AudioShortcutsOptions {
  enable: boolean;
  togglePlay: () => void;
  skipBackward: () => void;
  skipForward: () => void;
  changeSpeed: (speed: number) => void;
  playbackRate: number;
  ignoreWhenFocused?: RefObject<HTMLElement>;
}

export function useAudioShortcuts({
  enable,
  togglePlay,
  skipBackward,
  skipForward,
  changeSpeed,
  playbackRate,
}: AudioShortcutsOptions) {
  useEffect(() => {
    if (!enable) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skipBackward();
          break;
        case 'ArrowRight':
          e.preventDefault();
          skipForward();
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (playbackRate < 1.5) changeSpeed(Math.min(1.5, playbackRate + 0.25));
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (playbackRate > 0.5) changeSpeed(Math.max(0.5, playbackRate - 0.25));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enable, togglePlay, skipBackward, skipForward, changeSpeed, playbackRate]);
}
