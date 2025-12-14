import { useSignal } from "@preact/signals";
import { pipeline, env } from "@huggingface/transformers";
import { ModelSingleton } from "../logic/model-loader";
import { computeMetrics } from "../logic/metrics-calculator";
import { GrammarChecker } from "../logic/grammar-checker";

// Configure local caching for Transformers.js
// In browser environment, this uses the Cache API.
// We enable it explicitly to fulfill user request for caching.
env.allowLocalModels = true; 
env.useBrowserCache = true;

interface ValidationResult {
  fileId: string;
  reference: string;
  hypothesis: string;
  wer: number;
  // CEFR validation
  labeledCEFR: string;
  detectedCEFR: string;
  cefrMatch: boolean;
  // Full pipeline
  wordCount: number;
  clarityScore: number;
  grammarIssues: number;
  processingTimeMs: number;
}

interface STMEntry {
  fileId: string;
  transcript: string;
  labeledCEFR: string;
}

// All these Whisper models work with WebGPU (ONNX format)
const WHISPER_MODELS = [
  { id: 'Xenova/whisper-tiny.en', name: 'Tiny (English) (39MB)', size: 39 },
  { id: 'Xenova/whisper-tiny', name: 'Tiny (Multilingual) (39MB)', size: 39 },
  { id: 'Xenova/whisper-base.en', name: 'Base (English) (74MB)', size: 74 },
  { id: 'Xenova/whisper-base', name: 'Base (Multilingual) (74MB)', size: 74 },
  { id: 'Xenova/whisper-small.en', name: 'Small (English) (241MB)', size: 241 },
  { id: 'onnx-community/distil-small.en', name: 'Distil Small (English) (166MB)', size: 166 },
  { id: 'onnx-community/whisper-large-v3-turbo', name: 'Large v3 Turbo (800MB)', size: 800 },
];

/**
 * Full Pipeline Validation using WebGPU Whisper.
 * Validates: Transcription (WER), CEFR detection, Metrics, Grammar.
 * Access: http://localhost:5173/#validate
 */
export function ValidatePage() {
  const status = useSignal("Ready");
  const progress = useSignal(0);
  const totalFiles = useSignal(0);
  const results = useSignal<ValidationResult[]>([]);
  const isRunning = useSignal(false);
  const isComplete = useSignal(false);
  const fileLimit = useSignal(10);
  const selectedModel = useSignal(WHISPER_MODELS[1].id); // Default to Base

  // Aggregated scores
  const avgWER = useSignal(0);
  const cefrAccuracy = useSignal(0);
  const avgClarity = useSignal(0);

  // Parse STM with CEFR labels
  function parseSTM(content: string): Map<string, STMEntry> {
    const entries = new Map<string, STMEntry>();
    const segments: Map<string, { cefr: string; transcripts: string[] }> = new Map();
    
    for (const line of content.split('\n')) {
      if (line.startsWith(';;') || !line.trim()) continue;
      const match = line.match(/^(\S+)\s+\S+\s+\S+\s+[\d.]+\s+[\d.]+\s+<([^>]+)>\s+(.*)$/);
      if (match) {
        const [, fileId, metadata, transcript] = match;
        // Extract CEFR from metadata like "o,Q4,C,P1" where C = CEFR level
        const cefrMatch = metadata.match(/,([ABC][12]?),/);
        const labeledCEFR = cefrMatch ? cefrMatch[1] : 'Unknown';
        
        const clean = transcript
          .replace(/\(%[^)]+%\)/g, '')
          .replace(/\([^)]*-\)/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase();
        
        if (!segments.has(fileId)) {
          segments.set(fileId, { cefr: labeledCEFR, transcripts: [] });
        }
        if (clean) segments.get(fileId)!.transcripts.push(clean);
      }
    }
    
    for (const [fileId, data] of segments) {
      entries.set(fileId, {
        fileId,
        transcript: data.transcripts.join(' '),
        labeledCEFR: data.cefr
      });
    }
    return entries;
  }

  function normalize(text: string): string {
    return text.toLowerCase().replace(/[.,!?;:'"()\[\]{}]/g, '').replace(/\s+/g, ' ').trim();
  }

  function calculateWER(reference: string, hypothesis: string): number {
    const refWords = normalize(reference).split(/\s+/).filter(w => w);
    const hypWords = normalize(hypothesis).split(/\s+/).filter(w => w);
    if (refWords.length === 0) return hypWords.length === 0 ? 0 : 1;
    
    const m = refWords.length, n = hypWords.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = refWords[i-1] === hypWords[j-1] 
          ? dp[i-1][j-1] 
          : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
      }
    }
    return dp[m][n] / m;
  }

  async function runValidation() {
    isRunning.value = true;
    results.value = [];
    
    try {
      status.value = `Loading ${selectedModel.value}...`;
      const model = await ModelSingleton.getInstance(selectedModel.value, (data: any) => {
        if (data.status === 'progress' && data.progress) {
          status.value = `Loading model... ${Math.round(data.progress)}%`;
        }
      });

      status.value = "Loading references...";
      const stmRes = await fetch('/test-data/reference-materials/stms/dev-asr.stm');
      if (!stmRes.ok) throw new Error('Could not load STM');
      const references = parseSTM(await stmRes.text());

      // Load TSV for file paths
      const tsvRes = await fetch('/test-data/reference-materials/flists.flac/dev-asr.tsv');
      if (!tsvRes.ok) throw new Error('Could not load TSV');
      const tsvText = await tsvRes.text();

      const allFiles = tsvText.split('\n')
        .filter(l => l.trim())
        .map(l => {
          const [fileId, path] = l.split('\t');
          return { fileId, path };
        });

      // Shuffle files to get a random sample (Fisher-Yates shuffle)
      for (let i = allFiles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allFiles[i], allFiles[j]] = [allFiles[j], allFiles[i]];
      }

      // Take requested number of files from random sample
      const filesToProcess = allFiles.slice(0, fileLimit.value);
      
      totalFiles.value = filesToProcess.length;
      
      const validationResults: ValidationResult[] = [];
      
      for (let i = 0; i < filesToProcess.length; i++) {
        const { fileId } = filesToProcess[i];
        const ref = references.get(fileId)!;
        progress.value = i + 1;
        status.value = `[${i + 1}/${filesToProcess.length}] ${fileId}`;
        
        try {
          const audioUrl = `/test-data/wav-dev/${fileId}.wav`; // Use converted WAV files
          const audioRes = await fetch(audioUrl);
          if (!audioRes.ok) {
             console.warn(`Missing file: ${fileId} (${audioRes.status})`);
             continue;
          }
          
          const contentType = audioRes.headers.get('content-type');
          if (contentType && contentType.includes('text/html')) {
              console.warn(`File not found (served as HTML): ${fileId}`);
              continue; // Skip SPA fallback responses
          }

          const blob = await audioRes.blob();
          const blobUrl = URL.createObjectURL(blob);
          const startTime = Date.now();
          const output = await model(blobUrl, { return_timestamps: true });
          const processingTime = Date.now() - startTime;
          URL.revokeObjectURL(blobUrl);
          
          const result = Array.isArray(output) ? output[0] : output;
          const hypothesis = (result?.text || '').trim();
          
          // Full pipeline
          const metrics = computeMetrics(hypothesis);
          const grammar = GrammarChecker.check(hypothesis);
          
          const wer = calculateWER(ref.transcript, hypothesis);
          const cefrMatch = metrics.cefr_level === ref.labeledCEFR || 
                           (ref.labeledCEFR === 'C' && metrics.cefr_level.startsWith('C'));
          
          validationResults.push({
            fileId,
            reference: ref.transcript,
            hypothesis: hypothesis.toLowerCase(),
            wer,
            labeledCEFR: ref.labeledCEFR,
            detectedCEFR: metrics.cefr_level,
            cefrMatch,
            wordCount: metrics.word_count,
            clarityScore: grammar.clarityScore,
            grammarIssues: grammar.issues.length,
            processingTimeMs: processingTime
          });
        } catch (e) {
          console.error(`Error: ${fileId}`, e);
        }
      }
      
      results.value = validationResults;
      
      if (validationResults.length > 0) {
        avgWER.value = validationResults.reduce((s, r) => s + r.wer, 0) / validationResults.length;
        cefrAccuracy.value = validationResults.filter(r => r.cefrMatch).length / validationResults.length;
        avgClarity.value = validationResults.reduce((s, r) => s + r.clarityScore, 0) / validationResults.length;
      }
      
      isComplete.value = true;
      status.value = `Done! ${validationResults.length} files processed.`;
      
      // Build final results object
      const finalResults = {
        model: selectedModel.value,
        avgWER: avgWER.value,
        cefrAccuracy: cefrAccuracy.value,
        avgClarity: avgClarity.value,
        files: validationResults.length,
        results: validationResults
      };
      
      // Expose for Playwright tests
      (window as any).__validationResults = finalResults;
      
      console.log('VALIDATION_RESULTS:', JSON.stringify(finalResults, null, 2));
      
    } catch (e) {
      status.value = `Error: ${e}`;
    }
    isRunning.value = false;
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
        
        {!isRunning.value && (
          <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <label>
              Model:
              <select 
                value={selectedModel.value}
                onChange={(e) => selectedModel.value = (e.target as HTMLSelectElement).value}
                style={{ marginLeft: '0.5rem', padding: '6px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', color: 'inherit' }}
              >
                {WHISPER_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
            <label>
              Files:
              <input 
                type="number"
                value={fileLimit.value}
                onChange={(e) => fileLimit.value = parseInt((e.target as HTMLInputElement).value) || 10}
                style={{ marginLeft: '0.5rem', width: '60px', padding: '6px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', color: 'inherit' }}
              />
            </label>
            <button className="btn-primary" onClick={runValidation}>
              {isComplete.value ? 'Run Again' : 'Start Validation'}
            </button>
          </div>
        )}
        
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
          
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ background: avgWER.value < 0.2 ? 'rgba(34, 197, 94, 0.1)' : avgWER.value < 0.4 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{(avgWER.value * 100).toFixed(1)}%</div>
              <small>Avg WER</small>
            </div>
            <div style={{ background: cefrAccuracy.value > 0.5 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{(cefrAccuracy.value * 100).toFixed(0)}%</div>
              <small>CEFR Accuracy</small>
            </div>
            <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{avgClarity.value.toFixed(0)}</div>
              <small>Avg Clarity</small>
            </div>
            <div style={{ background: 'rgba(139, 92, 246, 0.1)', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{results.value.length}</div>
              <small>Files</small>
            </div>
          </div>
          
          {/* Results Table */}
          <div style={{ maxHeight: '400px', overflow: 'auto', fontSize: '0.75rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', position: 'sticky', top: 0, background: 'var(--card-bg, #1a1a1a)' }}>
                  <th style={{ textAlign: 'left', padding: '6px' }}>WER</th>
                  <th style={{ textAlign: 'left', padding: '6px' }}>CEFR (Detected/Expected)</th>
                  <th style={{ textAlign: 'left', padding: '6px' }}>Clarity</th>
                  <th style={{ textAlign: 'left', padding: '6px' }}>Grammar</th>
                  <th style={{ textAlign: 'left', padding: '6px' }}>Words</th>
                  <th style={{ textAlign: 'left', padding: '6px' }}>Transcript Sample</th>
                </tr>
              </thead>
              <tbody>
                {results.value.map(r => (
                  <tr key={r.fileId} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '6px', color: r.wer < 0.2 ? '#4ade80' : r.wer < 0.4 ? '#fbbf24' : '#f87171', fontWeight: 'bold' }}>
                      {(r.wer * 100).toFixed(0)}%
                    </td>
                    <td style={{ padding: '6px' }}>
                      <span style={{ color: r.cefrMatch ? '#4ade80' : '#f87171' }}>
                        {r.detectedCEFR}
                      </span>
                      <span style={{ color: 'var(--text-tertiary)', marginLeft: '4px' }}>
                        ({r.labeledCEFR})
                      </span>
                    </td>
                    <td style={{ padding: '6px' }}>{r.clarityScore}</td>
                    <td style={{ padding: '6px', color: r.grammarIssues === 0 ? '#4ade80' : '#fbbf24' }}>
                      {r.grammarIssues}
                    </td>
                    <td style={{ padding: '6px' }}>{r.wordCount}</td>
                    <td style={{ padding: '6px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.hypothesis}>
                      {r.hypothesis.slice(0, 60)}...
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
