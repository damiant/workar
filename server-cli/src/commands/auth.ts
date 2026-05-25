import { createInterface } from 'node:readline';
import { readSavedConfig, writeSavedConfig } from '../config.js';
import { ServerApi } from '../api.js';

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function cmdAuth(args: { email?: string; server?: string }): Promise<void> {
  const saved = await readSavedConfig();
  const serverUrl = args.server ?? process.env['WORKAR_SERVER_URL'] ?? 'https://workar.tarsk.io';

  const email = args.email ?? (await prompt('Email address: '));
  if (!email) {
    console.error('Error: email address is required');
    process.exit(1);
  }

  const api = new ServerApi(serverUrl, '', false);

  console.log(`Sending login code to ${email}...`);
  await api.requestEmailAuth(email);
  console.log('Check your email for a 6-digit code.');

  const code = await prompt('Enter code: ');
  if (!code) {
    console.error('Error: code is required');
    process.exit(1);
  }

  const result = await api.verifyEmailCode(code);
  await writeSavedConfig({ ...saved, jwt: result.jwt, email });
  console.log('Authenticated successfully');
}
