import { retryDelay, RETRY_DELAYS } from "../retry";

describe("retryDelay", () => {
  it("returns the schedule in order, starting from attempt 0", () => {
    expect(retryDelay(0)).toBe(RETRY_DELAYS[0]);
    expect(retryDelay(1)).toBe(RETRY_DELAYS[1]);
    expect(retryDelay(RETRY_DELAYS.length - 1)).toBe(RETRY_DELAYS[RETRY_DELAYS.length - 1]);
  });

  it("grows between attempts", () => {
    for (let i = 1; i < RETRY_DELAYS.length; i++) {
      expect(RETRY_DELAYS[i]).toBeGreaterThan(RETRY_DELAYS[i - 1]);
    }
  });

  it("gives up after the schedule is exhausted", () => {
    expect(retryDelay(RETRY_DELAYS.length)).toBeNull();
    expect(retryDelay(RETRY_DELAYS.length + 5)).toBeNull();
  });

  it("treats negative attempts as the first one", () => {
    expect(retryDelay(-1)).toBe(RETRY_DELAYS[0]);
  });
});
