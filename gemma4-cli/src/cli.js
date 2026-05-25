#!/usr/bin/env node
import { parseArgs } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import { resolveBinary } from './binary.js';
import { resolveModels, MODELS } from './models.js';
import { runLlama } from './run.js';

const MODEL_LIST = Object.entries(MODELS)
  .map(([k, v]) => `                             - ${k} (${v.label})`)
  .join('\n');

const HELP = `gemma - run text prompts through Gemma 4 E4B locally via llama.cpp

Usage:
  gemma -p "<prompt>" [options]

Options:
  -p, --prompt <text>      Prompt (required)
  -m, --model <name>       Model preset (default: gemma-4-e4b-it)
${MODEL_LIST}
  -o, --output <file>      Write response to file (default: stdout only)
  -s, --system <text>      System prompt (default: "You are a helpful assistant.")
      --temp <n>           Sampling temperature (default: 0.6)
      --top-k <n>          Top-K sampling (default: 40)
      --top-p <n>          Top-P sampling (default: 0.95)
      --seed <n>           RNG seed (default: random)
      --threads <n>        Number of threads (default: auto)
      --ctx-size <n>       Context size in tokens (default: 4096)
      --model-file <path>  Override GGUF model path
      --download           Download binary + model without running inference
  -h, --help               Show this help

Environment:
  LLAMA_BINARY             Path to llama-cli executable (skip auto-download)
  GEMMA4_CLI_CACHE_DIR     Where models/binaries are cached
                           (default: ./.gemma4-cli in the current folder)
  GEMMA4_MODEL             Override GGUF model path
  HF_TOKEN                 HuggingFace token for gated model downloads
  GITHUB_TOKEN             GitHub token for rate-limited releases API
`;

function parse() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      prompt:      { type: 'string', short: 'p' },
      model:       { type: 'string', short: 'm', default: 'gemma-4-e4b-it' },
      output:      { type: 'string', short: 'o' },
      system:      { type: 'string', short: 's', default: 'You are a helpful assistant.' },
      temp:        { type: 'string' },
      'top-k':     { type: 'string' },
      'top-p':     { type: 'string' },
      seed:        { type: 'string' },
      threads:     { type: 'string' },
      'ctx-size':  { type: 'string' },
      'model-file':{ type: 'string' },
      download:    { type: 'boolean', default: false },
      help:        { type: 'boolean', short: 'h', default: false },
    },
  });
  if (!values.prompt && positionals.length) values.prompt = positionals.join(' ');
  return values;
}

async function main() {
  const args = parse();
  if (args.help) { process.stdout.write(HELP); return; }

  const binary = await resolveBinary();
  const { preset, paths: models } = await resolveModels({
    model: args.model,
    overrides: {
      model: args['model-file'],
    },
  });

  if (args.download) {
    process.stderr.write(`\n✓ Binary and model cached in .gemma4-cli/\n`);
    process.stderr.write(`  Binary: ${binary}\n`);
    process.stderr.write(`  Model:  ${models.model}\n`);
    return;
  }

  if (!args.prompt) {
    process.stderr.write('Error: --prompt is required\n\n' + HELP);
    process.exit(2);
  }

  const llamaArgs = [];
  for (const [flag, p] of Object.entries(models)) {
    llamaArgs.push(`--${flag}`, p);
  }
  llamaArgs.push(
    '-p', args.prompt,
    '-sys', args.system,
    '--no-warmup',
  );
  if (args.temp)       llamaArgs.push('--temp', args.temp);
  if (args['top-k'])   llamaArgs.push('--top-k', args['top-k']);
  if (args['top-p'])   llamaArgs.push('--top-p', args['top-p']);
  if (args.seed)       llamaArgs.push('--seed', args.seed);
  if (args.threads)    llamaArgs.push('--threads', args.threads);
  if (args['ctx-size']) llamaArgs.push('--ctx-size', args['ctx-size']);

  process.stderr.write(`\nModel: ${preset.label} (${args.model})\n`);
  process.stderr.write(`Running: ${path.basename(binary)} ${llamaArgs.map(a => /\s/.test(a) ? JSON.stringify(a) : a).join(' ')}\n\n`);
  await runLlama(binary, llamaArgs);

  if (args.output) {
    // llama-cli prints to stdout when using -p, but with stdio: 'inherit'
    // the output goes directly to the terminal. For --output, capture to file.
    // NOTE: The output was already streamed to the terminal via stdio: 'inherit'.
    // If --output is specified, we re-run with stdio capture to save the output.
    process.stderr.write(`\nNote: --output requires re-running with stdout capture.\n`);

    // Re-run with captured stdout for file output
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execFileAsync = promisify(execFile);

    const { stdout } = await execFileAsync(binary, llamaArgs, {
      maxBuffer: 100 * 1024 * 1024,
    });
    const output = path.resolve(args.output);
    fs.writeFileSync(output, stdout);
    process.stderr.write(`\n✓ Saved ${output}\n`);
  }
}

main().catch((err) => {
  process.stderr.write(`\ngemma: ${err.message}\n`);
  process.exit(1);
});
