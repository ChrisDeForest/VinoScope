import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useCompareSelection } from "./useCompareSelection";

function makeWrapper(initialEntries: string[]) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>;
  };
}

describe("useCompareSelection", () => {
  beforeEach(() => localStorage.clear());

  it("adds from Explore without altering its filters or URL and synchronizes subscribers", () => {
    const { result } = renderHook(() => ({
      first: useCompareSelection(), second: useCompareSelection(), location: useLocation(),
    }), { wrapper: makeWrapper(["/explore?q=cabernet&type=red"]) });
    act(() => result.current.first.addWine(8));
    expect(result.current.second.selectedIds).toEqual([8]);
    expect(result.current.location.pathname + result.current.location.search).toBe("/explore?q=cabernet&type=red");
  });

  it("honors shared comparison links with a trailing slash", () => {
    localStorage.setItem("vinoscope.compare.wines", "1,2");
    const { result } = renderHook(() => ({ selection: useCompareSelection(), location: useLocation() }), {
      wrapper: makeWrapper(["/compare/?wines=3,4"]),
    });
    expect(result.current.selection.selectedIds).toEqual([3, 4]);
    act(() => result.current.selection.addWine(5));
    expect(new URLSearchParams(result.current.location.search).get("wines")).toBe("3,4,5");
  });

  it("restores selections after leaving and returning without query parameters", () => {
    const first = renderHook(() => useCompareSelection(), { wrapper: makeWrapper(["/compare?wines=1,2"]) });
    first.unmount();
    const next = renderHook(() => useCompareSelection(), { wrapper: makeWrapper(["/compare"]) });
    expect(next.result.current.selectedIds).toEqual([1, 2]);
  });

  it("persists reordered wines and respects explicit shared links", () => {
    const first = renderHook(() => useCompareSelection(), { wrapper: makeWrapper(["/compare?wines=1,2,3"]) });
    act(() => first.result.current.moveWine(1, 3));
    expect(first.result.current.selectedIds).toEqual([2, 3, 1]);
    first.unmount();
    const next = renderHook(() => useCompareSelection(), { wrapper: makeWrapper(["/compare"]) });
    expect(next.result.current.selectedIds).toEqual([2, 3, 1]);
    next.unmount();
    const shared = renderHook(() => useCompareSelection(), { wrapper: makeWrapper(["/compare?wines=4,5"]) });
    expect(shared.result.current.selectedIds).toEqual([4, 5]);
  });

  it("does not restore wines after the last one is removed", () => {
    const first = renderHook(() => useCompareSelection(), { wrapper: makeWrapper(["/compare?wines=1"]) });
    act(() => first.result.current.removeWine(1));
    expect(first.result.current.selectedIds).toEqual([]);
    first.unmount();
    const next = renderHook(() => useCompareSelection(), { wrapper: makeWrapper(["/compare"]) });
    expect(next.result.current.selectedIds).toEqual([]);
  });
  it("starts empty when there is no wines param", () => {
    const { result } = renderHook(() => useCompareSelection(), { wrapper: makeWrapper(["/compare"]) });
    expect(result.current.selectedIds).toEqual([]);
  });

  it("parses a comma-separated wines param", () => {
    const { result } = renderHook(() => useCompareSelection(), {
      wrapper: makeWrapper(["/compare?wines=12,45,78"]),
    });
    expect(result.current.selectedIds).toEqual([12, 45, 78]);
  });

  it("dedupes repeated ids and drops non-numeric entries", () => {
    const { result } = renderHook(() => useCompareSelection(), {
      wrapper: makeWrapper(["/compare?wines=12,12,abc,45"]),
    });
    expect(result.current.selectedIds).toEqual([12, 45]);
  });

  it("caps at 4 ids, dropping the rest", () => {
    const { result } = renderHook(() => useCompareSelection(), {
      wrapper: makeWrapper(["/compare?wines=1,2,3,4,5,6"]),
    });
    expect(result.current.selectedIds).toEqual([1, 2, 3, 4]);
  });

  it("addWine appends an id", () => {
    const { result } = renderHook(() => useCompareSelection(), { wrapper: makeWrapper(["/compare?wines=1,2"]) });
    act(() => result.current.addWine(3));
    expect(result.current.selectedIds).toEqual([1, 2, 3]);
  });

  it("addWine is a no-op when the id is already selected", () => {
    const { result } = renderHook(() => useCompareSelection(), { wrapper: makeWrapper(["/compare?wines=1,2"]) });
    act(() => result.current.addWine(2));
    expect(result.current.selectedIds).toEqual([1, 2]);
  });

  it("addWine is a no-op once 4 are selected", () => {
    const { result } = renderHook(() => useCompareSelection(), {
      wrapper: makeWrapper(["/compare?wines=1,2,3,4"]),
    });
    act(() => result.current.addWine(5));
    expect(result.current.selectedIds).toEqual([1, 2, 3, 4]);
  });

  it("removeWine drops an id and closes the gap", () => {
    const { result } = renderHook(() => useCompareSelection(), {
      wrapper: makeWrapper(["/compare?wines=1,2,3"]),
    });
    act(() => result.current.removeWine(2));
    expect(result.current.selectedIds).toEqual([1, 3]);
  });
});
