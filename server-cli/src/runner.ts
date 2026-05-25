/**
 * runner.ts — looks up work-def by type, tokenizes commands, and runs them.
 *
 * Security note: execFile() is called with an argv array, never via a shell
 * string. User-supplied data (prompt, model, etc.) is substituted as discrete
 * argv elements after tokenization, so injection characters in a prompt value
 * cannot influence the shell command structure.
 */

import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const execFile = promisify(execFileCb);

export interface WorkDef {
  type: string;
  /** Shell-like command strings; tokens starting with @ are substituted from work JSON. */
  commands: string[];
  contentType: string;
  /** Path to the output file (may contain @tokens). If omitted, last command stdout is used. */
  outputFile?: string;
  /** Default values applied for any @tokens absent from the work payload. */
  defaults?: Record<string, string>;
}

/**
 * Tokenizes a command string respecting single/double quotes.
 * No globbing or env-var expansion — only whitespace splitting and quote handling.
 */
function tokenize(cmdStr: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;

  for (const ch of cmdStr) {
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
    } else if (ch === ' ' && !inSingle && !inDouble) {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  if (current) tokens.push(current);
  return tokens;
}

/** Replace @key tokens in an already-tokenized argv. Throws if a key is missing. */
function substituteTokens(argv: string[], work: Record<string, unknown>): string[] {
  return argv.map((arg) =>
    arg.replace(/@([A-Za-z0-9_]+)/g, (_, key: string) => {
      if (!(key in work)) throw new Error(`Missing work field for token @${key}`);
      return String(work[key]);
    }),
  );
}

/** Substitute @tokens in a single string (used for outputFile). */
function substituteString(template: string, work: Record<string, unknown>): string {
  return template.replace(/@([A-Za-z0-9_]+)/g, (_, key: string) => {
    if (!(key in work)) throw new Error(`Missing work field for token @${key}`);
    return String(work[key]);
  });
}

export class Runner {
  constructor(private readonly defs: WorkDef[]) {}

  async run(
    work: Record<string, unknown>,
    timeoutMs: number,
  ): Promise<{ contentType: string; bytes: Buffer }> {
    const def = this.defs.find((d) => d.type === work['type']);
    if (!def) throw new Error(`Unknown work type: ${work['type']}`);

    const now = new Date();
    const pad = (n: number, len = 2) => String(n).padStart(len, '0');
    const timestamp =
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
      `-${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}` +
      `-${pad(Math.floor(Math.random() * 1000), 3)}`;

    const resolvedWork = { ...def.defaults, ...work, timestamp };

    let lastStdout = '';
    for (const cmdStr of def.commands) {
      const rawArgv = tokenize(cmdStr);
      const argv = substituteTokens(rawArgv, resolvedWork);
      // execFile + array args prevents shell injection from user-supplied values.
      const { stdout } = await execFile(argv[0], argv.slice(1), {
        timeout: timeoutMs,
        maxBuffer: 100 * 1024 * 1024, // 100 MB
      });
      lastStdout = stdout;
    }

    if (def.outputFile) {
      const outputPath = substituteString(def.outputFile, resolvedWork);
      if (!existsSync(outputPath)) {
        throw new Error(`Output file not found: ${outputPath}`);
      }
      const bytes = await readFile(outputPath);
      await unlink(outputPath);
      // Delete any work- prefixed intermediate file the sd binary may have left behind
      const workFile = path.join(path.dirname(outputPath), 'work-' + path.basename(outputPath));
      await unlink(workFile).catch(() => {});
      return { contentType: def.contentType, bytes };
    }

    return { contentType: def.contentType, bytes: Buffer.from(lastStdout) };
  }
}
