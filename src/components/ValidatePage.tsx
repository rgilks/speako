import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { ModelSingleton } from "../logic/model-loader";

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

/**
 * Browser-based validation page that uses WebGPU for fast transcription.
 * Access via: http://localhost:5173/validate
 * 
 * This page:
 * 1. Loads the STM reference file
 * 2. Loads FLAC audio files from the corpus
 * 3. Transcribes each with WebGPU Whisper
 * 4. Calculates WER against reference
 * 5. Outputs JSON results for the benchmark report
 */
export function ValidatePage() {
  const status = useSignal("Initializing...");
  const progress = useSignal(0);
  const totalFiles = useSignal(0);
  const results = useSignal<ValidationResult[]>([]);
  const isRunning = useSignal(false);
  const isComplete = useSignal(false);
  const averageWER = useSignal(0);

  // Parse STM content
  function parseSTM(content: string): Map<string, STMEntry> {
    const entries = new Map<string, STMEntry>();
    for (const line of content.split('\n')) {
      if (line.startsWith(';;') || !line.trim()) continue;
      const match = line.match(/^(\S+)\s+\S+\s+\S+\s+[\d.]+\s+[\d.]+\s+<([^>]+)>\s+(.*)$/);
      if (match) {
        const [, fileId, metadata, transcript] = match;
        const clean = transcript
          .replace(/\(%[^)]+%\)/g, '')
          .replace(/\([^)]*-\)/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase();
        entries.set(fileId, { fileId, metadata, transcript: clean });
      }
    }
    return entries;
  }

  // Calculate WER
  function calculateWER(reference: string, hypothesis: string): number {
    if (!reference) return hypothesis ? 1 : 0;
    const refWords = reference.split(/\s+/);
    const hypWords = hypothesis.toLowerCase().split(/\s+/);
    
    // Simple word-level edit distance
    const m = refWords.length;
    const n = hypWords.length;
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

  // Extract CEFR level
  function extractCEFR(metadata: string): string {
    const match = metadata.match(/[ABC][12]?/);
    return match ? match[0] : 'Unknown';
  }

  // Run validation
  async function runValidation() {
    isRunning.value = true;
    results.value = [];
    
    try {
      // Load model first
      status.value = "Loading Whisper model with WebGPU...";
      const model = await ModelSingleton.getInstance((data: any) => {
        if (data.status === 'progress') {
          status.value = `Loading model... ${Math.round(data.progress || 0)}%`;
        }
      });
      status.value = "Model loaded!";

      // Fetch STM file
      status.value = "Loading reference transcripts...";
      const stmRes = await fetch('/test-data/reference-materials/stms/dev-asr.stm');
      if (!stmRes.ok) throw new Error('Could not load STM file. Make sure test-data is symlinked.');
      const stmContent = await stmRes.text();
      const references = parseSTM(stmContent);
      status.value = `Loaded ${references.size} reference transcripts`;

      // For now, we'll process a sample of files that are accessible via HTTP
      // The user needs to serve the audio files or we use a file input
      const fileIds = Array.from(references.keys()).slice(0, 50); // Limit for demo
      totalFiles.value = fileIds.length;
      
      const validationResults: ValidationResult[] = [];
      
      for (let i = 0; i < fileIds.length; i++) {
        const fileId = fileIds[i];
        const ref = references.get(fileId)!;
        progress.value = i + 1;
        status.value = `Processing ${i + 1}/${fileIds.length}: ${fileId}`;
        
        try {
          // Try to fetch audio file
          const audioUrl = `/test-data/data/data/flac/dev/01/${fileId}.flac`;
          const audioRes = await fetch(audioUrl);
          
          if (!audioRes.ok) {
            // Try subdirectory 02
            const audioUrl2 = `/test-data/data/data/flac/dev/02/${fileId}.flac`;
            const audioRes2 = await fetch(audioUrl2);
            if (!audioRes2.ok) continue;
          }
          
          const startTime = Date.now();
          const output = await model(audioUrl, { return_timestamps: true });
          const processingTime = Date.now() - startTime;
          
          const hypothesis = (output.text || '').trim().toLowerCase();
          const wer = calculateWER(ref.transcript, hypothesis);
          
          validationResults.push({
            fileId,
            reference: ref.transcript,
            hypothesis,
            wer,
            cefrLevel: extractCEFR(ref.metadata),
            processingTimeMs: processingTime
          });
        } catch (e) {
          console.error(`Error processing ${fileId}:`, e);
        }
      }
      
      results.value = validationResults;
      
      // Calculate average WER
      if (validationResults.length > 0) {
        averageWER.value = validationResults.reduce((sum, r) => sum + r.wer, 0) / validationResults.length;
      }
      
      isComplete.value = true;
      status.value = `Complete! Processed ${validationResults.length} files. Average WER: ${(averageWER.value * 100).toFixed(2)}%`;
      
      // Output results as JSON for automation
      console.log('VALIDATION_RESULTS_START');
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        processedFiles: validationResults.length,
        averageWER: averageWER.value,
        results: validationResults
      }, null, 2));
      console.log('VALIDATION_RESULTS_END');
      
    } catch (e) {
      status.value = `Error: ${e}`;
      console.error(e);
    }
    
    isRunning.value = false;
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1rem' }}>🧪 Speako Validation</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
        Browser-based validation using WebGPU-accelerated Whisper
      </p>
      
      <div className="card-glass" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Status</h3>
        <p>{status.value}</p>
        
        {totalFiles.value > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <div style={{ 
              background: 'rgba(255,255,255,0.1)', 
              borderRadius: '8px', 
              height: '8px',
              overflow: 'hidden'
            }}>
              <div style={{
                background: 'linear-gradient(90deg, #6d28d9, #8b5cf6)',
                height: '100%',
                width: `${(progress.value / totalFiles.value) * 100}%`,
                transition: 'width 0.3s'
              }} />
            </div>
            <p style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: 'var(--text-tertiary)' }}>
              {progress.value} / {totalFiles.value} files
            </p>
          </div>
        )}
        
        {!isRunning.value && !isComplete.value && (
          <button 
            className="btn-primary" 
            onClick={runValidation}
            style={{ marginTop: '1rem' }}
          >
            Start Validation
          </button>
        )}
      </div>
      
      {isComplete.value && (
        <div className="card-glass" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Results</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ background: 'rgba(139, 92, 246, 0.1)', padding: '1rem', borderRadius: '8px' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{results.value.length}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Files Processed</div>
            </div>
            <div style={{ background: 'rgba(34, 197, 94, 0.1)', padding: '1rem', borderRadius: '8px' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{(averageWER.value * 100).toFixed(1)}%</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Average WER</div>
            </div>
            <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '1rem', borderRadius: '8px' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                {(results.value.reduce((sum, r) => sum + r.processingTimeMs, 0) / 1000).toFixed(1)}s
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Total Time</div>
            </div>
          </div>
          
          <h4 style={{ marginBottom: '0.5rem' }}>Sample Results</h4>
          <div style={{ maxHeight: '300px', overflow: 'auto', fontSize: '0.85rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>File</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>WER</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>CEFR</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {results.value.slice(0, 20).map(r => (
                  <tr key={r.fileId} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '0.5rem' }}>{r.fileId}</td>
                    <td style={{ padding: '0.5rem', color: r.wer < 0.2 ? '#4ade80' : r.wer < 0.5 ? '#fbbf24' : '#f87171' }}>
                      {(r.wer * 100).toFixed(1)}%
                    </td>
                    <td style={{ padding: '0.5rem' }}>{r.cefrLevel}</td>
                    <td style={{ padding: '0.5rem' }}>{r.processingTimeMs}ms</td>
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
