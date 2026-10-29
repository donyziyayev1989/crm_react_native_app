import { findCustomerMatches, leadItems, sourceLabel } from "../leads";

const baseLead = {
  name: "Mijoz",
  phone: "+998901234567",
  telegram_id: "1",
  product_count: 0,
  date: "2026-10-01",
  state: "new" as const,
};

const customer = (id: string, name: string, phone: string) => ({
  id,
  name,
  phone,
  region_name: "Toshkent",
  user_id: "",
  tag_ids: [],
  note: "",
  rates: 0,
  order_ids: [],
});

describe("leadItems", () => {
  it("eski Telegram leadni product_* maydonlaridan bitta itemga aylantiradi", () => {
    expect(
      leadItems({
        ...baseLead,
        source: "telegram",
        product_id: "p1",
        product_name: "X",
        product_count: 2,
      }),
    ).toEqual([{ product_id: "p1", name: "X", price: null, quantity: 2 }]);
  });

  it("items bor bo'lsa uni qaytaradi", () => {
    const items = [
      { product_id: "a", name: "A", price: 1000, quantity: 1 },
      { product_id: "b", name: "B", price: null, quantity: 3 },
    ];
    expect(
      leadItems({ ...baseLead, source: "website", items, product_id: "p1", product_count: 9 }),
    ).toEqual(items);
  });

  it("items bo'sh va product_id yo'q bo'lsa bo'sh ro'yxat", () => {
    expect(leadItems({ ...baseLead, source: "manual", items: [] })).toEqual([]);
  });
});

describe("sourceLabel", () => {
  it("manbalarni o'zbekcha nomlaydi", () => {
    expect(sourceLabel("website")).toBe("Sayt");
    expect(sourceLabel("telegram")).toBe("Telegram");
    expect(sourceLabel("manual")).toBe("Qo'lda");
  });

  it("source yo'q eski qatorlar Telegram deb ko'rsatiladi", () => {
    expect(sourceLabel(undefined)).toBe("Telegram");
  });
});

describe("findCustomerMatches", () => {
  const customers = [
    customer("1", "Ali Valiyev", "+998901234567"),
    customer("2", "Vali Aliyev", "998935554433"),
    customer("3", "Sardor", "901112233"),
  ];

  it("telefon bo'yicha (bo'shliqli mahalliy yozuv) topadi", () => {
    expect(findCustomerMatches(customers, "90 123 45 67").map((c) => c.id)).toEqual(["1"]);
  });

  it("ism qismi bo'yicha, katta-kichik harfsiz topadi", () => {
    expect(findCustomerMatches(customers, "ali").map((c) => c.id)).toEqual(["1", "2"]);
    expect(findCustomerMatches(customers, "VALIYEV").map((c) => c.id)).toEqual(["1"]);
  });

  it("bo'sh yoki faqat bo'shliqli so'rovda bo'sh ro'yxat", () => {
    expect(findCustomerMatches(customers, "")).toEqual([]);
    expect(findCustomerMatches(customers, "   ")).toEqual([]);
  });

  it("qisqa raqamlar telefon bo'yicha qidirilmaydi", () => {
    expect(findCustomerMatches(customers, "90")).toEqual([]);
  });
});
