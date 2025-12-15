import { useRef, useState, useCallback, useEffect, MutableRef } from 'preact/hooks';
import { Ref } from 'preact';
import WaveSurfer from 'wavesurfer.js';
// @ts-expect-error - No types available for this plugin
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import { TranscriptionWord } from '../logic/transcriber';

export interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  word: string;
  duration: number;
}

interface UseAudioPlaybackOptions {
  audioBlob: Blob | undefined;
  words?: TranscriptionWord[];
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

// Constants
const SKIP_SECONDS = 5;
const WAVEFORM_HEIGHT = 128;
const WAVEFORM_COLORS = {
  wave: 'rgba(99, 102, 241, 0.4)',
  progress: 'rgba(139, 92, 246, 0.9)',
  cursor: '#c7d2fe',
  region: 'rgba(139, 92, 246, 0.15)',
  regionBorder: 'rgba(139, 92, 246, 0.4)',
};
const WAVEFORM_CONFIG = {
  cursorWidth: 2,
  barWidth: 3,
  barGap: 2,
  barRadius: 3,
  minPxPerSec: 50,
};

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function createWaveSurferConfig(container: HTMLDivElement, audioUrl: string) {
  return {
    container,
    waveColor: WAVEFORM_COLORS.wave,
    progressColor: WAVEFORM_COLORS.progress,
    cursorColor: WAVEFORM_COLORS.cursor,
    cursorWidth: WAVEFORM_CONFIG.cursorWidth,
    barWidth: WAVEFORM_CONFIG.barWidth,
    barGap: WAVEFORM_CONFIG.barGap,
    barRadius: WAVEFORM_CONFIG.barRadius,
    height: WAVEFORM_HEIGHT,
    url: audioUrl,
    normalize: true,
    minPxPerSec: WAVEFORM_CONFIG.minPxPerSec,
    hideScrollbar: true,
    autoScroll: true,
    interact: true,
  };
}

function setupWaveSurferEvents(
  wavesurfer: WaveSurfer,
  setIsPlaying: (playing: boolean) => void,
  setDuration: (duration: string) => void,
  setCurrentTime: (time: string) => void,
  findCurrentWordIndex: (time: number) => number | null,
  currentWordIndexRef: { current: number | null },
  updateActiveWord: (index: number | null) => void
) {
  wavesurfer.on('play', () => setIsPlaying(true));
  wavesurfer.on('pause', () => setIsPlaying(false));
  wavesurfer.on('finish', () => {
    setIsPlaying(false);
    updateActiveWord(null);
  });
  wavesurfer.on('decode', (d) => setDuration(formatTime(d)));

  wavesurfer.on('timeupdate', (t) => {
    setCurrentTime(formatTime(t));
    const wordIdx = findCurrentWordIndex(t);
    if (wordIdx !== currentWordIndexRef.current) {
      updateActiveWord(wordIdx);
    }
  });
}

function createTooltipHandlers(
  word: TranscriptionWord,
  onTooltipChange?: (tooltip: TooltipState) => void
) {
  const showTooltip = (e: MouseEvent) => {
    onTooltipChange?.({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      word: word.word,
      duration: word.end - word.start,
    });
  };

  const hideTooltip = () => {
    onTooltipChange?.({
      visible: false,
      x: 0,
      y: 0,
      word: '',
      duration: 0,
    });
  };

  return { showTooltip, hideTooltip };
}

function createWordRegions(
  regionsPlugin: RegionsPlugin,
  words: TranscriptionWord[],
  wordRegions: MutableRef<Map<number, unknown>>,
  onTooltipChange?: (tooltip: TooltipState) => void
) {
  regionsPlugin.clearRegions();
  wordRegions.current.clear();

  words.forEach((word, index) => {
    const region = regionsPlugin.addRegion({
      start: word.start,
      end: word.end,
      color: WAVEFORM_COLORS.region,
      drag: false,
      resize: false,
    });

    wordRegions.current.set(index, region);

    if (region.element) {
      region.element.style.borderBottom = `2px solid ${WAVEFORM_COLORS.regionBorder}`;
      region.element.style.transition = 'all 0.2s ease';

      const { showTooltip, hideTooltip } = createTooltipHandlers(word, onTooltipChange);
      region.element.addEventListener('mouseenter', showTooltip);
      region.element.addEventListener('mousemove', showTooltip);
      region.element.addEventListener('mouseleave', hideTooltip);
    }
  });
}

export function useAudioPlayback({
  audioBlob,
  words = [],
  onTooltipChange,
}: UseAudioPlaybackOptions): UseAudioPlaybackReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);
  const regions = useRef<RegionsPlugin | null>(null);
  const wordRegions = useRef<Map<number, unknown>>(new Map());

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [duration, setDuration] = useState('0:00');
  const [currentTime, setCurrentTime] = useState('0:00');
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [currentWordIndex, setCurrentWordIndex] = useState<number | null>(null);
  const currentWordIndexRef = useRef<number | null>(null);

  // Find current word based on time
  const findCurrentWordIndex = useCallback(
    (time: number): number | null => {
      for (let i = 0; i < words.length; i++) {
        if (time >= words[i].start && time <= words[i].end) {
          return i;
        }
      }
      return null;
    },
    [words]
  );

  // Highlight active word
  const updateActiveWord = useCallback((index: number | null) => {
    wordRegions.current.forEach((region) => {
      const regionWithElement = region as { element?: HTMLElement };
      if (regionWithElement.element) {
        regionWithElement.element.classList.remove('av-word-active');
      }
    });

    if (index !== null) {
      const region = wordRegions.current.get(index);
      const regionWithElement = region as { element?: HTMLElement } | undefined;
      if (regionWithElement?.element) {
        regionWithElement.element.classList.add('av-word-active');
      }
    }

    currentWordIndexRef.current = index;
    setCurrentWordIndex(index);
  }, []);

  // Initialize WaveSurfer
  useEffect(() => {
    if (!containerRef.current || !audioBlob) return;

    setIsLoading(true);
    currentWordIndexRef.current = null;
    const audioUrl = URL.createObjectURL(audioBlob);

    wavesurfer.current = WaveSurfer.create(createWaveSurferConfig(containerRef.current, audioUrl));

    setupWaveSurferEvents(
      wavesurfer.current,
      setIsPlaying,
      setDuration,
      setCurrentTime,
      findCurrentWordIndex,
      currentWordIndexRef,
      updateActiveWord
    );

    const regionsPlugin = RegionsPlugin.create();
    wavesurfer.current.registerPlugin(regionsPlugin);
    regions.current = regionsPlugin;

    wavesurfer.current.on('ready', () => {
      setIsLoading(false);
      createWordRegions(regionsPlugin, words, wordRegions, onTooltipChange);
    });

    regionsPlugin.on('region-clicked', (region: unknown, e: Event) => {
      e.stopPropagation();
      const regionWithPlay = region as { play: () => void };
      regionWithPlay.play();
    });

    return () => {
      wavesurfer.current?.destroy();
      URL.revokeObjectURL(audioUrl);
    };
  }, [audioBlob, words, onTooltipChange, findCurrentWordIndex, updateActiveWord]);

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
      wavesurfer.current.setTime(Math.min(current + SKIP_SECONDS, dur));
    }
  }, []);

  const skipBackward = useCallback(() => {
    if (wavesurfer.current) {
      const current = wavesurfer.current.getCurrentTime();
      wavesurfer.current.setTime(Math.max(current - SKIP_SECONDS, 0));
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
