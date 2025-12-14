import { useRef, useState, useCallback, useEffect } from "preact/hooks";
import { Ref } from "preact";
import WaveSurfer from 'wavesurfer.js';
// @ts-ignore
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import { TranscriptionWord } from "../logic/transcriber";

export interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  word: string;
  score: number;
  duration: number;
}

interface UseAudioPlaybackOptions {
  audioBlob: Blob | undefined;
  words: TranscriptionWord[];
  onTooltipChange?: (tooltip: TooltipState) => void;
}

interface UseAudioPlaybackReturn {
  containerRef: Ref<HTMLDivElement>;
  isPlaying: boolean;
  isLoading: boolean;
  duration: string;
  currentTime: string;
  playbackRate: number;
  currentWordIndex: number | null;
  togglePlay: () => void;
  stopPlayback: () => void;
  changeSpeed: (speed: number) => void;
  skipForward: () => void;
  skipBackward: () => void;
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export function useAudioPlayback({ 
  audioBlob, 
  words, 
  onTooltipChange 
}: UseAudioPlaybackOptions): UseAudioPlaybackReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);
  const regions = useRef<RegionsPlugin | null>(null);
  const wordRegions = useRef<Map<number, any>>(new Map());
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [duration, setDuration] = useState("0:00");
  const [currentTime, setCurrentTime] = useState("0:00");
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [currentWordIndex, setCurrentWordIndex] = useState<number | null>(null);

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
    wordRegions.current.forEach((region) => {
      if (region.element) {
        region.element.classList.remove('av-word-active');
      }
    });
    
    if (index !== null) {
      const region = wordRegions.current.get(index);
      if (region?.element) {
        region.element.classList.add('av-word-active');
      }
    }
    
    setCurrentWordIndex(index);
  }, []);

  // Initialize WaveSurfer
  useEffect(() => {
    if (!containerRef.current || !audioBlob) return;

    setIsLoading(true);

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
      interact: true,
    });

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
        
        if (word.score < 0.90) {
          color = 'rgba(239, 68, 68, 0.25)';
          borderColor = 'rgba(239, 68, 68, 0.8)';
        } else if (word.score < 0.98) {
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

        wordRegions.current.set(index, region);

        if (region.element) {
          region.element.style.borderBottom = `3px solid ${borderColor}`;
          region.element.style.transition = 'all 0.2s ease';
          region.element.style.pointerEvents = 'none';
          
          region.element.addEventListener('mouseenter', (e: MouseEvent) => {
            onTooltipChange?.({
              visible: true,
              x: e.clientX,
              y: e.clientY,
              word: word.word,
              score: word.score,
              duration: word.end - word.start
            });
          });
          
          region.element.addEventListener('mousemove', (e: MouseEvent) => {
            onTooltipChange?.({
              visible: true,
              x: e.clientX,
              y: e.clientY,
              word: word.word,
              score: word.score,
              duration: word.end - word.start
            });
          });
          
          region.element.addEventListener('mouseleave', () => {
            onTooltipChange?.({
              visible: false, x: 0, y: 0, word: '', score: 0, duration: 0
            });
          });
        }
      });
    });
    
    regionsPlugin.on('region-clicked', (region: any, e: any) => {
      e.stopPropagation();
      region.play();
    });

    return () => {
      wavesurfer.current?.destroy();
    };
  }, [audioBlob, words, onTooltipChange]);

  const togglePlay = useCallback(() => wavesurfer.current?.playPause(), []);
  
  const stopPlayback = useCallback(() => {
    wavesurfer.current?.stop();
    setIsPlaying(false);
    updateActiveWord(null);
  }, [updateActiveWord]);
  
  const changeSpeed = useCallback((speed: number) => {
    if (wavesurfer.current) {
      wavesurfer.current.setPlaybackRate(speed);
      setPlaybackRate(speed);
    }
  }, []);

  const skipForward = useCallback(() => {
    if (wavesurfer.current) {
      const current = wavesurfer.current.getCurrentTime();
      const dur = wavesurfer.current.getDuration();
      wavesurfer.current.setTime(Math.min(current + 5, dur));
    }
  }, []);

  const skipBackward = useCallback(() => {
    if (wavesurfer.current) {
      const current = wavesurfer.current.getCurrentTime();
      wavesurfer.current.setTime(Math.max(current - 5, 0));
    }
  }, []);

  return {
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
  };
}
