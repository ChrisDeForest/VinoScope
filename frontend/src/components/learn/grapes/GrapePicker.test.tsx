import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { GRAPES } from "../../../content/learn/grapes";
import { GRAPE_PANEL_ID, GrapePicker } from "./GrapePicker";

function Harness({ initial = "cabernet-sauvignon", onSelect = vi.fn() }: { initial?: string; onSelect?: (id: string) => void }) {
  const [selected, setSelected] = useState(initial);
  return (
    <GrapePicker
      grapes={GRAPES}
      selectedId={selected}
      onSelect={(id) => {
        setSelected(id);
        onSelect(id);
      }}
    />
  );
}

const selectedName = () => screen.getByRole("tab", { selected: true }).textContent;

describe("GrapePicker", () => {
  it("renders one tablist with the seven grapes in order", () => {
    render(<Harness />);
    const tablist = screen.getByRole("tablist", { name: "Grapes" });
    expect(within(tablist).getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Cabernet Sauvignon",
      "Merlot",
      "Pinot Noir",
      "Syrah / Shiraz",
      "Chardonnay",
      "Sauvignon Blanc",
      "Riesling",
    ]);
  });

  it("wires each tab to its id and the shared panel", () => {
    render(<Harness />);
    const tab = screen.getByRole("tab", { name: "Pinot Noir" });
    expect(tab).toHaveAttribute("id", "grape-pinot-noir");
    expect(tab).toHaveAttribute("aria-controls", GRAPE_PANEL_ID);
  });

  it("marks only the selected tab as selected and tabbable", () => {
    render(<Harness initial="merlot" />);
    for (const tab of screen.getAllByRole("tab")) {
      const isMerlot = tab.textContent === "Merlot";
      expect(tab).toHaveAttribute("aria-selected", String(isMerlot));
      expect(tab).toHaveAttribute("tabindex", isMerlot ? "0" : "-1");
    }
  });

  it("selects on click", async () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("tab", { name: "Riesling" }));
    expect(onSelect).toHaveBeenLastCalledWith("riesling");
    expect(selectedName()).toBe("Riesling");
  });

  it("moves with arrow keys, wrapping at the ends, and follows focus", async () => {
    render(<Harness />);
    screen.getByRole("tab", { name: "Cabernet Sauvignon" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(selectedName()).toBe("Merlot");
    expect(screen.getByRole("tab", { name: "Merlot" })).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(selectedName()).toBe("Riesling");
    await userEvent.keyboard("{ArrowDown}");
    expect(selectedName()).toBe("Cabernet Sauvignon");
    await userEvent.keyboard("{ArrowUp}");
    expect(selectedName()).toBe("Riesling");
  });

  it("jumps with Home and End", async () => {
    render(<Harness initial="pinot-noir" />);
    screen.getByRole("tab", { name: "Pinot Noir" }).focus();
    await userEvent.keyboard("{End}");
    expect(selectedName()).toBe("Riesling");
    await userEvent.keyboard("{Home}");
    expect(selectedName()).toBe("Cabernet Sauvignon");
  });

  it("keeps the group labels out of the accessibility tree", () => {
    render(<Harness />);
    for (const label of [screen.getByText("Reds"), screen.getByText("Whites")]) {
      expect(label).toHaveAttribute("aria-hidden", "true");
    }
  });
});
