import { findCustomerByPhone } from "../customers";

const c = (id: string, phone: string) =>
  ({ id, name: id, phone, region_name: "", user_id: "", tag_ids: [], note: "", rates: 0, order_ids: [] });

describe("findCustomerByPhone", () => {
  const list = [c("a", "901234567"), c("b", "+998 91 111 22 33")];

  it("raqam turli ko'rinishda yozilsa ham topadi", () => {
    expect(findCustomerByPhone(list, "+998 90 123 45 67")?.id).toBe("a");
    expect(findCustomerByPhone(list, "998911112233")?.id).toBe("b");
  });

  it("topilmasa yoki raqam to'liq bo'lmasa undefined", () => {
    expect(findCustomerByPhone(list, "909999999")).toBeUndefined();
    expect(findCustomerByPhone(list, "12345")).toBeUndefined();
    expect(findCustomerByPhone(list, "")).toBeUndefined();
  });
});
