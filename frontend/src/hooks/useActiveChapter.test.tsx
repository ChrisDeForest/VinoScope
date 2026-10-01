import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { useActiveChapter } from "./useActiveChapter";
import { stubIntersectionObserver } from "../test/stubs";

afterEach(() => {
  vi.unstubAllGlobals();
});

function Probe({ ids }: { ids: string[] }) {
  const active = useActiveChapter(ids);
  return (
    <>
      {ids.map((id) => (
        <section key={id} id={id} />
      ))}
      <p data-testid="active">{active ?? "none"}</p>
    </>
  );
}

describe("useActiveChapter", () => {
  it("starts on the first chapter and follows the intersecting one", () => {
    const { instances } = stubIntersectionObserver();
    render(<Probe ids={["taste", "vine"]} />);
    expect(screen.getByTestId("active")).toHaveTextContent("taste");
    expect(instances[0].observe).toHaveBeenCalledTimes(2);

    act(() => {
      instances[0].callback(
        [{ isIntersecting: true, target: document.getElementById("vine")! } as unknown as IntersectionObserverEntry],
        instances[0] as unknown as IntersectionObserver
      );
    });
    expect(screen.getByTestId("active")).toHaveTextContent("vine");
  });

  it("ignores entries that are leaving view", () => {
    const { instances } = stubIntersectionObserver();
    render(<Probe ids={["taste", "vine"]} />);
    act(() => {
      instances[0].callback(
        [{ isIntersecting: false, target: document.getElementById("vine")! } as unknown as IntersectionObserverEntry],
        instances[0] as unknown as IntersectionObserver
      );
    });
    expect(screen.getByTestId("active")).toHaveTextContent("taste");
  });

  it("stays on the first chapter without IntersectionObserver", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<Probe ids={["taste", "vine"]} />);
    expect(screen.getByTestId("active")).toHaveTextContent("taste");
  });
});
