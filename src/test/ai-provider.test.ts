import { describe, expect, it, vi } from "vitest";
import { getAIProviderConfig, requestAIChat } from "@/lib/ai/provider.server";

describe("server AI provider configuration", () => {
  it("uses Kilo anonymously only when explicitly enabled in local development", async () => {
    expect(getAIProviderConfig({ NODE_ENV: "development", AI_PROVIDER: "kilo" })).toMatchObject({ provider: "kilo", model: "nvidia/nemotron-3.5-super-vl:free", apiKey: "" });
    expect(() => getAIProviderConfig({ NODE_ENV: "production", AI_PROVIDER: "kilo" })).toThrow(/only in local development/);
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] })));
    await requestAIChat([{ role: "user", content: "Hi" }], { env: { NODE_ENV: "development", AI_PROVIDER: "kilo" }, fetch });
    expect(fetch.mock.calls[0]?.[1]?.headers).not.toHaveProperty("Authorization");
  });
  it("uses direct Cloudflare only when explicitly enabled in development", () => {
    expect(
      getAIProviderConfig({
        NODE_ENV: "development",
        AI_PROVIDER: "cloudflare",
        CLOUDFLARE_API_TOKEN: "local-key",
        CLOUDFLARE_ACCOUNT_ID: "0123456789abcdef0123456789abcdef",
      }),
    ).toMatchObject({
      provider: "cloudflare",
      endpoint:
        "https://api.cloudflare.com/client/v4/accounts/0123456789abcdef0123456789abcdef/ai/v1/chat/completions",
      model: "@cf/google/gemma-4-26b-a4b-it",
    });
    expect(() =>
      getAIProviderConfig({
        NODE_ENV: "production",
        AI_PROVIDER: "cloudflare",
        CLOUDFLARE_API_TOKEN: "local-key",
        CLOUDFLARE_ACCOUNT_ID: "0123456789abcdef0123456789abcdef",
      }),
    ).toThrow(/only in local development/);
    expect(() =>
      getAIProviderConfig({ NODE_ENV: "development", AI_PROVIDER: "cloudflare" }),
    ).toThrow(/CLOUDFLARE_API_TOKEN/);
  });

  it("prefers the Lovable gateway whenever a managed key is present", () => {
    expect(
      getAIProviderConfig({
        NODE_ENV: "development",
        AI_PROVIDER: "cloudflare",
        CLOUDFLARE_API_TOKEN: "local-key",
        CLOUDFLARE_ACCOUNT_ID: "0123456789abcdef0123456789abcdef",
        LOVABLE_API_KEY: "lovable-key",
      }),
    ).toMatchObject({
      provider: "lovable",
      endpoint: "https://ai.gateway.lovable.dev/v1/chat/completions",
      apiKey: "lovable-key",
    });
    expect(() =>
      getAIProviderConfig({ NODE_ENV: "development", CLOUDFLARE_API_TOKEN: "local-key" }),
    ).toThrow(/LOVABLE_API_KEY/);
  });

  it("sends a server request to the selected provider without exposing provider errors", async () => {
    const mockFetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: "Hello" } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const result = await requestAIChat([{ role: "user", content: "Hi" }], {
      env: {
        NODE_ENV: "development",
        AI_PROVIDER: "cloudflare",
        CLOUDFLARE_API_TOKEN: "local-key",
        CLOUDFLARE_ACCOUNT_ID: "0123456789abcdef0123456789abcdef",
      },
      fetch: mockFetch,
    });
    expect(result).toBe("Hello");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/accounts/0123456789abcdef0123456789abcdef/ai/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer local-key" }),
      }),
    );
  });
  it("distinguishes exhausted quota without exposing provider error details", async () => {
    const mockFetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ error: { code: "insufficient_quota", message: "private details" } }),
          { status: 429 },
        ),
    );
    await expect(
      requestAIChat([{ role: "user", content: "Hi" }], {
        env: {
          NODE_ENV: "development",
          AI_PROVIDER: "cloudflare",
          CLOUDFLARE_API_TOKEN: "key",
          CLOUDFLARE_ACCOUNT_ID: "0123456789abcdef0123456789abcdef",
        },
        fetch: mockFetch,
      }),
    ).rejects.toThrow("AI provider quota is exhausted. Check API billing and credits.");
  });
  it("explains Kilo's anonymous promotional limit", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ error: { code: "PROMOTION_MODEL_LIMIT_REACHED" } }), { status: 429 }));
    await expect(requestAIChat([{ role: "user", content: "Hi" }], { env: { NODE_ENV: "development", AI_PROVIDER: "kilo" }, fetch })).rejects.toThrow(/anonymous Kilo allowance is exhausted/);
  });
});
