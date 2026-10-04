import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRef } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import * as api from "../../../services/api";
import type { ListWinesParams } from "../../../types/wine";
import { RegionDrawer } from "./RegionDrawer";
import { clearCatalogCountCache } from "./useCatalogCount";

vi.mock("../../../services/api", async () => {
  const actual = await vi.importActual<typeof import("../../../services/api")>("../../../services/api");
  return { ...actual, listWines: vi.fn() };
});

const TOTALS: Record<string, number> = { "region:Bordeaux": 13, "region:Provence": 0, "region:California": 32, "country:France": 30 };

beforeEach(() => {
  clearCatalogCountCache();
  vi.mocked(api.listWines).mockImplementation(async (params: ListWinesParams = {}) => {
    const key = params.region ? `region:${params.region}` : `country:${params.country}`;
    return { total: TOTALS[key] ?? 1, items: [] };
  });
});

function renderDrawer(countryId: string, regionId: string | null) {
  const handlers = { onClose: vi.fn(), onSelectRegion: vi.fn(), onBackToCountry: vi.fn() };
  const headingRef = createRef<HTMLHeadingElement>();
  const ui = (country: string, region: string | null) => (
    <MemoryRouter>
      <RegionDrawer countryId={country} regionId={region} headingRef={headingRef} {...handlers} />
    </MemoryRouter>
  );
  const view = render(ui(countryId, regionId));
  return { ...handlers, headingRef, rerender: (country: string, region: string | null) => view.rerender(ui(country, region)) };
}

describe("RegionDrawer — country view", () => {
  it("shows the overview, the regions with live counts, and a country link", async () => {
    const { headingRef } = renderDrawer("france", null);
    const drawer = screen.getByRole("complementary", { name: "France details" });
    expect(within(drawer).getByRole("heading", { level: 3, name: "France" })).toBe(headingRef.current);
    expect(screen.getByText(/benchmark for much of the wine world/)).toBeInTheDocument();
    const rows = within(screen.getByRole("list")).getAllByRole("button");
    expect(rows.map((row) => row.querySelector("[data-name]")!.textContent)).toEqual([
      "Bordeaux",
      "Burgundy",
      "Champagne",
      "Rhône",
      "Loire",
      "Alsace",
      "Provence",
    ]);
    expect(await within(rows[0]).findByText("13 in catalog")).toBeInTheDocument();
    expect(within(rows[4]).getByText("—")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Explore 30 wines from France" })).toHaveAttribute("href", "/explore?country=France");
  });

  it("says wine, not wines, for a single bottle", async () => {
    renderDrawer("south-africa", null);
    expect(await screen.findByRole("link", { name: "Explore 1 wine from South Africa" })).toBeInTheDocument();
  });

  it("opens each new view scrolled to the top", () => {
    const { rerender } = renderDrawer("france", null);
    const drawer = screen.getByRole("complementary");
    Object.defineProperty(drawer, "scrollTop", { value: 175, writable: true, configurable: true });
    rerender("france", "provence");
    expect(screen.getByRole("complementary", { name: "Provence details" })).toBe(drawer);
    expect(drawer.scrollTop).toBe(0);
    drawer.scrollTop = 175;
    rerender("france", null);
    expect(drawer.scrollTop).toBe(0);
  });

  it("selects a region from the list and closes", async () => {
    const { onSelectRegion, onClose } = renderDrawer("france", null);
    await userEvent.click(screen.getByRole("button", { name: /Bordeaux/ }));
    expect(onSelectRegion).toHaveBeenCalledWith("bordeaux");
    await userEvent.click(screen.getByRole("button", { name: "Close details" }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("RegionDrawer — region view", () => {
  it("shows Bordeaux in full", async () => {
    renderDrawer("france", "bordeaux");
    expect(screen.getByRole("complementary", { name: "Bordeaux details" })).toBeInTheDocument();
    expect(screen.getByText("France · Region")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Bordeaux" })).toBeInTheDocument();
    expect(screen.getByText(/Gironde estuary/)).toBeInTheDocument();
    expect(screen.getByText("Climate: Moderate, maritime, 3 of 5 from cool to hot")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cabernet Sauvignon" })).toHaveAttribute("href", "#grape-cabernet-sauvignon");
    expect(screen.getByText("Cabernet Franc")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Cabernet Franc" })).not.toBeInTheDocument();
    expect(screen.getByText("Sweet Sauternes")).toBeInTheDocument();
    expect(screen.getByText(/1855 classification/)).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Explore 13 Bordeaux wines" })).toHaveAttribute("href", "/explore?region=Bordeaux");
  });

  it("uses the catalog's wording and encodes the region", async () => {
    renderDrawer("united-states", "napa-sonoma");
    expect(screen.getByRole("link", { name: "Explore California wines" })).toHaveAttribute("href", "/explore?region=California");
    expect(await screen.findByRole("link", { name: "Explore 32 California wines" })).toBeInTheDocument();
  });

  it("encodes spaces as %20", () => {
    renderDrawer("spain", "ribera-del-duero");
    expect(screen.getByRole("link", { name: /Castilla y León wine/ })).toHaveAttribute("href", "/explore?region=Castilla%20y%20Leon");
  });

  it("says so when the catalog has none", async () => {
    renderDrawer("france", "loire");
    expect(screen.getByText("No Loire wines in the catalog yet.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Explore/ })).not.toBeInTheDocument();
  });

  it("says so when the count comes back zero", async () => {
    renderDrawer("france", "provence");
    expect(await screen.findByText("No Provence wines in the catalog yet.")).toBeInTheDocument();
  });

  it("goes back to the country", async () => {
    const { onBackToCountry } = renderDrawer("france", "bordeaux");
    await userEvent.click(screen.getByRole("button", { name: "All of France" }));
    expect(onBackToCountry).toHaveBeenCalled();
  });
});
