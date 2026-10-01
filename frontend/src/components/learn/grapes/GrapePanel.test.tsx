import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import * as api from "../../../services/api";
import { GRAPES } from "../../../content/learn/grapes";
import { GrapePanel } from "./GrapePanel";
import { REVEAL_DELAY_MS } from "../../../hooks/useReveal";
import { stubIntersectionObserver, stubMatchMedia } from "../../../test/stubs";

vi.mock("../../../services/api", async () => {
  const actual = await vi.importActual<typeof import("../../../services/api")>("../../../services/api");
  return { ...actual, listWines: vi.fn() };
});

const RIESLING = GRAPES.find((grape) => grape.id === "riesling")!;
const MERLOT = GRAPES.find((grape) => grape.id === "merlot")!;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

beforeEach(() => {
  vi.mocked(api.listWines).mockReturnValue(new Promise(() => {}));
});

function renderPanel(grape = RIESLING, initial = false) {
  return render(
    <MemoryRouter>
      <button role="tab" id={`grape-${grape.id}`}>
        {grape.name}
      </button>
      <GrapePanel grape={grape} initial={initial} />
    </MemoryRouter>
  );
}

describe("GrapePanel", () => {
  it("is a tabpanel labelled by its tab", () => {
    renderPanel();
    const panel = screen.getByRole("tabpanel", { name: "Riesling" });
    expect(panel).toHaveAttribute("id", "grape-panel");
  });

  it("shows the grape's copy, notes, regions, profile and Explore link", () => {
    renderPanel();
    expect(screen.getByRole("heading", { level: 3, name: "Riesling" })).toBeInTheDocument();
    expect(screen.getByText("White grape")).toBeInTheDocument();
    expect(screen.getByText(RIESLING.tagline)).toBeInTheDocument();
    expect(screen.getByText(RIESLING.about)).toBeInTheDocument();
    for (const note of RIESLING.notes) expect(screen.getByText(note)).toBeInTheDocument();
    expect(screen.getByText(RIESLING.regions.join(", "))).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Taste profile" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explore Riesling wines" })).toHaveAttribute("href", "/explore?grape=Riesling");
  });

  it("names red grapes as red", () => {
    renderPanel(MERLOT);
    expect(screen.getByText("Red grape")).toBeInTheDocument();
  });

  it("hides the art from assistive technology", () => {
    renderPanel();
    expect(screen.getByTestId("grape-art")).toHaveAttribute("aria-hidden", "true");
    for (const stroke of screen.getByTestId("grape-art").querySelectorAll(".draw")) {
      expect(stroke).toHaveAttribute("pathLength", "1");
    }
  });

  it("links Syrah by its filter name, not the combined display name", () => {
    renderPanel(GRAPES.find((grape) => grape.id === "syrah")!);
    expect(screen.getByRole("link", { name: "Explore Syrah wines" })).toHaveAttribute("href", "/explore?grape=Syrah");
  });

  it("is focusable so keyboard users can scroll it", () => {
    renderPanel();
    expect(screen.getByRole("tabpanel")).toHaveAttribute("tabindex", "0");
  });

  it("reveals a switched-to panel as soon as it is in view, but delays the initial one", () => {
    vi.useFakeTimers();
    stubMatchMedia({ reducedMotion: false });
    const { fire } = stubIntersectionObserver();
    const first = renderPanel(RIESLING, true);
    fire(0, true);
    expect(screen.getByRole("tabpanel")).not.toHaveClass("is-visible");
    act(() => vi.advanceTimersByTime(REVEAL_DELAY_MS));
    expect(screen.getByRole("tabpanel")).toHaveClass("is-visible");
    first.unmount();
    renderPanel(MERLOT, false);
    fire(1, true);
    expect(screen.getByRole("tabpanel")).toHaveClass("is-visible");
  });
});
