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
        mockPipeline.mockImplementation((task, model, options) => {
            progressCallback = options.progress_callback;
            return Promise.resolve("fake_model");
        });

        const promise = ModelSingleton.getInstance();
        
        // Check initial loading state
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
    
    it('allows subscription to state changes', () => {
        const spy = vi.fn();
        const unsubscribe = subscribeToLoadingState(spy);
        
        // Should be called immediately with current state
        expect(spy).toHaveBeenCalledTimes(1);
        
        // Trigger a state update by starting load
        mockPipeline.mockReturnValue(new Promise(() => {})); // Hangs forever
        ModelSingleton.getInstance();
        
        expect(spy).toHaveBeenCalledTimes(2); // Initial + updateLoadingState(isLoading: true)
        
        unsubscribe();
    });
});
