import { isTargetReviewed, type DraftVariant } from "./types";

export function isValidPageUrl(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function hasVariantSource(variant: DraftVariant): boolean {
  const hasUrl = Boolean(variant.pageUrl?.trim());
  return (!hasUrl || isValidPageUrl(variant.pageUrl)) && (Boolean(variant.screenshotUrl) || hasUrl);
}

export function isVariantReady(variant: DraftVariant): boolean {
  return (
    hasVariantSource(variant) &&
    (!variant.screenshotUrl ||
      Boolean(variant.detectedTarget && isTargetReviewed(variant.detectedTarget)))
  );
}
