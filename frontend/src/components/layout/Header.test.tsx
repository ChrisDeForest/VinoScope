import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, NavLink } from "react-router-dom";
import { Header } from "./Header";
import { stubMatchMedia } from "../../test/stubs";

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderHeader(props?: { overlay?: boolean; fixed?: boolean }) {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Header {...props} />
    </MemoryRouter>
  );
}

describe("Header", () => {
  it("renders an Admin link pointing to /admin", () => {
    renderHeader();
    expect(screen.getByRole("link", { name: /admin/i })).toHaveAttribute("href", "/admin");
  });

  it("default (not fixed): bordered, in-flow, theme colors", () => {
    renderHeader();
    const header = screen.getByRole("banner");
    expect(header).toHaveClass("border-b");
    expect(header).not.toHaveClass("fixed");
    expect(screen.getByRole("link", { name: "VinoScope" })).toHaveClass("text-ink");
  });

  it("fixed + overlay: transparent, no border, cellar colors, positioned over the page", () => {
    renderHeader({ fixed: true, overlay: true });
    const header = screen.getByRole("banner");
    expect(header).toHaveClass("fixed", "inset-x-0", "top-0");
    expect(header).not.toHaveClass("border-b");
    expect(screen.getByRole("link", { name: "VinoScope" })).toHaveClass("text-cellar-ink");
  });

  it("fixed + not overlay (scrolled past the hero): solid background, border, theme colors", () => {
    renderHeader({ fixed: true, overlay: false });
    const header = screen.getByRole("banner");
    expect(header).toHaveClass("fixed", "inset-x-0", "top-0", "border-b", "backdrop-blur");
    expect(screen.getByRole("link", { name: "VinoScope" })).toHaveClass("text-ink");
  });

  it("renders exactly one of each nav link and Admin link when the mobile menu is closed", () => {
    renderHeader();
    expect(screen.getAllByRole("link", { name: "Explore" })).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: "Discover" })).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: "Pair" })).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: "Compare" })).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: "Learn" })).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: "Admin" })).toHaveLength(1);
  });

  describe("mobile menu", () => {
    it("has a menu button with an accessible name, closed by default", () => {
      renderHeader();
      const button = screen.getByRole("button", { name: "Menu" });
      expect(button).toHaveAttribute("aria-expanded", "false");
      expect(button).toHaveAttribute("aria-controls");
    });

    it("opens the panel on click and toggles aria-expanded", async () => {
      const user = userEvent.setup();
      renderHeader();
      const button = screen.getByRole("button", { name: "Menu" });
      await user.click(button);
      expect(button).toHaveAttribute("aria-expanded", "true");
      await user.click(button);
      expect(button).toHaveAttribute("aria-expanded", "false");
    });

    it("panel contains the five nav links and Admin", async () => {
      const user = userEvent.setup();
      renderHeader();
      await user.click(screen.getByRole("button", { name: "Menu" }));
      const controlsId = screen.getByRole("button", { name: "Menu" }).getAttribute("aria-controls");
      const panel = document.getElementById(controlsId as string) as HTMLElement;
      expect(panel).not.toBeNull();
      const panelUtils = within(panel);
      expect(panelUtils.getByRole("link", { name: "Explore" })).toHaveAttribute("href", "/explore");
      expect(panelUtils.getByRole("link", { name: "Discover" })).toHaveAttribute("href", "/discover");
      expect(panelUtils.getByRole("link", { name: "Pair" })).toHaveAttribute("href", "/pair");
      expect(panelUtils.getByRole("link", { name: "Compare" })).toHaveAttribute("href", "/compare");
      expect(panelUtils.getByRole("link", { name: "Learn" })).toHaveAttribute("href", "/learn");
      expect(panelUtils.getByRole("link", { name: "Admin" })).toHaveAttribute("href", "/admin");
      expect(panelUtils.getByRole("combobox")).toBeInTheDocument();
    });

    it("closes on Escape", async () => {
      const user = userEvent.setup();
      renderHeader();
      const button = screen.getByRole("button", { name: "Menu" });
      await user.click(button);
      expect(button).toHaveAttribute("aria-expanded", "true");
      await user.keyboard("{Escape}");
      expect(button).toHaveAttribute("aria-expanded", "false");
    });

    it("closes when a link inside the panel is clicked", async () => {
      const user = userEvent.setup();
      renderHeader();
      const button = screen.getByRole("button", { name: "Menu" });
      await user.click(button);
      const controlsId = button.getAttribute("aria-controls");
      const panel = document.getElementById(controlsId as string) as HTMLElement;
      await user.click(within(panel).getByRole("link", { name: "Explore" }));
      expect(button).toHaveAttribute("aria-expanded", "false");
    });

    it("has a menu button sized and styled for a visible focus ring (M5)", () => {
      renderHeader();
      const button = screen.getByRole("button", { name: "Menu" });
      expect(button).toHaveClass("p-2", "focus-visible:outline", "focus-visible:outline-2");
    });

    it("renders the panel (hidden) even when closed, so aria-controls always points at a real element", () => {
      renderHeader();
      const button = screen.getByRole("button", { name: "Menu" });
      const controlsId = button.getAttribute("aria-controls") as string;
      expect(controlsId).toBeTruthy();
      const panel = document.getElementById(controlsId);
      expect(panel).not.toBeNull();
      expect(panel).toHaveAttribute("hidden");
    });

    it("gives the open panel a solid background over the hero, and treats the header as non-overlay (I1)", async () => {
      const user = userEvent.setup();
      renderHeader({ fixed: true, overlay: true });
      const header = screen.getByRole("banner");
      expect(header).not.toHaveClass("border-b");

      await user.click(screen.getByRole("button", { name: "Menu" }));

      expect(header).toHaveClass("bg-surface", "border-b");
      const controlsId = screen.getByRole("button", { name: "Menu" }).getAttribute("aria-controls") as string;
      const panel = document.getElementById(controlsId) as HTMLElement;
      expect(panel).not.toHaveAttribute("hidden");
      expect(panel).toHaveClass("bg-surface");
    });

    it("closes the panel when the viewport crosses to >= 768px (M3)", async () => {
      const emit = stubMatchMedia({ matches: () => false });
      const user = userEvent.setup();
      renderHeader();
      const button = screen.getByRole("button", { name: "Menu" });
      await user.click(button);
      expect(button).toHaveAttribute("aria-expanded", "true");

      act(() => emit(true));

      expect(button).toHaveAttribute("aria-expanded", "false");
    });

    it("returns focus to the Menu button when Escape closes the panel while focus was inside it (I3)", async () => {
      const user = userEvent.setup();
      renderHeader();
      const button = screen.getByRole("button", { name: "Menu" });
      await user.click(button);
      const controlsId = button.getAttribute("aria-controls") as string;
      const panel = document.getElementById(controlsId) as HTMLElement;
      const link = within(panel).getByRole("link", { name: "Explore" });
      link.focus();
      expect(link).toHaveFocus();

      await user.keyboard("{Escape}");

      expect(button).toHaveAttribute("aria-expanded", "false");
      expect(button).toHaveFocus();
    });

    it("closes on route change", async () => {
      const user = userEvent.setup();
      render(
        <MemoryRouter initialEntries={["/"]}>
          <Header />
          <NavLink to="/pair">Somewhere else</NavLink>
        </MemoryRouter>
      );
      const button = screen.getByRole("button", { name: "Menu" });
      await user.click(button);
      expect(button).toHaveAttribute("aria-expanded", "true");
      await user.click(screen.getByRole("link", { name: "Somewhere else" }));
      expect(button).toHaveAttribute("aria-expanded", "false");
    });
  });
});
