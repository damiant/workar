# workar-server

Server-side runner CLI for the distributed work system. Long-polls the API for
work items, executes the configured command, and posts results back.

## Setup

```bash
npm install -g workar-server
```

## Authentication

Authentication uses email OTP. Run once before starting the work loop:

```bash
workar-server auth [--email you@example.com] [--server <url>]
```

1. Enter your email address (or pass `--email`).
2. A 6-digit code is sent to that address.
3. Enter the code — a JWT is saved to `~/.workar-server/config.json`.

Alternatively, pass `--api-key` or set `WORKAR_API_KEY` to use an API key directly.

## Running the work loop

```bash
workar-server \
  [--server <url>]    (default: $WORKAR_SERVER_URL or https://workar.tarsk.io)
  [--api-key <key>]   (or set WORKAR_API_KEY; falls back to saved JWT from auth)
  [--defs <path>]     (default: $TARSK_WORK_DEFS or ./work-defs.json)
  [--timeout-ms <n>]  (default: 600000)
```

## work-defs.json

Defines how each work type maps to a CLI command. Adding a new work type only
requires a new entry here — no code changes needed.

```json
[
  {
    "type": "image-gen",
    "commands": ["node ../image-gen-cli/src/cli.js -p @prompt -m @model -o @workId.png"],
    "contentType": "image/png",
    "outputFile": "@workId.png"
  }
]
```

Token substitution: `@<key>` is replaced with the corresponding field from the
work JSON. `@workId` is always available. Substitution happens on the final argv
array, not on a shell string, so user-supplied values cannot cause injection.
