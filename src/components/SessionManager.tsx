import { useCallback } from 'preact/hooks';
import { useSessionManager } from '../hooks/useSessionManager';
import { SessionControls } from './session/SessionControls';
import { TranscriptionDisplay } from './session/TranscriptionDisplay';
import { SessionResults } from './session/SessionResults';

export function SessionManager() {
  const {
    view,
    transcript,
    metrics,
    analysis,
    statusMsg,
    lastDuration,
    elapsedTime,
    selectedDeviceId,
    webGpuStatus,
    modelLoadingState,
    currentTopic,
    generateTopic,
    handleStart,
    handleStop,
    handleRetry,
    localTranscriber,
  } = useSessionManager();

  const getAudioLevel = useCallback(() => {
    return localTranscriber.getRecorder().getAudioLevel();
  }, [localTranscriber]);

  const renderView = () => {
    switch (view.value) {
      case 'idle':
        return (
          <SessionControls
            modelLoadingState={modelLoadingState}
            webGpuStatus={webGpuStatus}
            selectedDeviceId={selectedDeviceId}
            currentTopic={currentTopic}
            generateTopic={generateTopic}
            handleStart={handleStart}
            statusMsg={statusMsg}
          />
        );
      case 'recording':
      case 'processing':
        return (
          <TranscriptionDisplay
            view={view}
            statusMsg={statusMsg}
            elapsedTime={elapsedTime}
            currentTopic={currentTopic}
            handleStop={handleStop}
            getAudioLevel={getAudioLevel}
          />
        );
      case 'results':
        return (
          <SessionResults
            metrics={metrics}
            analysis={analysis}
            transcript={transcript}
            lastDuration={lastDuration}
            handleRetry={handleRetry}
            statusMsg={statusMsg}
          />
        );
    }
  };

  return <div className="session-container animate-fade-in text-center">{renderView()}</div>;
}
