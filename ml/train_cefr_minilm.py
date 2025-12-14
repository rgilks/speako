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
    "optimum[onnxruntime]>=1.16.0"  # For ONNX conversion
)

# Volume to persist model artifacts
volume = modal.Volume.from_name("cefr-models", create_if_missing=True)

LABEL2ID = {"A1": 0, "A2": 1, "B1": 2, "B2": 3, "C1": 4, "C2": 5}
ID2LABEL = {v: k for k, v in LABEL2ID.items()}


def parse_stm_file(content: str) -> list:
    """Parse STM file format with CEFR labels.
    
    Format: <o,Q4,B2,P1> transcript text
    Where B2 = CEFR level
    """
    import re
    
    entries = []
    for line in content.split('\n'):
        line = line.strip()
        if not line or line.startswith(';;'):
            continue
        
        # Extract label and text
        # Format: file_id channel speaker start end <label_string> transcript
        match = re.search(r'<[^>]+>', line)
        if not match:
            continue
        
        label_str = match.group(0)  # <o,Q4,B2,P1>
        text = line[match.end():].strip()
        
        if not text:
            continue
        
        # Extract CEFR level from label string
        # Labels like: <o,Q4,B2,P1> -> B2
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
                'cefr_level': cefr,
                'label': LABEL2ID[cefr]
            })
    
    return entries


# Create image with local STM data embedded
training_image = image.add_local_dir(
    "dist/test-data/reference-materials/stms",
    remote_path="/stm-data"
)

@app.function(
    image=training_image,
    gpu="T4",
    timeout=7200,  # 2 hours max
    volumes={"/models": volume}
)
def train(
    model_name: str = "distilbert-base-uncased",  # Reliable small model for classification
    output_name: str = "cefr-distilbert",
    epochs: int = 5,
    batch_size: int = 32,
    learning_rate: float = 2e-5,
    max_samples: int = None,  # Limit samples for testing
    use_local_data: bool = True  # Use your STM data instead of UniversalCEFR
):
    """Train MiniLM on CEFR dataset."""
    import numpy as np
    import evaluate
    from transformers import (
        AutoTokenizer,
        AutoModelForSequenceClassification,
        TrainingArguments,
        Trainer,
        DataCollatorWithPadding
    )
    from datasets import Dataset, DatasetDict
    
    print(f"🚀 Starting CEFR training with {model_name}")
    
    if use_local_data:
        # Load from your STM files
        print("📦 Loading local STM training data...")
        
        train_entries = []
        dev_entries = []  # For validation during training
        eval_entries = []  # Held-out test set (never seen during training)
        
        # Load train data
        try:
            with open("/stm-data/train-asr.stm", "r") as f:
                train_entries = parse_stm_file(f.read())
            print(f"   Train entries: {len(train_entries)}")
        except Exception as e:
            print(f"   ⚠️ Could not load train-asr.stm: {e}")
        
        # Load dev data for validation during training
        try:
            with open("/stm-data/dev-asr.stm", "r") as f:
                dev_entries = parse_stm_file(f.read())
            print(f"   Dev (validation) entries: {len(dev_entries)}")
        except Exception as e:
            print(f"   ⚠️ Could not load dev-asr.stm: {e}")
        
        # Load eval data as held-out test set
        try:
            with open("/stm-data/eval-asr.stm", "r") as f:
                eval_entries = parse_stm_file(f.read())
            print(f"   Eval (held-out test) entries: {len(eval_entries)}")
        except Exception as e:
            print(f"   ⚠️ Could not load eval-asr.stm: {e}")
        
        if not train_entries:
            raise ValueError("No training data loaded from STM files!")
        
        # Convert to HuggingFace datasets
        train_dataset = Dataset.from_list(train_entries)
        # Use dev for validation during training, fall back to split if missing
        dev_dataset = Dataset.from_list(dev_entries) if dev_entries else train_dataset.train_test_split(test_size=0.1, seed=42)["test"]
        
        dataset = DatasetDict({
            "train": train_dataset,
            "test": dev_dataset  # "test" is used for validation during training
        })
        
        # Store eval for final held-out testing (after training)
        if eval_entries:
            dataset["eval"] = Dataset.from_list(eval_entries)
        
        print(f"\n   📊 Data Split Summary:")
        print(f"      Train: {len(dataset['train'])} (for training)")
        print(f"      Dev: {len(dataset['test'])} (for validation during training)")
        if "eval" in dataset:
            print(f"      Eval: {len(dataset['eval'])} (held-out, for final testing)")
        
    else:
        # Load UniversalCEFR from HuggingFace
        print("📦 Loading UniversalCEFR dataset...")
        from datasets import load_dataset
        dataset = load_dataset("cefr-learning/UniversalCEFR")
        
        # Filter to English only
        dataset = dataset.filter(lambda x: x["language"] == "en")
        print(f"   English samples: {len(dataset['train'])}")
        
        # Map CEFR labels to integers
        def map_labels(example):
            label = example["cefr_level"].upper().strip()
            if label in LABEL2ID:
                example["label"] = LABEL2ID[label]
            else:
                example["label"] = 0
            return example
        
        dataset = dataset.map(map_labels)
        dataset = dataset["train"].train_test_split(test_size=0.1, seed=42)
        print(f"   Train: {len(dataset['train'])}, Test: {len(dataset['test'])}")
    
    # Limit samples if specified (for testing)
    if max_samples:
        dataset["train"] = dataset["train"].select(range(min(max_samples, len(dataset["train"]))))
        print(f"   Limited to: {len(dataset['train'])} samples")
    
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
    columns_to_remove = [c for c in dataset["train"].column_names if c != "label"]
    tokenized = dataset.map(preprocess, batched=True, remove_columns=columns_to_remove)
    
    # Training args
    output_dir = f"/models/{output_name}"
    training_args = TrainingArguments(
        output_dir=output_dir,
        learning_rate=learning_rate,
        per_device_train_batch_size=batch_size,
        per_device_eval_batch_size=batch_size,
        num_train_epochs=epochs,
        weight_decay=0.01,
        eval_strategy="epoch",  # Updated from deprecated evaluation_strategy
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
    
    # Commit volume
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
    
    # Load and export
    model = ORTModelForSequenceClassification.from_pretrained(
        model_dir,
        export=True
    )
    tokenizer = AutoTokenizer.from_pretrained(model_dir)
    
    # Save ONNX
    onnx_dir = f"{model_dir}-onnx"
    model.save_pretrained(onnx_dir)
    tokenizer.save_pretrained(onnx_dir)
    
    print(f"✅ Saved ONNX model to {onnx_dir}")
    
    # Quantize for smaller size
    try:
        from optimum.onnxruntime import ORTQuantizer
        from optimum.onnxruntime.configuration import AutoQuantizationConfig
        
        print("🗜️ Quantizing for smaller size...")
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
    import json
    
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
    use_hf: bool = False  # Use HuggingFace UniversalCEFR instead of local STM data
):
    """
    Main entrypoint.
    
    Examples:
        # Quick test with local STM data (1000 samples)
        modal run ml/train_cefr_minilm.py --quick-test
        
        # Full training with local STM data
        modal run ml/train_cefr_minilm.py
        
        # Full training with HuggingFace UniversalCEFR
        modal run ml/train_cefr_minilm.py --use-hf
        
        # Convert to ONNX after training
        modal run ml/train_cefr_minilm.py --convert
        
        # Download model files
        modal run ml/train_cefr_minilm.py --download
    """
    if convert:
        result = convert_to_onnx.remote()
        print(f"Conversion complete: {result}")
    elif download:
        files = download_model.remote()
        import os
        os.makedirs("./cefr-minilm-onnx", exist_ok=True)
        for f in files:
            path = os.path.join("./cefr-minilm-onnx", f["name"])
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "wb") as file:
                file.write(f["content"])
        print(f"Downloaded {len(files)} files to ./cefr-minilm-onnx")
    else:
        # Training
        max_samples = 1000 if quick_test else None
        epochs = 2 if quick_test else 5
        use_local_data = not use_hf
        
        print(f"📊 Data source: {'HuggingFace UniversalCEFR' if use_hf else 'Local STM files'}")
        
        result = train.remote(
            max_samples=max_samples,
            epochs=epochs,
            use_local_data=use_local_data
        )
        print(f"\n🎉 Training complete!")
        print(f"   Accuracy: {result['accuracy']:.4f}")
        print(f"   F1 Score: {result['f1']:.4f}")
        print(f"   Model: {result['output_dir']}")
