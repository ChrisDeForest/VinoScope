import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useApiQuery } from "./useApiQuery";

describe("useApiQuery", () => {
  it("starts in a loading state and resolves to data", async () => {
    const fetcher = vi.fn().mockResolvedValue({ hello: "world" });
    const { result } = renderHook(() => useApiQuery(fetcher, []));

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ hello: "world" });
    expect(result.current.error).toBeNull();
  });

  it("captures a rejected fetcher as an error", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useApiQuery(fetcher, []));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error?.message).toBe("boom");
    expect(result.current.data).toBeNull();
  });

  it("re-fetches when deps change", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce("first").mockResolvedValueOnce("second");
    const { result, rerender } = renderHook(({ dep }) => useApiQuery(fetcher, [dep]), {
      initialProps: { dep: 1 },
    });

    await waitFor(() => expect(result.current.data).toBe("first"));

    rerender({ dep: 2 });
    await waitFor(() => expect(result.current.data).toBe("second"));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
