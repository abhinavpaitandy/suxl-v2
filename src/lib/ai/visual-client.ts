import { visualResultSchema, type VisualResult } from "./visual-schema";
import type { DraftVariant } from "../types";

export async function imageTiles(source: string) {
  const image = new Image();
  image.src = source;
  await image.decode();
  if (!image.naturalWidth || !image.naturalHeight)
    throw new Error("A screenshot could not be read.");
  // Split tall pages into equal slices so small interface controls remain legible.
  const count = Math.min(8, Math.max(1, Math.ceil(image.naturalHeight / image.naturalWidth / 2)));
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser cannot prepare screenshots for analysis.");
  const tiles = [];
  for (let index = 0; index < count; index++) {
    const startY = Math.round((image.naturalHeight * index) / count);
    const endY = Math.round((image.naturalHeight * (index + 1)) / count);
    const height = endY - startY;
    const scale = Math.min(1, 768 / image.naturalWidth, 1800 / height);
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, startY, image.naturalWidth, height, 0, 0, canvas.width, canvas.height);
    tiles.push({
      start: startY / image.naturalHeight,
      end: endY / image.naturalHeight,
      image: canvas.toDataURL("image/jpeg", 0.72),
    });
  }
  return tiles;
}

export async function compareScreenshots(
  variants: DraftVariant[],
  task: string,
  successEvent: string,
  onProgress?: (stage: "preparing" | "checking-cache" | "analysing") => void,
  simulation?: { persona: string; perspectives: number; diversity: "low" | "medium" | "high" },
  options?: { forceRefresh?: boolean; signal?: AbortSignal; cache?: boolean },
): Promise<VisualResult> {
  onProgress?.("preparing");
  const withScreens = variants.filter((v) => v.screenshotUrl);
  if (withScreens.length < 2)
    throw new Error("Add screenshots for at least two variants to compare.");
  const images = await Promise.all(
    withScreens.map(async (v) => ({
      id: v.id,
      name: v.name,
      tiles: await imageTiles(v.screenshotUrl!),
    })),
  );
  onProgress?.("checking-cache");
  // Cache only the result and a digest of the complete input, never the images.
  const payload = JSON.stringify({ task, successEvent, variants: images, ...simulation });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  const key = `suxl-visual-v3-${Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("")}`;
  try {
    const entry = options?.cache === false ? null : JSON.parse(sessionStorage.getItem(key) || "null");
    if (!options?.forceRefresh && entry && Date.now() - entry.time < 24 * 60 * 60 * 1000) {
      const cached = visualResultSchema.safeParse(entry.result);
      if (cached.success) return cached.data;
    }
  } catch {
    /* Storage can be disabled or contain stale data. */
  }
  onProgress?.("analysing");
  let token: string | undefined;
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    token = (await supabase.auth.getSession()).data.session?.access_token;
  } catch {
    /* Local preview can run without Lovable sign-in. */
  }
  const timeoutSignal = AbortSignal.timeout(90000);
  const signal = options?.signal ? AbortSignal.any([options.signal, timeoutSignal]) : timeoutSignal;
  let response: Response;
  try {
    response = await fetch("/api/visual-analysis", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: payload,
      signal,
    });
  } catch (error) {
    if (options?.signal?.aborted) throw new Error("Analysis cancelled.");
    if (timeoutSignal.aborted)
      throw new Error("Analysis timed out after 90 seconds. Please try again.");
    throw error;
  }
  const body = await response.json();
  if (!response.ok)
    throw new Error(typeof body.error === "string" ? body.error : "Unable to analyse screenshots.");
  const result = visualResultSchema.parse(body);
  try {
    // Bound storage use and retain results only in this browser session.
    if (options?.cache === false) return result;
    const keys = Object.keys(sessionStorage).filter((k) => k.startsWith("suxl-visual-v3-"));
    if (keys.length >= 20 && keys[0]) sessionStorage.removeItem(keys[0]);
    sessionStorage.setItem(key, JSON.stringify({ time: Date.now(), result }));
  } catch {
    /* Analysis still succeeds if browser storage is unavailable. */
  }
  return result;
}
