import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { AppShell, PageBody, PageHeader } from '@/components/app-shell';
import { WizardProgress } from '@/components/experiment-stepper';
import { Button } from '@/components/ui/button';
import { ComparisonControls, ComparisonProvider } from '@/components/comparison-controls';
import { ClickHeatmapPreview } from '@/components/click-heatmap-preview';
import { DraftProvider, useDraft } from '@/lib/draft-store';
import { SetupPage } from '@/routes/experiments.new.index';
import { VariantUploadPage } from '@/routes/experiments.new.variants';
import { TargetReviewPage } from '@/routes/experiments.new.targets';
import { generatePilotPeople, runScreenshotPilot, type PilotRun, type PilotTraceEvent } from '@/lib/ai/pilot-client';
import type { AccessibilityFinding } from '@/lib/ai/accessibility-schema';
import { exportTrialArchive } from '@/lib/trial-export';

export const Route = createFileRoute('/trial')({ component: TrialPage });
type Status = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';
function TrialPage() { return <DraftProvider ephemeral><TrialWizard /></DraftProvider>; }
function TrialWizard() {
  const { draft } = useDraft();
  const [step, setStep] = useState(1);
  const [tab, setTab] = useState<'people' | 'prototype'>('people');
  const [diversity, setDiversity] = useState<'low' | 'medium' | 'high'>('high');
  const [count, setCount] = useState(3);
  const [status, setStatus] = useState<Status>('idle');
  const [phase, setPhase] = useState<'people' | 'prototype'>('people');
  const [profiles, setProfiles] = useState<string[]>([]);
  const [runs, setRuns] = useState<PilotRun[]>([]);
  const [progress, setProgress] = useState(0);
  const [trace, setTrace] = useState<{ time: string; message: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [exportError, setExportError] = useState('');
  const [accessibility, setAccessibility] = useState<Record<string, AccessibilityFinding[] | null>>({});
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const log = (event: PilotTraceEvent) => setTrace((old) => [...old, { time: new Date().toISOString(), message: event.message }]);
  function goStep(next: number) {
    if (status === 'running') return;
    if (next < 4) { setProfiles([]); setRuns([]); setProgress(0); setTrace([]); setAccessibility({}); setStatus('idle'); setError(null); setTab('people'); }
    setStep(next); window.scrollTo(0, 0);
  }
  async function generatePeople() {
    const current = new AbortController(); controller.current = current; setPhase('people'); setStatus('running'); setError(null); setTrace([]); setProfiles([]); setRuns([]); setProgress(0); setAccessibility({});
    try { const people = await generatePilotPeople({ persona: draft.persona, task: draft.task, count, diversity, signal: current.signal, cache: false, onTrace: log }); setProfiles(people); setStatus('idle'); }
    catch (cause) { const message = current.signal.aborted ? 'People generation cancelled.' : cause instanceof Error ? cause.message : 'People generation failed.'; setError(message); setStatus(current.signal.aborted ? 'cancelled' : 'failed'); setTrace((old) => [...old, { time: new Date().toISOString(), message }]); }
    finally { controller.current = null; }
  }
  async function run() {
    if (profiles.length !== count || draft.variants.some((v) => !v.screenshotUrl)) { setError('Generate the people and provide a screenshot for each variant.'); return; }
    const current = new AbortController(); controller.current = current; setPhase('prototype'); setStatus('running'); setError(null); setRuns([]); setProgress(0); setAccessibility({});
    try { const results = await runScreenshotPilot({ variants: draft.variants, persona: draft.persona, task: draft.task, runsPerVariant: count, diversity, signal: current.signal, profiles, cache: false, onTrace: log, onProgress: setProgress, onDecision: (run) => setRuns((old) => [...old, run]) }); setRuns(results); setStatus('completed'); }
    catch (cause) { const message = current.signal.aborted ? 'Trial cancelled.' : cause instanceof Error ? cause.message : 'Trial failed.'; setError(message); setStatus(current.signal.aborted ? 'cancelled' : 'failed'); setTrace((old) => [...old, { time: new Date().toISOString(), message }]); }
    finally { controller.current = null; }
  }
  async function download() {
    if (status === 'idle' || status === 'running') return;
    setExportError('');
    try { await exportTrialArchive({ name: draft.name, persona: draft.persona, task: draft.task, peopleRequested: count, status, error, trace, profiles, runs, variants: draft.variants, accessibility }); }
    catch (cause) { setExportError(cause instanceof Error ? cause.message : 'Could not export the trial.'); }
  }
  function invalidatePilot() { setProfiles([]); setRuns([]); setProgress(0); setStatus('idle'); setError(null); setAccessibility({}); }
  const ready = profiles.length === count;
  return <AppShell>
    <div className="mx-auto max-w-7xl px-8 pt-4 text-sm text-muted-foreground">Trial data stays in memory and is lost when you leave or reload. Download your results before leaving. AI requests may incur costs.</div>
    {step === 1 && <SetupPage onStep={goStep} />}
    {step === 2 && <VariantUploadPage onStep={goStep} />}
    {step === 3 && <TargetReviewPage onStep={goStep} />}
    {step === 4 && <><PageHeader eyebrow="Trial · Step 4 of 5" title="Review and analyse" description="Generate people, then run the prototype pilot." /><WizardProgress currentStep={4} readOnly /><PageBody><div className="max-w-3xl space-y-6">
      <div role="tablist" aria-label="Simulation stages" className="flex gap-2 border-b border-border"><button role="tab" aria-selected={tab === 'people'} onClick={() => setTab('people')} className={`px-4 py-3 ${tab === 'people' ? 'border-b-2 border-primary font-semibold' : 'text-muted-foreground'}`}>1. People</button><button role="tab" aria-selected={tab === 'prototype'} onClick={() => setTab('prototype')} className={`px-4 py-3 ${tab === 'prototype' ? 'border-b-2 border-primary font-semibold' : 'text-muted-foreground'}`}>2. Prototype</button></div>
      <div className="rounded-lg border bg-card p-5 space-y-2 text-sm"><p><strong>Experiment:</strong> {draft.name}</p><p><strong>Persona:</strong> {draft.persona}</p><p><strong>Task:</strong> {draft.task}</p><p><strong>Success event:</strong> {draft.successEvent}</p>{draft.variants.map((v) => <p key={v.id}><strong>{v.name}:</strong> {v.detectedTarget?.label || 'Target not reviewed'}</p>)}</div>
      {tab === 'people' ? <section className="rounded-lg border bg-card p-5 space-y-4"><h2 className="font-semibold">People simulator</h2><p className="text-sm text-muted-foreground">Generate fictional people from the persona. The same people are run independently against each screenshot.</p><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">People per variant<select className="mt-2 block w-full rounded-md border bg-background p-2" disabled={status === 'running'} value={count} onChange={(e) => { setCount(Number(e.target.value)); invalidatePilot(); }}><option value={1}>1 person</option><option value={3}>3 people</option><option value={10}>10 people</option></select></label><label className="text-sm font-medium">Behaviour diversity<select className="mt-2 block w-full rounded-md border bg-background p-2" disabled={status === 'running'} value={diversity} onChange={(e) => { setDiversity(e.target.value as typeof diversity); invalidatePilot(); }}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label></div><p className="text-sm text-muted-foreground">{count} people × {draft.variants.length} variants = {count * draft.variants.length} screenshot decisions, plus persona generation.</p><Button variant="outline" disabled={status === 'running'} onClick={() => void generatePeople()}>{ready ? 'Generate new people' : `Generate ${count} ${count === 1 ? 'person' : 'people'}`}</Button>{status === 'running' && phase === 'people' && <p role="status">Generating people…</p>}{ready && <><details><summary className="cursor-pointer text-sm font-medium">Review {count} generated {count === 1 ? 'person' : 'people'}</summary><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">{profiles.map((p, i) => <li key={i}>{p}</li>)}</ol></details><Button onClick={() => setTab('prototype')}>Continue to prototype</Button></>}</section> : <section className="rounded-lg border bg-card p-5 space-y-4"><h2 className="font-semibold">Prototype simulation</h2><p className="text-sm text-muted-foreground">Each person predicts a first action independently for each screenshot. Results are not measured user behaviour.</p><div className="grid grid-cols-2 gap-4">{draft.variants.map((v) => <div key={v.id} className="overflow-hidden rounded border"><img className="h-40 w-full object-cover object-top" src={v.screenshotUrl} alt={`${v.name} screenshot`} /><p className="p-2 text-sm">{v.name}</p></div>)}</div><p role="status" className="text-sm">{status === 'running' && phase === 'prototype' ? `Running decisions: ${progress} of ${count * draft.variants.length}` : status === 'completed' ? 'Pilot complete. Your comparison is ready to view.' : `Generated people: ${profiles.length} of ${count}`}</p><Button onClick={() => void run()} disabled={!ready || status === 'running'}>Run screenshot pilot</Button>{status === 'completed' && <Button className="ml-3" onClick={() => goStep(5)}>View results</Button>}{(status === 'failed' || status === 'cancelled') && runs.length > 0 && <Button className="ml-3" variant="outline" onClick={() => goStep(5)}>View partial results</Button>}</section>}
      {trace.length > 0 && <details className="rounded-lg border bg-card p-5"><summary className="cursor-pointer font-medium">Pilot trace ({trace.length} events)</summary><ol className="mt-3 max-h-60 overflow-auto space-y-2 text-sm">{trace.map((e, i) => <li key={i}>{new Date(e.time).toLocaleTimeString()} {e.message}</li>)}</ol></details>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex gap-3"><Button variant="outline" disabled={status === 'running'} onClick={() => goStep(3)}>Back to targets</Button>{status === 'running' && <Button variant="outline" onClick={() => controller.current?.abort()}>Cancel analysis</Button>}</div>
    </div></PageBody></>}
    {step === 5 && <><PageHeader eyebrow="Trial · Step 5 of 5" title="Trial results" description={`${progress} of ${count * draft.variants.length} screenshot decisions completed.`} /><WizardProgress currentStep={5} readOnly /><PageBody><div className="space-y-6"><div className="flex flex-wrap items-center gap-3"><Button onClick={() => void download()}>Download raw data (.zip)</Button><Button variant="outline" onClick={() => goStep(4)}>Back to simulation</Button><Button variant="outline" asChild><Link to="/">Back to experiments</Link></Button></div>{exportError && <p role="alert" className="text-destructive">{exportError}</p>}{error && <p role="alert" className="text-destructive">Partial results: {error}</p>}
      <ComparisonProvider><ComparisonControls runs={runs} /><div className="grid gap-6 md:grid-cols-2">{draft.variants.filter((v) => v.screenshotUrl).map((variant) => { const vr = runs.filter((r) => r.variantId === variant.id); const clicks = vr.flatMap((r) => r.outcome.action === 'click' ? [{ persona: r.profile, x: r.outcome.x, y: r.outcome.y }] : []); return <section key={variant.id} className="rounded-lg border bg-card p-5"><h2 className="mb-3 font-semibold">{variant.name}</h2><ClickHeatmapPreview id={`trial-heatmap-${variant.id}`} variantName={variant.name} screenshotUrl={variant.screenshotUrl!} target={variant.detectedTarget?.boundingBox} clicks={clicks} runs={vr} ephemeral onAccessibilityFindings={(findings) => setAccessibility((old) => ({ ...old, [variant.id]: findings }))} /></section>; })}</div></ComparisonProvider>
      <p className="text-sm text-muted-foreground">Predictions are synthetic, not measured user behaviour. Accessibility suggestions are not an audit. The ZIP includes completed findings only when accessibility has been analysed.</p></div></PageBody></>}
  </AppShell>;
}
