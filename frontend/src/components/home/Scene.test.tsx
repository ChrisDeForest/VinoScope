import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Scene, SceneCta } from "./Scene";
import { stubMatchMedia, stubIntersectionObserver } from "../../test/stubs";

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderScene(side: "left" | "right" = "left") {
  return render(
    <MemoryRouter>
      <Scene id="discover" index={2} label="Discover" title="Find your wine profile." side={side} art={<svg data-testid="art-svg" />}>
        <p>Body copy</p>
        <SceneCta to="/discover">Find Your Profile</SceneCta>
      </Scene>
    </MemoryRouter>
  );
}

describe("Scene", () => {
  it("renders a labelled section with its label, heading, body, and CTA", () => {
    renderScene();
    const section = screen.getByRole("region", { name: "Find your wine profile." });
    expect(section).toHaveAttribute("id", "discover");
    expect(screen.getByText("02 · Discover")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Find your wine profile." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Find Your Profile" })).toHaveAttribute("href", "/discover");
  });

  it("hides the art from assistive technology", () => {
    renderScene();
    expect(screen.getByTestId("scene-art")).toHaveAttribute("aria-hidden", "true");
  });

  it("adds is-visible once the scene intersects the viewport", () => {
    stubMatchMedia({ reducedMotion: false });
    const { fire } = stubIntersectionObserver();
    renderScene();
    const section = screen.getByRole("region", { name: "Find your wine profile." });
    expect(section).toHaveClass("scene-animate");
    expect(section).not.toHaveClass("is-visible");
    fire(0, true);
    expect(section).toHaveClass("is-visible");
  });

  it("omits scene-animate under reduced motion so the final state renders", () => {
    stubMatchMedia({ reducedMotion: true });
    stubIntersectionObserver();
    renderScene();
    expect(screen.getByRole("region", { name: "Find your wine profile." })).not.toHaveClass("scene-animate");
  });

  it("moves the art to the right column only for right-side scenes", () => {
    const { unmount } = renderScene("right");
    expect(screen.getByTestId("scene-art")).toHaveClass("md:order-last");
    unmount();
    renderScene("left");
    expect(screen.getByTestId("scene-art")).not.toHaveClass("md:order-last");
  });
});
