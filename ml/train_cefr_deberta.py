"""
CEFR DeBERTa-v3 Training Script with Noise Augmentation
for Robust ASR Transcription Classification.

Usage:
    modal run ml/train_cefr_deberta.py
"""

import modal
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





# -----------------------------------------------------------------------------
# CORE LOGIC
# -----------------------------------------------------------------------------

# Mount local data - STM files are used for VALIDATION ONLY (not training)
# This is permitted under the S&I license for non-commercial research.
# Training uses UniversalCEFR (CC-BY-NC-4.0) which allows derivative models.
training_image = (
    image
    .add_local_dir("test-data/reference-materials/stms", remote_path="/stm-data")
    .add_local_file("ml/cefr_utils.py", remote_path="/root/cefr_utils.py") 
)


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
    from transformers import (
        AutoTokenizer,
        AutoModelForSequenceClassification,
        TrainingArguments,
        Trainer,
        DataCollatorWithPadding,
        EarlyStoppingCallback
    )
    from datasets import Dataset
    import evaluate
    from cefr_utils import parse_stm_file, load_universal_cefr, LABEL2ID, ID2LABEL, augment_text_with_noise
    from sklearn.metrics import classification_report
    
    MODEL_NAME = "microsoft/deberta-v3-small"
    OUTPUT_DIR = "/models/cefr-deberta-v3-small"
    
    print(f"🚀 Starting DeBERTa training: {MODEL_NAME}")
    print("📋 License Compliance: Training on UniversalCEFR (CC-BY-NC-4.0)")
    print("   S&I Corpus used for VALIDATION ONLY (research use permitted)")
    
    # 1. Load Tokenizer
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    
    # 2. Load Training Data - UniversalCEFR (CC-BY-NC-4.0 allows derivative models)
    print("📦 Loading UniversalCEFR training data...")
    train_entries = load_universal_cefr(max_samples=max_samples)
    
    if not train_entries:
        raise RuntimeError("Failed to load UniversalCEFR dataset!")
    
    print(f"📊 Total Training Samples: {len(train_entries)}")
    
    # 3. Create Dataset with Noise Augmentation
    # Simulates ASR transcription errors to improve robustness
    
    texts = [e['text'] for e in train_entries]
    labels = [e['label'] for e in train_entries]
    
    print("🔀 Running noise augmentation...")
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

    # 10. Eval on S&I STM Test Set (VALIDATION ONLY - research use permitted)
    # NOTE: This data is NOT used for training, only evaluation.
    # The license permits non-commercial research use of the corpus.
    try:
        print("\n🧐 Evaluating on S&I STM Test Set (Validation Only)...")
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

@app.local_entrypoint()
def main():
    """Run the training remotely."""
    train_deberta.remote()
