import { useEffect, useRef } from "react";
import type { BoundingBox } from "@/lib/types";

type Click = { persona: string; x: number; y: number };

export function SimulatedClickHeatmap({
  clicks,
  visible = true,
}: {
  clicks: Click[];
  target?: BoundingBox | undefined;
  visible?: boolean;
}) {
  const host = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = host.current;
    if (!canvas) return;
    const render = () => {
      const width = canvas.clientWidth, height = canvas.clientHeight;
      if (!width || !height) return;
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx || !clicks.length) return;
      const radius = Math.max(20, Math.round(width * 0.07));
      for (const click of clicks) {
        const x = click.x * width, y = click.y * height;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, `rgba(0,0,0,${Math.min(0.45, 2 / clicks.length)})`);
        gradient.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = gradient; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      }
      const image = ctx.getImageData(0, 0, width, height);
      for (let i = 0; i < image.data.length; i += 4) {
        const strength = image.data[i + 3]! / 255;
        if (!strength) continue;
        image.data[i] = Math.round(255 * Math.min(1, strength * 2));
        image.data[i + 1] = Math.round(220 * (1 - strength));
        image.data[i + 2] = Math.round(255 * (1 - Math.min(1, strength * 3)));
        image.data[i + 3] = Math.round(Math.min(0.75, strength) * 255);
      }
      ctx.putImageData(image, 0, 0);
    };
    const observer = new ResizeObserver(render);
    observer.observe(canvas); render();
    return () => observer.disconnect();
  }, [clicks]);
  return (
    <canvas
      ref={host}
      className={`pointer-events-none absolute inset-0 z-10 h-full w-full transition-opacity ${visible ? "opacity-100" : "opacity-0"}`}
      aria-hidden="true"
    />
  );
}

export function ClickDistributionSummary({
  clicks,
  target,
}: {
  clicks: Click[];
  target?: BoundingBox | undefined;
}) {
  if (!clicks.length)
    return (
      <p className="mt-3 text-xs text-muted-foreground">
        No simulated click data is available. Run a new analysis to generate it.
      </p>
    );
  const inside = target
    ? clicks.filter(
        (c) =>
          c.x >= target.x &&
          c.x <= target.x + target.width &&
          c.y >= target.y &&
          c.y <= target.y + target.height,
      ).length
    : null;
  return (
    <div className="mt-3 space-y-1 text-xs text-muted-foreground">
      <p>
        AI-simulated first clicks: {clicks.length} predictions. Warmer colours show greater
        concentration of predictions.
      </p>
      {inside !== null && (
        <p>
          Of the {clicks.length} predicted clicks: {Math.round((inside / clicks.length) * 100)}% inside target ·{" "}
          {Math.round(((clicks.length - inside) / clicks.length) * 100)}% outside target
        </p>
      )}
      <p>These are model predictions, not measured user clicks.</p>
    </div>
  );
}
