use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Metrics {
    pub word_count: usize,
    pub character_count: usize,
    // Future metrics: wpm, fillers, etc.
}

pub fn compute_metrics(transcript: &str) -> Metrics {
    let word_count = transcript.split_whitespace().count();
    let character_count = transcript.len();

    Metrics {
        word_count,
        character_count,
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
