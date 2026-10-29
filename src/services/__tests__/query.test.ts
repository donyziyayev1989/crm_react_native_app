import {
  applyConstraints,
  docToRow,
  eventAffects,
  isPlainOrdered,
  limit,
  makeComparator,
  orderBy,
  rowToDoc,
  toColumn,
  where,
} from "../query";

// Chaqiruvlarni yozib boradigan soxta quruvchi
const fakeBuilder = () => {
  const calls: any[][] = [];
  const b: any = new Proxy(
    {},
    {
      get: (_t, name: string) => (...args: any[]) => {
        calls.push([name, ...args]);
        return b;
      },
    },
  );
  return { b, calls };
};

describe("maydon nomlari", () => {
  it("camelCase → snake_case va teskarisi", () => {
    expect(toColumn("lotId")).toBe("lot_id");
    expect(toColumn("region_name")).toBe("region_name");
    expect(toColumn("__name__")).toBe("id");
    expect(rowToDoc({ lot_id: "a", created_at: "x", name: "n" })).toEqual({
      lotId: "a",
      createdAt: "x",
      name: "n",
    });
  });

  it("docToRow bo'sh user_id ni null qiladi", () => {
    expect(docToRow({ user_id: "", note: "" })).toEqual({ user_id: null, note: "" });
  });

  it("docToRow undefined va id ni tashlaydi", () => {
    expect(docToRow({ id: "1", lotId: "L", note: undefined, count: 0 })).toEqual({
      lot_id: "L",
      count: 0,
    });
  });
});

describe("applyConstraints", () => {
  it("where/orderBy/limit ni PostgREST metodlariga o'giradi", () => {
    const { b, calls } = fakeBuilder();
    applyConstraints(b, [
      where("lotId", "==", "L1"),
      where("phone", "in", ["a", "b"]),
      where("tag_ids", "array-contains", "t1"),
      orderBy("date", "desc"),
      limit(20),
    ]);
    expect(calls).toEqual([
      ["eq", "lot_id", "L1"],
      ["in", "phone", ["a", "b"]],
      ["contains", "tag_ids", ["t1"]],
      ["order", "date", { ascending: false }],
      ["limit", 20],
    ]);
  });

  it("prefiks juftligini ilike ga aylantiradi va % _ ni ekranlaydi", () => {
    const { b, calls } = fakeBuilder();
    applyConstraints(b, [
      where("name", ">=", "a_b%"),
      where("name", "<=", "a_b%"),
      where("region_name", "==", "Toshkent"),
    ]);
    expect(calls).toEqual([
      ["ilike", "name", "a\\_b\\%%"],
      ["eq", "region_name", "Toshkent"],
    ]);
  });

  it("juftlik bo'lmasa >= oddiy gte bo'lib qoladi", () => {
    const { b, calls } = fakeBuilder();
    applyConstraints(b, [where("unread_count", ">", 0), where("name", ">=", "x")]);
    expect(calls).toEqual([
      ["gt", "unread_count", 0],
      ["gte", "name", "x"],
    ]);
  });
});

describe("xotirada yordamchilar", () => {
  it("isPlainOrdered", () => {
    expect(isPlainOrdered([orderBy("name")])).toBe(true);
    expect(isPlainOrdered([])).toBe(true);
    expect(isPlainOrdered([where("a", "==", 1)])).toBe(false);
    expect(isPlainOrdered([limit(3)])).toBe(false);
  });

  it("makeComparator tartiblaydi (desc va ikkinchi kalit)", () => {
    const rows = [
      { id: "1", date: "2026-01-02", name: "b" },
      { id: "2", date: "2026-01-03", name: "a" },
      { id: "3", date: "2026-01-02", name: "a" },
    ];
    const sorted = [...rows].sort(makeComparator([orderBy("date", "desc"), orderBy("name")]));
    expect(sorted.map((r) => r.id)).toEqual(["2", "3", "1"]);
  });

  it("eventAffects faqat mos == shartlarda true", () => {
    const c = [where("lotId", "==", "L1"), orderBy("date")];
    expect(eventAffects(c, null, { lot_id: "L1" })).toBe(true);
    expect(eventAffects(c, { lot_id: "L1" }, { lot_id: "L2" })).toBe(true); // lotdan ko'chgan
    expect(eventAffects(c, { lot_id: "L2" }, { lot_id: "L3" })).toBe(false);
    expect(eventAffects([orderBy("date")], null, { lot_id: "X" })).toBe(true);
  });
});
