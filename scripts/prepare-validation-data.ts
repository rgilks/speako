
/**
 * Validation Data Preparation Script
 * 
 * This script prepares the audio data required for the validation/benchmarking system.
 * It reads the Write & Improve corpus (expected in public/test-data/data) and converts
 * the FLAC files to 16kHz mono WAV files compatible with the browser-based Whisper model.
 * 
 * Usage:
 *   npm run prepare:data
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const TSV_PATH = path.join(PROJECT_ROOT, 'public/test-data/reference-materials/flists.flac/dev-asr.tsv');
const SOURCE_ROOT = path.join(PROJECT_ROOT, 'public/test-data/data');
const TARGET_DIR = path.join(PROJECT_ROOT, 'public/test-data/wav-dev');

function checkFFmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
  } catch (e) {
    console.error('❌ Error: ffmpeg is not installed or not in PATH.');
    console.error('Please install ffmpeg to run this script (e.g., brew install ffmpeg).');
    process.exit(1);
  }
}

function main() {
  console.log('🎧 Starting Validation Data Preparation...');
  
  checkFFmpeg();

  if (!fs.existsSync(TARGET_DIR)) {
    console.log(`Creating target directory: ${TARGET_DIR}`);
    fs.mkdirSync(TARGET_DIR, { recursive: true });
  }

  if (!fs.existsSync(TSV_PATH)) {
    console.error(`❌ TSV file not found: ${TSV_PATH}`);
    process.exit(1);
  }

  console.log(`Reading TSV: ${TSV_PATH}`);
  const content = fs.readFileSync(TSV_PATH, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());

  console.log(`Found ${lines.length} entries to process.`);

  let success = 0;
  let errors = 0;
  let skipped = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const [fileId, relPath] = line.split('\t');
    
    if (!fileId || !relPath) continue;

    // The TSV contains paths like 'data/flac/...', but our SOURCE_ROOT is already '.../test-data/data'
    // Depending on extraction, sometimes the structure varies.
    // Based on previous checks: public/test-data/data/data/flac/dev/01/...
    // Let's ensure we handle the path correctly.
    // If Source Root is .../test-data/data
    // And relPath is data/flac/dev/01/...
    // Then full path is .../test-data/data/data/flac/dev/01/...
    
    const sourcePath = path.join(SOURCE_ROOT, relPath);
    const targetPath = path.join(TARGET_DIR, `${fileId}.wav`);

    if (fs.existsSync(targetPath)) {
      skipped++;
      continue;
    }

    if (!fs.existsSync(sourcePath)) {
        // Try skipping the first 'data' segment if it failed (fallback logic)
        // sometimes zip extraction creates an extra nested folder or not.
        const altPath = path.join(PROJECT_ROOT, 'public/test-data', relPath); 
        if (fs.existsSync(altPath)) {
             // If found in alternate location, use it
             execSync(`ffmpeg -y -i "${altPath}" -ar 16000 -ac 1 -c:a pcm_s16le "${targetPath}"`, { stdio: 'ignore' });
             success++;
             continue;
        }

        if (errors < 5) { // Only log first few errors to avoid spam
            console.warn(`[${i+1}/${lines.length}] ⚠️ Source not found: ${sourcePath}`);
        }
        errors++;
        continue;
    }

    try {
      // Convert to 16kHz mono PCM WAV (standard for Whisper)
      // -y: overwrite
      // -ar 16000: 16k sample rate
      // -ac 1: mono
      // -c:a pcm_s16le: 16-bit PCM
      execSync(`ffmpeg -y -i "${sourcePath}" -ar 16000 -ac 1 -c:a pcm_s16le "${targetPath}"`, { stdio: 'ignore' });
      success++;
      
      if (success % 50 === 0) {
        process.stdout.write(`\rConverted ${success} files...`);
      }
    } catch (e) {
      console.error(`\n[${i+1}/${lines.length}] ❌ Failed to convert ${fileId}`);
      errors++;
    }
  }

  console.log(`\n\n✅ Preparation Complete:`);
  console.log(`- Converted: ${success}`);
  console.log(`- Skipped (already existed): ${skipped}`);
  console.log(`- Missing/Errors: ${errors}`);
  
  if (success > 0 || skipped > 0) {
      console.log(`\nData is ready in ${TARGET_DIR}`);
  }
}

main();
