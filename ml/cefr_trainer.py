
import os
import numpy as np
import evaluate
from datasets import Dataset, concatenate_datasets
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    TrainingArguments,
    Trainer,
    DataCollatorWithPadding,
    EarlyStoppingCallback
)
from sklearn.metrics import classification_report

# Import from local utils (assumes in same dir or path)
try:
    from cefr_utils import LABEL2ID, ID2LABEL, parse_stm_file, parse_wi_corpus
except ImportError:
    from .cefr_utils import LABEL2ID, ID2LABEL, parse_stm_file, parse_wi_corpus

def train_model(
    model_name: str,
    output_dir: str,
    epochs: int,
    batch_size: int,
    learning_rate: float,
    max_samples: int = None,
    use_stm: bool = True,
    use_wi: bool = True,
    use_hf: bool = True,
    stm_data_path: str = "/stm-data",
    wi_data_path: str = "/wi-data",
    volume_commit_fn = None
):
    """
    Main training function to be called within the Modal container.
    """
    print(f"🚀 Starting CEFR training with {model_name}")
    
    all_datasets = []
    stm_test_dataset = None # Hold out pure STM data for specific validation
    
    # 1. Load Local STM Data
    if use_stm:
        print("📦 Loading STM data...")
        stm_entries = []
        eval_entries = [] # For held-out STM test
        
        # Load train/dev for training
        for fname in ["train-asr.stm", "dev-asr.stm"]:
            path = os.path.join(stm_data_path, fname)
            try:
                with open(path, "r") as f:
                    stm_entries.extend(parse_stm_file(f.read()))
            except Exception as e:
                print(f"   ⚠️ Warning: Could not load {path}: {e}")
                pass
                
        # Load eval for held-out testing
        eval_path = os.path.join(stm_data_path, "eval-asr.stm")
        try:
            with open(eval_path, "r") as f:
                eval_entries = parse_stm_file(f.read())
        except Exception:
            pass
        
        if stm_entries:
            # OVERSAMPLE STM DATA
            print(f"   ⚖️ Oversampling STM data (x4) to balance with W&I...")
            stm_entries = stm_entries * 4
            print(f"   ✅ STM Train samples (Weighted): {len(stm_entries)}")
            all_datasets.append(Dataset.from_list(stm_entries))
            
        if eval_entries:
            print(f"   ✅ STM Eval samples: {len(eval_entries)} (Target Validation Set)")
            stm_test_dataset = Dataset.from_list(eval_entries)

    # 2. Load Write & Improve Corpus (Chunked)
    if use_wi:
        wi_file = os.path.join(wi_data_path, "en-writeandimprove2024-corpus.tsv")
        print("📦 Loading Write & Improve corpus (Chunked)...")
        wi_entries = parse_wi_corpus(wi_file)
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
        
    combined_dataset = concatenate_datasets(all_datasets)
    print(f"📊 Total Training samples: {len(combined_dataset)}")
    
    dataset = combined_dataset.shuffle(seed=42)
    
    if max_samples:
        dataset = dataset.select(range(min(max_samples, len(dataset))))
        if stm_test_dataset:
            stm_test_dataset = stm_test_dataset.select(range(min(100, len(stm_test_dataset))))
            
    # Small test split for safety
    dataset = dataset.train_test_split(test_size=0.01, seed=42)
    print(f"   Train: {len(dataset['train'])}")
    
    print(f"🤖 Loading {model_name}...")
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForSequenceClassification.from_pretrained(
        model_name,
        num_labels=6,
        id2label=ID2LABEL,
        label2id=LABEL2ID
    )
    
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
        save_total_limit=2,
        fp16=True,
        logging_steps=100,
        report_to="none"
    )
    
    accuracy_metric = evaluate.load("accuracy")
    f1_metric = evaluate.load("f1")
    
    def compute_metrics(eval_pred):
        logits, labels = eval_pred
        preds = np.argmax(logits, axis=-1)
        acc = accuracy_metric.compute(predictions=preds, references=labels)["accuracy"]
        f1 = f1_metric.compute(predictions=preds, references=labels, average="weighted")["f1"]
        return {"accuracy": acc, "f1": f1}
    
    # Use STM test set as validation if available
    eval_ds = tokenized_stm_test if tokenized_stm_test else tokenized_train["test"]
    
    print(f"🏋️ Training (Optimizing for {'STM Spoken' if tokenized_stm_test else 'Mixed'} Accuracy)...")
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized_train["train"],
        eval_dataset=eval_ds,
        tokenizer=tokenizer,
        data_collator=DataCollatorWithPadding(tokenizer),
        compute_metrics=compute_metrics,
        callbacks=[EarlyStoppingCallback(early_stopping_patience=3)]
    )
    
    trainer.train()
    
    print("\n📊 Final Evaluation...")
    results = trainer.evaluate()
    print(f"   Accuracy: {results['eval_accuracy']:.4f}")
    
    # Report on STM if available
    if tokenized_stm_test:
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
        
    final_dir = f"{output_dir}-final"
    print(f"💾 Saving to {final_dir}...")
    trainer.save_model(final_dir)
    tokenizer.save_pretrained(final_dir)
    
    if volume_commit_fn:
        volume_commit_fn()
        
    return {
        "accuracy": results["eval_accuracy"],
        "f1": results["eval_f1"],
        "output_dir": final_dir
    }
