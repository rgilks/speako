use serde::{Deserialize, Serialize};

mod common_words;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Metrics {
    pub word_count: usize,
    pub character_count: usize,
    pub cefr_level: String,
    pub unique_words: usize,
    pub complex_words: usize,
}

pub fn compute_metrics(transcript: &str) -> Metrics {
    let word_count = transcript.split_whitespace().count();
    let character_count = transcript.len();

    let common = common_words::get_common_words();
    let mut unique_set = std::collections::HashSet::new();
    let mut complex_count = 0;
    
    // Normalize and analyze words
    for word in transcript.split_whitespace() {
        let clean_word = word.to_lowercase().replace(|c: char| !c.is_alphabetic(), "");
        if clean_word.is_empty() { continue; }
        
        unique_set.insert(clean_word.clone());
        if !common.contains(clean_word.as_str()) {
            complex_count += 1;
        }
    }
    
    // Heuristic for CEFR
    // A simple heuristic based on sentence length and vocabulary complexity
    // 1. Avg sentence length
    let sentences: Vec<&str> = transcript.split(|c| c == '.' || c == '!' || c == '?').collect();
    let valid_sentences = sentences.iter().filter(|s| !s.trim().is_empty()).count();
    let avg_sentence_len = if valid_sentences > 0 {
        word_count as f64 / valid_sentences as f64
    } else {
        0.0
    };
    
    // 2. Percentage of complex words
    let complex_ratio = if word_count > 0 {
        complex_count as f64 / word_count as f64
    } else {
        0.0
    };
    
    // Score calculation (0-100 scale roughly)
    // Sentence len: >20 is high (C2), <5 is low (A1)
    // Complex ratio: >20% is high (C2), <5% is low (A1)
    
    let sent_score = (avg_sentence_len.min(25.0) / 25.0) * 50.0; // Max 50 points
    let vocab_score = (complex_ratio.min(0.25) / 0.25) * 50.0; // Max 50 points
    let total_score = sent_score + vocab_score;
    
    let cefr_level = if word_count < 10 {
        "A1".to_string() // Too short to judge
    } else if total_score < 20.0 {
        "A1".to_string()
    } else if total_score < 40.0 {
        "A2".to_string()
    } else if total_score < 60.0 {
        "B1".to_string()
    } else if total_score < 80.0 {
        "B2".to_string()
    } else if total_score < 90.0 {
        "C1".to_string()
    } else {
        "C2".to_string()
    };

    Metrics {
        word_count,
        character_count,
        cefr_level,
        unique_words: unique_set.len(),
        complex_words: complex_count,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_metrics_basic() {
        let text = "Hello world from Rust";
        let metrics = compute_metrics(text);
        assert_eq!(metrics.word_count, 4);
    }

    #[test]
    fn test_compute_metrics_empty() {
        let text = "";
        let metrics = compute_metrics(text);
        assert_eq!(metrics.word_count, 0);
        assert_eq!(metrics.character_count, 0);
    }
}
