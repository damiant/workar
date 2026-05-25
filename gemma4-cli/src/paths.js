import path from 'node:path';
import fs from 'node:fs';

export const CACHE_DIR = process.env.GEMMA4_CLI_CACHE_DIR
  || path.join(process.cwd(), '.gemma4-cli');

export const BIN_DIR = path.join(CACHE_DIR, 'bin');
export const MODELS_DIR = path.join(CACHE_DIR, 'models');

export function ensureDirs() {
  for (const d of [CACHE_DIR, BIN_DIR, MODELS_DIR]) {
    fs.mkdirSync(d, { recursive: true });
  }
}
