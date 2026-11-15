import { notificationRoute } from "../notification_route";

describe("notificationRoute", () => {
  it("lead bildirishnomasi lead ekraniga olib boradi", () => {
    expect(notificationRoute({ type: "lead", leadId: "abc-123" })).toBe("/(tabs)/leads/abc-123");
  });
  it("noma'lum yoki xavfli ma'lumot e'tiborsiz", () => {
    expect(notificationRoute(null)).toBeNull();
    expect(notificationRoute({ type: "other", leadId: "x" })).toBeNull();
    expect(notificationRoute({ type: "lead", leadId: "../x" })).toBeNull();
    expect(notificationRoute({ type: "lead" })).toBeNull();
  });
});
