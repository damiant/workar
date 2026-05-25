#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { getConfig, readSavedConfig } from './config.js';
import { ServerApi } from './api.js';
import { Runner, type WorkDef } from './runner.js';
import { runLoop } from './loop.js';
import { cmdAuth } from './commands/auth.js';

const [subcommand, ...restArgs] = process.argv.slice(2);

if (subcommand === 'auth') {
  const { values } = parseArgs({
    args: restArgs,
    options: {
      email: { type: 'string' },
      server: { type: 'string' },
    },
    allowPositionals: false,
  });
  await cmdAuth(values as { email?: string; server?: string });
  process.exit(0);
}

// Default: run the work loop (no subcommand, or 'run')
const runArgs = subcommand === 'run' ? restArgs : (subcommand ? [subcommand, ...restArgs] : restArgs);

const { values } = parseArgs({
  args: runArgs,
  options: {
    server: { type: 'string' },
    'api-key': { type: 'string' },
    defs: { type: 'string' },
    'timeout-ms': { type: 'string' },
  },
  allowPositionals: false,
});

const pkgDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const saved = await readSavedConfig();
const config = getConfig(values as Record<string, string | undefined>, saved);

// Prefer JWT from saved config, fall back to api-key
const useJwt = !config.apiKey && !!config.jwt;
if (!config.apiKey && !config.jwt) {
  await cmdAuth({});
  process.exit(0);
}

let workDefsRaw: string;
try {
  workDefsRaw = await readFile(config.workDefsPath, 'utf-8');
} catch (err: any) {
  if (err.code !== 'ENOENT') throw err;
  if (config.workDefsPath !== './work-defs.json') {
    console.error(`Error: work definitions file not found: ${config.workDefsPath}`);
    console.error(`Specify a valid path with --defs <path>`);
    process.exit(1);
  }
  // No local work-defs.json — fall back to the bundled default
  workDefsRaw = await readFile(path.join(pkgDir, 'work-defs.json'), 'utf-8');
}
// Resolve __PKG_DIR__ placeholder used by the bundled work-defs.json
workDefsRaw = workDefsRaw.replaceAll('__PKG_DIR__', pkgDir);
const workDefs = JSON.parse(workDefsRaw) as WorkDef[];

const api = new ServerApi(
  config.serverUrl,
  useJwt ? config.jwt! : config.apiKey,
  useJwt,
);
const runner = new Runner(workDefs);

await runLoop(api, runner, config.timeoutMs);

