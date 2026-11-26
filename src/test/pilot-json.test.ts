import { describe, expect, it } from "vitest";
import { mapAttentionPath, parsePilotJson } from "@/lib/ai/pilot.server";

describe("pilot model response parsing", () => {
  it("accepts JSON wrapped in prose and code fences", () => {
    expect(parsePilotJson('Result: ```json\n{"action":"click","reason":"text with } inside"}\n```')).toEqual({ action: "click", reason: "text with } inside" });
  });
  it("rejects truncated or invalid JSON", () => {
    expect(() => parsePilotJson('{"action":"click"')).toThrow(/invalid JSON/);
  });
  it("maps attention positions from image slices to the full screenshot", () => {
    const tiles = [{ start: 0, end: 0.4 }, { start: 0.4, end: 1 }];
    expect(mapAttentionPath([{ tileIndex: 0, x: 0.2, y: 0.5 }, { tileIndex: 1, x: 0.8, y: 0.5 }], tiles)).toEqual([{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.7 }]);
    expect(() => mapAttentionPath([{ tileIndex: 2, x: 0.2, y: 0.5 }], tiles)).toThrow(/invalid attention/);
  });
});
