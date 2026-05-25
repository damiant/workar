#!/usr/bin/env node
import { parseArgs } from 'node:util';
import path from 'node:path';
import { env as hfEnv } from '@huggingface/transformers';
import { ensureDirs, MODELS_DIR } from './paths.js';

// Set cache dir BEFORE importing kokoro-js so model downloads go to .tts-cli/models/
ensureDirs();
hfEnv.cacheDir = MODELS_DIR;

import { KokoroTTS } from 'kokoro-js';

const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';

const HELP = `tts - generate speech from text via Kokoro TTS

Usage:
  tts -t "<text>" [options]

Options:
  -t, --text <text>        Text to speak (required)
  -o, --output <file>      Output WAV file (default: ./tts-output.wav)
  -v, --voice <name>       Voice name (default: af_heart)
  -s, --speed <n>          Speed factor (default: 1)
  -d, --dtype <type>       ONNX quantization: fp32|fp16|q8|q4|q4f16 (default: q8)
      --model <id>         HuggingFace model ID (default: ${MODEL_ID})
  -h, --help               Show this help

Voices (American English):
  af_heart  af_alloy  af_aoede  af_bella  af_jessica
  af_kore   af_nicole af_nova   af_river  af_sarah   af_sky

Voices (American English, male):
  am_adam   am_echo   am_eric   am_fenrir am_liam
  am_michael am_onyx  am_puck   am_santa

Voices (British English):
  bf_alice  bf_emma   bf_isabella bf_lily
  bm_daniel bm_fable  bm_george   bm_lewis

Environment:
  TTS_CLI_CACHE_DIR  Where ONNX models are cached
                     (default: ./.tts-cli in the current folder)
`;

function parse() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      text:   { type: 'string', short: 't' },
      output: { type: 'string', short: 'o', default: 'tts-output.wav' },
      voice:  { type: 'string', short: 'v', default: 'af_heart' },
      speed:  { type: 'string', short: 's', default: '1' },
      dtype:  { type: 'string', short: 'd', default: 'q8' },
      model:  { type: 'string' },
      help:   { type: 'boolean', short: 'h', default: false },
    },
  });
  if (!values.text && positionals.length) values.text = positionals.join(' ');
  return values;
}

async function main() {
  const args = parse();
  if (args.help) { process.stdout.write(HELP); return; }
  if (!args.text) {
    process.stderr.write('Error: --text is required\n\n' + HELP);
    process.exit(2);
  }

  const modelId = args.model || MODEL_ID;
  const output  = path.resolve(args.output);
  const speed   = Number(args.speed);
  const { voice, dtype } = args;

  if (isNaN(speed) || speed <= 0) {
    process.stderr.write('Error: --speed must be a positive number\n');
    process.exit(2);
  }

  // Cache dir already set at module load time (must be before kokoro-js import)

  process.stderr.write(`Loading model ${modelId} (dtype=${dtype})...\n`);
  const tts = await KokoroTTS.from_pretrained(modelId, {
    dtype,
    device: 'cpu',
  });

  process.stderr.write(`Generating speech (voice=${voice}, speed=${speed})...\n`);
  const audio = await tts.generate(args.text, { voice, speed });

  audio.save(output);
  process.stdout.write(`${output}\n`);
}

main().catch((err) => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
