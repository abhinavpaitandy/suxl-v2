import { describe, expect, it, vi } from "vitest";
import { createPilotProfiles } from "@/lib/ai/pilot-personas";
import { runScreenshotPilot } from "@/lib/ai/pilot-client";

vi.mock("@/lib/ai/visual-client", () => ({ imageTiles: vi.fn(async () => [{ start: 0, end: 1, image: "image" }]) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }));
vi.mock("@/lib/ai/pilot-cache", () => {
  const values = new Map<string, unknown>();
  return { pilotCacheKey: async (input: unknown) => JSON.stringify(input), readPilotCache: (key: string) => values.get(key), writePilotCache: (key: string, value: unknown) => { values.set(key, value); return true; }, removePilotCache: (key: string) => values.delete(key) };
});
const attentionPath = [{ x: 0.2, y: 0.3 }, { x: 0.5, y: 0.7 }];

describe("synthetic pilot profiles", () => {
  it.each(["low", "medium", "high"] as const)("creates 1000 distinct reproducible %s profiles", (diversity) => {
    const profiles = createPilotProfiles(1000, diversity);
    expect(new Set(profiles).size).toBe(1000);
    expect(profiles).toEqual(createPilotProfiles(1000, diversity));
    expect(profiles.every((profile) => /Age .*; (woman|man|non-binary|gender not specified); location /.test(profile))).toBe(true);
  });

  it("covers ten different first-action strategies at high diversity without prescribing an outcome", () => {
    const profiles = createPilotProfiles(10, "high");
    const strategies = profiles.map((profile) => profile.split("; ").at(-1));
    expect(new Set(strategies).size).toBe(10);
    expect(profiles.some((profile) => profile.includes("visually similar controls"))).toBe(true);
    expect(profiles.some((profile) => profile.includes("may hesitate"))).toBe(true);
    expect(profiles.every((profile) => !/will (click|fail|succeed)/i.test(profile))).toBe(true);
  });

  it("sends each unique profile once per variant and pairs the same profiles", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      if (url === "/api/pilot-cache-context") return new Response(JSON.stringify({ provider: "test", model: "test-1" }), { status: 200 });
      if (url === "/api/pilot-personas") {
        const seeds: string[] = JSON.parse(init.body as string).seeds;
        return new Response(JSON.stringify({ profiles: seeds.map((seed) => `A style-focused shopper who compares options: ${seed}`) }), { status: 200 });
      }
      calls.push(JSON.parse(init.body as string).profile);
      return new Response(JSON.stringify({ action: "click", x: 0.5, y: 0.5, reason: "Selected", attentionPath }), { status: 200 });
    }));
    try {
      const trace: string[] = [];
      const result = await runScreenshotPilot({
        variants: [{ id: "a", screenshotUrl: "/a" }, { id: "b", screenshotUrl: "/b" }] as Parameters<typeof runScreenshotPilot>[0]["variants"],
        persona: "Fashion Aspirer", task: "Add to bag", runsPerVariant: 10, diversity: "medium", signal: new AbortController().signal, onProgress: () => {}, onTrace: (event) => trace.push(event.message),
      });
      expect(calls).toHaveLength(20);
      const a = result.filter((run) => run.variantId === "a").sort((x, y) => x.run - y.run);
      const b = result.filter((run) => run.variantId === "b").sort((x, y) => x.run - y.run);
      expect(new Set(a.map((run) => run.profile)).size).toBe(10);
      expect(a.map((run) => run.profile)).toEqual(b.map((run) => run.profile));
      expect(trace).toContain("Generating people 1–2 of 10.");
      expect(trace).toContain("Generated 10 personas. Starting 20 independent screenshot decisions.");
      expect(trace.some((event) => event.includes("persona 1: click (50.0%, 50.0%)"))).toBe(true);
    } finally { vi.unstubAllGlobals(); }
  });

  it("runs an already reviewed cohort without regenerating it", async () => {
    const profiles = createPilotProfiles(10, "medium");
    const fetch = vi.fn(async (url: string) => {
      if (url === "/api/pilot-cache-context") return new Response(JSON.stringify({ provider: "test", model: "test-2" }), { status: 200 });
      expect(url).toBe("/api/screenshot-pilot");
      return new Response(JSON.stringify({ action: "no_action", reason: "Could not decide", attentionPath }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetch);
    try {
      const result = await runScreenshotPilot({ variants: [{ id: "a", screenshotUrl: "/a" }, { id: "b", screenshotUrl: "/b" }] as Parameters<typeof runScreenshotPilot>[0]["variants"], persona: "Fashion Aspirer", task: "Add to bag", runsPerVariant: 10, diversity: "medium", profiles, signal: new AbortController().signal, onProgress: () => {} });
      expect(fetch).toHaveBeenCalledTimes(21);
      expect(result).toHaveLength(20);
      expect(result.filter((run) => run.variantId === "a").map((run) => run.profile)).toEqual(profiles);
    } finally { vi.unstubAllGlobals(); }
  });

  it("resumes completed people batches and screenshot decisions after failures", async () => {
    const counts = { people: 0, decisions: 0 };
    let failPeople = true, failDecision = true;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      if (url === "/api/pilot-cache-context") return new Response(JSON.stringify({ provider: "test", model: "resume" }));
      if (url === "/api/pilot-personas") {
        counts.people++;
        if (failPeople && counts.people === 2) return new Response(JSON.stringify({ error: "temporary" }), { status: 503 });
        const seeds: string[] = JSON.parse(init.body as string).seeds;
        return new Response(JSON.stringify({ profiles: seeds.map((seed) => `A distinctive fashion shopper: ${seed}`) }));
      }
      counts.decisions++;
      if (failDecision && counts.decisions === 3) return new Response(JSON.stringify({ error: "temporary" }), { status: 503 });
      return new Response(JSON.stringify({ action: "click", x: 0.5, y: 0.5, reason: "Selected", attentionPath }));
    }));
    try {
      const options = { variants: [{ id: "a", screenshotUrl: "/a" }, { id: "b", screenshotUrl: "/b" }] as Parameters<typeof runScreenshotPilot>[0]["variants"], persona: "resume persona", task: "resume task", runsPerVariant: 4, diversity: "medium" as const, signal: new AbortController().signal, onProgress: () => {} };
      await expect(runScreenshotPilot(options)).rejects.toThrow("temporary");
      failPeople = false;
      await expect(runScreenshotPilot(options)).rejects.toThrow("temporary");
      expect(counts.people).toBe(3); // first batch was reused
      const before = counts.decisions;
      failDecision = false;
      const result = await runScreenshotPilot(options);
      expect(result).toHaveLength(8);
      expect(counts.people).toBe(3);
      expect(counts.decisions - before).toBeLessThan(8);
    } finally { vi.unstubAllGlobals(); }
  });
});
