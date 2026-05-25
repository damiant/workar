# tts-cli

A Node CLI that turns text into speech, running locally via
[Kokoro TTS](https://github.com/hexgrad/kokoro) (82M parameter open-weight
TTS model) using [kokoro-js](https://www.npmjs.com/package/kokoro-js) and ONNX
runtime.

On first run it auto-downloads the ONNX model weights into `./.tts-cli/` in the
current folder. Voice data is bundled with the npm package.

## Requirements

- Node.js ≥ 20
- ~100 MB free disk for the ONNX model (first run)

## Install

From the repo root:

```bash
cd tts-cli
npm install
```

Or link globally:

```bash
npm install -g .
```

This exposes the `tts` command globally.

## Basic usage

```bash
node src/cli.js -t "Hello, world!"
```

The first invocation downloads the ONNX model into `./.tts-cli/models/`.
Output is written to `./tts-output.wav` by default (override with `-o`).

### Options

```
  -t, --text <text>        Text to speak (required)
  -o, --output <file>      Output WAV file (default: ./tts-output.wav)
  -v, --voice <name>       Voice name (default: af_heart)
  -s, --speed <n>          Speed factor (default: 1)
  -d, --dtype <type>       ONNX quantization: fp32|fp16|q8|q4|q4f16 (default: q8)
      --model <id>         HuggingFace model ID
  -h, --help               Show help
```

### Examples

```bash
# Basic
node src/cli.js -t "The quick brown fox jumps over the lazy dog."

# British voice, faster
node src/cli.js -t "Good morning." -v bf_emma -s 1.2

# Specific output path
node src/cli.js -t "Hello world" -o greeting.wav

# Higher quality
node src/cli.js -t "Clear audio" -d fp32
```

### Voices

**American English (female):** `af_heart` (default), `af_alloy`, `af_aoede`,
`af_bella`, `af_jessica`, `af_kore`, `af_nicole`, `af_nova`, `af_river`,
`af_sarah`, `af_sky`

**American English (male):** `am_adam`, `am_echo`, `am_eric`, `am_fenrir`,
`am_liam`, `am_michael`, `am_onyx`, `am_puck`, `am_santa`

**British English (female):** `bf_alice`, `bf_emma`, `bf_isabella`, `bf_lily`

**British English (male):** `bm_daniel`, `bm_fable`, `bm_george`, `bm_lewis`

### Environment variables

| Variable | Description |
|---|---|
| `TTS_CLI_CACHE_DIR` | Where ONNX models are cached (default: `./.tts-cli`) |

## Output

24 kHz 16-bit PCM WAV file.
