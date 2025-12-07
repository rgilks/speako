use wasm_bindgen::prelude::*;
use speako_core::compute_metrics;
use wasm_bindgen::JsValue;

#[wasm_bindgen]
pub fn calculate_metrics_wasm(transcript: &str) -> JsValue {
    let metrics = compute_metrics(transcript);
    serde_wasm_bindgen::to_value(&metrics).unwrap()
}
