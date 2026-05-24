# End-to-End Story: Image Generation via tarsk-work

A full walkthrough of the tarsk-work distributed system — from user registration to
receiving a generated image — using the live API at **https://work.tarsk.io**.

---

## System Overview

```
client-cli  ──POST /api/work──►  Cloudflare Worker  ──queue──►  server-cli
                                   (work.tarsk.io)                   │
client-cli  ◄──image/png──────  Cloudflare Worker  ◄──result──  image-gen-cli
                                                                      │
                                                                   sd-cli
                                                          (stable-diffusion.cpp)
```

Three packages collaborate over a REST API backed by Turso (libSQL):

| Package | Role |
|---|---|
| `worker/` | Cloudflare Worker — auth, work queue, result delivery |
| `server-cli/` | Pulls work items, runs local tools (image-gen-cli), posts results |
| `client-cli/` | Submits work, polls for results, saves output files |

---

## Step 1 — Register a user

```bash
$ node dist/cli.js register --username story-1779657983 --server https://work.tarsk.io
```

**API call:** `POST https://work.tarsk.io/api/users`

```json
{ "username": "story-1779657983" }
```

**Response:**

```json
{
  "username": "story-1779657983",
  "apiKey": "BKfrjUG8PNt7KV0cCr0wKelkXHR9BAGhD6EW0GQam..."   // 255 chars
}
```

The worker creates the user in Turso, hashes the API key (SHA-256), and returns the
plaintext key once. The client saves it to `~/.tarsk-work/config.json`.

---

## Step 2 — Start the server-cli

```bash
$ cd server-cli
$ node dist/cli.js --api-key "$STORY_API_KEY"
```

**Log:**

```
tarsk-server: starting work loop
```

The server-cli authenticates with the worker, obtains a short-lived JWT, and begins
polling `GET https://work.tarsk.io/api/deque?poll` every second (server-side
long-poll). It is now ready to accept work.

---

## Step 3 — Submit the work

**Timestamp:** `2026-05-24 14:38:40 PDT`

```bash
$ node dist/cli.js submit \
    --type image-gen \
    --wait \
    --out-dir /tmp/tarsk-story-out2 \
    --api-key "$STORY_API_KEY" \
    "prompt=a glowing crystal city at twilight with water reflections, cinematic" \
    "model=sdxl-lightning"
```

**API call:** `POST https://work.tarsk.io/api/work`

```json
{
  "type": "image-gen",
  "prompt": "a glowing crystal city at twilight with water reflections, cinematic",
  "model": "sdxl-lightning",
  "workId": "01KSDYT1WDMNAX1ET77ZGRYRDF"
}
```

**Response:**

```json
{ "workId": "01KSDYT1WDMNAX1ET77ZGRYRDF" }
```

The worker inserts the item into the `input_queue` table. The client then begins
polling `GET https://work.tarsk.io/api/work?workId=01KSDYT1WDMNAX1ET77ZGRYRDF`
every 10 seconds.

---

## Step 4 — server-cli picks up the work

The server-cli's long-poll returns with the queued item immediately after submission.

**Server log:**

```
processing work 01KSDYT1WDMNAX1ET77ZGRYRDF (type: image-gen)
```

The runner expands the work definition from `work-defs.json`:

```
node ../image-gen-cli/src/cli.js \
  -p "a glowing crystal city at twilight with water reflections, cinematic" \
  -m sdxl-lightning \
  -o 01KSDYT1WDMNAX1ET77ZGRYRDF.png
```

The image-gen-cli resolves the `sdxl-lightning` model alias and invokes `sd-cli`
(stable-diffusion.cpp):

```
.img-cli/bin/sd-cli \
  --model .img-cli/models/DreamShaperXL_Lightning.safetensors \
  -p "a glowing crystal city at twilight with water reflections, cinematic" \
  -o 01KSDYT1WDMNAX1ET77ZGRYRDF.png \
  -W 1024 -H 1024 \
  --steps 4 \
  --cfg-scale 2.0 \
  --sampling-method euler
```

---

## Step 5 — Image generated, result posted

After ~70 seconds of inference (4-step SDXL Lightning on Apple Silicon), `sd-cli`
writes `01KSDYT1WDMNAX1ET77ZGRYRDF.png` (1024×1024 RGB PNG).

The server-cli reads the PNG, base64-encodes it, and posts it to the worker:

**API call:** `POST https://work.tarsk.io/api/complete`

The worker stores the result in the `out_queue` table.

**Server log:**

```
completed work 01KSDYT1WDMNAX1ET77ZGRYRDF
```

---

## Step 6 — client-cli receives the image

The client's next poll (`GET /api/work?workId=01KSDYT1WDMNAX1ET77ZGRYRDF`) returns
`200 OK` with:

```
Content-Type: image/png
x-work-id: 01KSDYT1WDMNAX1ET77ZGRYRDF
```

The PNG bytes are decoded and written to disk:

```
I saved the result to "/tmp/tarsk-story-out2/work-01KSDYT1WDMNAX1ET77ZGRYRDF.png"
```

**Timestamp:** `2026-05-24 14:39:52 PDT`

**Total elapsed time:** ~72 seconds

---

## Result

| Property | Value |
|---|---|
| Work ID | `01KSDYT1WDMNAX1ET77ZGRYRDF` |
| Model | DreamShaperXL Lightning (`sdxl-lightning`) |
| Resolution | 1024 × 1024 |
| Steps | 4 (Euler sampler, CFG 2.0) |
| File size | 1.7 MB |
| Format | PNG 8-bit/color RGB non-interlaced |
| Total round-trip | ~72 seconds |
| Exit code | 0 (success) |

**Prompt:** *a glowing crystal city at twilight with water reflections, cinematic*

The PNG is saved at:

```
/tmp/tarsk-story-out2/work-01KSDYT1WDMNAX1ET77ZGRYRDF.png
```

---

## Terminal transcript

```
$ node dist/cli.js submit \
    --type image-gen --wait --out-dir /tmp/tarsk-story-out2 \
    --api-key "$STORY_API_KEY" \
    "prompt=a glowing crystal city at twilight with water reflections, cinematic" \
    "model=sdxl-lightning"

Submitted work 01KSDYT1WDMNAX1ET77ZGRYRDF
Waiting for result.......
I saved the result to "/tmp/tarsk-story-out2/work-01KSDYT1WDMNAX1ET77ZGRYRDF.png"
```

Seven dots = seven 10-second polling intervals while inference ran on the local
machine.

---

## Notes

- The `story-1779657983` user and their API key are registered on the live
  `work.tarsk.io` production instance (Turso DB).
- The worker runs in Cloudflare's edge network; work is queued in Turso (libSQL)
  and delivered to the server-cli over standard HTTPS.
- The server-cli ran from the `server-cli/` directory; model weights and the
  `sd-cli` binary are cached in `server-cli/.img-cli/` (git-ignored).
- All test artefacts (`*.png`) are git-ignored at the repo root.
