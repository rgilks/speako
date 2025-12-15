import { useRef, useState } from 'preact/hooks';
import { TranscriptionWord } from '../../logic/transcriber';
import { useAudioPlayback, TooltipState } from '../../hooks/useAudioPlayback';
import { useAudioShortcuts } from '../../hooks/useAudioShortcuts';
import { AudioControls } from './AudioControls';
import { AudioVisualizerTooltip } from './AudioVisualizerTooltip';

interface AudioVisualizerProps {
  audioBlob: Blob;
  words?: TranscriptionWord[];
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

  useAudioShortcuts({
    enable: !!cardRef.current,
    togglePlay,
    skipBackward,
    skipForward,
    changeSpeed,
    playbackRate,
  });

  return (
    <div className="av-card" ref={cardRef}>
      <AudioVisualizerTooltip tooltip={tooltip} />

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

      {isLoading && <LoadingSkeleton />}
      <div
        ref={containerRef}
        id="waveform"
        className={`av-waveform ${isPlaying ? 'playing' : ''}`}
        style={{ display: isLoading ? 'none' : 'block' }}
      />

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
