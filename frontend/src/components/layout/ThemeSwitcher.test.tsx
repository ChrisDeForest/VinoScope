import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { THEME_OPTIONS } from "../../theme/useTheme";
import { stubGtag } from "../../test/stubs";
import { ThemeSwitcher } from "./ThemeSwitcher";

describe("ThemeSwitcher", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to Dark Burgundy, closed", () => {
    render(<ThemeSwitcher />);
    const trigger = screen.getByRole("combobox", { name: "Theme" });
    expect(trigger).toHaveTextContent("Dark Burgundy");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("opens a list of every theme with the current one selected", async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher />);
    await user.click(screen.getByRole("combobox", { name: "Theme" }));
    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(THEME_OPTIONS.map((option) => option.label));
    expect(screen.getByRole("option", { name: "Dark Burgundy" })).toHaveAttribute("aria-selected", "true");
  });

  it("picking a theme applies and saves it, then closes the list", async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher />);
    await user.click(screen.getByRole("combobox", { name: "Theme" }));
    await user.click(screen.getByRole("option", { name: "Charcoal & Gold" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("charcoal-gold");
    expect(localStorage.getItem("vinoscope-theme")).toBe("charcoal-gold");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Theme" })).toHaveTextContent("Charcoal & Gold");
  });

  it("reports the chosen theme to analytics, but not re-picking the current one", async () => {
    const { events } = stubGtag();
    const user = userEvent.setup();
    render(<ThemeSwitcher />);
    await user.click(screen.getByRole("combobox", { name: "Theme" }));
    await user.click(screen.getByRole("option", { name: "Dark Burgundy" }));
    await user.click(screen.getByRole("combobox", { name: "Theme" }));
    await user.click(screen.getByRole("option", { name: "Charcoal & Gold" }));
    expect(events()).toEqual([["theme_change", { theme: "charcoal-gold" }]]);
  });

  it("works from the keyboard: arrows to move, Enter to pick, Escape to close", async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher />);
    const trigger = screen.getByRole("combobox", { name: "Theme" });
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{ArrowDown}");
    expect(trigger).toHaveAttribute("aria-activedescendant", screen.getByRole("option", { name: "Cream & Terracotta" }).id);
    await user.keyboard("{Enter}");
    expect(document.documentElement.getAttribute("data-theme")).toBe("cream-terracotta");

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("closes when clicking outside it", async () => {
    const user = userEvent.setup();
    render(
      <>
        <ThemeSwitcher />
        <p>Elsewhere</p>
      </>
    );
    await user.click(screen.getByRole("combobox", { name: "Theme" }));
    await user.click(screen.getByText("Elsewhere"));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("defaults to the default variant's surface styling", () => {
    render(<ThemeSwitcher />);
    const trigger = screen.getByRole("combobox", { name: "Theme" });
    expect(trigger).toHaveClass("bg-surface-raised", "text-ink");
    expect(trigger).not.toHaveClass("bg-black/30");
  });

  it("the overlay variant uses translucent dark styling and cellar text color", () => {
    render(<ThemeSwitcher variant="overlay" />);
    const trigger = screen.getByRole("combobox", { name: "Theme" });
    expect(trigger).toHaveClass("bg-black/30", "text-cellar-ink");
    expect(trigger).not.toHaveClass("bg-surface-raised");
  });
});
