#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { cmdAuth } from './commands/auth.js';
import { cmdSubmit } from './commands/submit.js';
import { cmdGet } from './commands/get.js';

const [subcommand, ...restArgs] = process.argv.slice(2);

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
    const { values, positionals } = parseArgs({
      args: restArgs,
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
      positionals,
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
    console.error(`Unknown subcommand: ${subcommand ?? '(none)'}`);
    console.error('Usage: workar <auth|submit|get> [options]');
    process.exit(1);
  }
}
