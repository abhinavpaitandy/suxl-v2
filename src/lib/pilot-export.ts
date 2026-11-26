import type { PilotRun } from "@/lib/ai/pilot-client";

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportPilotArchive(value: unknown) {
  save(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }), "saved-demo-pilot.json");
}

export async function exportPeople(runs: PilotRun[]) {
  const module = await import("exceljs");
  const ExcelJS = module.default ?? module;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Synthetic people");
  sheet.columns = [{ header: "Person", key: "person", width: 12 }, { header: "Generated profile", key: "profile", width: 100 }];
  const people = new Map<number, string>();
  for (const run of runs) if (!people.has(run.run)) people.set(run.run, run.profile);
  [...people.entries()].sort((a, b) => a[0] - b[0]).forEach(([index, profile]) => sheet.addRow({ person: index + 1, profile }));
  sheet.getRow(1).font = { bold: true };
  const bytes = await workbook.xlsx.writeBuffer();
  save(new Blob([bytes as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "synthetic-people.xlsx");
}

export async function exportHeatmap(elementId: string, filename: string) {
  const root = document.getElementById(elementId);
  const image = root?.querySelector("img");
  const overlay = root?.querySelector("canvas");
  if (!image || !overlay || !image.complete || !image.naturalWidth) throw new Error("The screenshot or heatmap is not ready to export.");
  const output = document.createElement("canvas");
  output.width = image.naturalWidth; output.height = image.naturalHeight;
  const context = output.getContext("2d");
  if (!context) throw new Error("Image export is not available in this browser.");
  context.drawImage(image, 0, 0, output.width, output.height);
  context.drawImage(overlay, 0, 0, output.width, output.height);
  const blob = await new Promise<Blob | null>((resolve) => output.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Could not create the image. Check the screenshot's access permissions.");
  save(blob, filename);
}
