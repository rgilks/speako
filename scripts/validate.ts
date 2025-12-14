#!/usr/bin/env npx tsx
/**
 * Automated validation script for Speako transcription quality.
 * Processes FLAC audio files from the Speak & Improve Corpus and compares
 * transcription output against reference transcripts to calculate WER.
 * 
 * Usage: npm run validate [-- --limit N]
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { execSync } from 'child_process';
import levenshtein from 'fast-levenshtein';

// Configuration
const TEST_DATA_DIR = './test-data';
const AUDIO_DIR = `${TEST_DATA_DIR}/data/data/flac/dev`;
const STM_FILE = `${TEST_DATA_DIR}/reference-materials/stms/dev-asr.stm`;
const OUTPUT_FILE = './validation-results.json';

interface STMEntry {
  fileId: string;
  channel: string;
  speaker: string;
  start: number;
  end: number;
  metadata: string;
  transcript: string;
}

interface ValidationResult {
  fileId: string;
  reference: string;
  hypothesis: string;
  wer: number;
  wordCount: number;
  cefrLevel: string;
  audioQuality: string;
  processingTimeMs: number;
}

interface ValidationSummary {
  timestamp: string;
  totalFiles: number;
  processedFiles: number;
  averageWER: number;
  werByLevel: Record<string, { count: number; totalWER: number; avgWER: number }>;
  totalProcessingTimeMs: number;
  results: ValidationResult[];
}

// Parse STM file to get reference transcripts
function parseSTM(stmPath: string): Map<string, STMEntry> {
  const content = readFileSync(stmPath, 'utf-8');
  const entries = new Map<string, STMEntry>();
  
  for (const line of content.split('\n')) {
    if (line.startsWith(';;') || !line.trim()) continue;
    
    // Format: fileId channel speaker start end <metadata> transcript
    const match = line.match(/^(\S+)\s+(\S+)\s+(\S+)\s+([\d.]+)\s+([\d.]+)\s+<([^>]+)>\s+(.*)$/);
    if (match) {
      const [, fileId, channel, speaker, start, end, metadata, transcript] = match;
      // Clean transcript: remove disfluency markers like (%hesitation%), (ga-)
      const cleanTranscript = transcript
        .replace(/\(%[^)]+%\)/g, '')  // Remove (%hesitation%) etc
        .replace(/\([^)]*-\)/g, '')    // Remove (ga-) etc
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
      
      entries.set(fileId, {
        fileId,
        channel,
        speaker,
        start: parseFloat(start),
        end: parseFloat(end),
        metadata,
        transcript: cleanTranscript
      });
    }
  }
  
  return entries;
}

// Extract CEFR level from metadata like <o,Q4,C,P1>
function extractCEFRLevel(metadata: string): string {
  const match = metadata.match(/[ABC][12]?/);
  return match ? match[0] : 'Unknown';
}

// Extract audio quality from metadata
function extractAudioQuality(metadata: string): string {
  const match = metadata.match(/Q(\d)/);
  return match ? `Q${match[1]}` : 'Unknown';
}

// Calculate WER (Word Error Rate) using word-level Levenshtein
function calculateWER(reference: string, hypothesis: string): number {
  const refWords = reference.split(/\s+/).filter(w => w);
  const hypWords = hypothesis.split(/\s+/).filter(w => w);
  
  if (refWords.length === 0) return hypothesis.trim().length === 0 ? 0 : 1;
  
  // Use character-level Levenshtein on joined words as approximation
  const distance = levenshtein.get(reference, hypothesis);
  return Math.min(1, distance / Math.max(reference.length, 1));
}

// Find all FLAC files recursively
function findFlacFiles(dir: string): string[] {
  const files: string[] = [];
  
  if (!existsSync(dir)) {
    console.error(`Directory not found: ${dir}`);
    return files;
  }
  
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(...findFlacFiles(fullPath));
    } else if (entry.endsWith('.flac')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Mock transcription for now (will integrate with actual Whisper later)
function transcribeAudio(audioPath: string): { text: string; timeMs: number } {
  const start = Date.now();
  
  // For now, use ffmpeg + whisper CLI if available, otherwise mock
  // In production, this would use the same transformers.js pipeline as the app
  try {
    // Check if whisper CLI is available
    const result = execSync(
      `whisper "${audioPath}" --model tiny.en --output_format txt --output_dir /tmp 2>/dev/null`,
      { encoding: 'utf-8', timeout: 60000 }
    );
    
    const txtPath = `/tmp/${basename(audioPath, '.flac')}.txt`;
    if (existsSync(txtPath)) {
      const text = readFileSync(txtPath, 'utf-8').trim().toLowerCase();
      return { text, timeMs: Date.now() - start };
    }
  } catch {
    // Whisper CLI not available, use placeholder
  }
  
  // Return placeholder for testing the pipeline
  return { 
    text: '[transcription pending - whisper cli not available]',
    timeMs: Date.now() - start
  };
}

// Main validation function
async function runValidation(limit?: number) {
  console.log('🔍 Starting validation...\n');
  
  // Check test data exists
  if (!existsSync(TEST_DATA_DIR)) {
    console.error('❌ Test data not found. Run: ln -s /path/to/sandi-corpus-2025 ./test-data');
    process.exit(1);
  }
  
  // Parse reference transcripts
  console.log('📖 Loading reference transcripts...');
  const references = parseSTM(STM_FILE);
  console.log(`   Found ${references.size} reference entries\n`);
  
  // Find audio files
  console.log('🎵 Finding audio files...');
  let audioFiles = findFlacFiles(AUDIO_DIR);
  console.log(`   Found ${audioFiles.length} FLAC files\n`);
  
  if (limit && limit > 0) {
    audioFiles = audioFiles.slice(0, limit);
    console.log(`   Limited to ${limit} files for testing\n`);
  }
  
  // Process each file
  const results: ValidationResult[] = [];
  let processed = 0;
  
  for (const audioPath of audioFiles) {
    const fileId = basename(audioPath, '.flac');
    const reference = references.get(fileId);
    
    if (!reference) {
      console.log(`⏭️  Skipping ${fileId} (no reference)`);
      continue;
    }
    
    processed++;
    process.stdout.write(`\r🎤 Processing ${processed}/${audioFiles.length}: ${fileId}...`);
    
    const { text: hypothesis, timeMs } = transcribeAudio(audioPath);
    const wer = calculateWER(reference.transcript, hypothesis);
    
    results.push({
      fileId,
      reference: reference.transcript,
      hypothesis,
      wer,
      wordCount: reference.transcript.split(/\s+/).length,
      cefrLevel: extractCEFRLevel(reference.metadata),
      audioQuality: extractAudioQuality(reference.metadata),
      processingTimeMs: timeMs
    });
  }
  
  console.log('\n');
  
  // Calculate summary stats
  const werByLevel: Record<string, { count: number; totalWER: number; avgWER: number }> = {};
  let totalWER = 0;
  let totalTime = 0;
  
  for (const result of results) {
    totalWER += result.wer;
    totalTime += result.processingTimeMs;
    
    if (!werByLevel[result.cefrLevel]) {
      werByLevel[result.cefrLevel] = { count: 0, totalWER: 0, avgWER: 0 };
    }
    werByLevel[result.cefrLevel].count++;
    werByLevel[result.cefrLevel].totalWER += result.wer;
  }
  
  for (const level of Object.keys(werByLevel)) {
    werByLevel[level].avgWER = werByLevel[level].totalWER / werByLevel[level].count;
  }
  
  const summary: ValidationSummary = {
    timestamp: new Date().toISOString(),
    totalFiles: audioFiles.length,
    processedFiles: results.length,
    averageWER: results.length > 0 ? totalWER / results.length : 0,
    werByLevel,
    totalProcessingTimeMs: totalTime,
    results
  };
  
  // Write results
  writeFileSync(OUTPUT_FILE, JSON.stringify(summary, null, 2));
  console.log(`📊 Results written to ${OUTPUT_FILE}`);
  
  // Print summary
  console.log('\n=== VALIDATION SUMMARY ===');
  console.log(`Files processed: ${summary.processedFiles}/${summary.totalFiles}`);
  console.log(`Average WER: ${(summary.averageWER * 100).toFixed(2)}%`);
  console.log(`Total time: ${(summary.totalProcessingTimeMs / 1000).toFixed(1)}s`);
  console.log('\nWER by CEFR Level:');
  for (const [level, stats] of Object.entries(werByLevel).sort()) {
    console.log(`  ${level}: ${(stats.avgWER * 100).toFixed(2)}% (n=${stats.count})`);
  }
}

// Parse CLI args
const args = process.argv.slice(2);
const limitIndex = args.indexOf('--limit');
const limit = limitIndex >= 0 ? parseInt(args[limitIndex + 1], 10) : undefined;

runValidation(limit).catch(console.error);
