import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

export interface ServerConfig {
  serverUrl: string;
  apiKey: string;
  workDefsPath: string;
  timeoutMs: number;
  jwt?: string;
  email?: string;
}

const CONFIG_DIR = path.join(homedir(), '.workar-server');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export interface SavedServerConfig {
  jwt?: string;
  email?: string;
}

export async function readSavedConfig(): Promise<SavedServerConfig> {
  if (!existsSync(CONFIG_FILE)) return {};
  const raw = await readFile(CONFIG_FILE, 'utf-8');
  return JSON.parse(raw) as SavedServerConfig;
}

export async function writeSavedConfig(config: SavedServerConfig): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function getConfig(
  args: Record<string, string | undefined>,
  saved: SavedServerConfig = {},
): ServerConfig {
  return {
    serverUrl: args['server'] ?? process.env['WORKAR_SERVER_URL'] ?? 'https://workar.tarsk.io',
    apiKey: args['api-key'] ?? process.env['WORKAR_API_KEY'] ?? '',
    workDefsPath: args['defs'] ?? process.env['TARSK_WORK_DEFS'] ?? './work-defs.json',
    timeoutMs: args['timeout-ms'] ? parseInt(args['timeout-ms'], 10) : 600_000,
    jwt: saved.jwt,
    email: saved.email,
  };
}

