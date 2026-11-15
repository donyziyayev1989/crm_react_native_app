import { applyOps, PendingOp } from "../overlay";
import { evaluateRows, matchesConstraints, orderBy, limit, where } from "../query";

const op = (o: Partial<PendingOp> & Pick<PendingOp, "kind" | "id">): PendingOp => ({
  opId: o.id + o.kind,
  coll: "crm.orders",
  ts: Date.parse("2026-01-01T00:00:00Z"),
  ...o,
});

describe("matchesConstraints / evaluateRows", () => {
  const rows = [
    { id: "a", lotId: "L1", name: "Ali", n: 3, tags: ["x"] },
    { id: "b", lotId: "L2", name: "alisher", n: 1, tags: [] },
    { id: "c", lotId: "L1", name: "Vali", n: 2, tags: ["x", "y"] },
  ];

  it("== (camelCase maydon ham, snake_case ham)", () => {
    expect(evaluateRows(rows, [where("lotId", "==", "L1")]).map((r) => r.id)).toEqual(["a", "c"]);
    expect(matchesConstraints(rows[0], [where("lot_id", "==", "L1")])).toBe(true);
  });

  it("in, array-contains, != va solishtirish", () => {
    expect(evaluateRows(rows, [where("id", "in", ["a", "c"])]).length).toBe(2);
    expect(evaluateRows(rows, [where("tags", "array-contains", "y")]).map((r) => r.id)).toEqual(["c"]);
    expect(evaluateRows(rows, [where("lotId", "!=", "L1")]).map((r) => r.id)).toEqual(["b"]);
    expect(evaluateRows(rows, [where("n", ">=", 2)]).map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("prefiks qidiruv registrga befarq", () => {
    const prefix = [where("name", ">=", "ali"), where("name", "<=", "ali")];
    expect(evaluateRows(rows, prefix).map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("orderBy va limit", () => {
    expect(evaluateRows(rows, [orderBy("n", "desc"), limit(2)]).map((r) => r.id)).toEqual(["a", "c"]);
  });
});

describe("applyOps", () => {
  const rows = [
    { id: "a", name: "A", n: 1 },
    { id: "b", name: "B", n: 2 },
  ];

  it("op yo'q bo'lsa qatorlar o'zgarmaydi", () => {
    expect(applyOps(rows, [])).toBe(rows);
  });

  it("create / update / delete / set", () => {
    const out = applyOps(rows, [
      op({ kind: "create", id: "c", data: { name: "C", n: 3 } }),
      op({ kind: "update", id: "a", data: { n: 10 } }),
      op({ kind: "delete", id: "b" }),
      op({ kind: "set", id: "d", data: { name: "D" } }),
    ] as PendingOp[]);
    expect(out.map((r) => r.id)).toEqual(["a", "c", "d"]);
    expect(out.find((r) => r.id === "a")).toMatchObject({ name: "A", n: 10 });
    expect(out.find((r) => r.id === "c")).toMatchObject({ name: "C", createdAt: "2026-01-01T00:00:00.000Z" });
  });

  it("yo'q hujjatni update qilish e'tiborsiz", () => {
    expect(applyOps(rows, [op({ kind: "update", id: "zzz", data: { n: 1 } })])).toEqual(rows);
  });

  it("create keyin delete — hujjat ko'rinmaydi", () => {
    const out = applyOps(rows, [
      op({ kind: "create", id: "c", data: { name: "C" } }),
      op({ kind: "delete", id: "c" }),
    ]);
    expect(out).toEqual(rows);
  });

  it("constraints: faqat tegilgan hujjatlar qayta tekshiriladi, tartib va limit qo'llanadi", () => {
    const L = [
      { id: "a", lotId: "L1", n: 1 },
      { id: "b", lotId: "L1", n: 2 },
    ];
    const cons = [where("lotId", "==", "L1"), orderBy("n", "desc"), limit(2)];
    const out = applyOps(
      L,
      [
        op({ kind: "create", id: "c", data: { lotId: "L1", n: 5 } }), // mos
        op({ kind: "create", id: "d", data: { lotId: "L2", n: 9 } }), // mos emas
      ],
      cons,
    );
    expect(out.map((r) => r.id)).toEqual(["c", "b"]);
  });

  it("filtrdan chiqib ketgan update hujjatni yashiradi", () => {
    const L = [{ id: "a", lotId: "L1" }];
    const out = applyOps(L, [op({ kind: "update", id: "a", data: { lotId: "L2" } })], [where("lotId", "==", "L1")]);
    expect(out).toEqual([]);
  });
});
