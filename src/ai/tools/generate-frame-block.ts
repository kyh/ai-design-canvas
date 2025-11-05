import type { UIMessage, UIMessageStreamWriter } from "ai";
import { tool } from "ai";
import {
  templateSchema,
  frameBlockSchemaWithoutId,
} from "@/lib/schema";
import { v4 as uuid } from "uuid";

import type { DataPart } from "../messages/data-parts";
import description from "./generate-frame-block.md";

type Params = {
  writer: UIMessageStreamWriter<UIMessage<never, DataPart>>;
};

// Helper function to add ID and validate
const createBlockWithId = (block: unknown) => {
  const validatedBlock = frameBlockSchemaWithoutId.parse(block);
  const blockWithId = {
    ...validatedBlock,
    id: uuid(),
  };
  return templateSchema.shape.blocks.element.parse(blockWithId);
};

export const generateFrameBlock = ({ writer }: Params) =>
  tool({
    description,
    inputSchema: frameBlockSchemaWithoutId,
    execute: async (block, { toolCallId }) => {
      const blockWithId = createBlockWithId(block);

      writer.write({
        id: toolCallId,
        type: "data-generate-frame-block",
        data: {
          "generate-frame-block": {
            block: blockWithId,
            status: "done",
          },
        },
      });

      return `Successfully generated frame block "${block.label}" with ID ${blockWithId.id}.`;
    },
  });
