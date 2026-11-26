import { fireEvent, render, screen } from "@testing-library/react";
import { webcrypto } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClickHeatmapPreview, illustrativePath } from "@/components/click-heatmap-preview";
import { ComparisonControls, ComparisonProvider, useComparison } from "@/components/comparison-controls";

vi.mock("@/components/simulated-click-heatmap", () => ({ SimulatedClickHeatmap: ({ visible }: { visible: boolean }) => <canvas data-testid="heatmap" data-visible={String(visible)} />, ClickDistributionSummary: () => null }));
afterEach(() => vi.unstubAllGlobals());

describe("illustrative gaze preview", () => {
  it("shows the selected person's predicted points, including for a no-click decision", () => {
    const first = [{ x: 0.2, y: 0.3 }, { x: 0.5, y: 0.8 }];
    const second = [{ x: 0.8, y: 0.2 }, { x: 0.1, y: 0.7 }];
    render(<ClickHeatmapPreview id="predicted" variantName="Variant A" screenshotUrl="/demo/image.png" clicks={[]} runs={[
      { variantId: "v-a", run: 0, profile: "One", outcome: { action: "click", x: 0.5, y: 0.9, reason: "Add", attentionPath: first } },
      { variantId: "v-a", run: 1, profile: "Two", outcome: { action: "no_action", reason: "Unsure", attentionPath: second } },
    ]} />);
    fireEvent.click(screen.getByLabelText("Show persona-specific predicted attention path"));
    expect(screen.getByLabelText("Person for comparison")).toHaveValue("all");
    expect(screen.getAllByRole("img", { name: /predicted attention path for person/i })).toHaveLength(2);
    const firstPath = screen.getByRole("img", { name: /predicted attention path for person 1/i });
    expect(firstPath.querySelector("polyline")?.getAttribute("points")).toBe("200,300 500,800");
    fireEvent.change(screen.getByLabelText("Person for comparison"), { target: { value: "1" } });
    expect(screen.getByRole("img", { name: /predicted attention path for person 2/i }).querySelector("polyline")?.getAttribute("points")).toBe("800,200 100,700");
    expect(screen.queryByRole("img", { name: /predicted attention path for person 1/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("heatmap")).toBeInTheDocument();
    expect(screen.getByLabelText("Show illustrative gaze path")).toBeInTheDocument();
  });
  it("applies shared layer and person choices to both variants", () => {
    const runs = ["v-a", "v-b"].flatMap((variantId) => [0, 1].map((run) => ({ variantId, run, profile: `Person ${run + 1}`, outcome: { action: "click" as const, x: 0.5, y: 0.9, reason: "Add", attentionPath: [{ x: 0.2 + run * 0.1, y: 0.3 }] } })));
    render(<ComparisonProvider><ComparisonControls runs={runs} />{["v-a", "v-b"].map((id) => <ClickHeatmapPreview key={id} id={id} variantName={id} screenshotUrl="/demo/image.png" clicks={[]} runs={runs.filter((run) => run.variantId === id)} />)}</ComparisonProvider>);
    fireEvent.click(screen.getByLabelText("Show persona-specific predicted attention path"));
    expect(screen.getAllByRole("img", { name: /predicted attention path for person 1/i })).toHaveLength(2);
    fireEvent.change(screen.getByLabelText("Person for comparison"), { target: { value: "1" } });
    expect(screen.getAllByRole("img", { name: /predicted attention path for person 2/i })).toHaveLength(2);
    fireEvent.click(screen.getByLabelText("Show click heatmap"));
    expect(screen.getAllByTestId("heatmap").every((item) => item.getAttribute("data-visible") === "false")).toBe(true);
  });
  it("keeps the explanations in the shared disclosure without changing layers", () => {
    render(<ComparisonProvider><ComparisonControls runs={[]} /></ComparisonProvider>);
    expect(screen.queryByText("Learn more")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("About these overlays"));
    expect(screen.getByText(/hypothetical predictions, not measured gaze/i)).toBeVisible();
    expect(screen.getByText(/intermediate stops are invented/i)).toBeVisible();
    expect(screen.getByRole("link", { name: /Read the UEyes research/i })).toHaveAttribute("href", "https://userinterfaces.aalto.fi/ueyeschi23/");
    expect(screen.getByLabelText("Show persona-specific predicted attention path")).not.toBeChecked();
  });
  it("refreshes accessibility analysis without changing the overlay toggle", () => {
    function Version() { return <span>Refresh count: {useComparison()!.accessibilityVersion}</span>; }
    render(<ComparisonProvider><ComparisonControls runs={[]} /><Version /></ComparisonProvider>);
    const refresh = screen.getByRole("button", { name: "Run fresh accessibility analysis" });
    expect(refresh).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Show accessibility suggestions"));
    expect(refresh).toBeEnabled();
    fireEvent.click(refresh);
    expect(screen.getByText("Refresh count: 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Show accessibility suggestions")).toBeChecked();
  });
  it("ends at the selected predicted click", () => {
    expect(illustrativePath(0.27, 0.96).at(-1)).toEqual({ x: 0.27, y: 0.96 });
  });
  it("keeps the heatmap and clearly labels the optional path; no-click runs have no path", () => {
    render(<ClickHeatmapPreview id="example" variantName="Variant A" screenshotUrl="/demo/image.png" clicks={[{ persona: "One", x: 0.27, y: 0.96 }]} runs={[
      { variantId: "v-a", run: 0, profile: "One", outcome: { action: "click", x: 0.27, y: 0.96, reason: "Add" } },
      { variantId: "v-a", run: 1, profile: "Two", outcome: { action: "no_action", reason: "Unsure" } },
    ]} />);
    expect(screen.getByTestId("heatmap")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /illustrative path/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Show illustrative gaze path"));
    expect(screen.getByRole("img", { name: /person 1/i })).toBeInTheDocument();
    expect(screen.getByText(/intermediate stops are invented/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Person for comparison"), { target: { value: "1" } });
    expect(screen.queryByRole("img", { name: /illustrative path/i })).not.toBeInTheDocument();
    expect(screen.getByText(/did not produce a click/i)).toBeInTheDocument();
  });
  it("generates an uploaded image path and preserves the heatmap and illustrative control", async () => {
    vi.stubGlobal("crypto", webcrypto);
    const bytes = new Uint8Array([11, 12, 13]);
    const points = [{ x: 0.5, y: 0.5 }, { x: 0.2, y: 0.3 }, { x: 0.4, y: 0.6 }, { x: 0.8, y: 0.7 }];
    const fetchMock = vi.fn(async (url: string) => url === "/api/local-ueyes"
      ? { ok: true, json: async () => ({ points }) }
      : { ok: true, blob: async () => ({ arrayBuffer: async () => bytes }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<ClickHeatmapPreview id="demo" variantName="Variant A" screenshotUrl="data:image/png;base64,CwwN" clicks={[]} runs={[{ variantId: "v-a", run: 0, profile: "One", outcome: { action: "click", x: 0.5, y: 0.9, reason: "Add" } }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Generate UEyes attention path" }));
    expect(await screen.findByRole("img", { name: /UEyes DeepGaze\+\+ predicted attention path/i })).toBeInTheDocument();
    expect(screen.getByText(/generated locally for this image/i)).toBeInTheDocument();
    expect(screen.getByTestId("heatmap")).toBeInTheDocument();
    expect(screen.getByLabelText("Show illustrative gaze path")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/local-ueyes", expect.objectContaining({ method: "POST" }));
  });
});
