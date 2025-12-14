# CEFR Classifier Training

Train a browser-compatible CEFR level classifier using Modal cloud GPUs.

## Quick Start

```bash
# 1. Install Modal CLI (one-time setup)
pip install modal
modal token new

# 2. Quick test (1000 samples, ~2 min)
modal run ml/train_cefr_minilm.py --quick-test

# 3. Convert to ONNX
modal run ml/train_cefr_minilm.py --convert

# 4. Download to local machine
modal run ml/train_cefr_minilm.py --download

# 5. Publish to HuggingFace (required for browser loading)
huggingface-cli login
huggingface-cli upload your-username/speako-cefr ./cefr-minilm-onnx

# 6. Update src/logic/cefr-classifier.ts with your model ID
# const DEFAULT_MODEL = 'your-username/speako-cefr';
```

> **Note:** The model must be hosted on HuggingFace for browser loading.
> Local file loading is not supported by transformers.js in browser environments.

## Commands

| Command | Description | Time |
|---------|-------------|------|
| `--quick-test` | Test with 1000 samples, 2 epochs | ~2 min |
| (no flags) | Full training, 5 epochs | ~45 min |
| `--convert` | Convert trained model to ONNX | ~2 min |
| `--download` | Download ONNX model locally | ~1 min |
| `--use-hf` | Use HuggingFace dataset instead of local STM files | - |

## Training Data

The script uses local STM files from `dist/test-data/reference-materials/stms/`:

| File | Purpose | Samples |
|------|---------|---------|
| `train-asr.stm` | Training | ~11,700 |
| `dev-asr.stm` | Validation during training | ~9,200 |
| `eval-asr.stm` | Held-out final evaluation | ~9,200 |

## Full Training

For production-quality model (~70-80% accuracy):

```bash
# Full training with local STM data
modal run ml/train_cefr_minilm.py

# Or use HuggingFace UniversalCEFR dataset
modal run ml/train_cefr_minilm.py --use-hf
```

## Model Details

| Property | Value |
|----------|-------|
| Base Model | `distilbert-base-uncased` |
| Parameters | ~66M |
| ONNX Size | ~270MB (quantized: ~67MB) |
| Labels | A1, A2, B1, B2, C1, C2 |
| Max Length | 256 tokens |
| Architecture | DistilBertForSequenceClassification |

## Integration with Speako

After downloading, the model is automatically used when you:

1. **Copy to public folder** (see Quick Start step 5)
2. **Start the app**: `npm run dev`
3. **Record speech or run validation** - CEFR model loads in background

Logs will show:
```
[CEFRClassifier] Loading http://localhost:5173/models/cefr-classifier...
[CEFRClassifier] Model loaded successfully!
[Validation] file123: CEFR=B2 (ml, 85%) vs labeled=B2
```

## Publishing to HuggingFace (Optional)

To share your trained model:

```bash
# Login to HuggingFace
huggingface-cli login

# Upload model
huggingface-cli upload your-username/speako-cefr ./cefr-minilm-onnx

# Update src/logic/cefr-classifier.ts
# const DEFAULT_MODEL = 'your-username/speako-cefr';
```

## Troubleshooting

**Model not loading in browser?**
- Ensure `public/models/cefr-classifier/model.onnx` exists
- Check browser console for CORS errors
- Verify Vite is serving files: `curl http://localhost:5173/models/cefr-classifier/config.json`

**Training fails?**
- Check Modal logs: `modal app logs`
- Verify STM files exist: `ls dist/test-data/reference-materials/stms/`

**Low accuracy?**
- Run full training (not `--quick-test`)
- Check class distribution in your data
- Consider increasing epochs or learning rate
