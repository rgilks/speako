
import { pipeline, env } from '@huggingface/transformers';
import path from 'path';
import fs from 'fs';

// Configure to use local models
env.allowLocalModels = true;
env.useBrowserCache = false;
// Pointing to the absolute path of the public/models directory
const projectRoot = process.cwd();
env.localModelPath = path.join(projectRoot, 'public', 'models');

const MODEL_ID = 'cefr-deberta-v3-small';

// Sample texts for verification
const SAMPLES = [
  {
    level: 'A1',
    text: "I like cats. My name is John. I am student."
  },
  {
    level: 'B1',
    text: "I think that learning a new language is very interesting but also quite difficult. You need to practice every day if you want to improve."
  },
  {
    level: 'C1',
    text: "The implications of this policy are far-reaching, potentially altering the socioeconomic landscape for decades to come. Nevertheless, we must proceed with caution."
  },
  {
    level: 'Noise (Mix)',
    text: "i think the uh the weather is gonna be good today um yeah probly"
  }
];

async function verify() {
  console.log(`🚀 Loading model from: ${env.localModelPath}/${MODEL_ID}`);
  
  try {
    const classifier = await pipeline('text-classification', MODEL_ID, {
        device: 'cpu', // Use CPU for node script verification
    });

    console.log("✅ Model loaded successfully.\n");
    console.log("🧐 Running predictions...\n");

    for (const sample of SAMPLES) {
      const result = await classifier(sample.text);
      console.log(`📝 Text (${sample.level}): "${sample.text}"`);
      console.log(`📊 Prediction: ${JSON.stringify(result, null, 2)}`);
      console.log("-".repeat(50));
    }

  } catch (error) {
    console.error("❌ Verification failed:", error);
    process.exit(1);
  }
}

verify();
