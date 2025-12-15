import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModelSingleton, getLoadingState, subscribeToLoadingState } from './model-loader';

const mockPipeline = vi.fn();

vi.mock('@huggingface/transformers', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pipeline: (...args: any[]) => mockPipeline(...args),
  env: {
    localModelPath: '',
    allowLocalModels: false,
    allowRemoteModels: true,
  },
}));

vi.mock('./webgpu-check', () => ({
  checkWebGPU: vi.fn().mockResolvedValue({ isAvailable: true }),
}));

describe('ModelLoader', () => {
  beforeEach(() => {
    // Reset singleton state if possible (hacky way since it's a private static usually,
    // but here it's public static instance)
    ModelSingleton.instance = null;
    ModelSingleton.preloadStarted = false;
    mockPipeline.mockReset();
  });

  it('loads the model only once', async () => {
    mockPipeline.mockResolvedValue('fake_model');

    const p1 = ModelSingleton.getInstance();
    const p2 = ModelSingleton.getInstance();

    const r1 = await p1;
    const r2 = await p2;

    expect(r1).toBe(r2);
    expect(mockPipeline).toHaveBeenCalledTimes(1);
    expect(getLoadingState().isLoaded).toBe(true);
  });

  it('updates loading state during load', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let progressCallback: ((data: any) => void) | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let resolveModel: (value: any) => void;
    const pipelinePromise = new Promise((resolve) => {
      resolveModel = resolve;
    });

    mockPipeline.mockImplementation((_task, _model, options) => {
      progressCallback = options.progress_callback;
      return pipelinePromise;
    });

    const promise = ModelSingleton.getInstance();

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(getLoadingState().isLoading).toBe(true);

    if (progressCallback) {
      progressCallback({ status: 'initiate' });
      expect(getLoadingState().progress).toBeGreaterThan(0);

      progressCallback({ status: 'download' });
      expect(getLoadingState().progress).toBeGreaterThan(10);

      progressCallback({ status: 'progress', file: 'model.onnx', progress: 50 });
      expect(getLoadingState().progress).toBeGreaterThan(20);
    }

    resolveModel!('fake_model');

    await promise;
    expect(getLoadingState().isLoaded).toBe(true);
    expect(getLoadingState().progress).toBe(100);
  });

  it('handles load errors', async () => {
    mockPipeline.mockRejectedValue(new Error('Network Error'));

    await expect(ModelSingleton.getInstance()).rejects.toThrow('Network Error');

    expect(getLoadingState().error).toContain('Network Error');
    expect(getLoadingState().isLoading).toBe(false);
  });

  it('allows subscription to state changes', async () => {
    const spy = vi.fn();
    const unsubscribe = subscribeToLoadingState(spy);

    expect(spy).toHaveBeenCalledTimes(1);

    mockPipeline.mockReturnValue(new Promise(() => {}));
    ModelSingleton.getInstance();

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(spy).toHaveBeenCalledTimes(2);

    unsubscribe();
  });
});
