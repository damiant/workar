export class ClientApi {
  constructor(
    private readonly serverUrl: string,
    private readonly authHeaders: Record<string, string>,
  ) {}

  async register(username: string): Promise<{ username: string; apiKey: string }> {
    const res = await fetch(`${this.serverUrl}/api/users`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) throw new Error((data['error'] as string) ?? `HTTP ${res.status}`);
    return data as { username: string; apiKey: string };
  }

  async auth(username: string, apiKey: string): Promise<{ jwt: string }> {
    const res = await fetch(`${this.serverUrl}/api/auth`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, apiKey }),
    });
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) throw new Error((data['error'] as string) ?? `HTTP ${res.status}`);
    return data as { jwt: string };
  }

  async requestEmailAuth(email: string): Promise<void> {
    const res = await fetch(`${this.serverUrl}/api/auth/request`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) throw new Error((data['error'] as string) ?? `HTTP ${res.status}`);
  }

  async verifyEmailCode(code: string): Promise<{ jwt: string }> {
    const res = await fetch(`${this.serverUrl}/api/auth/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) throw new Error((data['error'] as string) ?? `HTTP ${res.status}`);
    return data as { jwt: string };
  }

  async submitWork(body: Record<string, unknown>): Promise<{ workId: string }> {
    const res = await fetch(`${this.serverUrl}/api/work`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...this.authHeaders },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) throw new Error((data['error'] as string) ?? `HTTP ${res.status}`);
    return data as { workId: string };
  }

  async getWork(
    poll: boolean,
    workId?: string,
  ): Promise<{
    workId: string;
    contentType: string;
    bytes: Uint8Array;
    isError: boolean;
  }> {
    const params = new URLSearchParams();
    if (workId) params.set('workId', workId);
    const qs = params.toString();
    const url = `${this.serverUrl}/api/work${qs ? `?${qs}` : ''}`;

    const maxWaitMs = 30 * 60 * 1000; // 30 minutes
    const retryIntervalMs = 10 * 1000; // 10 seconds between retries
    const startTime = Date.now();
    let attempt = 0;

    while (true) {
      attempt++;
      const res = await fetch(url, { headers: this.authHeaders });

      if (res.status === 404) {
        if (!poll || Date.now() - startTime >= maxWaitMs) {
          throw new Error('No work result available (404)');
        }
        if (attempt === 1) process.stdout.write('Waiting for result');
        process.stdout.write('.');
        await new Promise<void>((resolve) => setTimeout(resolve, retryIntervalMs));
        continue;
      }

      if (attempt > 1) process.stdout.write('\n');

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        throw new Error((data['error'] as string) ?? `HTTP ${res.status}`);
      }

      const isError = res.headers.get('x-work-error') === '1';
      const retWorkId = res.headers.get('x-work-id') ?? '';
      const contentType = res.headers.get('content-type') ?? 'application/octet-stream';
      const bytes = new Uint8Array(await res.arrayBuffer());
      return { workId: retWorkId, contentType, bytes, isError };
    }
  }
}
