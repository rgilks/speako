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

## Machine Learning

For information on training the CEFR classifier, see [ml/README.md](ml/README.md).

## Running Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```
Open [http://localhost:5173](http://localhost:5173).

## Test Data

For testing with real L2 learner audio, we use the **Speak & Improve Corpus 2025** from Cambridge University Press & Assessment.

### Step 1: Register & Download Corpus Package

1. Visit [ELiT Datasets](https://www.englishlanguageitutoring.com/datasets/speak-and-improve-corpus-2025)
2. Complete the free registration and accept the license
3. Download and extract `sandi-corpus-2025.zip`

### Step 2: Download Audio Files

The audio files are hosted separately on S3. Download the **dev set** (smaller, for testing):

```bash
cd /path/to/sandi-corpus-2025
mkdir -p data && cd data

# Dev set (~2.7GB total)
curl -LO "https://speak-and-improve-corpus-2025.s3.eu-west-1.amazonaws.com/audio/data.flac.dev.01.zip"
curl -LO "https://speak-and-improve-corpus-2025.s3.eu-west-1.amazonaws.com/audio/data.flac.dev.02.zip"

# Unzip into data/flac/dev/
unzip data.flac.dev.01.zip
unzip data.flac.dev.02.zip
```

### Step 3: Link to Project

```bash
cd /path/to/speako
ln -s /path/to/sandi-corpus-2025 ./test-data
```

### Corpus Details
- 315 hours of L2 learner audio (16kHz FLAC)
- CEFR proficiency levels A2-C1
- ~55 hours with manual transcriptions + disfluency annotations
- **License**: Non-commercial research only - do not share publicly

### Running Validation

```bash
# Run validation on a sample (limit for quick testing)
npm run validate -- --limit 10

# Run full validation (takes longer)
npm run validate

# Generate benchmark report
npm run validate:report
```

Results are saved to `validation-results.json` and `BENCHMARK.md`.

## Deployment

To build for production:
```bash
npm run build
```
This produces a static output in `dist/` which can be deployed to any static host (Cloudflare Pages, Vercel, Netlify).

## License
MIT
