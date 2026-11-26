import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { compareScreenshots } from "@/lib/ai/visual-client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}));

const variants = ["a", "b"].map((id) => ({ id, name: id, screenshotUrl: `/demo/${id}.png` }));
const result = { observations: [{ title: "Button", detail: "The labels differ." }], targets: [] };

beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal(
    "Image",
    class {
      src = "";
      naturalWidth = 100;
      naturalHeight = 100;
      async decode() {}
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    fillStyle: "",
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/jpeg;base64,AAAA");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("visual comparison cache", () => {
  it("reuses matching results and calls the API again when the task changes", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(result), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(compareScreenshots(variants, "Buy", "Add")).resolves.toEqual(result);
    await expect(compareScreenshots(variants, "Buy", "Add")).resolves.toEqual(result);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await compareScreenshots(variants, "Find size", "Add");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("does not cache errors", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ error: "Unavailable" }), { status: 503 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(compareScreenshots(variants, "Buy", "Add")).rejects.toThrow("Unavailable");
    await expect(compareScreenshots(variants, "Buy", "Add")).rejects.toThrow("Unavailable");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
