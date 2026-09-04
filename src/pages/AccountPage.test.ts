import { describe, expect, it } from "vitest";
import { validateNewPassword } from "./AccountPage";

describe("validateNewPassword", () => {
  it("requires at least 12 characters", () => {
    expect(validateNewPassword("short", "short")).toContain("12 characters");
  });

  it("requires matching values", () => {
    expect(validateNewPassword("a-secure-password", "a-different-password")).toContain("do not match");
  });

  it("accepts a matching long password", () => {
    expect(validateNewPassword("a-secure-password", "a-secure-password")).toBe("");
  });
});
