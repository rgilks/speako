use worker::*;
use speako_core::compute_metrics;
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
struct ResponseData {
    transcript: String,
    metrics: speako_core::Metrics,
}

#[event(fetch)]
pub async fn main(mut req: Request, env: Env, _ctx: Context) -> Result<Response> {
    let router = Router::new();

    router
        .post_async("/api/transcribe", |mut req, ctx| async move {
            // In a real app, this would send audio to Workers AI.
            // For now, we'll mock the transcription or read a text field for testing,
            // or just return a dummy string if we can't easily invoke Workers AI from here without binding setup.
            
            // To properly use Workers AI, we'd need a binding in wrangler.toml, e.g. "AI".
            // Since we don't have wrangler.toml setup yet, we'll simulate it.
            
            let transcript = "This is a simulated remote transcription from the Cloudflare Worker.";
            
            // Re-use core logic
            let metrics = compute_metrics(transcript);
            
            let data = ResponseData {
                transcript: transcript.to_string(),
                metrics,
            };
            
            Response::from_json(&data)
        })
        .run(req, env)
        .await
}
