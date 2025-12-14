import { Signal } from "@preact/signals";
import { DevicePicker } from "../DevicePicker";
import { ModelLoadingState } from "../../logic/local-transcriber";

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
  statusMsg
}: SessionControlsProps) {
  return (
    <>
      <h1 className="heading-xl">Speako</h1>
      <p className="text-muted" style={{ marginBottom: "2rem", fontSize: "1.1rem" }}>
        Real-time local AI speech analysis.
      </p>
      
      {/* Model Loading Progress */}
      {!modelLoadingState.value.isLoaded && (
        <div className="card-glass" style={{ margin: "0 auto 2rem auto", maxWidth: "400px", padding: '1.5rem' }}>
          <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-secondary)' }}>
              {modelLoadingState.value.error ? '⚠️ Error' : '🧠 AI Model'}
            </span>
            
            {webGpuStatus.value && (() => {
                const isAvailable = webGpuStatus.value.isAvailable;
                const statusText = isAvailable 
                    ? "WebGPU is active. AI inference is running locally on your graphics card for maximum speed." 
                    : (webGpuStatus.value.message || "WebGPU unavailable.");
                
                return (
                    <div 
                        className="tooltip-container" 
                        style={{ position: 'relative', display: 'inline-block', cursor: 'help' }}
                    >
                        <span style={{ 
                            fontSize: '0.7rem', 
                            padding: '2px 6px', 
                            borderRadius: '4px', 
                            background: isAvailable ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            color: isAvailable ? '#10b981' : '#ef4444',
                            fontWeight: '600',
                            border: `1px solid ${isAvailable ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                            pointerEvents: 'none' // Let clicks pass to container
                        }}>
                            {isAvailable ? '⚡️ WebGPU' : '🐢 CPU'}
                        </span>
                         
                         <div className="tooltip" style={{ 
                             position: 'absolute', 
                             bottom: '125%', 
                             right: -10, 
                             width: '220px', 
                             padding: '8px 12px', 
                             background: 'rgba(30, 30, 35, 0.95)',
                             backdropFilter: 'blur(4px)',
                             color: 'white', 
                             fontSize: '0.75rem', 
                             lineHeight: '1.4',
                             borderRadius: '6px', 
                             boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                             border: '1px solid rgba(255,255,255,0.1)',
                             pointerEvents: 'none',
                             zIndex: 100,
                             display: 'none',
                             textAlign: 'center'
                         }}>
                             {statusText}
                             <div style={{ // Arrow
                                 position: 'absolute',
                                 top: '100%',
                                 right: '25px',
                                 borderWidth: '5px',
                                 borderStyle: 'solid',
                                 borderColor: 'rgba(30, 30, 35, 0.95) transparent transparent transparent'
                             }}/>
                         </div>

                         <style>{`
                             .tooltip-container:hover .tooltip { display: block !important; animation: fadeIn 0.2s ease-out; }
                         `}</style>
                    </div>
                );
            })()}
          </div>
          
          {modelLoadingState.value.error ? (
            <p style={{ color: 'var(--error)', fontSize: '0.9rem' }}>
              Failed to load model: {modelLoadingState.value.error}
            </p>
          ) : (
            <>
              <p style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                {modelLoadingState.value.isLoading 
                  ? 'Downloading Distil-Whisper model for accurate speech recognition...'
                  : 'Preparing to load AI model...'}
              </p>
              
              {/* Progress Bar */}
              <div style={{ 
                background: 'rgba(255,255,255,0.1)', 
                borderRadius: '8px', 
                height: '8px',
                overflow: 'hidden',
                marginBottom: '0.5rem'
              }}>
                <div style={{
                  background: 'linear-gradient(90deg, #6d28d9, #8b5cf6)',
                  height: '100%',
                  width: `${Math.max(modelLoadingState.value.progress, 4)}%`,
                  minWidth: '4%',
                  borderRadius: '8px',
                  transition: 'width 0.3s ease-out',
                  animation: 'pulse-glow 1.5s ease-in-out infinite'
                }} />
              </div>
              
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                {modelLoadingState.value.progress}% complete
                {modelLoadingState.value.progress < 100 && ' • One-time download, cached for future visits'}
              </p>
            </>
          )}
        </div>
      )}
      
       {/* Topic Generator Card - only show when model is loaded */}
      {modelLoadingState.value.isLoaded && (
        <div className="card-glass" style={{ margin: "0 auto 2rem auto", maxWidth: "400px", textAlign: 'left', padding: '1.5rem' }}>
            {/* Device Picker */}
            <DevicePicker 
              selectedDeviceId={selectedDeviceId.value}
              onDeviceChange={(id) => { selectedDeviceId.value = id; }}
            />
            
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
               <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-secondary)' }}>Speaking Topic</span>
               <button onClick={generateTopic} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }} title="New Topic">🔄</button>
            </div>
            <p style={{ fontSize: '1.1rem', lineHeight: '1.4', fontWeight: 500 }}>
                {currentTopic.value}
            </p>
        </div>
      )}

      <button 
        className="btn-primary" 
        onClick={handleStart}
        disabled={!modelLoadingState.value.isLoaded}
        style={{ 
          opacity: modelLoadingState.value.isLoaded ? 1 : 0.5,
          cursor: modelLoadingState.value.isLoaded ? 'pointer' : 'not-allowed'
        }}
      >
        {modelLoadingState.value.isLoaded ? 'Start Analysis' : 'Loading Model...'}
      </button>
       {statusMsg.value && (
         <p className="status-badge" style={{marginTop: '2rem', animation: 'fadeIn 0.3s ease-out'}}>
            {statusMsg.value}
         </p>
       )}
    </>
  );
}
