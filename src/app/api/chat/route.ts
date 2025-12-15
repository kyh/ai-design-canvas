import { streamChatResponse } from "@/ai/response/stream-chat-response";

import type {
  GenerateModeChatUIMessage,
  BuildModeChatUIMessage,
} from "@/ai/messages/types";
import type { SelectionBounds } from "@/lib/types";

type BodyData = {
  messages: GenerateModeChatUIMessage[] | BuildModeChatUIMessage[];
  gatewayApiKey?: string;
  selectionBounds?: SelectionBounds;
};

export async function POST(request: Request) {
  const bodyData = (await request.json()) as BodyData;
  const { messages, gatewayApiKey, selectionBounds } = bodyData;

  if (!gatewayApiKey) {
    return new Response("Gateway API key is required", { status: 400 });
  }

  return streamChatResponse(messages, gatewayApiKey, selectionBounds);
}
