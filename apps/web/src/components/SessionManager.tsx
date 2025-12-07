import { useSignal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import { Fragment } from "preact";
import { env } from "@xenova/transformers";
import { LocalTranscriber } from "../logic/local-transcriber";
import { RemoteTranscriber } from "../logic/remote-transcriber";
// In real app, we'd import the WASM module dynamically or via the plugin
import * as wasm from "../../../../crates/client/pkg/speako_client";

import { TranscriptionResult } from "../logic/transcriber";
import { GrammarChecker, GrammarIssue } from "../logic/grammar-checker";

// Transcribers can be singletons for this session manager
const localTranscriber = new LocalTranscriber();
const remoteTranscriber = new RemoteTranscriber();
export function SessionManager() {
  const view = useSignal<"idle" | "recording" | "processing" | "results">("idle");
  const transcript = useSignal<TranscriptionResult | null>(null);
  const metrics = useSignal<any>(null);
  const grammarIssues = useSignal<GrammarIssue[]>([]);
  const statusMsg = useSignal("");
  const lastDuration = useSignal(0);
  const startTime = useRef(0);

  useEffect(() => {
    try {
      console.log("WASM Module loaded:", Object.keys(wasm));
      const wasmModule = wasm as any;
      if (wasmModule.init) {
          wasmModule.init();
          console.log("WASM Panic Hook initialized.");
      }
    } catch (e) {
      console.error("Failed to init WASM:", e);
    }
  }, []);

  // Topic Generator Logic
  const topics = [
      "Describe a memorable journey you have taken.",
      "Talk about a hobby you enjoy and why.",
      "Describe your favorite book or movie.",
      "Talk about a goal you want to achieve in the future.",
      "Describe a person who has influenced you.",
      "Talk about your hometown and what makes it special.",
      "Describe a challenging situation you overcame.",
      "Talk about the importance of learning new languages."
  ];

  const currentTopic = useSignal(topics[Math.floor(Math.random() * topics.length)]);

  const generateTopic = () => {
    let newTopic = currentTopic.value;
    while (newTopic === currentTopic.value) {
        newTopic = topics[Math.floor(Math.random() * topics.length)];
    }
    currentTopic.value = newTopic;
  };

  /* -------------------------------------------------------------------------- */
  /*                            Lifecycle / Handlers                            */
  /* -------------------------------------------------------------------------- */

  const handleStart = async () => {
    console.log("[SessionManager] User initiated recording.");
    view.value = "recording";
    try {
      transcript.value = null;
      metrics.value = null;
      statusMsg.value = "Starting...";
      startTime.current = Date.now();
      
      // Select transcriber based on config
      // Default to Local as it's the core feature. Remote is fallback.
      if (env.allowLocalModels) {
         console.log("[SessionManager] Using LocalTranscriber.");
         localTranscriber.onProgress = (msg) => { statusMsg.value = msg; };
         await localTranscriber.start();
      } else {
         console.log("[SessionManager] Using RemoteTranscriber (env.allowLocalModels=false).");
         remoteTranscriber.onProgress = (msg) => { statusMsg.value = msg; };
         await remoteTranscriber.start();
      }
      
      statusMsg.value = "Recording... (Speak now)";
    } catch (e) {
      console.error("[SessionManager] Error starting transcription:", e);
      statusMsg.value = `Error starting: ${e}`;
      view.value = "idle";
    }
  };

  const handleStop = async () => {
    console.log("[SessionManager] User stopped recording."); // Added log
    view.value = "processing";
    const durationSec = (Date.now() - startTime.current) / 1000; // Original duration calculation
    lastDuration.value = durationSec; // Original duration update
    
    // Stop recording and get text
    let result: TranscriptionResult = { text: "", words: [] };
    try {
      if (env.allowLocalModels) {
        console.log("[SessionManager] Stopping LocalTranscriber...");
        result = await localTranscriber.stop();
      } else {
        console.log("[SessionManager] Stopping RemoteTranscriber...");
        result = await remoteTranscriber.stop();
      }
      console.log(`[SessionManager] Transcription received: "${result.text.substring(0, 50)}..."`);
    } catch (e) {
      console.error("[SessionManager] Transcription failed:", e);
      statusMsg.value = `Error processing: ${e}`; // Original status update
      transcript.value = { text: `Error: ${e}`, words: [] }; // Original error message
      view.value = "results";
      return;
    }
    
    // Handle empty or error results gracefully
    if (!result.text || result.text.trim().length === 0 || result.text.startsWith("[Error") || result.text.includes("[BLANK_AUDIO]")) {
        console.warn("[SessionManager] Received empty, error, or blank transcript.");
        if (result.text.startsWith("[Error")) {
            transcript.value = result;
        } else {
            transcript.value = { text: "[No speech detected]", words: [] }; 
        }
        metrics.value = null; // Clear metrics
        statusMsg.value = "Transcription returned no text. Try speaking louder.";
        view.value = "results";
        return;
    }

    transcript.value = result;

    // Calculate metrics using WASM
    try {
      console.log("[SessionManager] Calculating metrics..."); // Added log
      // The provided edit used `speako_client`. Assuming it refers to `wasm` here.
      // If `speako_client` is a different global, it needs to be defined.
      if (!wasm) { // Changed from speako_client to wasm
        console.error("[SessionManager] WASM module not loaded!");
        throw new Error("WASM module not loaded");
      }
      
      const metricsResult = wasm.calculate_metrics_wasm(result.text); // Changed from speako_client to wasm
      console.log("[SessionManager] Metrics calculated:", metricsResult); // Added log
      
      // Parse CEFR: "B2 (Upper Intermediate)" -> "B2"
      let cefr = "N/A";
      let description = "";
      if (metricsResult.cefr_level) {
        const parts = metricsResult.cefr_level.split(" ");
        cefr = parts[0];
        description = parts.slice(1).join(" ").replace(/[()]/g, "");
      }
      
      // The provided edit changed the structure of metrics.value.
      // Applying this change.
      metrics.value = {
        word_count: metricsResult.word_count, // Keep original field
        wpm: Math.round(metricsResult.wpm || (metricsResult.word_count / (lastDuration.value / 60))), // Calculate WPM if not present, using original duration
        cefr_level: cefr,
        cefr_description: description,
        fluency_score: Math.round(metricsResult.fluency_score || 0),
        unique_words: metricsResult.unique_words,
        complex_words: metricsResult.complex_words
      };
      
      console.log(`[SessionManager] Processing complete in ${Math.round(Date.now() - startTime.current)}ms`); // Added log, using original startTime
      
      // Run Grammar Check
      const issues = GrammarChecker.check(result.text);
      grammarIssues.value = issues;
      
      view.value = "results";
    } catch (e) {
      console.error("[SessionManager] Metrics calculation failed:", e); // Added log
      statusMsg.value = `Error calculating metrics: ${e}`; // Original status update
      metrics.value = null;
      // Still show the transcript even if metrics fail
      view.value = "results";
    }
  };

  const handleRetry = () => { // Renamed from resetSession to handleRetry as per edit
    console.log("[SessionManager] User retry/start new session."); // Added log
    view.value = "idle";
    transcript.value = null;
    metrics.value = null;
    grammarIssues.value = [];
    statusMsg.value = "";
  };

  return (
    <div className="session-container animate-fade-in text-center">
      
      {view.value === "idle" && (
        <>
          <h1 className="heading-xl">Speako</h1>
          <p className="text-muted" style={{ marginBottom: "2rem", fontSize: "1.1rem" }}>
            Real-time local AI speech analysis.
          </p>
          
           {/* Topic Generator Card */}
          <div className="card-glass" style={{ margin: "0 auto 2rem auto", maxWidth: "400px", textAlign: 'left', padding: '1.5rem' }}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
                 <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-secondary)' }}>Speaking Topic</span>
                 <button onClick={generateTopic} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }} title="New Topic">🔄</button>
              </div>
              <p style={{ fontSize: '1.1rem', lineHeight: '1.4', fontWeight: 500 }}>
                  {currentTopic.value}
              </p>
          </div>

          <button className="btn-primary" onClick={handleStart}>
            Start Analysis
          </button>
           {statusMsg.value && (
             <p className="status-badge" style={{marginTop: '2rem', animation: 'fadeIn 0.3s ease-out'}}>
                {statusMsg.value}
             </p>
           )}
        </>
      )}

      {(view.value === "recording" || view.value === "processing") && (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
             {view.value === "processing" ? (
               <div style={{ width: 80, height: 80, border: "4px solid var(--accent-primary)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite", margin: '0 auto 3rem auto' }}></div>
             ) : (
                <div className="visualizer-circle animate-pulse" style={{margin: '0 auto 3rem auto'}}>
                    <span style={{ fontSize: "3rem" }}>🎙️</span>
                </div>
             )}
             <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
             
             <p className="heading-lg mb-2">{view.value === "processing" ? "Analyzing..." : "Listening..."}</p>
             <p className="text-muted mb-10" style={{ minHeight: '1.5em' }}>{statusMsg.value}</p>
             
             {view.value === "recording" && (
                <button className="btn-stop" onClick={handleStop}>Stop Analysis</button>
             )}
        </div>
      )}

      {view.value === "results" && (
        <div className="card-glass animate-fade-in mx-auto" style={{ width: "100%", maxWidth: "600px", textAlign: "left" }}>
          <h2 className="heading-lg mb-6 text-center">Session Results</h2>
          
          {metrics.value ? (
          <div className="metric-grid grid grid-cols-2 gap-4 mb-6">
            <div className="metric-item accent-blue">
              <span className="metric-value">{metrics.value.word_count}</span>
              <span className="metric-label">Words</span>
            </div>
            
             <div className="metric-item accent-purple">
              <span className="metric-value">
                {lastDuration.value > 0 ? Math.round(metrics.value.word_count / (lastDuration.value / 60)) : 0}
              </span>
              <span className="metric-label">WPM</span>
            </div>

             {metrics.value.cefr_level && (
              <div className="col-span-2 metric-item accent-green">
                <span className="metric-value" style={{ fontSize: '3rem' }}>{metrics.value.cefr_level}</span>
                <span className="metric-label">Estimated CEFR Level</span>
                
                <div className="metric-footer">
                    <div className="metric-subitem">
                        <span className="metric-subvalue">{metrics.value.unique_words}</span>
                        <span className="metric-sublabel">Unique Words</span>
                    </div>
                    <div className="metric-subitem">
                        <span className="metric-subvalue">{metrics.value.complex_words}</span>
                        <span className="metric-sublabel">Complex Words</span>
                    </div>
                </div>
              </div>
            )}
          </div>
          ) : (
            <div className="p-4 bg-red-50 rounded-xl border border-red-100 text-center mb-6">
                <p className="text-red-500 font-bold">Metrics Unavailable</p>
                <p className="text-xs text-red-400">{statusMsg.value || "Analysis failed"}</p>
            </div>
          )}

          <div style={{ padding: "1.5rem", background: "rgba(0,0,0,0.03)", borderRadius: "var(--radius-md)" }}>
            <p className="text-xs font-bold text-gray-400 uppercase mb-2">Transcript & Clarity</p>
            <p className="text-gray-700 leading-relaxed text-lg" style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}>
                {transcript.value?.words && transcript.value.words.length > 0 ? (
                    transcript.value.words.map((w, i) => (
                        <Fragment key={i}>
                            <span title={`Confidence: ${Math.round(w.score * 100)}%`} 
                                style={{ 
                                    color: w.score < 0.7 ? '#ef4444' : w.score < 0.9 ? '#eab308' : 'inherit',
                                    cursor: 'help'
                                }}>
                                {w.word}
                            </span>
                            {" "}
                        </Fragment>
                    ))
                ) : (
                    transcript.value?.text || ""
                )}
            </p>
          </div>

          {grammarIssues.value.length > 0 && (
              <div style={{ marginTop: "1rem", padding: "1.5rem", background: "rgba(255,193,7,0.1)", borderRadius: "var(--radius-md)", border: "1px solid rgba(255,193,7,0.2)" }}>
                <p className="text-xs font-bold text-yellow-600 uppercase mb-3">Feedback Hints</p>
                <div className="flex flex-col gap-2">
                    {grammarIssues.value.map((issue, idx) => (
                        <div key={idx} className="flex gap-3 items-start p-2 bg-white/50 rounded-md">
                            <span style={{ fontSize: '1.2rem' }}>{issue.type === 'suggestion' ? '💡' : '⚠️'}</span>
                            <div>
                                <p className="text-sm font-medium text-gray-800">{issue.message}</p>
                                {issue.replacement && (
                                    <p className="text-xs text-gray-500 mt-1">Try: <span className="font-mono text-blue-600">{issue.replacement}</span></p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
              </div>
          )}

             <div style={{ marginTop: "2rem", textAlign: "center" }}>
              <button className="btn-secondary" onClick={handleRetry}>Start New Session</button>
           </div>
        </div>
      )}
    </div>
  );
}
