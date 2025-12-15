# CEFR Classifier Training

Fine-tune a DeBERTa model for CEFR level classification using Modal cloud GPUs.

**Published Model:** [`robg/speako-cefr`](https://huggingface.co/robg/speako-cefr)

## Quick Start (Training New Model)

```bash
# 1. Install Modal CLI
pip install modal
modal token new

# 2. Start Training
modal run ml/train_cefr_deberta.py
```

## Model Details

| Property | Value |
|----------|-------|
| Base Model | `microsoft/deberta-v3-small` |
| HuggingFace ID | `robg/speako-cefr-deberta` |
| ONNX Size | ~90MB (quantized) |
| Labels | A1, A2, B1, B2, C1, C2 |
| Max Length | 256 tokens |
| Augmentation | Noise (Typos, Deletions) |

## Training Data

Uses local STM files from `test-data/reference-materials/stms/`:

| File | Purpose | Samples |
|------|---------|---------|
| `train-asr.stm` | Training | ~11,700 |
| `dev-asr.stm` | Validation | ~9,200 |
| `eval-asr.stm` | Held-out test | ~9,200 |

### Write & Improve Corpus (Optional)

To include the Cambridge Write & Improve Corpus in training:
1. Set the `WI_CORPUS_PATH` environment variable to the directory containing `en-writeandimprove2024-corpus.tsv`.
2. Ensure the path is accessible to the training context.




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
- Verify STM files exist: `ls test-data/reference-materials/stms/`
- If using W&I corpus, verify `WI_CORPUS_PATH` is set and the file exists.
