# Workar

A distributed work queue system for running local AI workloads (e.g. image generation) via a remote API. Consists of three CLIs:

| CLI | Binary | Purpose |
|-----|--------|---------|
| `client-cli` | `workar` | Submit work and retrieve results from any machine |
| `server-cli` | `workar-server` | Run a worker process that polls and executes work |
| `image-gen-cli` | `img` | Generate images locally via `stable-diffusion.cpp` |

---

## Prerequisites

- Node.js ≥ 20

Build the TypeScript CLIs before first use:

```sh
cd client-cli && npm install && npm run build
cd ../server-cli && npm install && npm run build
```

The `image-gen-cli` is pure JS and requires no build step.

---

## `workar` — Client CLI

Used to register an account, authenticate, submit work jobs, and retrieve results.

### `workar register`

Create a new account. Saves credentials to `~/.workar/config.json`.

```sh
workar register --username <name> [--server <url>]
```

| Option | Description |
|--------|-------------|
| `--username` | **(required)** Username to register |
| `--server` | Server URL (default: `https://workar.tarsk.io`) |

### `workar auth`

Exchange credentials for a session JWT. Must be run after `register` (or when the JWT expires).

```sh
workar auth [--username <name>] [--api-key <key>] [--server <url>]
```

| Option | Description |
|--------|-------------|
| `--username` | Username (defaults to saved value) |
| `--api-key` | API key (defaults to saved value) |
| `--server` | Server URL override |

### `workar submit`

Submit a work job. Prints the assigned `workId`.

```sh
workar submit --type <type> [key=value ...] [--wait] [--out-dir <dir>] [--server <url>] [--api-key <key>]
```

| Option | Description |
|--------|-------------|
| `--type` | **(required)** Work type (must match a type defined on the server, e.g. `image-gen`) |
| `key=value` | Positional payload fields passed to the work handler (e.g. `prompt="a red fox"`) |
| `--wait` | Block until the job completes and save the result |
| `--out-dir` | Directory to save result files (default: current directory) |
| `--server` | Server URL override |
| `--api-key` | API key override (skips stored credentials) |

**Examples:**

```sh
# Submit and get a workId back immediately
workar submit --type image-gen prompt="a red fox" model=flux2-klein-4b

# Submit and wait for the PNG to be saved to ./output/
workar submit --type image-gen prompt="a red fox" model=flux2-klein-4b --wait --out-dir ./output
```

### `workar get`

Retrieve (and optionally wait for) the result of a previously submitted job.

```sh
workar get [--work-id <id>] [--wait] [--out-dir <dir>] [--server <url>] [--api-key <key>]
```

| Option | Description |
|--------|-------------|
| `--work-id` | ID of the job to fetch |
| `--wait` | Long-poll until the job completes |
| `--out-dir` | Directory to save result files (default: current directory) |
| `--server` | Server URL override |
| `--api-key` | API key override |

**Example:**

```sh
workar get --work-id abc123 --wait --out-dir ./output
```

### Global authentication

Credentials are read from `~/.workar/config.json` (written by `register`/`auth`). Any command that requires auth also accepts `--api-key` directly, bypassing stored credentials.

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

Defines the work types this worker can handle. Each entry maps a `type` string to one or more shell commands and an output file. `@token` placeholders are substituted from the job's payload.

```json
[
  {
    "type": "image-gen",
    "commands": [
      "node ../image-gen-cli/src/cli.js -p @prompt -m @model -o @workId.png"
    ],
    "contentType": "image/png",
    "outputFile": "@workId.png"
  }
]
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

## End-to-end workflow

```
┌─────────────────────┐        ┌──────────────────┐        ┌─────────────────────┐
│  Client machine     │        │  tarsk API server │        │  Worker machine     │
│                     │        │  (Cloudflare      │        │                     │
│  workar register    │──────▶│   Worker)         │◀──────│  workar-server      │
│  workar auth        │        │                   │        │  (polls for work)   │
│  workar submit      │──────▶│  work queue       │──────▶│  runs img / other   │
│  workar get --wait  │◀──────│  result store     │◀──────│  commands           │
└─────────────────────┘        └──────────────────┘        └─────────────────────┘
```

1. **Register & authenticate** once on the client machine.
2. Start `workar-server` on a machine with a GPU.
3. **Submit** work from anywhere — `workar submit --type image-gen prompt="..." --wait`.
4. Results are saved to `--out-dir` automatically.
