import { createFileRoute } from "@tanstack/react-router";

import { PageBody, PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/admin/ai")({
  head: () => ({
    meta: [
      { title: "AI & Simulation — Synthetic UX Lab" },
      {
        name: "description",
        content: "Model configuration, simulation parameters, and provider settings.",
      },
      { property: "og:title", content: "AI & Simulation — Synthetic UX Lab" },
      {
        property: "og:description",
        content: "Model configuration, simulation parameters, and provider settings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AISimulationPage,
});

function AISimulationPage() {
  return (
    <>
      <PageHeader
        eyebrow="Admin Center"
        title="AI & Simulation"
        description="Model configuration, simulation parameters, and provider settings."
      />
      <PageBody>
        <div className="rounded-lg border border-border bg-card px-6 py-16 text-center shadow-card">
          <p className="text-sm text-muted-foreground">
            AI and simulation configuration will appear here.
          </p>
        </div>
      </PageBody>
    </>
  );
}
