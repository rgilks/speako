import { renderHook, act } from '@testing-library/preact';
import { useSessionManager } from './useSessionManager';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Test data constants (defined after mocks to avoid hoisting issues)
const MOCK_TRANSCRIPT = {
  text: 'Hello world',
  words: [],
};

// Mock dependencies
vi.mock('../logic/webgpu-check', () => ({
  checkWebGPU: vi.fn().mockResolvedValue({ isAvailable: true }),
}));

vi.mock('../logic/grammar-checker', () => ({
  GrammarChecker: {
    check: vi.fn().mockReturnValue({
      issues: [],
      clarityScore: 100,
      positivePoints: [],
    }),
  },
}));

vi.mock('../logic/metrics-calculator', () => ({
  computeMetrics: vi.fn().mockReturnValue({
    word_count: 10,
    cefr_level: 'B2',
    unique_words: 8,
    complex_words: 2,
    pronunciation_score: 90,
  }),
  computeMetricsWithML: vi.fn().mockResolvedValue({
    word_count: 10,
    cefr_level: 'B2',
    unique_words: 8,
    complex_words: 2,
    pronunciation_score: 90,
    cefr_confidence: 0.85,
    cefr_method: 'ml',
  }),
}));

vi.mock('../logic/cefr-classifier', () => ({
  loadCEFRClassifier: vi.fn().mockResolvedValue(undefined),
  isCEFRClassifierReady: vi.fn().mockReturnValue(true),
  predictCEFR: vi.fn().mockResolvedValue({ level: 'B2', confidence: 0.85, allScores: [] }),
  estimateCEFRHeuristic: vi.fn().mockReturnValue({ level: 'B2', confidence: 0.5, allScores: [] }),
}));

// Mock LocalTranscriber to prevent actual WebGPU/Audio usage
vi.mock('../logic/local-transcriber', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../logic/local-transcriber')>();
  return {
    ...actual,
    LocalTranscriber: class MockLocalTranscriber {
      onProgress = undefined;
      async start() {}
      async stop() {
        return { text: '', words: [] };
      }
      getRecorder() {
        return { getAudioLevel: () => 0 };
      }
    },
    subscribeToLoadingState: vi.fn(() => () => {}),
    ModelLoadingState: {},
  };
});

describe('useSessionManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes in idle state', () => {
    const { result } = renderHook(() => useSessionManager());

    expect(result.current.view.value).toBe('idle');
    expect(result.current.metrics.value).toBeNull();
    expect(result.current.transcript.value).toBeNull();
  });

  it('transitions to recording state on handleStart', async () => {
    const { result } = renderHook(() => useSessionManager());
    const startSpy = vi
      .spyOn(result.current.localTranscriber, 'start')
      .mockResolvedValue(undefined);

    await act(async () => {
      await result.current.handleStart();
    });

    expect(result.current.view.value).toBe('recording');
    expect(startSpy).toHaveBeenCalled();
    expect(result.current.statusMsg.value).toBe('Speak now...');
  });

  it('handleStop transitions to processing then results', async () => {
    const { result } = renderHook(() => useSessionManager());
    vi.spyOn(result.current.localTranscriber, 'start').mockResolvedValue(undefined);
    const stopSpy = vi
      .spyOn(result.current.localTranscriber, 'stop')
      .mockResolvedValue(MOCK_TRANSCRIPT);

    await act(async () => {
      await result.current.handleStart();
      await result.current.handleStop();
    });

    expect(stopSpy).toHaveBeenCalled();
    expect(result.current.view.value).toBe('results');
    expect(result.current.transcript.value?.text).toBe(MOCK_TRANSCRIPT.text);
    expect(result.current.metrics.value).not.toBeNull();
  });

  it('handleRetry resets state to idle', async () => {
    const { result } = renderHook(() => useSessionManager());
    vi.spyOn(result.current.localTranscriber, 'start').mockResolvedValue(undefined);
    vi.spyOn(result.current.localTranscriber, 'stop').mockResolvedValue(MOCK_TRANSCRIPT);

    await act(async () => {
      await result.current.handleStart();
      await result.current.handleStop();
    });

    expect(result.current.view.value).toBe('results');

    act(() => {
      result.current.handleRetry();
    });

    expect(result.current.view.value).toBe('idle');
    expect(result.current.transcript.value).toBeNull();
    expect(result.current.metrics.value).toBeNull();
  });

  it('generates a new topic correctly', () => {
    const { result } = renderHook(() => useSessionManager());
    const initialTopic = result.current.currentTopic.value;

    act(() => {
      result.current.generateTopic();
    });

    expect(result.current.currentTopic.value.length).toBeGreaterThan(0);
    expect(result.current.currentTopic.value).not.toBe(initialTopic);
  });
});
