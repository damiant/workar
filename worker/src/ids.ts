const API_KEY_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const ULID_ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Generate a 255-character alphanumeric API key. */
export function generateApiKey(): string {
  const bytes = new Uint8Array(255);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => API_KEY_CHARS[b % 62]).join('');
}

/** Generate a 26-character ULID-style work ID (timestamp + random). */
export function generateWorkId(): string {
  let t = Date.now();
  const timePart = new Array<string>(10);
  for (let i = 9; i >= 0; i--) {
    timePart[i] = ULID_ENCODING[t % 32];
    t = Math.floor(t / 32);
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const randPart = Array.from(bytes, (b) => ULID_ENCODING[b % 32]);
  return (timePart.join('') + randPart.join('')).toLowerCase();
}
