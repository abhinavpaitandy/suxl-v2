import { describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { EXAMPLE_BACKUP_PREFIX, isCompletedDemo, normalizeCompletedDemo, saveCompletedExample, SAVED_EXAMPLE_KEY } from "@/lib/saved-example";
import { DEMO_VARIANTS } from "@/lib/demo-variants";
import type { ExperimentDraft } from "@/lib/types";

describe("saved example eligibility", () => {
  const draft = {
    name: "PDP page comparison with comparable product detail",
    variants: DEMO_VARIANTS.map((v) => ({ ...v, detectedTarget: { label: "ADD", status: "confirmed", boundingBox: { x: 0, y: 0, width: 0.1, height: 0.1 } } })),
    pilotRuns: DEMO_VARIANTS.flatMap((v) => Array.from({ length: 10 }, (_, run) => ({ variantId: v.id, run, profile: `person ${run}`, outcome: { action: "no_action", reason: "unsure" } }))),
    simulatedClicks: [], visualObservations: [],
  } as unknown as ExperimentDraft;
  it("accepts a completed reviewed paired demo", () => expect(isCompletedDemo(draft)).toBe(true));
  it("does not promote incomplete or different experiments", () => {
    expect(isCompletedDemo({ ...draft, pilotRuns: draft.pilotRuns!.slice(1) })).toBe(false);
    expect(isCompletedDemo({ ...draft, name: "A renamed demo" })).toBe(true);
    expect(isCompletedDemo({ ...draft, variants: draft.variants.map((v) => ({ ...v, detectedTarget: undefined })) })).toBe(false);
  });
  it("saves the complete draft and does not replace it with a partial pilot", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
    localStorage.removeItem(SAVED_EXAMPLE_KEY);
    expect(saveCompletedExample(draft)).toBe(true);
    expect(JSON.parse(localStorage.getItem(SAVED_EXAMPLE_KEY)!).draft).toEqual(draft);
    expect(saveCompletedExample({ ...draft, pilotRuns: draft.pilotRuns!.slice(1) })).toBe(false);
    expect(JSON.parse(localStorage.getItem(SAVED_EXAMPLE_KEY)!).draft).toEqual(draft);
    const previous = localStorage.getItem(SAVED_EXAMPLE_KEY);
    expect(saveCompletedExample({ ...draft, name: "Updated demo" })).toBe(true);
    expect([...values.entries()].find(([key]) => key.startsWith(EXAMPLE_BACKUP_PREFIX))?.[1]).toBe(previous);
    vi.unstubAllGlobals();
  });
  it("accepts an uploaded image only when its bytes match the bundled image", async () => {
    vi.stubGlobal("crypto", webcrypto);
    vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, arrayBuffer: async () => new Uint8Array(url === "data:image/png;base64,wrong" ? [2] : [1]) })));
    const uploaded = { ...draft, variants: draft.variants.map((variant, index) => index === 0 ? { ...variant, screenshotUrl: "data:image/png;base64,matching" } : variant) };
    expect((await normalizeCompletedDemo(uploaded))?.variants[0]?.screenshotUrl).toBe(DEMO_VARIANTS[0].screenshotUrl);
    expect(await normalizeCompletedDemo({ ...uploaded, variants: uploaded.variants.map((variant, index) => index === 0 ? { ...variant, screenshotUrl: "data:image/png;base64,wrong" } : variant) })).toBeUndefined();
    vi.unstubAllGlobals();
  });
});
