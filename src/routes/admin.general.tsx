import { createFileRoute } from "@tanstack/react-router";

import { PageBody, PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/admin/general")({
  head: () => ({
    meta: [
      { title: "General Settings — Synthetic UX Lab" },
      { name: "description", content: "Organization and workspace configuration." },
      { property: "og:title", content: "General Settings — Synthetic UX Lab" },
      { property: "og:description", content: "Organization and workspace configuration." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GeneralSettingsPage,
});

function GeneralSettingsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Admin Center"
        title="General"
        description="Organization and workspace-level configuration."
      />
      <PageBody>
        <div className="rounded-lg border border-border bg-card px-6 py-16 text-center shadow-card">
          <p className="text-sm text-muted-foreground">
            General settings will appear here.
          </p>
        </div>
      </PageBody>
    </>
  );
}
