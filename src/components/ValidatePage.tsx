import { useSignal } from "@preact/signals";
import { pipeline } from "@huggingface/transformers";

interface ValidationResult {
  fileId: string;
  reference: string;
  hypothesis: string;
  wer: number;
  cefrLevel: string;
  processingTimeMs: number;
}

interface STMEntry {
  fileId: string;
  transcript: string;
  metadata: string;
}

// Available Whisper models for WebGPU
const WHISPER_MODELS = [
  { id: 'Xenova/whisper-tiny.en', name: 'Tiny (39MB)', size: 39 },
  { id: 'Xenova/whisper-base.en', name: 'Base (74MB)', size: 74 },
  { id: 'Xenova/whisper-small.en', name: 'Small (241MB)', size: 241 },
  { id: 'distil-whisper/distil-small.en', name: 'Distil Small (166MB)', size: 166 },
];

/**
 * Browser-based validation using WebGPU Whisper.
 * Compares different model sizes to find optimal accuracy/size tradeoff.
 * Access: http://localhost:5173/#validate
 */
export function ValidatePage() {
  const status = useSignal("Ready");
  const progress = useSignal(0);
  const totalFiles = useSignal(0);
  const results = useSignal<ValidationResult[]>([]);
  const isRunning = useSignal(false);
  const isComplete = useSignal(false);
  const averageWER = useSignal(0);
  const fileLimit = useSignal(10);
  const selectedModel = useSignal(WHISPER_MODELS[0].id);
  const modelInstance = useSignal<any>(null);

  // Parse STM: fileId channel speaker start end <metadata> transcript
  // IMPORTANT: Aggregate all segments for each fileId into one transcript
  function parseSTM(content: string): Map<string, STMEntry> {
    const entries = new Map<string, STMEntry>();
    const segments: Map<string, { metadata: string; transcripts: string[] }> = new Map();
    
    for (const line of content.split('\n')) {
      if (line.startsWith(';;') || !line.trim()) continue;
      const match = line.match(/^(\S+)\s+\S+\s+\S+\s+[\d.]+\s+[\d.]+\s+<([^>]+)>\s+(.*)$/);
      if (match) {
        const [, fileId, metadata, transcript] = match;
        // Clean: remove disfluencies like (%hesitation%), (ga-)
        const clean = transcript
          .replace(/\(%[^)]+%\)/g, '')
          .replace(/\([^)]*-\)/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase();
        
        if (!segments.has(fileId)) {
          segments.set(fileId, { metadata, transcripts: [] });
        }
        if (clean) {
          segments.get(fileId)!.transcripts.push(clean);
        }
      }
    }
    
    // Combine all segments for each file
    for (const [fileId, data] of segments) {
      entries.set(fileId, {
        fileId,
        metadata: data.metadata,
        transcript: data.transcripts.join(' ')
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
        if (refWords[i-1] === hypWords[j-1]) {
          dp[i][j] = dp[i-1][j-1];
        } else {
          dp[i][j] = 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
        }
      }
    }
    return dp[m][n] / m;
  }

  function extractCEFR(metadata: string): string {
    const match = metadata.match(/[ABC][12]?/);
    return match ? match[0] : 'Unknown';
  }

  async function runValidation() {
    isRunning.value = true;
    results.value = [];
    
    try {
      // Load selected model
      status.value = `Loading ${selectedModel.value}...`;
      const model = await pipeline('automatic-speech-recognition', selectedModel.value, {
        device: 'webgpu',
        dtype: 'fp32',
        progress_callback: (data: any) => {
          if (data.status === 'progress' && data.progress) {
            status.value = `Loading model... ${Math.round(data.progress)}%`;
          }
        }
      });
      modelInstance.value = model;
      status.value = "Model loaded!";

      // Load reference transcripts
      status.value = "Loading references...";
      const stmRes = await fetch('/test-data/reference-materials/stms/dev-asr.stm');
      if (!stmRes.ok) throw new Error('Could not load STM file');
      const references = parseSTM(await stmRes.text());

      // Load file list to get WAV files
      const wavFiles: string[] = [];
      for (const fileId of references.keys()) {
        wavFiles.push(fileId);
        if (wavFiles.length >= fileLimit.value) break;
      }
      totalFiles.value = wavFiles.length;
      
      const validationResults: ValidationResult[] = [];
      let successCount = 0;
      
      for (let i = 0; i < wavFiles.length; i++) {
        const fileId = wavFiles[i];
        const ref = references.get(fileId);
        progress.value = i + 1;
        
        if (!ref) continue;
        status.value = `[${i + 1}/${wavFiles.length}] ${fileId}`;
        
        try {
          // Use pre-converted WAV files
          const audioUrl = `/test-data/wav-dev/${fileId}.wav`;
          const audioRes = await fetch(audioUrl);
          if (!audioRes.ok) {
            console.warn(`Missing WAV: ${fileId}`);
            continue;
          }
          
          const audioBlob = await audioRes.blob();
          const blobUrl = URL.createObjectURL(audioBlob);
          
          const startTime = Date.now();
          const output = await model(blobUrl, { return_timestamps: true });
          const processingTime = Date.now() - startTime;
          URL.revokeObjectURL(blobUrl);
          
          // Handle both single output and array output formats
          const result = Array.isArray(output) ? output[0] : output;
          const hypothesis = (result?.text || '').trim();
          const wer = calculateWER(ref.transcript, hypothesis);
          
          validationResults.push({
            fileId,
            reference: ref.transcript,
            hypothesis: hypothesis.toLowerCase(),
            wer,
            cefrLevel: extractCEFR(ref.metadata),
            processingTimeMs: processingTime
          });
          successCount++;
        } catch (e) {
          console.error(`Error: ${fileId}`, e);
        }
      }
      
      results.value = validationResults;
      if (validationResults.length > 0) {
        averageWER.value = validationResults.reduce((sum, r) => sum + r.wer, 0) / validationResults.length;
      }
      
      isComplete.value = true;
      status.value = `Done! ${successCount} files. Avg WER: ${(averageWER.value * 100).toFixed(1)}%`;
      
      console.log('VALIDATION_RESULTS:', JSON.stringify({
        model: selectedModel.value,
        timestamp: new Date().toISOString(),
        files: validationResults.length,
        avgWER: averageWER.value,
        results: validationResults
      }, null, 2));
      
    } catch (e) {
      status.value = `Error: ${e}`;
      console.error(e);
    }
    isRunning.value = false;
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
        <h1 style={{ margin: 0 }}>🧪 Speako Validation</h1>
        <span style={{ 
          background: 'linear-gradient(135deg, #22c55e, #16a34a)', 
          color: 'white', 
          padding: '4px 10px', 
          borderRadius: '12px', 
          fontSize: '0.75rem', 
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          ⚡ WebGPU
        </span>
      </div>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
        Compare Whisper models to find the best accuracy/size tradeoff
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
                {WHISPER_MODELS.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
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
              <div style={{ background: '#8b5cf6', height: '100%', width: `${(progress.value / totalFiles.value) * 100}%`, transition: 'width 0.2s' }} />
            </div>
            <small style={{ color: 'var(--text-tertiary)' }}>{progress.value}/{totalFiles.value}</small>
          </div>
        )}
      </div>
      
      {isComplete.value && (
        <div className="card-glass" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ background: 'rgba(139, 92, 246, 0.1)', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{results.value.length}</div>
              <small>Files</small>
            </div>
            <div style={{ background: averageWER.value < 0.15 ? 'rgba(34, 197, 94, 0.1)' : averageWER.value < 0.3 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{(averageWER.value * 100).toFixed(1)}%</div>
              <small>Avg WER</small>
            </div>
            <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{(results.value.reduce((s, r) => s + r.processingTimeMs, 0) / 1000).toFixed(1)}s</div>
              <small>Total Time</small>
            </div>
          </div>
          
          <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th style={{ textAlign: 'left', padding: '6px' }}>WER</th>
                <th style={{ textAlign: 'left', padding: '6px' }}>Reference</th>
                <th style={{ textAlign: 'left', padding: '6px' }}>Hypothesis</th>
              </tr>
            </thead>
            <tbody>
              {results.value.slice(0, 15).map(r => (
                <tr key={r.fileId} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '6px', color: r.wer < 0.15 ? '#4ade80' : r.wer < 0.3 ? '#fbbf24' : '#f87171', fontWeight: 'bold' }}>
                    {(r.wer * 100).toFixed(0)}%
                  </td>
                  <td style={{ padding: '6px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.reference}>
                    {r.reference}
                  </td>
                  <td style={{ padding: '6px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.hypothesis}>
                    {r.hypothesis}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
