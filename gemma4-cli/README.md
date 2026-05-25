# gemma4-cli

A Node CLI that runs text prompts through [Gemma 4 E4B](https://ai.google.dev/gemma) locally via [llama.cpp](https://github.com/ggml-org/llama.cpp). Gemma 4 E4B is an 8B parameter Mixture-of-Experts model with 4B active parameters, offering strong text generation quality at a manageable size.

Supported quantizations out of the box:

- **Gemma 4 E4B IT Q4_K_M** (~5.34 GB) — default, good balance of quality and size
- **Gemma 4 E4B IT Q8_0** (~8.03 GB) — higher quality, larger download

On first run it auto-downloads the `llama-cli` binary for your platform plus the required GGUF model weights into `./.gemma4-cli/` in the current folder. No system tools required — zip/tar extraction is handled in pure Node, and the package has **zero npm dependencies**.

## Requirements

- Node.js ≥ 20 (only)
- ~6 GB free disk for the default model (Q4_K_M)
- A platform with a prebuilt `llama-cli` binary: **macOS arm64**, **macOS x64**, **Linux x86_64**, **Linux arm64**, or **Windows x86_64**
  - On other platforms, build [llama.cpp](https://github.com/ggml-org/llama.cpp) yourself and set `LLAMA_BINARY=/path/to/llama-cli`

## Install

From the repo root:

```bash
cd gemma4-cli
npm install
```

Or link globally:

```bash
cd gemma4-cli
npm link
```

## Usage

```sh
# Basic prompt (downloads binary + model on first run)
node src/cli.js -p "Explain quantum computing in one paragraph."

# With system prompt and temperature
node src/cli.js -p "Write a haiku about programming." -s "You are a poet." --temp 0.8

# Save output to file
node src/cli.js -p "What is 2+2?" -o answer.txt

# Pre-download binary + model without running inference
node src/cli.js --download

# Use a specific model preset
node src/cli.js -p "Hello!" -m gemma-4-e4b-it-q8
```

## Options

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

## Model presets

| Name | Label | Size |
|------|-------|------|
| `gemma-4-e4b-it` | Gemma 4 E4B IT (Q4_K_M) | ~5.34 GB |
| `gemma-4-e4b-it-q8` | Gemma 4 E4B IT (Q8_0) | ~8.03 GB |

## Environment variables

| Variable | Description |
|----------|-------------|
| `LLAMA_BINARY` | Path to `llama-cli` executable (skips auto-download) |
| `GEMMA4_CLI_CACHE_DIR` | Cache directory for models and binaries (default: `./.gemma4-cli`) |
| `GEMMA4_MODEL` | Override GGUF model path |
| `HF_TOKEN` | HuggingFace token for gated model downloads |
| `GITHUB_TOKEN` | GitHub token for rate-limited releases API |

## Examples

```sh
# Quick prompt
gemma -p "What is the meaning of life?"

# With custom system prompt and higher temperature
gemma -p "Tell me a story." -s "You are a creative storyteller." --temp 0.9

# Use a locally cached model instead of downloading
GEMMA4_MODEL=/models/gemma-4-E4B-it-Q4_K_M.gguf gemma -p "Hello!"
```
