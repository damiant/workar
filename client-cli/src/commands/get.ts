import { mkdir } from 'node:fs/promises';
import { readConfig, getServerUrl, buildAuthHeaders } from '../config.js';
import { ClientApi } from '../api.js';
import { saveResult } from '../output.js';

export async function cmdGet(args: {
  'work-id'?: string;
  wait?: boolean;
  'out-dir'?: string;
  server?: string;
  'api-key'?: string;
}): Promise<void> {
  const config = await readConfig();
  const serverUrl = getServerUrl(config, args);
  const authHeaders = buildAuthHeaders(config, { 'api-key': args['api-key'] });
  const api = new ClientApi(serverUrl, authHeaders);

  const outDir = args['out-dir'] ?? process.cwd();
  await mkdir(outDir, { recursive: true });

  const result = await api.getWork(args.wait ?? false, args['work-id']);
  await saveResult(result, outDir);
  if (result.isError) process.exit(1);
}
