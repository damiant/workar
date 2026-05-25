import type { Client } from '@libsql/client';
import type { Env } from '../env.js';
import {
  insertVerification,
  findVerification,
  deleteVerification,
  upsertUserByEmail,
  getOrCreateJwtSigningKey,
} from '../db.js';
import { signJwt } from '../jwt.js';
import { checkRateLimit } from '../rate-limit.js';
import { jsonResponse } from '../response.js';

const EMAIL_RE =
  /^[^\s@<>()\[\]\\,;:"]+@[a-zA-Z0-9\-]+(\.[a-zA-Z0-9\-]+)*\.[a-zA-Z]{2,}$/;

function generateOtp(): string {
  const n = Math.floor(Math.random() * 1_000_000);
  return n.toString().padStart(6, '0');
}

async function sendOtpEmail(
  token: string,
  fromEmail: string,
  toEmail: string,
  code: string,
  apiUrl?: string,
): Promise<void> {
  const body = {
    from: { address: fromEmail, name: 'Tarsk Work' },
    to: [{ email_address: { address: toEmail, name: 'User' } }],
    subject: 'Workar Login Code',
    htmlbody: `<p>Your login code is: <strong style="font-size:1.5em;letter-spacing:0.1em">${code}</strong></p><p>This code expires in 15 minutes. Do not share it.</p>`,
  };

  const apiHost = apiUrl || 'https://api.zeptomail.com/v1.1/email';
  const res = await fetch(apiHost, {
    method: 'POST',
    headers: {
      Authorization: token.startsWith('Zoho-enczapikey ')
        ? token
        : `Zoho-enczapikey ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let detail = text.trim();
    try {
      const json = JSON.parse(text) as Record<string, unknown>;
      detail = JSON.stringify(json);
    } catch { /* keep raw text */ }
    const region = res.headers.get('x-zcsrver') ?? res.headers.get('server') ?? 'unknown';
    console.error(`ZeptoMail ${res.status} region=${region} from=${fromEmail} to=${toEmail}: ${detail}`);
    throw new Error(`ZeptoMail error ${res.status}: ${detail}`);
  }
}

/** POST /api/auth/request — send a 6-digit OTP to the given email address */
export async function handleAuthRequest(
  request: Request,
  db: Client,
  env: Env,
): Promise<Response> {
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  if (!checkRateLimit('/api/auth/request', ip, 5)) {
    return jsonResponse({ error: 'rate limit exceeded' }, 429);
  }

  let body: { email?: unknown };
  try {
    body = (await request.json()) as { email?: unknown };
  } catch {
    return jsonResponse({ error: 'invalid JSON' }, 400);
  }

  const email = typeof body.email === 'string' ? body.email.toLowerCase().trim() : '';
  if (!email || !EMAIL_RE.test(email)) {
    return jsonResponse({ error: 'valid email address required' }, 400);
  }

  const code = generateOtp();
  await insertVerification(db, email, code);

  if (!env.ZEPTOMAIL_TOKEN) {
    // Local dev: log code to console instead of emailing
    console.log(`[dev] OTP for ${email}: ${code}`);
  } else {
    const fromEmail = env.FROM_EMAIL || 'noreply@tarsk.io';
    await sendOtpEmail(env.ZEPTOMAIL_TOKEN, fromEmail, email, code, env.ZEPTOMAIL_API_URL);
  }

  return jsonResponse({ ok: true });
}

/** POST /api/auth/verify — exchange OTP code for a JWT */
export async function handleAuthVerify(
  request: Request,
  db: Client,
  env: Env,
): Promise<Response> {
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  if (!checkRateLimit('/api/auth/verify', ip, 10)) {
    return jsonResponse({ error: 'rate limit exceeded' }, 429);
  }

  let body: { code?: unknown };
  try {
    body = (await request.json()) as { code?: unknown };
  } catch {
    return jsonResponse({ error: 'invalid JSON' }, 400);
  }

  const code = typeof body.code === 'string' ? body.code.trim() : '';
  if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
    return jsonResponse({ error: 'code must be a 6-digit number' }, 400);
  }

  const row = await findVerification(db, code);
  if (!row) {
    return jsonResponse({ error: 'invalid or expired code' }, 401);
  }

  const email = row.email as string;
  await deleteVerification(db, code);
  await upsertUserByEmail(db, email);

  const signingKey = await getOrCreateJwtSigningKey(db);
  const jwt = await signJwt(
    { sub: email, email, iat: Math.floor(Date.now() / 1000) },
    signingKey,
  );

  return jsonResponse({ jwt });
}
