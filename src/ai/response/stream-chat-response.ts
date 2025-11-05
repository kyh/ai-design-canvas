import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
} from "ai";

import type { ChatUIMessage } from "../messages/types";
import { getModelOptions } from "../gateway";
import { tools } from "../tools";
import prompt from "./stream-chat-response-prompt.md";

export const streamChatResponse = (
  messages: ChatUIMessage[],
  model: {
    id: string;
    name: string;
  },
  reasoningEffort: "low" | "medium"
) => {
  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      originalMessages: messages,
      execute: ({ writer }) => {
        const result = streamText({
          ...getModelOptions(model.id, { reasoningEffort }),
          system: prompt,
          messages: convertToModelMessages(messages),
          stopWhen: stepCountIs(20),
          tools: tools({ writer }),
          onError: (error) => {
            console.error("Error communicating with AI");
            console.error(JSON.stringify(error, null, 2));
          },
        });

        void result.consumeStream();

        writer.merge(
          result.toUIMessageStream({
            sendReasoning: true,
            sendStart: false,
            messageMetadata: () => ({
              model: model.name,
            }),
          })
        );
      },
    }),
  });
};
