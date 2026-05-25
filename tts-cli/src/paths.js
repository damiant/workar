import path from 'node:path';
import fs from 'node:fs';

export const CACHE_DIR = process.env.TTS_CLI_CACHE_DIR
  || path.join(process.cwd(), '.tts-cli');

export const MODELS_DIR = path.join(CACHE_DIR, 'models');

export function ensureDirs() {
  for (const d of [CACHE_DIR, MODELS_DIR]) {
    fs.mkdirSync(d, { recursive: true });
  }
}
