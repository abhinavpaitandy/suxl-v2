import { readFile } from "node:fs/promises";
import { webcrypto } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getUEyesDemoPath } from "@/lib/ueyes-demo-paths";

afterEach(() => vi.unstubAllGlobals());

describe("precomputed UEyes paths", () => {
  it("uses the actual matching H&M and Zara images and rejects changed bytes", async () => {
    vi.stubGlobal("crypto", webcrypto);
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const name = url.includes("hm-product") ? "hm-product-mobile.png" : "zara-product-mobile.png";
      const bytes = await readFile(`public/demo/${name}`);
      return { ok: true, arrayBuffer: async () => bytes };
    }));
    const hm = await getUEyesDemoPath("/demo/hm-product-mobile.png?v=2");
    const zara = await getUEyesDemoPath("/demo/zara-product-mobile.png?v=2");
    expect(hm).toHaveLength(4);
    expect(zara).toHaveLength(4);
    expect(hm).not.toEqual(zara);
    expect([...hm!, ...zara!].every(({ x, y }) => x >= 0 && x <= 1 && y >= 0 && y <= 1)).toBe(true);
    expect(await getUEyesDemoPath("/demo/other.png")).toBeUndefined();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]) })));
    expect(await getUEyesDemoPath("/demo/hm-product-mobile.png?v=2")).toBeUndefined();
  });
});
