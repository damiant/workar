export interface DequeResult {
  ok: boolean;
  work?: Record<string, unknown>;
}

export class ServerApi {
  private readonly authHeader: Record<string, string>;

  constructor(
    private readonly serverUrl: string,
    apiKey: string,
  ) {
    this.authHeader = { 'x-api-key': apiKey };
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
