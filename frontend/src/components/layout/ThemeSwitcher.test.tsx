import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeSwitcher } from "./ThemeSwitcher";

describe("ThemeSwitcher", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("defaults to dark-burgundy", () => {
    render(<ThemeSwitcher />);
    expect(screen.getByRole("combobox")).toHaveValue("dark-burgundy");
  });

  it("switching themes updates the root data-theme attribute and persists to localStorage", async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher />);
    await user.selectOptions(screen.getByRole("combobox"), "charcoal-gold");
    expect(document.documentElement.getAttribute("data-theme")).toBe("charcoal-gold");
    expect(localStorage.getItem("vinoscope-theme")).toBe("charcoal-gold");
  });

  it("defaults to the default variant's surface styling", () => {
    render(<ThemeSwitcher />);
    const select = screen.getByRole("combobox");
    expect(select).toHaveClass("bg-surface-raised", "text-ink");
    expect(select).not.toHaveClass("bg-black/30");
  });

  it("the overlay variant uses translucent dark styling and cellar text color", () => {
    render(<ThemeSwitcher variant="overlay" />);
    const select = screen.getByRole("combobox");
    expect(select).toHaveClass("bg-black/30", "text-cellar-ink");
    expect(select).not.toHaveClass("bg-surface-raised");
  });

  it("keeps <option> elements readable regardless of variant", () => {
    render(<ThemeSwitcher variant="overlay" />);
    const options = screen.getAllByRole("option");
    for (const option of options) {
      expect(option).toHaveClass("bg-surface", "text-ink");
    }
  });
});
