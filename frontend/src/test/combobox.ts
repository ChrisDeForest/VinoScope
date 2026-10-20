import { screen, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";

/** Opens a `ComboBox` field and picks the option with this visible name. */
export async function chooseOption(user: UserEvent, field: HTMLElement, name: string | RegExp): Promise<void> {
  await user.click(field);
  await user.click(await screen.findByRole("option", { name }));
}

/** Opens a `ComboBox` field, reads its option names, then closes it again with Escape. */
export async function readOptions(user: UserEvent, field: HTMLElement): Promise<string[]> {
  await user.click(field);
  const names = within(screen.getByRole("listbox")).getAllByRole("option").map((option) => option.textContent ?? "");
  await user.keyboard("{Escape}");
  return names;
}
