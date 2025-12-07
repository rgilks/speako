import { useSignal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import { LocalTranscriber } from "../logic/local-transcriber";
import { RemoteTranscriber } from "../logic/remote-transcriber";
// In real app, we'd import the WASM module dynamically or via the plugin
import * as wasm from "../../../../crates/client/pkg/speako_client";

export function SessionManager() {
  const isRecording = useSignal(false);
  const isProcessing = useSignal(false);
  const transcript = useSignal("");
  const metrics = useSignal<any>(null);
  const statusMsg = useSignal("");
  const lastDuration = useSignal(0);
  const startTime = useRef(0);

  useEffect(() => {
    try {
      console.log("WASM Module loaded:", Object.keys(wasm));
      console.log("Type of calculate_metrics_wasm:", typeof wasm.calculate_metrics_wasm);
      const wasmModule = wasm as any;
      if (wasmModule.init) {
          wasmModule.init();
          console.log("WASM Panic Hook initialized.");
      }
    } catch (e) {
      console.error("Failed to init WASM:", e);
    }
  }, []);
  
  // Instance for the component
  const localTranscriber = new LocalTranscriber();
  // Remote fallback
  const remoteTranscriber = new RemoteTranscriber();

  const handleStart = async () => {
    try {
      isRecording.value = true;
      transcript.value = "";
      metrics.value = null;
      statusMsg.value = "Starting...";
      startTime.current = Date.now();
      
      localTranscriber.onProgress = (msg) => {
        statusMsg.value = msg;
      };
      
      await localTranscriber.start();
      statusMsg.value = "Recording... (Speak now)";
    } catch (e) {
      console.error(e);
      statusMsg.value = "Error starting recording";
      isRecording.value = false;
    }
  };

  const handleStop = async () => {
    isRecording.value = false;
    isProcessing.value = true;
    const durationSec = (Date.now() - startTime.current) / 1000;
    lastDuration.value = durationSec;
    
    try {
      // Attempt local first
      let text = await localTranscriber.stop();
      
      // Fallback if local fails or returns empty (depending on logic)
      if (!text || text.trim().length === 0 || text.startsWith("[Error")) {
          console.warn("Local transcription failed/empty. Remote fallback requires architecture change to share audio blob.");
          statusMsg.value = "Local transcription failed.";
          // TODO: Implement proper fallback by passing audio blob to RemoteTranscriber
      }

      transcript.value = text;
      
      if (text) {
        // Calculate metrics using WASM
        try {
            const calculated = wasm.calculate_metrics_wasm(text);
            metrics.value = calculated;
            console.log("Metrics:", calculated);
        } catch (e) {
            console.error("WASM Error:", e);
            statusMsg.value = "Error calculating metrics";
        }
      }
    } catch (e) {
      console.error(e);
      statusMsg.value = "Error processing audio";
    } finally {
      isProcessing.value = false;
      statusMsg.value = "Ready";
    }
  };

  const resetSession = () => {
      transcript.value = "";
      metrics.value = null;
      statusMsg.value = "";
  };

  // Derived state for UI view
  const showIntro = !isRecording.value && !isProcessing.value && !metrics.value;
  const showRecording = isRecording.value;
  const showProcessing = isProcessing.value;
  const showResults = !!metrics.value;

  return (
    <div className="session-container animate-fade-in text-center">
      
      {showIntro && (
        <>
          <h1 className="heading-xl">Speako</h1>
          <p className="text-muted" style={{ marginBottom: "2rem", fontSize: "1.1rem" }}>
            Real-time local AI speech analysis.
          </p>
          <button className="btn-primary" onClick={handleStart}>
            Start Analysis
          </button>
           <p className="status-badge" style={{marginTop: '1rem'}}>{statusMsg.value}</p>
        </>
      )}

      {(showRecording || showProcessing) && (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
             {showProcessing ? (
               <div style={{ width: 60, height: 60, border: "4px solid var(--accent-primary)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite", margin: '0 auto 2rem auto' }}></div>
             ) : (
                <div className="visualizer-circle animate-pulse" style={{margin: '0 auto 2rem auto'}}>
                    <span style={{ fontSize: "3rem" }}>🎙️</span>
                </div>
             )}
             <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
             
             <p className="heading-lg mb-4">{showProcessing ? "Analyzing..." : "Listening..."}</p>
             <p className="text-muted mb-8">{statusMsg.value}</p>
             
             {showRecording && (
                <button className="btn-stop" onClick={handleStop}>Stop</button>
             )}
        </div>
      )}

      {showResults && metrics.value && (
        <div className="card-glass animate-fade-in mx-auto" style={{ width: "100%", maxWidth: "600px", textAlign: "left" }}>
          <h2 className="heading-lg mb-6 text-center">Session Results</h2>
          
          <div className="metric-grid grid grid-cols-2 gap-4 mb-6">
            <div className="metric-item p-4 bg-blue-50/50 rounded-xl text-center">
              <span className="metric-value block text-3xl font-bold text-blue-600">{metrics.value.word_count}</span>
              <span className="metric-label text-xs uppercase text-blue-400">Words</span>
            </div>
            
             <div className="metric-item p-4 bg-purple-50/50 rounded-xl text-center">
              <span className="metric-value block text-3xl font-bold text-purple-600">
                {lastDuration.value > 0 ? Math.round(metrics.value.word_count / (lastDuration.value / 60)) : 0}
              </span>
              <span className="metric-label text-xs uppercase text-purple-400">WPM</span>
            </div>

             {metrics.value.cefr_level && (
              <div className="col-span-2 metric-item p-6 bg-green-50/50 rounded-xl text-center border-2 border-green-100">
                <span className="metric-value block text-5xl font-black text-green-600 mb-2">{metrics.value.cefr_level}</span>
                <span className="metric-label text-xs uppercase text-green-500 tracking-widest">Estimated CEFR Level</span>
                
                <div className="mt-4 flex justify-center gap-6 text-sm text-gray-500">
                    <div className="flex flex-col">
                        <span className="font-bold text-gray-700">{metrics.value.unique_words}</span>
                        <span className="text-xs">Unique Words</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="font-bold text-gray-700">{metrics.value.complex_words}</span>
                        <span className="text-xs">Complex Words</span>
                    </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ padding: "1.5rem", background: "rgba(0,0,0,0.03)", borderRadius: "var(--radius-md)" }}>
            <p className="text-xs font-bold text-gray-400 uppercase mb-2">Transcript</p>
            <p className="text-gray-700 leading-relaxed text-lg">{transcript.value}</p>
          </div>

          <div style={{ marginTop: "2rem", textAlign: "center" }}>
             <button className="btn-secondary" onClick={resetSession}>Start New Session</button>
          </div>
        </div>
      )}
    </div>
  );
}
