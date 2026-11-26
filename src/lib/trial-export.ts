import JSZip from "jszip";
import type { PilotRun } from "@/lib/ai/pilot-client";
import type { AccessibilityFinding } from "@/lib/ai/accessibility-schema";
import type { DraftVariant } from "@/lib/types";

type TrialArchive = {
  name: string; persona: string; task: string; peopleRequested: number; status: "completed" | "failed" | "cancelled";
  error: string | null; trace: { time: string; message: string }[]; profiles: string[]; runs: PilotRun[];
  variants: DraftVariant[]; accessibility: Record<string, AccessibilityFinding[] | null>;
};
const safeName = (value: string) => value.replace(/[^a-z0-9_-]/gi, "-");
async function png(canvas: HTMLCanvasElement): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Could not create an image for the trial archive.");
  return blob;
}

export async function exportTrialArchive(data: TrialArchive) {
  const zip = new JSZip();
  const metadata = { ...data, accessibility: Object.fromEntries(data.variants.map((variant) => [variant.id, data.accessibility[variant.id] ?? null])), variants: data.variants.map(({ screenshotUrl: _image, ...variant }) => variant), exportedAt: new Date().toISOString(), note: "Synthetic first-action and attention predictions; not measured user behaviour or a WCAG audit. Accessibility null means not analysed." };
  zip.file("raw-data.json", JSON.stringify(metadata, null, 2));
  zip.file("README.txt", "Trial archive\n\nraw-data.json contains profiles, decisions, predicted attention path coordinates, analysis status, trace and any completed accessibility suggestions.\nImages contain the source screenshots, predicted-click heatmaps, persona-specific predicted paths and accessibility markers where available.\nThese are model predictions, not observed users or an accessibility audit. No task completion is measured.\nAccessibility findings may be null if no analysis was run or it failed. UEyes and illustrative paths are not included in this archive.\nHeatmap colours are smoothed click concentrations, not a measured percentage scale.\n");
  for (const variant of data.variants) {
    const root = document.getElementById(`trial-heatmap-${variant.id}`);
    const image = root?.querySelector("img");
    const heatmap = root?.querySelector("canvas");
    if (!image || !image.complete || !image.naturalWidth || !heatmap) throw new Error(`${variant.name} image or heatmap is not ready. Please wait and try again.`);
    const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Image export is not available in this browser.");
    const filename = safeName(variant.id);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    zip.file(`images/${filename}-screenshot.png`, await png(canvas));
    ctx.drawImage(heatmap, 0, 0, canvas.width, canvas.height);
    zip.file(`images/${filename}-heatmap.png`, await png(canvas));
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    ctx.lineWidth = Math.max(2, canvas.width / 400); ctx.strokeStyle = "rgba(155,54,18,0.6)"; ctx.setLineDash([canvas.width / 120, canvas.width / 150]);
    for (const run of data.runs.filter((item) => item.variantId === variant.id)) {
      const points = run.outcome.attentionPath; if (!points?.length) continue;
      ctx.beginPath(); points.forEach((point, index) => index ? ctx.lineTo(point.x * canvas.width, point.y * canvas.height) : ctx.moveTo(point.x * canvas.width, point.y * canvas.height)); ctx.stroke();
    }
    zip.file(`images/${filename}-persona-paths.png`, await png(canvas));
    const flags = data.accessibility[variant.id];
    if (flags) {
      ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0, canvas.width, canvas.height); ctx.setLineDash([]);
      flags.forEach((item, index) => { const x = item.x * canvas.width, y = item.y * canvas.height, radius = Math.max(12, canvas.width / 40); ctx.beginPath(); ctx.fillStyle = "#ad5b00"; ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "white"; ctx.font = `bold ${Math.round(radius * 1.2)}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(index + 1), x, y); });
      zip.file(`images/${filename}-accessibility.png`, await png(canvas));
    }
  }
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "synthetic-ux-trial.zip"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
