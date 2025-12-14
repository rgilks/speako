
import { test, expect } from '@playwright/test';

// Models to benchmark
const MODELS = [
  'Xenova/whisper-tiny.en', 
  'Xenova/whisper-tiny',
  'Xenova/whisper-base.en',
  'Xenova/whisper-base',
  'Xenova/whisper-small.en',
  'onnx-community/distil-small.en',
  'onnx-community/whisper-large-v3-turbo'
]; 

const FILE_LIMIT = 5;

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
    await page.goto('http://localhost:5173/validate');
    
    // Select Model
    await page.selectOption('select#model-select', modelId);
    
    // Set File Limit
    await page.fill('input#file-limit', limit.toString());
    
    // Start Validation
    await page.click('button#start-validation');
    
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
    const results = await page.evaluate(() => (window as any).__validationResults);
    
    // Calculate Stats
    const totalWER = results.reduce((acc: number, r: any) => acc + r.wer, 0);
    const accuracyCount = results.filter((r: any) => {
        const detected = r.metrics.cefr_level;
        const expected = r.reference.labeledCEFR;
        // Logic: Exact match or C-match
        return detected === expected || (expected === 'C' && detected.startsWith('C'));
    }).length;
    
    const totalTime = results.reduce((acc: number, r: any) => acc + (r.time || 0), 0);
    const avgClarity = results.reduce((acc: number, r: any) => acc + (r.metrics.clarityScore || 0), 0) / results.length;

    return {
        files: results.length,
        avgWER: totalWER / results.length,
        cefrAccuracy: accuracyCount / results.length,
        avgTimePerFile: totalTime / results.length / 1000,
        avgClarity: avgClarity
    };
}
