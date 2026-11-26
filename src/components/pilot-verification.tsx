import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AppShell, PageBody, PageHeader } from "@/components/app-shell";
import { SimulatedClickHeatmap, ClickDistributionSummary } from "@/components/simulated-click-heatmap";
import { DEMO_VARIANTS } from "@/lib/demo-variants";

type Run = { f: string; profile: string; action: string; x?: number; y?: number };

/** Read-only record of the separately executed H&M/Zara pilot. */
export function PilotVerification() {
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    fetch("/demo/pilot-verification.json")
      .then((response) => {
        if (!response.ok) throw new Error("Pilot record unavailable");
        return response.json();
      })
      .then(setRuns)
      .catch(() => setError(true));
  }, []);
  return (
    <AppShell>
      <PageHeader title="H&M and Zara screenshot pilot" description="Recorded first-action predictions from the pilot run." leading={<Link to="/" className="text-primary underline">All experiments</Link>} />
      <PageBody>
        <p className="mb-6 text-sm text-muted-foreground">Each prediction is an independent model response to a screenshot, task and one of three persona profiles. These are synthetic predictions, not observed customer clicks. The pilot used a shortened Fashion Aspirer description and does not include a reviewed target area.</p>
        {error && <p role="alert">The pilot record could not be loaded.</p>}
        {!runs && !error && <p>Loading pilot results…</p>}
        {runs && <div className="grid gap-6 md:grid-cols-2">{DEMO_VARIANTS.map((variant, index) => {
          const variantRuns = runs.filter((run) => run.f === (index === 0 ? "hm" : "zara"));
          const clicks = variantRuns.flatMap((run) => run.action === "click" && typeof run.x === "number" && typeof run.y === "number" ? [{ persona: run.profile, x: run.x, y: run.y }] : []);
          return <section key={variant.id} className="rounded-lg border bg-card p-5"><h2 className="mb-2 text-lg font-semibold">{index === 0 ? "H&M" : "Zara"}</h2><p className="mb-4 text-sm">{variantRuns.length} runs · {clicks.length} predicted first clicks</p><div className="relative overflow-hidden rounded border"><img className="block w-full" src={variant.screenshotUrl} alt={`${variant.name} screenshot`} /><SimulatedClickHeatmap clicks={clicks} /></div><ClickDistributionSummary clicks={clicks} /></section>;
        })}</div>}
      </PageBody>
    </AppShell>
  );
}
