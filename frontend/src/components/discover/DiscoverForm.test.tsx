import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DiscoverForm } from "./DiscoverForm";

describe("DiscoverForm", () => {
  it("pre-fills from initialAnswers", () => {
    render(<DiscoverForm initialAnswers={{ type: "red", sweetness: 1 }} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText("Wine type")).toHaveValue("red");
    expect(screen.getByLabelText("Very dry")).toBeChecked();
  });

  it("submits the current draft answers, including edits made after mount", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<DiscoverForm initialAnswers={{}} onSubmit={onSubmit} />);

    await user.selectOptions(screen.getByLabelText("Wine type"), "red");
    await user.click(screen.getByLabelText("High tannin"));
    await user.click(screen.getByRole("button", { name: "See My Recommendations" }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ type: "red", tannin: 5 }));
  });

  it("omits a dimension from the submitted answers when left on 'I'm unsure'", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<DiscoverForm initialAnswers={{}} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: "See My Recommendations" }));
    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted.sweetness).toBeUndefined();
  });
});
