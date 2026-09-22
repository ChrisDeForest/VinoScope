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
});
