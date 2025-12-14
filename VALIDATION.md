# Validation System

## Overview

Speako includes an automated validation system to benchmark transcription accuracy, CEFR detection, and feedback quality using the Speak & Improve Corpus.

## Running Validation

### Browser-based (Manual)
```bash
npm run dev
open http://localhost:5173/#validate
```
Select model, set file count, click "Start Validation".

### Automated (Playwright)
```bash
npm run test:e2e        # Headless
npm run test:e2e:headed # Watch in browser
```

## Benchmark Results (Dec 2024)

| Model | Size | WER | CEFR Accuracy | Recommendation |
|-------|------|-----|---------------|----------------|
| **Base** | 74MB | **39.1%** | **67%** | ✅ **Use this** |
| Tiny | 39MB | 54.0% | 40% | ❌ Too inaccurate |
| Small | 241MB | TBD | TBD | Larger, may be slower |

## Metrics Explained

- **WER (Word Error Rate):** % of words needing changes to match reference. Lower is better.
- **CEFR Accuracy:** % of files where detected level matches labeled level.
- **Clarity Score:** Grammar checker's score (0-100).

## Known Issues

| Issue | Impact | Status |
|-------|--------|--------|
| CEFR detection 67% accurate | Users get wrong level | 🔴 High priority |
| WER ~39% on L2 audio | Expected for accented speech | 🟡 Medium |
| Empty transcripts on short clips | 100% WER for those | 🟡 Medium |

## Improvement Roadmap

### Phase 1: CEFR Improvement (High Priority)
Current algorithm uses simple heuristics (sentence length + vocabulary complexity).

**Options:**
1. Integrate a trained CEFR classifier model
2. Use output from grammar analysis to inform CEFR
3. Weight pronunciation confidence in CEFR calculation

### Phase 2: Model Optimization
- Test `distil-whisper/distil-medium.en` for better accuracy
- Add adaptive model selection based on audio length
- Implement minimum audio length check (skip very short clips)

### Phase 3: Enhanced Feedback
- Add per-CEFR-level accuracy breakdown in validation
- Track pronunciation patterns by error type
- Generate actionable feedback based on common errors

## Test Coverage

| Type | Count | Status |
|------|-------|--------|
| Unit tests | 36 | ✅ Passing |
| Smoke tests | 2 | ✅ Passing |
| E2E validation | 1 | ✅ Passing |

## Files

- `src/components/ValidatePage.tsx` - Browser validation UI
- `e2e/validation.spec.ts` - Playwright automated tests
- `playwright.config.ts` - Playwright configuration
- `scripts/convert-audio.sh` - FLAC to WAV conversion
