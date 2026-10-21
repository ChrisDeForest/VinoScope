import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Link, useSearchParams } from "react-router-dom";
import { usePageviews } from "./usePageviews";

vi.mock("../utils/analytics", () => ({ initAnalytics: vi.fn(), trackPageview: vi.fn() }));
import { initAnalytics, trackPageview } from "../utils/analytics";

function Harness() {
  usePageviews();
  const [, setParams] = useSearchParams();
  return (
    <>
      <Link to="/explore?q=malbec">Explore</Link>
      <button type="button" onClick={() => setParams({ q: "syrah" })}>
        Change filter
      </button>
    </>
  );
}

beforeEach(() => vi.mocked(trackPageview).mockClear());

describe("usePageviews", () => {
  it("starts analytics once and records the first page", () => {
    render(
      <MemoryRouter initialEntries={["/learn"]}>
        <Harness />
      </MemoryRouter>
    );
    expect(initAnalytics).toHaveBeenCalledOnce();
    expect(trackPageview).toHaveBeenCalledWith("/learn");
  });

  it("records a page view per page, with its query string", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Harness />
      </MemoryRouter>
    );
    await userEvent.click(screen.getByRole("link", { name: "Explore" }));
    expect(vi.mocked(trackPageview).mock.calls).toEqual([["/"], ["/explore?q=malbec"]]);
  });

  it("does not count filter changes on the same page as new page views", async () => {
    render(
      <MemoryRouter initialEntries={["/explore"]}>
        <Harness />
      </MemoryRouter>
    );
    await userEvent.click(screen.getByRole("button", { name: "Change filter" }));
    expect(trackPageview).toHaveBeenCalledOnce();
  });
});
