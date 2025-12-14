# CEFR MiniLM Training

Train a browser-compatible CEFR level classifier using Modal.

## Prerequisites

1. Install Modal CLI:
   ```bash
   pip install modal
   modal token new
   ```

2. Install Optimum (for ONNX conversion):
   ```bash
   pip install optimum[onnxruntime]
   ```

## Training Data

By default, the script uses your **local STM data** from `dist/test-data/reference-materials/stms/`:
- `train-asr.stm` - ~11k training samples
- `dev-asr.stm` - ~9k validation samples

Alternatively, use `--use-hf` to train on the HuggingFace UniversalCEFR dataset.

## Training

### Quick Test (local data, 1000 samples, 2 epochs)

```bash
modal run ml/train_cefr_minilm.py --quick-test
```

### Full Training (local STM data)

```bash
modal run ml/train_cefr_minilm.py
```

### Full Training (HuggingFace UniversalCEFR)

```bash
modal run ml/train_cefr_minilm.py --use-hf
```

Expected time: ~1 hour on T4 GPU

## Convert to ONNX

After training completes:

```bash
modal run ml/train_cefr_minilm.py --convert
```

## Download Model

Download the trained ONNX model to your local machine:

```bash
modal run ml/train_cefr_minilm.py --download
```

## Publish to HuggingFace

1. Login: `huggingface-cli login`
2. Upload: `huggingface-cli upload your-username/cefr-minilm-onnx ./cefr-minilm-onnx`

## Model Details

| Property | Value |
|----------|-------|
| Base Model | `microsoft/MiniLM-L6-H384-uncased` |
| Parameters | ~22M |
| ONNX Size | ~25MB (quantized: ~12MB) |
| Labels | A1, A2, B1, B2, C1, C2 |
| Max Length | 256 tokens |

## Integration

After publishing, update `src/logic/cefr-classifier.ts`:

```typescript
const DEFAULT_MODEL = 'your-username/cefr-minilm-onnx';
```
