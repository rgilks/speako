# CEFR Classifier Training

Fine-tune a DistilBERT model for CEFR level classification using Modal cloud GPUs.

**Published Model:** [`robg/speako-cefr`](https://huggingface.co/robg/speako-cefr)

## Quick Start (Training New Model)

```bash
# 1. Install Modal CLI
pip install modal
modal token new

# 2. Quick test (1000 samples, ~2 min)
modal run ml/train_cefr_minilm.py --quick-test

# 3. Full training (~45 min)
modal run ml/train_cefr_minilm.py

# 4. Convert to ONNX
modal run ml/train_cefr_minilm.py --convert

# 5. Download locally
modal run ml/train_cefr_minilm.py --download

# 6. Publish to HuggingFace
huggingface-cli login
huggingface-cli upload your-username/speako-cefr ./cefr-minilm-onnx

# 7. Update src/logic/cefr-classifier.ts
# const DEFAULT_MODEL = 'your-username/speako-cefr';
```

## Commands

| Command | Description | Time |
|---------|-------------|------|
| `--quick-test` | Test with 1000 samples, 2 epochs | ~2 min |
| (no flags) | Full training, 5 epochs | ~45 min |
| `--convert` | Convert to ONNX + quantize | ~2 min |
| `--download` | Download ONNX model locally | ~1 min |
| `--use-hf` | Use HuggingFace UniversalCEFR dataset | - |

## Training Data

Uses local STM files from `dist/test-data/reference-materials/stms/`:

| File | Purpose | Samples |
|------|---------|---------|
| `train-asr.stm` | Training | ~11,700 |
| `dev-asr.stm` | Validation | ~9,200 |
| `eval-asr.stm` | Held-out test | ~9,200 |

## Model Details

| Property | Value |
|----------|-------|
| Base Model | `distilbert-base-uncased` |
| HuggingFace ID | `robg/speako-cefr` |
| ONNX Size | ~67MB (quantized) |
| Labels | A1, A2, B1, B2, C1, C2 |
| Max Length | 256 tokens |

## Browser Integration

The model is automatically loaded when users start recording or run validation:

```
[CEFRClassifier] Loading robg/speako-cefr...
[CEFRClassifier] Model loaded successfully!
[SessionManager] Metrics calculated (ml): {cefr_level: 'B2', cefr_confidence: 0.85}
```

## Troubleshooting

**Model not loading?**
- Check browser console for errors
- Ensure internet connection (model downloads from HuggingFace)
- Check if WebGPU is available

**Training fails?**
- Check Modal logs: `modal app logs`
- Verify STM files exist: `ls dist/test-data/reference-materials/stms/`
