import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AdminGate } from "./AdminGate";
import { stubMatchMedia } from "../../test/stubs";

vi.mock("../../services/adminApi", () => ({ checkAdminAccess: vi.fn() }));
import { checkAdminAccess } from "../../services/adminApi";

function renderGate() {
  stubMatchMedia({ reducedMotion: true });
  render(
    <MemoryRouter initialEntries={["/admin"]}>
      <AdminGate>
        <p>Admin tools</p>
      </AdminGate>
    </MemoryRouter>
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.mocked(checkAdminAccess).mockReset();
  document.title = "VinoScope";
});

describe("AdminGate", () => {
  it("in development shows admin without asking", () => {
    renderGate();
    expect(screen.getByText("Admin tools")).toBeInTheDocument();
    expect(checkAdminAccess).not.toHaveBeenCalled();
  });

  it("in production shows admin when nginx says you're at home", async () => {
    vi.stubEnv("DEV", false);
    vi.mocked(checkAdminAccess).mockResolvedValue(true);
    renderGate();
    expect(await screen.findByText("Admin tools")).toBeInTheDocument();
  });

  it("in production shows the 404 page otherwise, and nothing admin while checking", async () => {
    vi.stubEnv("DEV", false);
    let resolve!: (value: boolean) => void;
    vi.mocked(checkAdminAccess).mockReturnValue(new Promise((r) => (resolve = r)));
    renderGate();
    expect(screen.queryByText("Admin tools")).toBeNull();
    resolve(false);
    expect(await screen.findByRole("heading", { level: 1, name: "Well, that spilled." })).toBeInTheDocument();
    expect(screen.queryByText("Admin tools")).toBeNull();
  });
});
