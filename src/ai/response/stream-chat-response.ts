import {
  convertToModelMessages,
  createGateway,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateObject,
  stepCountIs,
  streamText,
  LanguageModel,
} from "ai";

import type {
  BuildModeChatUIMessage,
  GenerateModeChatUIMessage,
} from "../messages/types";
import type { DataPart } from "../messages/data-parts";
import type { SelectionBounds } from "@/lib/types";
import { generateTools } from "../tools";
import { createLoadingBlock } from "../tools/build-html-block";
import generatePrompt from "./stream-chat-response-prompt";
import buildPrompt from "./stream-chat-response-build-prompt";
import { z } from "zod";

type ExecuteParams = {
  writer: Parameters<
    Parameters<typeof createUIMessageStream>[0]["execute"]
  >[0]["writer"];
};

const executeGenerateMode = ({
  writer,
  messages,
  model,
  gatewayApiKey,
}: ExecuteParams & {
  messages: GenerateModeChatUIMessage[];
  model: LanguageModel;
  gatewayApiKey: string;
}) => {
  const result = streamText({
    model,
    system: generatePrompt,
    messages: convertToModelMessages(messages),
    stopWhen: stepCountIs(5),
    toolChoice: "required",
    tools: generateTools({ writer, gatewayApiKey }),
    onError: () => {
      // Error handling is done via toast notifications in the UI
    },
  });

  void result.consumeStream();
  writer.merge(
    result.toUIMessageStream({
      sendReasoning: true,
    })
  );
};

const executeBuildMode = ({
  writer,
  messages,
  selectionBounds,
  model,
  gatewayApiKey,
}: ExecuteParams & {
  messages: BuildModeChatUIMessage[];
  selectionBounds?: SelectionBounds;
  model: LanguageModel;
  gatewayApiKey: string;
}) => {
  // Create loading block immediately
  const loadingBlock = createLoadingBlock(selectionBounds);
  const blockId = loadingBlock.id;

  // Write loading block
  writer.write({
    id: "loading-block",
    type: "data-build-html-block",
    data: {
      "build-html-block": {
        block: loadingBlock,
      },
    } as DataPart,
  });

  // Generate HTML as text
  const result = streamText({
    model,
    system: buildPrompt,
    messages: convertToModelMessages(messages),
    onFinish: async ({ text }) => {
      // When HTML generation is complete, update the block
      if (text && text.trim()) {
        let html = text.trim();

        // Strip markdown code blocks if present (safeguard)
        // Remove ```html or ``` at the start
        html = html.replace(/^```html?\s*/i, "");
        // Remove ``` at the end
        html = html.replace(/\s*```$/g, "");
        html = html.trim();

        writer.write({
          id: "update-block",
          type: "data-update-html-block",
          data: {
            "update-html-block": {
              updateBlockId: blockId,
              html,
            },
          } as DataPart,
        });
      }
    },
    onError: () => {
      // Error handling is done via toast notifications in the UI
    },
  });

  // Stream the text to the UI (this must happen after onFinish is set up)
  void result.consumeStream();
  writer.merge(
    result.toUIMessageStream({
      sendReasoning: true,
    })
  );
};

export const streamChatResponse = async (
  messages: BuildModeChatUIMessage[] | GenerateModeChatUIMessage[],
  gatewayApiKey: string,
  selectionBounds?: SelectionBounds
) => {
  const model = createGateway({
    apiKey:
      gatewayApiKey === process.env.SECRET_KEY
        ? process.env.AI_GATEWAY_API_KEY
        : gatewayApiKey,
  })("openai/gpt-5.1-instant");

  const {
    object: { mode },
  } = await generateObject({
    system:
      "Determine what the user is asking for based on the messages. The user is either asking for you to generate a design, or to build a website from a design. By default, assume the user is asking for you to generate a design.",
    messages: convertToModelMessages(messages),
    model,
    schema: z.object({
      mode: z.enum(["generate", "build"]),
    }),
  });

  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      originalMessages: messages,
      execute: ({ writer }) => {
        switch (mode) {
          case "build":
            executeBuildMode({
              writer,
              messages: messages as BuildModeChatUIMessage[],
              selectionBounds,
              model,
              gatewayApiKey,
            });
            break;
          case "generate":
          default:
            executeGenerateMode({
              writer,
              messages: messages as GenerateModeChatUIMessage[],
              model,
              gatewayApiKey,
            });
            break;
        }
      },
    }),
  });
};
