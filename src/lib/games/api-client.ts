import type { ApiError } from "@/lib/http";
import type { Game, GameInput, GameUpdate } from "./schema";

/** Error thrown by the client when the REST API returns a non-2xx response. */
export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fieldErrors: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  if (response.status === 204) return undefined as T;

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (body as ApiError | null)?.error;
    throw new ApiRequestError(
      error?.message ?? `Request failed (${response.status})`,
      response.status,
      error?.fieldErrors,
    );
  }
  return (body as { data: T }).data;
}

/** Typed client for the `/api/games` REST endpoints (used by the dashboard UI). */
export const gamesApi = {
  create: (input: GameInput) =>
    request<Game>("/api/games", { method: "POST", body: JSON.stringify(input) }),
  update: (id: number, patch: GameUpdate) =>
    request<Game>(`/api/games/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  remove: (id: number) =>
    request<void>(`/api/games/${id}`, { method: "DELETE" }),
};
