const API_KEY_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** Generate a 255-character alphanumeric API key. */
export function generateApiKey(): string {
  const bytes = new Uint8Array(255);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => API_KEY_CHARS[b % 62]).join('');
}

/** Generate a work ID in format yyyy-mm-dd-hh-mm-ss-rnd (rnd = 3 random digits). */
export function generateWorkId(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
  ].join('-');
  const time = [
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('-');
  const rnd = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return `${date}-${time}-${rnd}`;
}
