# Speako 🎙️

**Browser-based AI Speaking Practice**

Speako is a local-first application designed for practicing exam-style English speaking tests. It prioritizes user privacy and low latency by running powerful AI models directly in your browser.

## Features

- **🔒 Privacy First**: Voice data is processed locally on your device using `transformers.js`.
- **⚡️ Ultra-Low Latency**: Instant feedback on speaking metrics without server round-trips.
- **🧠 Smart Analysis**:
    - **Grammar Check**: Detects hedging ("I guess"), passive voice, and weak vocabulary.
    - **Clarity Score**: Real-time evaluation of speaking clarity and confidence.
    - **Positive Reinforcement**: Highlights strong vocabulary usage.
- **🎯 Exam Tools**:
    - **Topic Generator**: Random discussion prompts.
    - **Metrics**: Word count, WPM, and CEFR level estimation.
- **🚀 WebGPU Optimized**: Uses hardware acceleration for fast in-browser inference.
- **📱 PWA Ready**: Installable with offline support.

## Architecture

Speako is a **pure frontend application** with **no backend server**.

- **Frontend**: Vite + Preact + TypeScript
- **AI Models**: `transformers.js` (running locally in-browser via ONNX)
- **Audio Processing**: Standard Web Audio API
- **Deployment**: Static HTML/JS/CSS (deployable to GitHub Pages, Cloudflare Pages, etc.)

This "Serverless AI" approach ensures maximum privacy, zero server costs, and offline capability.


### Running Locally
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
This produces a static output in `dist/` which can be deployed to any static host (e.g., Cloudflare Pages, Vercel, Netlify).

## License
MIT
