import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuizStage, type QuizStep } from "./QuizStage";

const STEPS: QuizStep[] = [
  { id: "a", question: "First question?", hint: "Hint one", summary: "Answer A", content: <p>Content A</p> },
  { id: "b", question: "Second question?", summary: "Answer B", content: <p>Content B</p> },
  { id: "c", question: "Third question?", summary: "Answer C", content: <p>Content C</p> },
];

function Harness({ onFinish = () => {} }: { onFinish?: () => void }) {
  const [current, setCurrent] = useState(0);
  return (
    <QuizStage
      steps={STEPS}
      current={current}
      onJump={setCurrent}
      onContinue={() => (current === STEPS.length - 1 ? onFinish() : setCurrent(current + 1))}
      continueLabel={current === STEPS.length - 1 ? "Finish" : undefined}
    />
  );
}

describe("QuizStage", () => {
  it("shows the first question with its hint, counter and no Back", () => {
    render(<Harness />);
    expect(screen.getByRole("heading", { level: 2, name: "First question?" })).toBeInTheDocument();
    expect(screen.getByText("Hint one")).toBeInTheDocument();
    expect(screen.getByText("Question 1 of 3")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "← Back" })).not.toBeInTheDocument();
    expect(screen.getByText("Content A")).toBeInTheDocument();
  });

  it("continues, shows answered chips and moves focus to the new question", async () => {
    render(<Harness />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    const heading = screen.getByRole("heading", { level: 2, name: "Second question?" });
    expect(heading).toHaveFocus();
    expect(screen.getByText("Question 2 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Change answer: First question\?.*Answer A/ })).toBeInTheDocument();
    expect(screen.queryByText(/Answer B/)).not.toBeInTheDocument();
  });

  it("does not steal focus on first render", () => {
    render(<Harness />);
    expect(screen.getByRole("heading", { level: 2 })).not.toHaveFocus();
  });

  it("jumps back with a chip or the Back button", async () => {
    render(<Harness />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "← Back" }));
    expect(screen.getByRole("heading", { level: 2, name: "Second question?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Change answer: First question\?/ }));
    expect(screen.getByRole("heading", { level: 2, name: "First question?" })).toBeInTheDocument();
  });

  it("uses the custom label on the last step and respects disabled", async () => {
    const onFinish = vi.fn();
    const { rerender } = render(<Harness onFinish={onFinish} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Finish" }));
    expect(onFinish).toHaveBeenCalledTimes(1);
    rerender(<QuizStage steps={STEPS} current={0} onJump={() => {}} onContinue={onFinish} continueDisabled />);
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });
});
