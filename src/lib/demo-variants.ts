export const DEMO_VARIANTS = [
  {
    id: "v-a",
    name: "Variant A",
    description: "",
    pageUrl: "https://www2.hm.com/en_gb/productpage.0570002002.html",
    screenshotUrl: "/demo/hm-product-mobile.png?v=2",
  },
  {
    id: "v-b",
    name: "Variant B",
    description: "",
    pageUrl: "https://www.zara.com/uk/en/basic-slim-fit-t-shirt--01-p05584401.html?v1=614350112",
    screenshotUrl: "/demo/zara-product-mobile.png?v=2",
  },
] as const;

export function isDemoScreenshot(url: string | undefined): boolean {
  return DEMO_VARIANTS.some((variant) => variant.screenshotUrl === url);
}

/** Hand-positioned on the bundled add-to-bag buttons; still requires user review. */
export function demoAddToBagTarget(screenshotUrl: string | undefined, successEvent: string) {
  if (!/\badd\s+(?:to\s+bag|button)\b/i.test(successEvent)) return undefined;
  const index = DEMO_VARIANTS.findIndex((variant) => variant.screenshotUrl === screenshotUrl);
  if (index === 0) return { label: "ADD TO BAG", boundingBox: { x: 0.04, y: 0.91, width: 0.92, height: 0.07 }, status: "unreviewed" as const };
  if (index === 1) return { label: "ADD", boundingBox: { x: 0.05, y: 0.94, width: 0.43, height: 0.05 }, status: "unreviewed" as const };
  return undefined;
}

export function demoScreenshotMatchesUrl(
  screenshotUrl: string | undefined,
  pageUrl: string,
): boolean {
  const demo = DEMO_VARIANTS.find((variant) => variant.screenshotUrl === screenshotUrl);
  return !demo || demo.pageUrl === pageUrl.trim();
}
