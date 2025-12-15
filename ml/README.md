# CEFR Classifier Training

Fine-tune a DeBERTa model for CEFR level classification using [Modal](https://modal.com/) cloud GPUs.

**Published Model:** [`robg/speako-cefr-deberta`](https://huggingface.co/robg/speako-cefr-deberta)

## Quick Start

```bash
# 1. Install Modal CLI
pip install modal
modal token new

# 2. Start Training
modal run ml/train_cefr_deberta.py

# 3. Retrieve Trained Model (Optional)
npx tsx scripts/download-modal-model.ts
```

## Model Details

| Property | Value |
|----------|-------|
| Base Model | [`microsoft/deberta-v3-small`](https://huggingface.co/microsoft/deberta-v3-small) |
| HuggingFace ID | [`robg/speako-cefr-deberta`](https://huggingface.co/robg/speako-cefr-deberta) |
| Parameters | ~44M |
| ONNX Size | ~90MB (quantized) |
| Labels | A1, A2, B1, B2, C1, C2 |
| Max Length | 256 tokens |
| Task | `text-classification` |

## Architecture

```mermaid
flowchart LR
    A[Text Input] --> B[DeBERTa Encoder]
    B --> C[Classification Head]
    C --> D[CEFR Level + Confidence]
```

The model uses DeBERTa-v3-small as the base encoder with a 6-class classification head for CEFR levels.

## Training Data

### Primary: Speak & Improve Corpus 2025

Uses STM (Speech Transcription Markup) files from `test-data/reference-materials/stms/`:

| File | Purpose | Samples |
|------|---------|---------|
| `train-asr.stm` | Training | ~11,700 |
| `dev-asr.stm` | Validation | ~9,200 |
| `eval-asr.stm` | Held-out test | ~9,200 |

> [!NOTE]
> STM data is oversampled 3x during training since it represents the target domain (spoken English).

### Optional: Write & Improve Corpus 2024

The [Cambridge Write & Improve Corpus](https://www.englishlanguageitutoring.com/datasets/write-and-improve-corpus-2024) can be added for additional training volume.

To include this corpus:

1. Set the `WI_CORPUS_PATH` environment variable to the directory containing `en-writeandimprove2024-corpus.tsv`
2. Run the training script

```bash
WI_CORPUS_PATH=/path/to/wi-corpus modal run ml/train_cefr_deberta.py
```

> [!TIP]
> Written essays are automatically chunked (5-50 words) to match speech transcript lengths and prevent the model from learning "long text = high CEFR".

## Data Augmentation

The training script applies noise augmentation to simulate ASR transcription errors:

| Augmentation | Probability | Example |
|--------------|-------------|---------|
| Character swap | 5% | `speaking` → `spekaing` |
| Character deletion | 3% | `speaking` → `speaing` |
| Word deletion (short words) | 3% | `I am going` → `am going` |

This helps the model generalize to imperfect Whisper transcriptions.

## Training Configuration

| Parameter | Value |
|-----------|-------|
| GPU | NVIDIA T4 |
| Batch Size | 64 |
| Learning Rate | 2e-5 |
| Epochs | 4 (with early stopping) |
| Max Samples | 60,000 |
| Mixed Precision | FP16 |
| Early Stopping | Patience 2 epochs |
| Metric | Weighted F1 |

## Files

| File | Description |
|------|-------------|
| [`train_cefr_deberta.py`](./train_cefr_deberta.py) | Main training script (Modal) |
| [`cefr_utils.py`](./cefr_utils.py) | Data parsing and augmentation utilities |

## Browser Integration

The model is automatically loaded in the browser when users start recording or run validation:

```
Loading CEFR Classifier with WEBGPU...
CEFR Classifier loaded successfully with WEBGPU!
[MetricsCalculator] ML CEFR prediction: B2 (87.3%)
```

### Loading Behavior

1. **WebGPU** is preferred for fast inference
2. **WASM** fallback if WebGPU unavailable or fails
3. Model is cached in browser for subsequent visits

## Troubleshooting

### Model not loading in browser?

- Check browser console for errors
- Ensure internet connection (model downloads from HuggingFace)
- Verify WebGPU support: `navigator.gpu` in console
- Model will fallback to WASM if WebGPU fails

### Training fails on Modal?

```bash
# Check logs
modal app logs cefr-deberta-training

# Verify data files exist
ls test-data/reference-materials/stms/

# If using W&I corpus
echo $WI_CORPUS_PATH
ls $WI_CORPUS_PATH/en-writeandimprove2024-corpus.tsv
```

### Common errors

| Error | Solution |
|-------|----------|
| `ModuleNotFoundError: cefr_utils` | Ensure `ml/cefr_utils.py` exists |
| `STM file not found` | Symlink `test-data` to corpus directory |
| `CUDA out of memory` | Reduce `batch_size` parameter |
| `WI corpus not found` | Set `WI_CORPUS_PATH` env var or training continues without it |

## References

- [DeBERTa Paper](https://arxiv.org/abs/2006.03654) – Decoding-enhanced BERT with Disentangled Attention
- [Modal Documentation](https://modal.com/docs) – Serverless GPU compute
- [CEFR Framework](https://www.coe.int/en/web/common-european-framework-reference-languages) – Common European Framework of Reference
- [Speak & Improve Corpus 2025](https://doi.org/10.17863/CAM.114333) – Training data source
