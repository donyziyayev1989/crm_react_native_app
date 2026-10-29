import { lostPercent } from "../lots";

describe("lostPercent", () => {
  it("returns one-decimal percentage", () => {
    expect(lostPercent({ product_count: 200, lost_products: 15 })).toBe("7.5");
  });
  it("treats missing lost_products as 0", () => {
    expect(
      lostPercent({ product_count: 10, lost_products: undefined as unknown as number }),
    ).toBe("0.0");
  });
  it("returns 0 when product_count is missing or zero", () => {
    expect(lostPercent({ product_count: 0, lost_products: 3 })).toBe("0");
    expect(lostPercent(null)).toBe("0");
  });
});
