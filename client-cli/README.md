# workar

End-user CLI for the distributed work system.

## Setup

```bash
npm install
npm run build
```

## Usage

### Register a user

```bash
workar register --username alice [--server http://localhost:8787]
```

Writes `~/.workar/config.json` with `username`, `apiKey`, and `serverUrl`.

### Authenticate (get a JWT)

```bash
workar auth [--username alice] [--api-key <key>]
```

Writes the JWT to `~/.workar/config.json`.

### Submit work

```bash
workar submit --type image-gen --wait [--out-dir ./output] -- prompt="a red panda" model=sdxl-lightning
```

Key-value pairs after `--` are passed as work fields. `--wait` polls for the
result and saves it as `work-<workId>.<ext>` in `--out-dir` (default: CWD).

### Retrieve a result

```bash
workar get [--work-id <id>] [--wait] [--out-dir ./output]
```

## Config file

`~/.workar/config.json` (chmod 600):

```json
{
  "serverUrl": "https://...",
  "username": "alice",
  "apiKey": "...",
  "jwt": "..."
}
```

Flags `--server`, `--username`, `--api-key` override the file values.
