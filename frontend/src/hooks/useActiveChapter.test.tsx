import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { useActiveChapter } from "./useActiveChapter";
import { stubIntersectionObserver, type FakeIntersectionObserverInstance } from "../test/stubs";

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

function entry(id: string, isIntersecting: boolean, top = 0) {
  return {
    isIntersecting,
    target: document.getElementById(id)!,
    boundingClientRect: { top } as DOMRect,
  } as unknown as IntersectionObserverEntry;
}

function deliver(instance: FakeIntersectionObserverInstance, entries: IntersectionObserverEntry[]) {
  act(() => {
    instance.callback(entries, instance as unknown as IntersectionObserver);
  });
}

describe("useActiveChapter", () => {
  it("starts on the first chapter and follows the intersecting one", () => {
    const { instances } = stubIntersectionObserver();
    render(<Probe ids={["taste", "vine"]} />);
    expect(screen.getByTestId("active")).toHaveTextContent("taste");
    expect(instances[0].observe).toHaveBeenCalledTimes(2);
    deliver(instances[0], [entry("vine", true)]);
    expect(screen.getByTestId("active")).toHaveTextContent("vine");
  });

  it("ignores entries that are leaving view", () => {
    const { instances } = stubIntersectionObserver();
    render(<Probe ids={["taste", "vine"]} />);
    deliver(instances[0], [entry("vine", false)]);
    expect(screen.getByTestId("active")).toHaveTextContent("taste");
  });

  it("picks the entry nearest the band when two arrive together", () => {
    vi.stubGlobal("innerHeight", 1000); // band top = 200px
    const { instances } = stubIntersectionObserver();
    render(<Probe ids={["taste", "vine"]} />);
    deliver(instances[0], [entry("vine", true, 500), entry("taste", true, 210)]);
    expect(screen.getByTestId("active")).toHaveTextContent("taste");
    deliver(instances[0], [entry("taste", true, -400), entry("vine", true, 190)]);
    expect(screen.getByTestId("active")).toHaveTextContent("vine");
  });

  it("stays on the first chapter without IntersectionObserver", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<Probe ids={["taste", "vine"]} />);
    expect(screen.getByTestId("active")).toHaveTextContent("taste");
  });
});
