import path from 'node:path';
import fs from 'node:fs';
import { MODELS_DIR, ensureDirs } from './paths.js';
import { download } from './download.js';

const HF = 'https://huggingface.co';

// Each preset has a components map: flag → { url, file }.
// The CLI builds the llama-cli argv from this map.
export const MODELS = {
  'gemma-4-e4b-it': {
    label: 'Gemma 4 E4B IT (Q4_K_M)',
    components: {
      'model': {
        url: `${HF}/ggml-org/gemma-4-E4B-it-GGUF/resolve/main/gemma-4-E4B-it-Q4_K_M.gguf`,
        file: 'gemma-4-E4B-it-Q4_K_M.gguf',
      },
    },
  },
  'gemma-4-e4b-it-q8': {
    label: 'Gemma 4 E4B IT (Q8_0)',
    components: {
      'model': {
        url: `${HF}/ggml-org/gemma-4-E4B-it-GGUF/resolve/main/gemma-4-E4B-it-Q8_0.gguf`,
        file: 'gemma-4-E4B-it-Q8_0.gguf',
      },
    },
  },
};

export function getModelPreset(name) {
  const preset = MODELS[name];
  if (!preset) {
    const known = Object.keys(MODELS).join(', ');
    throw new Error(`Unknown --model "${name}". Available: ${known}`);
  }
  return preset;
}

async function resolveComponent(componentName, override, spec) {
  if (override) {
    if (!fs.existsSync(override)) throw new Error(`${componentName} not found at ${override}`);
    return override;
  }
  ensureDirs();
  const dest = path.join(MODELS_DIR, spec.file);
  if (!fs.existsSync(dest)) {
    process.stderr.write(`Downloading model (${spec.file})...\n`);
    await download(spec.url, dest, { label: spec.file });
    process.stderr.write(`✓ Downloaded model (${spec.file}).\n`);
  }
  return dest;
}

/**
 * @param {object} opts
 * @param {string} opts.model preset name
 * @param {Record<string, string|undefined>} [opts.overrides]  flag-name → path
 */
export async function resolveModels({ model = 'gemma-4-e4b-it', overrides = {} } = {}) {
  const preset = getModelPreset(model);
  const paths = {};
  for (const [flag, spec] of Object.entries(preset.components)) {
    const override = overrides[flag] || process.env.GEMMA4_MODEL;
    paths[flag] = await resolveComponent(flag, override, spec);
  }
  return { preset, paths };
}
