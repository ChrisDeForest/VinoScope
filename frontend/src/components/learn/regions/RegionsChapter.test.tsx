import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act, fireEvent } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import * as api from "../../../services/api";
import { RegionsChapter } from "./RegionsChapter";
import { clearCatalogCountCache } from "./useCatalogCount";

vi.mock("../../../services/api", async () => {
  const actual = await vi.importActual<typeof import("../../../services/api")>("../../../services/api");
  return { ...actual, listWines: vi.fn() };
});

beforeEach(() => {
  clearCatalogCountCache();
  vi.mocked(api.listWines).mockResolvedValue({ total: 5, items: [] });
});

let navigateProbe: ReturnType<typeof useNavigate>;

function HashProbe() {
  navigateProbe = useNavigate();
  return <p data-testid="hash">{useLocation().hash}</p>;
}

async function renderAt(path = "/learn") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <RegionsChapter />
      <HashProbe />
    </MemoryRouter>
  );
  await screen.findByRole("group", { name: "World wine map" });
}

const chips = () => screen.getByRole("group", { name: "Wine countries" });
const status = () => screen.getByTestId("map-breadcrumb").textContent;
const chip = (name: string) => within(chips()).getByRole("button", { name });

describe("RegionsChapter", () => {
  it("opens on the world with chips, the map and no drawer", async () => {
    await renderAt();
    expect(within(chips()).getAllByRole("button")).toHaveLength(13);
    expect(status()).toBe("World · 13 wine countries");
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "World" })).not.toBeInTheDocument();
  });

  it("flies to a country from a chip, opens its drawer and focuses the heading", async () => {
    await renderAt();
    await userEvent.click(within(chips()).getByRole("button", { name: "France" }));
    const drawer = screen.getByRole("complementary", { name: "France details" });
    expect(document.activeElement).toBe(within(drawer).getByRole("heading", { level: 3, name: "France" }));
    expect(status()).toBe("World · France");
    expect(screen.getByTestId("hash")).toHaveTextContent("#country-france");
    expect(screen.getByRole("button", { name: "World" })).toBeInTheDocument();
  });

  it("opens a region from the drawer list and steps back with Escape", async () => {
    await renderAt();
    await userEvent.click(within(chips()).getByRole("button", { name: "France" }));
    await userEvent.click(within(screen.getByRole("list")).getByRole("button", { name: /Bordeaux/ }));
    expect(screen.getByRole("complementary", { name: "Bordeaux details" })).toBeInTheDocument();
    expect(status()).toBe("World · France · Bordeaux");

    await userEvent.keyboard("{Escape}");
    const drawer = screen.getByRole("complementary", { name: "France details" });
    expect(document.activeElement).toBe(within(drawer).getByRole("heading", { level: 3 }));

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(status()).toBe("World · 13 wine countries");
    expect(screen.getByTestId("hash")).toHaveTextContent("#regions");
    expect(document.activeElement).toBe(chip("France"));
  });

  it("returns focus to the chip after browsing inside the drawer and closing it", async () => {
    await renderAt();
    await userEvent.click(chip("France"));
    await userEvent.click(within(screen.getByRole("list")).getByRole("button", { name: /Bordeaux/ }));
    await userEvent.click(screen.getByRole("button", { name: "All of France" }));
    await userEvent.click(within(screen.getByRole("list")).getByRole("button", { name: /Alsace/ }));
    await userEvent.click(screen.getByRole("button", { name: "Close details" }));
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(chip("France"));
  });

  it("returns focus to the newly chosen country's chip when switching countries with the drawer open", async () => {
    await renderAt();
    await userEvent.click(chip("France"));
    await userEvent.click(chip("Italy"));
    await userEvent.click(screen.getByRole("button", { name: "Close details" }));
    expect(document.activeElement).toBe(chip("Italy"));
  });

  it("falls back to the country's chip when the pin that opened the drawer is gone", async () => {
    await renderAt();
    await userEvent.click(chip("France"));
    await userEvent.click(screen.getByRole("button", { name: "Close details" }));
    await userEvent.click(within(screen.getByRole("group", { name: "World wine map" })).getByRole("button", { name: "Rhône" }));
    expect(screen.getByRole("complementary", { name: "Rhône details" })).toBeInTheDocument();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(chip("France"));
  });

  it("announces changes once, through the drawer heading rather than a live breadcrumb", async () => {
    await renderAt();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("reopens the drawer when Back returns to a map hash", async () => {
    await renderAt("/learn#region-rhone");
    act(() => navigateProbe({ hash: "#grape-syrah" }));
    await userEvent.click(screen.getByRole("button", { name: "Close details" }));
    await userEvent.click(screen.getByRole("button", { name: "World" }));
    expect(screen.getByTestId("hash")).toHaveTextContent("#regions");
    act(() => navigateProbe(-1));
    expect(screen.getByTestId("hash")).toHaveTextContent("#region-rhone");
    expect(screen.getByRole("complementary", { name: "Rhône details" })).toBeInTheDocument();
  });

  it("closes the drawer without leaving the country, returning focus to the chip", async () => {
    await renderAt();
    const france = within(chips()).getByRole("button", { name: "France" });
    await userEvent.click(france);
    await userEvent.click(screen.getByRole("button", { name: "Close details" }));
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(france);
    expect(france).toHaveAttribute("aria-pressed", "true");
    expect(status()).toBe("World · France");
  });

  it("goes back to the world", async () => {
    await renderAt();
    await userEvent.click(within(chips()).getByRole("button", { name: "Italy" }));
    await userEvent.click(screen.getByRole("button", { name: "World" }));
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(status()).toBe("World · 13 wine countries");
    expect(document.activeElement).toBe(chip("Italy"));
  });

  it("arrives on a region from a deep link", async () => {
    await renderAt("/learn#region-bordeaux");
    expect(screen.getByRole("complementary", { name: "Bordeaux details" })).toBeInTheDocument();
    expect(document.getElementById("region-bordeaux")).not.toBeNull();
    expect(status()).toBe("World · France · Bordeaux");
  });
});
