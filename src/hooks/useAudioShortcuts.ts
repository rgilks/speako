import { useEffect } from 'preact/hooks';

interface AudioShortcutsOptions {
  enable: boolean;
  togglePlay: () => void;
  skipBackward: () => void;
  skipForward: () => void;
  changeSpeed: (speed: number) => void;
  playbackRate: number;
}

// Constants
const KEY_CODES = {
  SPACE: 'Space',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
} as const;

const PLAYBACK_RATE = {
  MIN: 0.5,
  MAX: 1.5,
  STEP: 0.25,
} as const;

function isInputElement(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

function calculateSpeedChange(currentRate: number, direction: 'up' | 'down'): number {
  if (direction === 'up') {
    return currentRate < PLAYBACK_RATE.MAX
      ? Math.min(PLAYBACK_RATE.MAX, currentRate + PLAYBACK_RATE.STEP)
      : currentRate;
  }
  return currentRate > PLAYBACK_RATE.MIN
    ? Math.max(PLAYBACK_RATE.MIN, currentRate - PLAYBACK_RATE.STEP)
    : currentRate;
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
      if (isInputElement(e.target)) return;

      switch (e.code) {
        case KEY_CODES.SPACE:
          e.preventDefault();
          togglePlay();
          break;
        case KEY_CODES.ARROW_LEFT:
          e.preventDefault();
          skipBackward();
          break;
        case KEY_CODES.ARROW_RIGHT:
          e.preventDefault();
          skipForward();
          break;
        case KEY_CODES.ARROW_UP:
          e.preventDefault();
          changeSpeed(calculateSpeedChange(playbackRate, 'up'));
          break;
        case KEY_CODES.ARROW_DOWN:
          e.preventDefault();
          changeSpeed(calculateSpeedChange(playbackRate, 'down'));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enable, togglePlay, skipBackward, skipForward, changeSpeed, playbackRate]);
}
