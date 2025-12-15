/**
 * Download Modal Model Script
 *
 * Retrieving trained CEFR DeBERTa model from Modal Volume.
 *
 * Usage:
 *   npx tsx scripts/download-modal-model.ts
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const TARGET_DIR = path.join(PROJECT_ROOT, 'public/models/cefr-deberta-v3-small');
const ONNX_SUBDIR = path.join(TARGET_DIR, 'onnx');

function checkModalCli() {
  try {
    execSync('modal --version', { stdio: 'ignore' });
  } catch {
    console.error("❌ Error: 'modal' CLI is not installed.");
    console.error("Please install it via 'pip install modal' and authenticate.");
    process.exit(1);
  }
}

function main() {
  console.log('📦 Downloading DeBERTa model from Modal...');

  checkModalCli();

  if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
  }

  try {
    // Download the specific model directory
    // modal volume get cefr-models cefr-deberta-v3-small public/models/
    // We execute this from PROJECT_ROOT to ensure relative paths work as expected
    console.log('   Running: modal volume get cefr-models cefr-deberta-v3-small public/models/');
    execSync('modal volume get cefr-models cefr-deberta-v3-small public/models/', {
      stdio: 'inherit',
      cwd: PROJECT_ROOT,
    });
  } catch {
    console.error('❌ Failed to download model from Modal.');
    console.error('Ensure you are authenticated (modal token new) and the volume/model exists.');
    process.exit(1);
  }

  // Flatten the structure (move contents of onnx/ up one level)
  if (fs.existsSync(ONNX_SUBDIR)) {
    console.log('📦 Flattening directory structure...');
    const files = fs.readdirSync(ONNX_SUBDIR);

    for (const file of files) {
      const src = path.join(ONNX_SUBDIR, file);
      const dst = path.join(TARGET_DIR, file);
      fs.renameSync(src, dst);
    }

    fs.rmdirSync(ONNX_SUBDIR);
  }

  console.log(`✅ Model downloaded to ${TARGET_DIR}`);
}

main();
