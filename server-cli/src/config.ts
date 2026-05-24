export interface ServerConfig {
  serverUrl: string;
  apiKey: string;
  workDefsPath: string;
  timeoutMs: number;
}

export function getConfig(args: Record<string, string | undefined>): ServerConfig {
  return {
    serverUrl: args['server'] ?? process.env['WORKAR_SERVER_URL'] ?? 'https://workar.tarsk.io',
    apiKey: args['api-key'] ?? process.env['WORKAR_API_KEY'] ?? '',
    workDefsPath: args['defs'] ?? process.env['TARSK_WORK_DEFS'] ?? './work-defs.json',
    timeoutMs: args['timeout-ms'] ? parseInt(args['timeout-ms'], 10) : 600_000,
  };
}
