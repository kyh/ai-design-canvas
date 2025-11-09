import { streamChatResponse } from "@/ai/response/stream-chat-response";

import type {
  GenerateModeChatUIMessage,
  BuildModeChatUIMessage,
} from "@/ai/messages/types";
import type { SelectionBounds } from "@/lib/types";

type BodyData = {
  messages: GenerateModeChatUIMessage[] | BuildModeChatUIMessage[];
  openaiApiKey?: string;
  mode?: "generate" | "build";
  selectionBounds?: SelectionBounds;
};

export async function POST(request: Request) {
  const bodyData = (await request.json()) as BodyData;
  const { messages, openaiApiKey, mode, selectionBounds } = bodyData;

  return streamChatResponse(messages, openaiApiKey, mode, selectionBounds);
}
