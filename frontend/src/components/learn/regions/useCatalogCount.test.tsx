import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import * as api from "../../../services/api";
import { clearCatalogCountCache, useCatalogCount, type CountFilter } from "./useCatalogCount";

vi.mock("../../../services/api", async () => {
  const actual = await vi.importActual<typeof import("../../../services/api")>("../../../services/api");
  return { ...actual, listWines: vi.fn() };
});

function Probe({ filter }: { filter: CountFilter | null }) {
  const count = useCatalogCount(filter);
  return <p data-testid="count">{count === null ? "none" : String(count)}</p>;
}

const text = () => screen.getByTestId("count").textContent;

beforeEach(() => {
  clearCatalogCountCache();
  vi.mocked(api.listWines).mockReset();
});

describe("useCatalogCount", () => {
  it("is null while loading, then the total", async () => {
    vi.mocked(api.listWines).mockResolvedValue({ total: 13, items: [] });
    render(<Probe filter={{ region: "Bordeaux" }} />);
    expect(text()).toBe("none");
    expect(await screen.findByText("13")).toBeInTheDocument();
    expect(api.listWines).toHaveBeenCalledWith({ region: "Bordeaux", limit: 1 });
  });

  it("asks by country too", async () => {
    vi.mocked(api.listWines).mockResolvedValue({ total: 30, items: [] });
    render(<Probe filter={{ country: "France" }} />);
    expect(await screen.findByText("30")).toBeInTheDocument();
    expect(api.listWines).toHaveBeenCalledWith({ country: "France", limit: 1 });
  });

  it("stays null on error", async () => {
    vi.mocked(api.listWines).mockRejectedValue(new Error("down"));
    render(<Probe filter={{ region: "Bordeaux" }} />);
    await act(async () => {});
    expect(text()).toBe("none");
  });

  it("does nothing for a null filter", () => {
    render(<Probe filter={null} />);
    expect(text()).toBe("none");
    expect(api.listWines).not.toHaveBeenCalled();
  });

  it("reuses a cached count without asking again", async () => {
    vi.mocked(api.listWines).mockResolvedValue({ total: 13, items: [] });
    const first = render(<Probe filter={{ region: "Bordeaux" }} />);
    await screen.findByText("13");
    first.unmount();
    render(<Probe filter={{ region: "Bordeaux" }} />);
    expect(text()).toBe("13");
    expect(api.listWines).toHaveBeenCalledTimes(1);
  });

  it("ignores a response for a filter it has moved on from", async () => {
    let resolveFirst!: (value: { total: number; items: [] }) => void;
    vi.mocked(api.listWines)
      .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
      .mockResolvedValueOnce({ total: 4, items: [] });
    const view = render(<Probe filter={{ region: "Bordeaux" }} />);
    view.rerender(<Probe filter={{ region: "Burgundy" }} />);
    expect(await screen.findByText("4")).toBeInTheDocument();
    await act(async () => resolveFirst({ total: 13, items: [] }));
    expect(text()).toBe("4");
  });
});
