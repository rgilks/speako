/**
 * Download Whisper Models Script
 *
 * Fetches required Whisper models from Hugging Face and saves them to public/models.
 * This allows the application to run in offline/hermetic environments (like CI/CD).
 *
 * Usage:
 *   npm run prepare:models
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const MODELS_DIR = path.join(PROJECT_ROOT, 'public/models');

// Configure transformers to download to our target directory
// Note: transformers.js in Node doesn't strictly follow "cache_dir" for the web format
// in the same way, but we can manually manage the download or rely on the library to cache
// and then copy.
//
// However, a cleaner way for *preparing* web-ready models is to simply fetch the files
// that the web client will request.
//
// The standard files requested by the pipeline are:
// - config.json
// - tokenizer.json (tokenizer_config.json)
// - preprocessor_config.json
// - model.onnx (and potentially model.onnx_data / weights)
// - generation_config.json

const MODELS_TO_DOWNLOAD = ['Xenova/whisper-base'];

// Files to fetch for each model
// Note: Whisper models in ONNX format are often split into encoder/decoder and may reside in 'onnx/' subfolder
const FILES = [
  'config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'preprocessor_config.json',
  'generation_config.json',

  // Monolithic (some models)
  'model.onnx',
  'model_quantized.onnx',

  // Split (Whisper mostly) - Standard
  'encoder_model.onnx',
  'decoder_model.onnx',
  'decoder_model_merged.onnx',

  // Split (Whisper mostly) - Quantized
  'encoder_model_quantized.onnx',
  'decoder_model_quantized.onnx',
  'decoder_model_merged_quantized.onnx',
];

// Subdirectories to check if root fails
const SUBDIRS = ['', 'onnx/'];

async function downloadFile(modelId: string, fileName: string, targetDir: string) {
  // Try each subdirectory until found or exhausted
  for (const subdir of SUBDIRS) {
    const relativePath = subdir + fileName;
    const url = `https://huggingface.co/${modelId}/resolve/main/${relativePath}`;

    // We always save to the same structure locally as the remote, OR flat?
    // Transformers.js usually expects the 'onnx/' folder if it exists remotely?
    // Actually, transformers.js v2 often flattened, but v3 mirrors.
    // Let's safe-guess: if we find it in 'onnx/', we should probably save it in 'onnx/' locally too.

    const localRelativePath = relativePath;
    const targetPath = path.join(targetDir, localRelativePath);
    const targetFileDir = path.dirname(targetPath);

    if (fs.existsSync(targetPath)) {
      console.log(`  - Skipping ${localRelativePath} (already exists)`);
      // We found it, stop searching subdirs for this file
      return;
    }

    try {
      const res = await fetch(url, { method: 'HEAD' }); // Check existence first
      if (res.ok) {
        console.log(`  - Downloading ${localRelativePath}...`);
        if (!fs.existsSync(targetFileDir)) fs.mkdirSync(targetFileDir, { recursive: true });

        const downloadRes = await fetch(url);
        if (!downloadRes.ok) throw new Error(`Status ${downloadRes.status}`);
        const buffer = await downloadRes.arrayBuffer();
        fs.writeFileSync(targetPath, Buffer.from(buffer));
        return; // Success, stop searching subdirs
      }
    } catch {
      // Ignore check errors, try next subdir
    }
  }

  console.log(`  - (Not found: ${fileName})`);
}

async function main() {
  console.log('📥 downloading Whisper models for local usage...');

  if (!fs.existsSync(MODELS_DIR)) {
    fs.mkdirSync(MODELS_DIR, { recursive: true });
  }

  for (const modelId of MODELS_TO_DOWNLOAD) {
    console.log(`\nProcessing ${modelId}...`);
    const modelDir = path.join(MODELS_DIR, modelId);

    if (!fs.existsSync(modelDir)) {
      fs.mkdirSync(modelDir, { recursive: true });
    }

    for (const file of FILES) {
      await downloadFile(modelId, file, modelDir);
    }

    // Also try downloading quantized versions if standard ones are huge (OPTIONAL optimization)
    // For now, we stick to standard filenames required by the library default load.
  }

  console.log('\n✅ Model download complete.');
}

main();
