import type { UIMessage, UIMessageStreamWriter } from "ai";
import { experimental_generateImage as generateImage, tool } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { imageBlockSchemaWithoutId } from "@/lib/schema";
import { createBlockWithId } from "./utils";

import type { DataPart } from "../messages/data-parts";

const description = `Use this tool to generate an image block on the canvas. Image blocks always use AI-generated images via DALL-E 3 and can be styled with various properties for positioning and sizing.

## When to Use This Tool

Use Generate Image Block when:

1. The user requests an image to be displayed on the canvas
2. The user asks for images, illustrations, or graphics
3. You need to add visual elements like photos, illustrations, or graphics
4. The user provides a description of an image they want generated

## Image Block Properties

- **label**: Descriptive name for the block (e.g., "Logo", "Photo", "Illustration")
- **prompt**: Text description for AI image generation (e.g., "a modern logo with blue gradient", "a sunset over mountains"). If not provided, the **label** will be used as the prompt. Always provide detailed, descriptive prompts for best results.
- **url**: This field is automatically generated from the AI image and should not be set manually
- **x, y**: Position on the canvas
- **width, height**: Dimensions of the image block
- **fit**: How the image fits within the block ("contain", "cover", "fill", "fitWidth", "fitHeight")
- **position**: Image position within the block ("center", "top", "bottom", "left", "right")
- **opacity**: 0-100 (100 = fully opaque)
- **visible**: true (default)
- **rotation**: Optional rotation in degrees
- **shadow**: Optional shadow for depth
- **border**: Optional border around the image
- **radius**: Optional rounded corners

## Best Practices

- **AI Image Generation**: This tool ALWAYS generates images using DALL-E 3. Provide detailed, descriptive prompts for best results (e.g., "a minimalist logo with geometric shapes in blue and white" instead of just "logo").
- **Prompt Quality**: The more descriptive and specific your prompt, the better the generated image will match the intended design. Include details about style, colors, composition, mood, etc.
- **Image Dimensions**: Use appropriate image dimensions for the canvas size (1280x720 default). AI-generated images are 1024x1024, so consider the aspect ratio when setting width and height.
- **Fit Mode**: Choose appropriate fit mode based on desired effect:
  - "contain": Image fits within block, maintains aspect ratio
  - "cover": Image fills block, may be cropped, maintains aspect ratio
  - "fill": Image stretches to fill block, may distort
- **Styling**: Consider using shadows or borders to make images stand out
- **Positioning**: Position images thoughtfully relative to other canvas elements

## Examples

<example>
User: Generate a logo image at the top left
Assistant: I'll create an AI-generated logo image positioned at the top left of the canvas.
*Uses Generate Image Block with:*
- prompt: "a modern minimalist logo design with clean lines and contemporary style"
- x: 50, y: 50 (top left)
- width: 200, height: 200
- fit: "contain"
</example>

<example>
User: Add a background image of a sunset
Assistant: I'll generate a sunset background image that covers the whole canvas.
*Uses Generate Image Block with:*
- prompt: "a beautiful sunset over a landscape, wide format, cinematic, vibrant orange and pink colors, dramatic sky"
- x: 0, y: 0
- width: 1280, height: 720
- fit: "cover"
</example>

<example>
User: Add a product photo
Assistant: I'll generate a product photo image for you.
*Uses Generate Image Block with:*
- prompt: "professional product photography, clean white background, studio lighting, high quality"
- x: 100, y: 100
- width: 400, height: 400
- fit: "contain"
</example>

## Summary

Use Generate Image Block to add AI-generated images to the canvas. This tool ALWAYS generates images using DALL-E 3 based on the provided prompt (or label if no prompt is given). Never use placeholder images - all images are generated using AI.`;

type Params = {
  writer: UIMessageStreamWriter<UIMessage<never, DataPart>>;
  openaiApiKey?: string;
};

export const generateImageBlock = ({ writer, openaiApiKey }: Params) =>
  tool({
    description,
    inputSchema: imageBlockSchemaWithoutId,
    execute: async (block, { toolCallId }) => {
      const imagePrompt = block.prompt || block.label;

      if (!openaiApiKey) {
        throw new Error("OpenAI API key is required for image generation");
      }

      let imageUrl: string;

      try {
        const openai = createOpenAI({ apiKey: openaiApiKey });
        const { images } = await generateImage({
          model: openai.image("dall-e-3"),
          prompt: imagePrompt,
          n: 1,
          size: "1024x1024",
        });

        if (!images || images.length === 0) {
          throw new Error("No images were generated");
        }

        const generatedImage = images[0];
        // Convert base64 to data URL for display
        imageUrl = `data:${generatedImage.mediaType};base64,${generatedImage.base64}`;
      } catch (error) {
        console.error("Failed to generate image:", error);
        throw new Error(
          `Failed to generate image: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }

      const blockWithId = createBlockWithId(
        { ...block, url: imageUrl, prompt: imagePrompt },
        imageBlockSchemaWithoutId
      );

      writer.write({
        id: toolCallId,
        type: "data-generate-image-block",
        data: {
          // @ts-expect-error - This is a valid data part
          "generate-image-block": {
            block: blockWithId,
            status: "done",
          },
        },
      });

      return `Successfully generated image block "${block.label}" with ID ${blockWithId.id} using AI image generation.`;
    },
  });
