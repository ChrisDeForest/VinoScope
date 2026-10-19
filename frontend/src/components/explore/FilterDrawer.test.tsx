import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { FilterDrawer } from "./FilterDrawer";
import { DEFAULT_FILTERS } from "./filterTypes";
import * as api from "../../services/api";
import { clearWineFacetsCache } from "../../hooks/useWineFacets";
import type { WineFacets } from "../../types/wine";

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
    await user.selectOptions(within(dialog).getByLabelText("Type"), "white");
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
    expect(within(dialog).getByLabelText("Type")).toHaveValue("red");

    await user.click(within(dialog).getByRole("button", { name: "Clear" }));
    expect(within(dialog).getByLabelText("Type")).toHaveValue("");
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

  const optionNames = (select: HTMLElement) => within(select).getAllByRole("option").map((option) => option.textContent);

  it("lists types and countries from the catalog", async () => {
    render(<FilterDrawer open initialFilters={DEFAULT_FILTERS} onApply={vi.fn()} onClose={vi.fn()} />);
    // The fallback lists also contain "Dessert", so wait for a catalog-only option first.
    await screen.findByRole("option", { name: "Maipo Valley" });
    expect(optionNames(screen.getByLabelText("Type"))).toEqual(["All types", "Dessert", "Red", "White"]);
    expect(optionNames(screen.getByLabelText("Country"))).toEqual(["All countries", "Chile", "France"]);
  });

  it("narrows regions to the chosen country and clears a region that no longer fits", async () => {
    const user = userEvent.setup();
    render(<FilterDrawer open initialFilters={{ ...DEFAULT_FILTERS, country: "France", region: "Bordeaux" }} onApply={vi.fn()} onClose={vi.fn()} />);
    await screen.findByRole("option", { name: "Champagne" });
    expect(screen.getByLabelText("Region")).toHaveValue("Bordeaux");
    await user.selectOptions(screen.getByLabelText("Country"), "Chile");
    expect(screen.getByLabelText("Region")).toHaveValue("");
    expect(optionNames(screen.getByLabelText("Region"))).toEqual(["All regions", "Colchagua Valley", "Maipo Valley"]);
  });

  it("groups every region by country when no country is chosen", async () => {
    render(<FilterDrawer open initialFilters={DEFAULT_FILTERS} onApply={vi.fn()} onClose={vi.fn()} />);
    await screen.findByRole("option", { name: "Maipo Valley" });
    const groups = Array.from(screen.getByLabelText("Region").querySelectorAll("optgroup")).map((group) => group.label);
    expect(groups).toEqual(["Chile", "France"]);
  });

  it("keeps a region from a link even when the catalog has no wines there yet", async () => {
    render(<FilterDrawer open initialFilters={{ ...DEFAULT_FILTERS, region: "New York" }} onApply={vi.fn()} onClose={vi.fn()} />);
    await screen.findByRole("option", { name: "Maipo Valley" });
    expect(screen.getByLabelText("Region")).toHaveValue("New York");
  });

  it("falls back to built-in lists and a free-text region when the catalog is unreachable", async () => {
    getWineFacetsMock.mockRejectedValue(new Error("offline"));
    render(<FilterDrawer open initialFilters={DEFAULT_FILTERS} onApply={vi.fn()} onClose={vi.fn()} />);
    await waitFor(() => expect(getWineFacetsMock).toHaveBeenCalled());
    expect(screen.getByLabelText("Region")).toHaveAttribute("type", "text");
    expect(optionNames(screen.getByLabelText("Country"))).toContain("Hungary");
    expect(optionNames(screen.getByLabelText("Type"))).toContain("Dessert");
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
    await screen.findAllByRole("option", { name: "2019" });
    const sweetness = screen.getByRole("group", { name: "Sweetness" });
    await user.click(within(sweetness).getByRole("button", { name: "Dry" }));
    await user.click(within(sweetness).getByRole("button", { name: "Sweet" }));
    await user.selectOptions(screen.getByLabelText("Vintage from"), "2019");
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
