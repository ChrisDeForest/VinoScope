import { describe, it, expect } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate, useNavigationType } from "react-router-dom";
import { hashFor, selectionFromHash, useMapSelection } from "./useMapSelection";

let api: ReturnType<typeof useMapSelection>;
let navigateProbe: ReturnType<typeof useNavigate>;

function Harness() {
  api = useMapSelection();
  navigateProbe = useNavigate();
  const location = useLocation();
  const type = useNavigationType();
  return (
    <>
      <p data-testid="selection">
        {api.selection.countryId ?? "-"}/{api.selection.regionId ?? "-"}
      </p>
      <p data-testid="location">
        {location.pathname}
        {location.search}
        {location.hash} {type}
      </p>
    </>
  );
}

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Harness />
    </MemoryRouter>
  );
}

const selection = () => screen.getByTestId("selection").textContent;
const location = () => screen.getByTestId("location").textContent;

describe("selectionFromHash / hashFor", () => {
  it("reads country and region hashes", () => {
    expect(selectionFromHash("#country-france")).toEqual({ countryId: "france", regionId: null });
    expect(selectionFromHash("#region-bordeaux")).toEqual({ countryId: "france", regionId: "bordeaux" });
  });

  it("ignores anything else", () => {
    expect(selectionFromHash("")).toBeNull();
    expect(selectionFromHash("#regions")).toBeNull();
    expect(selectionFromHash("#country-atlantis")).toBeNull();
    expect(selectionFromHash("#region-atlantis")).toBeNull();
    expect(selectionFromHash("#grape-merlot")).toBeNull();
  });

  it("writes hashes", () => {
    expect(hashFor({ countryId: null, regionId: null })).toBe("#regions");
    expect(hashFor({ countryId: "italy", regionId: null })).toBe("#country-italy");
    expect(hashFor({ countryId: "italy", regionId: "tuscany" })).toBe("#region-tuscany");
  });
});

describe("useMapSelection", () => {
  it("starts from the hash, or the world", () => {
    renderAt("/learn#region-mosel");
    expect(selection()).toBe("germany/mosel");
  });

  it("starts at the world for an unknown hash", () => {
    renderAt("/learn#country-atlantis");
    expect(selection()).toBe("-/-");
  });

  it("replaces the hash as the selection changes, keeping the query", () => {
    renderAt("/learn?x=1");
    act(() => api.selectCountry("italy"));
    expect(selection()).toBe("italy/-");
    expect(location()).toBe("/learn?x=1#country-italy REPLACE");
    act(() => api.selectRegion("bordeaux"));
    expect(selection()).toBe("france/bordeaux");
    expect(location()).toBe("/learn?x=1#region-bordeaux REPLACE");
    act(() => api.showWorld());
    expect(selection()).toBe("-/-");
    expect(location()).toBe("/learn?x=1#regions REPLACE");
  });

  it("steps back from a region to its country, then to the world", () => {
    renderAt("/learn#region-bordeaux");
    act(() => api.stepBack());
    expect(selection()).toBe("france/-");
    act(() => api.stepBack());
    expect(selection()).toBe("-/-");
  });

  it("follows Back and Forward to a map hash, ignores other hashes", () => {
    renderAt("/learn#country-spain");
    act(() => navigateProbe({ hash: "#grape-merlot" }));
    expect(selection()).toBe("spain/-");
    act(() => navigateProbe({ hash: "#region-tokaj" }));
    act(() => navigateProbe({ hash: "#vine" }));
    act(() => navigateProbe(-1));
    expect(selection()).toBe("hungary/tokaj");
  });

  it("counts the Back/Forward arrivals at a map hash, so the chapter can reopen the drawer", () => {
    renderAt("/learn#country-spain");
    expect(api.popCount).toBe(0);
    act(() => api.selectCountry("italy"));
    act(() => navigateProbe({ hash: "#grape-merlot" }));
    act(() => navigateProbe(-1));
    expect(selection()).toBe("italy/-");
    expect(api.popCount).toBe(1);
    act(() => navigateProbe(1));
    expect(api.popCount).toBe(1);
  });
});
