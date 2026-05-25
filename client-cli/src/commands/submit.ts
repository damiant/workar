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
    console.log(`Usage: workar submit --type <work-type> [key=value ...] [options]

Required:
  --type <work-type>    Type of work to submit (e.g. image-gen)

Positional key=value pairs (work parameters):
  prompt=<text>         Prompt describing what to generate
  model=<name>          Model to use (default: sdxl-lightning)
  Any additional key=value pairs are passed to the work type.

Options:
  --wait                Wait for the result and save it locally
  --out-dir <path>      Directory to save result (default: current directory)
  --server <url>        Override the server URL

Examples:
  workar submit --type image-gen prompt="a red fox in the snow"
  workar submit --type image-gen prompt="a red fox" model=sdxl-lightning --wait

Not yet authenticated? Run: workar auth`);
    process.exit(0);
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
