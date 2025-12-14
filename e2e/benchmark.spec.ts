
import { test, expect } from '@playwright/test';

// Models to benchmark
const MODELS = [
  'Xenova/whisper-tiny.en', 
  // 'Xenova/whisper-tiny', // Not local
  'Xenova/whisper-base.en',
  // 'Xenova/whisper-base', // Not local
  // 'Xenova/whisper-small.en', // Not local
  // 'onnx-community/distil-small.en', // Not local
  // 'onnx-community/whisper-large-v3-turbo' // Not local
]; 

const FILE_LIMIT = 1;

test.describe('Model Benchmark', () => {
    test.setTimeout(300000); // 5 minutes total per test? No, this is for suite?
    // Playwright test.setTimeout inside describe sets it for each test? Or suite?
    // It's usually per test.
    // I'll set it here.


    const resultsMap: Record<string, any> = {};

    for (const model of MODELS) {
        test(`Benchmark ${model}`, async ({ page }) => {
            console.log(`Starting benchmark for ${model}...`);
            const results = await runBenchmark(page, model, FILE_LIMIT);
            resultsMap[model] = results;
            console.log(`Finished ${model}: WER=${(results.avgWER*100).toFixed(1)}%, CEFR=${(results.cefrAccuracy*100).toFixed(0)}%, Speed=${results.avgTimePerFile.toFixed(1)}s`);
        });
    }

    test.afterAll(async () => {
        console.log('==== FINAL BENCHMARK REPORT ====');
        console.table(resultsMap);
    });
});

async function runBenchmark(page: any, modelId: string, limit: number) {
    await page.goto('http://localhost:5173/#validate');

    // Forward console logs to terminal
    page.on('console', (msg: any) => console.log(`[BROWSER] ${msg.text()}`));
    page.on('pageerror', (err: Error) => console.error(`[BROWSER ERROR] ${err.message}`));
    
    
    // Start Validation Programmatically to avoid UI blocking/issues
    // This sets model, file limit, and runs it directly
    await page.evaluate(({ id, count }: { id: string; count: number }) => {
        console.log(`[TEST] Triggering validation for ${id} with ${count} files...`);
        (window as any).startValidation(id, count);
    }, { id: modelId, count: limit });
    
    // Wait for completion or error
    try {
        await page.waitForFunction(
            () => {
                const text = document.body.textContent || '';
                return text.includes('Done!') || text.includes('Error:');
            },
            { timeout: limit * 60000 }
        );
        
        // Check if error
        const status = await page.textContent('body');
        if (status?.includes('Error:')) {
             throw new Error(`Validation failed with status: ${status.substring(0, 200)}`);
        }
        
    } catch (e) {
        console.error(`Failure for ${modelId}:`, e);
        await page.screenshot({ path: `benchmark_fail_${modelId.split('/')[1]}.png` });
        throw e;
    }
    
    // Extract Results
    const validationData = await page.evaluate(() => (window as any).__validationResults);
    const results = validationData.results;
    
    // Calculate Stats
    const totalWER = results.reduce((acc: number, r: any) => acc + r.wer, 0);
    const accuracyCount = results.filter((r: any) => {
        const detected = r.detectedCEFR;
        const expected = r.labeledCEFR;
        // Logic: Exact match or C-match
        return detected === expected || (expected === 'C' && detected.startsWith('C'));
    }).length;
    
    const totalTime = results.reduce((acc: number, r: any) => acc + (r.processingTimeMs || 0), 0);
    const avgClarity = results.reduce((acc: number, r: any) => acc + (r.clarityScore || 0), 0) / results.length;

    return {
        files: results.length,
        avgWER: totalWER / results.length,
        cefrAccuracy: accuracyCount / results.length,
        avgTimePerFile: totalTime / results.length / 1000,
        avgClarity: avgClarity
    };
}
