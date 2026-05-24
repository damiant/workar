import { readConfig, writeConfig, getServerUrl } from '../config.js';
import { ClientApi } from '../api.js';

export async function cmdRegister(args: {
  username?: string;
  server?: string;
}): Promise<void> {
  if (!args.username) {
    console.error('Error: --username is required');
    process.exit(1);
  }

  const config = await readConfig();
  const serverUrl = getServerUrl(config, args);
  const api = new ClientApi(serverUrl, {});
  const result = await api.register(args.username);
  await writeConfig({ ...config, serverUrl, username: result.username, apiKey: result.apiKey });
  console.log(`Registered as ${result.username}`);
  console.log(`API key: ${result.apiKey}`);
}
