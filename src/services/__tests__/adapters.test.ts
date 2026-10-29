import { faqAdapter, productAdapter, readUz, uuidv4, withUz } from "../adapters";
import { mapFields, orderBy, where, limit } from "../query";

describe("readUz / withUz", () => {
  it("uz matnini o'qiydi, eski satrni ham qabul qiladi", () => {
    expect(readUz({ uz: "Salom", ru: "Привет", en: "Hi" })).toBe("Salom");
    expect(readUz("eski")).toBe("eski");
    expect(readUz(null)).toBe("");
  });

  it("uz ni almashtiradi, ru/en ni saqlaydi; mavjud bo'lmasa bo'sh", () => {
    expect(withUz({ uz: "a", ru: "б", en: "c" }, "x")).toEqual({ uz: "x", ru: "б", en: "c" });
    expect(withUz(undefined, "x")).toEqual({ uz: "x", ru: "", en: "" });
  });
});

describe("uuidv4", () => {
  it("public.products.id tekshiruviga mos", () => {
    const id = uuidv4();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(id).toMatch(/^[a-z0-9][a-z0-9-]{0,99}$/);
  });
});

describe("productAdapter", () => {
  const a = productAdapter(() => "fixed-id");
  const row = {
    id: "p1",
    name: { uz: "Kurka", ru: "Индейка", en: "Turkey" },
    description: { uz: "Tavsif", ru: "Описание", en: "Desc" },
    summary: { uz: "s", ru: "s", en: "s" },
    price: "15000",
    published: true,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-02T00:00:00Z",
  };

  it("fromRow: uz matn, raqamli narx, active = published", () => {
    expect(a.fromRow(row)).toEqual({
      id: "p1",
      name: "Kurka",
      description: "Tavsif",
      price: 15000,
      active: true,
      createdAt: "2026-10-01T00:00:00Z",
      updatedAt: "2026-10-02T00:00:00Z",
    });
  });

  it("toRow (create): barcha majburiy ko'p tilli ustunlar, faqat uz to'ldirilgan", () => {
    expect(a.toRow({ name: "Test", price: 1500 })).toEqual({
      id: "fixed-id",
      slug: { uz: "fixed-id", ru: "fixed-id", en: "fixed-id" },
      name: { uz: "Test", ru: "", en: "" },
      description: { uz: "", ru: "", en: "" },
      summary: { uz: "Test", ru: "", en: "" },
      features: { uz: [], ru: [], en: [] },
      price: 1500,
      published: false,
    });
    expect(a.toRow({ name: "T", description: "D", price: 1, active: true })).toMatchObject({
      summary: { uz: "D", ru: "", en: "" },
      published: true,
    });
  });

  it("toRow (update): faqat berilgan maydonlar, ru/en saqlanadi, vaqtlar yuborilmaydi", () => {
    expect(
      a.toRow({ name: "Yangi", active: false, updatedAt: new Date() }, row),
    ).toEqual({
      name: { uz: "Yangi", ru: "Индейка", en: "Turkey" },
      published: false,
    });
    expect(a.toRow({ price: 2 }, {})).toEqual({ price: 2 });
  });
});

describe("productAdapter: null narx (narx kelishiladi)", () => {
  const a = productAdapter(() => "fixed-id");

  it("fromRow null narxni saqlaydi", () => {
    expect(a.fromRow({ id: "p", name: { uz: "X" }, description: {}, price: null }).price).toBeNull();
  });

  it("create: null / NaN narx null bo'lib yoziladi", () => {
    expect(a.toRow({ name: "X", price: null }).price).toBeNull();
    expect(a.toRow({ name: "X", price: NaN }).price).toBeNull();
  });

  it("update: mavjud null ustiga 0 kelsa null qoladi; boshqa narx yoziladi", () => {
    expect(a.toRow({ name: "X", price: 0 }, { name: {}, price: null })).toMatchObject({ price: null });
    expect(a.toRow({ price: 0 }, { price: 5000 })).toEqual({ price: 0 });
    expect(a.toRow({ price: 7000 }, { price: null })).toEqual({ price: 7000 });
    expect(a.toRow({ price: null }, { price: 5000 })).toEqual({ price: null });
  });
});

describe("faqAdapter", () => {
  const row = {
    id: "f1",
    question: { uz: "Savol", ru: "Вопрос", en: "Q" },
    answer: { uz: "Javob", ru: "Ответ", en: "A" },
    sort_order: 1,
    published: true,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
  };

  it("fromRow / toRow simmetrik", () => {
    expect(faqAdapter.fromRow(row)).toEqual({
      id: "f1",
      question: "Savol",
      answer: "Javob",
      createdAt: "2026-10-01T00:00:00Z",
      updatedAt: "2026-10-01T00:00:00Z",
    });
    expect(faqAdapter.toRow({ question: "q", answer: "a", createdAt: "x" })).toEqual({
      question: { uz: "q", ru: "", en: "" },
      answer: { uz: "a", ru: "", en: "" },
      published: true,
    });
    expect(faqAdapter.toRow({ question: "q2", updatedAt: "x" }, row)).toEqual({
      question: { uz: "q2", ru: "Вопрос", en: "Q" },
    });
  });
});

describe("mapFields", () => {
  it("adapter ustunlariga almashtiradi, limit va boshqalarni o'zgartirmaydi", () => {
    const cols = productAdapter().columns;
    expect(mapFields([orderBy("name"), where("active", "==", true), where("price", ">", 1), limit(5)], cols)).toEqual([
      orderBy("name->>uz"),
      where("published", "==", true),
      where("price", ">", 1),
      limit(5),
    ]);
    const cs = [orderBy("name")];
    expect(mapFields(cs, undefined)).toBe(cs);
  });
});
