import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { useCompareSelection } from "./useCompareSelection";

function makeWrapper(initialEntries: string[]) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>;
  };
}

describe("useCompareSelection", () => {
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
