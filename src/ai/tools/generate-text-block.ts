import type { UIMessage, UIMessageStreamWriter } from "ai";
import { tool } from "ai";
import {
  templateSchema,
  textBlockSchemaWithoutId,
} from "@/lib/schema";
import { generateId } from "@/lib/id-generator";

import type { DataPart } from "../messages/data-parts";
import description from "./generate-text-block.md";

type Params = {
  writer: UIMessageStreamWriter<UIMessage<never, DataPart>>;
};

// Helper function to add ID and validate
const createBlockWithId = (block: unknown) => {
  const validatedBlock = textBlockSchemaWithoutId.parse(block);
  const blockWithId = {
    ...validatedBlock,
    id: generateId(),
  };
  return templateSchema.shape.blocks.element.parse(blockWithId);
};

export const generateTextBlock = ({ writer }: Params) =>
  tool({
    description,
    inputSchema: textBlockSchemaWithoutId,
    execute: async (block, { toolCallId }) => {
      const blockWithId = createBlockWithId(block);

      writer.write({
        id: toolCallId,
        type: "data-generate-text-block",
        data: {
          "generate-text-block": {
            block: blockWithId,
            status: "done",
          },
        },
      });

      return `Successfully generated text block "${block.label}" with ID ${blockWithId.id}.`;
    },
  });
