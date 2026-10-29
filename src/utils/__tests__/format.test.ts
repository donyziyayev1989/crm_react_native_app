import {
  formatDateLabel,
  formatMoney,
  formatSum,
  formatTime,
  parseNum,
} from "../format";

describe("formatMoney / formatSum", () => {
  it("groups thousands with spaces", () => {
    expect(formatMoney(1234567)).toBe("1 234 567");
    expect(formatMoney("12 000")).toBe("12 000");
  });
  it("formatSum appends the currency", () => {
    expect(formatSum(12000)).toBe("12 000 so'm");
    expect(formatSum(undefined)).toBe("0 so'm");
  });
});

describe("parseNum", () => {
  it("accepts numbers and spaced strings", () => {
    expect(parseNum(5)).toBe(5);
    expect(parseNum("12 000")).toBe(12000);
    expect(parseNum("abc")).toBe(0);
    expect(parseNum(null)).toBe(0);
    expect(parseNum(NaN)).toBe(0);
  });
});

describe("formatTime", () => {
  it("renders HH:mm with zero padding", () => {
    expect(formatTime(new Date(2026, 0, 1, 9, 5))).toBe("09:05");
    expect(formatTime("")).toBe("");
    expect(formatTime("not a date")).toBe("");
  });
});

describe("formatDateLabel", () => {
  const now = new Date(2026, 9, 13, 12, 0); // 13 oktabr 2026
  it("says Bugun and Kecha", () => {
    expect(formatDateLabel(new Date(2026, 9, 13, 1).toISOString(), now)).toBe("Bugun");
    expect(formatDateLabel(new Date(2026, 9, 12, 23).toISOString(), now)).toBe("Kecha");
  });
  it("omits the year inside the current year", () => {
    expect(formatDateLabel(new Date(2026, 2, 5).toISOString(), now)).toBe("5 mart");
  });
  it("includes the year for other years", () => {
    expect(formatDateLabel(new Date(2025, 11, 31).toISOString(), now)).toBe("31 dekabr 2025");
  });
});

describe("formatDateLabel with bad input", () => {
  it("returns empty string for invalid or empty dates", () => {
    expect(formatDateLabel("")).toBe("");
    expect(formatDateLabel("not a date")).toBe("");
  });
});
