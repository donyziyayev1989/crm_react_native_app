/**
 * Xato tarmoq (internet yo'q / timeout) sababli bo'ldimi?
 * Postgres/PostgREST xatolari doim `code` bilan keladi (masalan "23505", "PGRST116");
 * fetch istisnolari esa `code: ""` va "TypeError: Network request failed" kabi matn bilan.
 */
export function isNetworkError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { message?: unknown; name?: unknown; code?: unknown };
  if (typeof e.code === "string" && e.code !== "") return false;
  const text = `${typeof e.name === "string" ? e.name : ""} ${typeof e.message === "string" ? e.message : ""}`;
  return /network request failed|failed to fetch|fetch failed|network ?error|timed? ?out|abort|offline|load failed/i.test(
    text,
  );
}
