import re
import os
import random
import pandas as pd
from typing import List, Dict, Any, Optional

LABEL2ID = {"A1": 0, "A2": 1, "B1": 2, "B2": 3, "C1": 4, "C2": 5}
ID2LABEL = {v: k for k, v in LABEL2ID.items()}


def augment_text_with_noise(text: str, noise_prob: float = 0.1) -> str:
    """
    Simulate ASR errors:
    1. Character swaps (typos)
    2. Character deletions (swallowed sounds)
    3. Word deletions (missed words)
    """
    if not text:
        return text

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
                chars[idx], chars[idx + 1] = chars[idx + 1], chars[idx]
                new_words.append("".join(chars))
                continue

        # 3% chance to delete a valid character (Swallowed sound)
        if len(word) > 4 and r < 0.11:
            chars = list(word)
            idx = random.randint(1, len(chars) - 2)  # Don't delete start/end
            del chars[idx]
            new_words.append("".join(chars))
            continue

        new_words.append(word)

    return " ".join(new_words)


def parse_stm_file(content: str) -> List[Dict[str, Any]]:
    """Parse STM file format with CEFR labels."""
    entries = []
    for line in content.split("\n"):
        line = line.strip()
        if not line or line.startswith(";;"):
            continue

        # Format: file_id channel speaker start end <label_string> transcript
        match = re.search(r"<[^>]+>", line)
        if not match:
            continue

        label_str = match.group(0)
        text = line[match.end() :].strip()

        if not text:
            continue

        # Extract CEFR level from label string
        parts = label_str.strip("<>").split(",")
        cefr = None
        for part in parts:
            part = part.strip()
            if part in ["A1", "A2", "B1", "B2", "C1", "C2", "C"]:
                cefr = "C1" if part == "C" else part  # Map 'C' to 'C1'
                break

        if cefr and cefr in LABEL2ID:
            entries.append({"text": text, "label": LABEL2ID[cefr], "source": "stm"})

    return entries


def chunk_text(text: str, min_words: int = 5, max_words: int = 50) -> List[str]:
    """Split long text into sentence-like chunks to simulate speech transcripts."""
    # Split by sentence endings, keeping delimiters
    chunks = re.split(r"(?<=[.!?])\s+", text)
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


def parse_wi_corpus(tsv_path: str) -> List[Dict[str, Any]]:
    """
    DEPRECATED: Parse Write & Improve Corpus TSV.

    This function is deprecated due to licensing restrictions. The W&I corpus
    license prohibits releasing models derived from the data. Use
    load_universal_cefr() for training instead.

    This function may still be used for local evaluation/research purposes.
    """
    if not os.path.exists(tsv_path):
        print(f"⚠️ W&I corpus file not found: {tsv_path}")
        return []

    print(f"   Parsing W&I corpus: {tsv_path}")
    try:
        df = pd.read_csv(tsv_path, sep="\t", on_bad_lines="skip")
        entries = []

        for _, row in df.iterrows():
            text = row.get("text", "")
            if not isinstance(text, str) or not text.strip():
                continue

            raw_label = str(row.get("automarker_cefr_level", "")).strip().upper()
            base_label = raw_label.replace("+", "").replace("-", "")

            if base_label in LABEL2ID:
                label_id = LABEL2ID[base_label]

                # Chunk the essay to match speech transcript length
                # This prevents the model from learning "long text = high level"
                chunks = chunk_text(text)

                for chunk in chunks:
                    entries.append({"text": chunk, "label": label_id, "source": "wi"})

        return entries
    except Exception as e:
        print(f"   ⚠️ Error parsing W&I corpus: {e}")
        return []


def load_universal_cefr(
    max_samples: Optional[int] = None, min_words: int = 5, max_words: int = 50
) -> List[Dict[str, Any]]:
    """
    Load CEFR-labeled data from HuggingFace for classifier training.

    Tries multiple open-licensed datasets in order of preference:
    1. UniversalCEFR (CC-BY-NC-4.0) - 500k+ texts, 13 languages
    2. edesaras/CEFR-Sentence-Level-Annotations - 10k+ English sentences

    Args:
        max_samples: Maximum samples to return (None for all)
        min_words: Minimum words per chunk
        max_words: Maximum words per chunk (longer texts are split)

    Returns:
        List of dicts with 'text', 'label', and 'source' keys
    """
    try:
        from datasets import load_dataset
    except ImportError:
        print("⚠️ datasets library not installed. Run: uv pip install datasets")
        return []

    # Dataset configurations - will try to load ALL of these and combine
    DATASET_CONFIGS = [
        {
            "name": "edesaras/CEFR-Sentence-Level-Annotations",
            "text_field": "text",
            "level_field": "Annotator I",  # Integer 0-5 = A1-C2
            "level_is_numeric": True,
            "lang_field": None,
            "lang_filter": None,
            "source_field": None,
            "license": "CC-BY-NC-SA",
        },
        {
            "name": "Alex123321/english_cefr_dataset",
            "text_field": "text",
            "level_field": "label",  # CEFR level string
            "level_is_numeric": False,
            "lang_field": None,
            "lang_filter": None,
            "source_field": None,
            "license": "Apache-2.0",
        },
        {
            "name": "amontgomerie/cefr-levelled-english-texts",
            "text_field": "text",
            "level_field": "label",  # CEFR level string
            "level_is_numeric": False,
            "lang_field": None,
            "lang_filter": None,
            "source_field": None,
            "license": "CC0",
        },
    ]

    all_entries = []

    for config in DATASET_CONFIGS:
        dataset_name = config["name"]
        print(f"📦 Loading {dataset_name} ({config['license']})...")

        try:
            dataset = load_dataset(dataset_name, split="train", trust_remote_code=True)
            entries = []
            skipped_levels = 0

            for item in dataset:
                # Language filter if applicable
                if config["lang_field"] and config["lang_filter"]:
                    lang = item.get(config["lang_field"], "").lower()
                    if lang != config["lang_filter"]:
                        continue

                # Get text
                text = item.get(config["text_field"], "")
                if not isinstance(text, str) or not text.strip():
                    continue

                # Get CEFR level - handle both string and numeric formats
                raw_level = item.get(config["level_field"], "")

                if config.get("level_is_numeric", False):
                    # Numeric format: 0=A1, 1=A2, 2=B1, 3=B2, 4=C1, 5=C2
                    try:
                        level_int = int(raw_level)
                        if 0 <= level_int <= 5:
                            label_id = level_int
                        else:
                            skipped_levels += 1
                            continue
                    except (ValueError, TypeError):
                        skipped_levels += 1
                        continue
                else:
                    # String format: "A1", "B2+", etc.
                    base_level = (
                        str(raw_level).strip().upper().replace("+", "").replace("-", "")
                    )
                    if base_level not in LABEL2ID:
                        skipped_levels += 1
                        continue
                    label_id = LABEL2ID[base_level]

                source_name = dataset_name.split("/")[-1]

                # Chunk long texts to match speech transcript lengths
                word_count = len(text.split())

                if word_count > max_words:
                    chunks = chunk_text(text, min_words=min_words, max_words=max_words)
                    for chunk in chunks:
                        entries.append(
                            {
                                "text": chunk,
                                "label": label_id,
                                "source": f"cefr_{source_name}",
                            }
                        )
                elif word_count >= min_words:
                    entries.append(
                        {
                            "text": text,
                            "label": label_id,
                            "source": f"cefr_{source_name}",
                        }
                    )

            if skipped_levels > 0:
                print(f"   ⚠️ Skipped {skipped_levels} entries with invalid CEFR levels")

            if entries:
                print(f"   ✅ Loaded {len(entries)} entries from {dataset_name}")
                all_entries.extend(entries)
            else:
                print(f"   ⚠️ No valid entries from {dataset_name}")

        except Exception as e:
            print(f"   ⚠️ Failed to load {dataset_name}: {e}")
            continue

    if not all_entries:
        print("❌ All dataset sources failed!")
        return []

    # Shuffle and limit
    random.shuffle(all_entries)
    if max_samples and len(all_entries) > max_samples:
        all_entries = all_entries[:max_samples]

    print(f"📊 Total training samples: {len(all_entries)}")
    return all_entries
