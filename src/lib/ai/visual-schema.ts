import { z } from "zod";

const coordinate = z.number().finite().min(0).max(1);
const box = z
  .object({ x: coordinate, y: coordinate, width: coordinate.gt(0), height: coordinate.gt(0) })
  .refine(
    (v) => v.x + v.width <= 1.001 && v.y + v.height <= 1.001,
    "Target box must fit within its screenshot.",
  );
export const visualRequestSchema = z.object({
  task: z.string().trim().max(1000),
  successEvent: z.string().trim().max(1000),
  persona: z.string().trim().max(2000).optional(),
  perspectives: z.number().int().min(1).max(6).optional(),
  diversity: z.enum(["low", "medium", "high"]).optional(),
  variants: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        name: z.string().min(1).max(100),
        tiles: z
          .array(
            z
              .object({
                start: coordinate,
                end: coordinate,
                image: z
                  .string()
                  .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/)
                  .max(1_500_000),
              })
              .refine((tile) => tile.end > tile.start, "Slice end must follow its start."),
          )
          .min(1)
          .max(8),
      }),
    )
    .min(2)
    .max(3),
});
export const visualResultSchema = z.object({
  observations: z
    .array(z.object({ title: z.string().min(1).max(120), detail: z.string().min(1).max(700) }))
    .min(1)
    .max(8),
  clicks: z
    .array(
      z.object({
        id: z.string(),
        persona: z.string().min(1).max(120),
        x: coordinate,
        y: coordinate,
      }),
    )
    .max(18)
    .optional(),
  targets: z
    .array(
      z.object({
        id: z.string(),
        label: z.string().min(1).max(120),
        box: box.nullable(),
        note: z.string().max(300),
      }),
    )
    .max(3),
});
export type VisualResult = z.infer<typeof visualResultSchema>;

export const sliceVisualResultSchema = visualResultSchema.extend({
  clicks: z
    .array(
      z.object({
        id: z.string(),
        persona: z.string().min(1).max(120),
        tileIndex: z.number().int().min(0),
        x: coordinate,
        y: coordinate,
      }),
    )
    .max(18)
    .optional(),
  targets: visualResultSchema.shape.targets.element
    .extend({ tileIndex: z.number().int().min(0).nullable() })
    .array()
    .max(3),
});
