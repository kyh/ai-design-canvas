import type { UIMessage } from "ai";

import type { BuildToolSet, GenerateToolSet } from "../tools";
import type { DataPart } from "./data-parts";
import type { Metadata } from "./metadata";

export type BuildModeChatUIMessage = UIMessage<
  Metadata,
  DataPart,
  BuildToolSet
>;
export type GenerateModeChatUIMessage = UIMessage<
  Metadata,
  DataPart,
  GenerateToolSet
>;
