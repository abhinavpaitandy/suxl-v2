import { createFileRoute, Outlet } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Synthetic UX Lab" },
      { name: "description", content: "Synthetic UX Lab administration and configuration." },
      { property: "og:title", content: "Admin — Synthetic UX Lab" },
      { property: "og:description", content: "Synthetic UX Lab administration and configuration." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
