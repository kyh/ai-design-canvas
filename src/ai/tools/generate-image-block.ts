import type { UIMessage, UIMessageStreamWriter } from "ai";
import { experimental_generateImage as generateImage, tool } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { imageBlockSchemaWithoutId } from "@/lib/schema";
import { createBlockWithId } from "./utils";

import type { DataPart } from "../messages/data-parts";
import description from "./generate-image-block.md";

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
