import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DiscoverForm } from "./DiscoverForm";

describe("DiscoverForm", () => {
  it("steps prices without going below zero or submitting the form", async () => {
    const user = userEvent.setup();
    const submit = vi.fn();
    render(<DiscoverForm initialAnswers={{ min_price: 0, max_price: 20 }} onSubmit={submit} />);
    await user.click(screen.getByRole("button", { name: "Decrease min price" }));
    expect(screen.getByLabelText("Min price")).toHaveValue(0);
    await user.click(screen.getByRole("button", { name: "Increase min price" }));
    expect(screen.getByLabelText("Min price")).toHaveValue(1);
    await user.click(screen.getByRole("button", { name: "Decrease max price" }));
    expect(screen.getByLabelText("Max price")).toHaveValue(19);
    expect(submit).not.toHaveBeenCalled();
  });
  it("keeps multiple levels selected and supports clearing them", async () => {
    const user = userEvent.setup();
    render(<DiscoverForm initialAnswers={{}} onSubmit={vi.fn()} />);
    const dry = screen.getByLabelText("Dry");
    const sweet = screen.getByLabelText("Sweet");
    await user.click(dry);
    await user.click(sweet);
    expect(dry).toBeChecked();
    expect(sweet).toBeChecked();
    await user.click(dry);
    expect(dry).not.toBeChecked();
    expect(sweet).toBeChecked();
    await user.click(screen.getAllByLabelText("I'm unsure")[0]);
    expect(sweet).not.toBeChecked();
  });
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

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ type: "red", tannin: [5] }));
  });

  it("omits a dimension from the submitted answers when left on 'I'm unsure'", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<DiscoverForm initialAnswers={{}} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: "See My Recommendations" }));
    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted.sweetness).toBeUndefined();
  });

  it("disables the submit button and shows a loading label while submitting", () => {
    render(<DiscoverForm initialAnswers={{}} onSubmit={vi.fn()} submitting />);
    const button = screen.getByRole("button", { name: "Finding wines…" });
    expect(button).toBeDisabled();
    expect(screen.queryByRole("button", { name: "See My Recommendations" })).not.toBeInTheDocument();
  });

  it("keeps the submit button enabled by default when submitting is not passed", () => {
    render(<DiscoverForm initialAnswers={{}} onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "See My Recommendations" })).toBeEnabled();
  });
});
