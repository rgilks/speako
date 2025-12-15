import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ModelSingleton, getLoadingState, subscribeToLoadingState } from './model-loader';

// Mock the pipeline function
const mockPipeline = vi.fn();

vi.mock('@huggingface/transformers', () => ({
    pipeline: (...args: any[]) => mockPipeline(...args),
    env: {
        localModelPath: '',
        allowLocalModels: false,
        allowRemoteModels: true
    }
}));

// Mock WebGPU check to return available
vi.mock('./webgpu-check', () => ({
    checkWebGPU: vi.fn().mockResolvedValue({ isAvailable: true })
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
        mockPipeline.mockResolvedValue("fake_model");
        
        const p1 = ModelSingleton.getInstance();
        const p2 = ModelSingleton.getInstance();
        
        // Since getInstance is async, it returns a new Promise wrapper each time.
        // We verify singleton behavior by checking the underlying pipeline is only called once.
        const r1 = await p1;
        const r2 = await p2;
        
        expect(r1).toBe(r2);
        expect(mockPipeline).toHaveBeenCalledTimes(1);
        
        await p1;
        expect(getLoadingState().isLoaded).toBe(true);
    });

    it('updates loading state during load', async () => {
        let progressCallback: any;
        let resolveModel: (value: any) => void;
        const pipelinePromise = new Promise(resolve => { resolveModel = resolve; });
        
        mockPipeline.mockImplementation((task, model, options) => {
            progressCallback = options.progress_callback;
            return pipelinePromise;
        });

        const promise = ModelSingleton.getInstance();
        
        // Wait for the async WebGPU check to complete and pipeline to be called
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // Check loading state after WebGPU check (pipeline not yet resolved)
        expect(getLoadingState().isLoading).toBe(true);
        
        // Simulate progress
        if (progressCallback) {
            progressCallback({ status: 'initiate' });
            expect(getLoadingState().progress).toBeGreaterThan(0);
            
            progressCallback({ status: 'download' });
            expect(getLoadingState().progress).toBeGreaterThan(10);
            
            progressCallback({ status: 'progress', file: 'model.onnx', progress: 50 });
            // Should calculate weighted progress
            expect(getLoadingState().progress).toBeGreaterThan(20);
        }
        
        // Now resolve the model
        resolveModel!("fake_model");
        
        await promise;
        expect(getLoadingState().isLoaded).toBe(true);
        expect(getLoadingState().progress).toBe(100);
    });

    it('handles load errors', async () => {
        mockPipeline.mockRejectedValue(new Error("Network Error"));
        
        await expect(ModelSingleton.getInstance()).rejects.toThrow("Network Error");
        
        expect(getLoadingState().error).toContain("Network Error");
        expect(getLoadingState().isLoading).toBe(false);
    });
    
    it('allows subscription to state changes', async () => {
        const spy = vi.fn();
        const unsubscribe = subscribeToLoadingState(spy);
        
        // Should be called immediately with current state
        expect(spy).toHaveBeenCalledTimes(1);
        
        // Trigger a state update by starting load
        mockPipeline.mockReturnValue(new Promise(() => {})); // Hangs forever
        ModelSingleton.getInstance();
        
        // Wait for the async WebGPU check to complete
        await new Promise(resolve => setTimeout(resolve, 0));
        
        expect(spy).toHaveBeenCalledTimes(2); // Initial + updateLoadingState(isLoading: true)
        
        unsubscribe();
    });
});
