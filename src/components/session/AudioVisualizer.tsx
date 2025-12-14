import { useRef, useState, useMemo, useEffect } from "preact/hooks";
import { TranscriptionWord } from "../../logic/transcriber";
import { useAudioPlayback, TooltipState } from "../../hooks/useAudioPlayback";
import { AudioControls } from "./AudioControls";

interface AudioVisualizerProps {
  audioBlob: Blob;
  words: TranscriptionWord[];
}

interface WordStats {
  total: number;
  avgConfidence: number;
  needsReview: number;
  excellent: number;
}

function getScoreCategory(score: number): 'high' | 'medium' | 'low' {
  if (score >= 0.98) return 'high';
  if (score >= 0.90) return 'medium';
  return 'low';
}

function ConfidenceGauge({ value }: { value: number }) {
  const percentage = Math.round(value * 100);
  const category = getScoreCategory(value);
  const color = category === 'high' ? '#22c55e' : category === 'medium' ? '#f59e0b' : '#ef4444';
  
  return (
    <div className="av-gauge">
      <svg viewBox="0 0 36 36">
        <path
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="3"
        />
        <path
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeDasharray={`${percentage}, 100`}
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
      </svg>
      <span className="av-gauge-text" style={{ color }}>{percentage}%</span>
    </div>
  );
}

function StatsBar({ stats }: { stats: WordStats }) {
  return (
    <div className="av-stats-bar">
      <div className="av-stat">
        <ConfidenceGauge value={stats.avgConfidence} />
        <span className="av-stat-label">Avg Confidence</span>
      </div>
      <div className="av-stat">
        <span className="av-stat-value">{stats.total}</span>
        <span className="av-stat-label">Words</span>
      </div>
      <div className="av-stat">
        <span className="av-stat-value green">{stats.excellent}</span>
        <span className="av-stat-label">Clear (98%+)</span>
      </div>
      <div className="av-stat">
        <span className="av-stat-value red">{stats.needsReview}</span>
        <span className="av-stat-label">Review (&lt;90%)</span>
      </div>
    </div>
  );
}

function Tooltip({ tooltip }: { tooltip: TooltipState }) {
  if (!tooltip.visible) return null;
  
  const category = getScoreCategory(tooltip.score);
  const scoreColor = category === 'high' ? '#22c55e' : category === 'medium' ? '#f59e0b' : '#ef4444';
  
  return (
    <div 
      className="av-tooltip"
      style={{
        left: `${tooltip.x + 12}px`,
        top: `${tooltip.y - 40}px`,
      }}
    >
      <div className="av-tooltip-word">{tooltip.word}</div>
      <div className="av-tooltip-score" style={{ color: scoreColor }}>
        {Math.round(tooltip.score * 100)}%
      </div>
      <div className="av-tooltip-duration">
        {(tooltip.duration * 1000).toFixed(0)}ms
      </div>
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

export function AudioVisualizer({ audioBlob, words }: AudioVisualizerProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false, x: 0, y: 0, word: '', score: 0, duration: 0
  });

  const {
    containerRef,
    isPlaying,
    isLoading,
    duration,
    currentTime,
    playbackRate,
    currentWordIndex,
    togglePlay,
    stopPlayback,
    changeSpeed,
    skipForward,
    skipBackward,
  } = useAudioPlayback({
    audioBlob,
    words,
    onTooltipChange: setTooltip
  });

  // Calculate stats from words
  const stats = useMemo<WordStats>(() => {
    if (!words.length) return { total: 0, avgConfidence: 0, needsReview: 0, excellent: 0 };
    
    const total = words.length;
    const avgConfidence = words.reduce((acc, w) => acc + w.score, 0) / total;
    const needsReview = words.filter(w => w.score < 0.90).length;
    const excellent = words.filter(w => w.score >= 0.98).length;
    
    return { total, avgConfidence, needsReview, excellent };
  }, [words]);

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
          if (currentWordIndex !== null && currentWordIndex > 0) {
            skipBackward();
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (currentWordIndex !== null && currentWordIndex < words.length - 1) {
            skipForward();
          }
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
  }, [currentWordIndex, words, playbackRate, togglePlay, skipForward, skipBackward, changeSpeed]);

  return (
    <div className="av-card" ref={cardRef}>
      <Tooltip tooltip={tooltip} />
      <StatsBar stats={stats} />
      
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

      {/* Footer: Legend & Keyboard Hints */}
      <div className="av-legend">
         <span className="av-pill green">98%+ Clear</span>
         <span className="av-pill yellow">90-98% Good</span>
         <span className="av-pill red">&lt;90% Review</span>
         
         <div className="av-keyboard-hints">
           <span className="av-kbd-hint">
             <span className="av-kbd">Space</span> Play
           </span>
           <span className="av-kbd-hint">
             <span className="av-kbd">←</span><span className="av-kbd">→</span> Skip
           </span>
           <span className="av-kbd-hint">
             <span className="av-kbd">↑</span><span className="av-kbd">↓</span> Speed
           </span>
         </div>
      </div>
    </div>
  );
}
