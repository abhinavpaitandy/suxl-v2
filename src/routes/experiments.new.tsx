import { createFileRoute, Outlet } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/experiments/new")({
  head: () => ({
    meta: [
      { title: "New Experiment — Synthetic UX Lab" },
      { name: "description", content: "Create a synthetic UX pre-testing experiment." },
      { property: "og:title", content: "New Experiment — Synthetic UX Lab" },
      { property: "og:description", content: "Create a synthetic UX pre-testing experiment." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WizardLayout,
});

function WizardLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
