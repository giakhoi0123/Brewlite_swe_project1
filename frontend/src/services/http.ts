export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await response.json().catch(() => null);
  if (response.status === 401 && typeof window !== "undefined" && path !== "/auth/login")
    window.dispatchEvent(new Event("brewlite:session-expired"));
  if (!response.ok)
    throw new ApiError(
      response.status,
      Array.isArray(body?.message)
        ? body.message.join(", ")
        : body?.message || `HTTP ${response.status}`,
    );
  return body as T;
}
