import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { WineImage } from "./WineImage";

describe("WineImage", () => {
  it("shows the bottle uncropped on a themed panel", () => {
    render(<WineImage src="/wines/caymus.webp" alt="Caymus" className="w-full h-48" />);
    const img = screen.getByRole("img", { name: "Caymus" });
    expect(img.getAttribute("src")).toBe("/wines/caymus.webp");
    expect(img.className).toContain("object-contain");
    expect(img.parentElement?.className).toContain("bg-image-panel");
    expect(img.parentElement?.className).toContain("h-48");
  });

  it("uses a placeholder when there is no image", () => {
    render(<WineImage src={null} alt="Caymus" />);
    expect(screen.getByRole("img").getAttribute("src")).toMatch(/^data:image\/svg\+xml/);
  });

  it("swaps a broken image for the placeholder", () => {
    render(<WineImage src="/wines/missing.webp" alt="Caymus" />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByRole("img").getAttribute("src")).toMatch(/^data:image\/svg\+xml/);
  });

  it("resets the failed state when src changes, and treats an empty src as no image", () => {
    const { rerender } = render(<WineImage src="/wines/a.webp" alt="Wine A" />);
    fireEvent.error(screen.getByRole("img", { name: "Wine A" }));
    expect(screen.getByRole("img", { name: "Wine A" }).getAttribute("src")).toMatch(/^data:image\/svg\+xml/);

    rerender(<WineImage src="/wines/b.webp" alt="Wine A" />);
    expect(screen.getByRole("img", { name: "Wine A" }).getAttribute("src")).toBe("/wines/b.webp");

    rerender(<WineImage src="" alt="Wine A" />);
    expect(screen.getByRole("img", { name: "Wine A" }).getAttribute("src")).toMatch(/^data:image\/svg\+xml/);
  });

  it("loads lazily unless eager", () => {
    const { rerender } = render(<WineImage src="/wines/a.webp" alt="A" />);
    expect(screen.getByRole("img").getAttribute("loading")).toBe("lazy");
    rerender(<WineImage src="/wines/a.webp" alt="A" eager />);
    expect(screen.getByRole("img").getAttribute("loading")).toBe("eager");
  });
});
