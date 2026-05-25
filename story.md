# End-to-End Test Story

A full test of the `workar` ecosystem: registering a user, authenticating,
starting a worker server, submitting an image-gen job, and downloading the result.

---

## 1. Register a new user

```
$ npx workar register --username story-test-001

Registered as story-test-001
API key: P32nimFqF9c3qPxxHcpamXs6Z7a78UzOJcNVpWbLjFkpmzoJd39AIed4WgDCBCKEMadXK3q
rbudM6leTnw6UVVqix5EyuX8uSqr0Qb0DfOPEO0pQlYQwFCZ2lMEi8HeEOtemXxJSgmiPCqBkshQqooL
KOUhxBy5Rn7s4QnJbRq2FsDzsGxv19nr10hsqP2MjWAzgSOtqE1dUxj7PPBnDMNdueBT6fI1gEFzowq6
Pv5kc5TPmMEnFLVG5JnYJsmX
```

## 2. Authenticate (exchange API key for JWT)

```
$ npx workar auth \
    --username story-test-001 \
    --api-key P32nimFqF9c3qPxxHcpamXs6Z7a78UzOJcNVpWbLjFkpmzoJd39AIed4WgDCBCKEMadXK3q...

Authenticated successfully
```

Credentials saved to `~/.workar/config.json`.

## 3. Start the worker server

Run from the `server-cli/` directory so the relative path `../image-gen-cli/src/cli.js`
in `work-defs.json` resolves correctly. Point `IMG_CLI_CACHE_DIR` at the pre-downloaded
model cache.

```
$ cd server-cli
$ IMG_CLI_CACHE_DIR=/Users/damiantarnawsky/Code/tarsk-work/.img-cli \
  WORKAR_API_KEY=<api-key> \
  npx workar-server --defs ./work-defs.json

workar-server: starting work loop
```

## 4. Submit an image-gen job and wait for the result

In a separate terminal (or just after the server is running in the background):

```
$ cd /Users/damiantarnawsky/Code/tarsk-work
$ npx workar submit \
    --type image-gen \
    prompt="a red fox in a snowy forest" \
    model=flux2-klein-4b \
    --wait \
    --out-dir ./output

Submitted work 01KSE49A5FEQHN3E0HD8KFDRTT
Waiting for result..............................
I saved the result to "output/work-01KSE49A5FEQHN3E0HD8KFDRTT.png"
```

## 5. Server-side log

```
workar-server: starting work loop
processing work 01KSE49A5FEQHN3E0HD8KFDRTT (type: image-gen)
completed work 01KSE49A5FEQHN3E0HD8KFDRTT
```

## 6. Result

```
$ ls -lh output/
-rw-r--r--  1 damiantarnawsky  staff   2.1M May 24 16:19 work-01KSE49A5FEQHN3E0HD8KFDRTT.png
```

The generated PNG (`output/work-01KSE49A5FEQHN3E0HD8KFDRTT.png`, 2.2 MB) contains
the image of *a red fox in a snowy forest* produced by the `flux2-klein-4b` model.

---

## Summary

| Step | Command | Result |
|------|---------|--------|
| Register | `npx workar register --username story-test-001` | API key issued |
| Auth | `npx workar auth --username ... --api-key ...` | JWT saved |
| Serve | `npx workar-server --defs ./work-defs.json` | Loop started |
| Submit | `npx workar submit --type image-gen ... --wait` | Work ID `01KSE49A5FEQHN3E0HD8KFDRTT` |
| Output | `output/work-01KSE49A5FEQHN3E0HD8KFDRTT.png` | 2.2 MB PNG |
