import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Camera,
  Sparkles,
  TriangleAlert,
  Target,
  MousePointerClick,
  PlusCircle,
  Info,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppShell, PageBody, PageHeader } from "@/components/app-shell";
import { ExperimentStepper } from "@/components/experiment-stepper";
import { ClickDistributionSummary } from "@/components/simulated-click-heatmap";
import { TargetOverlayPreview } from "@/components/target-overlay-preview";
import { ClickHeatmapPreview } from "@/components/click-heatmap-preview";
import { EvidenceBadge, Pill, StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, getExperiment } from "@/lib/mock-data";
import {
  buildPrototypeSnapshotExperiment,
  isPrototypeDraftReady,
  toCleanSnapshotExperiment,
} from "@/lib/snapshot-results";
import { SNAPSHOT_METRIC_DEFS, type Experiment, type SnapshotExperimentResults } from "@/lib/types";
import { useDraft } from "@/lib/draft-store";
import { DEMO_VARIANTS } from "@/lib/demo-variants";
import demoResult from "@/lib/ai/demo-result.json";
import { cn } from "@/lib/utils";
import { exportPeople, exportHeatmap, exportPilotArchive } from "@/lib/pilot-export";
import { PilotVerification } from "@/components/pilot-verification";
import { EXAMPLE_UPDATED_EVENT, isCompletedDemo, latestExampleBackup, normalizeCompletedDemo, saveCompletedExample, SAVED_EXAMPLE_KEY, type SavedExample } from "@/lib/saved-example";

export const Route = createFileRoute("/experiments/$experimentId")({
  head: ({ params }) => {
    const isPrototype = params.experimentId === "prototype-current";
    const title = isPrototype
      ? "Prototype result — Synthetic UX Lab"
      : "Experiment — Synthetic UX Lab";
    const description =
      "Snapshot results comparing interface variants on first-action discoverability and target selection.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(isPrototype ? [{ name: "robots", content: "noindex" }] : []),
      ],
    };
  },
  component: ResultsPage,
});

function ExampleField({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <label className="block space-y-2">
      <Label asChild>
        <span>{label}</span>
      </Label>
      {multiline ? <Textarea disabled value={value} rows={2} /> : <Input disabled value={value} />}
    </label>
  );
}

function ResultsNavigation({
  readOnly = false,
  exampleStep,
}: {
  readOnly?: boolean;
  exampleStep?: number;
}) {
  return (
    <div className="border-b border-border bg-card">
      <div className="mx-auto w-full max-w-7xl px-8 py-3">
        <ExperimentStepper
          currentStep={exampleStep ?? 5}
          experimentId="prototype-current"
          readOnly={readOnly}
          {...(exampleStep ? { exampleId: "exp-1042" } : {})}
        />
      </div>
    </div>
  );
}

function ResultsPage() {
  const { experimentId } = Route.useParams();
  const isPrototype = experimentId === "prototype-current";
  const draftCtx = useDraft();
  const [savedExample, setSavedExample] = useState<SavedExample | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [exampleMessage, setExampleMessage] = useState("");
  useEffect(() => {
    if (experimentId !== "exp-1042") return;
    const load = () => {
      try {
        const stored = localStorage.getItem(SAVED_EXAMPLE_KEY);
        const saved = stored ? JSON.parse(stored) as SavedExample : null;
        setSavedExample(saved?.draft && isCompletedDemo(saved.draft) ? saved : null);
        setSaveError(false);
      } catch { setSaveError(true); }
    };
    load();
    window.addEventListener("storage", load);
    window.addEventListener(EXAMPLE_UPDATED_EVENT, load);
    return () => { window.removeEventListener("storage", load); window.removeEventListener(EXAMPLE_UPDATED_EVENT, load); };
  }, [experimentId]);
  const search = useRouterState({ select: (state) => state.location.searchStr });
  const rawStep = Number(new URLSearchParams(search).get("step"));
  const exampleStep = Number.isInteger(rawStep) && rawStep >= 1 && rawStep <= 4 ? rawStep : 5;

  if (experimentId === "pilot-verification") return <PilotVerification />;

  if (experimentId === "exp-1042" && exampleStep < 5) {
    const title = [
      "",
      "Experiment setup",
      "Compare variants",
      "Review suggested targets",
      "Analysis",
    ][exampleStep];
    return (
      <AppShell>
        <PageHeader
          eyebrow={`Completed example · Step ${exampleStep} of 5`}
          title={title!}
          description="PDP page comparison with comparable product detail"
          leading={
            <Button variant="outline" asChild>
              <Link to="/">
                <ArrowLeft className="size-4" /> All experiments
              </Link>
            </Button>
          }
        />
        <ResultsNavigation exampleStep={exampleStep} />
        <PageBody>
          {exampleStep === 1 && (
            <section className="max-w-3xl rounded-lg border bg-card p-6 space-y-5">
              <ExampleField
                label="Experiment name"
                value={savedExample?.draft.name ?? "PDP page comparison with comparable product detail"}
              />
              <ExampleField label="Primary persona" value={savedExample?.draft.persona ?? "Not specified"} multiline />
              <ExampleField
                label="User task / intent"
                value={savedExample?.draft.task ?? "Find and add the T-shirt to the shopping bag."}
                multiline
              />
              <ExampleField label="Success event" value={savedExample?.draft.successEvent ?? "Add to bag"} multiline />
              <ExampleField label="Device context" value={savedExample?.draft.device ?? "Mobile"} />
              <ExampleField label="Hypothesis (optional)" value={savedExample?.draft.hypothesis || "Not specified"} multiline />
            </section>
          )}
          {exampleStep === 2 && (
            <div className="grid gap-6 md:grid-cols-2">
              {(savedExample?.draft.variants ?? DEMO_VARIANTS).map((v) => (
                <section className="rounded-lg border bg-card p-5" key={v.id}>
                  <h2 className="mb-4 font-semibold">
                    {v.name} · {v.id === "v-a" ? "H&M" : "Zara"}
                  </h2>
                  <div className="space-y-4">
                    <ExampleField label="Variant name" value={v.name} />
                    <ExampleField label="Page URL" value={v.pageUrl ?? "Not specified"} />
                    <ExampleField label="Description (optional)" value={v.description || "Not specified"} multiline />
                  </div>
                  <img
                    className="mt-4 w-full rounded border"
                    src={v.screenshotUrl}
                    alt={`${v.name} screenshot`}
                  />
                </section>
              ))}
            </div>
          )}
          {exampleStep === 3 && (
            <>
              <p className="mb-5 text-sm text-muted-foreground">
                {savedExample ? "These are the reviewed target areas saved with the pilot." : "These are AI suggestions from the original analysis. They have not been confirmed or adjusted."}
              </p>
              <div className="grid gap-6 md:grid-cols-2">
                {DEMO_VARIANTS.map((v) => {
                  const target = demoResult.targets.find((t) => t.id === v.id);
                  const reviewed = savedExample?.draft.variants.find((item) => item.id === v.id)?.detectedTarget;
                  return (
                    <section className="rounded-lg border bg-card p-5" key={v.id}>
                      <h2 className="font-semibold">
                        {v.name} · {v.id === "v-a" ? "H&M" : "Zara"}
                      </h2>
                      <div className="my-4 space-y-4">
                        <ExampleField
                          label="Suggested target"
                          value={reviewed?.label ?? target?.label ?? "Not detected"}
                        />
                        <ExampleField label="Review status" value={reviewed?.status ?? "Needs review"} />
                        <ExampleField
                          label={reviewed ? "Target source" : "AI note"}
                          value={reviewed ? "Saved from the reviewed pilot" : target?.note ?? "Not provided"}
                          multiline
                        />
                      </div>
                      {(reviewed?.boundingBox || target?.box) && (
                        <TargetOverlayPreview
                          screenshotUrl={v.screenshotUrl}
                          boundingBox={reviewed?.boundingBox ?? target!.box!}
                          adjustMode={false}
                          onBoxChange={() => {}}
                          onDrawEnd={() => {}}
                          onDrawCancel={() => {}}
                          alt={`${v.name} screenshot with suggested target`}
                        />
                      )}
                    </section>
                  );
                })}
              </div>
            </>
          )}
          {exampleStep === 4 && (
            <section className="max-w-3xl rounded-lg border bg-card p-6 space-y-5">
              <h2 className="font-semibold">AI visual comparison</h2>
              <ExampleField
                label="Task"
                value={savedExample?.draft.task ?? "Find and add the T-shirt to the shopping bag."}
                multiline
              />
              <ExampleField label="Success event" value={savedExample?.draft.successEvent ?? "Add to bag"} />
              <ExampleField
                label="Analysis"
                value={savedExample ? "Saved synthetic first-action screenshot pilot" : "Cloudflare Workers AI · screenshot visual comparison"}
              />
              <ExampleField
                label="Results"
                value={savedExample ? `${savedExample.draft.pilotRuns!.length} synthetic decisions · 10 people per variant` : `${demoResult.observations.length} visual observations · ${demoResult.targets.length} unreviewed target suggestions`}
              />
              <p className="text-sm text-muted-foreground">
                {savedExample ? "Model-generated first actions; not observed user behaviour." : "No user simulation or performance measurement was run."}
              </p>
              <Button asChild>
                <Link to="/experiments/$experimentId" params={{ experimentId: "exp-1042" }}>
                  View results
                </Link>
              </Button>
            </section>
          )}
        </PageBody>
      </AppShell>
    );
  }

  if (experimentId === "exp-1042") {
    return (
      <AppShell>
        <PageHeader
          eyebrow="Completed example · AI visual comparison"
          title="PDP page comparison with comparable product detail"
          description="Find and add the T-shirt to the shopping bag."
          leading={
            <Button variant="outline" asChild>
              <Link to="/">
                <ArrowLeft className="size-4" /> All experiments
              </Link>
            </Button>
          }
        />
        <ResultsNavigation exampleStep={5} />
        <PageBody>
          {saveError && <p role="alert" className="mb-6 text-sm text-destructive">The browser could not save this example. Check available browser storage.</p>}
          {savedExample ? (
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground">Saved pilot from this browser · {new Date(savedExample.savedAt).toLocaleString()}. Browser data can be cleared; download the pilot archive for a portable copy. Ten synthetic people per variant; model predictions are not measured customer behaviour.</p>
              <div className="flex flex-wrap gap-3"><Button variant="outline" onClick={() => void exportPeople(savedExample.draft.pilotRuns!).catch(() => window.alert("Could not export the people spreadsheet."))}>Download people (.xlsx)</Button><Button variant="outline" onClick={() => exportPilotArchive(savedExample)}>Download pilot archive (.json)</Button>{latestExampleBackup() && <Button variant="outline" onClick={() => { const backup = latestExampleBackup(); if (backup) exportPilotArchive(backup); }}>Download previous example (.json)</Button>}</div>
              <section className="rounded-lg border bg-card p-5"><h2 className="font-semibold">Pilot results</h2><ul className="mt-4 space-y-3">{savedExample.draft.visualObservations!.map((item, index) => <li className="text-sm" key={index}><strong>{item.title}:</strong> {item.detail}</li>)}</ul></section>
              <section className="rounded-lg border bg-card p-5"><h2 className="font-semibold">Original visual comparison</h2><p className="mt-2 text-sm text-muted-foreground">These observations are from the earlier screenshot analysis.</p><ul className="mt-4 space-y-3">{demoResult.observations.map((item) => <li className="text-sm" key={item.title}><strong>{item.title}:</strong> {item.detail}</li>)}</ul></section>
              <div className="grid gap-6 md:grid-cols-2">{savedExample.draft.variants.map((variant) => {
                const clicks = savedExample.draft.simulatedClicks!.filter((item) => item.id === variant.id);
                const runs = savedExample.draft.pilotRuns!.filter((item) => item.variantId === variant.id).sort((a, b) => a.run - b.run);
                return <section key={variant.id} className="rounded-lg border bg-card p-5">
                  <h2 className="font-semibold">{variant.name} · {variant.id === "v-a" ? "H&M" : "Zara"}</h2>
                  <a className="text-sm text-primary underline break-all" href={variant.pageUrl} target="_blank" rel="noreferrer">{variant.pageUrl}</a>
                  <p className="my-3 text-sm">Reviewed target: {variant.detectedTarget?.label}</p>
                  <ClickHeatmapPreview id={`saved-example-${variant.id}`} variantName={variant.name} screenshotUrl={variant.screenshotUrl!} target={variant.detectedTarget!.boundingBox} clicks={clicks} runs={runs} />
                  <ClickDistributionSummary clicks={clicks} target={variant.detectedTarget?.boundingBox} />
                  <Button variant="outline" className="mt-3" onClick={() => void exportHeatmap(`saved-example-${variant.id}`, `${variant.id}-heatmap.png`).catch((error) => window.alert(error instanceof Error ? error.message : "Could not export heatmap."))}>Download heatmap (.png)</Button>
                  <details className="mt-4 text-xs text-muted-foreground"><summary className="cursor-pointer font-medium">View individual pilot runs</summary><ol className="mt-2 max-h-64 space-y-2 overflow-auto">{runs.map((run) => <li key={run.run}><strong>Person {run.run + 1}</strong> · {run.profile} · {run.outcome.action === "click" ? `First click (${Math.round(run.outcome.x * 100)}%, ${Math.round(run.outcome.y * 100)}%)` : "No action"} · {run.outcome.reason}</li>)}</ol></details>
                </section>;
              })}</div>
            </div>
          ) : <>
          <p className="mb-6 text-sm text-muted-foreground">
            AI-generated observations from the provided mobile screenshots. Target suggestions are
            unreviewed and should be checked against the images. This is not measured user
            behaviour.
          </p>
          <section className="rounded-lg border bg-card p-5">
            <h2 className="font-semibold">Visual comparison</h2>
            <ul className="mt-4 space-y-3">
              {demoResult.observations.map((item) => (
                <li className="text-sm" key={item.title}>
                  <strong>{item.title}:</strong> {item.detail}
                </li>
              ))}
            </ul>
          </section>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {DEMO_VARIANTS.map((variant) => {
              const target = demoResult.targets.find((item) => item.id === variant.id);
              return (
                <section key={variant.id} className="rounded-lg border bg-card p-5">
                  <h2 className="font-semibold">
                    {variant.name} · {variant.id === "v-a" ? "H&M" : "Zara"}
                  </h2>
                  <a
                    className="text-sm text-primary underline break-all"
                    href={variant.pageUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {variant.pageUrl}
                  </a>
                  {target && (
                    <p className="my-3 text-sm">
                      AI suggested target: {target.label} · review required
                    </p>
                  )}
                  {target?.box ? (
                    <TargetOverlayPreview
                      screenshotUrl={variant.screenshotUrl}
                      boundingBox={target.box}
                      adjustMode={false}
                      onBoxChange={() => {}}
                      onDrawEnd={() => {}}
                      onDrawCancel={() => {}}
                      alt={`${variant.name} screenshot with unreviewed suggested target`}
                    />
                  ) : (
                    <img
                      className="w-full rounded border"
                      src={variant.screenshotUrl}
                      alt={`${variant.name} screenshot`}
                    />
                  )}
                  <p className="mt-3 text-xs text-muted-foreground">
                    Unreviewed AI-suggested target area shown. No click heatmap is available: this
                    analysis did not record clicks.
                  </p>
                </section>
              );
            })}
          </div>
          </>}
        </PageBody>
      </AppShell>
    );
  }

  if (isPrototype) {
    const draft = draftCtx.draft;
    return (
      <AppShell>
        <PageHeader
          eyebrow="AI visual comparison"
          title={draft.name || "Comparison results"}
          description={draft.task}
          leading={
            <Button variant="outline" asChild>
              <Link to="/">
                <ArrowLeft className="size-4" /> All experiments
              </Link>
            </Button>
          }
        />
        <ResultsNavigation />
        <PageBody>
          {!draft.visualObservations || !draft.pilotRuns?.length ? (
            <div className="rounded-lg border bg-card p-6">
              <p>No completed simulation is available. Run the analysis to generate results.</p>
              <Button asChild className="mt-4">
                <Link to="/experiments/new/simulation">Back to analysis</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground">
                First-action results from independent synthetic screenshot runs. These are model
                predictions, not real user behaviour or task-completion measurements.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => void exportPeople(draft.pilotRuns!).catch(() => window.alert("Could not export the people spreadsheet."))}>Download people (.xlsx)</Button>
                <Button variant="outline" onClick={() => void (async () => {
                  try {
                    const normalized = await normalizeCompletedDemo(draft);
                    if (!normalized) { setExampleMessage("Only a completed H&M/Zara demo using the matching screenshots can be saved to the example."); return; }
                    saveCompletedExample(normalized);
                    const saved = JSON.parse(localStorage.getItem(SAVED_EXAMPLE_KEY) || "null") as SavedExample | null;
                    if (!saved || JSON.stringify(saved.draft) !== JSON.stringify(normalized)) { setExampleMessage("The example was saved, but verification failed. Check the saved example before using it."); return; }
                    const paths = saved.draft.pilotRuns?.filter((run) => run.outcome.attentionPath?.length).length ?? 0;
                    setExampleMessage(`Verified: the saved example matches this demo, including ${saved.draft.pilotRuns?.length ?? 0} decisions and ${paths} attention paths. The previous example was backed up.`);
                  } catch { setExampleMessage("Could not save and verify the example. The existing example was preserved; check browser storage."); }
                })()}>Save this pilot to example</Button>
              </div>
              {exampleMessage && <p role="status" className="text-sm text-muted-foreground">{exampleMessage}</p>}
              <section className="rounded-lg border bg-card p-5">
                <h2 className="font-semibold">Visual comparison</h2>
                <ul className="mt-4 space-y-3">
                  {draft.visualObservations.map((item, index) => (
                    <li className="text-sm" key={index}>
                      <strong>{item.title}:</strong> {item.detail}
                    </li>
                  ))}
                </ul>
              </section>
              <div className="grid gap-6 md:grid-cols-2">
                {draft.variants.map((variant) => (
                  <section key={variant.id} className="rounded-lg border bg-card p-5">
                    <h2 className="font-semibold">{variant.name}</h2>
                    {variant.pageUrl && (
                      <a
                        className="text-sm text-primary underline break-all"
                        href={variant.pageUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {variant.pageUrl}
                      </a>
                    )}
                    {variant.detectedTarget && (
                      <p className="my-3 text-sm">
                        Reviewed target: {variant.detectedTarget.label}
                      </p>
                    )}
                    {variant.screenshotUrl && (
                      <ClickHeatmapPreview id={`pilot-heatmap-${variant.id}`} variantName={variant.name} screenshotUrl={variant.screenshotUrl} target={variant.detectedTarget?.boundingBox} clicks={(draft.simulatedClicks ?? []).filter((c) => c.id === variant.id)} runs={(draft.pilotRuns ?? []).filter((run) => run.variantId === variant.id)} />
                    )}
                    <ClickDistributionSummary
                      clicks={(draft.simulatedClicks ?? []).filter((c) => c.id === variant.id)}
                      target={variant.detectedTarget?.boundingBox}
                    />
                    <Button variant="outline" className="mt-3" onClick={() => void exportHeatmap(`pilot-heatmap-${variant.id}`, `${variant.id}-heatmap.png`).catch((error) => window.alert(error instanceof Error ? error.message : "Could not export heatmap."))}>Download heatmap (.png)</Button>
                    {draft.pilotRuns && (
                      <details className="mt-4 text-xs text-muted-foreground">
                        <summary className="cursor-pointer font-medium">
                          View individual pilot runs
                        </summary>
                        <ol className="mt-2 max-h-64 space-y-2 overflow-auto">
                          {draft.pilotRuns
                            .filter((run) => run.variantId === variant.id)
                            .sort((a, b) => a.run - b.run)
                            .map((run) => (
                              <li key={run.run}>
                                <strong>Run {run.run + 1}</strong> · {run.profile} ·{" "}
                                {run.outcome.action === "click"
                                  ? `First click (${Math.round(run.outcome.x * 100)}%, ${Math.round(run.outcome.y * 100)}%)`
                                  : "No action"}{" "}
                                · {run.outcome.reason}
                              </li>
                            ))}
                        </ol>
                      </details>
                    )}
                  </section>
                ))}
              </div>
            </div>
          )}
        </PageBody>
      </AppShell>
    );
  }

  let experiment: Experiment | null = null;
  let prototypeExpired = false;

  if (isPrototype) {
    if (isPrototypeDraftReady(draftCtx.draft)) {
      experiment = buildPrototypeSnapshotExperiment(draftCtx.draft);
    } else {
      prototypeExpired = true;
    }
  } else {
    const mock = getExperiment(experimentId);
    if (mock) {
      experiment = toCleanSnapshotExperiment(mock);
    }
  }

  if (prototypeExpired) {
    return (
      <AppShell>
        <PageHeader
          eyebrow="Prototype result · Snapshot Test"
          title="Prototype result is no longer available"
          description="This prototype result exists only for the current experiment session. Start a new experiment to run it again."
        />
        <PageBody>
          <div className="rounded-lg border border-border bg-card px-6 py-16 text-center shadow-card">
            <h2 className="text-base font-semibold text-foreground">
              Prototype result is no longer available
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              This prototype result exists only for the current experiment session. Start a new
              experiment to run it again.
            </p>
            <Button asChild className="mt-5">
              <Link to="/experiments/new">
                <PlusCircle className="size-4" />
                New Experiment
              </Link>
            </Button>
          </div>
        </PageBody>
      </AppShell>
    );
  }

  if (!experiment) {
    return (
      <AppShell>
        <PageHeader title="Experiment not found" description="This experiment ID does not exist." />
        <PageBody>
          <Button variant="outline" asChild>
            <Link to="/">
              <ArrowLeft className="size-4" />
              Back to experiments
            </Link>
          </Button>
        </PageBody>
      </AppShell>
    );
  }

  const isComplete = experiment.status === "complete" && experiment.results;
  const eyebrow = isPrototype
    ? "Prototype result · Snapshot Test"
    : `Snapshot Test · ${formatDate(experiment.updatedAt)}`;

  return (
    <AppShell>
      <PageHeader
        eyebrow={eyebrow}
        title={experiment.name}
        description={experiment.task}
        actions={
          <>
            <StatusBadge status={experiment.status} />
            <Pill tone="info">
              <Camera className="size-3" />
              Snapshot
            </Pill>
            <Button variant="outline" asChild>
              <Link to="/">
                <ArrowLeft className="size-4" />
                All experiments
              </Link>
            </Button>
          </>
        }
      />

      <PageBody>
        <ExperimentStepper
          currentStep={5}
          experimentId={experiment.id}
          readOnly={!isPrototype}
          className="mb-6"
        />
        {isPrototype && (
          <div className="mb-6 rounded-md border border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
            Demo results are illustrative mock data. Candidate pages are not fetched or analysed,
            and the displayed winner is not evidence of performance.
          </div>
        )}
        {isPrototype && experiment.variants.some((variant) => variant.pageUrl) && (
          <section className="mb-6 rounded-lg border border-border bg-card p-5">
            <h2 className="text-sm font-semibold">Candidate URLs</h2>
            <ul className="mt-3 space-y-2">
              {experiment.variants
                .filter((variant) => variant.pageUrl)
                .map((variant) => (
                  <li key={variant.id} className="text-sm">
                    <span className="font-medium">{variant.name}: </span>
                    <a
                      className="break-all text-primary underline"
                      href={variant.pageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {variant.pageUrl}
                    </a>
                  </li>
                ))}
            </ul>
          </section>
        )}
        {isPrototype && experiment.variants.some((variant) => variant.screenshotUrl) && (
          <section className="mb-6 rounded-lg border border-border bg-card p-5">
            <h2 className="text-base font-semibold">Candidate screenshots</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Screenshots uploaded for this experiment.
            </p>
            <div className="mt-4 grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3">
              {experiment.variants.map((variant) => (
                <div key={variant.id} className="min-w-0">
                  <h3 className="mb-2 text-sm font-semibold">{variant.name}</h3>
                  {variant.screenshotUrl ? (
                    <img
                      src={variant.screenshotUrl}
                      alt={`${variant.name} full-page screenshot`}
                      className="block h-auto w-full rounded-md border border-border"
                    />
                  ) : (
                    <p className="rounded-md border border-border bg-surface p-4 text-sm text-muted-foreground">
                      No screenshot uploaded.
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
        {isComplete ? (
          <SnapshotResults experiment={experiment} results={experiment.results!} />
        ) : (
          <PendingState experiment={experiment} />
        )}
      </PageBody>
    </AppShell>
  );
}

// ─── Pending state ───────────────────────────────────────────────

function PendingState({ experiment }: { experiment: Experiment }) {
  const running = experiment.status === "running";
  return (
    <div className="space-y-6">
      <ContextCard experiment={experiment} />
      <div className="rounded-lg border border-border bg-card px-6 py-16 text-center shadow-card">
        <h2 className="text-base font-semibold text-foreground">
          {running ? "Simulation in progress" : "Draft — not yet run"}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          {running
            ? `Running ${experiment.pilotSize.toLocaleString()} synthetic sessions per variant. Results will appear when the pilot completes.`
            : "Finish the setup and run a pilot to generate comparative results for this experiment."}
        </p>
      </div>
    </div>
  );
}

// ─── Context card ────────────────────────────────────────────────

function ContextCard({ experiment }: { experiment: Experiment }) {
  const diversityLabel =
    experiment.behaviourDiversity.charAt(0).toUpperCase() + experiment.behaviourDiversity.slice(1);

  const fields = [
    { label: "Persona", value: experiment.persona },
    { label: "Task", value: experiment.task },
    { label: "Success event", value: experiment.successEvent },
    {
      label: "Device",
      value: experiment.device === "mobile" ? "Mobile" : "Desktop",
    },
    {
      label: "Pilot",
      value: `${experiment.pilotSize.toLocaleString()} synthetic sessions / variant`,
    },
    { label: "Behaviour diversity", value: diversityLabel },
    { label: "Variants", value: String(experiment.variants.length) },
  ];

  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-card">
      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
        {fields.map((f) => (
          <div key={f.label}>
            <div className="label-caps">{f.label}</div>
            <p className="mt-1 text-sm leading-relaxed text-foreground">{f.value}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
        Synthetic session count reflects simulated behavioural exploration. It is not equivalent to
        a human research sample size.
      </p>
    </section>
  );
}

// ─── Snapshot results ────────────────────────────────────────────

function SnapshotResults({
  experiment,
  results,
}: {
  experiment: Experiment;
  results: SnapshotExperimentResults;
}) {
  const winnerId = results.predictedWinnerVariantId;
  const winner = experiment.variants.find((v) => v.id === winnerId);
  const variants = experiment.variants;
  const totalObservations = experiment.pilotSize * variants.length;

  const chartData = SNAPSHOT_METRIC_DEFS.map((m) => {
    const row: Record<string, string | number> = { metric: m.label };
    variants.forEach((v) => {
      const metrics = results.variantMetrics[v.id];
      if (metrics) row[v.name] = metrics[m.key];
    });
    return row;
  });

  const chartColors = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)"];

  return (
    <div className="space-y-8">
      {/* Headline */}
      <section className="grid gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-4">
        <div className="bg-accent px-5 py-5">
          <div className="label-caps text-accent-foreground/70">Predicted winner</div>
          {winner ? (
            <>
              <div className="mt-1.5 text-2xl font-semibold text-accent-foreground">
                {winner.name}
              </div>
              {winner.description ? (
                <p className="mt-1 text-xs text-accent-foreground/80">{winner.description}</p>
              ) : null}
            </>
          ) : (
            <div className="mt-1.5 text-lg font-semibold text-accent-foreground">
              No clear winner
            </div>
          )}
        </div>
        <div className="bg-card px-5 py-5">
          <div className="label-caps">Evidence confidence</div>
          <div className="mt-2">
            <EvidenceBadge confidence={results.evidenceConfidence} />
          </div>
        </div>
        <div className="bg-card px-5 py-5">
          <div className="label-caps">Total simulated observations</div>
          <div className="tabular mt-1.5 text-2xl font-semibold text-foreground">
            {totalObservations.toLocaleString()}
          </div>
        </div>
        <div className="bg-card px-5 py-5">
          <div className="label-caps">Pilot size</div>
          <div className="tabular mt-1.5 text-2xl font-semibold text-foreground">
            {experiment.pilotSize.toLocaleString()}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">per variant</p>
        </div>
      </section>

      <ContextCard experiment={experiment} />

      {/* Metric comparison table */}
      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-foreground">Variant comparison</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Aggregated across {totalObservations.toLocaleString()} simulated observations.
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">Metric</TableHead>
              {variants.map((v) => (
                <TableHead key={v.id} className="text-right">
                  {v.name}
                  {v.id === winnerId ? (
                    <span className="ml-1.5 text-primary" title="Predicted winner">
                      ★
                    </span>
                  ) : null}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {SNAPSHOT_METRIC_DEFS.map((m) => {
              const values = variants
                .map((v) => results.variantMetrics[v.id]?.[m.key])
                .filter((v): v is number => typeof v === "number");
              const best = m.lowerIsBetter ? Math.min(...values) : Math.max(...values);
              return (
                <TableRow key={m.key}>
                  <TableCell className="pl-5">
                    <div className="font-medium text-foreground">{m.label}</div>
                    <div className="text-xs text-muted-foreground">{m.help}</div>
                    <div className="mt-1 flex items-center gap-2">
                      {m.role === "informational" ? (
                        <Pill tone="neutral">Informational</Pill>
                      ) : null}
                      {m.lowerIsBetter ? (
                        <span className="text-[11px] text-muted-foreground">Lower is better</span>
                      ) : null}
                    </div>
                  </TableCell>
                  {variants.map((v) => {
                    const value = results.variantMetrics[v.id]?.[m.key];
                    if (typeof value !== "number") return <TableCell key={v.id} />;
                    return (
                      <TableCell key={v.id} className="tabular text-right">
                        <span
                          className={cn(
                            "text-sm",
                            value === best ? "font-semibold text-foreground" : "text-foreground/70",
                          )}
                        >
                          {value}
                          <span className="ml-0.5 text-xs text-muted-foreground">{m.unit}</span>
                        </span>
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <div className="border-t border-border px-5 py-3">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Agent certainty reflects simulated agent confidence in its selected action. It is not
              experiment evidence.
            </p>
          </div>
        </div>
      </section>

      {/* Chart */}
      <section className="rounded-lg border border-border bg-card p-5 shadow-card">
        <h2 className="text-sm font-semibold text-foreground">Comparison chart</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Confusion rate and no-action rate are inverse metrics — lower is better.
        </p>
        <div className="mt-5 h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="metric"
                tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--color-border)" }}
                interval={0}
                height={56}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <Tooltip
                cursor={{ fill: "var(--color-muted)" }}
                contentStyle={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
              {variants.map((v, i) => (
                <Bar
                  key={v.id}
                  dataKey={v.name}
                  fill={chartColors[i % chartColors.length]}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={26}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Rationale + observed issues */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-6 shadow-card">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Why this result</h2>
          </div>
          {results.primaryDifference ? (
            <p className="mt-3 text-sm leading-relaxed text-foreground/85">
              {results.primaryDifference}
            </p>
          ) : null}
          {results.rationale ? (
            <p className="mt-3 text-sm leading-relaxed text-foreground/85">{results.rationale}</p>
          ) : null}
          <p className="mt-4 text-[11px] text-muted-foreground">
            Generated summary based on simulated behaviour. Treat as a hypothesis to test with real
            users.
          </p>
        </section>

        <section className="rounded-lg border border-border bg-card p-6 shadow-card">
          <div className="flex items-center gap-2">
            <TriangleAlert className="size-4 text-warning" />
            <h2 className="text-sm font-semibold text-foreground">Observed issues</h2>
          </div>
          <ul className="mt-4 space-y-3">
            {results.observedIssues.map((issue) => {
              const variantName =
                experiment.variants.find((v) => v.id === issue.variantId)?.name ?? "—";
              return (
                <li key={issue.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill
                      tone={
                        issue.severity === "high"
                          ? "warning"
                          : issue.severity === "medium"
                            ? "info"
                            : "neutral"
                      }
                    >
                      {issue.severity}
                    </Pill>
                    <span className="text-xs text-muted-foreground">{variantName}</span>
                    {typeof issue.affectedShare === "number" ? (
                      <span className="text-xs text-muted-foreground">
                        · {issue.affectedShare}% affected
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1.5 text-sm font-medium text-foreground">{issue.title}</div>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                    {issue.description}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {/* Behavioural cohorts */}
      <section className="rounded-lg border border-border bg-card p-6 shadow-card">
        <h2 className="text-sm font-semibold text-foreground">Behavioural cohorts</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Synthetic population varied around the primary persona.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {results.behaviouralCohorts.map((cohort) => {
            const scores = variants.map((v) => cohort.variantScores[v.id] ?? 0);
            const bestIdx = scores.indexOf(Math.max(...scores));
            const bestVariant = variants[bestIdx];
            return (
              <div key={cohort.id} className="rounded-md border border-border bg-surface p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-foreground">{cohort.name}</span>
                  <span className="tabular text-sm text-muted-foreground">{cohort.share}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${cohort.share}%` }}
                  />
                </div>
                {cohort.summary ? (
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    {cohort.summary}
                  </p>
                ) : null}
                {bestVariant ? (
                  <div className="mt-3">
                    <Pill tone="accent">Strongest variant: {bestVariant.name}</Pill>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      {/* Click map preview */}
      {Object.keys(results.clickPoints).length > 0 ? (
        <section className="rounded-lg border border-border bg-card p-6 shadow-card">
          <div className="flex items-center gap-2">
            <MousePointerClick className="size-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Simulated click distribution</h2>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Representative synthetic first-click sample.
          </p>
          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-success" aria-hidden="true" />
              Correct first action
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-full border-2 border-destructive bg-transparent"
                aria-hidden="true"
              />
              Other first action
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-4 border-2 border-primary/70" aria-hidden="true" />
              Expected target
            </span>
          </div>
          <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {variants.map((variant) => {
              const points = results.clickPoints[variant.id] ?? [];
              const target = variant.detectedTarget;
              return (
                <div key={variant.id}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{variant.name}</span>
                    {target ? (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Target className="size-3" />
                        {target.label}
                      </span>
                    ) : null}
                  </div>
                  <ClickMapPreview
                    screenshotUrl={variant.screenshotUrl}
                    target={target?.boundingBox}
                    points={points}
                  />
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Recommendation */}
      <section className="rounded-lg border border-primary/25 bg-accent p-6">
        <div className="label-caps text-accent-foreground/70">Recommendation</div>
        <p className="mt-2 text-lg font-semibold text-accent-foreground">
          {results.recommendation}
        </p>
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-accent-foreground/80">
          Synthetic simulations are a pre-testing signal used to prioritise what should be validated
          with real users. They are not a substitute for usability research or production
          experimentation.
        </p>
      </section>
    </div>
  );
}

// ─── Click map preview ───────────────────────────────────────────

function isMockScreenshot(url: string): boolean {
  return url.startsWith("mock://");
}

function ClickMapPreview({
  screenshotUrl,
  target,
  points,
}: {
  screenshotUrl: string | undefined;
  target: { x: number; y: number; width: number; height: number } | undefined;
  points: { x: number; y: number; correct: boolean }[];
}) {
  if (!screenshotUrl) {
    return (
      <div className="flex aspect-[3/4] items-center justify-center rounded-md border border-border bg-surface text-xs text-muted-foreground">
        No screenshot
      </div>
    );
  }

  const isMock = isMockScreenshot(screenshotUrl);

  return (
    <div className="relative overflow-hidden rounded-md border border-border bg-surface">
      {isMock ? (
        <div className="flex aspect-[3/4] flex-col items-center justify-center gap-2 bg-muted/30">
          <Camera className="size-6 text-muted-foreground/50" aria-hidden="true" />
          <span className="text-xs text-muted-foreground">Screenshot unavailable in demo data</span>
        </div>
      ) : (
        <img
          src={screenshotUrl}
          alt="Variant screenshot"
          className="block max-h-[400px] w-full object-contain"
          draggable={false}
        />
      )}
      {/* Target bounding box */}
      {target ? (
        <div
          className="pointer-events-none absolute border-2 border-primary/70"
          style={{
            left: `${target.x * 100}%`,
            top: `${target.y * 100}%`,
            width: `${target.width * 100}%`,
            height: `${target.height * 100}%`,
          }}
        />
      ) : null}
      {/* Click points — correct = solid dot, incorrect = outlined ring */}
      {points.map((pt, i) => (
        <div
          key={i}
          className={cn(
            "pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full",
            pt.correct
              ? "size-2 bg-success ring-1 ring-white/50"
              : "size-2.5 border-2 border-destructive bg-transparent",
          )}
          style={{ left: `${pt.x * 100}%`, top: `${pt.y * 100}%` }}
        />
      ))}
    </div>
  );
}
