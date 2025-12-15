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

export function AudioControls({
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
        {/* Stop Button */}
        <button onClick={onStop} className="av-btn-stop" title="Stop">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          </svg>
        </button>

        {/* Skip Back 5s */}
        <button onClick={onSkipBackward} className="av-btn-skip" title="Back 5 seconds">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="11 19 2 12 11 5 11 19" />
            <polygon points="22 19 13 12 22 5 22 19" />
          </svg>
        </button>

        {/* Play/Pause Button */}
        <button onClick={onTogglePlay} className="av-btn-play" title={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Skip Forward 5s */}
        <button onClick={onSkipForward} className="av-btn-skip" title="Forward 5 seconds">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="13 19 22 12 13 5 13 19" />
            <polygon points="2 19 11 12 2 5 2 19" />
          </svg>
        </button>

        {/* Speed Controls */}
        <div className="av-speed-control">
          {[0.5, 0.75, 1].map((rate) => (
            <button
              key={rate}
              onClick={() => onChangeSpeed(rate)}
              className={`av-speed-btn ${playbackRate === rate ? 'active' : ''}`}
              title={`Playback Speed: ${rate}x`}
            >
              {rate}x
            </button>
          ))}
        </div>
      </div>

      {/* Time Display */}
      <div className="av-time">
        {currentTime} / {duration}
      </div>
    </div>
  );
}
