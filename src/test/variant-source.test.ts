import { describe, expect, it } from "vitest";
import { hasVariantSource, isValidPageUrl, isVariantReady } from "@/lib/variant-source";
import type { DraftVariant } from "@/lib/types";

const candidate: DraftVariant = { id: "a", name: "Variant A" };

describe("variant candidates", () => {
  it("accepts HTTP and HTTPS URLs, including query strings", () => {
    expect(isValidPageUrl("https://www.zara.com/uk/en/product.html?v1=614350112")).toBe(true);
    expect(isValidPageUrl("http://example.com")).toBe(true);
    expect(isValidPageUrl("javascript:alert(1)")).toBe(false);
    expect(isValidPageUrl("not a url")).toBe(false);
  });

  it("allows a URL candidate to proceed without a screenshot target", () => {
    const variant = { ...candidate, pageUrl: "https://example.com" };
    expect(hasVariantSource(variant)).toBe(true);
    expect(isVariantReady(variant)).toBe(true);
    expect(isVariantReady({ ...candidate, pageUrl: "invalid" })).toBe(false);
  });

  it("keeps a URL alongside a screenshot and rejects invalid URLs", () => {
    expect(
      hasVariantSource({
        ...candidate,
        pageUrl: "https://example.com",
        screenshotUrl: "data:image/png;base64,test",
      }),
    ).toBe(true);
    expect(
      hasVariantSource({
        ...candidate,
        pageUrl: "javascript:alert(1)",
        screenshotUrl: "data:image/png;base64,test",
      }),
    ).toBe(false);
  });

  it("still requires a reviewed target for screenshots", () => {
    const variant: DraftVariant = { ...candidate, screenshotUrl: "data:image/png;base64,test" };
    expect(isVariantReady(variant)).toBe(false);
    expect(
      isVariantReady({
        ...variant,
        detectedTarget: {
          label: "Buy",
          confidence: 0.9,
          boundingBox: { x: 0, y: 0, width: 0.5, height: 0.5 },
          status: "confirmed",
        },
      }),
    ).toBe(true);
  });
});
