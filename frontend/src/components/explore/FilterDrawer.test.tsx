import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { FilterDrawer } from "./FilterDrawer";
import { DEFAULT_FILTERS } from "./filterTypes";
import * as api from "../../services/api";
import { clearWineFacetsCache } from "../../hooks/useWineFacets";
import type { WineFacets } from "../../types/wine";
import { chooseOption, readOptions } from "../../test/combobox";

vi.mock("../../services/api", async () => {
  const actual = await vi.importActual<typeof import("../../services/api")>("../../services/api");
  return { ...actual, getWineFacets: vi.fn() };
});

const getWineFacetsMock = api.getWineFacets as unknown as ReturnType<typeof vi.fn>;
const FACETS: WineFacets = {
  types: ["dessert", "red", "white"],
  countries: [
    { name: "Chile", regions: ["Colchagua Valley", "Maipo Valley"] },
    { name: "France", regions: ["Bordeaux", "Champagne"] },
  ],
  vintage: { min: 2016, max: 2025 },
  abv: { min: 4, max: 20 },
};

describe("FilterDrawer", () => {
  beforeEach(() => {
    clearWineFacetsCache();
    getWineFacetsMock.mockReset();
    getWineFacetsMock.mockResolvedValue(FACETS);
  });

  it("does not apply an inverted price range", async () => {
    const onApply = vi.fn();
    render(<FilterDrawer open initialFilters={{ ...DEFAULT_FILTERS, minPrice: "50", maxPrice: "20" }} onApply={onApply} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /^Apply/ }));
    expect(screen.getByRole("alert")).toHaveTextContent(/minimum.*maximum/i);
    expect(onApply).not.toHaveBeenCalled();
  });
  it("renders nothing when closed", () => {
    render(<FilterDrawer open={false} initialFilters={DEFAULT_FILTERS} onApply={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("calls onApply with the edited filter values", async () => {
    const onApply = vi.fn();
    const user = userEvent.setup();
    render(<FilterDrawer open initialFilters={DEFAULT_FILTERS} onApply={onApply} onClose={vi.fn()} />);

    const dialog = screen.getByRole("dialog", { name: "Filters" });
    await chooseOption(user, within(dialog).getByLabelText("Type"), "White");
    await user.type(within(dialog).getByLabelText("Search"), "caymus");
    await user.click(within(dialog).getByRole("button", { name: /^Apply/ }));

    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ type: "white", q: "caymus" }));
  });

  it("resets the draft to the clear defaults when Clear is clicked", async () => {
    const user = userEvent.setup();
    render(
      <FilterDrawer open initialFilters={{ ...DEFAULT_FILTERS, type: "red" }} onApply={vi.fn()} onClose={vi.fn()} />
    );

    const dialog = screen.getByRole("dialog", { name: "Filters" });
    expect(within(dialog).getByLabelText("Type")).toHaveValue("Red");

    await user.click(within(dialog).getByRole("button", { name: "Clear" }));
    expect(within(dialog).getByLabelText("Type")).toHaveValue("All types");
  });

  it("calls onClose when the close button is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<FilterDrawer open initialFilters={DEFAULT_FILTERS} onApply={vi.fn()} onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Close filters" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("focuses the dialog, traps Tab, dismisses Escape, and returns focus to the opener", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open filters
          </button>
          <FilterDrawer open={open} initialFilters={DEFAULT_FILTERS} onApply={vi.fn()} onClose={() => setOpen(false)} />
        </>
      );
    }

    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open filters" });
    await user.click(opener);

    const dialog = screen.getByRole("dialog", { name: "Filters" });
    const closeButton = within(dialog).getByRole("button", { name: "Close filters" });
    const applyButton = within(dialog).getByRole("button", { name: /^Apply/ });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(closeButton).toHaveFocus();

    await user.tab({ shift: true });
    expect(applyButton).toHaveFocus();
    await user.tab();
    expect(closeButton).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("keeps the price inputs within the drawer width", () => {
    render(<FilterDrawer open initialFilters={DEFAULT_FILTERS} onApply={vi.fn()} onClose={vi.fn()} />);

    const dialog = screen.getByRole("dialog", { name: "Filters" });
    for (const label of ["Min price", "Max price"]) {
      const input = within(dialog).getByLabelText(label);
      expect(input).toHaveClass("w-full", "min-w-0");
      expect(input.parentElement).toHaveClass("min-w-0");
    }
  });

  it("uses the themed stepper for price", async () => {
    const onApply = vi.fn();
    render(<FilterDrawer open initialFilters={DEFAULT_FILTERS} onApply={onApply} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Increase max price" }));
    await userEvent.click(screen.getByRole("button", { name: /^Apply/ }));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ maxPrice: "1" }));
  });

  // The region field is a dropdown only once the catalog's facets have arrived.
  const catalogLoaded = () => waitFor(() => expect(screen.getByLabelText("Region")).toHaveAttribute("role", "combobox"));
  const shownOptions = () => within(screen.getByRole("listbox")).getAllByRole("option").map((option) => option.textContent);

  it("lists types and countries from the catalog", async () => {
    const user = userEvent.setup();
    render(<FilterDrawer open initialFilters={DEFAULT_FILTERS} onApply={vi.fn()} onClose={vi.fn()} />);
    await catalogLoaded();
    expect(await readOptions(user, screen.getByLabelText("Type"))).toEqual(["All types", "Dessert", "Red", "White"]);
    expect(await readOptions(user, screen.getByLabelText("Country"))).toEqual(["All countries", "Chile", "France"]);
  });

  it("narrows regions to the chosen country and clears a region that no longer fits", async () => {
    const user = userEvent.setup();
    render(<FilterDrawer open initialFilters={{ ...DEFAULT_FILTERS, country: "France", region: "Bordeaux" }} onApply={vi.fn()} onClose={vi.fn()} />);
    await catalogLoaded();
    expect(screen.getByLabelText("Region")).toHaveValue("Bordeaux");
    await chooseOption(user, screen.getByLabelText("Country"), "Chile");
    expect(screen.getByLabelText("Region")).toHaveValue("All regions");
    expect(await readOptions(user, screen.getByLabelText("Region"))).toEqual(["All regions", "Colchagua Valley", "Maipo Valley"]);
  });

  it("groups every region by country when no country is chosen", async () => {
    const user = userEvent.setup();
    render(<FilterDrawer open initialFilters={DEFAULT_FILTERS} onApply={vi.fn()} onClose={vi.fn()} />);
    await catalogLoaded();
    await user.click(screen.getByLabelText("Region"));
    const list = screen.getByRole("listbox");
    expect(within(list).getAllByRole("group")).toHaveLength(2);
    expect(within(list).getByRole("group", { name: "Chile" })).toHaveTextContent("Colchagua ValleyMaipo Valley");
    expect(within(list).getByRole("group", { name: "France" })).toHaveTextContent("BordeauxChampagne");
  });

  it("filters a dropdown as you type, ignoring case", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(<FilterDrawer open initialFilters={DEFAULT_FILTERS} onApply={onApply} onClose={vi.fn()} />);
    await catalogLoaded();
    await user.type(screen.getByLabelText("Region"), "MAIPO");
    expect(shownOptions()).toEqual(["Maipo Valley"]);
    await user.keyboard("{Enter}");
    expect(screen.getByLabelText("Region")).toHaveValue("Maipo Valley");
    await user.click(screen.getByRole("button", { name: /^Apply/ }));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ region: "Maipo Valley" }));
  });

  it("shows every region of a country when you type the country's name", async () => {
    const user = userEvent.setup();
    render(<FilterDrawer open initialFilters={DEFAULT_FILTERS} onApply={vi.fn()} onClose={vi.fn()} />);
    await catalogLoaded();
    await user.type(screen.getByLabelText("Region"), "chile");
    expect(shownOptions()).toEqual(["Colchagua Valley", "Maipo Valley"]);
  });

  it("closes an open dropdown on Escape without closing the drawer", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<FilterDrawer open initialFilters={DEFAULT_FILTERS} onApply={vi.fn()} onClose={onClose} />);
    await user.click(screen.getByLabelText("Type"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes an open dropdown when its label is clicked instead of reopening it", async () => {
    const user = userEvent.setup();
    render(<FilterDrawer open initialFilters={DEFAULT_FILTERS} onApply={vi.fn()} onClose={vi.fn()} />);
    await catalogLoaded();
    await user.click(screen.getByLabelText("Country"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.click(screen.getByText("Country", { selector: "label" }));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("closes on Escape even when focus has left the drawer", async () => {
    const onClose = vi.fn();
    render(<FilterDrawer open initialFilters={DEFAULT_FILTERS} onApply={vi.fn()} onClose={onClose} />);
    (document.activeElement as HTMLElement | null)?.blur();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes when the backdrop is clicked but not when the panel is", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<FilterDrawer open initialFilters={DEFAULT_FILTERS} onApply={vi.fn()} onClose={onClose} />);
    await user.click(screen.getByRole("heading", { name: "Filters" }));
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole("dialog", { name: "Filters" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("stops the wheel from scrolling the page behind the panel", () => {
    render(<FilterDrawer open initialFilters={DEFAULT_FILTERS} onApply={vi.fn()} onClose={vi.fn()} />);
    const wheel = new WheelEvent("wheel", { deltaY: 100, bubbles: true, cancelable: true });
    screen.getByRole("heading", { name: "Filters" }).dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(true);
  });

  it("keeps a region from a link even when the catalog has no wines there yet", async () => {
    render(<FilterDrawer open initialFilters={{ ...DEFAULT_FILTERS, region: "New York" }} onApply={vi.fn()} onClose={vi.fn()} />);
    await catalogLoaded();
    expect(screen.getByLabelText("Region")).toHaveValue("New York");
  });

  it("falls back to built-in lists and a free-text region when the catalog is unreachable", async () => {
    getWineFacetsMock.mockRejectedValue(new Error("offline"));
    const user = userEvent.setup();
    render(<FilterDrawer open initialFilters={DEFAULT_FILTERS} onApply={vi.fn()} onClose={vi.fn()} />);
    await waitFor(() => expect(getWineFacetsMock).toHaveBeenCalled());
    expect(screen.getByLabelText("Region")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Region")).not.toHaveAttribute("role");
    expect(await readOptions(user, screen.getByLabelText("Country"))).toContain("Hungary");
    expect(await readOptions(user, screen.getByLabelText("Type"))).toContain("Dessert");
  });

  it("rejects an inverted alcohol range", async () => {
    const onApply = vi.fn();
    render(<FilterDrawer open initialFilters={{ ...DEFAULT_FILTERS, minAbv: "14", maxAbv: "12" }} onApply={onApply} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /^Apply/ }));
    expect(screen.getByRole("alert")).toHaveTextContent("Minimum alcohol must not exceed maximum alcohol.");
    expect(onApply).not.toHaveBeenCalled();
  });

  it("rejects an inverted vintage range", async () => {
    const onApply = vi.fn();
    render(<FilterDrawer open initialFilters={{ ...DEFAULT_FILTERS, vintageFrom: "2022", vintageTo: "2019" }} onApply={onApply} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /^Apply/ }));
    expect(screen.getByRole("alert")).toHaveTextContent("The first vintage must not be after the last.");
    expect(onApply).not.toHaveBeenCalled();
  });

  it("applies taste, vintage and NV choices", async () => {
    const onApply = vi.fn();
    const user = userEvent.setup();
    render(<FilterDrawer open initialFilters={DEFAULT_FILTERS} onApply={onApply} onClose={vi.fn()} />);
    await catalogLoaded();
    const sweetness = screen.getByRole("group", { name: "Sweetness" });
    await user.click(within(sweetness).getByRole("button", { name: "Dry" }));
    await user.click(within(sweetness).getByRole("button", { name: "Sweet" }));
    await chooseOption(user, screen.getByLabelText("Vintage from"), "2019");
    await user.click(screen.getByLabelText("Include non-vintage (NV) wines"));
    await user.click(screen.getByRole("button", { name: /^Apply/ }));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ sweetness: "2-4", vintageFrom: "2019", excludeNv: "1" }));
  });

  it("shows how many filters Apply will use", () => {
    render(<FilterDrawer open initialFilters={{ ...DEFAULT_FILTERS, type: "red", tannin: "4" }} onApply={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Apply · 2 filters" })).toBeInTheDocument();
  });

  it("keeps Clear and Apply outside the scrolling list", () => {
    render(<FilterDrawer open initialFilters={DEFAULT_FILTERS} onApply={vi.fn()} onClose={vi.fn()} />);
    const scroller = screen.getByTestId("filter-drawer-body");
    expect(scroller).toHaveClass("overflow-y-auto");
    expect(within(scroller).queryByRole("button", { name: /^Apply/ })).not.toBeInTheDocument();
  });
});
