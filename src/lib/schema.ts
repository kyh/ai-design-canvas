import { z } from "zod";

// ============================================================
// Primitive Schemas & Shared Types
// ============================================================

export const editorSizeSchema = z.object({
  width: z.number(),
  height: z.number(),
});

export const textAlignSchema = z.enum(["center", "left", "right", "justify"]);
export type ITextAlign = z.infer<typeof textAlignSchema>;

export const textTransformSchema = z.enum([
  "inherit",
  "capitalize",
  "uppercase",
  "lowercase",
]);
export type ITextTransform = z.infer<typeof textTransformSchema>;

export const textDecorationSchema = z.enum([
  "inherit",
  "overline",
  "line-through",
  "underline",
]);
export type ITextDecoration = z.infer<typeof textDecorationSchema>;

export const fontSchema = z.object({
  family: z.string(),
  weight: z.string(),
});

const radiusSchema = z
  .object({
    tl: z.number().optional(),
    tr: z.number().optional(),
    br: z.number().optional(),
    bl: z.number().optional(),
  })
  .optional();

const shadowSchema = z
  .object({
    color: z.string().optional(),
    offsetX: z.number().optional(),
    offsetY: z.number().optional(),
    blur: z.number().optional(),
    enabled: z.boolean().optional(),
  })
  .optional();

const borderSchema = z
  .object({
    color: z.string().optional(),
    width: z.number().optional(),
    dash: z.array(z.number()).optional(),
  })
  .optional();

const flipSchema = z
  .object({
    horizontal: z.boolean().optional(),
    vertical: z.boolean().optional(),
  })
  .optional();

// ============================================================
// Block Schemas
// ============================================================

export const blockBaseSchema = z.object({
  id: z.string(),
  type: z.enum(["text", "frame", "image", "arrow", "html"]),
  label: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  rotation: z.number().default(0),
  scaleX: z.number().default(1),
  scaleY: z.number().default(1),
  visible: z.boolean(),
  opacity: z.number(),
  locked: z.boolean().optional(),
  background: z.string().optional(),
  border: borderSchema,
  radius: radiusSchema,
  shadow: shadowSchema,
  flip: flipSchema,
});

export const textBlockSchema = blockBaseSchema.extend({
  type: z.literal("text"),
  text: z.string(),
  color: z.string(),
  fontSize: z.number(),
  lineHeight: z.number(),
  letterSpacing: z.number(),
  textAlign: textAlignSchema,
  font: fontSchema,
  textTransform: textTransformSchema.optional(),
  textDecoration: textDecorationSchema.optional(),
});

export const frameBlockSchema = blockBaseSchema.extend({
  type: z.literal("frame"),
});

export const imageBlockSchema = blockBaseSchema.extend({
  type: z.literal("image"),
  url: z.string(),
  prompt: z.string().optional(), // Prompt for AI image generation
  fit: z
    .enum(["contain", "cover", "fill", "fitWidth", "fitHeight"])
    .default("contain")
    .optional(),
  position: z
    .enum(["center", "top", "bottom", "left", "right"])
    .default("center")
    .optional(),
});

export const arrowBlockSchema = blockBaseSchema.extend({
  type: z.literal("arrow"),
  points: z.array(z.number()).length(4), // [x1, y1, x2, y2] relative to block position
  pointerLength: z.number().default(20),
  pointerWidth: z.number().default(20),
  fill: z.string().optional(),
  stroke: z.string().optional(),
  strokeWidth: z.number().default(4),
});

export const htmlBlockSchema = blockBaseSchema.extend({
  type: z.literal("html"),
  html: z.string(),
});

export const drawBlockSchema = blockBaseSchema.extend({
  type: z.literal("draw"),
  points: z.array(z.number()).min(4),
  stroke: z.string().default("#000000"),
  strokeWidth: z.number().default(3),
  tension: z.number().default(0),
});

export const blockSchema = z.discriminatedUnion("type", [
  textBlockSchema,
  frameBlockSchema,
  imageBlockSchema,
  arrowBlockSchema,
  htmlBlockSchema,
  drawBlockSchema,
]);

export const textBlockSchemaWithoutId = textBlockSchema.omit({ id: true });
export const frameBlockSchemaWithoutId = frameBlockSchema.omit({ id: true });
export const imageBlockSchemaWithoutId = imageBlockSchema.omit({ id: true });
export const arrowBlockSchemaWithoutId = arrowBlockSchema.omit({ id: true });
export const htmlBlockSchemaWithoutId = htmlBlockSchema.omit({ id: true });

// ============================================================
// Template / Canvas Schemas
// ============================================================

export const canvasStateSchema = z.object({
  size: editorSizeSchema,
  zoom: z.number(),
  background: z.string().optional(),
  mode: z.enum([
    "move",
    "select",
    "text",
    "frame",
    "arrow",
    "image",
    "draw",
  ]),
  isTextEditing: z.boolean(),
  stagePosition: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .optional(),
});

export const templateSchema = z.object({
  size: editorSizeSchema,
  background: z.string().optional(),
  blocks: z.array(blockSchema),
});

// ============================================================
// Types
// ============================================================

export type IEditorSize = z.infer<typeof editorSizeSchema>;
export type IEditorBlock = z.infer<typeof blockSchema>;
export type IEditorBlocks = z.infer<typeof blockSchema>;
export type IEditorBlockText = z.infer<typeof textBlockSchema>;
export type IEditorBlockFrame = z.infer<typeof frameBlockSchema>;
export type IEditorBlockImage = z.infer<typeof imageBlockSchema>;
export type IEditorBlockArrow = z.infer<typeof arrowBlockSchema>;
export type IEditorBlockHtml = z.infer<typeof htmlBlockSchema>;
export type IEditorBlockDraw = z.infer<typeof drawBlockSchema>;
export type IEditorBlockType = IEditorBlocks["type"];
export type Template = z.infer<typeof templateSchema>;
export type ICanvasState = z.infer<typeof canvasStateSchema>;
