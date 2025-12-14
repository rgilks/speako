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
        <button 
          onClick={onStop}
          className="av-btn-stop"
          title="Stop"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
             <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          </svg>
        </button>

        {/* Skip Back 5s */}
        <button 
          onClick={onSkipBackward}
          className="av-btn-skip"
          title="Back 5 seconds"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
            <text x="12" y="14" textAnchor="middle" fontSize="6" fontWeight="bold">5</text>
          </svg>
        </button>

        {/* Play/Pause Button */}
        <button 
          onClick={onTogglePlay}
          className="av-btn-play"
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
        </button>

        {/* Skip Forward 5s */}
        <button 
          onClick={onSkipForward}
          className="av-btn-skip"
          title="Forward 5 seconds"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/>
            <text x="12" y="14" textAnchor="middle" fontSize="6" fontWeight="bold">5</text>
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
