import { describe, it, expect, beforeEach } from "vitest";
import { getAdminKey, setAdminKey, clearAdminKey } from "./adminAuth";

describe("adminAuth", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("returns null when no key is stored", () => {
    expect(getAdminKey()).toBeNull();
  });

  it("stores and retrieves a key", () => {
    setAdminKey("secret123");
    expect(getAdminKey()).toBe("secret123");
  });

  it("clears a stored key", () => {
    setAdminKey("secret123");
    clearAdminKey();
    expect(getAdminKey()).toBeNull();
  });
});
