import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TargetReviewCard } from "@/components/target-review-card";
import { DEMO_VARIANTS, demoAddToBagTarget } from "@/lib/demo-variants";
import type { DraftVariant } from "@/lib/types";

describe("demo target positions", () => {
  it("suggests the correct bundled buttons only for the add-to-bag task", () => {
    expect(demoAddToBagTarget(DEMO_VARIANTS[0].screenshotUrl, "Select the Add to bag or Add button.")?.boundingBox).toEqual({ x: 0.04, y: 0.91, width: 0.92, height: 0.07 });
    expect(demoAddToBagTarget(DEMO_VARIANTS[1].screenshotUrl, "Select the Add to bag or Add button.")?.boundingBox).toEqual({ x: 0.05, y: 0.94, width: 0.43, height: 0.05 });
    expect(demoAddToBagTarget(DEMO_VARIANTS[1].screenshotUrl, "Find the price")).toBeUndefined();
    expect(demoAddToBagTarget("data:image/png;base64,other", "Select the Add button")).toBeUndefined();
  });
  it("keeps the entered vertical position when the old box would overflow", () => {
    const onAdjust = vi.fn();
    const variant = { ...DEMO_VARIANTS[1], detectedTarget: { label: "ADD", status: "unreviewed", boundingBox: { x: 0.1, y: 0.42, width: 0.8, height: 0.14 } } } as DraftVariant;
    render(<TargetReviewCard variant={variant} onConfirm={() => {}} onAdjust={onAdjust} />);
    fireEvent.click(screen.getByRole("button", { name: "Adjust" }));
    fireEvent.change(screen.getByLabelText("Y"), { target: { value: "94" } });
    fireEvent.change(screen.getByLabelText("Height"), { target: { value: "5" } });
    expect(screen.getByLabelText("Y")).toHaveValue(94);
    fireEvent.click(screen.getByRole("button", { name: "Save Adjustment" }));
    expect(onAdjust.mock.calls[0]![0].y).toBeCloseTo(0.94);
  });
});
