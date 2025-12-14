"""
CEFR MiniLM Training Script for Modal

Train a ~25MB browser-compatible CEFR classifier.

Usage:
    modal run ml/train_cefr_minilm.py
"""

import modal
from pathlib import Path

# Modal setup
app = modal.App("cefr-minilm-training")

image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "transformers>=4.36.0",
    "datasets>=2.16.0",
    "evaluate>=0.4.0",
    "accelerate>=0.25.0",
    "scikit-learn>=1.3.0",
    "torch>=2.1.0",
    "numpy<2.0.0",
    "pandas>=2.0.0",
    "optimum[onnxruntime]>=1.16.0"  # For ONNX conversion
)

# Volume to persist model artifacts
volume = modal.Volume.from_name("cefr-models", create_if_missing=True)

LABEL2ID = {"A1": 0, "A2": 1, "B1": 2, "B2": 3, "C1": 4, "C2": 5}
ID2LABEL = {v: k for k, v in LABEL2ID.items()}


def parse_stm_file(content: str) -> list:
    """Parse STM file format with CEFR labels."""
    import re
    
    entries = []
    for line in content.split('\n'):
        line = line.strip()
        if not line or line.startswith(';;'):
            continue
        
        # Format: file_id channel speaker start end <label_string> transcript
        match = re.search(r'<[^>]+>', line)
        if not match:
            continue
        
        label_str = match.group(0)
        text = line[match.end():].strip()
        
        if not text:
            continue
        
        # Extract CEFR level from label string
        parts = label_str.strip('<>').split(',')
        cefr = None
        for part in parts:
            part = part.strip()
            if part in ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'C']:
                cefr = 'C1' if part == 'C' else part  # Map 'C' to 'C1'
                break
        
        if cefr and cefr in LABEL2ID:
            entries.append({
                'text': text,
                'label': LABEL2ID[cefr],
                'source': 'stm'
            })
    
    return entries


def parse_wi_corpus(tsv_path: str) -> list:
    """Parse Write & Improve Corpus TSV."""
    import pandas as pd
    import os
    
    if not os.path.exists(tsv_path):
        print(f"⚠️ W&I corpus file not found: {tsv_path}")
        return []
        
    print(f"   Parsing W&I corpus: {tsv_path}")
    try:
        df = pd.read_csv(tsv_path, sep='\t')
        entries = []
        
        # Mapping for W&I labels (e.g. B1+ -> B1, A1 -> A1)
        # Note: W&I has automarker_cefr_level and humannotator_cefr_level. 
        # We'll prioritize human if available, else automarker? 
        # Actually automarker is populated for all, human only for some.
        # Let's use automarker_cefr_level as it covers all data.
        
        for _, row in df.iterrows():
            text = row.get('text', '')
            if not isinstance(text, str) or not text.strip():
                continue
                
            raw_label = str(row.get('automarker_cefr_level', '')).strip().upper()
            
            # Map labels like "B1+" to "B1"
            base_label = raw_label.replace('+', '').replace('-', '')
            
            if base_label in LABEL2ID:
                entries.append({
                    'text': text,
                    'label': LABEL2ID[base_label],
                    'source': 'wi'
                })
                
        return entries
    except Exception as e:
        print(f"   ⚠️ Error parsing W&I corpus: {e}")
        return []


# Mount local STM data
# Mount W&I corpus data
training_image = (
    image
    .add_local_dir("dist/test-data/reference-materials/stms", remote_path="/stm-data")
    .add_local_dir("/Users/robertgilks/Desktop/write-and-improve-corpus-2024-v2/whole-corpus", remote_path="/wi-data")
)

@app.function(
    image=training_image,
    gpu="T4",
    timeout=7200,  # 2 hours max
    volumes={"/models": volume}
)
def train(
    model_name: str = "distilbert-base-uncased",
    output_name: str = "cefr-distilbert",
    epochs: int = 5,
    batch_size: int = 32,
    learning_rate: float = 2e-5,
    max_samples: int = None,
    use_stm: bool = True,
    use_wi: bool = True,
    use_hf: bool = True
):
    """Train CEFR classifier combining multiple datasets."""
    import numpy as np
    import evaluate
    from transformers import (
        AutoTokenizer,
        AutoModelForSequenceClassification,
        TrainingArguments,
        Trainer,
        DataCollatorWithPadding
    )
    from datasets import Dataset, concatenate_datasets
    
    print(f"🚀 Starting CEFR training with {model_name}")
    print(f"   Sources: STM={use_stm}, W&I={use_wi}, HF={use_hf}")
    
    all_datasets = []
    
    # 1. Load Local STM Data
    if use_stm:
        print("📦 Loading STM data...")
        stm_entries = []
        for fname in ["train-asr.stm", "dev-asr.stm", "eval-asr.stm"]:
            try:
                with open(f"/stm-data/{fname}", "r") as f:
                    entries = parse_stm_file(f.read())
                    stm_entries.extend(entries)
            except Exception as e:
                print(f"   ⚠️ Could not load {fname}: {e}")
        
        if stm_entries:
            print(f"   ✅ STM samples: {len(stm_entries)}")
            all_datasets.append(Dataset.from_list(stm_entries))
            
    # 2. Load Write & Improve Corpus
    if use_wi:
        print("📦 Loading Write & Improve corpus...")
        wi_entries = parse_wi_corpus("/wi-data/en-writeandimprove2024-corpus.tsv")
        if wi_entries:
            print(f"   ✅ W&I samples: {len(wi_entries)}")
            all_datasets.append(Dataset.from_list(wi_entries))
            
    # 3. Load HuggingFace UniversalCEFR
    if use_hf:
        print("📦 Loading UniversalCEFR dataset...")
        try:
            from datasets import load_dataset
            hf_ds = load_dataset("cefr-learning/UniversalCEFR")
            hf_ds = hf_ds.filter(lambda x: x["language"] == "en")
            
            def map_hf_labels(example):
                label = example["cefr_level"].upper().strip()
                return {
                    "text": example["text"],
                    "label": LABEL2ID.get(label, 0),
                    "source": "hf"
                }
            
            hf_ds = hf_ds.map(map_hf_labels, remove_columns=hf_ds["train"].column_names)
            print(f"   ✅ HF samples: {len(hf_ds['train'])}")
            all_datasets.append(hf_ds["train"])
        except Exception as e:
            print(f"   ⚠️ Could not load UniversalCEFR: {e}")

    if not all_datasets:
        raise ValueError("No training data loaded!")
        
    # Combine all
    combined_dataset = concatenate_datasets(all_datasets)
    print(f"📊 Total samples: {len(combined_dataset)}")
    
    # Shuffle and split
    dataset = combined_dataset.shuffle(seed=42)
    
    # Limit samples if testing
    if max_samples:
        dataset = dataset.select(range(min(max_samples, len(dataset))))
        print(f"   ⚠️ Limited to {len(dataset)} samples for testing")
        
    # Create train/test split (90/10)
    dataset = dataset.train_test_split(test_size=0.1, seed=42)
    print(f"   Train: {len(dataset['train'])}, Test: {len(dataset['test'])}")
    
    # Load model & tokenizer
    print(f"🤖 Loading {model_name}...")
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForSequenceClassification.from_pretrained(
        model_name,
        num_labels=6,
        id2label=ID2LABEL,
        label2id=LABEL2ID
    )
    
    # Tokenize
    def preprocess(examples):
        return tokenizer(
            examples["text"],
            truncation=True,
            max_length=256,
            padding=False
        )
    
    print("🔤 Tokenizing...")
    tokenized = dataset.map(preprocess, batched=True)
    
    # Training args
    output_dir = f"/models/{output_name}"
    training_args = TrainingArguments(
        output_dir=output_dir,
        learning_rate=learning_rate,
        per_device_train_batch_size=batch_size,
        per_device_eval_batch_size=batch_size,
        num_train_epochs=epochs,
        weight_decay=0.01,
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="f1",
        fp16=True,
        logging_steps=100,
        report_to="none"
    )
    
    # Metrics
    accuracy_metric = evaluate.load("accuracy")
    f1_metric = evaluate.load("f1")
    
    def compute_metrics(eval_pred):
        logits, labels = eval_pred
        preds = np.argmax(logits, axis=-1)
        acc = accuracy_metric.compute(predictions=preds, references=labels)["accuracy"]
        f1 = f1_metric.compute(predictions=preds, references=labels, average="weighted")["f1"]
        return {"accuracy": acc, "f1": f1}
    
    # Train
    print("🏋️ Training...")
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized["train"],
        eval_dataset=tokenized["test"],
        tokenizer=tokenizer,
        data_collator=DataCollatorWithPadding(tokenizer),
        compute_metrics=compute_metrics
    )
    
    trainer.train()
    
    # Final evaluation
    print("📊 Final evaluation...")
    results = trainer.evaluate()
    print(f"   Accuracy: {results['eval_accuracy']:.4f}")
    print(f"   F1 Score: {results['eval_f1']:.4f}")
    
    # Save final model
    final_dir = f"/models/{output_name}-final"
    print(f"💾 Saving to {final_dir}...")
    trainer.save_model(final_dir)
    tokenizer.save_pretrained(final_dir)
    
    volume.commit()
    
    return {
        "accuracy": results["eval_accuracy"],
        "f1": results["eval_f1"],
        "output_dir": final_dir
    }


@app.function(image=image, volumes={"/models": volume})
def convert_to_onnx(model_dir: str = "/models/cefr-distilbert-final"):
    """Convert trained model to ONNX format."""
    from optimum.onnxruntime import ORTModelForSequenceClassification
    from transformers import AutoTokenizer
    
    print(f"🔄 Converting {model_dir} to ONNX...")
    
    model = ORTModelForSequenceClassification.from_pretrained(
        model_dir,
        export=True
    )
    tokenizer = AutoTokenizer.from_pretrained(model_dir)
    
    onnx_dir = f"{model_dir}-onnx"
    model.save_pretrained(onnx_dir)
    tokenizer.save_pretrained(onnx_dir)
    
    print(f"✅ Saved ONNX model to {onnx_dir}")
    
    # Quantize
    try:
        from optimum.onnxruntime import ORTQuantizer
        from optimum.onnxruntime.configuration import AutoQuantizationConfig
        
        print("🗜️ Quantizing...")
        quantizer = ORTQuantizer.from_pretrained(onnx_dir)
        qconfig = AutoQuantizationConfig.avx512_vnni(is_static=False)
        
        quantized_dir = f"{model_dir}-onnx-quantized"
        quantizer.quantize(save_dir=quantized_dir, quantization_config=qconfig)
        
        print(f"✅ Saved quantized model to {quantized_dir}")
        volume.commit()
        return {"onnx_dir": onnx_dir, "quantized_dir": quantized_dir}
    except Exception as e:
        print(f"⚠️ Quantization failed: {e}")
        volume.commit()
        return {"onnx_dir": onnx_dir}


@app.function(image=image, volumes={"/models": volume})
def download_model(model_dir: str = "/models/cefr-distilbert-final-onnx-quantized"):
    """Download model files to local machine."""
    import os
    
    files = []
    for root, dirs, filenames in os.walk(model_dir):
        for f in filenames:
            path = os.path.join(root, f)
            rel_path = os.path.relpath(path, model_dir)
            with open(path, "rb") as file:
                files.append({"name": rel_path, "content": file.read()})
    return files


@app.local_entrypoint()
def main(
    quick_test: bool = False,
    convert: bool = False,
    download: bool = False,
    use_all_data: bool = True
):
    """
    Main entrypoint for CEFR model training.
    
    --quick-test: Run fast check with small sample
    --convert: Convert saved model to ONNX
    --download: Download converted model
    --use-all-data: Use combined STM + W&I + HF data (default)
    """
    if convert:
        convert_to_onnx.remote()
    elif download:
        files = download_model.remote()
        import os
        os.makedirs("./cefr-minilm-onnx", exist_ok=True)
        for f in files:
            path = os.path.join("./cefr-minilm-onnx", f["name"])
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "wb") as file:
                file.write(f["content"])
        print(f"Downloaded {len(files)} files.")
    else:
        # Training
        max_samples = 1000 if quick_test else None
        epochs = 2 if quick_test else 5
        
        train.remote(
            max_samples=max_samples,
            epochs=epochs,
            use_stm=True,
            use_wi=True,
            use_hf=True
        )
