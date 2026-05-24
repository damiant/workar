import path from 'node:path';
import fs from 'node:fs';
import { MODELS_DIR, ensureDirs } from './paths.js';
import { download } from './download.js';

const HF = 'https://huggingface.co';

// Each preset declares its `components` as a map from sd-cli flag name
// (without the leading `--`) to { url, file }. cli.js builds the sd-cli
// argv by walking this map.
export const MODELS = {
  'flux2-klein-4b': {
    label: 'FLUX.2-klein-4B',
    defaultSteps: 4,
    defaultCfg: '1.0',
    defaultSampler: 'euler',
    components: {
      'diffusion-model': {
        url: `${HF}/leejet/FLUX.2-klein-4B-GGUF/resolve/main/flux-2-klein-4b-Q4_0.gguf`,
        file: 'flux-2-klein-4b-Q4_0.gguf',
      },
      'llm': {
        url: `${HF}/unsloth/Qwen3-4B-GGUF/resolve/main/Qwen3-4B-Q4_K_M.gguf`,
        file: 'Qwen3-4B-Q4_K_M.gguf',
      },
      'vae': {
        url: `${HF}/Comfy-Org/vae-text-encorder-for-flux-klein-4b/resolve/main/split_files/vae/flux2-vae.safetensors`,
        file: 'flux2-vae.safetensors',
      },
    },
  },

  'z-image-turbo': {
    label: 'Z-Image-Turbo',
    defaultSteps: 8,
    defaultCfg: '1.0',
    defaultSampler: 'euler',
    components: {
      'diffusion-model': {
        url: `${HF}/leejet/Z-Image-Turbo-GGUF/resolve/main/z_image_turbo-Q4_K.gguf`,
        file: 'z_image_turbo-Q4_K.gguf',
      },
      'llm': {
        url: `${HF}/unsloth/Qwen3-4B-Instruct-2507-GGUF/resolve/main/Qwen3-4B-Instruct-2507-Q4_K_M.gguf`,
        file: 'Qwen3-4B-Instruct-2507-Q4_K_M.gguf',
      },
      'vae': {
        url: `${HF}/Comfy-Org/z_image_turbo/resolve/main/split_files/vae/ae.safetensors`,
        file: 'z-image-turbo-ae.safetensors',
      },
    },
  },

  'sdxl-lightning': {
    label: 'SDXL Lightning (DreamShaperXL merge, 4-step)',
    defaultSteps: 4,
    defaultCfg: '2.0',
    defaultSampler: 'euler',
    components: {
      'model': {
        url: `${HF}/Lykon/dreamshaper-xl-lightning/resolve/main/DreamShaperXL_Lightning.safetensors`,
        file: 'DreamShaperXL_Lightning.safetensors',
      },
    },
  },
};

// Map of CLI override flags / env vars to component keys.
const OVERRIDE_MAP = {
  'diffusion-model': 'IMG_DIFFUSION_MODEL',
  'llm':             'IMG_LLM_MODEL',
  'vae':             'IMG_VAE_MODEL',
  'model':           'IMG_MODEL_FILE',
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
    process.stderr.write(`Downloading ${componentName} (${spec.file})\n`);
    await download(spec.url, dest, { label: spec.file });
  }
  return dest;
}

/**
 * @param {object} opts
 * @param {string} opts.model preset name
 * @param {Record<string, string|undefined>} [opts.overrides]  flag-name → path
 */
export async function resolveModels({ model = 'flux2-klein-4b', overrides = {} } = {}) {
  const preset = getModelPreset(model);
  const paths = {};
  for (const [flag, spec] of Object.entries(preset.components)) {
    const envKey = OVERRIDE_MAP[flag];
    const override = overrides[flag] || (envKey ? process.env[envKey] : undefined);
    paths[flag] = await resolveComponent(flag, override, spec);
  }
  return { preset, paths };
}
