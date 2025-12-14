import { useSignal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
// Adjust imports to valid relative paths
import { LocalTranscriber, subscribeToLoadingState, ModelLoadingState } from "../logic/local-transcriber";
import { computeMetricsWithML } from "../logic/metrics-calculator";
import { loadCEFRClassifier, isCEFRClassifierReady } from "../logic/cefr-classifier";
import { checkWebGPU } from "../logic/webgpu-check";
import { TranscriptionResult } from "../logic/transcriber";
import { GrammarChecker, AnalysisResult } from "../logic/grammar-checker";

// Transcribers can be singletons for this session manager
const localTranscriber = new LocalTranscriber();

export function useSessionManager() {
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

    const modelLoadingState = useSignal<ModelLoadingState>({
        isLoading: false,
        isLoaded: false,
        progress: 0,
        error: null,
    });

    useEffect(() => {
        const unsubscribe = subscribeToLoadingState((state) => {
            modelLoadingState.value = state;
        });
        return unsubscribe;
    }, []);

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

    const handleStart = async () => {
        console.log("[SessionManager] User initiated recording.");
        view.value = "recording";
        try {
            transcript.value = null;
            metrics.value = null;
            statusMsg.value = "Loading model...";
            elapsedTime.value = 0;

            console.log("[SessionManager] Using LocalTranscriber.", selectedDeviceId.value ? `Device: ${selectedDeviceId.value}` : "(default)");
            localTranscriber.onProgress = (msg) => { statusMsg.value = msg; };
            await localTranscriber.start(selectedDeviceId.value || undefined);

            // Only start timer AFTER model is loaded and recording has started
            startTime.current = Date.now();
            timerRef.current = setInterval(() => {
                elapsedTime.value = Math.floor((Date.now() - startTime.current) / 1000);
            }, 1000);

            statusMsg.value = "Speak now...";
            
            // Start loading CEFR classifier in background (non-blocking)
            // This way the model is ready by the time user finishes speaking
            if (!isCEFRClassifierReady()) {
                loadCEFRClassifier('/models/cefr-classifier')
                    .then(() => console.log("[SessionManager] CEFR classifier loaded (background)"))
                    .catch(e => console.warn("[SessionManager] CEFR classifier unavailable, will use heuristic", e));
            }
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

        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        view.value = "processing";
        const durationSec = (Date.now() - startTime.current) / 1000;
        lastDuration.value = durationSec;

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

        try {
            console.log("[SessionManager] Calculating metrics...");
            
            // Load CEFR classifier if not ready (first use)
            if (!isCEFRClassifierReady()) {
                try {
                    statusMsg.value = "Loading CEFR model...";
                    await loadCEFRClassifier('/models/cefr-classifier');
                    console.log("[SessionManager] CEFR classifier loaded");
                } catch (e) {
                    console.warn("[SessionManager] CEFR classifier not available, using heuristic", e);
                }
            }

            const metricsResult = await computeMetricsWithML(result.text, result.words);
            console.log(`[SessionManager] Metrics calculated (${metricsResult.cefr_method}):`, metricsResult);

            metrics.value = {
                word_count: metricsResult.word_count,
                wpm: Math.round(metricsResult.word_count / (lastDuration.value / 60)),
                cefr_level: metricsResult.cefr_level,
                cefr_description: metricsResult.cefr_method === 'ml' ? `${(metricsResult.cefr_confidence! * 100).toFixed(0)}% confidence` : 'heuristic',
                fluency_score: 0,
                unique_words: metricsResult.unique_words,
                complex_words: metricsResult.complex_words,
                pronunciation_score: metricsResult.pronunciation_score
            };

            console.log(`[SessionManager] Processing complete in ${Math.round(Date.now() - startTime.current)}ms`);

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

    return {
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
    };
}
