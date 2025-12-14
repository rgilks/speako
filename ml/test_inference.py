
from transformers import pipeline, AutoTokenizer, AutoModelForSequenceClassification
import torch

def test_inference():
    model_id = "cefr-minilm-onnx"  # Use local one first
    print(f"Loading model from {model_id}...")
    
    try:
        classifier = pipeline("text-classification", model=model_id, tokenizer=model_id, top_k=6)
    except Exception as e:
        print(f"Could not load local model: {e}")
        print("Trying HuggingFace model 'robg/speako-cefr'...")
        classifier = pipeline("text-classification", model="robg/speako-cefr", top_k=6)

    samples = [
        "My favorite season is autumn. First, there are many events such as sports day.",
        "I think that the pollution is a very big problem for the world.",
        "It will be how to play tennis.",
        "The philosophical underpinnings of this argument represent a dichotomy in modern thought.",
        "Hello my name is Bob."
    ]
    
    print("\nInference Results:")
    for text in samples:
        result = classifier(text)
        # Result is list of lists (top_k) or list of dicts
        # Pipeline with top_k returns list of list of dicts
        top = result[0] if isinstance(result, list) else result
        print(f"\nText: {text[:50]}...")
        for r in top[:3]:
            print(f"  {r['label']}: {r['score']:.4f}")

if __name__ == "__main__":
    test_inference()
