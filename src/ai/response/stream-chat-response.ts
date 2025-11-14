import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
} from "ai";
import { createOpenAI } from "@ai-sdk/openai";

import type {
  BuildModeChatUIMessage,
  GenerateModeChatUIMessage,
} from "../messages/types";
import type { DataPart } from "../messages/data-parts";
import type { SelectionBounds } from "@/lib/types";
import { generateTools } from "../tools";
import { createLoadingBlock } from "../tools/build-html-block";
import generatePrompt from "./stream-chat-response-prompt.md";
import buildPrompt from "./stream-chat-response-build-prompt.md";

type ExecuteParams = {
  writer: Parameters<
    Parameters<typeof createUIMessageStream>[0]["execute"]
  >[0]["writer"];
};

const executeGenerateMode = ({
  writer,
  messages,
  openaiApiKey,
}: ExecuteParams & {
  messages: GenerateModeChatUIMessage[];
  openaiApiKey?: string;
}) => {
  if (!openaiApiKey) {
    throw new Error("OpenAI API key is required");
  }

  const model =
    openaiApiKey === process.env.SECRET_KEY
      ? "anthropic/claude-haiku-4.5"
      : createOpenAI({
          apiKey: openaiApiKey,
        })("gpt-5-mini");

  const result = streamText({
    model,
    system: generatePrompt,
    messages: convertToModelMessages(messages),
    stopWhen: stepCountIs(5),
    toolChoice: "required",
    tools: generateTools({ writer, openaiApiKey }),
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
  openaiApiKey,
}: ExecuteParams & {
  messages: BuildModeChatUIMessage[];
  selectionBounds?: SelectionBounds;
  openaiApiKey?: string;
}) => {
  if (!openaiApiKey) {
    throw new Error("OpenAI API key is required");
  }

  const model =
    openaiApiKey === process.env.SECRET_KEY
      ? "anthropic/claude-haiku-4.5"
      : createOpenAI({
          apiKey: openaiApiKey,
        })("gpt-5-mini");

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

export const streamChatResponse = (
  messages: BuildModeChatUIMessage[] | GenerateModeChatUIMessage[],
  openaiApiKey?: string,
  mode: "generate" | "build" = "generate",
  selectionBounds?: SelectionBounds
) => {
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
              openaiApiKey,
            });
            break;
          case "generate":
          default:
            executeGenerateMode({
              writer,
              messages: messages as GenerateModeChatUIMessage[],
              openaiApiKey,
            });
            break;
        }
      },
    }),
  });
};
