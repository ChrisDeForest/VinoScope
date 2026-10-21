import { describe, it, expect, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { usePageMeta } from "./usePageMeta";

function Probe({ noindex }: { noindex?: boolean }) {
  usePageMeta({ title: "Page not found · VinoScope", noindex });
  return null;
}

const robots = () => document.head.querySelector('meta[name="robots"]');

beforeEach(() => {
  document.title = "VinoScope";
});

describe("usePageMeta", () => {
  it("sets the title while mounted and restores it after", () => {
    const { unmount } = render(<Probe />);
    expect(document.title).toBe("Page not found · VinoScope");
    unmount();
    expect(document.title).toBe("VinoScope");
  });

  it("adds a noindex robots tag only while mounted", () => {
    const { unmount } = render(<Probe noindex />);
    expect(robots()).toHaveAttribute("content", "noindex");
    unmount();
    expect(robots()).toBeNull();
  });

  it("adds no robots tag unless asked", () => {
    render(<Probe />);
    expect(robots()).toBeNull();
  });
});
