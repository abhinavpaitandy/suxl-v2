import { createFileRoute } from "@tanstack/react-router";

import { PageBody, PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/admin/status")({
  head: () => ({
    meta: [
      { title: "System Status — Synthetic UX Lab" },
      { name: "description", content: "Service health, queue status, and uptime." },
      { property: "og:title", content: "System Status — Synthetic UX Lab" },
      { property: "og:description", content: "Service health, queue status, and uptime." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SystemStatusPage,
});

function SystemStatusPage() {
  return (
    <>
      <PageHeader
        eyebrow="Admin Center"
        title="System Status"
        description="Service health, queue status, and uptime."
      />
      <PageBody>
        <div className="rounded-lg border border-border bg-card px-6 py-16 text-center shadow-card">
          <p className="text-sm text-muted-foreground">
            System status and health metrics will appear here.
          </p>
        </div>
      </PageBody>
    </>
  );
}
