import { isNetworkError } from "../network";

describe("isNetworkError", () => {
  it("fetch istisnolari tarmoq xatosi", () => {
    expect(isNetworkError({ message: "TypeError: Network request failed", code: "" })).toBe(true);
    expect(isNetworkError({ message: "TypeError: Failed to fetch", code: "" })).toBe(true);
    expect(isNetworkError({ message: "AbortError: Aborted", code: "" })).toBe(true);
    expect(isNetworkError(new TypeError("Network request failed"))).toBe(true);
  });

  it("Postgres/PostgREST xatolari (code bilan) tarmoq xatosi emas", () => {
    expect(isNetworkError({ message: "duplicate key", code: "23505" })).toBe(false);
    expect(isNetworkError({ message: "permission denied", code: "42501" })).toBe(false);
    expect(isNetworkError({ message: "network", code: "PGRST000" })).toBe(false);
  });

  it("bo'sh va begona qiymatlar", () => {
    expect(isNetworkError(null)).toBe(false);
    expect(isNetworkError("Network request failed")).toBe(false);
    expect(isNetworkError({ message: "boshqa xato" })).toBe(false);
  });
});
