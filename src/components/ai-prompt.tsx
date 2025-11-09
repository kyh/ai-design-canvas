"use client";

import * as React from "react";
import { useChat } from "@ai-sdk/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { blockSchema } from "@/lib/schema";
import type {
  BuildModeChatUIMessage,
  GenerateModeChatUIMessage,
} from "@/ai/messages/types";
import type { DataPart } from "@/ai/messages/data-parts";
import { Button } from "./ui/button";
import { Loader2, Send } from "lucide-react";
import { useEditorStore } from "./canvas/use-editor";
import { useOrderedBlocks } from "./canvas/hooks/use-ordered-blocks";
import {
  captureSelectedBlocksAsImage,
  calculateSelectedBlocksBounds,
} from "./canvas/services/export";
import { EXPORT_PADDING } from "./canvas/utils/constants";
import type { SelectionBounds } from "@/lib/types";
import { ApiKeyDialog, OPENAI_API_KEY_STORAGE_KEY } from "./api-key-dialog";
import { transport } from "./demo-transport";
import { useLocalStorage } from "@/hooks/use-local-storage";

export default function AIPrompt() {
  const [input, setInput] = React.useState("");
  const [mode, setMode] = React.useState<"generate" | "build">("generate");
  const [showApiKeyModal, setShowApiKeyModal] = React.useState(false);
  const [apiKey, , removeApiKey] = useLocalStorage<string>(
    OPENAI_API_KEY_STORAGE_KEY,
    ""
  );
  const addBlock = useEditorStore((state) => state.addBlock);
  const updateBlockValues = useEditorStore((state) => state.updateBlockValues);
  const stage = useEditorStore((state) => state.stage);
  const blocks = useOrderedBlocks();
  const selectedIds = useEditorStore((state) => state.selectedIds);

  const { sendMessage, status } = useChat<
    BuildModeChatUIMessage | GenerateModeChatUIMessage
  >({
    id: apiKey,
    transport: apiKey === "demo" ? transport : undefined,
    onError: (error) => {
      const errorMessage = error.message?.toLowerCase() || "";
      const isAuthError =
        errorMessage.includes("unauthorized") ||
        errorMessage.includes("authentication") ||
        errorMessage.includes("invalid api key") ||
        errorMessage.includes("401") ||
        errorMessage.includes("403");

      if (isAuthError) {
        removeApiKey();
        toast.error("Invalid API key. Please enter a valid OpenAI API key.");
        setShowApiKeyModal(true);
      } else {
        toast.error(error.message || "Failed to generate block");
      }
    },
    onData: (dataPart) => {
      try {
        const data = dataPart.data as DataPart;

        // Find which data part type exists
        const dataPartType = (Object.keys(data) as Array<keyof DataPart>).find(
          (key) => data[key] !== undefined
        );

        if (!dataPartType) return;

        switch (dataPartType) {
          case "generate-text-block":
          case "generate-frame-block":
          case "generate-image-block":
          case "build-html-block": {
            const block = blockSchema.parse(data[dataPartType]!.block);
            addBlock(block);
            break;
          }

          case "update-html-block": {
            const { updateBlockId, ...updates } = data[dataPartType]!;
            updateBlockValues(updateBlockId, updates);
            break;
          }
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to process data part"
        );
      }
    },
  });

  const isLoading = status === "submitted" || status === "streaming";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const buildRequestBody = (selectionBounds?: SelectionBounds | null) => ({
      ...(apiKey ? { openaiApiKey: apiKey } : {}),
      mode,
      ...(selectionBounds ? { selectionBounds } : {}),
    });

    try {
      let canvasImage: string | null = null;
      let selectionBounds: SelectionBounds | null = null;

      if (mode === "build") {
        canvasImage = await captureSelectedBlocksAsImage(
          stage,
          blocks,
          selectedIds
        );

        if (selectedIds.length > 0) {
          const boundsWithPadding = calculateSelectedBlocksBounds(
            blocks,
            selectedIds
          );
          if (boundsWithPadding) {
            selectionBounds = {
              x: boundsWithPadding.x + EXPORT_PADDING,
              y: boundsWithPadding.y + EXPORT_PADDING,
              width: boundsWithPadding.width - EXPORT_PADDING * 2,
              height: boundsWithPadding.height - EXPORT_PADDING * 2,
            };
          }
        }
      } else {
        canvasImage = await captureSelectedBlocksAsImage(stage, blocks, []);
      }

      const filePart = canvasImage
        ? {
            type: "file" as const,
            mediaType: "image/png" as const,
            url: canvasImage,
          }
        : undefined;

      sendMessage(
        filePart ? { text: input, files: [filePart] } : { text: input },
        { body: buildRequestBody(selectionBounds) }
      );
    } catch {
      sendMessage({ text: input }, { body: buildRequestBody() });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleTextareaFocus = () => {
    if (!apiKey) {
      setShowApiKeyModal(true);
    }
  };

  return (
    <>
      <div className="fixed bottom-3 left-1/2 z-50 w-full max-w-2xl -translate-x-1/2">
        <div className="mx-4 rounded-3xl border border-border/50 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80 shadow-2xl">
          <div className="pt-5 p-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={handleTextareaFocus}
              placeholder="Describe what you want to create..."
              disabled={isLoading}
              rows={1}
              className={cn(
                "w-full bg-transparent h-6! mb-8 pl-2 text-base text-foreground outline-none resize-none",
                "placeholder:text-muted-foreground/50",
                "disabled:cursor-not-allowed disabled:opacity-50"
              )}
            />
            <div className="flex gap-2 items-center">
              <select
                value={mode}
                onChange={(e) =>
                  setMode(e.target.value as "generate" | "build")
                }
                disabled={isLoading}
                className={cn(
                  "px-3 py-2 text-sm rounded-xl border border-border bg-background",
                  "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
                  "disabled:cursor-not-allowed disabled:opacity-50"
                )}
              >
                <option value="generate">Generate</option>
                <option value="build">Build</option>
              </select>
              <Button
                type="submit"
                onClick={handleSubmit}
                disabled={!input.trim() || isLoading}
                size="icon"
                variant={input.trim() ? "default" : "outline"}
                className="w-10 h-10 p-0 rounded-xl ml-auto"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5 -rotate-90" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
      <ApiKeyDialog open={showApiKeyModal} onOpenChange={setShowApiKeyModal} />
    </>
  );
}
