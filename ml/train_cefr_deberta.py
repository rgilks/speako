"""
CEFR DeBERTa-v3 Training Script with Noise Augmentation
for Robust ASR Transcription Classification.

Usage:
    modal run ml/train_cefr_deberta.py
"""

import modal
import random
import numpy as np
import os

# Modal setup
app = modal.App("cefr-deberta-training")

# DeBERTa requires sentencepiece
image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "transformers>=4.36.0",
    "datasets>=2.16.0",
    "evaluate>=0.4.0",
    "accelerate>=0.25.0",
    "scikit-learn>=1.3.0",
    "torch>=2.1.0",
    "numpy<2.0.0",
    "pandas>=2.0.0",
    "optimum[onnxruntime]>=1.16.0",
    "sentencepiece>=0.1.99",
    "protobuf" 
)

# Volume to persist model artifacts
volume = modal.Volume.from_name("cefr-models", create_if_missing=True)

LABEL2ID = {"A1": 0, "A2": 1, "B1": 2, "B2": 3, "C1": 4, "C2": 5}
ID2LABEL = {v: k for k, v in LABEL2ID.items()}

# -----------------------------------------------------------------------------
# NOISE AUGMENTATION UTILS
# -----------------------------------------------------------------------------

def augment_text_with_noise(text: str, noise_prob: float = 0.1) -> str:
    """
    Simulate ASR errors:
    1. Character swaps (typos)
    2. Character deletions (swallowed sounds)
    3. Word deletions (missed words)
    """
    if not text: return text
    
    # Don't augment everything, preserve some clean structure
    if random.random() > 0.8: 
        return text

    words = text.split()
    new_words = []
    
    for word in words:
        r = random.random()
        
        # 3% chance to drop short words (ASR skipping)
        if len(word) < 4 and r < 0.03:
            continue
            
        # 5% chance to swap characters (Typos)
        if len(word) > 3 and r < 0.08:
            chars = list(word)
            if len(chars) > 1:
                idx = random.randint(0, len(chars) - 2)
                chars[idx], chars[idx+1] = chars[idx+1], chars[idx]
                new_words.append("".join(chars))
                continue
                
        # 3% chance to delete a valid character (Swallowed sound)
        if len(word) > 4 and r < 0.11:
             chars = list(word)
             idx = random.randint(1, len(chars) - 2) # Don't delete start/end
             del chars[idx]
             new_words.append("".join(chars))
             continue
             
        new_words.append(word)
        
    return " ".join(new_words)

# -----------------------------------------------------------------------------
# CORE LOGIC
# -----------------------------------------------------------------------------

# Mount local data
training_image = (
    image
    .add_local_dir("dist/test-data/reference-materials/stms", remote_path="/stm-data")
    .add_local_file("ml/cefr_utils.py", remote_path="/root/cefr_utils.py") 
)

if wi_path := os.environ.get("WI_CORPUS_PATH"):
    training_image = training_image.add_local_dir(wi_path, remote_path="/wi-data")
else:
    print("⚠️  WI_CORPUS_PATH not set. W&I data will not be available.")


@app.function(
    image=training_image,
    gpu="T4",
    timeout=7200,
    volumes={"/models": volume}
)
def train_deberta(
    epochs: int = 4, # Reduced for speed, early stopping will handle it
    batch_size: int = 64, # Increased for speed (T4 can handle 64 for small model)
    learning_rate: float = 2e-5,
    max_samples: int = 60000 # Capped for speed (60k is plenty for 44M params)
):
    import os
    import torch
    from transformers import (
        AutoTokenizer,
        AutoModelForSequenceClassification,
        TrainingArguments,
        Trainer,
        DataCollatorWithPadding,
        EarlyStoppingCallback
    )
    from datasets import Dataset, concatenate_datasets
    import evaluate
    from cefr_utils import parse_stm_file, parse_wi_corpus, chunk_text
    from sklearn.metrics import classification_report
    
    MODEL_NAME = "microsoft/deberta-v3-small"
    OUTPUT_DIR = "/models/cefr-deberta-v3-small"
    
    print(f"🚀 Starting DeBERTa training: {MODEL_NAME}")
    
    # 1. Load Tokenizer
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    
    # 2. Load Data
    all_entries = []
    
    # Load STM (Real Speech) - High Value
    print("📦 Loading STM data...")
    for fname in ["train-asr.stm", "dev-asr.stm"]:
        path = f"/stm-data/{fname}"
        if os.path.exists(path):
            with open(path) as f:
                entries = parse_stm_file(f.read())
                # Oversample STM data 3x because it's the target domain
                all_entries.extend(entries * 3) 
    
    # Load W&I (Written) - Volume
    print("📦 Loading WI Corpus...")
    wi_entries = parse_wi_corpus("/wi-data/en-writeandimprove2024-corpus.tsv")
    if max_samples:
        wi_entries = wi_entries[:max_samples]
    all_entries.extend(wi_entries)
    
    print(f"📊 Total Training Samples: {len(all_entries)}")
    
    # 3. Create Dataset with On-the-fly Augmentation
    # We apply augmentation BEFORE tokenization for simplicity in this script
    # Ideally this would be a custom Transform, but mapping is easier here.
    
    texts = [e['text'] for e in all_entries]
    labels = [e['label'] for e in all_entries]
    
    # Apply Augmentation to W&I data primarily (since it's too clean)
    # STM data is already noisy, but we can add a bit more.
    print("running augmentation...")
    augmented_texts = [augment_text_with_noise(t) for t in texts]
    
    dataset = Dataset.from_dict({'text': augmented_texts, 'label': labels})
    
    # Split
    dataset = dataset.shuffle(seed=42)
    split = dataset.train_test_split(test_size=0.1)
    train_ds = split['train']
    eval_ds = split['test']
    
    # 4. Tokenize
    def preprocess(examples):
        return tokenizer(examples["text"], truncation=True, max_length=256)
        
    print("tokenize...")
    tokenized_train = train_ds.map(preprocess, batched=True)
    tokenized_eval = eval_ds.map(preprocess, batched=True)
    
    # 5. Model Setup
    model = AutoModelForSequenceClassification.from_pretrained(
        MODEL_NAME,
        num_labels=6,
        id2label=ID2LABEL,
        label2id=LABEL2ID
    )
    
    # 6. Metrics
    f1_metric = evaluate.load("f1")
    acc_metric = evaluate.load("accuracy")
    
    def compute_metrics(eval_pred):
        predictions, labels = eval_pred
        predictions = np.argmax(predictions, axis=1)
        return {
            "accuracy": acc_metric.compute(predictions=predictions, references=labels)["accuracy"],
            "f1": f1_metric.compute(predictions=predictions, references=labels, average="weighted")["f1"]
        }

    # 7. Trainer
    training_args = TrainingArguments(
        output_dir=OUTPUT_DIR,
        learning_rate=learning_rate,
        per_device_train_batch_size=batch_size,
        per_device_eval_batch_size=batch_size,
        num_train_epochs=epochs,
        weight_decay=0.01,
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="f1",
        fp16=True, # T4 supports fp16
        logging_steps=100
    )
    
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized_train,
        eval_dataset=tokenized_eval,
        tokenizer=tokenizer,
        data_collator=DataCollatorWithPadding(tokenizer=tokenizer),
        compute_metrics=compute_metrics,
        callbacks=[EarlyStoppingCallback(early_stopping_patience=2)]
    )
    
    # 8. Train
    print("🏋️ Training...")
    trainer.train()
    
    # 9. Save & ONNX Export (Moved BEFORE Evaluation to prevent loss on crash)
    print("💾 Saving Model...")
    trainer.save_model(f"{OUTPUT_DIR}/final")
    
    print("📦 Converting to ONNX...")
    from optimum.onnxruntime import ORTModelForSequenceClassification
    
    ort_model = ORTModelForSequenceClassification.from_pretrained(
        f"{OUTPUT_DIR}/final", 
        export=True
    )
    ort_model.save_pretrained(f"{OUTPUT_DIR}/onnx")
    tokenizer.save_pretrained(f"{OUTPUT_DIR}/onnx")
    
    # Force Commit to Volume
    volume.commit()
    print("✅ Model saved to volume.")

    # 10. Eval on separate STM Test Set (The Real Test)
    try:
        print("\n🧐 Evaluating on STM Test Set (Real World Data)...")
        stm_test_path = "/stm-data/eval-asr.stm"
        if os.path.exists(stm_test_path):
            with open(stm_test_path) as f:
                test_entries = parse_stm_file(f.read())
            
            test_ds = Dataset.from_dict({
                'text': [e['text'] for e in test_entries],
                'label': [e['label'] for e in test_entries]
            })
            tokenized_test = test_ds.map(preprocess, batched=True)
            
            res = trainer.evaluate(tokenized_test)
            print(f"STM Test Results: F1={res['eval_f1']:.4f}, Acc={res['eval_accuracy']:.4f}")
            
            # Detailed Report
            predictions = trainer.predict(tokenized_test)
            preds = np.argmax(predictions.predictions, axis=1)
            print("\nClassification Report:\n")
            # Removed target_names to avoid mismatch error
            print(classification_report([e['label'] for e in test_entries], preds))
    except Exception as e:
        print(f"⚠️ Validation failed (but model is saved): {e}")
    
    print("🏁 Script Completed.")
