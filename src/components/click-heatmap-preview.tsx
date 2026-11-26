import { useEffect, useState } from "react";
import type { PilotRun } from "@/lib/ai/pilot-client";
import type { BoundingBox } from "@/lib/types";
import { TargetOverlayPreview } from "@/components/target-overlay-preview";
import { ClickDistributionSummary, SimulatedClickHeatmap } from "@/components/simulated-click-heatmap";
import { getUEyesDemoPath } from "@/lib/ueyes-demo-paths";
import { exportHeatmap } from "@/lib/pilot-export";
import { Download, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccessibilityOverlay } from "@/components/accessibility-overlay";
import { ComparisonControls, ComparisonProvider, useComparison } from "@/components/comparison-controls";

type Click = { persona: string; x: number; y: number };

/** A schematic illustration: the intermediate points are not inferred gaze data. */
export function illustrativePath(x: number, y: number) {
  const start = { x: 0.5, y: 0.08 };
  return [start, ...[0.3, 0.65].map((t, i) => ({
    x: Math.max(0, Math.min(1, start.x + (x - start.x) * t + (i === 0 ? -0.07 : 0.05))),
    y: start.y + (y - start.y) * t,
  })), { x, y }];
}

type PreviewProps = {
  id: string;
  variantName: string;
  screenshotUrl: string;
  target?: BoundingBox | undefined;
  clicks: Click[];
  runs: PilotRun[];
};

export function ClickHeatmapPreview(props: PreviewProps) {
  const comparison = useComparison();
  if (!comparison) return <ComparisonProvider><ComparisonControls runs={props.runs} /><ClickHeatmapPreviewContent {...props} /></ComparisonProvider>;
  return <ClickHeatmapPreviewContent {...props} />;
}

function ClickHeatmapPreviewContent({ id, variantName, screenshotUrl, target, clicks, runs }: PreviewProps) {
  const { showPath, showHeatmap, showPersonaPath, showUEyes, setShowUEyes, showAccessibility, accessibilityVersion, selected } = useComparison()!;
  const [ueyesPath, setUEyesPath] = useState<{ x: number; y: number }[]>();
  const [ueyesSource, setUEyesSource] = useState<"demo" | "local">("demo");
  const [ueyesLoading, setUEyesLoading] = useState(false);
  const [ueyesError, setUEyesError] = useState("");
  useEffect(() => {
    let active = true;
    setUEyesPath(undefined);
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
  const run = sorted.find((item) => String(item.run) === selected);
  const visibleRuns = selected === "all" ? sorted : run ? [run] : [];
  const personaRuns = visibleRuns.filter((item) => item.outcome.attentionPath?.length);
  const clickRuns = visibleRuns.filter((item) => item.outcome.action === "click");
  return (
    <>
      <div id={id} className="relative w-full">
        {target ? <TargetOverlayPreview screenshotUrl={screenshotUrl} boundingBox={target} adjustMode={false} onBoxChange={() => {}} onDrawEnd={() => {}} onDrawCancel={() => {}} alt={`${variantName} screenshot with reviewed target`} /> : <img className="w-full rounded border" src={screenshotUrl} alt={`${variantName} screenshot`} />}
        <SimulatedClickHeatmap clicks={clicks} visible={showHeatmap} />
        <AccessibilityOverlay screenshotUrl={screenshotUrl} variantName={variantName} enabled={showAccessibility} refreshVersion={accessibilityVersion} />
        {showPersonaPath && personaRuns.map((item) => {
          const personaPath = item.outcome.attentionPath!;
          return <svg key={`persona-${item.run}`} className="pointer-events-none absolute inset-0 z-20 h-full w-full" viewBox="0 0 1000 1000" preserveAspectRatio="none" opacity={selected === "all" ? "0.35" : "0.78"} role="img" aria-label={`${variantName} predicted attention path for person ${item.run + 1}`}>
            <polyline points={personaPath.map((p) => `${p.x * 1000},${p.y * 1000}`).join(" ")} fill="none" stroke="white" strokeOpacity="0.55" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            <polyline points={personaPath.map((p) => `${p.x * 1000},${p.y * 1000}`).join(" ")} fill="none" stroke="#9b3612" strokeWidth="2" strokeDasharray="5 7" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            {personaPath.map((p, i) => <circle key={i} cx={p.x * 1000} cy={p.y * 1000} r="3.5" fill="#9b3612" stroke="white" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
          </svg>;
        })}
        {showUEyes && ueyesPath && (
          <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full" viewBox="0 0 1000 1000" preserveAspectRatio="none" opacity="0.78" role="img" aria-label={`${variantName} UEyes DeepGaze++ predicted attention path`}>
            <polyline points={ueyesPath.map((p) => `${p.x * 1000},${p.y * 1000}`).join(" ")} fill="none" stroke="white" strokeOpacity="0.55" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            <polyline points={ueyesPath.map((p) => `${p.x * 1000},${p.y * 1000}`).join(" ")} fill="none" stroke="#8a239a" strokeWidth="2" strokeDasharray="5 7" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            {ueyesPath.map((p, i) => <circle key={i} cx={p.x * 1000} cy={p.y * 1000} r="3.5" fill="#8a239a" stroke="white" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
          </svg>
        )}
        {showPath && clickRuns.map((item) => {
          if (item.outcome.action !== "click") return null;
          const path = illustrativePath(item.outcome.x, item.outcome.y);
          return <svg key={`illustrative-${item.run}`} className="pointer-events-none absolute inset-0 z-20 h-full w-full" viewBox="0 0 1000 1000" preserveAspectRatio="none" opacity={selected === "all" ? "0.35" : "0.78"} role="img" aria-label={`${variantName} illustrative path to person ${item.run + 1}'s predicted first click`}>
            <polyline points={path.map((p) => `${p.x * 1000},${p.y * 1000}`).join(" ")} fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            <polyline points={path.map((p) => `${p.x * 1000},${p.y * 1000}`).join(" ")} fill="none" stroke="#0b3d91" strokeWidth="2" strokeDasharray="5 7" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            {path.map((p, i) => <circle key={i} cx={p.x * 1000} cy={p.y * 1000} r="3.5" fill="#0b3d91" stroke="white" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
          </svg>;
        })}
      </div>
      <section className="mt-4 rounded-lg border border-border bg-muted/20 p-4" aria-label={`${variantName} results`}>
        <ClickDistributionSummary clicks={clicks} target={target} />
        {showPersonaPath && personaRuns.length === 0 && <p className="mt-2 text-xs text-muted-foreground">No predicted attention path was saved for the selected people in this variant.</p>}
        {selected === "all" && showPersonaPath && personaRuns.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Showing {personaRuns.length} of {visibleRuns.length} saved persona paths together.</p>}
        {showPath && run?.outcome.action === "no_action" && <p className="mt-2 text-xs text-muted-foreground">No illustrative path is shown because this person did not produce a click.</p>}
        {!ueyesPath && <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-muted-foreground">UEyes path unavailable for this variant.</span><Button type="button" aria-label="Generate UEyes attention path" size="sm" variant="outline" disabled={ueyesLoading} onClick={() => void generateUEyes()}>{ueyesLoading && <LoaderCircle className="mr-1 size-3 animate-spin" />}{ueyesLoading ? "Generating…" : "Generate path"}</Button></div>}
        {ueyesError && <p role="alert" className="mt-2 text-xs text-destructive">{ueyesError}</p>}
        {showUEyes && ueyesPath && <p className="mt-2 text-xs text-muted-foreground">UEyes path {ueyesSource === "demo" ? "was precomputed for this demo image" : "was generated locally for this image"}.</p>}
        <Button type="button" variant="outline" className="mt-4 w-full justify-center" onClick={() => void exportHeatmap(id, `${id}-heatmap.png`).catch((error) => window.alert(error instanceof Error ? error.message : "Could not export heatmap."))}><Download className="mr-2 size-4" /> Download heatmap (.png)</Button>
      </section>
    </>
  );
}
