import { z } from "zod";
import type { DraftVariant } from "@/lib/types";
import { imageTiles } from "./visual-client";
import { createPilotProfiles } from "./pilot-personas";
import { pilotCacheKey, readPilotCache, writePilotCache, removePilotCache } from "./pilot-cache";

const attentionPathSchema = z.array(z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })).min(2).max(5);
const outcomeSchema = z.union([
  z.object({
    action: z.literal("click"),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    reason: z.string().min(1),
    attentionPath: attentionPathSchema.optional(),
  }),
  z.object({ action: z.literal("no_action"), reason: z.string().min(1), attentionPath: attentionPathSchema.optional() }),
]);
const currentOutcomeSchema = outcomeSchema.refine((outcome) => Boolean(outcome.attentionPath));
export type PilotRun = {
  variantId: string;
  profile: string;
  run: number;
  outcome: z.infer<typeof outcomeSchema>;
};
export type PilotTraceEvent = { stage: "preparing" | "personas" | "decisions"; message: string };

async function getToken(): Promise<string | undefined> {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    return (await supabase.auth.getSession()).data.session?.access_token;
  } catch { return undefined; }
}

async function cacheContext(token: string | undefined, signal: AbortSignal): Promise<string> {
  const response = await fetch("/api/pilot-cache-context", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: "{}", signal });
  if (!response.ok) throw new Error("Unable to identify the AI provider for pilot caching.");
  const value = z.object({ provider: z.string(), model: z.string() }).parse(await response.json());
  return `${value.provider}:${value.model}`;
}

export async function generatePilotPeople(options: { persona: string; task: string; count: number; diversity: "low" | "medium" | "high"; signal: AbortSignal; onTrace?: (event: PilotTraceEvent) => void; fresh?: boolean; cache?: boolean }): Promise<string[]> {
  const { persona, task, count, diversity, signal, onTrace, fresh, cache = true } = options;
  const token = await getToken();
  const provider = await cacheContext(token, signal);
  const seeds = createPilotProfiles(count, diversity);
  const profiles: string[] = [];
  const generatedProfiles = new Set<string>();
  const keys = await Promise.all(Array.from({ length: Math.ceil(seeds.length / 2) }, (_, index) => pilotCacheKey(["people-v2", provider, persona, task, diversity, count, seeds.slice(index * 2, index * 2 + 2)])));
  if (fresh && cache) keys.forEach(removePilotCache);
  for (let offset = 0; offset < seeds.length; offset += 2) {
    const batch = seeds.slice(offset, offset + 2);
    const key = keys[offset / 2]!;
    const schema = z.array(z.string().min(20).max(500)).length(batch.length);
    const saved = schema.safeParse(cache ? readPilotCache(key) : undefined);
    let generated: string[];
    if (saved.success) {
      generated = saved.data;
      onTrace?.({ stage: "personas", message: `Reused saved people ${offset + 1}–${offset + batch.length} of ${seeds.length}.` });
    } else {
      onTrace?.({ stage: "personas", message: `Generating people ${offset + 1}–${offset + batch.length} of ${seeds.length}.` });
      const res = await fetch("/api/pilot-personas", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ persona, task, diversity, seeds: batch }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(90000)]),
    });
      const body = await res.json();
      if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : "Persona generation failed.");
      generated = schema.parse(body.profiles);
      if (cache && !writePilotCache(key, generated)) onTrace?.({ stage: "personas", message: "Browser storage is unavailable; this batch cannot be resumed after reload." });
    }
    for (const profile of generated) generatedProfiles.add(profile.trim().toLowerCase());
    profiles.push(...generated.map((profile, i) => `${batch[i]} ${profile}`.slice(0, 500)));
    generated.forEach((profile, index) => onTrace?.({ stage: "personas", message: `Person ${offset + index + 1}: ${profile}` }));
  }
  if (generatedProfiles.size !== profiles.length) throw new Error("The AI returned duplicate persona variations. Please retry.");
  return profiles;
}

export async function runScreenshotPilot(options: {
  variants: DraftVariant[];
  persona: string;
  task: string;
  runsPerVariant: number;
  diversity: "low" | "medium" | "high";
  signal: AbortSignal;
  onProgress: (done: number, total: number) => void;
  onTrace?: (event: PilotTraceEvent) => void;
  profiles?: string[];
  cache?: boolean;
  onDecision?: (run: PilotRun) => void;
}): Promise<PilotRun[]> {
  const { variants, persona, task, runsPerVariant, diversity, signal, onProgress, onTrace, cache = true } = options;
  onTrace?.({ stage: "preparing", message: `Preparing ${variants.length} screenshots.` });
  const screenshots = await Promise.all(
    variants.map(async (variant) => ({
      id: variant.id,
      tiles: await imageTiles(variant.screenshotUrl!),
    })),
  );
  const token = await getToken();
  const provider = await cacheContext(token, signal);
  const profiles = options.profiles ?? await generatePilotPeople({ persona, task, count: runsPerVariant, diversity, signal, cache, ...(onTrace ? { onTrace } : {}) });
  if (profiles.length !== runsPerVariant || new Set(profiles).size !== profiles.length) throw new Error("The pilot needs one distinct profile per participant.");
  const jobs = Array.from({ length: runsPerVariant }, (_, run) =>
    screenshots.map((screenshot) => ({
      screenshot,
      run,
      profile: profiles[run]!,
    })),
  ).flat();
  const results: PilotRun[] = [];
  onTrace?.({ stage: "decisions", message: `Generated ${profiles.length} personas. Starting ${jobs.length} independent screenshot decisions.` });
  let next = 0;
  let failure: unknown;
  async function worker() {
    while (next < jobs.length && !failure) {
      const job = jobs[next++]!;
      try {
        const key = await pilotCacheKey(["decision-v3-attention", provider, persona, task, job.screenshot.id, job.run, job.profile, job.screenshot.tiles]);
        const saved = currentOutcomeSchema.safeParse(cache ? readPilotCache(key) : undefined);
        let outcome: z.infer<typeof outcomeSchema>;
        if (saved.success) {
          outcome = saved.data;
          onTrace?.({ stage: "decisions", message: `Reused saved decision for ${job.screenshot.id}, person ${job.run + 1}.` });
        } else {
          const res = await fetch("/api/screenshot-pilot", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            persona,
            task,
            profile: job.profile,
            tiles: job.screenshot.tiles,
          }),
          signal: AbortSignal.any([signal, AbortSignal.timeout(180000)]),
        });
          const body = await res.json();
          if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : "Pilot run failed.");
          outcome = currentOutcomeSchema.parse(body);
          if (cache && !writePilotCache(key, outcome)) onTrace?.({ stage: "decisions", message: "Browser storage is unavailable; this decision cannot be resumed after reload." });
        }
        const decision = { variantId: job.screenshot.id, profile: job.profile, run: job.run, outcome };
        results.push(decision);
        options.onDecision?.(decision);
        const name = variants.find((variant) => variant.id === job.screenshot.id)?.name || job.screenshot.id;
        onTrace?.({ stage: "decisions", message: `${name}, persona ${job.run + 1}: ${outcome.action === "click" ? `click (${(outcome.x * 100).toFixed(1)}%, ${(outcome.y * 100).toFixed(1)}%)` : "no click"}. ${outcome.reason}` });
        onProgress(results.length, jobs.length);
      } catch (error) {
        failure = error;
      }
    }
  }
  await Promise.all([worker(), worker()]);
  if (failure) throw failure;
  if (signal.aborted) throw new Error("Pilot cancelled.");
  return results;
}
