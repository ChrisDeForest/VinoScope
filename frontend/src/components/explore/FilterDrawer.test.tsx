import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { FilterDrawer } from "./FilterDrawer";
import { DEFAULT_FILTERS } from "./filterTypes";

describe("FilterDrawer", () => {
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
    await user.click(within(dialog).getByRole("button", { name: "Apply" }));

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
    const applyButton = within(dialog).getByRole("button", { name: "Apply" });
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
});
