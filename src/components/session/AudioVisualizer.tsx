import { useRef, useState, useEffect } from 'preact/hooks';
import { TranscriptionWord } from '../../logic/transcriber';
import { useAudioPlayback, TooltipState } from '../../hooks/useAudioPlayback';
import { AudioControls } from './AudioControls';

interface AudioVisualizerProps {
  audioBlob: Blob;
  words?: TranscriptionWord[];
}

function Tooltip({ tooltip }: { tooltip: TooltipState }) {
  if (!tooltip.visible) return null;

  return (
    <div
      className="av-tooltip"
      style={{
        left: `${tooltip.x + 12}px`,
        top: `${tooltip.y - 40}px`,
      }}
    >
      <div className="av-tooltip-word">{tooltip.word}</div>
      <div className="av-tooltip-duration">{(tooltip.duration * 1000).toFixed(0)}ms</div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="av-loading">
      <div className="av-skeleton-bar" style={{ width: '60%' }} />
      <div className="av-skeleton-bar" style={{ width: '80%' }} />
      <div className="av-skeleton-bar" style={{ width: '45%' }} />
      <div className="av-skeleton-bar" style={{ width: '70%' }} />
    </div>
  );
}

export function AudioVisualizer({ audioBlob, words = [] }: AudioVisualizerProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    word: '',
    duration: 0,
  });

  const {
    containerRef,
    isPlaying,
    isLoading,
    duration,
    currentTime,
    playbackRate,
    currentWordIndex: _currentWordIndex,
    togglePlay,
    stopPlayback,
    changeSpeed,
    skipForward,
    skipBackward,
  } = useAudioPlayback({
    audioBlob,
    words,
    onTooltipChange: setTooltip,
  });

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!cardRef.current) return;
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
  }, [playbackRate, togglePlay, skipForward, skipBackward, changeSpeed]);

  return (
    <div className="av-card" ref={cardRef}>
      <Tooltip tooltip={tooltip} />

      {/* Stats bar - word count only */}
      {words.length > 0 && (
        <div className="av-stats-bar">
          <div className="av-stat">
            <span className="av-stat-value">{words.length}</span>
            <span className="av-stat-label">Words</span>
          </div>
        </div>
      )}

      <AudioControls
        isPlaying={isPlaying}
        playbackRate={playbackRate}
        currentTime={currentTime}
        duration={duration}
        onTogglePlay={togglePlay}
        onStop={stopPlayback}
        onSkipForward={skipForward}
        onSkipBackward={skipBackward}
        onChangeSpeed={changeSpeed}
      />

      {/* Waveform Area */}
      {isLoading && <LoadingSkeleton />}
      <div
        ref={containerRef}
        id="waveform"
        className={`av-waveform ${isPlaying ? 'playing' : ''}`}
        style={{ display: isLoading ? 'none' : 'block' }}
      />

      {/* Footer: Keyboard Hints */}
      <div className="av-legend">
        <div className="av-keyboard-hints">
          <span className="av-kbd-hint">
            <span className="av-kbd">Space</span> Play
          </span>
          <span className="av-kbd-hint">
            <span className="av-kbd">←</span>
            <span className="av-kbd">→</span> Skip
          </span>
          <span className="av-kbd-hint">
            <span className="av-kbd">↑</span>
            <span className="av-kbd">↓</span> Speed
          </span>
        </div>
      </div>
    </div>
  );
}
