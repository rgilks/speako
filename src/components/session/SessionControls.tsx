import { Signal } from '@preact/signals';
import { ModelLoadingState } from '../../logic/local-transcriber';
import { ModelLoadingCard } from './ModelLoadingCard';
import { TopicGeneratorCard } from './TopicGeneratorCard';

interface SessionControlsProps {
  modelLoadingState: Signal<ModelLoadingState>;
  webGpuStatus: Signal<{ isAvailable: boolean; message?: string } | null>;
  selectedDeviceId: Signal<string>;
  currentTopic: Signal<string>;
  generateTopic: () => void;
  handleStart: () => void;
  statusMsg: Signal<string>;
}

export function SessionControls({
  modelLoadingState,
  webGpuStatus,
  selectedDeviceId,
  currentTopic,
  generateTopic,
  handleStart,
  statusMsg,
}: SessionControlsProps) {
  return (
    <>
      <h1 className="heading-xl">Speako</h1>
      <p className="text-muted" style={{ marginBottom: '2rem', fontSize: '1.1rem' }}>
        Real-time local AI speech analysis.
      </p>

      <ModelLoadingCard modelLoadingState={modelLoadingState} webGpuStatus={webGpuStatus} />

      <TopicGeneratorCard
        modelLoadingState={modelLoadingState}
        selectedDeviceId={selectedDeviceId}
        currentTopic={currentTopic}
        generateTopic={generateTopic}
      />

      <button
        className="btn-primary"
        onClick={handleStart}
        disabled={!modelLoadingState.value.isLoaded}
        style={{
          opacity: modelLoadingState.value.isLoaded ? 1 : 0.5,
          cursor: modelLoadingState.value.isLoaded ? 'pointer' : 'not-allowed',
          marginBottom: statusMsg.value ? '2rem' : '4rem',
        }}
      >
        {modelLoadingState.value.isLoaded ? 'Start' : 'Loading Model...'}
      </button>
      {statusMsg.value && (
        <p
          className="status-badge"
          style={{ marginTop: '2rem', marginBottom: '4rem', animation: 'fadeIn 0.3s ease-out' }}
        >
          {statusMsg.value}
        </p>
      )}
    </>
  );
}
