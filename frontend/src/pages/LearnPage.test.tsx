import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import * as api from "../services/api";
import { LearnPage } from "./LearnPage";

vi.mock("../services/api", async () => {
  const actual = await vi.importActual<typeof import("../services/api")>("../services/api");
  return { ...actual, listWines: vi.fn() };
});

const scrollIntoView = vi.fn();
const originalScrollIntoView = Element.prototype.scrollIntoView;

beforeEach(() => {
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

  it("hides the chapter nav while there is only one chapter", () => {
    renderAt("/learn");
    expect(screen.queryByRole("navigation", { name: "Learn chapters" })).not.toBeInTheDocument();
  });

  it("scrolls a #hash chapter into view on arrival", () => {
    renderAt("/learn#taste");
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.instances[0]).toBe(document.getElementById("taste"));
  });

  it("does not scroll without a hash", () => {
    renderAt("/learn");
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
