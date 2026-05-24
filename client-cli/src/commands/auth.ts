import { readConfig, writeConfig, getServerUrl } from '../config.js';
import { ClientApi } from '../api.js';

export async function cmdAuth(args: {
  username?: string;
  'api-key'?: string;
  server?: string;
}): Promise<void> {
  const config = await readConfig();
  const serverUrl = getServerUrl(config, args);
  const username = args.username ?? config.username;
  const apiKey = args['api-key'] ?? config.apiKey;

  if (!username) {
    console.error('Error: --username is required (or run `tarsk register` first)');
    process.exit(1);
  }
  if (!apiKey) {
    console.error('Error: --api-key is required (or run `tarsk register` first)');
    process.exit(1);
  }

  const api = new ClientApi(serverUrl, {});
  const result = await api.auth(username, apiKey);
  await writeConfig({ ...config, jwt: result.jwt });
  console.log('Authenticated successfully');
}
