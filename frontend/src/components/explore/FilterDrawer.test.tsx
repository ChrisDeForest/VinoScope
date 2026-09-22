import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
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
});
