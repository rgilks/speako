# Speako 🎙️

**Browser-based AI Speaking Practice**

Speako is a local-first application designed for practicing exam-style English speaking tests. It prioritizes user privacy, zero latency, and a premium user experience by running powerful AI models directly in your browser.

## Features

- **🔒 Privacy First**: Voice data is processed locally on your device using `transformers.js`.
- **🎨 Premium Design**: A beautiful, distraction-free "Dark Glass" interface built with **Pure CSS**.
- **🧠 Smart Analysis**:
    - **Grammar Check**: Detects hedging, passive voice, and weak vocabulary.
    - **Clarity Score**: Real-time evaluation of speaking clarity and confidence.
    - **Pronunciation**: Confidence-based scoring with "Unclear Word" detection.
    - **Positive Reinforcement**: Highlights strong vocabulary usage.
- **⚡️ Ultra-Low Latency**: Instant feedback without server round-trips.
- **🚀 WebGPU Optimized**: Uses hardware acceleration for fast in-browser inference.

## Architecture

Speako is a **pure frontend application** with **no backend server**.

- **Frontend**: Vite + Preact + TypeScript
- **Styling**: Zero-dependency Pure CSS.
- **AI Models**: `Xenova/whisper-base.en` (running locally via ONNX).
- **State Management**: Signals (`@preact/signals`) for high-performance reactivity.

### Project Structure
- `src/components`: UI components (split by feature).
- `src/hooks`: Custom hooks (e.g., `useSessionManager`).
- `src/logic`: Pure TS business logic (`local-transcriber`, `grammar-checker`, `model-loader`).

## References

- [Transformers.js](https://huggingface.co/docs/transformers.js/index) - Run Transformers in the browser.
- [Preact](https://preactjs.com/) - Fast 3kB React alternative.
- [Vite](https://vitejs.dev/) - Next Generation Frontend Tooling.
- [Compromise](https://github.com/spencermountain/compromise) - Modest natural-language processing.
- [WebGPU Status](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status) - Browser support for WebGPU.

## Developer Guide

See [AGENTS.md](./AGENTS.md) for coding standards and agent instructions.

## Running Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```
Open [http://localhost:5173](http://localhost:5173).

## Deployment

To build for production:
```bash
npm run build
```
This produces a static output in `dist/` which can be deployed to any static host (Cloudflare Pages, Vercel, Netlify).

## License
MIT
