#!/usr/bin/env node
import { parseArgs } from 'node:util';
import path from 'node:path';
import { resolveBinary } from './binary.js';
import { resolveModels, MODELS } from './models.js';
import { runSd } from './run.js';

const MODEL_LIST = Object.entries(MODELS)
  .map(([k, v]) => `                             - ${k} (${v.label}, default steps ${v.defaultSteps})`)
  .join('\n');

const HELP = `img - generate images locally via stable-diffusion.cpp

Usage:
  img -p "<prompt>" [options]

Options:
  -p, --prompt <text>      Prompt (required)
  -o, --output <file>      Output PNG (default: ./img-output.png)
  -m, --model <name>       Model preset (default: flux2-klein-4b)
${MODEL_LIST}
  -W, --width <px>         Image width  (default: 1024)
  -H, --height <px>        Image height (default: 1024)
  -s, --steps <n>          Sampling steps (default: per-model)
  -c, --cfg-scale <n>      CFG scale (default: per-model)
      --seed <n>           Seed (default: random)
      --sampler <name>     Sampling method (default: per-model)
      --diffusion-model    Override diffusion gguf path     (Flux/Z-Image)
      --llm                Override LLM text-encoder path   (Flux/Z-Image)
      --vae                Override VAE path                (Flux/Z-Image)
      --checkpoint         Override single-file checkpoint  (SDXL Lightning)
      --no-offload         Don't offload params to CPU
      --no-flash-attn      Disable flash attention
  -h, --help               Show this help

Environment:
  SD_BINARY                Path to sd-cli executable (skip auto-download)
  IMG_CLI_CACHE_DIR        Where models/binaries are cached
                           (default: ./.img-cli in the current folder)
  IMG_DIFFUSION_MODEL      Override diffusion model path
  IMG_LLM_MODEL            Override LLM model path
  IMG_VAE_MODEL            Override VAE model path
  IMG_MODEL_FILE           Override single-file checkpoint  (SDXL Lightning)
  HF_TOKEN                 HuggingFace token for gated downloads
`;

function parse() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      prompt:           { type: 'string', short: 'p' },
      output:           { type: 'string', short: 'o', default: 'img-output.png' },
      model:            { type: 'string', short: 'm', default: 'flux2-klein-4b' },
      width:            { type: 'string', short: 'W', default: '1024' },
      height:           { type: 'string', short: 'H', default: '1024' },
      steps:            { type: 'string', short: 's' },
      'cfg-scale':      { type: 'string', short: 'c' },
      seed:             { type: 'string' },
      sampler:          { type: 'string' },
      'diffusion-model':{ type: 'string' },
      llm:              { type: 'string' },
      vae:              { type: 'string' },
      checkpoint:       { type: 'string' },
      'no-offload':     { type: 'boolean', default: false },
      'no-flash-attn':  { type: 'boolean', default: false },
      help:             { type: 'boolean', short: 'h', default: false },
    },
  });
  if (!values.prompt && positionals.length) values.prompt = positionals.join(' ');
  return values;
}

async function main() {
  const args = parse();
  if (args.help) { process.stdout.write(HELP); return; }
  if (!args.prompt) {
    process.stderr.write('Error: --prompt is required\n\n' + HELP);
    process.exit(2);
  }

  const binary = await resolveBinary();
  const { preset, paths: models } = await resolveModels({
    model: args.model,
    overrides: {
      'diffusion-model': args['diffusion-model'],
      'llm':             args.llm,
      'vae':             args.vae,
      'model':           args.checkpoint,
    },
  });

  const steps    = args.steps        ?? String(preset.defaultSteps);
  const cfgScale = args['cfg-scale'] ?? preset.defaultCfg;
  const sampler  = args.sampler      ?? preset.defaultSampler ?? 'euler';
  const output   = path.resolve(args.output);

  const sdArgs = [];
  for (const [flag, p] of Object.entries(models)) {
    sdArgs.push(`--${flag}`, p);
  }
  sdArgs.push(
    '-p',                args.prompt,
    '-o',                output,
    '-W',                args.width,
    '-H',                args.height,
    '--steps',           steps,
    '--cfg-scale',       cfgScale,
    '--sampling-method', sampler,
    '-v',
  );
  if (args.seed) sdArgs.push('-s', args.seed);
  if (!args['no-offload'])    sdArgs.push('--offload-to-cpu');
  if (!args['no-flash-attn']) sdArgs.push('--diffusion-fa');

  process.stderr.write(`\nModel: ${preset.label} (${args.model})\n`);
  process.stderr.write(`Running: ${path.basename(binary)} ${sdArgs.map(a => /\s/.test(a) ? JSON.stringify(a) : a).join(' ')}\n\n`);
  await runSd(binary, sdArgs);
  process.stderr.write(`\n✓ Saved ${output}\n`);
}

main().catch((err) => {
  process.stderr.write(`\nimg: ${err.message}\n`);
  process.exit(1);
});
