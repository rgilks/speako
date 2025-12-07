use worker::*;
use speako_core::compute_metrics;
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
struct ResponseData {
    transcript: String,
    metrics: speako_core::Metrics,
}


#[event(fetch)]
pub async fn main(req: Request, env: Env, _ctx: Context) -> Result<Response> {
    let router = Router::new();

    router
        .post_async("/api/transcribe", |_, _| async move {
             let transcript = "This is a simulated remote transcription from the Cloudflare Worker.";
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
