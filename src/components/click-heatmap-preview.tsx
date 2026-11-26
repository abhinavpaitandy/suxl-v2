import { useEffect, useState } from "react";
import type { PilotRun } from "@/lib/ai/pilot-client";
import type { BoundingBox } from "@/lib/types";
import { TargetOverlayPreview } from "@/components/target-overlay-preview";
import { SimulatedClickHeatmap } from "@/components/simulated-click-heatmap";
import { getUEyesDemoPath } from "@/lib/ueyes-demo-paths";

type Click = { persona: string; x: number; y: number };

/** A schematic illustration: the intermediate points are not inferred gaze data. */
export function illustrativePath(x: number, y: number) {
  const start = { x: 0.5, y: 0.08 };
  return [start, ...[0.3, 0.65].map((t, i) => ({
    x: Math.max(0, Math.min(1, start.x + (x - start.x) * t + (i === 0 ? -0.07 : 0.05))),
    y: start.y + (y - start.y) * t,
  })), { x, y }];
}

export function ClickHeatmapPreview({ id, variantName, screenshotUrl, target, clicks, runs }: {
  id: string;
  variantName: string;
  screenshotUrl: string;
  target?: BoundingBox | undefined;
  clicks: Click[];
  runs: PilotRun[];
}) {
  const [showPath, setShowPath] = useState(false);
  const [showPersonaPath, setShowPersonaPath] = useState(false);
  const [showUEyes, setShowUEyes] = useState(false);
  const [ueyesPath, setUEyesPath] = useState<{ x: number; y: number }[]>();
  const [ueyesSource, setUEyesSource] = useState<"demo" | "local">("demo");
  const [ueyesLoading, setUEyesLoading] = useState(false);
  const [ueyesError, setUEyesError] = useState("");
  useEffect(() => {
    let active = true;
    setUEyesPath(undefined);
    setShowUEyes(false);
    setUEyesSource("demo");
    setUEyesError("");
    void getUEyesDemoPath(screenshotUrl).then((points) => { if (active) setUEyesPath(points); }).catch(() => { if (active) setUEyesPath(undefined); });
    return () => { active = false; };
  }, [screenshotUrl]);
  async function generateUEyes() {
    setUEyesLoading(true);
    setUEyesError("");
    try {
      const image = await fetch(screenshotUrl);
      if (!image.ok) throw new Error("Could not read the screenshot.");
      const blob = await image.blob();
      const hash = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
      const key = `suxl-ueyes-v1-${Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("")}`;
      let points: { x: number; y: number }[] | undefined;
      try { const cached = JSON.parse(localStorage.getItem(key) || "null"); if (Array.isArray(cached) && cached.length === 4 && cached.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1)) points = cached; } catch { /* Cache is optional. */ }
      if (!points) {
        const response = await fetch("/api/local-ueyes", { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: blob });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Local UEyes inference is unavailable in this deployment.");
        if (!Array.isArray(data.points) || data.points.length !== 4 || data.points.some((p: { x: number; y: number }) => !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1)) throw new Error("UEyes returned invalid coordinates.");
        points = data.points;
        try { localStorage.setItem(key, JSON.stringify(points)); } catch { /* Cache is optional. */ }
      }
      setUEyesPath(points); setUEyesSource("local"); setShowUEyes(true);
    } catch (error) { setUEyesError(error instanceof Error ? error.message : "Unable to generate a gaze path."); }
    finally { setUEyesLoading(false); }
  }
  const sorted = [...runs].sort((a, b) => a.run - b.run);
  const [selected, setSelected] = useState<string>(() => String(sorted[0]?.run ?? ""));
  const run = sorted.find((item) => String(item.run) === selected);
  const path = run?.outcome.action === "click" ? illustrativePath(run.outcome.x, run.outcome.y) : [];
  const personaPath = run?.outcome.attentionPath;
  return (
    <>
      <div id={id} className="relative w-full">
        {target ? <TargetOverlayPreview screenshotUrl={screenshotUrl} boundingBox={target} adjustMode={false} onBoxChange={() => {}} onDrawEnd={() => {}} onDrawCancel={() => {}} alt={`${variantName} screenshot with reviewed target`} /> : <img className="w-full rounded border" src={screenshotUrl} alt={`${variantName} screenshot`} />}
        <SimulatedClickHeatmap clicks={clicks} />
        {showPersonaPath && personaPath && (
          <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full" viewBox="0 0 1000 1000" preserveAspectRatio="none" role="img" aria-label={`${variantName} predicted attention path for person ${run!.run + 1}`}>
            <polyline points={personaPath.map((p) => `${p.x * 1000},${p.y * 1000}`).join(" ")} fill="none" stroke="white" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            <polyline points={personaPath.map((p) => `${p.x * 1000},${p.y * 1000}`).join(" ")} fill="none" stroke="#9b3612" strokeWidth="3" strokeDasharray="5 7" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            {personaPath.map((p, i) => <circle key={i} cx={p.x * 1000} cy={p.y * 1000} r="5" fill="#9b3612" stroke="white" strokeWidth="2" vectorEffect="non-scaling-stroke" />)}
          </svg>
        )}
        {showUEyes && ueyesPath && (
          <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full" viewBox="0 0 1000 1000" preserveAspectRatio="none" role="img" aria-label={`${variantName} UEyes DeepGaze++ predicted attention path`}>
            <polyline points={ueyesPath.map((p) => `${p.x * 1000},${p.y * 1000}`).join(" ")} fill="none" stroke="white" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            <polyline points={ueyesPath.map((p) => `${p.x * 1000},${p.y * 1000}`).join(" ")} fill="none" stroke="#8a239a" strokeWidth="3" strokeDasharray="5 7" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            {ueyesPath.map((p, i) => <circle key={i} cx={p.x * 1000} cy={p.y * 1000} r="5" fill="#8a239a" stroke="white" strokeWidth="2" vectorEffect="non-scaling-stroke" />)}
          </svg>
        )}
        {showPath && path.length > 0 && (
          <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full" viewBox="0 0 1000 1000" preserveAspectRatio="none" role="img" aria-label={`Illustrative path to person ${run!.run + 1}'s predicted first click`}>
            <polyline points={path.map((p) => `${p.x * 1000},${p.y * 1000}`).join(" ")} fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            <polyline points={path.map((p) => `${p.x * 1000},${p.y * 1000}`).join(" ")} fill="none" stroke="#0b3d91" strokeWidth="3" strokeDasharray="5 7" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            {path.map((p, i) => <circle key={i} cx={p.x * 1000} cy={p.y * 1000} r="5" fill="#0b3d91" stroke="white" strokeWidth="2" vectorEffect="non-scaling-stroke" />)}
          </svg>
        )}
      </div>
      {sorted.length > 0 && <div className="mt-3 space-y-2 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={showPersonaPath} onChange={(event) => setShowPersonaPath(event.target.checked)} /> Show persona-specific predicted attention path</label>
        {showPersonaPath && <>
          <label className="flex flex-wrap items-center gap-2">Person <select className="rounded border border-input bg-background px-2 py-1" value={selected} onChange={(event) => setSelected(event.target.value)} aria-label={`${variantName} person for predicted attention path`}>{sorted.map((item) => <option key={item.run} value={String(item.run)}>Person {item.run + 1}{item.outcome.action === "no_action" ? " (no click)" : ""}</option>)}</select></label>
          <p className="text-xs text-muted-foreground">Ordered locations predicted from this person's profile and the screenshot. These are hypothetical AI predictions, not measured gaze. Different people can receive similar predictions.</p>
          {!personaPath && <p className="text-xs text-muted-foreground">No predicted attention path was saved for this person. Earlier pilot results did not include attention paths.</p>}
        </>}
      </div>}
      <div className="mt-3 space-y-2 text-sm">
        {ueyesPath ? <label className="flex items-center gap-2"><input type="checkbox" checked={showUEyes} onChange={(event) => setShowUEyes(event.target.checked)} /> Show UEyes predicted attention path</label> : <button type="button" className="rounded border border-input bg-background px-3 py-2 disabled:opacity-50" disabled={ueyesLoading} onClick={() => void generateUEyes()}>{ueyesLoading ? "Generating UEyes path…" : "Generate UEyes attention path"}</button>}
        {ueyesError && <p role="alert" className="text-xs text-destructive">{ueyesError}</p>}
        {showUEyes && <p className="text-xs text-muted-foreground">DeepGaze++ free-viewing prediction for this screenshot: the first point is a centre seed, followed by three predicted fixations. This is not measured eye tracking or a prediction for a particular person or task. {ueyesSource === "demo" ? "The path was precomputed for this demo image." : "The path was generated locally for this image."}</p>}
      </div>
      {sorted.length > 0 && <div className="mt-3 space-y-2 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={showPath} onChange={(event) => setShowPath(event.target.checked)} /> Show illustrative gaze path</label>
        {showPath && <>
          <label className="flex flex-wrap items-center gap-2">Person <select className="rounded border border-input bg-background px-2 py-1" value={selected} onChange={(event) => setSelected(event.target.value)} aria-label={`${variantName} person for illustrative gaze path`}>{sorted.map((item) => <option key={item.run} value={String(item.run)}>Person {item.run + 1}{item.outcome.action === "no_action" ? " (no click)" : ""}</option>)}</select></label>
          <p className="text-xs text-muted-foreground">Illustration only: the starting point and intermediate stops are invented. Only the endpoint is the selected person’s predicted first click. This is not eye tracking or an AI-predicted gaze path.</p>
          {run?.outcome.action === "no_action" && <p className="text-xs text-muted-foreground">No path is shown because this person did not produce a click.</p>}
        </>}
      </div>}
    </>
  );
}
