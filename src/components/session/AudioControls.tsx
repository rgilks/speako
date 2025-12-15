import { memo } from 'preact/compat';
import { ComponentChildren } from 'preact';
import { PlayIcon, PauseIcon, StopIcon, SkipBackIcon, SkipForwardIcon } from './AudioControlIcons';

interface AudioControlsProps {
  isPlaying: boolean;
  playbackRate: number;
  currentTime: string;
  duration: string;
  onTogglePlay: () => void;
  onStop: () => void;
  onSkipForward: () => void;
  onSkipBackward: () => void;
  onChangeSpeed: (speed: number) => void;
}

interface ControlButtonProps {
  onClick: () => void;
  className?: string;
  title: string;
  children: ComponentChildren;
  isActive?: boolean;
}

function ControlButton({ onClick, className = '', title, children, isActive }: ControlButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`${className} ${isActive ? 'active' : ''}`}
      title={title}
      type="button"
    >
      {children}
    </button>
  );
}

export const AudioControls = memo(function AudioControls({
  isPlaying,
  playbackRate,
  currentTime,
  duration,
  onTogglePlay,
  onStop,
  onSkipForward,
  onSkipBackward,
  onChangeSpeed,
}: AudioControlsProps) {
  return (
    <div className="av-header">
      <div className="av-controls">
        <ControlButton onClick={onStop} className="av-btn-stop" title="Stop">
          <StopIcon />
        </ControlButton>

        <ControlButton onClick={onSkipBackward} className="av-btn-skip" title="Back 5 seconds">
          <SkipBackIcon />
        </ControlButton>

        <ControlButton
          onClick={onTogglePlay}
          className="av-btn-play"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </ControlButton>

        <ControlButton onClick={onSkipForward} className="av-btn-skip" title="Forward 5 seconds">
          <SkipForwardIcon />
        </ControlButton>

        <div className="av-speed-control">
          {[0.5, 0.75, 1].map((rate) => (
            <ControlButton
              key={rate}
              onClick={() => onChangeSpeed(rate)}
              className="av-speed-btn"
              title={`Playback Speed: ${rate}x`}
              isActive={playbackRate === rate}
            >
              {rate}x
            </ControlButton>
          ))}
        </div>
      </div>

      <div className="av-time">
        {currentTime} / {duration}
      </div>
    </div>
  );
});
