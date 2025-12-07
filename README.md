# Speako 🎙️

**Browser-based AI Speaking Practice**

Speako is a local-first application designed for practicing exam-style English speaking tests (like IELTS). It prioritizes user privacy and low latency by running powerful AI models directly in your browser using WebAssembly and WebGPU.

## Features

- **🔒 Privacy First**: Voice data is processed locally on your device using `transformers.js` and Rust-based WASM modules.
- **⚡️ Ultra-Low Latency**: Instant feedback on speaking metrics (word count, pace, etc.) without server round-trips.
- **🎯 Exam Tools**:
    - **Topic Generator**: Random IETLS-style discussion prompts.
    - **Pronunciation Confidence**: Color-coded transcript showing low-confidence words.
    - **Local Grammar Check**: Smart client-side NLP (via `compromise.js`) for instant feedback on grammar and vocabulary.
- **☁️ Cloud Fallback**: Automatically switches to a Cloudflare Worker backend if local device capabilities are insufficient.
- **📱 PWA Ready**: Installable on mobile and desktop with full offline support (caches AI models).
- **🦀 Rust Powered**: Core logic shared between client (WASM) and server (Worker) for consistency.

## Architecture

This project is a **monorepo** managed with `pnpm` and `cargo workspaces`.

- **`apps/web`**: Frontend built with Preact, TypeScript, and Vite. Handles UI, recording, and local inference.
- **`crates/core`**: Pure Rust library containing the business logic for text analysis and metrics.
- **`crates/client`**: Rust library compiling to WebAssembly to expose `core` logic to the browser.
- **`crates/worker`**: Cloudflare Worker (Rust) providing a fallback API for transcription.

## Development Setup

### Prerequisites
- Node.js & pnpm
- Rust & Cargo
- `wasm-pack` (`cargo install wasm-pack`)
- `wrangler` (for Cloudflare deployment)

### 1. Build WASM
Compile the Rust client for use in the web app:
```bash
cd crates/client
wasm-pack build --target bundler
```

### 2. Run Frontend
Start the local development server:
```bash
cd apps/web
pnpm install
pnpm dev
```
Open [http://localhost:5173](http://localhost:5173).

### 3. Run Backend (Optional)
To test the cloud fallback locally:
```bash
cd crates/worker
npx wrangler dev
```

## Deployment

The project is deployed on Cloudflare.

- **Frontend**: Cloudflare Pages
- **Backend**: Cloudflare Workers

To deploy manually:
1. **Worker**: `cd crates/worker && npx wrangler deploy`
2. **Web**: `cd apps/web && pnpm build && npx wrangler pages deploy dist`

## License
MIT
