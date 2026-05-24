import path from 'node:path';
import fs from 'node:fs';

export const CACHE_DIR = process.env.IMG_CLI_CACHE_DIR
  || path.join(process.cwd(), '.img-cli');

export const BIN_DIR = path.join(CACHE_DIR, 'bin');
export const MODELS_DIR = path.join(CACHE_DIR, 'models');

export function ensureDirs() {
  for (const d of [CACHE_DIR, BIN_DIR, MODELS_DIR]) {
    fs.mkdirSync(d, { recursive: true });
  }
}
