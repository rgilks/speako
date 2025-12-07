# Speako – Spec & Testing Strategy

## 1. Overview

**Product name:** Speako
**Purpose:** Browser-based practice tool for “exam-style English speaking tests” (unbranded).
**Primary users:** Learners in low/medium income contexts (e.g. Philippines, India) aiming for bands around 5.5–7.5.
**Key constraint:** **Ultra-low running cost** → push as much as possible to the client (browser) and keep the backend thin.

### Core value

* Timed, exam-like speaking tasks (short Q&A, long turn, discussion, full mock).
* Instant feedback on:

  * Fluency & Coherence
  * Vocabulary / Lexical Resource
  * Grammar
  * Pronunciation
* Works well on mid-range phones; supports offline or low-connectivity scenarios.
* Clear about being **unofficial** and **approximate**.

---

## 2. Goals & Non-goals

### Goals

1. **Cheap to operate**

   * STT and scoring should run locally when possible.

2. **Good-enough approximations**

   * “Exam-like” bands using public descriptors.
   * Helpful, concrete feedback rather than exact band replication.
3. **Privacy-forward**

   * Options to keep audio & transcripts on device.
4. **Testable & maintainable**

   * Most “brain” lives in pure functions (TS or Rust/WASM) that can be unit-tested.
   * E2E tests don’t need real AI or real microphones.

### Non-goals (for now)

* Real-time conversational “examiner” chat.
* Native apps (Speako is a PWA).
* Full user accounts/social features at MVP.

---

## 3. User Experience & Flows

### Modes

1. **Quick Warm-up (Short Questions)**

   * 3–6 simple questions (home, work, hobbies).
   * User records short answers in one session.

2. **Long Turn (Presentation)**

   * Cue card (topic + bullet points).
   * **1 min prep** → **2 min speaking**.

3. **Discussion (Deep Dive)**

   * 3–5 more abstract questions linked to a theme.

4. **Full Mock**

   * Sequential: Warm-up → Long Turn → Discussion.
   * Single report at the end.

### Typical session flow

1. User lands on **home screen** → chooses mode.
2. Sees **instructions + question(s)**.
3. Grants mic permission → presses **Start recording**.
4. Speaks for required time → presses **Stop** (or auto-stops on timeout).
5. Speako:

   * Converts audio to transcript (local STT preferred, or remote).
   * Computes metrics (Rust/WASM).
   * Produces band scores + feedback:

     * **Heuristic only** in offline/local mode.

6. User sees:

   * Transcript
   * Band chart
   * Metrics (WPM, fillers, etc.)
   * Plain-language advice per criterion.
7. Attempt saved to local history (IndexedDB). Optional sync to backend later.

---

## 4. Architecture

### 4.1 High-level

* **Frontend:**

  * **Preact** + TypeScript (via **Vite**).
  * *Note: Preact is chosen for its <3kB footprint, ideal for low-end mobile devices.*
  * `vite-plugin-pwa` for robust offline support.
  * Lazy-loading for heavy assets (STT models, Wasm metrics).

### 4.2 Client modules

1. **Audio layer (`audio.ts`)**

   * Web Audio API (`getUserMedia`, `AudioContext`) with `AudioWorklet` for glitch-free recording.
   * `Resampler` to convert to 16kHz before analysis/sending defaults.

2. **STT layer**

   * **Interface:** `ITranscriber`
   * **Implementations:**
     * `LocalTranscriber`: Uses **transformers.js** (whisper-tiny-en, quantized ~30MB). Lazy-loaded.
     * `FakeTranscriber`: Returns static text for tests.
   * **Strategy:**
     * Try `Local` if WebGPU/Wasm capable & cached.

3. **Metrics & Analysis (Shared Rust Core)**

   * **Workspace Structure:**
     * `crates/core`: Pure logic (metrics, heuristic scoring). Compiles to `wasm32-unknown-unknown`.
     * `crates/client`: WASM bindings for the browser (`wasm-bindgen`).
   * **Functionality:**
     * `compute_metrics(transcript, duration) -> Metrics`
     * Deterministic, shared 100% between client and server.

4. **Scoring engine**

   * **Heuristic scoring** (in `crates/core`):
     * Maps metrics → rough bands.
     * **Local Grammar Checker**: NLP-based analysis (Compromise.js) in frontend for subject-verb agreement and stylistic improvements.

5. **UI layer**

   * **State Management:**
     * Signals (Preact Signals) for high-performance reactive state (recording duration, audio levels).
     * Simple state machine for session flow.

6. **Storage**

   * `idb-keyval` for simple IndexedDB access.

---

## 5. Data Shapes (simplified)

```ts
type Mode = "warmup" | "long_turn" | "discussion" | "full_mock";

type Metrics = {
  // Calculated by Rust core
  total_words: number;
  unique_words: number;
  wpm: number;
  lexical_diversity: number;
  filler_count: number;
  fillers_per_100_words: number;
  avg_sentence_length: number;
  long_sentences: number;
};

type BandScores = {
  fluency: number;        // 0–9
  vocabulary: number;
  grammar: number;
  pronunciation: number;
  overall: number;
};
// ... rest of shapes ...
```

---

## 6. Testing Strategy

### 6.1 Principles

* **Unit Test the Core:** The majority of business logic lives in `crates/core`. We test this heavily in Rust.
* **Component Testing:** Use `@testing-library/preact` for UI flows.
* **E2E:** Playwright with mocked Audio/STT.

### 6.2 Test layers

1. **Rust Core Tests:**
   * `cargo test -p core`
   * Tests metrics, heuristics, and text analysis.
   * Fast, no I/O.

2. **Frontend Unit/Component Tests:**
   * **Vitest** + `@testing-library/preact`.
   * Test the `useSession` hook (state machine).
   * Mock `ITranscriber` to test success/failure UI states.

3. **Integration (WASM):**
   * Load the compiled WASM in a Vitest environment.
   * Verify JS <-> Rust data passing.

4. **E2E (Playwright):**
   * **Mock Mode:** `verify_session_flow`
     * Injects `FakeAudio` and `FakeTranscriber`.
     * Clicks "Record", waits 2s, clicks "Stop".
     * Asserts: "Results" screen appears, Band Score is "6.5" (deterministic fallback).
   * **No Real AI:** Never hit the LLM or Whisper model in CI.

### 6.3 Mechanics

* `TestProvider`: A React Context that supplies dependencies (`transcriber`, `audioRecorder`, `storage`).
* **DevTools:** A hidden overlay in `?dev=true` to toggle:
  * Force specific Band Score.
  * Force Upload Failure.
  * Force Network Latency.

### 6.4 Efficiency

* **Zero-cost link:** `crates/client` is linked into Vite build via `vite-plugin-rsw` or `wasm-pack`.
* **CI:** Builds Rust core, runs tests, then builds Frontend.

---

## 7. Roadmap

* **Phase 1: Skeleton & Core**
  * Set up Monorepo (pnpm + cargo workspace).
  * Build `crates/core` with basic WPM metric.
  * Build Preact Skeleton with "Fake Recorder".

* **Phase 2: Local Intelligence (WASM)**
  * Connect `crates/client` WASM to Frontend.
  * Display real-time WPM stats during "Fake Recording".

* **Phase 3: Real Audio (Transformers.js)**
  * Implement `LocalTranscriber` with `transformers.js`.
  * Validate performance on Desktop Chrome.

* **Phase 5: Polish & Offline**
  * PWA Manifest.
  * Offline caching strategy for the 30MB model.

