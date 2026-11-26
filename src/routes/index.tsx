import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Plus } from "lucide-react";
import { AppShell, PageBody, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useDraft } from "@/lib/draft-store";
import { getExperiment } from "@/lib/mock-data";
import { isCompletedDemo } from "@/lib/saved-example";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Experiments — Synthetic UX Lab" },
      { name: "description", content: "Compare interface variants." },
    ],
  }),
  component: ExperimentsPage,
});

function ExperimentsPage() {
  const example = getExperiment("exp-1042");
  const { draft } = useDraft();
  const hasResults = Boolean(draft.pilotRuns?.length);
  const isDemo = isCompletedDemo(draft);
  return (
    <AppShell>
      <PageHeader
        eyebrow="Synthetic UX Pre-Testing"
        title="Experiments"
        description="Compare interface variants and review visual findings."
        actions={
          <Button asChild>
            <Link to="/experiments/new">
              <Plus className="size-4" /> New Experiment
            </Link>
          </Button>
        }
      />
      <PageBody>
        <section className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card p-5">
          <div><h2 className="font-semibold">Run a trial</h2><p className="mt-1 text-sm text-muted-foreground">Try a small screenshot pilot and download its results. Trial data stays in this page only.</p></div>
          <Button asChild><Link to="/trial">Start trial <ArrowRight className="size-4" /></Link></Button>
        </section>
        <section className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold">Experiments</h2>
          </div>
          <div className="divide-y divide-border">
            {example && (
              <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-5">
                <div>
                  <h3 className="font-medium">
                    PDP page comparison with comparable product detail
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Completed example · AI-generated visual comparison
                  </p>
                </div>
                <Button variant="outline" asChild>
                  <Link to="/experiments/$experimentId" params={{ experimentId: example.id }}>
                    View example <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-5">
              <div>
                <h3 className="font-medium">{draft.name || "H&M and Zara comparison"}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {hasResults
                    ? isDemo ? "Demo pilot · results ready" : "AI comparison ready · current session"
                    : "Demo experiment · H&M and Zara sample screenshots"}
                </p>
              </div>
              {hasResults ? (
                <Button variant="outline" asChild>
                  <Link
                    to="/experiments/$experimentId"
                    params={{ experimentId: "prototype-current" }}
                  >
                    {isDemo ? "View demo" : "View results"} <ArrowRight className="size-4" />
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" asChild>
                  <Link to="/experiments/new">
                    Open demo <ArrowRight className="size-4" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </section>
      </PageBody>
    </AppShell>
  );
}
