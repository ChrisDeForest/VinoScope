import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { VineStage } from "./VineStage";
import { VINE_STAGES } from "../../../content/learn/vine";

const CRUSH = VINE_STAGES.find((stage) => stage.id === "crush")!;
const GLASS = VINE_STAGES.find((stage) => stage.id === "glass")!;

function renderStage(stage = CRUSH, index = 2) {
  return render(
    <MemoryRouter>
      <ol>
        <VineStage stage={stage} index={index} />
      </ol>
    </MemoryRouter>
  );
}

describe("VineStage", () => {
  it("renders the step number, heading and copy", () => {
    renderStage();
    // Callouts are nested list items, so find the stage item through its heading.
    expect(screen.getByRole("heading", { level: 3, name: "Crush & Press" })).toHaveClass("scroll-mt-24");
    const item = screen.getByRole("heading", { level: 3, name: "Crush & Press" }).closest("li")!;
    expect(within(item).getByText("Step 3")).toBeInTheDocument();
    expect(item).toHaveTextContent("What happens");
    expect(item).toHaveTextContent(CRUSH.what);
    expect(item).toHaveTextContent("Why it matters");
    expect(item).toHaveTextContent(CRUSH.why);
  });

  it("renders a callout per style difference", () => {
    renderStage();
    expect(screen.getByRole("link", { name: "Explore white wines" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explore rosé wines" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explore red wines" })).toBeInTheDocument();
  });

  it("hides the art and the spine node from assistive technology", () => {
    renderStage();
    expect(screen.getByTestId("stage-art")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("stage-node")).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps the node's rotation off the animated .pop span", () => {
    renderStage();
    const node = screen.getByTestId("stage-node");
    expect(node).toHaveClass("rotate-45");
    expect(node.firstElementChild).toHaveClass("pop");
    expect(node.firstElementChild).not.toHaveClass("rotate-45");
  });

  it("puts the art on the right for even stages and the left for odd ones", () => {
    const { unmount } = renderStage(CRUSH, 2);
    expect(screen.getByTestId("stage-art")).toHaveClass("md:order-last");
    unmount();
    renderStage(CRUSH, 3);
    expect(screen.getByTestId("stage-art")).not.toHaveClass("md:order-last");
  });

  it("renders the closing link back to How to Taste", () => {
    renderStage(GLASS, 6);
    expect(screen.getByRole("link", { name: "Now taste it: How to Taste" })).toHaveAttribute("href", "#taste");
  });
});
