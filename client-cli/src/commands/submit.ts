import { mkdir } from 'node:fs/promises';
import { readConfig, getServerUrl, buildAuthHeaders } from '../config.js';
import { ClientApi } from '../api.js';
import { saveResult } from '../output.js';

export async function cmdSubmit(args: {
  type?: string;
  wait?: boolean;
  'out-dir'?: string;
  server?: string;
  'api-key'?: string;
  positionals?: string[];
}): Promise<void> {
  if (!args.type) {
    console.error('Error: --type is required');
    process.exit(1);
  }

  const config = await readConfig();
  const serverUrl = getServerUrl(config, args);
  const authHeaders = buildAuthHeaders(config, { 'api-key': args['api-key'] });
  const api = new ClientApi(serverUrl, authHeaders);

  const kv: Record<string, string> = {};
  for (const pair of args.positionals ?? []) {
    const eq = pair.indexOf('=');
    if (eq === -1) {
      console.error(`Invalid key=value pair: ${pair}`);
      process.exit(1);
    }
    kv[pair.slice(0, eq)] = pair.slice(eq + 1);
  }

  const { workId } = await api.submitWork({ type: args.type, ...kv });
  console.log(`Submitted work ${workId}`);

  if (args.wait) {
    const outDir = args['out-dir'] ?? process.cwd();
    await mkdir(outDir, { recursive: true });
    const result = await api.getWork(true, workId);
    await saveResult(result, outDir);
    if (result.isError) process.exit(1);
  }
}
