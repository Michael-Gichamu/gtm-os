/**
 * Browser-side API client. Talks to /api/proxy/* on the same origin —
 * never to Express directly. The proxy route handler signs the JWT
 * server-side so the shared secret stays out of the browser bundle.
 */
export class ClientApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body: unknown,
  ) {
    super(message);
  }
}

interface ClientOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  searchParams?: Record<string, string | number | undefined>;
}

export async function api<T>(path: string, opts: ClientOptions = {}): Promise<T> {
  const url = new URL(`/api/proxy${path}`, window.location.origin);
  if (opts.searchParams) {
    for (const [k, v] of Object.entries(opts.searchParams)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString(), {
    method: opts.method ?? "GET",
    headers: { "content-type": "application/json" },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const json = text ? safeJsonParse(text) : null;

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    if (json && typeof json === "object" && "error" in json) {
      const err = (json as { error?: { message?: string } }).error;
      if (err?.message) message = err.message;
    }
    throw new ClientApiError(res.status, message, json);
  }
  return json as T;
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
