import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeVisuals, authorizeVisualRequest } from "@/lib/ai/visual.server";
import { visualResultSchema } from "@/lib/ai/visual-schema";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("visual comparison", () => {
  it("checks the origin and permits local Cloudflare only on localhost", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AI_PROVIDER", "cloudflare");
    vi.stubEnv("LOVABLE_API_KEY", "");
    await expect(
      authorizeVisualRequest(
        new Request("http://127.0.0.1:8080/api/visual-analysis", {
          headers: { host: "127.0.0.1:8080", origin: "http://127.0.0.1:8080" },
        }),
      ),
    ).resolves.toBeUndefined();
    await expect(
      authorizeVisualRequest(
        new Request("http://127.0.0.1:8080/api/visual-analysis", {
          headers: { host: "127.0.0.1:8080", origin: "https://attacker.example" },
        }),
      ),
    ).rejects.toThrow(/origin/);
    await expect(
      authorizeVisualRequest(
        new Request("http://public.example/api/visual-analysis", {
          headers: { host: "public.example", origin: "http://public.example" },
        }),
      ),
    ).rejects.toThrow(/Sign in/);
  });
  it("maps coordinates from a selected slice to the full screenshot", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AI_PROVIDER", "cloudflare");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "test-key");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "0123456789abcdef0123456789abcdef");
    vi.stubEnv("LOVABLE_API_KEY", "");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      observations: [{ title: "Button", detail: "Visible" }],
                      targets: [
                        {
                          id: "a",
                          label: "Add",
                          tileIndex: 1,
                          box: { x: 0.1, y: 0.4, width: 0.8, height: 0.2 },
                          note: "",
                        },
                      ],
                    }),
                  },
                },
              ],
            }),
            { status: 200 },
          ),
      ),
    );
    const tiles = [
      { start: 0, end: 0.5, image: "data:image/jpeg;base64,AAAA" },
      { start: 0.5, end: 1, image: "data:image/jpeg;base64,AAAA" },
    ];
    const result = await analyzeVisuals({
      task: "Buy",
      successEvent: "Add",
      variants: [
        { id: "a", name: "A", tiles },
        { id: "b", name: "B", tiles },
      ],
    });
    expect(result.targets[0]?.box).toEqual({ x: 0.1, y: 0.7, width: 0.8, height: 0.1 });
  });
  it("sends screenshot tiles and returns validated observations and target coordinates", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AI_PROVIDER", "cloudflare");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "test-key");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "0123456789abcdef0123456789abcdef");
    vi.stubEnv("LOVABLE_API_KEY", "");
    const result = {
      observations: [{ title: "Button", detail: "The labels differ." }],
      targets: [
        {
          id: "a",
          label: "Add",
          tileIndex: 0,
          box: { x: 0.1, y: 0.2, width: 0.8, height: 0.1 },
          note: "Review the placement.",
        },
      ],
    };
    const mockFetch = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(
          JSON.stringify({ choices: [{ message: { content: JSON.stringify(result) } }] }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", mockFetch);
    const variants = ["a", "b"].map((id) => ({
      id,
      name: id,
      tiles: [{ start: 0, end: 1, image: "data:image/jpeg;base64,AAAA" }],
    }));
    const actual = await analyzeVisuals({ task: "Buy", successEvent: "Add", variants });
    expect(actual.targets[0]?.box).toEqual(result.targets[0]?.box);
    const body = JSON.parse(String(mockFetch.mock.calls[0]?.[1]?.body));
    expect(
      body.messages[0].content.filter((part: { type: string }) => part.type === "image_url"),
    ).toHaveLength(2);
    expect(() =>
      visualResultSchema.parse({
        ...result,
        targets: [{ ...result.targets[0], box: { x: 0.9, y: 0, width: 0.5, height: 0.1 } }],
      }),
    ).toThrow();
  });
});
