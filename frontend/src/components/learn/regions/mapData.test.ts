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
  const { coarse, fine } = JSON.parse(raw);
  const objects: Record<string, { geometries: { properties: { name: string } }[] }> = { ...coarse.objects, ...fine.objects };
  const names = (object: string): string[] => objects[object].geometries.map((g) => g.properties.name);

  it("is a coarse topology (world, states) and a fine one (detail, near)", () => {
    expect(coarse.type).toBe("Topology");
    expect(fine.type).toBe("Topology");
    expect(Object.keys(coarse.objects).sort()).toEqual(["states", "world"]);
    expect(Object.keys(fine.objects).sort()).toEqual(["detail", "near"]);
  });

  it("quantizes the zoomed-into outlines finely enough for deep zoom", () => {
    expect(fine.transform.scale[0]).toBeLessThan(coarse.transform.scale[0] / 5);
  });

  it("has detailed outlines for the wine countries' land neighbors, and only those", () => {
    for (const name of ["Switzerland", "Austria", "Slovakia", "Mexico", "Uruguay", "Namibia"]) expect(names("near")).toContain(name);
    for (const name of WINE_COUNTRIES) expect(names("near")).not.toContain(name);
    expect(names("near")).not.toContain("Japan");
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
    expect(raw.length).toBeLessThanOrEqual(450_000);
  });
});
