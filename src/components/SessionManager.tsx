import { useSignal } from "@preact/signals";
import { useEffect, useRef, useCallback } from "preact/hooks";
import { Fragment } from "preact";
import { env } from "@huggingface/transformers";
import { LocalTranscriber, subscribeToLoadingState, ModelLoadingState } from "../logic/local-transcriber";
import { computeMetrics } from "../logic/metrics-calculator";
import { checkWebGPU } from "../logic/webgpu-check";

import { TranscriptionResult } from "../logic/transcriber";
import { GrammarChecker, AnalysisResult } from "../logic/grammar-checker";
import { AudioLevelIndicator } from "./AudioLevelIndicator";
import { DevicePicker } from "./DevicePicker";

// Transcribers can be singletons for this session manager
const localTranscriber = new LocalTranscriber();
export function SessionManager() {
  const view = useSignal<"idle" | "recording" | "processing" | "results">("idle");
  const transcript = useSignal<TranscriptionResult | null>(null);
  const metrics = useSignal<any>(null);
  const analysis = useSignal<AnalysisResult | null>(null);
  const statusMsg = useSignal("");
  const lastDuration = useSignal(0);
  const startTime = useRef(0);
  const elapsedTime = useSignal(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectedDeviceId = useSignal<string>("");
  const webGpuStatus = useSignal<{ isAvailable: boolean; message?: string } | null>(null);
  
  // Check WebGPU support on mount
  useEffect(() => {
    checkWebGPU().then(status => {
      webGpuStatus.value = status;
    });
  }, []);
  
  // Model loading state
  const modelLoadingState = useSignal<ModelLoadingState>({
    isLoading: false,
    isLoaded: false,
    progress: 0,
    error: null,
  });

  // Subscribe to model loading state
  useEffect(() => {
    const unsubscribe = subscribeToLoadingState((state) => {
      modelLoadingState.value = state;
    });
    return unsubscribe;
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
      statusMsg.value = "Loading model...";
      elapsedTime.value = 0;
      
      // Select transcriber based on config
      // Default to Local as it's the core feature.
      console.log("[SessionManager] Using LocalTranscriber.", selectedDeviceId.value ? `Device: ${selectedDeviceId.value}` : "(default)");
      localTranscriber.onProgress = (msg) => { statusMsg.value = msg; };
      await localTranscriber.start(selectedDeviceId.value || undefined);
      
      // Only start timer AFTER model is loaded and recording has started
      startTime.current = Date.now();
      timerRef.current = setInterval(() => {
        elapsedTime.value = Math.floor((Date.now() - startTime.current) / 1000);
      }, 1000);
      
      statusMsg.value = "Speak now...";
    } catch (e) {
      console.error("[SessionManager] Error starting transcription:", e);
      statusMsg.value = `Error starting: ${e}`;
      view.value = "idle";
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const handleStop = async () => {
    console.log("[SessionManager] User stopped recording.");
    
    // Stop elapsed timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    view.value = "processing";
    const durationSec = (Date.now() - startTime.current) / 1000;
    lastDuration.value = durationSec;
    
    // Stop recording and get text
    let result: TranscriptionResult = { text: "", words: [] };
    try {
      console.log("[SessionManager] Stopping LocalTranscriber...");
      result = await localTranscriber.stop();
      console.log(`[SessionManager] Transcription received: "${result.text.substring(0, 50)}..."`);
    } catch (e) {
      console.error("[SessionManager] Transcription failed:", e);
      statusMsg.value = `Error processing: ${e}`;
      transcript.value = { text: `Error: ${e}`, words: [] };
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

    // Calculate metrics using TypeScript
    try {
      console.log("[SessionManager] Calculating metrics...");
      
      const metricsResult = computeMetrics(result.text, result.words);
      console.log("[SessionManager] Metrics calculated:", metricsResult);
      
      metrics.value = {
        word_count: metricsResult.word_count,
        wpm: Math.round(metricsResult.word_count / (lastDuration.value / 60)),
        cefr_level: metricsResult.cefr_level,
        cefr_description: "",
        fluency_score: 0,
        unique_words: metricsResult.unique_words,
        complex_words: metricsResult.complex_words,
        pronunciation_score: metricsResult.pronunciation_score
      };
      
      // Calculate processing time
      console.log(`[SessionManager] Processing complete in ${Math.round(Date.now() - startTime.current)}ms`);
      
      // Run Grammar Check
      const analysisResult = GrammarChecker.check(result.text);
      analysis.value = analysisResult;
      
      view.value = "results";
    } catch (e) {
      console.error("[SessionManager] Metrics calculation failed:", e);
      statusMsg.value = `Error calculating metrics: ${e}`;
      metrics.value = null;
      // Still show the transcript even if metrics fail
      view.value = "results";
    }
  };

  const handleRetry = () => {
    console.log("[SessionManager] User retry/start new session.");
    view.value = "idle";
    transcript.value = null;
    metrics.value = null;
    analysis.value = null;
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
                            title={statusText}
                            onClick={() => alert(`System Status:\n\n${isAvailable ? '✅' : '⚠️'} ${statusText}`)}
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
      )}

      {(view.value === "recording" || view.value === "processing") && (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
             {view.value === "processing" ? (
               <>
                 <div style={{ width: 80, height: 80, border: "4px solid var(--accent-primary)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite", margin: '0 auto 2rem auto' }}></div>
                 <p className="heading-lg mb-2">Analyzing...</p>
                 <p className="text-muted mb-10" style={{ minHeight: '1.5em' }}>{statusMsg.value}</p>
               </>
             ) : (
                <div className="recording-panel">
                    {/* Elapsed Timer */}
                    <p className="elapsed-timer" style={{ textAlign: 'center' }}>
                      {Math.floor(elapsedTime.value / 60).toString().padStart(2, '0')}:
                      {(elapsedTime.value % 60).toString().padStart(2, '0')}
                    </p>
                    
                    {/* Audio Level Indicator */}
                    <AudioLevelIndicator 
                      getLevel={() => localTranscriber.getRecorder().getAudioLevel()} 
                      barCount={7}
                    />
                    
                    {/* Status */}
                    <p className="text-muted" style={{ textAlign: 'center', marginBottom: 'var(--spacing-lg)' }}>
                      {statusMsg.value}
                    </p>
                    
                    {/* Stop Button */}
                    <div style={{ textAlign: 'center' }}>
                      <button className="btn-stop" onClick={handleStop}>Stop Recording</button>
                    </div>
                </div>
             )}
             <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {view.value === "results" && (
        <div className="card-glass animate-fade-in mx-auto" style={{ width: "100%", maxWidth: "900px", textAlign: "left" }}>
          
          {/* Header */}
          <div className="dashboard-header">
              <div>
                <h2 className="heading-lg mb-1">Session Results</h2>
                <p className="text-muted text-sm">Great job! Here's how you performed.</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ display: 'block', fontSize: '1.8rem', fontWeight: 'bold', lineHeight: 1 }}>
                    {lastDuration.value > 0 ? new Date(lastDuration.value * 1000).toISOString().substr(14, 5) : "00:00"}
                </span>
                <span className="metric-label">Duration</span>
              </div>
          </div>

          {metrics.value ? (
          <div className="dashboard-layout">
            
            {/* Top Row: Primary Scores */}
            <div className="primary-metrics-grid">
                {/* Pronunciation */}
                <div className="metric-card-premium pronunciation">
                    <span className="value">
                        {metrics.value.pronunciation_score ?? 0}%
                    </span>
                    <span className="metric-label" style={{ color: 'var(--accent-success)' }}>Pronunciation</span>
                </div>

                {/* Clarity */}
                <div className="metric-card-premium clarity">
                     <span className="value">
                        {analysis.value?.clarityScore ?? 0}
                    </span>
                    <span className="metric-label" style={{ color: '#f59e0b' }}>Clarity Score</span>
                </div>

                {/* CEFR */}
                <div className="metric-card-premium cefr">
                    <span className="value">
                        {metrics.value.cefr_level}
                    </span>
                    <span className="metric-label" style={{ color: '#3b82f6' }}>CEFR Level</span>
                </div>
            </div>

            {/* Secondary Stats */}
            <div className="secondary-metrics-grid">
                 <div className="secondary-stat-item">
                     <span className="metric-subvalue">{metrics.value.word_count}</span>
                     <span style={{ display: 'block' }} className="metric-sublabel">Total Words</span>
                 </div>
                 <div className="secondary-stat-item">
                     <span className="metric-subvalue">
                        {lastDuration.value > 0 ? Math.round(metrics.value.word_count / (lastDuration.value / 60)) : 0}
                     </span>
                     <span style={{ display: 'block' }} className="metric-sublabel">WPM</span>
                 </div>
                 <div className="secondary-stat-item">
                     <span className="metric-subvalue">{metrics.value.unique_words}</span>
                     <span style={{ display: 'block' }} className="metric-sublabel">Unique</span>
                 </div>
                 <div className="secondary-stat-item">
                     <span className="metric-subvalue">{metrics.value.complex_words}</span>
                     <span style={{ display: 'block' }} className="metric-sublabel">Complex</span>
                 </div>
            </div>

            <div className="details-grid">
                {/* Transcript */}
                <div className="transcript-box">
                    <div className="flex justify-between items-center mb-4" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <p className="metric-label">Transcript</p>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }}></span>
                            <span className="metric-sublabel" style={{ fontSize: '0.65rem' }}>Unclear</span>
                        </div>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, maxHeight: '300px', overflowY: 'auto' }}>
                        {transcript.value?.words && transcript.value.words.length > 0 ? (
                            transcript.value.words.map((w, i) => (
                                <Fragment key={i}>
                                    <span title={`Confidence: ${Math.round(w.score * 100)}%`} 
                                        style={{ 
                                            color: w.score < 0.7 ? '#ef4444' : w.score < 0.85 ? '#fbbf24' : 'inherit',
                                            borderBottom: w.score < 0.7 ? '1px dashed rgba(239, 68, 68, 0.4)' : 'none',
                                            paddingBottom: w.score < 0.7 ? '2px' : '0',
                                            cursor: 'help',
                                            transition: 'color 0.2s'
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

                {/* Teacher's Notes */}
                {analysis.value && (
                   <div className="teacher-report">
                       <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
                           <p className="metric-label">Teacher's Report</p>
                           <span style={{ fontSize: '1.2rem' }}>👨‍🏫</span>
                       </div>
                       
                       <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', maxHeight: '400px', overflowY: 'auto' }}>
                           {/* Positive Feedback */}
                           {analysis.value.positivePoints.length > 0 && (
                               <div>
                                   <p className="metric-sublabel" style={{ color: '#4ade80', marginBottom: '0.5rem' }}>Strengths</p>
                                   <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                   {analysis.value.positivePoints.map((point, idx) => (
                                        <div key={`pos-${idx}`} style={{ display: 'flex', gap: '10px', alignItems: 'start' }}>
                                            <span style={{ color: '#4ade80', fontSize: '0.8rem', marginTop: '2px' }}>✨</span>
                                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>{point}</p>
                                        </div>
                                   ))}
                                   </div>
                               </div>
                           )}

                           {/* Unclear Words */}
                           {transcript.value?.words && transcript.value.words.some(w => w.score < 0.7) && (
                               <div>
                                   <p className="metric-sublabel" style={{ color: '#ef4444', marginBottom: '0.5rem' }}>Pronunciation Check</p>
                                   <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                       {transcript.value.words.filter(w => w.score < 0.7).map((w, i) => (
                                           <span key={i} style={{ 
                                               fontSize: '0.8rem', padding: '4px 8px', borderRadius: '4px',
                                               background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.2)' 
                                            }}>
                                               {w.word}
                                           </span>
                                       ))}
                                   </div>
                                   <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '6px' }}>
                                       Low confidence detected. Try articulating these words more clearly.
                                   </p>
                               </div>
                           )}

                           {/* Improvements */}
                           <div>
                               <p className="metric-sublabel" style={{ color: '#fbbf24', marginBottom: '0.5rem' }}>Tips & Suggestions</p>
                               <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                               {analysis.value.issues.length > 0 ? (
                                   analysis.value.issues.map((issue, idx) => (
                                       <div key={idx} style={{ 
                                           background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)'
                                       }}>
                                           <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                                                <span style={{ fontSize: '0.8rem' }}>{issue.category === 'confidence' ? '🛡️' : issue.category === 'clarity' ? '👁️' : '💡'}</span>
                                                <span className="metric-sublabel">{issue.type}</span>
                                           </div>
                                           <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 4px 0' }}>{issue.message}</p>
                                           {issue.replacement && (
                                               <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', margin: 0 }}>
                                                   Try instead: <span style={{ color: '#60a5fa', fontFamily: 'monospace' }}>{issue.replacement}</span>
                                               </p>
                                           )}
                                       </div>
                                    ))
                                ) : (
                                    <p style={{ fontSize: '0.9rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No specific grammar issues found. Keep it up!</p>
                                )}
                                </div>
                            </div>
                        </div>
                   </div>
                )}
            </div>
            
          </div>
          ) : (
            <div style={{ padding: '2rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)', textAlign: 'center', marginBottom: '1.5rem' }}>
                <p style={{ color: '#fca5a5', fontWeight: 'bold', marginBottom: '0.5rem' }}>Analysis Failed</p>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{statusMsg.value}</p>
            </div>
          )}

            <div style={{ marginTop: "3rem", textAlign: "center" }}>
               <button className="btn-primary" onClick={handleRetry}>
                 Start New Session
               </button>
            </div>
        </div>
      )}
    </div>
  );
}
