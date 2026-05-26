---
name: tts
description: 'Generate speech audio from text using the workar CLI. Use when: converting text to speech, generating audio from text, creating voiceovers, running workar tts, getting audio output by ID.'
argument-hint: 'Describe the text you want to convert to speech'
---

# Text-to-Speech with workar

## When to Use
- User wants to convert text into spoken audio
- User asks to "generate speech", "create audio", "text to speech", "make a voiceover", "read this aloud", etc.
- User wants to retrieve a previously submitted TTS job by ID

## Available Voices

The following voices are available for text-to-speech generation:

| ID | Description |
|----|-------------|
| `af_heart` | Female, warm and friendly (default) |
| `af_bella` | Female, calm and clear |
| `af_nicole` | Female, professional |
| `af_sarah` | Female, upbeat and energetic |
| `af_sky` | Female, soft and gentle |
| `am_adam` | Male, deep and authoritative |
| `am_michael` | Male, professional and clear |

> Use `af_heart` as the default voice unless the user specifies otherwise.

## Available Speeds

| Value | Description |
|-------|-------------|
| `0.5` | Slow |
| `0.75` | Slightly slow |
| `1` | Normal speed (default) |
| `1.25` | Slightly fast |
| `1.5` | Fast |
| `2` | Very fast |

> Use `1` as the default speed unless the user specifies otherwise.

## Procedure

### Step 1 — Submit the TTS job

Run the submit command with the text, voice, and speed:

```bash
npx --yes workar submit --type tts text="<text to convert>" voice="<voice id>" speed="<speed>"
```

Capture the job ID returned in stdout (e.g. `01ksejtdqks9c00db9ccaw4473`).

**Parameters:**
- `text` *(required)* — The text content to convert to speech.
- `voice` *(optional, default: `af_heart`)* — The voice to use.
- `speed` *(optional, default: `1`)* — The speaking speed.

### Step 2 — Retrieve the result

Pass the returned ID to the get command:

```bash
npx --yes workar get <id>
```

This writes the output file `<id>.wav` to the current working directory.

### Step 3 — Report to the user

Tell the user:
- The job ID
- The output file path (e.g. `01ksejtdqks9c00db9ccaw4473.wav`)

## Generating Multiple Audio Files

To generate multiple distinct audio clips (e.g. different voices or separate paragraphs), submit each job separately and retrieve each result:

```bash
npx --yes workar submit --type tts text="<text 1>" voice="<voice>" speed="<speed>"
# capture id1
npx --yes workar submit --type tts text="<text 2>" voice="<voice>" speed="<speed>"
# capture id2
# ... repeat for each clip

npx --yes workar get <id1>
npx --yes workar get <id2>
# ... retrieve each
```

Submit all jobs first, then retrieve results one by one.

## Notes
- If the user only provides an ID (no new text), skip Step 1 and run `npx workar get <id>` directly.
- Run both commands in the terminal; do not fabricate IDs or file paths.
- The `.wav` file will be written by the `get` command — do not attempt to create it manually.
- For long text inputs, keep the text within reasonable limits. If the text is extremely long, consider splitting it into multiple shorter segments.
