import { describe, expect, it } from "vitest";
import { signInFailureMessage } from "./LoginPage";

describe("signInFailureMessage", () => {
  it("explains the Supabase email rate limit", () => {
    expect(signInFailureMessage({ status: 429, code: "over_email_send_rate_limit" }))
      .toContain("Wait up to one hour");
  });

  it("explains when production email delivery is not configured", () => {
    expect(signInFailureMessage({ code: "email_address_not_authorized" }))
      .toContain("production email service");
  });

  it("keeps other authentication failures private", () => {
    expect(signInFailureMessage({ code: "user_not_found" }))
      .toBe("That email is not invited, or the sign-in link could not be sent.");
  });
});
