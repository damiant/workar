#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
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

const saved = await readSavedConfig();
const config = getConfig(values as Record<string, string | undefined>, saved);

// Prefer JWT from saved config, fall back to api-key
const useJwt = !config.apiKey && !!config.jwt;
if (!config.apiKey && !config.jwt) {
  console.error('Error: authentication required. Run `workar-server auth` or provide --api-key / WORKAR_API_KEY');
  process.exit(1);
}

const workDefsRaw = await readFile(config.workDefsPath, 'utf-8');
const workDefs = JSON.parse(workDefsRaw) as WorkDef[];

const api = new ServerApi(
  config.serverUrl,
  useJwt ? config.jwt! : config.apiKey,
  useJwt,
);
const runner = new Runner(workDefs);

await runLoop(api, runner, config.timeoutMs);

