import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLeadMessages, chunk, deadTokens, isExpoToken, summarizeItems } from "../_shared/push.ts";

const lead = {
  id: "L1",
  number: 12,
  source: "website",
  name: "Ali",
  items: [{ name: "Kurka", quantity: 50 }, { name: "Tuxum", quantity: 3 }],
  total: 1500000,
  region_name: "Toshkent shahri",
};

test("push: sarlavha manba va raqam bilan, matn jamlangan", () => {
  const [m] = buildLeadMessages(lead, ["ExponentPushToken[a]"]);
  assert.equal(m.title, "Yangi buyurtma (Sayt) #12");
  assert.equal(m.body, "Ali · Kurka × 50 +1 · 1 500 000 so'm · Toshkent shahri");
  assert.deepEqual(m.data, { type: "lead", leadId: "L1" });
  assert.equal(m.channelId, "leads");
});

test("push: telegram lead, narxsiz va items bo'sh -> product_name", () => {
  const l = {
    id: "L2",
    source: "telegram",
    name: "",
    phone: "+998901112233",
    product_name: "Kurka",
    product_count: 5,
    has_unpriced: true,
    total: 0,
  };
  const [m] = buildLeadMessages(l, ["ExpoPushToken[b]"]);
  assert.equal(m.title, "Yangi buyurtma (Telegram)");
  assert.equal(m.body, "+998901112233 · Kurka × 5 · Narx kelishiladi");
  assert.equal(summarizeItems({ id: "x" }), "");
});

test("push: chunk, deadTokens, token tekshiruvi", () => {
  assert.deepEqual(chunk([1, 2, 3], 2), [[1, 2], [3]]);
  const msgs = [{ to: "a" }, { to: "b" }];
  assert.deepEqual(
    deadTokens(msgs, [{ status: "ok" }, { status: "error", details: { error: "DeviceNotRegistered" } }]),
    ["b"],
  );
  assert.equal(isExpoToken("ExponentPushToken[abc]"), true);
  assert.equal(isExpoToken("fcm-token"), false);
});
