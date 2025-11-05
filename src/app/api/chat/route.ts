import { NextResponse } from "next/server";
import { DEFAULT_MODEL } from "@/ai/constants";
import { getAvailableModels } from "@/ai/gateway";
import { streamChatResponse } from "@/ai/response/stream-chat-response";

import type { ChatUIMessage } from "@/ai/messages/types";

type BodyData = {
  messages: ChatUIMessage[];
  modelId?: string;
  reasoningEffort?: "low" | "medium";
};

export async function POST(request: Request) {
  const [models, { messages, modelId = DEFAULT_MODEL, reasoningEffort }] =
    await Promise.all([
      getAvailableModels(),
      request.json() as Promise<BodyData>,
    ]);

  const model = models.find(
    (m: { id: string; name: string }) => m.id === modelId
  );

  if (!model) {
    return NextResponse.json(
      { error: `Model ${modelId} not found.` },
      { status: 400 }
    );
  }

  return streamChatResponse(messages, model, reasoningEffort ?? "medium");
}
