import { describe, it, expect } from "vitest";
import raw from "./mapData.json?raw";

const WINE_COUNTRIES = [
  "United States of America",
  "Italy",
  "France",
  "Germany",
  "Portugal",
  "Spain",
  "Canada",
  "Argentina",
  "Hungary",
  "Chile",
  "Australia",
  "New Zealand",
  "South Africa",
];

describe("prebuilt map data", () => {
  const topo = JSON.parse(raw);
  const names = (object: string): string[] =>
    topo.objects[object].geometries.map((g: { properties: { name: string } }) => g.properties.name);

  it("is a topology with world, detail and states objects", () => {
    expect(topo.type).toBe("Topology");
    expect(Object.keys(topo.objects).sort()).toEqual(["detail", "states", "world"]);
  });

  it("has the whole world except Antarctica", () => {
    expect(names("world").length).toBeGreaterThan(150);
    expect(names("world")).not.toContain("Antarctica");
    for (const name of WINE_COUNTRIES) expect(names("world")).toContain(name);
  });

  it("has detailed outlines for exactly the 13 wine countries", () => {
    expect(names("detail")).toEqual(WINE_COUNTRIES);
  });

  it("has the lower 48 states plus DC", () => {
    expect(names("states")).toHaveLength(49);
    expect(names("states")).not.toContain("Alaska");
    expect(names("states")).not.toContain("Hawaii");
  });

  it("stays within its size budget", () => {
    expect(raw.length).toBeLessThanOrEqual(350_000);
  });
});
