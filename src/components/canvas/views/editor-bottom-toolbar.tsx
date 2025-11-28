"use client";

import * as React from "react";
import { CursorArrowIcon, HandIcon } from "@radix-ui/react-icons";
import {
  ArrowLeftRight,
  ClipboardCopy,
  Download,
  ImageDown,
  Loader2,
  Pencil,
  PenTool,
  Redo,
  Sparkles,
  Undo,
} from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { blockSchema } from "@/lib/schema";
import type {
  BuildModeChatUIMessage,
  GenerateModeChatUIMessage,
} from "@/ai/messages/types";
import type { DataPart } from "@/ai/messages/data-parts";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import CustomTooltip from "@/components/ui/tooltip";
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@/components/ui/buttons-group";
import { useEditorStore } from "../use-editor";
import { BlockIcon } from "../utils";
import { useShallow } from "zustand/react/shallow";
import { useOrderedBlocks } from "../hooks/use-ordered-blocks";
import {
  captureSelectedBlocksAsImage,
  calculateSelectedBlocksBounds,
} from "../services/export";
import { EXPORT_PADDING } from "../utils/constants";
import type { SelectionBounds } from "@/lib/types";
import { ApiKeyDialog, OPENAI_API_KEY_STORAGE_KEY } from "../../api-key-dialog";
import { transport } from "../../demo-transport";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { Separator } from "@/components/ui/separator";
import {
  InputGroup,
  InputGroupTextarea,
  InputGroupAddon,
} from "@/components/ui/input-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function EditorBottomToolbar() {
  const [toolbarMode, setToolbarMode] = React.useState<"design" | "ai">(
    "design"
  );
  const imageInputRef = React.useRef<HTMLInputElement>(null);
  const [mode, setMode] = useEditorStore(
    useShallow((state) => [state.canvas.mode, state.setMode])
  );
  const setPendingImageData = useEditorStore(
    (state) => state.setPendingImageData
  );
  const [handleUndo, handleRedo, undoCount, redoCount] = useEditorStore(
    useShallow((state) => [
      state.handleUndo,
      state.handleRedo,
      state.history.undo.length,
      state.history.redo.length,
    ])
  );
  const downloadImage = useEditorStore((state) => state.downloadImage);
  const addBlock = useEditorStore((state) => state.addBlock);
  const updateBlockValues = useEditorStore((state) => state.updateBlockValues);
  const stage = useEditorStore((state) => state.stage);
  const blocks = useOrderedBlocks();
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const [canvasSize, canvasBackground] = useEditorStore(
    useShallow((state) => [state.canvas.size, state.canvas.background])
  );

  // AI Prompt state
  const [input, setInput] = React.useState("");
  const [aiMode, setAiMode] = React.useState<"generate" | "build">("generate");
  const [showApiKeyModal, setShowApiKeyModal] = React.useState(false);
  const [apiKey, , removeApiKey] = useLocalStorage<string>(
    OPENAI_API_KEY_STORAGE_KEY,
    ""
  );

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
  const handleCopyJson = React.useCallback(async () => {
    const serialized = JSON.stringify(
      {
        blocks,
        size: canvasSize,
        background: canvasBackground,
      },
      null,
      2
    );

    if (
      typeof navigator === "undefined" ||
      !navigator.clipboard ||
      typeof navigator.clipboard.writeText !== "function"
    ) {
      toast.error("Clipboard is not available in this environment.");
      return;
    }

    try {
      await navigator.clipboard.writeText(serialized);
      toast.success("Canvas JSON copied to clipboard.");
    } catch (error) {
      console.error("Failed to copy canvas JSON", error);
      toast.error("Failed to copy JSON to clipboard.");
    }
  }, [blocks, canvasBackground, canvasSize]);

  const handleSubmit = React.useCallback(
    async (e: React.FormEvent, overrideMode?: "generate" | "build") => {
      e.preventDefault();
      if (!input.trim() || isLoading) return;

      const modeToUse = overrideMode ?? aiMode;

      const buildRequestBody = (selectionBounds?: SelectionBounds | null) => ({
        ...(apiKey ? { openaiApiKey: apiKey } : {}),
        mode: modeToUse,
        ...(selectionBounds ? { selectionBounds } : {}),
      });

      try {
        let canvasImage: string | null = null;
        let selectionBounds: SelectionBounds | null = null;

        if (modeToUse === "build") {
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
        setInput("");
      } catch {
        sendMessage({ text: input }, { body: buildRequestBody() });
        setInput("");
      }
    },
    [
      input,
      isLoading,
      aiMode,
      apiKey,
      sendMessage,
      stage,
      blocks,
      selectedIds,
      setInput,
    ]
  );

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

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [input]);

  // Handle keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const isInInput =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      // Handle Shift+Tab to toggle between design and AI mode
      if (event.key === "Tab" && event.shiftKey) {
        if (isInInput) {
          return;
        }
        event.preventDefault();
        setToolbarMode((prev) => (prev === "design" ? "ai" : "design"));
        return;
      }

      // Handle Cmd+B / Ctrl+B to switch to build mode and submit
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        // Only handle if we're in AI mode and have input
        if (toolbarMode === "ai" && input.trim() && !isLoading) {
          event.preventDefault();
          setAiMode("build");
          const formEvent = new Event("submit", {
            bubbles: true,
            cancelable: true,
          }) as unknown as React.FormEvent;
          handleSubmit(formEvent, "build");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [setToolbarMode, toolbarMode, input, isLoading, setAiMode, handleSubmit]);

  return (
    <>
      <div className="fixed bottom-3 left-1/2 z-50 -translate-x-1/2">
        <div className="border border-border/50 supports-backdrop-filter:bg-background/80 bg-background/95 backdrop-blur shadow-xl rounded-[1.25rem]">
          <Tabs
            value={toolbarMode}
            onValueChange={(value) => setToolbarMode(value as "design" | "ai")}
          >
            <div className="flex gap-2 p-2 items-center">
              <TabsContent value="design" className="mt-0">
                <div className="flex gap-1">
                  <CustomTooltip content="Select" hotkey="V">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setMode("select")}
                      className={cn(mode === "select" && "bg-muted")}
                    >
                      <CursorArrowIcon />
                    </Button>
                  </CustomTooltip>
                  <CustomTooltip content="Move" hotkey="Space">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setMode("move")}
                      className={cn(mode === "move" && "bg-muted")}
                    >
                      <HandIcon />
                    </Button>
                  </CustomTooltip>
                  <CustomTooltip content="Add Text" hotkey="T">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setMode("text")}
                      className={cn(mode === "text" && "bg-muted")}
                    >
                      {BlockIcon("text")}
                    </Button>
                  </CustomTooltip>
                  <CustomTooltip content="Add Image">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (imageInputRef.current) {
                          imageInputRef.current.click();
                        }
                      }}
                      className={cn(mode === "image" && "bg-muted")}
                    >
                      {BlockIcon("image")}
                    </Button>
                  </CustomTooltip>
                  <CustomTooltip content="Add Frame" hotkey="F">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setMode("frame")}
                      className={cn(mode === "frame" && "bg-muted")}
                    >
                      {BlockIcon("frame")}
                    </Button>
                  </CustomTooltip>
                  <CustomTooltip content="Add Arrow" hotkey="A">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setMode("arrow")}
                      className={cn(mode === "arrow" && "bg-muted")}
                    >
                      {BlockIcon("arrow")}
                    </Button>
                  </CustomTooltip>
                  <CustomTooltip content="Draw" hotkey="D">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setMode("draw")}
                      className={cn(mode === "draw" && "bg-muted")}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </CustomTooltip>
                  <Separator orientation="vertical" className="h-7! my-auto" />
                  <CustomTooltip content="Undo" hotkey="⌘Z">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleUndo}
                      disabled={undoCount === 0}
                    >
                      <Undo />
                    </Button>
                  </CustomTooltip>
                  <CustomTooltip content="Redo" hotkey="⌘⇧Z">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleRedo}
                      disabled={redoCount === 0}
                    >
                      <Redo />
                    </Button>
                  </CustomTooltip>
                  <Separator orientation="vertical" className="h-7! my-auto" />
                  <DropdownMenu>
                    <CustomTooltip content="Export">
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost">
                          <Download className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                    </CustomTooltip>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem
                        onClick={() => {
                          void downloadImage();
                        }}
                      >
                        <ImageDown className="mr-2 h-4 w-4" />
                        Export as image
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          void handleCopyJson();
                        }}
                      >
                        <ClipboardCopy className="mr-2 h-4 w-4" />
                        Copy as JSON
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TabsContent>

              <TabsContent value="ai" className="mt-0">
                <InputGroup className="min-w-[300px]">
                  <InputGroupTextarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={handleTextareaFocus}
                    placeholder="Describe what you want to create..."
                    disabled={isLoading}
                    rows={1}
                    className={cn(
                      "min-h-[24px] max-h-[120px] text-base text-foreground overflow-y-auto p-2",
                      "placeholder:text-muted-foreground/50"
                    )}
                  />
                  <InputGroupAddon align="inline-end" className="gap-2">
                    <ButtonGroup>
                      <Button
                        type="submit"
                        onClick={handleSubmit}
                        disabled={!input.trim() || isLoading}
                        variant="outline"
                        size="sm"
                        className="capitalize"
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : null}
                        {aiMode === "generate" ? "Generate" : "Build"}
                      </Button>
                      <ButtonGroupSeparator />
                      <CustomTooltip content="Switch mode">
                        <Button
                          size="icon-sm"
                          variant="outline"
                          disabled={isLoading}
                          onClick={(e) => {
                            e.preventDefault();
                            setAiMode(
                              aiMode === "generate" ? "build" : "generate"
                            );
                          }}
                        >
                          <ArrowLeftRight className="h-4 w-4" />
                        </Button>
                      </CustomTooltip>
                    </ButtonGroup>
                  </InputGroupAddon>
                </InputGroup>
              </TabsContent>
              <TabsList>
                <CustomTooltip content="Design Mode">
                  <TabsTrigger
                    value="design"
                    className={cn(
                      toolbarMode === "design" &&
                        "bg-background shadow-sm dark:text-foreground dark:border-input dark:bg-input/30"
                    )}
                  >
                    <PenTool className="h-3 w-3" />
                  </TabsTrigger>
                </CustomTooltip>
                <CustomTooltip content="AI Mode">
                  <TabsTrigger
                    value="ai"
                    className={cn(
                      toolbarMode === "ai" &&
                        "bg-background shadow-sm dark:text-foreground dark:border-input dark:bg-input/30"
                    )}
                  >
                    <Sparkles className="h-3 w-3" />
                  </TabsTrigger>
                </CustomTooltip>
              </TabsList>
            </div>
          </Tabs>
        </div>
      </div>
      <input
        type="file"
        accept="image/*"
        className="hidden"
        ref={imageInputRef}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = () => {
              const img = new Image();
              img.src = reader.result as string;
              img.onload = () => {
                setPendingImageData({
                  url: img.src,
                  width: img.width,
                  height: img.height,
                });
                setMode("image");
              };
            };
            reader.readAsDataURL(file);
            // reset input value
            e.target.value = "";
          }
        }}
      />
      <ApiKeyDialog open={showApiKeyModal} onOpenChange={setShowApiKeyModal} />
    </>
  );
}

export default EditorBottomToolbar;
