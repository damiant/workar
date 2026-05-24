#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { getConfig } from './config.js';
import { ServerApi } from './api.js';
import { Runner, type WorkDef } from './runner.js';
import { runLoop } from './loop.js';

const { values } = parseArgs({
  options: {
    server: { type: 'string' },
    'api-key': { type: 'string' },
    defs: { type: 'string' },
    'timeout-ms': { type: 'string' },
  },
  allowPositionals: false,
});

const config = getConfig(values as Record<string, string | undefined>);

if (!config.apiKey) {
  console.error('Error: --api-key or WORKAR_API_KEY is required');
  process.exit(1);
}

const workDefsRaw = await readFile(config.workDefsPath, 'utf-8');
const workDefs = JSON.parse(workDefsRaw) as WorkDef[];

const api = new ServerApi(config.serverUrl, config.apiKey);
const runner = new Runner(workDefs);

await runLoop(api, runner, config.timeoutMs);
