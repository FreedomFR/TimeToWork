/**
 * Extracts the human-readable message from a failed API call.
 * The backend answers `{ error: "<message>" }` for business errors (409, 401…);
 * anything else (network failure, validation object) falls back to `fallback`.
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { error?: unknown } } })?.response?.data?.error;
  return typeof message === "string" && message ? message : fallback;
}
