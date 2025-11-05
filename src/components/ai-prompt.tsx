"use client";

import * as React from "react";
import { useChat } from "@ai-sdk/react";
import { cn } from "@/lib/utils";
import { blockSchema } from "@/lib/schema";
import type { z } from "zod";
import type { ChatUIMessage } from "@/ai/messages/types";
import type { DataPart } from "@/ai/messages/data-parts";
import { Button } from "./ui/button";
import { Loader2, Send, X } from "lucide-react";
import { useEditorStore } from "./canvas/use-editor";

export default function AIPrompt() {
  const [input, setInput] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const addBlock = useEditorStore((state) => state.addBlock);

  const { sendMessage, status } = useChat<ChatUIMessage>({
    onError: (error) => {
      setError(error.message || "Failed to generate block");
    },
    onData: (dataPart) => {
      try {
        const data = dataPart.data as DataPart;
        let block: z.infer<typeof blockSchema> | undefined;

        if (data["generate-text-block"]) {
          block = data["generate-text-block"].block;
        } else if (data["generate-frame-block"]) {
          block = data["generate-frame-block"].block;
        } else if (data["generate-image-block"]) {
          block = data["generate-image-block"].block;
        }

        if (block) {
          const validatedBlock = blockSchema.parse(block);
          addBlock(validatedBlock);
          setError(null);
        }
      } catch (err) {
        console.error("Failed to add generated block:", err, dataPart);
        setError(
          err instanceof Error ? err.message : "Failed to add generated block"
        );
      }
    },
  });

  const isLoading = status === "submitted" || status === "streaming";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    setError(null);
    sendMessage({ text: input });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="fixed bottom-3 left-1/2 z-50 w-full max-w-2xl -translate-x-1/2">
      <div className="mx-4 rounded-3xl border border-border/50 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80 shadow-2xl">
        {error && (
          <div className="flex items-center justify-between border-b border-border bg-destructive/10 px-5 py-2.5 text-sm text-destructive rounded-t-3xl">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="hover:text-destructive/80"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="pt-5 p-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your 3D object or scene..."
            disabled={isLoading}
            rows={1}
            className={cn(
              "w-full bg-transparent !h-6 mb-8 pl-2 text-base text-foreground outline-none resize-none",
              "placeholder:text-muted-foreground/50",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
          />
          <div className="flex gap-2">
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
  );
}
