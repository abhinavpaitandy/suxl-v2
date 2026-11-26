import { DEMO_VARIANTS } from "@/lib/demo-variants";
import type { ExperimentDraft } from "@/lib/types";

export const SAVED_EXAMPLE_KEY = "suxl-completed-example-v1";
export const EXAMPLE_BACKUP_PREFIX = "suxl-example-backup-v1:";
export type SavedExample = { savedAt: string; draft: ExperimentDraft };

/** Only promote a complete paired run using the bundled demo screenshots. */
export function isCompletedDemo(draft: ExperimentDraft): boolean {
  const runs = draft.pilotRuns;
  return draft.variants.length === 2 && DEMO_VARIANTS.every((demo) => {
      const variant = draft.variants.find((item) => item.id === demo.id);
      return variant?.screenshotUrl === demo.screenshotUrl &&
        (variant.detectedTarget?.status === "confirmed" || variant.detectedTarget?.status === "adjusted") &&
        runs?.filter((run) => run.variantId === demo.id).length === 10;
    }) && runs?.length === 20 && Boolean(draft.simulatedClicks && draft.visualObservations);
}

export const EXAMPLE_UPDATED_EVENT = "suxl-example-updated";

/** Save only complete demo pilots; never replace an example with a partial run. */
export function saveCompletedExample(draft: ExperimentDraft): boolean {
  if (!isCompletedDemo(draft)) return false;
  const saved: SavedExample = { savedAt: new Date().toISOString(), draft };
  const previous = localStorage.getItem(SAVED_EXAMPLE_KEY);
  if (previous) {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    // If this fails (e.g. quota), leave the current example untouched.
    localStorage.setItem(EXAMPLE_BACKUP_PREFIX + stamp, previous);
  }
  localStorage.setItem(SAVED_EXAMPLE_KEY, JSON.stringify(saved));
  window.dispatchEvent(new Event(EXAMPLE_UPDATED_EVENT));
  return true;
}

/** Accept uploaded demo images only after comparing their exact bytes. */
export async function normalizeCompletedDemo(draft: ExperimentDraft): Promise<ExperimentDraft | undefined> {
  if (draft.variants.length !== DEMO_VARIANTS.length) return undefined;
  const variants = await Promise.all(draft.variants.map(async (variant) => {
    const demo = DEMO_VARIANTS.find((item) => item.id === variant.id);
    if (!demo || variant.pageUrl?.trim() !== demo.pageUrl || !variant.screenshotUrl) return undefined;
    if (variant.screenshotUrl !== demo.screenshotUrl) {
      if (!variant.screenshotUrl.startsWith("data:image/")) return undefined;
      const [uploaded, bundled] = await Promise.all([fetch(variant.screenshotUrl), fetch(demo.screenshotUrl)]);
      if (!uploaded.ok || !bundled.ok) return undefined;
      const [a, b] = await Promise.all([uploaded.arrayBuffer(), bundled.arrayBuffer()]);
      const [hashA, hashB] = await Promise.all([crypto.subtle.digest("SHA-256", a), crypto.subtle.digest("SHA-256", b)]);
      if (new Uint8Array(hashA).some((value, index) => value !== new Uint8Array(hashB)[index])) return undefined;
    }
    return { ...variant, screenshotUrl: demo.screenshotUrl };
  }));
  if (variants.some((variant) => !variant)) return undefined;
  const normalized = { ...draft, variants: variants as ExperimentDraft["variants"] };
  return isCompletedDemo(normalized) ? normalized : undefined;
}

export function latestExampleBackup(): SavedExample | undefined {
  const key = Object.keys(localStorage).filter((item) => item.startsWith(EXAMPLE_BACKUP_PREFIX)).sort().at(-1);
  if (!key) return undefined;
  try { return JSON.parse(localStorage.getItem(key) || "null") || undefined; } catch { return undefined; }
}
