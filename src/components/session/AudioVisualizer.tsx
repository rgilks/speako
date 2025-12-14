import { useEffect, useRef } from "preact/hooks";
import WaveSurfer from 'wavesurfer.js';
// @ts-ignore
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import { TranscriptionWord } from "../../logic/transcriber";

interface AudioVisualizerProps {
  audioBlob: Blob;
  words: TranscriptionWord[];
}

export function AudioVisualizer({ audioBlob, words }: AudioVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);
  const regions = useRef<RegionsPlugin | null>(null);

  useEffect(() => {
    if (!containerRef.current || !audioBlob) return;

    // Initialize WaveSurfer
    wavesurfer.current = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#4f46e5',
      progressColor: '#818cf8',
      cursorColor: '#312e81',
      barWidth: 2,
      barGap: 3,
      barRadius: 3,
      height: 100,
      url: URL.createObjectURL(audioBlob),
    });

    // Initialize Regions plugin
    const regionsPlugin = RegionsPlugin.create();
    wavesurfer.current.registerPlugin(regionsPlugin);
    regions.current = regionsPlugin;

    // Add regions for words
    wavesurfer.current.on('ready', () => {
      words.forEach((word) => {
        // Determine color based on score (confidence)
        // High confidence (>=0.9) = transparent/greenish hint
        // Medium confidence (0.7-0.9) = yellow hint
        // Low confidence (<0.7) = red hint
        let color = 'rgba(0, 255, 0, 0.1)';
        if (word.score < 0.7) {
          color = 'rgba(255, 0, 0, 0.2)';
        } else if (word.score < 0.9) {
          color = 'rgba(255, 255, 0, 0.2)';
        }

        regionsPlugin.addRegion({
          start: word.start,
          end: word.end,
          color: color,
          drag: false,
          resize: false,
          content: word.word,
        });
      });
    });
    
    // Play region on click
    regionsPlugin.on('region-clicked', (region: any, e: any) => {
      e.stopPropagation(); // Prevent seeking to click position after play
      region.play();
    });

    return () => {
      if (wavesurfer.current) {
        wavesurfer.current.destroy();
      }
    };
  }, [audioBlob]);

  const handlePlayPause = () => {
    wavesurfer.current?.playPause();
  };

  return (
    <div className="audio-visualizer-container mb-6 p-4 bg-white/5 rounded-xl border border-white/10">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-300">Audio Playback</h3>
        <button 
          onClick={handlePlayPause}
          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm transition-colors"
        >
          Play / Pause
        </button>
      </div>
      <div ref={containerRef} id="waveform" className="w-full"></div>
      <div className="mt-2 text-xs text-center text-gray-500">
        Click on words to play specific segments. <span className="inline-block w-2 h-2 bg-red-500/50 rounded-full ml-2"></span> Low Confidence
      </div>
    </div>
  );
}
