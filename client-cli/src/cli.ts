#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { cmdAuth } from './commands/auth.js';
import { cmdSubmit } from './commands/submit.js';
import { cmdGet } from './commands/get.js';
import { readConfig } from './config.js';

const [subcommand, ...restArgs] = process.argv.slice(2);

// Auto-authenticate if no saved credentials and not already running auth
if (subcommand !== 'auth') {
  const config = await readConfig();
  if (!config.jwt && !config.apiKey) {
    await cmdAuth({});
  }
}

switch (subcommand) {
  case 'auth': {
    const { values } = parseArgs({
      args: restArgs,
      options: {
        email: { type: 'string' },
        server: { type: 'string' },
      },
    });
    await cmdAuth(values as { email?: string; server?: string });
    break;
  }

  case 'submit': {
    // Extract known options; convert any unknown --key [value] into key=value positionals
    const knownSubmitFlags = new Set(['type', 'wait', 'out-dir', 'server', 'api-key']);
    const submitArgs: string[] = [];
    const extraPositionals: string[] = [];
    for (let i = 0; i < restArgs.length; i++) {
      const arg = restArgs[i];
      if (arg.startsWith('--')) {
        const name = arg.slice(2).split('=')[0];
        if (knownSubmitFlags.has(name)) {
          submitArgs.push(arg);
        } else if (arg.includes('=')) {
          extraPositionals.push(arg.slice(2)); // --key=value → key=value
        } else if (i + 1 < restArgs.length && !restArgs[i + 1].startsWith('--')) {
          extraPositionals.push(`${name}=${restArgs[++i]}`); // --key value → key=value
        }
      } else {
        submitArgs.push(arg);
      }
    }
    const { values, positionals } = parseArgs({
      args: submitArgs,
      options: {
        type: { type: 'string' },
        wait: { type: 'boolean', default: false },
        'out-dir': { type: 'string' },
        server: { type: 'string' },
        'api-key': { type: 'string' },
      },
      allowPositionals: true,
    });
    await cmdSubmit({
      ...(values as {
        type?: string;
        wait?: boolean;
        'out-dir'?: string;
        server?: string;
        'api-key'?: string;
      }),
      positionals: [...positionals, ...extraPositionals],
    });
    break;
  }

  case 'get': {
    const { values } = parseArgs({
      args: restArgs,
      options: {
        'work-id': { type: 'string' },
        wait: { type: 'boolean', default: false },
        'out-dir': { type: 'string' },
        server: { type: 'string' },
        'api-key': { type: 'string' },
      },
    });
    await cmdGet(
      values as {
        'work-id'?: string;
        wait?: boolean;
        'out-dir'?: string;
        server?: string;
        'api-key'?: string;
      },
    );
    break;
  }

  default: {
    if (subcommand) {
      console.error(`Unknown subcommand: ${subcommand}`);
      console.error('Usage: workar <auth|submit|get> [options]');
      process.exit(1);
    }
    // No subcommand — auth already ran above if needed, nothing else to do
    break;
  }
}
