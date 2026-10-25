import type { ErrorResponse, Page, Single } from "./api-contracts";
import { getAccessToken } from "./supabase/client";
import { apiErrorMessage } from "./api-error-messages";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export type ApiOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  idempotencyKey?: string;
  signal?: AbortSignal;
};

function apiUrl(path: string): string {
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("\\") ||
    path.includes("..")
  ) {
    throw new Error("Invalid API path");
  }
  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
  if (!base) throw new Error("Dono is unavailable. Try again later.");
  const root = base.endsWith("/api/v1") ? base : `${base}/api/v1`;
  return `${root}${path.replace(/^\/api\/v1(?=\/)/, "")}`;
}

async function request(
  path: string,
  options: ApiOptions = {},
  publicRead = false,
): Promise<Response> {
  const url = apiUrl(path);
  const token = publicRead ? null : await getAccessToken();
  if (!publicRead && !token)
    throw new ApiError(401, "unauthenticated", "Sign in to continue.");
  const method = options.method ?? "GET";
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const multipart = options.body instanceof FormData;
  if (options.body !== undefined && !multipart)
    headers.set("Content-Type", "application/json");
  if (method !== "GET")
    headers.set(
      "Idempotency-Key",
      options.idempotencyKey ?? crypto.randomUUID(),
    );
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      signal: options.signal,
      cache: "no-store",
      credentials: "omit",
      body:
        options.body === undefined
          ? undefined
          : multipart
            ? (options.body as FormData)
            : JSON.stringify(options.body),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError(
      0,
      "network_error",
      method === "GET"
        ? "Cannot reach Dono. Check your connection and try again."
        : "The connection was lost. Check whether the action completed before trying again.",
    );
  }
  if (!response.ok) {
    const payload = (await response
      .json()
      .catch(() => null)) as ErrorResponse | null;
    const code = payload?.error?.code ?? "request_failed";
    const message = apiErrorMessage(code, response.status);
    throw new ApiError(
      response.status,
      code,
      message,
      payload?.error?.request_id,
    );
  }
  return response;
}

export async function api<T>(path: string, options?: ApiOptions): Promise<T> {
  const response = await request(path, options);
  const payload = (await response.json()) as Single<T>;
  return payload.data;
}
export async function apiPage<T>(
  path: string,
  options?: ApiOptions,
): Promise<Page<T>> {
  return (await request(path, options)).json() as Promise<Page<T>>;
}
export async function apiBlob(
  path: string,
  options?: ApiOptions,
): Promise<Blob> {
  return (await request(path, options)).blob();
}

/** Public discovery never depends on an Auth session or its configuration. */
export async function publicNeedsPage<T>(
  query: string,
  signal?: AbortSignal,
): Promise<Page<T>> {
  return (
    await request(`/public/needs?${query}`, { signal }, true)
  ).json() as Promise<Page<T>>;
}
