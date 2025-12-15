/**
 * Full Pipeline Validation using WebGPU Whisper.
 * Validates: Transcription (WER), CEFR detection, Metrics, Grammar.
 * Access: http://localhost:5173/#validate
 */

import { useEffect } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import { env } from '@huggingface/transformers';
import { ValidationResult } from '../types/validation';
import { useValidation } from '../hooks/useValidation';
import { SummaryCards } from './validation/SummaryCards';
import { ResultsTable } from './validation/ResultsTable';
import { ResultDetailView } from './validation/ResultDetailView';
import { ValidationControls } from './validation/ValidationControls';
import { ProgressBar } from './validation/ProgressBar';
import { ValidationHeader } from './validation/ValidationHeader';

// Configure local caching for Transformers.js
env.allowLocalModels = true;
env.useBrowserCache = true;

export function ValidatePage() {
  const selectedResult = useSignal<ValidationResult | null>(null);
  const {
    status,
    progress,
    totalFiles,
    results,
    isRunning,
    isComplete,
    fileLimit,
    avgWER,
    cefrAccuracy,
    avgClarity,
    runValidation,
  } = useValidation();

  // Expose for E2E testing
  useEffect(() => {
    if (typeof window !== 'undefined') {
      interface WindowWithValidation extends Window {
        startValidation?: (limit: number) => void;
      }
      (window as WindowWithValidation).startValidation = (limit: number) => {
        fileLimit.value = limit;
        runValidation();
      };
    }
  }, [fileLimit, runValidation]);

  return (
    <div style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto' }}>
      <ValidationHeader />

      <div className="card-glass" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <p>
          <strong>Status:</strong> {status.value}
        </p>

        <ValidationControls
          fileLimit={fileLimit.value}
          isRunning={isRunning.value}
          isComplete={isComplete.value}
          onFileLimitChange={(limit) => (fileLimit.value = limit)}
          onStartValidation={runValidation}
        />

        <ProgressBar progress={progress.value} total={totalFiles.value} />
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
            onSelectResult={(r) => (selectedResult.value = r)}
          />

          {!selectedResult.value && (
            <p
              style={{
                textAlign: 'center',
                color: 'var(--text-tertiary)',
                fontSize: '0.85rem',
                marginTop: '1rem',
              }}
            >
              👆 Click a row to see full results with audio visualizer
            </p>
          )}
        </div>
      )}

      {selectedResult.value && (
        <ResultDetailView
          result={selectedResult.value}
          onClose={() => (selectedResult.value = null)}
        />
      )}
    </div>
  );
}
