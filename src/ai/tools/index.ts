import type { InferUITools, UIMessage, UIMessageStreamWriter } from "ai";

import type { DataPart } from "../messages/data-parts";
import { generateFrameBlock } from "./generate-frame-block";
import { generateImageBlock } from "./generate-image-block";
import { generateTextBlock } from "./generate-text-block";

type Params = {
  writer: UIMessageStreamWriter<UIMessage<never, DataPart>>;
};

export function tools({ writer }: Params) {
  return {
    generateTextBlock: generateTextBlock({ writer }),
    generateFrameBlock: generateFrameBlock({ writer }),
    generateImageBlock: generateImageBlock({ writer }),
  };
}

export type ToolSet = InferUITools<ReturnType<typeof tools>>;
