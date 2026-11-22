import { describe, expect, it } from "vitest";

import { oauthReturnPath } from "@/lib/oauth-return-path";

describe("oauthReturnPath", () => {
  it("preserves a same-origin consent path with its authorization ID", () => {
    expect(oauthReturnPath("/.lovable/oauth/consent?authorization_id=abc123")).toBe(
      "/.lovable/oauth/consent?authorization_id=abc123",
    );
  });

  it("rejects network-path redirects", () => {
    expect(oauthReturnPath("//outside.invalid/steal")).toBe("/");
  });

  it("rejects backslash-based external redirects", () => {
    expect(oauthReturnPath("/\\outside.invalid/steal")).toBe("/");
  });

  it("rejects control characters", () => {
    expect(oauthReturnPath("/login\nnext")).toBe("/");
  });

  it("falls back to the dashboard for absolute external URLs", () => {
    expect(oauthReturnPath("https://outside.invalid/steal")).toBe("/");
  });
});
