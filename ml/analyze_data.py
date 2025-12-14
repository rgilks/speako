
import pandas as pd
import os
import re
from collections import Counter
import numpy as np

LABEL2ID = {"A1": 0, "A2": 1, "B1": 2, "B2": 3, "C1": 4, "C2": 5}

def parse_stm_file(content: str) -> list:
    """Parse STM file format with CEFR labels."""
    entries = []
    for line in content.split('\n'):
        line = line.strip()
        if not line or line.startswith(';;'):
            continue
        
        match = re.search(r'<[^>]+>', line)
        if not match:
            continue
        
        label_str = match.group(0)
        text = line[match.end():].strip()
        
        if not text:
            continue
        
        parts = label_str.strip('<>').split(',')
        cefr = None
        for part in parts:
            part = part.strip()
            if part in ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'C']:
                cefr = 'C1' if part == 'C' else part
                break
        
        if cefr and cefr in LABEL2ID:
            entries.append({'label': cefr, 'length': len(text.split())})
    return entries

def analyze_wi():
    path = "/Users/robertgilks/Desktop/write-and-improve-corpus-2024-v2/whole-corpus/en-writeandimprove2024-corpus.tsv"
    print(f"Analyzing W&I corpus: {path}")
    
    if not os.path.exists(path):
        print("File not found!")
        return

    try:
        df = pd.read_csv(path, sep='\t', on_bad_lines='skip')
        data = {l: [] for l in LABEL2ID.keys()}
        
        for _, row in df.iterrows():
            text = str(row.get('text', ''))
            raw = str(row.get('automarker_cefr_level', '')).strip().upper()
            base = raw.replace('+', '').replace('-', '')
            if base in LABEL2ID:
                data[base].append(len(text.split()))
        
        print(f"\nWrite & Improve Length Stats:")
        for label in sorted(LABEL2ID.keys()):
            lengths = data[label]
            if lengths:
                print(f"  {label}: Avg {np.mean(lengths):.1f} words (N={len(lengths)})")
            
    except Exception as e:
        print(f"Error: {e}")

def analyze_stm():
    base_dir = "dist/test-data/reference-materials/stms"
    print(f"\nAnalyzing STM files in: {base_dir}")
    
    data = {l: [] for l in LABEL2ID.keys()}
    
    for fname in ["train-asr.stm", "dev-asr.stm", "eval-asr.stm"]:
        path = os.path.join(base_dir, fname)
        if os.path.exists(path):
            with open(path, 'r') as f:
                entries = parse_stm_file(f.read())
                for e in entries:
                    data[e['label']].append(e['length'])
                    
    print(f"\nSTM Length Stats:")
    for label in sorted(LABEL2ID.keys()):
        lengths = data[label]
        if lengths:
            print(f"  {label}: Avg {np.mean(lengths):.1f} words (N={len(lengths)})")

if __name__ == "__main__":
    analyze_wi()
    analyze_stm()
