import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { webcrypto } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { AccessibilityOverlay } from "@/components/accessibility-overlay";

vi.mock("@/lib/ai/visual-client", () => ({ imageTiles: async () => [{ start: 0, end: 1, image: "data:image/jpeg;base64,AA==" }] }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }));
afterEach(() => { vi.unstubAllGlobals(); sessionStorage.clear(); });

it("shows validated suggestions at their screenshot coordinates and opens its suggestion on pointer hover", async () => {
  vi.stubGlobal("crypto", webcrypto);
  const fetchMock = vi.fn(async (url: string) => {
    if (url === "/api/pilot-cache-context") return { ok: true, json: async () => ({ provider: "test", model: "test" }) };
    if (url === "/api/accessibility-analysis") return { ok: true, json: async () => ({ findings: [{ x: 0.3, y: 0.4, issue: "Small text may be hard to read", suggestion: "Check text size at the intended viewport" }] }) };
    return { ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
  });
  vi.stubGlobal("fetch", fetchMock);
  const { rerender } = render(<AccessibilityOverlay enabled screenshotUrl="/test-image" variantName="Variant A" />);
  const marker = await screen.findByRole("button", { name: /Variant A accessibility suggestion 1/i });
  expect(marker).toHaveStyle({ left: "30%", top: "40%" });
  fireEvent.pointerEnter(marker, { pointerType: "mouse" });
  await waitFor(() => expect(screen.getAllByText(/Check text size at the intended viewport/i).length).toBeGreaterThan(0));
  fireEvent.pointerLeave(marker, { pointerType: "mouse" });
  expect(screen.getByText(/Check text size at the intended viewport/i)).toBeVisible();
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  fireEvent.click(screen.getByRole("button", { name: "Copy accessibility suggestion" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith("Potential issue: Small text may be hard to read\nSuggestion: Check text size at the intended viewport"));
  expect(await screen.findByText("Copied")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Close accessibility suggestion" }));
  await waitFor(() => expect(screen.queryByText(/Check text size at the intended viewport/i)).not.toBeInTheDocument());
  expect(fetchMock.mock.calls.filter(([url]) => url === "/api/accessibility-analysis")).toHaveLength(1);
  rerender(<AccessibilityOverlay enabled screenshotUrl="/test-image" variantName="Variant A" refreshVersion={1} />);
  await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => url === "/api/accessibility-analysis")).toHaveLength(2));
});
