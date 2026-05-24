// HS256 JWT implementation using the Web Crypto API.

function base64UrlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 ? '='.repeat(4 - (padded.length % 4)) : '';
  return Uint8Array.from(atob(padded + pad), (c) => c.charCodeAt(0));
}

/** Import the signing key. The secret is stored as standard base64. */
async function importKey(secret: string): Promise<CryptoKey> {
  const keyBytes = Uint8Array.from(atob(secret), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function signJwt(
  payload: Record<string, unknown>,
  secret: string,
): Promise<string> {
  const enc = new TextEncoder();
  const header = base64UrlEncode(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = base64UrlEncode(enc.encode(JSON.stringify(payload)));
  const signingInput = `${header}.${body}`;
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(signingInput));
  return `${signingInput}.${base64UrlEncode(sig)}`;
}

export async function verifyJwt(
  token: string,
  secret: string,
): Promise<{ sub: string; iat: number } | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const signingInput = `${header}.${body}`;
  const key = await importKey(secret);
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    base64UrlDecode(sig),
    new TextEncoder().encode(signingInput),
  );
  if (!valid) return null;
  return JSON.parse(new TextDecoder().decode(base64UrlDecode(body)));
}
