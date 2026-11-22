import { createFileRoute } from "@tanstack/react-router";

import { PageBody, PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/admin/evaluation")({
  head: () => ({
    meta: [
      { title: "Evaluation — Synthetic UX Lab" },
      {
        name: "description",
        content: "Configure metrics, success criteria, and scoring weights.",
      },
      { property: "og:title", content: "Evaluation — Synthetic UX Lab" },
      {
        property: "og:description",
        content: "Configure metrics, success criteria, and scoring weights.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EvaluationPage,
});

function EvaluationPage() {
  return (
    <>
      <PageHeader
        eyebrow="Admin Center"
        title="Evaluation"
        description="Configure metrics, success criteria, and scoring weights."
      />
      <PageBody>
        <div className="rounded-lg border border-border bg-card px-6 py-16 text-center shadow-card">
          <p className="text-sm text-muted-foreground">
            Evaluation configuration will appear here.
          </p>
        </div>
      </PageBody>
    </>
  );
}
