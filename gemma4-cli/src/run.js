import { spawn } from 'node:child_process';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

/**
 * Build an environment with the binary's directory added to the platform's
 * shared-library search path. This is needed because prebuilt binaries
 * (llama-cli, sd-cli) ship with sibling .dylib / .so files that the
 * executable references via @rpath / $ORIGIN.
 */
function spawnEnv(binary) {
  const env = { ...process.env };
  const binDir = path.dirname(binary);
  if (process.platform === 'darwin') {
    env.DYLD_LIBRARY_PATH = binDir + (env.DYLD_LIBRARY_PATH ? `:${env.DYLD_LIBRARY_PATH}` : '');
  } else if (process.platform === 'linux') {
    env.LD_LIBRARY_PATH = binDir + (env.LD_LIBRARY_PATH ? `:${env.LD_LIBRARY_PATH}` : '');
  }
  return env;
}

/**
 * Strip ANSI/VT100 escape sequences from a string.
 */
function stripAnsi(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').replace(/\x1b[()][AB012]/g, '');
}

/**
 * Parse the raw PTY capture and extract only the model's generated response.
 * The capture contains:
 *   > <user prompt echo>
 *   <model response lines>
 *   [ Prompt: X t/s | Generation: Y t/s ]
 *   Exiting...
 */
function parseResponse(raw, prompt) {
  const lines = stripAnsi(raw).split(/\r?\n/);
  const promptLine = `> ${prompt}`;
  let start = -1;
  let end = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (start === -1 && lines[i].trim() === promptLine.trim()) {
      start = i + 1;
      continue;
    }
    if (start !== -1 && (lines[i].startsWith('[ Prompt:') || lines[i].startsWith('Exiting'))) {
      end = i;
      break;
    }
  }
  if (start === -1) return raw.trim();
  return lines.slice(start, end).join('\n').trim();
}

/**
 * Run llama-cli via `script` (PTY capture) so we can capture output that is
 * written directly to /dev/tty by the llama-cli TUI. Falls back to direct
 * spawn on Windows where `script` is unavailable.
 */
export function runLlama(binary, args) {
  if (process.platform === 'win32') {
    return runLlamaDirect(binary, args);
  }
  return runLlamaViaPty(binary, args);
}

function runLlamaDirect(binary, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['inherit', 'pipe', 'inherit'], env: spawnEnv(binary) });
    const chunks = [];
    child.stdout.on('data', (chunk) => { process.stdout.write(chunk); chunks.push(chunk); });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve(Buffer.concat(chunks).toString());
      else reject(new Error(`llama-cli exited with code ${code}`));
    });
  });
}

function runLlamaViaPty(binary, args) {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(os.tmpdir(), `gemma4-${Date.now()}.log`);
    // script -q <file> <cmd> [args...]  — macOS/BSD syntax
    // On Linux: script -q <file> -c "<cmd> [args]" — but we use macOS here
    const isLinux = process.platform === 'linux';
    const scriptArgs = isLinux
      ? ['-q', tmpFile, '-c', [binary, ...args].map(a => `'${a.replace(/'/g, "'\\''")}'`).join(' ')]
      : ['-q', tmpFile, binary, ...args];

    const prompt = args[args.indexOf('-p') + 1] || '';
    const child = spawn('script', scriptArgs, {
      stdio: 'ignore',
      env: spawnEnv(binary),
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      let captured = '';
      try { captured = fs.readFileSync(tmpFile, 'utf8'); } catch {}
      try { fs.unlinkSync(tmpFile); } catch {}
      if (code === 0 || code === null) {
        const response = parseResponse(captured, prompt);
        process.stdout.write(response + '\n');
        resolve(response);
      } else {
        reject(new Error(`llama-cli exited with code ${code}`));
      }
    });
  });
}
