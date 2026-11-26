import { z } from "zod";

export const accessibilityFindingsSchema = z.array(z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  issue: z.string().trim().min(1).max(300),
  suggestion: z.string().trim().min(1).max(400),
})).max(8);
export type AccessibilityFinding = z.infer<typeof accessibilityFindingsSchema>[number];
