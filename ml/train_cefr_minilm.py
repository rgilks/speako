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


def chunk_text(text: str, min_words=5, max_words=50) -> list:
    """Split long text into sentence-like chunks to simulate speech transcripts."""
    import re
    # Split by sentence endings, keeping delimiters
    chunks = re.split(r'(?<=[.!?])\s+', text)
    valid_chunks = []
    
    current_chunk = []
    current_len = 0
    
    for chunk in chunks:
        words = chunk.split()
        if not words:
            continue
            
        # If adding this sentence exceeds max, start new chunk
        if current_len + len(words) > max_words and current_chunk:
            valid_chunks.append(" ".join(current_chunk))
            current_chunk = []
            current_len = 0
            
        current_chunk.append(chunk)
        current_len += len(words)
        
    if current_chunk:
        valid_chunks.append(" ".join(current_chunk))
        
    # Filter very short chunks unless they are the only one
    return [c for c in valid_chunks if len(c.split()) >= min_words]


def parse_wi_corpus(tsv_path: str) -> list:
    """Parse Write & Improve Corpus TSV and chunk essays."""
    import pandas as pd
    import os
    
    if not os.path.exists(tsv_path):
        print(f"⚠️ W&I corpus file not found: {tsv_path}")
        return []
        
    print(f"   Parsing W&I corpus: {tsv_path}")
    try:
        df = pd.read_csv(tsv_path, sep='\t', on_bad_lines='skip')
        entries = []
        
        for _, row in df.iterrows():
            text = row.get('text', '')
            if not isinstance(text, str) or not text.strip():
                continue
                
            raw_label = str(row.get('automarker_cefr_level', '')).strip().upper()
            base_label = raw_label.replace('+', '').replace('-', '')
            
            if base_label in LABEL2ID:
                label_id = LABEL2ID[base_label]
                
                # Chunk the essay to match speech transcript length
                # This prevents the model from learning "long text = high level"
                chunks = chunk_text(text)
                
                for chunk in chunks:
                    entries.append({
                        'text': chunk,
                        'label': label_id,
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
        DataCollatorWithPadding,
        EarlyStoppingCallback
    )
    from datasets import Dataset, concatenate_datasets
    from sklearn.metrics import classification_report
    
    print(f"🚀 Starting CEFR training with {model_name}")
    print(f"   Sources: STM={use_stm}, W&I={use_wi}, HF={use_hf}")
    
    all_datasets = []
    stm_test_dataset = None # Hold out pure STM data for specific validation
    
    # 1. Load Local STM Data
    if use_stm:
        print("📦 Loading STM data...")
        stm_entries = []
        eval_entries = [] # For held-out STM test
        
        # Load train/dev for training
        for fname in ["train-asr.stm", "dev-asr.stm"]:
            try:
                with open(f"/stm-data/{fname}", "r") as f:
                    stm_entries.extend(parse_stm_file(f.read()))
            except Exception as e:
                pass
                
        # Load eval for held-out testing
        try:
            with open("/stm-data/eval-asr.stm", "r") as f:
                eval_entries = parse_stm_file(f.read())
        except Exception:
            pass
        
        if stm_entries:
            # OVERSAMPLE STM DATA
            # W&I has ~92k samples. STM has ~20k.
            # We multiply STM by 4 to essentially balance the dataset
            # so the model pays equal attention to spoken text grammar.
            print(f"   ⚖️ Oversampling STM data (x4) to balance with W&I...")
            stm_entries = stm_entries * 4
            
            print(f"   ✅ STM Train samples (Weighted): {len(stm_entries)}")
            all_datasets.append(Dataset.from_list(stm_entries))
            
        if eval_entries:
            print(f"   ✅ STM Eval samples: {len(eval_entries)} (Target Validation Set)")
            stm_test_dataset = Dataset.from_list(eval_entries)
            
    # 2. Load Write & Improve Corpus (Chunked)
    if use_wi:
        print("📦 Loading Write & Improve corpus (Chunked)...")
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
        
    # Combine training data
    combined_dataset = concatenate_datasets(all_datasets)
    print(f"📊 Total Training samples: {len(combined_dataset)}")
    
    # Shuffle
    dataset = combined_dataset.shuffle(seed=42)
    
    if max_samples:
        dataset = dataset.select(range(min(max_samples, len(dataset))))
        if stm_test_dataset:
            stm_test_dataset = stm_test_dataset.select(range(min(100, len(stm_test_dataset))))
    
    # We no longer need a random split for validation, because we are using
    # the reliable STM Eval set as our "Best Model" selector.
    # However, we'll keeping a small train split just to be safe if no STM data is present.
    dataset = dataset.train_test_split(test_size=0.01, seed=42)
    print(f"   Train: {len(dataset['train'])}")
    
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
    tokenized_train = dataset.map(preprocess, batched=True)
    
    tokenized_stm_test = None
    if stm_test_dataset:
        print("🔤 Tokenizing STM Eval set (Primary Validation)...")
        tokenized_stm_test = stm_test_dataset.map(preprocess, batched=True)
    
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
        save_total_limit=2,  # Save space by keeping only 2 best checkpoints
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
    
    # Determine the eval set
    # CRITICAL: We use the STM Test Set as the evaluation dataset.
    # This forces the Trainer to select the model that performs best on SPOKEN DATA.
    eval_ds = tokenized_stm_test if tokenized_stm_test else tokenized_train["test"]
    
    # Train
    print(f"🏋️ Training (Optimizing for {'STM Spoken' if tokenized_stm_test else 'Mixed'} Accuracy)...")
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized_train["train"],
        eval_dataset=eval_ds, 
        tokenizer=tokenizer,
        data_collator=DataCollatorWithPadding(tokenizer),
        compute_metrics=compute_metrics,
        callbacks=[EarlyStoppingCallback(early_stopping_patience=3)] # Stop if no improvement for 3 epochs
    )
    
    trainer.train()
    
    # Final evaluation on MIXED Dev set
    print("\n📊 Final Evaluation (Mixed Dev Set)...")
    results = trainer.evaluate()
    print(f"   Accuracy: {results['eval_accuracy']:.4f}")
    print(f"   F1 Score: {results['eval_f1']:.4f}")
    
    # Detailed Eval on STM Test set (Target Domain)
    if tokenized_stm_test:
        print("\n🎯 Target Domain Evaluation (Held-out STM Transcripts)...")
        stm_results = trainer.evaluate(tokenized_stm_test)
        print(f"   Accuracy: {stm_results['eval_accuracy']:.4f}")
        print(f"   F1 Score: {stm_results['eval_f1']:.4f}")
        
        # Classification Report
        predictions = trainer.predict(tokenized_stm_test)
        preds = np.argmax(predictions.predictions, axis=-1)
        labels = predictions.label_ids
        print("\n📋 Classification Report (STM Data):")
        print(classification_report(
            labels, 
            preds, 
            labels=list(LABEL2ID.values()),
            target_names=list(LABEL2ID.keys()),
            zero_division=0
        ))
    
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
    full_pipeline: bool = False
):
    """
    Main entrypoint for CEFR model training.
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
    elif full_pipeline:
        print("🚀 Starting Full Pipeline (Train -> Convert) in Cloud...")
        # We can't easily chain remote functions in local_entrypoint if we detach.
        # But we can call them sequentially if we stay attached.
        # To support --detach for the WHOLE sequence, we need a remote function that calls them.
        # However, for now, we'll just run train, and since we are using --detach per user request,
        # we will rely on a new orchestrator function if we want to chain them.
        # Let's define a simple orchestrator.
        run_full_pipeline.remote(quick_test=quick_test)
    else:
        max_samples = 1000 if quick_test else None
        epochs = 2 if quick_test else 15
        
        train.remote(
            max_samples=max_samples,
            epochs=epochs,
            use_stm=True,
            use_wi=True,
            use_hf=True
        )

@app.function(
    image=training_image,  # Use training image which has mounts
    volumes={"/models": volume}, 
    gpu="T4",
    timeout=7200
)
def run_full_pipeline(quick_test: bool = False):
    """Orchestrates the full Train -> Convert pipeline in the cloud."""
    max_samples = 1000 if quick_test else None
    epochs = 2 if quick_test else 15
    
    print("Step 1: Training...")
    # Since we are using the SAME image with mounts, we can call the underlying function
    # BUT 'train' relies on the decoration for some behaviors? No, it's just a function.
    # However, to be safe and simple, let's call it as a regular function since we are
    # inside the container that has the mounts.
    # WAIT: train is decorated. train.local() runs the raw function.
    # The issue before was 'run_full_pipeline' didn't have the mounts!
    # I changed the image above to 'training_image' which includes the mounts.
    
    train_res = train.local(
        max_samples=max_samples,
        epochs=epochs,
        use_stm=True,
        use_wi=True,
        use_hf=True
    )
    
    print(f"Step 2: Converting {train_res['output_dir']}...")
    convert_to_onnx.local(model_dir=train_res['output_dir'])
    
    print("✅ Full pipeline complete!")
