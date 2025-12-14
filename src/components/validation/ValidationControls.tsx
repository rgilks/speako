/**
 * Validation controls panel.
 */

import { WhisperModel, WHISPER_MODELS } from '../../types/validation';

interface ValidationControlsProps {
  selectedModel: string;
  fileLimit: number;
  isRunning: boolean;
  isComplete: boolean;
  onModelChange: (modelId: string) => void;
  onFileLimitChange: (limit: number) => void;
  onStartValidation: () => void;
}

export function ValidationControls({
  selectedModel,
  fileLimit,
  isRunning,
  isComplete,
  onModelChange,
  onFileLimitChange,
  onStartValidation
}: ValidationControlsProps) {
  if (isRunning) return null;
  
  return (
    <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
      <label>
        Model:
        <select 
          value={selectedModel}
          onChange={(e) => onModelChange((e.target as HTMLSelectElement).value)}
          style={{ marginLeft: '0.5rem', padding: '6px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', color: 'inherit' }}
        >
          {WHISPER_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </label>
      <label>
        Files:
        <input 
          type="number"
          value={fileLimit}
          onChange={(e) => onFileLimitChange(parseInt((e.target as HTMLInputElement).value) || 10)}
          style={{ marginLeft: '0.5rem', width: '60px', padding: '6px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', color: 'inherit' }}
        />
      </label>
      <button className="btn-primary" onClick={onStartValidation}>
        {isComplete ? 'Run Again' : 'Start Validation'}
      </button>
    </div>
  );
}
