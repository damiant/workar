# workar

End-user CLI for the distributed work system.

## Setup

```bash
npm install -g workar
```

## Usage

### Authenticate

Authentication uses email OTP — no password or API key needed. Your email address is your username.

```bash
workar auth [--email you@example.com] [--server http://localhost:8787]
```

1. Enter your email address (or pass `--email`).
2. A 6-digit code is sent to that address.
3. Enter the code — a JWT is saved to `~/.workar/config.json`.

The JWT is used automatically for all subsequent commands.

### Submit work

```bash
workar submit --type image-gen --wait [--out-dir ./output] -- prompt="a red panda" [model=sdxl-lightning]
```

`model` defaults to `sdxl-lightning` and can be omitted.

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
  "username": "you@example.com",
  "jwt": "..."
}
```

The `--server` flag overrides `serverUrl` for a single command.
