import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation, useNavigate, useNavigationType } from "react-router-dom";
import * as api from "../../../services/api";
import { GrapesChapter, grapeIdFromHash } from "./GrapesChapter";

vi.mock("../../../services/api", async () => {
  const actual = await vi.importActual<typeof import("../../../services/api")>("../../../services/api");
  return { ...actual, listWines: vi.fn() };
});

beforeEach(() => {
  vi.mocked(api.listWines).mockReturnValue(new Promise(() => {}));
});

function LocationProbe() {
  const location = useLocation();
  const type = useNavigationType();
  return (
    <p data-testid="location">
      {location.pathname}
      {location.search}
      {location.hash} {type}
    </p>
  );
}

let navigateProbe: ReturnType<typeof useNavigate>;
function NavigateCapture() {
  navigateProbe = useNavigate();
  return null;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <GrapesChapter />
      <LocationProbe />
      <NavigateCapture />
    </MemoryRouter>
  );
}

const selectedName = () => screen.getByRole("tab", { selected: true }).textContent;

describe("grapeIdFromHash", () => {
  it("reads a known grape slug", () => {
    expect(grapeIdFromHash("#grape-riesling")).toBe("riesling");
  });

  it("falls back to the default for anything else", () => {
    expect(grapeIdFromHash("")).toBe("cabernet-sauvignon");
    expect(grapeIdFromHash("#vine")).toBe("cabernet-sauvignon");
    expect(grapeIdFromHash("#grape-zinfandel")).toBe("cabernet-sauvignon");
  });
});

describe("GrapesChapter", () => {
  it("starts on Cabernet Sauvignon", () => {
    renderAt("/learn");
    expect(selectedName()).toBe("Cabernet Sauvignon");
    expect(screen.getByRole("tabpanel", { name: "Cabernet Sauvignon" })).toBeInTheDocument();
  });

  it("opens the grape named in the hash", () => {
    renderAt("/learn#grape-riesling");
    expect(selectedName()).toBe("Riesling");
    expect(screen.getByRole("heading", { level: 3, name: "Riesling" })).toBeInTheDocument();
  });

  it("falls back to the default for an unknown grape", () => {
    renderAt("/learn#grape-zinfandel");
    expect(selectedName()).toBe("Cabernet Sauvignon");
  });

  it("writes the selection to the hash without a new history entry", async () => {
    renderAt("/learn");
    await userEvent.click(screen.getByRole("tab", { name: "Pinot Noir" }));
    expect(screen.getByRole("tabpanel", { name: "Pinot Noir" })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/learn#grape-pinot-noir REPLACE");
  });

  it("keeps the query string when writing the hash", async () => {
    renderAt("/learn?x=1");
    await userEvent.click(screen.getByRole("tab", { name: "Merlot" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/learn?x=1#grape-merlot REPLACE");
  });

  it("follows Back and Forward to a grape hash, ignores other hashes", async () => {
    renderAt("/learn#grape-merlot");
    act(() => navigateProbe({ hash: "#grapes" }));
    expect(selectedName()).toBe("Merlot");
    await userEvent.click(screen.getByRole("tab", { name: "Riesling" })); // replaces #grapes
    act(() => navigateProbe({ hash: "#vine" }));
    act(() => navigateProbe(-1)); // POP to #grape-riesling
    expect(selectedName()).toBe("Riesling");
    act(() => navigateProbe({ hash: "#grape-pinot-noir" }));
    act(() => navigateProbe({ hash: "#vine" }));
    act(() => navigateProbe(-1)); // POP to #grape-pinot-noir
    expect(selectedName()).toBe("Pinot Noir");
    act(() => navigateProbe(1)); // POP to #vine: unchanged
    expect(selectedName()).toBe("Pinot Noir");
  });
});
