import { District, Region, WithId } from "../../interfaces";
import {
  districtsOfRegion,
  findDistrictName,
  findRegion,
  normalizeRegionName,
} from "../regions";

const regions: WithId<Region>[] = [
  { id: "toshkent_sh", name: "Toshkent sh." },
  { id: "toshkent_v", name: "Toshkent vil." },
  { id: "fargona", name: "Farg'ona" },
  { id: "andijon", name: "Andijon" },
];

const districts: WithId<District>[] = [
  { id: "d1", name: "Yunusobod", regionId: "toshkent_sh" },
  { id: "d2", name: "Chilonzor", regionId: "Toshkent shahri" }, // legacy regionId
  { id: "d3", name: "Zangiota", regionId: "toshkent_v" },
  { id: "d4", name: "Qo'qon", regionId: "Farg'ona" },
];

describe("normalizeRegionName", () => {
  it("ignores case, spaces, dots and apostrophes", () => {
    expect(normalizeRegionName("Farg'ona")).toBe("fargona");
    expect(normalizeRegionName("Fargʻona ")).toBe("fargona");
    expect(normalizeRegionName("Toshkent sh.")).toBe("toshkentsh");
    expect(normalizeRegionName(undefined)).toBe("");
  });
});

describe("findRegion", () => {
  it("finds by id, by name and by apostrophe-insensitive name", () => {
    expect(findRegion(regions, "fargona")?.id).toBe("fargona");
    expect(findRegion(regions, "Farg'ona")?.id).toBe("fargona");
    expect(findRegion(regions, "fargʻona")?.id).toBe("fargona");
    expect(findRegion(regions, "ANDIJON")?.id).toBe("andijon");
  });
  it("maps bare 'Toshkent' to the city", () => {
    expect(findRegion(regions, "Toshkent")?.id).toBe("toshkent_sh");
  });
  it("returns undefined for unknown or empty", () => {
    expect(findRegion(regions, "Mars")).toBeUndefined();
    expect(findRegion(regions, "")).toBeUndefined();
  });
});

describe("districtsOfRegion", () => {
  it("includes districts stored under legacy region ids", () => {
    expect(districtsOfRegion(districts, "toshkent_sh").map((d) => d.id)).toEqual(["d1", "d2"]);
    expect(districtsOfRegion(districts, "fargona").map((d) => d.id)).toEqual(["d4"]);
  });
  it("returns [] for null", () => {
    expect(districtsOfRegion(districts, null)).toEqual([]);
  });
});

describe("findDistrictName", () => {
  it("returns the official spelling when it matches loosely", () => {
    expect(findDistrictName(districts, "qoqon")).toBe("Qo'qon");
  });
  it("returns the input when nothing matches", () => {
    expect(findDistrictName(districts, "Nowhere")).toBe("Nowhere");
    expect(findDistrictName(districts, "")).toBe("");
  });
});
