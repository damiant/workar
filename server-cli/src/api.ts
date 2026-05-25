export interface DequeResult {
  ok: boolean;
  work?: Record<string, unknown>;
}

export class ServerApi {
  private readonly authHeader: Record<string, string>;

  constructor(
    private readonly serverUrl: string,
    apiKeyOrJwt: string,
    isJwt = false,
  ) {
    this.authHeader = isJwt
      ? { authorization: `Bearer ${apiKeyOrJwt}` }
      : { 'x-api-key': apiKeyOrJwt };
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

  async deque(poll = false): Promise<DequeResult> {
    const url = `${this.serverUrl}/api/deque${poll ? '?poll' : ''}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.authHeader,
    });
    if (res.status === 404) return { ok: false };
    if (!res.ok) throw new Error(`deque failed with status ${res.status}`);
    const work = (await res.json()) as Record<string, unknown>;
    return { ok: true, work };
  }

  async complete(
    workId: string,
    contentType: string,
    contentBase64: string,
    error: boolean,
  ): Promise<void> {
    const res = await fetch(`${this.serverUrl}/api/complete`, {
      method: 'POST',
      headers: { ...this.authHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ workId, contentType, contentBase64, error }),
    });
    if (!res.ok) throw new Error(`complete failed with status ${res.status}`);
  }
}
