import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Sparkles, LoaderCircle } from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";
import { PageBody, PageHeader } from "@/components/app-shell";
import { WizardProgress } from "@/components/experiment-stepper";
import { Button } from "@/components/ui/button";
import { useDraft } from "@/lib/draft-store";
import { generatePilotPeople, runScreenshotPilot, type PilotTraceEvent } from "@/lib/ai/pilot-client";
import { isVariantReady } from "@/lib/variant-source";
import { saveCompletedExample, SAVED_EXAMPLE_KEY, type SavedExample } from "@/lib/saved-example";

export const Route = createFileRoute("/experiments/new/simulation")({
  head: () => ({ meta: [{ title: "Review and analyse — Synthetic UX Lab" }] }),
  component: AnalysisSetupPage,
});

function TraceViewer({ trace }: { trace: Array<{ time: string; message: string }> }) {
  if (!trace.length) return null;
  return (
    <details className="rounded-lg border border-border bg-card p-5">
      <summary className="cursor-pointer font-medium">Pilot trace ({trace.length} {trace.length === 1 ? "event" : "events"})</summary>
      <p className="mt-2 text-sm text-muted-foreground">Generated personas and model decisions from this run. This trace is kept in this page only.</p>
      <ol className="mt-3 max-h-80 space-y-2 overflow-y-auto text-sm" aria-label="Pilot trace">
        {trace.map((entry, index) => <li key={index}><span className="mr-2 text-muted-foreground">{entry.time}</span>{entry.message}</li>)}
      </ol>
    </details>
  );
}

function AnalysisSetupPage() {
  const { draft, setVisualObservations, setSimulatedClicks, setPilotRuns, clearAnalysisResults, restoreSavedPilot } =
    useDraft();
  const animationRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const [running, setRunning] = useState(false);
  const [activeStage, setActiveStage] = useState<"people" | "prototype">("people");
  const [tab, setTab] = useState<"people" | "prototype">("people");
  const [complete, setComplete] = useState(false);
  const [backupKey, setBackupKey] = useState<string>();
  useEffect(() => {
    try { setBackupKey(Object.keys(localStorage).filter((key) => key.startsWith("suxl-draft-backup-v1:")).sort().at(-1)); } catch { /* Browser storage may be unavailable. */ }
  }, []);
  const pilotSize = 10;
  const [people, setPeople] = useState<string[]>([]);
  const [cohortKey, setCohortKey] = useState("");
  const [diversity, setDiversity] = useState<"low" | "medium" | "high">("high");
  const currentCohortKey = JSON.stringify([draft.persona, draft.task, diversity]);
  const cohortReady = people.length === pilotSize && cohortKey === currentCohortKey;
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [trace, setTrace] = useState<Array<{ time: string; message: string }>>([]);
  const [phase, setPhase] = useState("Preparing screenshots…");
  const ready = Boolean(
    draft.name &&
    draft.persona &&
    draft.task &&
    draft.successEvent &&
    draft.variants.length >= 2 &&
    draft.variants.every((v) => v.screenshotUrl && isVariantReady(v)),
  );

  function restorePilot() {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVED_EXAMPLE_KEY) || "null") as SavedExample | null;
      if (!saved?.draft) throw new Error("No saved example pilot was found.");
      restoreSavedPilot(saved.draft);
      setBackupKey(Object.keys(localStorage).filter((key) => key.startsWith("suxl-draft-backup-v1:")).sort().at(-1));
      setError(null); setComplete(true); setActiveStage("prototype"); setTab("prototype");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not restore the saved pilot."); }
  }

  function recordTrace(event: PilotTraceEvent) {
    setTrace((entries) => [...entries, { time: new Date().toLocaleTimeString(), message: event.message }]);
    if (event.stage === "preparing" || (event.stage === "personas" && (event.message.startsWith("Generating people") || event.message.startsWith("Reused saved people")))) setPhase(event.message);
    if (event.stage === "decisions") setPhase("Running independent first-action decisions");
  }

  async function generatePeople() {
    setActiveStage("people");
    const controller = new AbortController();
    controllerRef.current = controller;
    setRunning(true); setComplete(false); setError(null); setTrace([]); setPeople([]);
    setPhase("Preparing people…");
    try {
      const generated = await generatePilotPeople({ persona: draft.persona, task: draft.task, count: pilotSize, diversity, signal: controller.signal, onTrace: recordTrace, fresh: cohortReady });
      setPeople(generated);
      setCohortKey(currentCohortKey);
      setPhase("People ready to review");
    } catch (e) {
      const message = controller.signal.aborted ? "People generation cancelled." : e instanceof Error ? e.message : "Unable to generate people.";
      setError(message);
      setTrace((entries) => [...entries, { time: new Date().toLocaleTimeString(), message: `Stopped: ${message}` }]);
    } finally { controllerRef.current = null; setRunning(false); }
  }

  async function run() {
    setActiveStage("prototype");
    clearAnalysisResults();
    const controller = new AbortController();
    controllerRef.current = controller;
    setRunning(true);
    setComplete(false);
    setError(null);
    setTrace([]);
    setPhase("Preparing screenshots…");
    setProgress({ done: 0, total: pilotSize * draft.variants.length });
    requestAnimationFrame(() =>
      animationRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
    try {
      const runs = await runScreenshotPilot({
        variants: draft.variants,
        persona: draft.persona,
        task: draft.task,
        runsPerVariant: pilotSize,
        diversity,
        profiles: people,
        signal: controller.signal,
        onProgress: (done, total) => setProgress({ done, total }),
        onTrace: recordTrace,
      });
      const clicks = runs.flatMap((run) =>
        run.outcome.action === "click"
          ? [{ id: run.variantId, persona: run.profile, x: run.outcome.x, y: run.outcome.y }]
          : [],
      );
      const observations = draft.variants.map((variant) => {
          const subset = runs.filter((run) => run.variantId === variant.id);
          const clicked = subset.filter((run) => run.outcome.action === "click").length;
          return {
            title: variant.name,
            detail: `${clicked} of ${subset.length} synthetic runs produced a first click; ${subset.length - clicked} took no action.`,
          };
        });
      setPilotRuns(runs);
      setSimulatedClicks(clicks);
      setVisualObservations(observations);
      try {
        saveCompletedExample({ ...draft, pilotRuns: runs, simulatedClicks: clicks, visualObservations: observations });
      } catch {
        setError("Pilot completed, but the example could not be saved in browser storage. Open results to retry saving it.");
      }
      setComplete(true);
    } catch (e) {
      const message = controller.signal.aborted ? "Pilot cancelled." : e instanceof Error ? e.message : "Unable to analyse screenshots.";
      setError(message);
      setTrace((entries) => [...entries, { time: new Date().toLocaleTimeString(), message: `Stopped: ${message}` }]);
    } finally {
      controllerRef.current = null;
      setRunning(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="New Experiment · Step 4 of 5"
        title="Review and analyse"
        description="Review the experiment before generating a visual comparison."
        leading={
          <Button variant="outline" asChild>
            <Link to="/experiments/new/targets">
              <ArrowLeft className="size-4" /> Back to targets
            </Link>
          </Button>
        }
      />
      <WizardProgress currentStep={4} />
      <PageBody>
        <div className="max-w-3xl space-y-6">
          <div ref={animationRef} />
          {backupKey && <Button type="button" variant="outline" onClick={() => {
            const backup = localStorage.getItem(backupKey);
            if (!backup) { setError("The previous demo draft backup is unavailable."); return; }
            const url = URL.createObjectURL(new Blob([backup], { type: "application/json" }));
            const link = document.createElement("a"); link.href = url; link.download = "previous-demo-draft.json"; link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}>Download previous demo draft (.json)</Button>}
          {!draft.pilotRuns?.length && !running && <div className="rounded-lg border bg-card p-4"><p className="text-sm text-muted-foreground">Restore the saved example pilot to this demo. The current draft is backed up in browser storage first.</p><Button type="button" variant="outline" className="mt-3" onClick={restorePilot}>Restore saved pilot to demo</Button></div>}
          <div role="tablist" aria-label="Simulation stages" className="flex gap-2 border-b border-border">
            <button role="tab" aria-selected={tab === "people"} onClick={() => setTab("people")} className={`px-4 py-3 ${tab === "people" ? "border-b-2 border-primary font-semibold" : "text-muted-foreground"}`}>1. People</button>
            <button role="tab" aria-selected={tab === "prototype"} onClick={() => setTab("prototype")} className={`px-4 py-3 ${tab === "prototype" ? "border-b-2 border-primary font-semibold" : "text-muted-foreground"}`}>2. Prototype</button>
          </div>
          {(running || complete) && tab === activeStage && activeStage === "prototype" && (
            <section
              className="rounded-lg border border-border bg-card p-5"
              role="status"
              aria-live="polite"
            >
              <div className="flex items-center gap-2 font-medium">
                {running && (
                  <LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" />
                )}
                {complete
                  ? "Pilot complete"
                  : phase === "Running independent first-action decisions" ? `${phase}: ${progress.done} of ${progress.total}` : phase}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {complete
                  ? "Your comparison is ready to view."
                  : phase === "Running independent first-action decisions"
                    ? "View results becomes available when all decisions finish. The animation illustrates analysis; it does not show live agent actions."
                    : "The animation illustrates analysis; it does not show live agent actions."}
              </p>
              {complete && (
                <Button className="mt-3" asChild>
                  <Link
                    to="/experiments/$experimentId"
                    params={{ experimentId: "prototype-current" }}
                  >
                    View results
                  </Link>
                </Button>
              )}
              <div className="mt-4 grid grid-cols-2 gap-4">
                {draft.variants.map((v) => (
                  <div
                    key={v.id}
                    className="relative h-48 overflow-hidden rounded-md border bg-surface"
                  >
                    <img
                      src={v.screenshotUrl}
                      alt={`${v.name} screenshot`}
                      className="w-full object-cover object-top opacity-80"
                    />
                    {running && (
                      <div
                        aria-hidden="true"
                        className="absolute inset-x-0 top-0 h-1 bg-primary/70 shadow-[0_0_20px_4px] shadow-primary/50 animate-[suxl-scan_3s_ease-in-out_infinite_alternate] motion-reduce:animate-none"
                      />
                    )}
                    <span className="absolute bottom-2 left-2 rounded bg-background/90 px-2 py-1 text-xs font-medium">
                      {v.name}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
          {tab === "prototype" && activeStage === "prototype" && <TraceViewer trace={trace} />}
          <p className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
            Each synthetic run independently predicts a first action from one screenshot. These
            predictions are not measured user behaviour.
          </p>
          <div className="rounded-lg border border-border bg-card p-5 space-y-2 text-sm">
            <p>
              <strong>Experiment:</strong> {draft.name || "—"}
            </p>
            <p>
              <strong>Persona:</strong> {draft.persona || "—"}
            </p>
            <p>
              <strong>Task:</strong> {draft.task || "—"}
            </p>
            <p>
              <strong>Success event:</strong> {draft.successEvent || "—"}
            </p>
            {draft.variants.map((v) => (
              <p key={v.id}>
                <strong>{v.name}:</strong> {v.detectedTarget?.label || "Target not reviewed"}
              </p>
            ))}
          </div>
          <section hidden={tab !== "people"} className="rounded-lg border border-border bg-card p-5 space-y-5">
            <div>
              <h2 className="font-semibold">People simulator</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Generate 10 fictional people from the persona, varying age, gender, location, shopping
                experience, browsing habits, attention and priorities. Some people may inspect competing controls or hesitate; the model chooses each first action. The same profiles are run independently
                against each screenshot. These illustrative profiles do not represent a measured
                population; the pilot measures first actions, not task completion.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-medium">
                <span>Behaviour diversity</span>
                <select
                  className="block w-full rounded-md border border-input bg-background p-2"
                  value={diversity}
                  onChange={(e) => {
                    setDiversity(e.target.value as "low" | "medium" | "high");
                    setComplete(false);
                  }}
                  disabled={running}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
            </div>
            <Button variant="outline" onClick={generatePeople} disabled={!ready || running}> {cohortReady ? "Generate new people" : "Generate 10 people"}</Button>
            {running && activeStage === "people" && (
              <div className="rounded-lg border border-border bg-surface p-4" role="status" aria-live="polite">
                <div className="flex items-center gap-4">
                  <ThinkingOrb state="working" size={64} aria-hidden="true" />
                  <div>
                    <div className="font-medium">{phase}</div>
                    <p className="mt-2 text-sm text-muted-foreground">Generating fictional people from your persona and task.</p>
                  </div>
                </div>
              </div>
            )}
            {activeStage === "people" && <TraceViewer trace={trace} />}
            {cohortReady && <details><summary className="cursor-pointer text-sm font-medium">Review 10 generated people</summary><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">{people.map((person, i) => <li key={i}>{person}</li>)}</ol></details>}
            <p className="text-sm text-muted-foreground">The pilot runs these 10 people once per variant. Percentages describe this small synthetic sample.</p>
            {cohortReady && <Button onClick={() => setTab("prototype")}>Continue to prototype</Button>}
          </section>
          {!ready && (
            <p role="alert" className="text-sm text-destructive">
              Complete setup and add screenshots and reviewed targets for each variant.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-3">
            <Button variant="outline" asChild>
              <Link to="/experiments/new/targets">
                <ArrowLeft className="size-4" /> Back to targets
              </Link>
            </Button>
            {running && (
              <Button variant="outline" onClick={() => controllerRef.current?.abort()}>
                Cancel analysis
              </Button>
            )}
            {tab === "prototype" && complete && (
              <Button asChild>
                <Link
                  to="/experiments/$experimentId"
                  params={{ experimentId: "prototype-current" }}
                >
                  View results
                </Link>
              </Button>
            )}
            {tab === "prototype" && !complete && (
              <Button variant="outline" disabled title="Results are available after all pilot decisions complete">
                View results
              </Button>
            )}
            {tab === "prototype" && <Button onClick={run} disabled={!ready || !cohortReady || running}>
              <Sparkles className="size-4" />{" "}
              {running ? "Running pilot…" : complete ? "View saved pilot again" : error && cohortReady ? "Resume screenshot pilot" : "Run screenshot pilot"}
            </Button>}
          </div>
        </div>
      </PageBody>
    </>
  );
}
