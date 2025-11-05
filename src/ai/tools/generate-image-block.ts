import type { UIMessage, UIMessageStreamWriter } from "ai";
import { tool } from "ai";
import {
  templateSchema,
  imageBlockSchemaWithoutId,
} from "@/lib/schema";
import { v4 as uuid } from "uuid";

import type { DataPart } from "../messages/data-parts";
import description from "./generate-image-block.md";

type Params = {
  writer: UIMessageStreamWriter<UIMessage<never, DataPart>>;
};

// Helper function to add ID and validate
const createBlockWithId = (block: unknown) => {
  const validatedBlock = imageBlockSchemaWithoutId.parse(block);
  const blockWithId = {
    ...validatedBlock,
    id: uuid(),
  };
  return templateSchema.shape.blocks.element.parse(blockWithId);
};

export const generateImageBlock = ({ writer }: Params) =>
  tool({
    description,
    inputSchema: imageBlockSchemaWithoutId,
    execute: async (block, { toolCallId }) => {
      const blockWithId = createBlockWithId(block);

      writer.write({
        id: toolCallId,
        type: "data-generate-image-block",
        data: {
          "generate-image-block": {
            block: blockWithId,
            status: "done",
          },
        },
      });

      return `Successfully generated image block "${block.label}" with ID ${blockWithId.id}.`;
    },
  });
