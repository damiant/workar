# workar-server

Server-side runner CLI for the distributed work system. Long-polls the API for
work items, executes the configured command, and posts results back.

## Setup

```bash
npm install
npm run build
```

## Usage

```
workar-server \
  --server <url>    (default: $WORKAR_SERVER_URL or http://localhost:8787)
  --api-key <key>   (required; or set WORKAR_API_KEY)
  --defs <path>     (default: $TARSK_WORK_DEFS or ./work-defs.json)
  --timeout-ms <n>  (default: 600000)
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
