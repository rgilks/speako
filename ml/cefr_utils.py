
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
