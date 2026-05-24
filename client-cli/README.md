# tarsk

End-user CLI for the distributed work system.

## Setup

```bash
npm install
npm run build
```

## Usage

### Register a user

```bash
tarsk register --username alice [--server http://localhost:8787]
```

Writes `~/.tarsk-work/config.json` with `username`, `apiKey`, and `serverUrl`.

### Authenticate (get a JWT)

```bash
tarsk auth [--username alice] [--api-key <key>]
```

Writes the JWT to `~/.tarsk-work/config.json`.

### Submit work

```bash
tarsk submit --type image-gen --wait [--out-dir ./output] -- prompt="a red panda" model=sdxl-lightning
```

Key-value pairs after `--` are passed as work fields. `--wait` polls for the
result and saves it as `work-<workId>.<ext>` in `--out-dir` (default: CWD).

### Retrieve a result

```bash
tarsk get [--work-id <id>] [--wait] [--out-dir ./output]
```

## Config file

`~/.tarsk-work/config.json` (chmod 600):

```json
{
  "serverUrl": "https://...",
  "username": "alice",
  "apiKey": "...",
  "jwt": "..."
}
```

Flags `--server`, `--username`, `--api-key` override the file values.
