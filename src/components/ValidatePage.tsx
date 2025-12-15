/**
 * Full Pipeline Validation using WebGPU Whisper.
 * Validates: Transcription (WER), CEFR detection, Metrics, Grammar.
 * Access: http://localhost:5173/#validate
 */

import { useSignal } from "@preact/signals";
import { env } from "@huggingface/transformers";
import { ModelSingleton } from "../logic/model-loader";
import { computeMetricsWithML } from "../logic/metrics-calculator";
import { GrammarChecker } from "../logic/grammar-checker";
import { loadCEFRClassifier, isCEFRClassifierReady } from "../logic/cefr-classifier";
import { ValidationResult, WHISPER_MODELS } from "../types/validation";
import { parseSTM, calculateWER, shuffleArray } from "../logic/validation-utils";
import { SummaryCards } from "./validation/SummaryCards";
import { ResultsTable } from "./validation/ResultsTable";
import { ResultDetailView } from "./validation/ResultDetailView";
import { ValidationControls } from "./validation/ValidationControls";

// Configure local caching for Transformers.js
env.allowLocalModels = true; 
env.useBrowserCache = true;

export function ValidatePage() {
  const status = useSignal("Ready");
  const progress = useSignal(0);
  const totalFiles = useSignal(0);
  const results = useSignal<ValidationResult[]>([]);
  const isRunning = useSignal(false);
  const isComplete = useSignal(false);
  const fileLimit = useSignal(10);
  const selectedModel = useSignal(WHISPER_MODELS[3].id);

  const avgWER = useSignal(0);
  const cefrAccuracy = useSignal(0);
  const avgClarity = useSignal(0);
  const selectedResult = useSignal<ValidationResult | null>(null);

  async function runValidation() {
    isRunning.value = true;
    results.value = [];
    
    try {
      status.value = `Loading ${selectedModel.value}...`;
      const model = await ModelSingleton.getInstance(selectedModel.value, (data: any) => {
        if (data.status === 'progress' && data.progress) {
          status.value = `Loading Whisper... ${Math.round(data.progress)}%`;
        }
      });
      
      if (!isCEFRClassifierReady()) {
        status.value = "Loading CEFR classifier...";
        try {
          await loadCEFRClassifier();
        } catch (e) {
          console.warn('[Validation] CEFR classifier not available:', e);
        }
      }

      status.value = "Loading references...";
      const stmRes = await fetch('/test-data/reference-materials/stms/dev-asr.stm');
      if (!stmRes.ok) throw new Error('Could not load STM');
      const references = parseSTM(await stmRes.text());

      const tsvRes = await fetch('/test-data/reference-materials/flists.flac/dev-asr.tsv');
      if (!tsvRes.ok) throw new Error('Could not load TSV');
      const tsvText = await tsvRes.text();

      const allFiles = tsvText.split('\n')
        .filter(l => l.trim())
        .map(l => {
          const [fileId, path] = l.split('\t');
          return { fileId, path };
        });

      shuffleArray(allFiles);
      const filesToProcess = allFiles.slice(0, fileLimit.value);
      totalFiles.value = filesToProcess.length;
      
      const validationResults: ValidationResult[] = [];
      
      for (let i = 0; i < filesToProcess.length; i++) {
        const { fileId } = filesToProcess[i];
        const ref = references.get(fileId)!;
        progress.value = i + 1;
        status.value = `[${i + 1}/${filesToProcess.length}] ${fileId}`;

        try {
          const startTime = performance.now();
          
          const audioRes = await fetch(`/test-data/data/flac/dev/${fileId}.flac`);
          if (!audioRes.ok) continue;
          const audioBlob = await audioRes.blob();
          const arrayBuffer = await audioBlob.arrayBuffer();
          const audioContext = new OfflineAudioContext(1, 1, 16000);
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          const monoData = audioBuffer.getChannelData(0);
          
          const output = await model(monoData, {
            language: "english",
            return_timestamps: "word",
            chunk_length_s: 30
          });
          
          const hypothesis = output.text || '';
          const words = (output.chunks || []).map((c: any) => ({
            word: c.text,
            start: c.timestamp?.[0] ?? 0,
            end: c.timestamp?.[1] ?? 0,
            score: 0.95
          }));

          const metrics = await computeMetricsWithML(hypothesis);
          const grammarAnalysis = GrammarChecker.check(hypothesis);
          
          const wer = calculateWER(ref.transcript, hypothesis);
          const detectedCEFR = metrics.cefr_level;
          const labeledCEFR = ref.labeledCEFR;
          
          const endTime = performance.now();
          
          validationResults.push({
            fileId,
            reference: ref.transcript,
            hypothesis,
            wer,
            labeledCEFR,
            detectedCEFR,
            cefrMatch: detectedCEFR.startsWith(labeledCEFR) || labeledCEFR.startsWith(detectedCEFR),
            wordCount: metrics.word_count,
            clarityScore: metrics.pronunciation_score || 0,
            grammarIssues: grammarAnalysis.issues.length,
            processingTimeMs: Math.round(endTime - startTime),
            audioBlob,
            fullMetrics: metrics,
            grammarAnalysis,
            words
          });
          
          results.value = [...validationResults];
        } catch (err) {
          console.error(`Error processing ${fileId}:`, err);
        }
      }

      // Calculate averages
      if (validationResults.length > 0) {
        avgWER.value = validationResults.reduce((s, r) => s + r.wer, 0) / validationResults.length;
        cefrAccuracy.value = validationResults.filter(r => r.cefrMatch).length / validationResults.length;
        avgClarity.value = validationResults.reduce((s, r) => s + r.clarityScore, 0) / validationResults.length;
      }
      
      isComplete.value = true;
      status.value = "Validation complete!";
    } catch (err) {
      status.value = `Error: ${err}`;
      console.error(err);
    } finally {
      isRunning.value = false;
    }
  }

  // Expose for E2E testing
  if (typeof window !== 'undefined') {
    (window as any).startValidation = (modelId: string, limit: number) => {
        selectedModel.value = modelId;
        fileLimit.value = limit;
        runValidation();
    };
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
        <h1 style={{ margin: 0 }}>🧪 Full Pipeline Validation</h1>
        <span style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: 'white', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>
          ⚡ WebGPU
        </span>
      </div>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
        Validates: Transcription (WER), CEFR Detection, Metrics, Grammar
      </p>
      
      <div className="card-glass" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <p><strong>Status:</strong> {status.value}</p>
        
        <ValidationControls
          selectedModel={selectedModel.value}
          fileLimit={fileLimit.value}
          isRunning={isRunning.value}
          isComplete={isComplete.value}
          onModelChange={(id) => selectedModel.value = id}
          onFileLimitChange={(limit) => fileLimit.value = limit}
          onStartValidation={runValidation}
        />
        
        {totalFiles.value > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '8px', height: '6px', overflow: 'hidden' }}>
              <div style={{ background: '#8b5cf6', height: '100%', width: `${(progress.value / totalFiles.value) * 100}%` }} />
            </div>
            <small>{progress.value}/{totalFiles.value}</small>
          </div>
        )}
      </div>
      
      {isComplete.value && (
        <div className="card-glass" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Pipeline Results</h3>
          
          <SummaryCards
            avgWER={avgWER.value}
            cefrAccuracy={cefrAccuracy.value}
            avgClarity={avgClarity.value}
            totalFiles={results.value.length}
          />
          
          <ResultsTable
            results={results.value}
            selectedFileId={selectedResult.value?.fileId || null}
            onSelectResult={(r) => selectedResult.value = r}
          />
          
          {!selectedResult.value && (
            <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.85rem', marginTop: '1rem' }}>
              👆 Click a row to see full results with audio visualizer
            </p>
          )}
        </div>
      )}
      
      {selectedResult.value && (
        <ResultDetailView
          result={selectedResult.value}
          onClose={() => selectedResult.value = null}
        />
      )}
    </div>
  );
}
