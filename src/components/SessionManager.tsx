import { useSessionManager } from "../hooks/useSessionManager";
import { SessionControls } from "./session/SessionControls";
import { TranscriptionDisplay } from "./session/TranscriptionDisplay";
import { SessionResults } from "./session/SessionResults";

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
    localTranscriber
  } = useSessionManager();

  return (
    <div className="session-container animate-fade-in text-center">
      
      {view.value === "idle" && (
        <SessionControls
            modelLoadingState={modelLoadingState}
            webGpuStatus={webGpuStatus}
            selectedDeviceId={selectedDeviceId}
            currentTopic={currentTopic}
            generateTopic={generateTopic}
            handleStart={handleStart}
            statusMsg={statusMsg}
        />
      )}

      {(view.value === "recording" || view.value === "processing") && (
        <TranscriptionDisplay
            view={view}
            statusMsg={statusMsg}
            elapsedTime={elapsedTime}
            handleStop={handleStop}
            getAudioLevel={() => localTranscriber.getRecorder().getAudioLevel()}
        />
      )}

      {view.value === "results" && (
        <SessionResults 
             metrics={metrics}
             analysis={analysis}
             transcript={transcript}
             lastDuration={lastDuration}
             handleRetry={handleRetry}
             statusMsg={statusMsg}
        />
      )}
    </div>
  );
}
