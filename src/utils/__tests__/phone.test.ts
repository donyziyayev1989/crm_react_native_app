import {
  digitsOnly,
  formatPhone,
  localInputPart,
  last9,
  phoneVariants,
  phonesMatch,
  toLocal9,
} from "../phone";

describe("digitsOnly", () => {
  it("strips everything but digits", () => {
    expect(digitsOnly("+998 (90) 123-45-67")).toBe("998901234567");
    expect(digitsOnly(undefined)).toBe("");
  });
});

describe("toLocal9", () => {
  it("drops the 998 country code only when more than 9 digits remain", () => {
    expect(toLocal9("+998 90 123 45 67")).toBe("901234567");
    expect(toLocal9("901234567")).toBe("901234567");
    // 99 is a real operator prefix: a 9-digit number starting with 998 must stay intact
    expect(toLocal9("998123456")).toBe("998123456");
    expect(toLocal9("998998123456")).toBe("998123456");
  });
  it("keeps the last 9 digits of anything longer", () => {
    expect(toLocal9("00998901234567")).toBe("901234567");
  });
});

describe("last9 / phonesMatch", () => {
  it("matches numbers that differ only by formatting or country code", () => {
    expect(last9("+998 90 123 45 67")).toBe("901234567");
    expect(phonesMatch("+998 90 123 45 67", "901234567")).toBe(true);
    expect(phonesMatch("998901234567", "998901234568")).toBe(false);
  });
  it("never matches short inputs", () => {
    expect(phonesMatch("12345", "12345")).toBe(false);
  });
});

describe("phoneVariants", () => {
  it("returns all stored spellings for a 9-digit local number", () => {
    expect(phoneVariants("901234567").sort()).toEqual(
      ["901234567", "998901234567", "+998 901234567"].sort(),
    );
  });
  it("returns all stored spellings for a 12-digit number", () => {
    expect(phoneVariants("+998 90 123 45 67").sort()).toEqual(
      ["998901234567", "901234567", "+998 901234567"].sort(),
    );
  });
  it("returns just the digits for other lengths", () => {
    expect(phoneVariants("1234567")).toEqual(["1234567"]);
    expect(phoneVariants("")).toEqual([]);
  });
});

describe("formatPhone", () => {
  it("formats 12 and 9 digit numbers", () => {
    expect(formatPhone("998901234567")).toBe("+998 90 123 45 67");
    expect(formatPhone("901234567")).toBe("+998 90 123 45 67");
  });
  it("falls back to +digits for other lengths", () => {
    expect(formatPhone("12345")).toBe("+12345");
    expect(formatPhone(undefined)).toBe("");
  });
});

describe("localInputPart", () => {
  it("returns what the user typed after the +998 prefix, even when partial", () => {
    expect(localInputPart("+998 1")).toBe("1");
    expect(localInputPart("+998 12")).toBe("12");
    expect(localInputPart("+998 901")).toBe("901");
    expect(localInputPart("+998 99812")).toBe("99812");
  });
  it("handles formatted and legacy values", () => {
    expect(localInputPart("+998 90 123 45 67")).toBe("901234567");
    expect(localInputPart("901234567")).toBe("901234567");
    expect(localInputPart("+998901234567")).toBe("901234567");
    expect(localInputPart("")).toBe("");
    expect(localInputPart(undefined)).toBe("");
  });
});
