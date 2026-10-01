import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import * as api from "../services/api";
import { LearnPage } from "./LearnPage";

vi.mock("../services/api", async () => {
  const actual = await vi.importActual<typeof import("../services/api")>("../services/api");
  return { ...actual, listWines: vi.fn() };
});

const scrollIntoView = vi.fn();
const originalScrollIntoView = Element.prototype.scrollIntoView;
const scrollTo = vi.fn();

beforeEach(() => {
  scrollTo.mockReset();
  vi.stubGlobal("scrollTo", scrollTo);
  vi.mocked(api.listWines).mockResolvedValue({ total: 0, items: [] });
  scrollIntoView.mockReset();
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  vi.unstubAllGlobals();
  Element.prototype.scrollIntoView = originalScrollIntoView;
});

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <LearnPage />
    </MemoryRouter>
  );
}

describe("LearnPage", () => {
  it("renders the intro and the How to Taste chapter", () => {
    renderAt("/learn");
    expect(screen.getByRole("heading", { level: 1, name: "Learn what's in your glass." })).toBeInTheDocument();
    const chapter = screen.getByRole("region", { name: "Five things your mouth is measuring" });
    expect(chapter).toHaveAttribute("id", "taste");
    expect(screen.getByText("01 · How to Taste")).toBeInTheDocument();
  });

  it("shows the chapter nav with both chapters", () => {
    renderAt("/learn");
    const nav = screen.getByRole("navigation", { name: "Learn chapters" });
    expect(within(nav).getByRole("link", { name: "How to Taste" })).toHaveAttribute("href", "#taste");
    expect(within(nav).getByRole("link", { name: "Vine to Glass" })).toHaveAttribute("href", "#vine");
  });

  it("renders the Vine to Glass chapter second", () => {
    renderAt("/learn");
    const chapter = screen.getByRole("region", { name: "From vine to glass" });
    expect(chapter).toHaveAttribute("id", "vine");
    expect(screen.getByText("02 · Vine to Glass")).toBeInTheDocument();
  });

  it("scrolls #vine into view on arrival", () => {
    renderAt("/learn#vine");
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.instances[0]).toBe(document.getElementById("vine"));
  });

  it("scrolls a #hash chapter into view on arrival", () => {
    renderAt("/learn#taste");
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.instances[0]).toBe(document.getElementById("taste"));
  });

  it("does not scroll an element into view without a hash", () => {
    renderAt("/learn");
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("resets the window to the top on arrival without a hash", () => {
    renderAt("/learn");
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it("leaves the window scroll alone when there is a hash", () => {
    renderAt("/learn#taste");
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("survives a malformed hash", () => {
    expect(() => renderAt("/learn#%zz")).not.toThrow();
  });
});
