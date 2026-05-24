import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

export interface ClientConfig {
  serverUrl?: string;
  username?: string;
  apiKey?: string;
  jwt?: string;
}

const CONFIG_DIR = path.join(homedir(), '.tarsk-work');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export async function readConfig(): Promise<ClientConfig> {
  if (!existsSync(CONFIG_FILE)) return {};
  const raw = await readFile(CONFIG_FILE, 'utf-8');
  return JSON.parse(raw) as ClientConfig;
}

export async function writeConfig(config: ClientConfig): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function getServerUrl(
  config: ClientConfig,
  overrides: { server?: string },
): string {
  return overrides.server ?? config.serverUrl ?? 'https://work.tarsk.io';
}

export function buildAuthHeaders(
  config: ClientConfig,
  overrides: { 'api-key'?: string },
): Record<string, string> {
  const apiKey = overrides['api-key'] ?? config.apiKey;
  if (apiKey) return { 'x-api-key': apiKey };
  if (config.jwt) return { authorization: `Bearer ${config.jwt}` };
  throw new Error('No authentication available. Run `tarsk register` then `tarsk auth`.');
}
