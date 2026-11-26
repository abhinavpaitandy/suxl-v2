import { createContext, useContext, useState, type ReactNode } from "react";
import { Layers3 } from "lucide-react";
import type { PilotRun } from "@/lib/ai/pilot-client";

function useComparisonState() {
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showPersonaPath, setShowPersonaPath] = useState(false);
  const [showUEyes, setShowUEyes] = useState(false);
  const [showPath, setShowPath] = useState(false);
  const [showAccessibility, setShowAccessibility] = useState(false);
  const [accessibilityVersion, setAccessibilityVersion] = useState(0);
  const [selected, setSelected] = useState("0");
  return { showHeatmap, setShowHeatmap, showPersonaPath, setShowPersonaPath, showUEyes, setShowUEyes, showPath, setShowPath, showAccessibility, setShowAccessibility, accessibilityVersion, setAccessibilityVersion, selected, setSelected };
}
type ComparisonState = ReturnType<typeof useComparisonState>;
const Context = createContext<ComparisonState | null>(null);
export const useComparison = () => useContext(Context);
export function ComparisonProvider({ children }: { children: ReactNode }) {
  const state = useComparisonState();
  return <Context.Provider value={state}>{children}</Context.Provider>;
}

export function ComparisonControls({ runs }: { runs: PilotRun[] }) {
  const state = useComparison();
  if (!state) return null;
  const people = [...new Set(runs.map((run) => run.run))].sort((a, b) => a - b);
  return <section aria-label="Comparison visualisation controls" className="rounded-lg border border-border bg-card p-5">
    <div className="flex items-start gap-3"><Layers3 className="mt-0.5 size-5 text-primary" aria-hidden="true" /><div><h2 className="text-base font-semibold">Compare visualisations</h2><p className="mt-1 text-sm text-muted-foreground">Choose layers and a person for all variants.</p></div></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Control title="Click heatmap" label="Show click heatmap" checked={state.showHeatmap} onChange={state.setShowHeatmap} color="bg-orange-500" />
      <Control title="Persona attention" label="Show persona-specific predicted attention path" checked={state.showPersonaPath} onChange={state.setShowPersonaPath} color="bg-[#9b3612]" />
      <Control title="UEyes attention" label="Show UEyes predicted attention path" checked={state.showUEyes} onChange={state.setShowUEyes} color="bg-[#8a239a]" />
      <Control title="Illustrative path" label="Show illustrative gaze path" checked={state.showPath} onChange={state.setShowPath} color="bg-[#0b3d91]" />
      <Control title="Accessibility" label="Show accessibility suggestions" checked={state.showAccessibility} onChange={state.setShowAccessibility} color="bg-amber-600" />
    </div>
    {state.showAccessibility && <div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" className="rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" onClick={() => state.setAccessibilityVersion((version) => version + 1)}>Run fresh accessibility analysis</button><span className="text-xs text-muted-foreground">Reanalyses each screenshot instead of using cached suggestions.</span></div>}
    {(state.showPersonaPath || state.showPath) && <label className="mt-4 flex flex-wrap items-center gap-3 text-sm font-medium">Person <select aria-label="Person for comparison" className="rounded-md border border-input bg-background px-3 py-2" value={state.selected} onChange={(event) => state.setSelected(event.target.value)}>{people.map((run) => <option key={run} value={String(run)}>Person {run + 1}</option>)}</select><span className="text-xs font-normal text-muted-foreground">The same person is shown across variants.</span></label>}
    <details className="mt-4 text-sm text-muted-foreground">
      <summary className="cursor-pointer font-medium text-foreground">About these overlays</summary>
      <div className="mt-3 space-y-3 leading-relaxed">
        <p><strong className="text-foreground">Persona attention.</strong> The AI predicts a sequence of locations using the selected person's profile and the screenshot. Compare the same person across variants; these are hypothetical predictions, not measured gaze. Different people can receive similar predictions.</p>
        <p><strong className="text-foreground">UEyes attention.</strong> A general free-viewing prediction for the screenshot, independent of the selected person and task. The first point is a centre seed; the following points are predicted fixations, not recorded eye tracking. <a href="https://userinterfaces.aalto.fi/ueyeschi23/" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">Read the UEyes research <span className="sr-only">(opens in a new tab)</span></a>.</p>
        <p><strong className="text-foreground">Illustrative path.</strong> A schematic route to the selected person's predicted first click. Its starting point and intermediate stops are invented; only the endpoint is a model-predicted click. It is not eye tracking or an AI-predicted gaze path. No route is shown when there is no click.</p>
        <p><strong className="text-foreground">Accessibility suggestions.</strong> When switched on, AI analyses each screenshot for possible visual issues. Hover or focus a dot to read the suggestion. These are unverified observations, not an accessibility audit; screenshots cannot reveal keyboard or screen-reader behaviour.</p>
      </div>
    </details>
  </section>;
}

function Control({ title, label, checked, onChange, color }: { title: string; label: string; checked: boolean; onChange: (value: boolean) => void; color: string }) {
  return <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5">
    <div className="min-w-0"><span className="flex items-center gap-2 text-sm font-medium"><span className={`size-2 shrink-0 rounded-full ${color}`} aria-hidden="true" />{title}</span></div>
    <label className="relative shrink-0 cursor-pointer"><input type="checkbox" aria-label={label} checked={checked} onChange={(event) => onChange(event.target.checked)} className="peer sr-only" /><span className="block h-5 w-9 rounded-full bg-slate-300 transition-colors peer-checked:bg-primary peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary" /><span className="pointer-events-none absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4" /></label>
  </div>;
}
