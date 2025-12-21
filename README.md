# Speako 🎙️

**Browser-based AI Speaking Practice**

**[▶ Try the Live Demo](https://speako-web.pages.dev/)**

Speako is a local-first application designed for practicing exam-style English speaking tests. It prioritizes user privacy, zero latency, and a premium user experience by running powerful AI models directly in your browser.

## Features

- **🔒 Privacy First**: Voice data is processed locally on your device using [Transformers.js](https://huggingface.co/docs/transformers.js).
- **🎨 Premium Design**: A beautiful, distraction-free "Dark Glass" interface built with **Pure CSS**.
- **🧠 Smart Analysis**:
    - **CEFR Level Detection**: ML-powered proficiency assessment using a fine-tuned DeBERTa model ([robg/speako-cefr-deberta](https://huggingface.co/robg/speako-cefr-deberta)).
    - **Grammar Check**: Detects hedging, passive voice, and weak vocabulary.
    - **Clarity Score**: Real-time evaluation of speaking clarity.
    - **Positive Reinforcement**: Highlights strong vocabulary usage.
- **⚡️ Ultra-Low Latency**: Instant feedback without server round-trips.
- **🚀 WebGPU Optimized**: Uses hardware acceleration for fast in-browser inference, with automatic WASM fallback.
- **📱 PWA Support**: Installable as a Progressive Web App with offline model caching.

## Architecture

Speako is a **pure frontend application** with **no backend server**.

- **Frontend**: [Vite](https://vitejs.dev/) + [Preact](https://preactjs.com/) + TypeScript
- **Styling**: Zero-dependency Pure CSS
- **AI Models**:
    - **Speech Recognition**: [`Xenova/whisper-base`](https://huggingface.co/Xenova/whisper-base) (running locally via ONNX)
    - **CEFR Classification**: [`robg/speako-cefr-deberta`](https://huggingface.co/robg/speako-cefr-deberta) (fine-tuned DeBERTa)
- **NLP**: [Compromise](https://github.com/spencermountain/compromise) for grammar analysis
- **State Management**: [Preact Signals](https://preactjs.com/guide/v10/signals/) for high-performance reactivity

### Project Structure

```
speako/
├── src/
│   ├── components/       # UI components (split by feature)
│   │   ├── session/      # Recording session components
│   │   └── validation/   # Validation interface components
│   ├── hooks/            # Custom hooks (useSessionManager, useValidation, etc.)
│   ├── logic/            # Pure TS business logic
│   │   ├── local-transcriber.ts   # Whisper integration
│   │   ├── model-loader.ts        # Model singleton with WebGPU/WASM
│   │   ├── cefr-classifier.ts     # CEFR ML prediction
│   │   ├── grammar-checker.ts     # Grammar analysis
│   │   └── metrics-calculator.ts  # Speaking metrics
│   └── types/            # TypeScript type definitions
├── ml/                   # CEFR classifier training scripts
├── scripts/              # Helper scripts
└── public/               # Static assets and local models
```

## Prerequisites

- **Node.js 20+** (check with `node -v`)
- **Python 3.11+** with [uv](https://docs.astral.sh/uv/) for ML training (optional)

## Running Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run test` | Run unit tests |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
| `npm run prepare:models` | Download models locally for offline testing |
| `npm run prepare:data` | Convert corpus audio to WAV for validation |
| `npm run cefr:verify` | Verify CEFR model is working |
| `npm run deploy` | Build and deploy to Cloudflare Pages |

## Validation & Testing

For testing with real L2 learner audio, we use the **Speak & Improve Corpus 2025** from Cambridge University Press & Assessment.

### Step 1: Register & Download Corpus Package

1. Visit [ELiT Datasets - Speak & Improve Corpus 2025](https://www.englishlanguageitutoring.com/datasets/speak-and-improve-corpus-2025)
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

### Step 4: Prepare Validation Data

```bash
# Requires ffmpeg: brew install ffmpeg
npm run prepare:data
```

### Corpus Details

| Property | Value |
|----------|-------|
| Duration | ~315 hours of L2 learner audio |
| Format | 16kHz FLAC |
| CEFR Levels | A2–C1 |
| Manual Transcriptions | ~55 hours with disfluency annotations |
| License | **Non-commercial research only** |

> [!CAUTION]
> Do not share the corpus publicly or include it in any repository. See the license agreement for full terms.

### Running Validation

Validation is performed through the web interface:

1. Start the development server: `npm run dev`
2. Navigate to [http://localhost:5173/#validate](http://localhost:5173/#validate)
3. Use the validation controls to run tests on the corpus

Results are saved to `validation-results.json`.

## Machine Learning

For information on training the CEFR classifier, see [docs/ml.md](docs/ml.md).

> [!NOTE]
> The CEFR model is trained on [UniversalCEFR](https://huggingface.co/datasets/lksenel/UniversalCEFR) (CC-BY-NC-4.0) to ensure license compliance. The S&I Corpus is used for validation only.

## Developer Guide

See [AGENTS.md](./AGENTS.md) for coding standards and agent instructions.

## Deployment

To build for production:

```bash
npm run build
```

This produces a static output in `dist/` which can be deployed to any static host (Cloudflare Pages, Vercel, Netlify).

### Deploy to Cloudflare Pages

```bash
npm run deploy
```

## References

### Core Technologies
- [Transformers.js](https://huggingface.co/docs/transformers.js) – Run Transformers in the browser
- [Preact](https://preactjs.com/) – Fast 3kB React alternative
- [Vite](https://vitejs.dev/) – Next Generation Frontend Tooling
- [Compromise](https://github.com/spencermountain/compromise) – Modest natural-language processing

### Models
- [Xenova/whisper-base](https://huggingface.co/Xenova/whisper-base) – Speech recognition model
- [robg/speako-cefr-deberta](https://huggingface.co/robg/speako-cefr-deberta) – CEFR classification model

### WebGPU
- [WebGPU Implementation Status](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status) – Browser support tracker
- [WebGPU Explainer](https://gpuweb.github.io/gpuweb/explainer/) – Introduction to WebGPU

### Corpus
- [Speak & Improve Corpus 2025](https://www.englishlanguageitutoring.com/datasets/speak-and-improve-corpus-2025) – L2 learner speech corpus
- [Corpus Paper (DOI)](https://doi.org/10.17863/CAM.114333) – Academic citation

## License

MIT
