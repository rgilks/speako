import { Signal } from '@preact/signals';
import { ProcessingView } from './ProcessingView';
import { RecordingPanel } from './RecordingPanel';

interface TranscriptionDisplayProps {
  view: Signal<'idle' | 'recording' | 'processing' | 'results'>;
  statusMsg: Signal<string>;
  elapsedTime: Signal<number>;
  currentTopic: Signal<string>;
  handleStop: () => void;
  getAudioLevel: () => number;
}

export function TranscriptionDisplay({
  view,
  statusMsg,
  elapsedTime,
  currentTopic,
  handleStop,
  getAudioLevel,
}: TranscriptionDisplayProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh]">
      {view.value === 'processing' ? (
        <ProcessingView statusMsg={statusMsg} />
      ) : (
        <RecordingPanel
          currentTopic={currentTopic}
          elapsedTime={elapsedTime}
          getAudioLevel={getAudioLevel}
          statusMsg={statusMsg}
          handleStop={handleStop}
        />
      )}
    </div>
  );
}
