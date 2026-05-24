# img-cli

A Node CLI that turns a text prompt into an image, running locally via
[stable-diffusion.cpp](https://github.com/leejet/stable-diffusion.cpp)
(the ggml/llama.cpp-style C++ inference engine for diffusion models).

Supported models out of the box:

- [FLUX.2-klein-4B](https://huggingface.co/black-forest-labs/FLUX.2-klein-4B) (default)
- [Z-Image-Turbo](https://huggingface.co/Tongyi-MAI/Z-Image-Turbo)
- [SDXL Lightning](https://huggingface.co/ByteDance/SDXL-Lightning) (via the [DreamShaperXL Lightning](https://huggingface.co/Lykon/dreamshaper-xl-lightning) merge — single ~7 GB file with UNet+CLIP+VAE bundled)

On first run it auto-downloads the `sd-cli` binary for your platform plus the
required model weights into `./.img-cli/` in the current folder. No system
tools required — zip extraction is handled in pure Node, and the package has
**zero npm dependencies**.

## Requirements

- Node.js ≥ 20 (only)
- ~6 GB free disk per model preset
- A platform with a prebuilt `sd-cli` binary: **macOS arm64**, **Linux x86_64**, or **Windows x86_64 (AVX2)**
  - On other platforms, build `stable-diffusion.cpp` yourself and set `SD_BINARY=/path/to/sd-cli`

## Install

From the repo root:

```bash
npm install -g .
```

This exposes the `img` command globally.

## Basic usage

```bash
img -p "a lovely cat holding a sign that says hello"
```

The first invocation downloads (into `./.img-cli/`):

- `sd-cli` binary (~50 MB)
- `flux-2-klein-4b-Q4_0.gguf` diffusion model (~2.5 GB)
- `Qwen3-4B-Q4_K_M.gguf` text encoder (~2.5 GB)
- `flux2-vae.safetensors` VAE (~150 MB)

Output is written to `./img-output.png` by default (override with `-o`).

### Switching models

```bash
img --model z-image-turbo -p "a cinematic neon city at night"
```

Available presets (see `img --help`):

| `--model` value     | Description                                                | Default steps | Default CFG |
| ------------------- | ---------------------------------------------------------- | ------------- | ----------- |
| `flux2-klein-4b`    | FLUX.2-klein-4B (default)                                  | 4             | 1.0         |
| `z-image-turbo`     | Tongyi-MAI Z-Image-Turbo (distilled)                       | 8             | 1.0         |
| `sdxl-lightning`    | SDXL Lightning, 4-step (DreamShaperXL Lightning merge)     | 4             | 2.0         |

Each preset has its own diffusion/LLM/VAE downloads cached under
`./.img-cli/models/`.

## Cache location

By default everything is cached relative to your **current working directory**:

```
./.img-cli/
├── bin/         ← sd-cli, sd-server, dylib
└── models/      ← *.gguf, *.safetensors
```

Running `img` from a different folder will recreate the cache there. To share
one cache across folders, set `IMG_CLI_CACHE_DIR`:

```bash
export IMG_CLI_CACHE_DIR=~/.cache/img-cli
img -p "..."
```

## Examples

Custom output path:

```bash
img -p "neon cyberpunk city at night, raining" -o city.png
```

Larger image, more steps, fixed seed:

```bash
img \
  -p "a watercolor painting of a fox in a snowy forest" \
  -o fox.png \
  -W 1024 -H 1024 \
  --steps 8 \
  --seed 42
```

Use your own locally-built `sd-cli` and a custom diffusion model:

```bash
SD_BINARY=/opt/sd.cpp/build/bin/sd-cli \
img -p "a cyberpunk samurai" \
  --diffusion-model ~/models/flux-2-klein-4b-Q8_0.gguf
```

SDXL Lightning with your own checkpoint (e.g. JuggernautXL Lightning):

```bash
img --model sdxl-lightning \
  --checkpoint ~/models/juggernautXL_lightning.safetensors \
  -p "a cyberpunk samurai"
```

## All options

```
img -p "<prompt>" [options]

  -p, --prompt <text>      Prompt (required)
  -o, --output <file>      Output PNG (default: ./img-output.png)
  -m, --model <name>       Model preset (default: flux2-klein-4b)
  -W, --width <px>         Image width  (default: 1024)
  -H, --height <px>        Image height (default: 1024)
  -s, --steps <n>          Sampling steps (default: per-model)
  -c, --cfg-scale <n>      CFG scale (default: 1.0)
      --seed <n>           Seed (default: random)
      --sampler <name>     Sampling method (default: euler)
      --diffusion-model    Override diffusion gguf path
      --llm                Override text-encoder LLM path
      --vae                Override VAE path
      --no-offload         Don't offload params to CPU
      --no-flash-attn      Disable flash attention
  -h, --help               Show help
```

## Environment variables

| Variable                | Purpose                                                |
| ----------------------- | ------------------------------------------------------ |
| `SD_BINARY`             | Path to an existing `sd-cli` executable.               |
| `IMG_CLI_CACHE_DIR`     | Cache location (default `./.img-cli` in cwd).          |
| `IMG_DIFFUSION_MODEL`   | Override diffusion model path.                         |
| `IMG_LLM_MODEL`         | Override text-encoder LLM model path.                  |
| `IMG_VAE_MODEL`         | Override VAE model path.                               |
| `HF_TOKEN`              | HuggingFace token for gated/rate-limited downloads.    |
| `GITHUB_TOKEN`          | Used when querying GitHub releases (avoids rate limits). |

## Tips

- Distilled models (klein, z-image-turbo) want low CFG (`--cfg-scale 1.0`) and few steps.
- Use descriptive prompts: subject → setting → details → lighting → atmosphere.
- On Apple Silicon, try `--no-offload` — unified memory makes CPU offloading pure overhead.

## Troubleshooting

- **`No prebuilt sd binary for <platform>/<arch>`** — build `stable-diffusion.cpp` from source and pass `SD_BINARY=/path/to/sd-cli`.
- **Out of memory** — try `-W 512 -H 512` or keep `--offload-to-cpu` (default).
- **Slow first run** — model downloads are large; afterward, only inference time matters.
