import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CategoryFilter } from "./glossarySearch";
import { GlossaryControls } from "./GlossaryControls";

function Harness({ onQuery = vi.fn(), onCategory = vi.fn() }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  return (
    <GlossaryControls
      query={query}
      onQueryChange={(value) => {
        setQuery(value);
        onQuery(value);
      }}
      category={category}
      onCategoryChange={(value) => {
        setCategory(value);
        onCategory(value);
      }}
    />
  );
}

describe("GlossaryControls", () => {
  it("has a labelled search box", async () => {
    const onQuery = vi.fn();
    render(<Harness onQuery={onQuery} />);
    const box = screen.getByRole("searchbox", { name: "Search terms" });
    await userEvent.type(box, "oak");
    expect(box).toHaveValue("oak");
    expect(onQuery).toHaveBeenLastCalledWith("oak");
  });

  it("offers All plus five category chips with exactly one pressed", () => {
    render(<Harness />);
    const group = screen.getByRole("group", { name: "Category" });
    const chips = within(group).getAllByRole("button");
    expect(chips.map((chip) => chip.textContent)).toEqual(["All", "Tasting", "Winemaking", "Vineyard", "Label & Law", "Serving"]);
    expect(chips.filter((chip) => chip.getAttribute("aria-pressed") === "true")).toEqual([chips[0]]);
  });

  it("moves the pressed state to the clicked chip", async () => {
    const onCategory = vi.fn();
    render(<Harness onCategory={onCategory} />);
    await userEvent.click(screen.getByRole("button", { name: "Vineyard" }));
    expect(onCategory).toHaveBeenCalledWith("vineyard");
    expect(screen.getByRole("button", { name: "Vineyard" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "false");
  });
});
