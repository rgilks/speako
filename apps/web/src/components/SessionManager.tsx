import { Signal, useSignal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import { LocalTranscriber } from "../logic/local-transcriber";
import { RemoteTranscriber } from "../logic/remote-transcriber";
// In real app, we'd import the WASM module dynamically or via the plugin
import * as wasm from "../../../../crates/client/pkg/speako_client";

type SessionState = "idle" | "loading_model" | "recording" | "analyzing" | "results";

export function SessionManager() {
  const state = useSignal<SessionState>("idle");
  const transcript = useSignal("");
  const metrics = useSignal<any>(null);
  const statusMsg = useSignal("");
  
  // Instance for the component
  const localTranscriber = new LocalTranscriber();
  const remoteTranscriber = new RemoteTranscriber();
  // mutable ref to track which one is active
  const activeTranscriber = useRef<any>(localTranscriber);

  // Hook up progress callback for both
  const onProgress = (msg: string) => {
    statusMsg.value = msg;
  };
  localTranscriber.onProgress = onProgress;
  remoteTranscriber.onProgress = onProgress;

  const startSession = async () => {
    statusMsg.value = "Initializing...";
    state.value = "loading_model";
    
    try {
      console.log("Attempting local transcription...");
      activeTranscriber.current = localTranscriber;
      await localTranscriber.start();
    } catch (e) {
      console.warn("Local model failed, falling back to remote:", e);
      statusMsg.value = "Local AI failed. Switching to Cloud...";
      // Give UI a moment to show the message
      await new Promise(r => setTimeout(r, 1000));
      
      activeTranscriber.current = remoteTranscriber;
      try {
        await remoteTranscriber.start();
      } catch (remoteErr) {
        console.error("Remote failed too:", remoteErr);
        state.value = "idle";
        alert("Could not start recording (Local & Remote failed).");
        return;
      }
    }
    
    state.value = "recording";
  };

  const stopSession = async () => {
    state.value = "analyzing";
    let text = "";
    try {
      text = await activeTranscriber.current.stop();
    } catch (e) {
      console.error("Transcription failed:", e);
      text = "Error: Transcription failed.";
    }
    
    transcript.value = text;
    
    // Call Rust WASM
    const result = wasm.calculate_metrics_wasm(text);
    console.log("Wasm Result:", result);
    metrics.value = result;
    
    state.value = "results";
  };

  return (
    <div className="session-container animate-fade-in">
      
      {state.value === "idle" && (
        <>
          <h1 className="heading-xl">Speako</h1>
          <p className="text-muted" style={{ marginBottom: "2rem", fontSize: "1.1rem" }}>
            Real-time local AI speech analysis.
          </p>
          <button className="btn-primary" onClick={startSession}>
            Start Analysis
          </button>
        </>
      )}

      {state.value === "loading_model" && (
        <>
          <div style={{ width: 40, height: 40, border: "3px solid var(--accent-primary)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }}></div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p className="heading-lg">Initializing AI</p>
          <p className="status-badge">{statusMsg.value || "Loading model..."}</p>
        </>
      )}

      {state.value === "recording" && (
        <>
          <div className="visualizer-circle">
            <span style={{ fontSize: "2rem" }}>🎙️</span>
          </div>
          <p className="heading-lg animate-pulse">Listening...</p>
          <button className="btn-stop" onClick={stopSession}>Stop Recording</button>
        </>
      )}

      {state.value === "analyzing" && (
        <>
          <p className="heading-lg">Transcribing...</p>
          <p className="text-muted">Running local inference on device</p>
        </>
      )}

      {state.value === "results" && metrics.value && (
        <div className="card-glass animate-fade-in" style={{ width: "100%", maxWidth: "600px", textAlign: "left" }}>
          <h2 className="heading-lg" style={{ marginBottom: "1rem" }}>Session Results</h2>
          
          <div className="metric-grid">
            <div className="metric-item">
              <span className="metric-value">{metrics.value.word_count}</span>
              <span className="metric-label">Words</span>
            </div>
            <div className="metric-item">
              <span className="metric-value">{metrics.value.character_count}</span>
              <span className="metric-label">Characters</span>
            </div>
          </div>

          <div style={{ marginTop: "2rem", padding: "1rem", background: "rgba(0,0,0,0.2)", borderRadius: "var(--radius-md)" }}>
            <p className="text-muted" style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>TRANSCRIPT</p>
            <p style={{ lineHeight: "1.6" }}>{transcript.value}</p>
          </div>

          <div style={{ marginTop: "2rem", textAlign: "right" }}>
             <button className="btn-secondary" onClick={() => state.value = "idle"}>Start New Session</button>
          </div>
        </div>
      )}
    </div>
  );
}
