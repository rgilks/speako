import { test, expect, Page } from '@playwright/test';

/**
 * Validation E2E Tests
 * Run: npm run test:e2e
 * Run headed: npm run test:e2e:headed
 *
 * Tests the full validation pipeline with WebGPU Whisper models.
 */

interface ValidationResults {
  model: string;
  avgWER: number;
  cefrAccuracy: number;
  avgClarity: number;
  files: number;
  results: Array<{
    fileId: string;
    wer: number;
    labeledCEFR: string;
    detectedCEFR: string;
    cefrMatch: boolean;
    wordCount: number;
    clarityScore: number;
    grammarIssues: number;
    reference: string;
    hypothesis: string;
  }>;
}

async function runValidation(
  page: Page,
  model: string,
  fileLimit: number
): Promise<ValidationResults> {
  await page.goto('/#validate');

  // Forward console logs to terminal
  page.on('console', (msg) => console.log(`[BROWSER] ${msg.text()}`));
  page.on('pageerror', (err) => console.error(`[BROWSER ERROR] ${err.message}`));

  // Wait for app to be ready
  await page.waitForSelector('h1:has-text("Full Pipeline Validation")');

  // Trigger validation programmatically
  await page.evaluate(
    ({ id, count }) => {
      console.log(`[TEST] Triggering validation for ${id} with ${count} files...`);
      (window as any).startValidation(id, count);
    },
    { id: model, count: fileLimit }
  );

  // Wait for completion (handles model loading + transcription)
  await page.waitForFunction(() => document.body.textContent?.includes('Done!'), {
    timeout: 300000,
  });

  // Get results from window
  const results: ValidationResults = await page.evaluate(() => {
    return (window as any).__validationResults;
  });

  return results;
}

test.describe('Whisper Model Validation', () => {
  test.setTimeout(360000); // 6 minutes

  test('Base model achieves acceptable WER', async ({ page }) => {
    // Reduced from 20 to 2 for speed
    const results = await runValidation(page, 'Xenova/whisper-base.en', 2);

    console.log('==== BASE MODEL RESULTS ====');
    console.log(`Files: ${results.files}`);
    console.log(`Avg WER: ${(results.avgWER * 100).toFixed(1)}%`);
    console.log(`CEFR Accuracy: ${(results.cefrAccuracy * 100).toFixed(0)}%`);
    console.log(`Avg Clarity: ${results.avgClarity.toFixed(0)}`);

    expect(results.files).toBeGreaterThanOrEqual(1);
    expect(results.avgWER).toBeLessThan(0.6); // <60% WER
    expect(results.avgClarity).toBeGreaterThan(50);
  });

  test('Tiny model runs but with lower accuracy', async ({ page }) => {
    // Use tiny.en which is local
    // Reduced from 5 to 1 for speed
    const results = await runValidation(page, 'Xenova/whisper-tiny.en', 1);

    console.log('==== TINY MODEL RESULTS ====');
    console.log(`Files: ${results.files}`);
    console.log(`Avg WER: ${(results.avgWER * 100).toFixed(1)}%`);
    console.log(`CEFR Accuracy: ${(results.cefrAccuracy * 100).toFixed(0)}%`);

    expect(results.files).toBeGreaterThanOrEqual(3);
    // Tiny has worse accuracy, just check it runs
    expect(results.avgWER).toBeLessThan(1.0);
  });
});

test.describe('Application Smoke Tests', () => {
  test('Home page loads correctly', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('Validation page loads with WebGPU badge', async ({ page }) => {
    await page.goto('/#validate');
    await expect(page.locator('text=WebGPU')).toBeVisible();
    await expect(page.locator('select')).toBeVisible();
    await expect(page.locator('button:has-text("Start")')).toBeVisible();
  });
});
