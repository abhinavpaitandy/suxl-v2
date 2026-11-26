import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { DraftProvider, useDraft } from "@/lib/draft-store";
import { DEMO_VARIANTS } from "@/lib/demo-variants";

function DraftExample() {
  const { draft, updateVariant, resetDraft } = useDraft();
  return (
    <div>
      {draft.variants.map((variant) => (
        <div key={variant.id} data-testid={variant.id}>
          {variant.pageUrl}|{variant.screenshotUrl ?? "none"}
        </div>
      ))}
      <button onClick={() => updateVariant("v-a", { pageUrl: "https://example.com" })}>
        Change URL
      </button>
      <button
        onClick={() => updateVariant("v-a", { screenshotUrl: "data:image/png;base64,custom" })}
      >
        Upload
      </button>
      <button onClick={resetDraft}>Reset</button>
    </div>
  );
}

describe("new experiment samples", () => {
  it("maps each URL to its image and restores them for a new draft", () => {
    for (const variant of DEMO_VARIANTS)
      expect(existsSync(`public${variant.screenshotUrl.split("?")[0]}`)).toBe(true);
    render(
      <DraftProvider>
        <DraftExample />
      </DraftProvider>,
    );
    expect(screen.getByTestId("v-a")).toHaveTextContent(
      `${DEMO_VARIANTS[0].pageUrl}|${DEMO_VARIANTS[0].screenshotUrl}`,
    );
    expect(screen.getByTestId("v-b")).toHaveTextContent(
      `${DEMO_VARIANTS[1].pageUrl}|${DEMO_VARIANTS[1].screenshotUrl}`,
    );
    fireEvent.click(screen.getByText("Change URL"));
    expect(screen.getByTestId("v-a")).toHaveTextContent("https://example.com|none");
    fireEvent.click(screen.getByText("Upload"));
    expect(screen.getByTestId("v-a")).toHaveTextContent("data:image/png;base64,custom");
    fireEvent.click(screen.getByText("Reset"));
    expect(screen.getByTestId("v-a")).toHaveTextContent(
      `${DEMO_VARIANTS[0].pageUrl}|${DEMO_VARIANTS[0].screenshotUrl}`,
    );
  });
});
