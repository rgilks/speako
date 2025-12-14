import { useEffect, useRef, useState, useCallback, useMemo } from "preact/hooks";
import WaveSurfer from 'wavesurfer.js';
// @ts-ignore
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import { TranscriptionWord } from "../../logic/transcriber";

interface AudioVisualizerProps {
  audioBlob: Blob;
  words: TranscriptionWord[];
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  word: string;
  score: number;
  duration: number;
}

interface WordStats {
  total: number;
  avgConfidence: number;
  needsReview: number;
  excellent: number;
}

function getScoreCategory(score: number): 'high' | 'medium' | 'low' {
  if (score >= 0.9) return 'high';
  if (score >= 0.7) return 'medium';
  return 'low';
}

function ConfidenceGauge({ value }: { value: number }) {
  const percentage = Math.round(value * 100);
  const circumference = 2 * Math.PI * 18;
  const strokeDashoffset = circumference - (value * circumference);
  const category = getScoreCategory(value);
  
  const strokeColor = {
    high: '#4ade80',
    medium: '#fbbf24',
    low: '#f87171'
  }[category];

  return (
    <div className="av-confidence-gauge">
      <svg width="48" height="48" viewBox="0 0 48 48">
        <circle className="av-confidence-gauge-bg" cx="24" cy="24" r="18" />
        <circle 
          className="av-confidence-gauge-fill"
          cx="24" 
          cy="24" 
          r="18"
          stroke={strokeColor}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </svg>
      <span className="av-confidence-gauge-text" style={{ color: strokeColor }}>
        {percentage}%
      </span>
    </div>
  );
}

function StatsBar({ stats }: { stats: WordStats }) {
  return (
    <div className="av-stats-bar">
      <div className="av-stat">
        <ConfidenceGauge value={stats.avgConfidence} />
        <div className="av-stat-content">
          <span className="av-stat-value">{Math.round(stats.avgConfidence * 100)}%</span>
          <span className="av-stat-label">Avg Confidence</span>
        </div>
      </div>
      
      <div className="av-stat">
        <div className="av-stat-icon blue">📊</div>
        <div className="av-stat-content">
          <span className="av-stat-value">{stats.total}</span>
          <span className="av-stat-label">Total Words</span>
        </div>
      </div>
      
      <div className="av-stat">
        <div className="av-stat-icon green">✓</div>
        <div className="av-stat-content">
          <span className="av-stat-value">{stats.excellent}</span>
          <span className="av-stat-label">Clear (90%+)</span>
        </div>
      </div>
      
      <div className="av-stat">
        <div className="av-stat-icon red">⚠</div>
        <div className="av-stat-content">
          <span className="av-stat-value">{stats.needsReview}</span>
          <span className="av-stat-label">Needs Review</span>
        </div>
      </div>
    </div>
  );
}

function Tooltip({ tooltip }: { tooltip: TooltipState }) {
  const category = getScoreCategory(tooltip.score);
  const percentage = Math.round(tooltip.score * 100);
  
  return (
    <div 
      className={`av-tooltip ${tooltip.visible ? 'visible' : ''}`}
      style={{ 
        left: `${tooltip.x}px`, 
        top: `${tooltip.y - 80}px` 
      }}
    >
      <div className="av-tooltip-word">"{tooltip.word}"</div>
      <div className="av-tooltip-details">
        <span className="av-tooltip-detail">
          ⏱ {tooltip.duration.toFixed(2)}s
        </span>
      </div>
      <div className="av-tooltip-confidence">
        <div className="av-tooltip-bar">
          <div 
            className={`av-tooltip-bar-fill ${category}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className={`av-tooltip-score ${category}`}>
          {percentage}%
        </span>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="av-loading">
      <div className="av-loading-bars">
        <div className="av-loading-bar" />
        <div className="av-loading-bar" />
        <div className="av-loading-bar" />
        <div className="av-loading-bar" />
        <div className="av-loading-bar" />
      </div>
      <span className="av-loading-text">Loading waveform...</span>
    </div>
  );
}

export function AudioVisualizer({ audioBlob, words }: AudioVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);
  const regions = useRef<RegionsPlugin | null>(null);
  const wordRegions = useRef<Map<number, any>>(new Map());
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [duration, setDuration] = useState("0:00");
  const [currentTime, setCurrentTime] = useState("0:00");
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [currentWordIndex, setCurrentWordIndex] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    word: '',
    score: 0,
    duration: 0
  });

  // Calculate stats from words
  const stats = useMemo<WordStats>(() => {
    if (!words.length) return { total: 0, avgConfidence: 0, needsReview: 0, excellent: 0 };
    
    const total = words.length;
    const avgConfidence = words.reduce((acc, w) => acc + w.score, 0) / total;
    const needsReview = words.filter(w => w.score < 0.7).length;
    const excellent = words.filter(w => w.score >= 0.9).length;
    
    return { total, avgConfidence, needsReview, excellent };
  }, [words]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Find current word based on time
  const findCurrentWordIndex = useCallback((time: number): number | null => {
    for (let i = 0; i < words.length; i++) {
      if (time >= words[i].start && time <= words[i].end) {
        return i;
      }
    }
    return null;
  }, [words]);

  // Highlight active word
  const updateActiveWord = useCallback((index: number | null) => {
    // Remove previous highlight
    wordRegions.current.forEach((region) => {
      if (region.element) {
        region.element.classList.remove('av-word-active');
      }
    });
    
    // Add new highlight
    if (index !== null) {
      const region = wordRegions.current.get(index);
      if (region?.element) {
        region.element.classList.add('av-word-active');
      }
    }
    
    setCurrentWordIndex(index);
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if the card is in view
      if (!cardRef.current) return;
      
      // Don't capture if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          wavesurfer.current?.playPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (currentWordIndex !== null && currentWordIndex > 0) {
            const prevWord = words[currentWordIndex - 1];
            wavesurfer.current?.setTime(prevWord.start);
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (currentWordIndex !== null && currentWordIndex < words.length - 1) {
            const nextWord = words[currentWordIndex + 1];
            wavesurfer.current?.setTime(nextWord.start);
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (playbackRate < 1.5) {
            const newRate = Math.min(1.5, playbackRate + 0.25);
            wavesurfer.current?.setPlaybackRate(newRate);
            setPlaybackRate(newRate);
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (playbackRate > 0.5) {
            const newRate = Math.max(0.5, playbackRate - 0.25);
            wavesurfer.current?.setPlaybackRate(newRate);
            setPlaybackRate(newRate);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentWordIndex, words, playbackRate]);

  useEffect(() => {
    if (!containerRef.current || !audioBlob) return;

    setIsLoading(true);

    // Initialize WaveSurfer with enhanced styling
    wavesurfer.current = WaveSurfer.create({
      container: containerRef.current,
      waveColor: 'rgba(99, 102, 241, 0.4)',
      progressColor: 'rgba(139, 92, 246, 0.9)',
      cursorColor: '#c7d2fe',
      cursorWidth: 2,
      barWidth: 3,
      barGap: 2,
      barRadius: 3,
      height: 128,
      url: URL.createObjectURL(audioBlob),
      normalize: true,
      minPxPerSec: 50,
      hideScrollbar: true,
      autoScroll: true,
      interact: true, // Enable click-to-seek
    });

    // Event Listeners
    wavesurfer.current.on('play', () => setIsPlaying(true));
    wavesurfer.current.on('pause', () => setIsPlaying(false));
    wavesurfer.current.on('finish', () => {
      setIsPlaying(false);
      updateActiveWord(null);
    });
    wavesurfer.current.on('decode', (d) => setDuration(formatTime(d)));
    
    wavesurfer.current.on('timeupdate', (t) => {
      setCurrentTime(formatTime(t));
      const wordIdx = findCurrentWordIndex(t);
      if (wordIdx !== currentWordIndex) {
        updateActiveWord(wordIdx);
      }
    });

    // Initialize Regions
    const regionsPlugin = RegionsPlugin.create();
    wavesurfer.current.registerPlugin(regionsPlugin);
    regions.current = regionsPlugin;

    // Render Regions on ready
    wavesurfer.current.on('ready', () => {
      setIsLoading(false);
      regionsPlugin.clearRegions();
      wordRegions.current.clear();

      words.forEach((word, index) => {
        let color = 'rgba(34, 197, 94, 0.15)';
        let borderColor = 'rgba(34, 197, 94, 0.6)';
        
        if (word.score < 0.7) {
          color = 'rgba(239, 68, 68, 0.25)';
          borderColor = 'rgba(239, 68, 68, 0.8)';
        } else if (word.score < 0.9) {
          color = 'rgba(245, 158, 11, 0.2)';
          borderColor = 'rgba(245, 158, 11, 0.7)';
        }

        const region = regionsPlugin.addRegion({
          start: word.start,
          end: word.end,
          color: color,
          drag: false,
          resize: false,
        });

        // Store region reference
        wordRegions.current.set(index, region);

        // Enhanced region styling - pointer-events:none lets clicks pass through to waveform for seek
        if (region.element) {
          region.element.style.borderBottom = `3px solid ${borderColor}`;
          region.element.style.transition = 'all 0.2s ease';
          region.element.style.pointerEvents = 'none'; // Allow click-through for seek
          
          // Custom hover tooltip
          region.element.addEventListener('mouseenter', (e: MouseEvent) => {
            setTooltip({
              visible: true,
              x: e.clientX,
              y: e.clientY,
              word: word.word,
              score: word.score,
              duration: word.end - word.start
            });
          });
          
          region.element.addEventListener('mousemove', (e: MouseEvent) => {
            setTooltip(prev => ({
              ...prev,
              x: e.clientX,
              y: e.clientY
            }));
          });
          
          region.element.addEventListener('mouseleave', () => {
            setTooltip(prev => ({ ...prev, visible: false }));
          });
        }
      });
    });
    
    // Region Click -> Play that word
    regionsPlugin.on('region-clicked', (region: any, e: any) => {
      e.stopPropagation();
      region.play();
    });

    return () => {
      wavesurfer.current?.destroy();
    };
  }, [audioBlob]);

  const togglePlay = () => wavesurfer.current?.playPause();
  
  const stopPlayback = () => {
    wavesurfer.current?.stop();
    setIsPlaying(false);
    updateActiveWord(null);
  };
  
  const changeSpeed = (speed: number) => {
    if (wavesurfer.current) {
      wavesurfer.current.setPlaybackRate(speed);
      setPlaybackRate(speed);
    }
  };

  const skipForward = () => {
    if (wavesurfer.current) {
      const current = wavesurfer.current.getCurrentTime();
      const dur = wavesurfer.current.getDuration();
      wavesurfer.current.setTime(Math.min(current + 5, dur));
    }
  };

  const skipBackward = () => {
    if (wavesurfer.current) {
      const current = wavesurfer.current.getCurrentTime();
      wavesurfer.current.setTime(Math.max(current - 5, 0));
    }
  };

  return (
    <div className="av-card" ref={cardRef}>
      <Tooltip tooltip={tooltip} />
      
      {/* Statistics Summary */}
      <StatsBar stats={stats} />
      
      {/* Header: Controls & Time */}
      <div className="av-header">
        <div className="av-controls">
          
          {/* Stop Button */}
          <button 
            onClick={stopPlayback}
            className="av-btn-stop"
            title="Stop"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
               <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            </svg>
          </button>

          {/* Skip Back 5s */}
          <button 
            onClick={skipBackward}
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
            onClick={togglePlay}
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
            onClick={skipForward}
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
                       onClick={() => changeSpeed(rate)}
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

      {/* Waveform Area */}
      {isLoading && <LoadingSkeleton />}
      <div 
        ref={containerRef} 
        id="waveform" 
        className={`av-waveform ${isPlaying ? 'playing' : ''}`}
        style={{ display: isLoading ? 'none' : 'block' }}
      />

      {/* Footer: Legend & Keyboard Hints */}
      <div className="av-legend">
         <span className="av-pill green">90%+ Clear</span>
         <span className="av-pill yellow">70-90% Good</span>
         <span className="av-pill red">&lt;70% Review</span>
         
         <div className="av-keyboard-hints">
           <span className="av-kbd-hint">
             <span className="av-kbd">Space</span> Play
           </span>
           <span className="av-kbd-hint">
             <span className="av-kbd">←</span><span className="av-kbd">→</span> Words
           </span>
           <span className="av-kbd-hint">
             <span className="av-kbd">↑</span><span className="av-kbd">↓</span> Speed
           </span>
         </div>
      </div>
    
    </div>
  );
}
