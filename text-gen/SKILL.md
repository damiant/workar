---
name: text-gen
description: 'Generate text using an AI model (gemma4) via the workar CLI. Use when: An answer is needed to a question or problem particularly if multiple questions need answering.'
argument-hint: 'Describe the prompt (and optionally a system prompt) to send to the AI'
---

# Text Generation with workar (gemma4)

## When to Use
- User wants to prompt an AI model and get a text response
- User asks to "ask the AI", "generate text", "run a prompt", "use a system prompt", "query gemma", etc.
- User wants to retrieve a previously submitted text-gen job by ID

## Procedure

### Step 0 — Decompose complex requests

Before submitting, check whether the request contains multiple questions, tasks, or problems. If it does, **split it into individual jobs** — one per question or task. Submit each as a separate `workar submit` call, capture all IDs, then retrieve and display all results together.

**Why:** The model performs better on focused, single-purpose prompts. Large compound prompts increase the chance of truncation, timeouts, or shallow answers.

- If the request has N questions → submit N jobs in sequence, then retrieve all N results.
- Keep each prompt self-contained (e.g. "Answer the following question: ...").
- You may retrieve all jobs in parallel once all IDs are captured.

### Step 1 — Submit the text-gen job

Run the submit command with the prompt, and optionally a system prompt and model:

```bash
npx --yes workar submit --type text-gen prompt="<user prompt>" system="<system prompt>"
```

Capture the job ID returned in stdout (e.g. `01ksejtdqks9c00db9ccaw4473`).

**Parameters:**
- `prompt` *(required)* — The user prompt to send to the AI model.
- `system` *(optional, default: `You are a helpful assistant.`)* — The system prompt that sets the AI's behavior.

### Step 2 — Retrieve the result

Pass the returned ID to the get command:

```bash
npx --yes workar get <id>
```

This writes the output file `<id>.txt` to the current working directory.

### Step 3 — Read and report the result

Read the contents of the `.txt` file and present the AI's response to the user:
- The job ID
- The output file path (e.g. `01ksejtdqks9c00db9ccaw4473.txt`)
- The text content of the file

## Notes
- If the user only provides an ID (no new prompt), skip Step 1 and run `npx workar get <id>` directly.
- Run both commands in the terminal; do not fabricate IDs or file paths.
- The `.txt` file will be written by the `get` command — do not attempt to create it manually.
- After retrieving, read the `.txt` file and display its contents to the user directly in chat.
