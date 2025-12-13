# Speako 🎙️

**Browser-based AI Speaking Practice**

Speako is a local-first application designed for practicing exam-style English speaking tests. It prioritizes user privacy and low latency by running powerful AI models directly in your browser.

## Features

- **🔒 Privacy First**: Voice data is processed locally on your device using `transformers.js`.
- **⚡️ Ultra-Low Latency**: Instant feedback on speaking metrics (word count, pace, etc.) without server round-trips.
- **🎯 Exam Tools**:
    - **Topic Generator**: Random discussion prompts.
    - **Local Grammar Check**: Smart client-side NLP (via `compromise.js`) for instant feedback.
    - **Metrics Analysis**: Real-time analysis of vocabulary complexity and CEFR level estimation.
- **📱 PWA Ready**: Installable on mobile and desktop with offline support.

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
