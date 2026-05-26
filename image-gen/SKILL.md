---
name: image-gen
description: 'Generate images using the workar CLI. Use when: generating AI images, creating image from a prompt, submitting image generation jobs, retrieving generated image results, running workar image-gen, getting image output by ID.'
argument-hint: 'Describe the image you want to generate'
---

# Image Generation with workar

## When to Use
- User wants to generate an image from a text description
- User asks to "create an image", "generate a picture", "make an illustration", etc.
- User wants to retrieve a previously submitted image generation job by ID

## Procedure

### Step 1 — Submit the image generation job

Run the submit command with the user's prompt:

```bash
npx --yes workar submit --type image-gen prompt="<user prompt here>"
```

Capture the job ID returned in stdout (e.g. `01ksejtdqks9c00db9ccaw4473`).

### Step 2 — Retrieve the result

Pass the returned ID to the get command:

```bash
npx --yes workar get <id>
```

This writes the output file `<id>.png` to the current working directory.

### Step 3 — Report to the user

Tell the user:
- The job ID
- The output file path (e.g. `01ksejtdqks9c00db9ccaw4473.png`)

## Generating Multiple Images

To generate multiple distinct images (e.g. "10 different animals"), submit each prompt separately and retrieve each result:

```bash
npx --yes workar submit --type image-gen prompt="<prompt 1>"
# capture id1
npx --yes workar submit --type image-gen prompt="<prompt 2>"
# capture id2
# ... repeat for each image

npx --yes workar get <id1>
npx --yes workar get <id2>
# ... retrieve each
```

Submit all jobs first, then retrieve results one by one.

## Notes
- If the user only provides an ID (no new prompt), skip Step 1 and run `npx --yes workar get <id>` directly.
- Run both commands in the terminal; do not fabricate IDs or file paths.
- The `.png` file will be written by the `get` command — do not attempt to create it manually.
