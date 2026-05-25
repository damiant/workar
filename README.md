# Workar

A distributed work queue system for running local AI workloads (e.g. image generation, text generation, speech synthesis) via a remote API. Consists of five CLIs:

| CLI | Binary | Purpose |
|-----|--------|---------|
| `client-cli` | `workar` | Submit work and retrieve results from any machine |
| `server-cli` | `workar-server` | Run a worker process that polls and executes work |
| `image-gen-cli` | `img` | Generate images locally via `stable-diffusion.cpp` |
| `tts-cli` | `tts` | Generate speech locally via Kokoro TTS (ONNX) |
| `gemma4-cli` | `gemma` | Generate text locally via Gemma 4 E4B (llama.cpp) |
---

## Prerequisites

- Node.js ≥ 20

Build the TypeScript CLIs before first use:

```sh
cd client-cli && npm install && npm run build
cd ../server-cli && npm install && npm run build
```

The `image-gen-cli` and `gemma4-cli` are pure JS and require no build step.

---

## `workar` — Client CLI

Authenticate, submit work jobs, and retrieve results.

### `workar auth`

Authenticate via email magic code. Sends a 6-digit code to the given address and saves a JWT to `~/.workar/config.json`. Run this once, or again when the session expires. Any command that requires auth will trigger it automatically if no credentials are saved.

```sh
workar auth [--email <address>] [--server <url>]
```

| Option | Description |
|--------|-------------|
| `--email` | Email address (prompted interactively if omitted) |
| `--server` | Server URL override (default: `https://workar.tarsk.io`) |

### `workar submit`

Submit a work job. Prints the assigned `workId`.

```sh
workar submit --type <type> [key=value ...] [--out-dir <dir>] [--server <url>] [--api-key <key>]
```

| Option | Description |
|--------|-------------|
| `--type` | **(required)** Work type (must match a type defined on the server, e.g. `image-gen`) |
| `key=value` | Positional payload fields passed to the work handler (e.g. `prompt="a red fox"`) |
| `--out-dir` | Directory to save result files (default: current directory) |
| `--server` | Server URL override |
| `--api-key` | API key override (skips stored credentials) |

**Examples:**

```sh
# Submit image generation and get a workId back immediately
workar submit --type image-gen prompt="a red fox" model=flux2-klein-4b

# Submit image generation and save the PNG to ./output/
workar submit --type image-gen prompt="a red fox" model=flux2-klein-4b --out-dir ./output

# Submit TTS and save the WAV
workar submit --type tts text="Hello, world!" --out-dir ./output

# TTS with a specific voice and speed
workar submit --type tts text="Good morning." voice=bf_emma speed=1.2

# Submit text generation and save the result
workar submit --type text-gen prompt="Explain quantum computing briefly." --out-dir ./output

# Text generation with a custom system prompt
workar submit --type text-gen prompt="Write a haiku about code." system="You are a poet."
```

### `workar get`

Retrieve the result of a previously submitted job. Waits (long-polls) by default.

```sh
workar get [--work-id <id>] [--out-dir <dir>] [--server <url>] [--api-key <key>]
```

| Option | Description |
|--------|-------------|
| `--work-id` | ID of the job to fetch |
| `--out-dir` | Directory to save result files (default: current directory) |
| `--server` | Server URL override |
| `--api-key` | API key override |

**Example:**

```sh
workar get --work-id abc123 --out-dir ./output
```

### Global authentication

Credentials are read from `~/.workar/config.json` (written by `workar auth`). Any command that requires auth will run `auth` automatically if no credentials are found. `--api-key` can also be passed directly to any command to bypass stored credentials.

---

## `workar-server` — Server / Worker CLI

Runs a persistent loop that dequeues work items from the API, executes them locally according to `work-defs.json`, and posts results back.

```sh
workar-server [--api-key <key>] [--server <url>] [--defs <path>] [--timeout-ms <ms>]
```

| Option | Env var | Description | Default |
|--------|---------|-------------|---------|
| `--api-key` | `WORKAR_API_KEY` | **(required)** API key for the worker account | — |
| `--server` | `WORKAR_SERVER_URL` | Server URL | `https://workar.tarsk.io` |
| `--defs` | `TARSK_WORK_DEFS` | Path to `work-defs.json` | `./work-defs.json` |
| `--timeout-ms` | — | Max milliseconds per job before it is killed | `600000` (10 min) |

**Example:**

```sh
WORKAR_API_KEY=mykey workar-server --defs ./work-defs.json
# or
workar-server --api-key mykey --defs ./server-cli/work-defs.json --timeout-ms 120000
```

### `work-defs.json`

Defines the work types this worker can handle. Each entry maps a `type` string to one or more shell commands and an output file. `@token` placeholders are substituted from the job's payload. A `defaults` map provides fallback values for optional fields.

The bundled `work-defs.json` includes three built-in types:

| Type | Output | Required fields | Optional fields |
|------|--------|-----------------|-----------------|
| `image-gen` | `image/png` | `prompt` | `model` (default: `sdxl-lightning`) |
| `tts` | `audio/wav` | `text` | `voice` (default: `af_heart`), `speed` (default: `1`) |
| `text-gen` | `text/plain` | `prompt` | `model` (default: `gemma-4-e4b-it`), `system` (default: `"You are a helpful assistant."`) |

---

## `tts` — Text-to-Speech CLI

Generates speech locally using [Kokoro TTS](https://github.com/hexgrad/kokoro) (82M parameter ONNX model). On first run it downloads the model weights into `./.tts-cli/models/`. Long text is automatically sentence-split and the audio chunks are concatenated into one file.

```sh
tts -t "<text>" [options]
```

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--text <text>` | `-t` | **(required)** Text to speak | — |
| `--output <file>` | `-o` | Output WAV path | `./tts-output.wav` |
| `--voice <name>` | `-v` | Voice name (see below) | `af_heart` |
| `--speed <n>` | `-s` | Speed factor | `1` |
| `--dtype <type>` | `-d` | ONNX quantization: `fp32`\|`fp16`\|`q8`\|`q4`\|`q4f16` | `q8` |
| `--model <id>` | | HuggingFace model ID override | `onnx-community/Kokoro-82M-v1.0-ONNX` |
| `--help` | `-h` | Show help | — |

### Voices

| Group | Voices |
|-------|--------|
| American English (female) | `af_heart` *(default)*, `af_alloy`, `af_aoede`, `af_bella`, `af_jessica`, `af_kore`, `af_nicole`, `af_nova`, `af_river`, `af_sarah`, `af_sky` |
| American English (male) | `am_adam`, `am_echo`, `am_eric`, `am_fenrir`, `am_liam`, `am_michael`, `am_onyx`, `am_puck`, `am_santa` |
| British English (female) | `bf_alice`, `bf_emma`, `bf_isabella`, `bf_lily` |
| British English (male) | `bm_daniel`, `bm_fable`, `bm_george`, `bm_lewis` |

### Environment variables

| Variable | Description |
|----------|-------------|
| `TTS_CLI_CACHE_DIR` | Cache directory for ONNX model weights (default: `./.tts-cli`) |

**Examples:**

```sh
# Basic
tts -t "Hello, world!"

# British voice, 20% faster
tts -t "Good morning." -v bf_emma -s 1.2 -o morning.wav

# Higher quality (larger model, slower)
tts -t "Clear audio" -d fp32
```

---

## `img` — Image Generation CLI

Generates images locally using `stable-diffusion.cpp`. On first run it automatically downloads the required model files and the `sd-cli` binary.

```sh
img -p "<prompt>" [options]
```

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--prompt <text>` | `-p` | **(required)** Text prompt | — |
| `--output <file>` | `-o` | Output PNG path | `./img-output.png` |
| `--model <name>` | `-m` | Model preset (see below) | `flux2-klein-4b` |
| `--width <px>` | `-W` | Image width | `1024` |
| `--height <px>` | `-H` | Image height | `1024` |
| `--steps <n>` | `-s` | Sampling steps | per-model |
| `--cfg-scale <n>` | `-c` | CFG scale | per-model |
| `--seed <n>` | | RNG seed | random |
| `--sampler <name>` | | Sampling method | per-model |
| `--diffusion-model <path>` | | Override diffusion GGUF path | — |
| `--llm <path>` | | Override LLM text-encoder path | — |
| `--vae <path>` | | Override VAE path | — |
| `--checkpoint <path>` | | Override single-file checkpoint (SDXL) | — |
| `--no-offload` | | Disable CPU parameter offloading | false |
| `--no-flash-attn` | | Disable flash attention | false |
| `--help` | `-h` | Show help | — |

### Model presets

| Name | Label | Steps | CFG | Sampler |
|------|-------|-------|-----|---------|
| `flux2-klein-4b` | FLUX.2-klein-4B | 4 | 1.0 | euler |
| `z-image-turbo` | Z-Image-Turbo | 8 | 1.0 | euler |
| `sdxl-lightning` | SDXL Lightning (DreamShaperXL, 4-step) | 4 | 2.0 | euler |

### Environment variables

| Variable | Description |
|----------|-------------|
| `SD_BINARY` | Path to `sd-cli` executable (skips auto-download) |
| `IMG_CLI_CACHE_DIR` | Cache directory for models and binaries (default: `./.img-cli`) |
| `IMG_DIFFUSION_MODEL` | Override diffusion model path |
| `IMG_LLM_MODEL` | Override LLM text-encoder path |
| `IMG_VAE_MODEL` | Override VAE path |
| `IMG_MODEL_FILE` | Override single-file checkpoint (SDXL Lightning) |
| `HF_TOKEN` | HuggingFace token for gated model downloads |

**Examples:**

```sh
# Quick generation with default model
img -p "a red fox in a snowy forest"

# Use a specific model, custom size, and output path
img -p "a red fox" -m z-image-turbo -W 768 -H 768 -o fox.png

# Use a fixed seed for reproducibility
img -p "a red fox" --seed 42

# Use a locally cached model instead of downloading
IMG_DIFFUSION_MODEL=/models/my-model.gguf img -p "a red fox"
```

---

## `gemma` — Text Generation CLI

Generates text locally using [Gemma 4 E4B](https://ai.google.dev/gemma) via [llama.cpp](https://github.com/ggml-org/llama.cpp). On first run it automatically downloads the `llama-cli` binary and the GGUF model weights (~5.34 GB for Q4_K_M).

```sh
gemma -p "<prompt>" [options]
```

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--prompt <text>` | `-p` | **(required)** Text prompt | — |
| `--model <name>` | `-m` | Model preset (see below) | `gemma-4-e4b-it` |
| `--output <file>` | `-o` | Save response to file | stdout only |
| `--system <text>` | `-s` | System prompt | `"You are a helpful assistant."` |
| `--temp <n>` | | Sampling temperature | `0.6` |
| `--top-k <n>` | | Top-K sampling | `40` |
| `--top-p <n>` | | Top-P sampling | `0.95` |
| `--seed <n>` | | RNG seed | random |
| `--threads <n>` | | Number of threads | auto |
| `--ctx-size <n>` | | Context size in tokens | `4096` |
| `--model-file <path>` | | Override GGUF model path | — |
| `--download` | | Download binary + model without running | — |
| `--help` | `-h` | Show help | — |

### Model presets

| Name | Label | Size |
|------|-------|------|
| `gemma-4-e4b-it` | Gemma 4 E4B IT (Q4_K_M) | ~5.34 GB |
| `gemma-4-e4b-it-q8` | Gemma 4 E4B IT (Q8_0) | ~8.03 GB |

### Environment variables

| Variable | Description |
|----------|-------------|
| `LLAMA_BINARY` | Path to `llama-cli` executable (skips auto-download) |
| `GEMMA4_CLI_CACHE_DIR` | Cache directory for models and binaries (default: `./.gemma4-cli`) |
| `GEMMA4_MODEL` | Override GGUF model path |
| `HF_TOKEN` | HuggingFace token for gated model downloads |
| `GITHUB_TOKEN` | GitHub token for rate-limited releases API |

**Examples:**

```sh
# Basic prompt (downloads binary + model on first run)
gemma -p "Explain quantum computing in one paragraph."

# With system prompt and higher temperature
gemma -p "Write a haiku about programming." -s "You are a poet." --temp 0.8

# Save output to file
gemma -p "What is 2+2?" -o answer.txt

# Pre-download binary + model without running inference
gemma --download
```

---

## End-to-end workflow

```
┌──────────────────────┐          ┌──────────────────────┐          ┌──────────────────────┐
│  Client machine      │          │  workar API          │          │  Worker machine      │
│                      │          │  (Cloudflare Worker) │          │                      │
│  workar auth         │─────────▶│                      │◀─────────│  workar-server       │
│  workar submit       │─────────▶│  work queue          │─────────▶│  runs img / tts /    │
│  workar get          │◀─────────│  result store        │◀─────────│  gemma / other cmds  │
└──────────────────────┘          └──────────────────────┘          └──────────────────────┘
```

1. **Authenticate** once on the client machine (`workar auth` — prompted automatically on first use).
2. Start `workar-server` on a machine with a GPU (or any machine for TTS / text generation).
3. **Submit** work from anywhere — `workar submit --type image-gen prompt="..."`, `workar submit --type tts text="..."`, or `workar submit --type text-gen prompt="..."`.
4. Results are saved to `--out-dir` automatically (`.png` for images, `.wav` for speech, `.txt` for text).
