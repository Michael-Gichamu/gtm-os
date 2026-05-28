import { INTERNAL_JWT_HEADER } from "@gtm/shared";
import { auth } from "../auth";
import { signInternalJwt } from "./internalJwt";
import { serverEnv } from "../env";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body: unknown,
  ) {
    super(message);
  }
}

interface ApiOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  searchParams?: Record<string, string | number | undefined>;
}

/**
 * Server-side API client. Pulls the session, signs a fresh JWT, calls Express.
 *
 * Designed for server components / Route Handlers / Server Actions only.
 * The browser never imports this — see /api/proxy/[...path] for the client
 * surface area.
 */
export async function apiServerFetch<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const session = await auth();
  if (!session?.user?.id || !session.user.workspaceId) {
    throw new ApiError(401, "Not authenticated", null);
  }

  const token = signInternalJwt({
    sub: session.user.id,
    wsid: session.user.workspaceId,
    role: session.user.workspaceRole,
  });

  const url = new URL(`${serverEnv.API_BASE_URL}/v1${path}`);
  if (opts.searchParams) {
    for (const [k, v] of Object.entries(opts.searchParams)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers: {
      "content-type": "application/json",
      [INTERNAL_JWT_HEADER]: token,
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const json = text ? safeJsonParse(text) : null;

  if (!res.ok) {
    throw new ApiError(res.status, `API ${res.status} ${res.statusText}`, json);
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
