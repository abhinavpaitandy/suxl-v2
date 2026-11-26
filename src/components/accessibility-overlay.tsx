import { useEffect, useRef, useState } from "react";
import { imageTiles } from "@/lib/ai/visual-client";
import { accessibilityFindingsSchema, type AccessibilityFinding } from "@/lib/ai/accessibility-schema";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Check, Copy, X } from "lucide-react";

// Keep provider requests sequential to avoid launching one request per variant simultaneously.
let queue: Promise<unknown> = Promise.resolve();
async function analyse(screenshotUrl: string, fresh: boolean, cache: boolean): Promise<AccessibilityFinding[]> {
  const response = await fetch(screenshotUrl);
  if (!response.ok) throw new Error("Could not read the screenshot.");
  const hash = await crypto.subtle.digest("SHA-256", await response.arrayBuffer());
  let token: string | undefined;
  try { const { supabase } = await import("@/integrations/supabase/client"); token = (await supabase.auth.getSession()).data.session?.access_token; } catch { /* Local preview. */ }
  const headers = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const context = await fetch("/api/pilot-cache-context", { method: "POST", headers, body: "{}" });
  if (!context.ok) throw new Error("Unable to identify the configured AI provider.");
  const provider = await context.json();
  const key = `suxl-a11y-v1-${provider.provider}-${provider.model}-${Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("")}`;
  try { const cached = cache && !fresh && accessibilityFindingsSchema.safeParse(JSON.parse(sessionStorage.getItem(key) || "null")); if (cached && cached.success) return cached.data; } catch { /* Cache is optional. */ }
  const tiles = await imageTiles(screenshotUrl);
  const result = await fetch("/api/accessibility-analysis", { method: "POST", headers, body: JSON.stringify({ tiles }), signal: AbortSignal.timeout(180_000) });
  const body = await result.json().catch(() => ({}));
  if (!result.ok) throw new Error(typeof body.error === "string" ? body.error : "Accessibility analysis failed.");
  const findings = accessibilityFindingsSchema.parse(body.findings);
  try { if (cache) sessionStorage.setItem(key, JSON.stringify(findings)); } catch { /* Cache is optional. */ }
  return findings;
}

export function AccessibilityOverlay({ screenshotUrl, variantName, enabled, refreshVersion = 0, cache = true, onFindings }: { screenshotUrl: string; variantName: string; enabled: boolean; refreshVersion?: number; cache?: boolean; onFindings?: (findings: AccessibilityFinding[] | null) => void }) {
  const [findings, setFindings] = useState<AccessibilityFinding[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const refreshSeen = useRef(refreshVersion);
  const forceFresh = useRef(false);
  useEffect(() => { setFindings(null); setError(""); }, [screenshotUrl]);
  useEffect(() => {
    if (refreshSeen.current !== refreshVersion) {
      refreshSeen.current = refreshVersion;
      forceFresh.current = true;
      setFindings(null); setError(""); onFindings?.(null);
      setRetry((value) => value + 1);
    }
  }, [refreshVersion]);
  useEffect(() => {
    if (!enabled || findings || error) return;
    let active = true;
    setLoading(true);
    const job = queue.catch(() => undefined).then(() => { if (!active) throw new Error("Analysis cancelled."); return analyse(screenshotUrl, forceFresh.current, cache); });
    queue = job.catch(() => undefined);
    job.then((items) => { if (active) { forceFresh.current = false; setFindings(items); onFindings?.(items); } }).catch((err) => { if (active) setError(err instanceof Error ? err.message : "Accessibility analysis failed."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [enabled, screenshotUrl, findings, error, retry, cache]);
  if (!enabled) return null;
  return <>
    {findings?.map((finding, index) => <AccessibilityMarker key={`${finding.x}-${finding.y}-${index}`} finding={finding} index={index} variantName={variantName} />)}
    {(!findings || findings.length === 0) && <div className="absolute bottom-2 left-2 right-2 z-30 rounded bg-background/95 px-3 py-2 text-xs shadow" role="status">{loading ? "Checking screenshot for accessibility suggestions…" : error ? <>{error} <button type="button" className="font-medium text-primary underline" onClick={() => { setError(""); setRetry((n) => n + 1); }}>Retry</button></> : findings?.length ? `${findings.length} possible visual accessibility ${findings.length === 1 ? "issue" : "issues"}. Hover or focus the dots for suggestions.` : findings ? "No visual suggestions found. This is not an accessibility audit." : "Preparing accessibility analysis…"}</div>}
  </>;
}

function AccessibilityMarker({ finding, index, variantName }: { finding: AccessibilityFinding; index: number; variantName: string }) {
  const [open, setOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  async function copySuggestion() {
    try {
      await navigator.clipboard.writeText(`Potential issue: ${finding.issue}\nSuggestion: ${finding.suggestion}`);
      setCopyStatus("copied");
    } catch { setCopyStatus("error"); }
  }
  function close() {
    setOpen(false);
    setCopyStatus("idle");
    // Avoid immediately reopening the popover through the marker's focus handler.
  }
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverAnchor asChild><button type="button" className="absolute z-30 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" style={{ left: `${finding.x * 100}%`, top: `${finding.y * 100}%` }} aria-label={`${variantName} accessibility suggestion ${index + 1}: ${finding.issue}`} aria-expanded={open} onPointerEnter={(event) => { if (event.pointerType !== "touch") setOpen(true); }} onFocus={() => setOpen(true)} onClick={() => setOpen(true)}><span className="absolute size-5 rounded-full bg-amber-500/50 motion-safe:animate-ping" aria-hidden="true" /><span className="relative size-3 rounded-full border-2 border-white bg-amber-600 shadow" aria-hidden="true" /></button></PopoverAnchor>
    <PopoverContent side="top" onOpenAutoFocus={(event) => event.preventDefault()} onCloseAutoFocus={(event) => event.preventDefault()} onInteractOutside={(event) => event.preventDefault()} className="w-72 max-w-[calc(100vw-2rem)] bg-foreground p-3 text-background" aria-label={`${variantName} accessibility suggestion ${index + 1}`}>
      <div className="flex items-start justify-between gap-2"><span className="text-xs font-semibold uppercase tracking-wide">Accessibility suggestion</span><div className="flex shrink-0 gap-1"><button type="button" aria-label="Copy accessibility suggestion" title="Copy suggestion" onClick={() => void copySuggestion()} className="rounded p-1 hover:bg-background/20 focus-visible:outline focus-visible:outline-2"><span className="sr-only">Copy suggestion</span>{copyStatus === "copied" ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}</button><button type="button" aria-label="Close accessibility suggestion" title="Close" onClick={close} className="rounded p-1 hover:bg-background/20 focus-visible:outline focus-visible:outline-2"><X className="size-4" aria-hidden="true" /></button></div></div>
      <div className="mt-2 space-y-2 text-sm leading-relaxed"><p><strong>Potential issue:</strong> {finding.issue}</p><p><strong>Suggestion:</strong> {finding.suggestion}</p></div>
      <p className="mt-2 text-xs" role="status">{copyStatus === "copied" ? "Copied" : copyStatus === "error" ? "Could not copy. Check clipboard permissions." : ""}</p>
    </PopoverContent>
  </Popover>;
}
