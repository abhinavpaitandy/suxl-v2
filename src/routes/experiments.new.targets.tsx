import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ArrowRight, LoaderCircle, Sparkles } from "lucide-react";

import { PageBody, PageHeader } from "@/components/app-shell";
import { WizardProgress } from "@/components/experiment-stepper";
import { Button } from "@/components/ui/button";
import { TargetReviewCard } from "@/components/target-review-card";
import { useDraft } from "@/lib/draft-store";
import { compareScreenshots } from "@/lib/ai/visual-client";
import { hasVariantSource } from "@/lib/variant-source";
import { isTargetReviewed } from "@/lib/types";

const TITLE = "Review Detected Targets — Synthetic UX Lab";
const DESCRIPTION = "Confirm the interaction area that represents success in each variant.";

export const Route = createFileRoute("/experiments/new/targets")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TargetReviewPage,
});

export function TargetReviewPage({ onStep }: { onStep?: (step: number) => void } = {}) {
  const navigate = useNavigate();
  const { draft, confirmTarget, adjustTarget, setDetectedTarget, setVisualObservations } =
    useDraft();
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [analysisStage, setAnalysisStage] = useState<"preparing" | "checking-cache" | "analysing">(
    "preparing",
  );
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  async function analyseScreenshots() {
    setAnalysisError(null);
    setIsAnalysing(true);
    try {
      const result = await compareScreenshots(
        draft.variants,
        draft.task,
        draft.successEvent,
        setAnalysisStage,
        undefined,
        onStep ? { cache: false } : undefined,
      );
      setVisualObservations(result.observations);
      const missing = draft.variants.filter(
        (variant) =>
          variant.screenshotUrl &&
          !result.targets.some((target) => target.id === variant.id && target.box),
      );
      if (missing.length)
        setAnalysisError(
          `The AI could not locate a target for ${missing.map((variant) => variant.name).join(", ")}. Adjust that target manually.`,
        );
      for (const target of result.targets) {
        if (!target.box) continue;
        setDetectedTarget(target.id, {
          label: target.label,
          boundingBox: target.box,
          status: "unreviewed",
          source: "ai",
          note: target.note,
        });
      }
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "Could not analyse screenshots.");
    } finally {
      setIsAnalysing(false);
    }
  }

  const variants = draft.variants;
  const needsAnalysis = variants.some(
    (v) => !hasVariantSource(v) || (v.screenshotUrl && !v.detectedTarget),
  );
  const screenshotVariants = variants.filter((v) => v.screenshotUrl);

  const reviewedCount = screenshotVariants.filter(
    (v) => v.detectedTarget && isTargetReviewed(v.detectedTarget),
  ).length;
  const allReviewed = reviewedCount === screenshotVariants.length && variants.length >= 2;

  if (needsAnalysis) {
    return (
      <>
        <PageHeader
          eyebrow="New Experiment · Step 3 of 5"
          title="Review Detected Targets"
          description={DESCRIPTION}
          leading={
            <Button variant="outline" asChild>
              <Link to="/experiments/new/variants" onClick={onStep ? (event) => { event.preventDefault(); onStep(2); } : undefined}>
                <ArrowLeft className="size-4" /> Back to Variants
              </Link>
            </Button>
          }
        />
        <WizardProgress currentStep={3} readOnly={Boolean(onStep)} />
        <PageBody>
          <div className="rounded-lg border border-border bg-card px-6 py-16 text-center shadow-card">
            <h2 className="text-sm font-semibold text-foreground">Screens need analysis first</h2>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
              Add a valid URL or upload and analyse a screenshot for each variant.
            </p>
            <Button asChild className="mt-5">
              <Link to="/experiments/new/variants" onClick={onStep ? (event) => { event.preventDefault(); onStep(2); } : undefined}>
                <ArrowLeft className="size-4" />
                Back to Variants
              </Link>
            </Button>
          </div>
        </PageBody>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="New Experiment · Step 3 of 5"
        title="Review Detected Targets"
        description={DESCRIPTION}
        leading={
          <Button variant="outline" asChild>
            <Link to="/experiments/new/variants" onClick={onStep ? (event) => { event.preventDefault(); onStep(2); } : undefined}>
              <ArrowLeft className="size-4" />
              Back to Variants
            </Link>
          </Button>
        }
      />
      <WizardProgress currentStep={3} readOnly={Boolean(onStep)} />

      <PageBody>
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-6">
            {/* Supporting note */}
            <p className="text-sm text-muted-foreground">
              Review and adjust target areas. Placeholder boxes are not detections; AI suggestions
              can be imprecise. Simulation results remain mock data.
            </p>

            <section className="rounded-lg border border-border bg-card p-5 shadow-card">
              <h2 className="text-sm font-semibold">AI visual comparison</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Compare at least two screenshots and suggest target locations. Screenshots and task
                details are sent to the configured AI provider; usage may incur charges. Review each
                suggestion.
              </p>
              <Button
                className="mt-3"
                onClick={analyseScreenshots}
                disabled={isAnalysing || screenshotVariants.length < 2}
              >
                <Sparkles className="size-4" />{" "}
                {isAnalysing ? "Analysing screenshots…" : "Analyse screenshots with AI"}
              </Button>
              {isAnalysing && (
                <div className="mt-4 max-w-xl" role="status" aria-live="polite">
                  <p className="mb-2 text-sm text-muted-foreground">
                    {analysisStage === "preparing"
                      ? "Preparing screenshots…"
                      : analysisStage === "checking-cache"
                        ? "Checking for a saved comparison…"
                        : "Analysing screenshots with AI… This may take a minute."}
                  </p>
                  <div className="flex items-center gap-2 text-sm text-primary">
                    <LoaderCircle
                      aria-hidden="true"
                      className="size-5 animate-spin motion-reduce:animate-none"
                    />
                    <span>Analysis in progress</span>
                  </div>
                </div>
              )}
              {analysisError && (
                <p role="alert" className="mt-3 text-sm text-destructive">
                  {analysisError}
                </p>
              )}
              {draft.visualObservations && (
                <ul className="mt-4 space-y-3">
                  {draft.visualObservations.map((item, index) => (
                    <li key={`${item.title}-${index}`} className="text-sm">
                      <strong>{item.title}:</strong> {item.detail}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {/* Context summary */}
            <div className="rounded-lg border border-border bg-surface px-5 py-4">
              <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-3">
                <ContextRow label="Task" value={draft.task || "—"} />
                <ContextRow label="Success event" value={draft.successEvent || "—"} />
                <ContextRow
                  label="Device"
                  value={draft.device === "mobile" ? "Mobile" : "Desktop"}
                />
              </dl>
            </div>

            {/* Review progress */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-foreground">
                {reviewedCount} of {screenshotVariants.length} targets reviewed
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: `${screenshotVariants.length > 0 ? (reviewedCount / screenshotVariants.length) * 100 : 100}%`,
                  }}
                />
              </div>
            </div>

            {/* Review cards */}
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {screenshotVariants.map((variant) => (
                <TargetReviewCard
                  key={variant.id}
                  variant={variant}
                  onConfirm={() => confirmTarget(variant.id)}
                  onAdjust={(box) => adjustTarget(variant.id, box)}
                />
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3">
              <Button variant="outline" asChild>
                <Link to="/experiments/new/variants" onClick={onStep ? (event) => { event.preventDefault(); onStep(2); } : undefined}>
                  <ArrowLeft className="size-4" />
                  Back to Variants
                </Link>
              </Button>
              <Button
                disabled={!allReviewed}
                onClick={() => onStep ? onStep(4) : navigate({ to: "/experiments/new/simulation" })}
              >
                Continue to Simulation
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>

          {/* Summary panel */}
          <aside className="hidden xl:block xl:sticky xl:top-8 xl:self-start">
            <div className="rounded-lg border border-border bg-card p-5 shadow-card">
              <h3 className="text-sm font-semibold text-foreground">Summary</h3>
              <dl className="mt-4 space-y-3 text-sm">
                <SummaryRow label="Experiment" value={draft.name || "Untitled"} />
                <SummaryRow label="Variants" value={String(variants.length)} />
                <SummaryRow
                  label="Targets reviewed"
                  value={`${reviewedCount} of ${screenshotVariants.length}`}
                />
                <SummaryRow label="Next" value="Configure simulation" />
              </dl>
            </div>
          </aside>
        </div>
      </PageBody>
    </>
  );
}

function ContextRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label-caps">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{value}</dd>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="max-w-[60%] text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}
