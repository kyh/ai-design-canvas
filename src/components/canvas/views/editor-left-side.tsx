import * as React from "react";
import { MoreHorizontal, EyeOff, Eye, SettingsIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ModeToggle } from "@/components/mode-toggle";
import { ApiKeyDialog } from "@/components/api-key-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BackIcon,
  BackwardIcon,
  DeleteIcon,
  DuplicateIcon,
  FarwardIcon,
  FrontIcon,
} from "@/components/ui/icons";
import type { IEditorBlocks } from "@/lib/schema";
import { BlockIcon } from "../utils";
import { useEditorStore } from "../use-editor";
import { useShallow } from "zustand/react/shallow";
import { useOrderedBlocks } from "../hooks/use-ordered-blocks";
import { Button } from "@/components/ui/button";

interface BlockItemProps extends React.HTMLAttributes<HTMLDivElement> {
  block: IEditorBlocks;
  selected?: boolean;
  onSelectBlock?: (block: IEditorBlocks) => void;
  onHoverChange?: (hovered: boolean) => void;
  onRename?: (id: string, label: string) => void;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
  onToggleVisibility?: (id: string) => void;
  onBringForward?: (id: string) => void;
  onBringBackward?: (id: string) => void;
  onBringToFront?: (id: string) => void;
  onBringToBack?: (id: string) => void;
}

const BlockItem = React.forwardRef<HTMLDivElement, BlockItemProps>(
  (
    {
      block,
      selected = false,
      onSelectBlock,
      onHoverChange,
      onRename,
      onDuplicate,
      onDelete,
      onToggleVisibility,
      onBringForward,
      onBringBackward,
      onBringToFront,
      onBringToBack,
      className,
      onMouseEnter,
      onMouseLeave,
      ...props
    },
    ref
  ) => {
    const [label, setLabel] = React.useState(block.label);
    const [editable, setEditable] = React.useState(false);

    React.useEffect(() => {
      if (!editable) {
        setLabel(block.label);
      }
    }, [block.label, editable]);

    const handleSelect = React.useCallback(() => {
      if (!block.visible) {
        return;
      }
      onSelectBlock?.(block);
    }, [block, onSelectBlock]);

    return (
      <div
        ref={ref}
        className={cn(
          "sidebar-item group/item relative mx-2 my-0.5",
          {
            "opacity-40": !block.visible,
          },
          className
        )}
        data-block-id={block.id}
        onMouseEnter={(event) => {
          if (block.visible) {
            onHoverChange?.(true);
          }
          onMouseEnter?.(event);
        }}
        onMouseLeave={(event) => {
          onHoverChange?.(false);
          onMouseLeave?.(event);
        }}
        {...props}
      >
        <button
          type="button"
          className={cn(
            "group/button flex items-center gap-3 w-full p-[3px] border rounded-xl transition-colors group-hover/item:bg-muted",
            {
              "bg-muted border-border/60": selected,
              "border-transparent": !selected,
            }
          )}
          onClick={handleSelect}
          aria-label={`Select ${block.label}`}
        >
          <div
            className={cn(
              "flex justify-center items-center shrink-0 size-8 rounded-lg transition-all group-hover/item:bg-background",
              {
                "bg-background shadow-sm": selected,
                "bg-muted": !selected,
              }
            )}
          >
            <div className="text-base opacity-70">{BlockIcon(block.type)}</div>
          </div>
          <input
            type="text"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            className={cn(
              "sidebar-item-label-input flex-1 h-6 overflow-hidden text-ellipsis border px-1 text-sm text-foreground outline-hidden rounded-md truncate",
              editable && "border-border bg-muted",
              !editable && "border-transparent"
            )}
            style={{
              backgroundColor: editable ? undefined : "transparent",
              cursor: editable ? "text" : undefined,
            }}
            readOnly={!editable}
            onDoubleClick={(event) => {
              event.stopPropagation();
              setEditable(true);
            }}
            onFocus={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onBlur={() => {
              setEditable(false);
              if (block.label !== label) {
                onRename?.(block.id, label);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                setEditable(false);
                if (block.label !== label) {
                  onRename?.(block.id, label);
                }
              }
            }}
          />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="sidebar-item-actions absolute top-1/2 right-3 -translate-y-1/2 z-3 invisible"
            asChild
          >
            <button
              type="button"
              className="rounded-lg p-1.5 text-foreground/50 transition-all hover:bg-muted hover:text-foreground"
              onClick={(event) => {
                event.stopPropagation();
                handleSelect();
              }}
            >
              <MoreHorizontal />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-52">
            <DropdownMenuItem onClick={() => onDuplicate?.(block.id)}>
              <DuplicateIcon className="mr-2 h-5 w-5" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete?.(block.id)}>
              <DeleteIcon className="mr-2 h-5 w-5" />
              Delete
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onToggleVisibility?.(block.id)}>
              {block.visible ? (
                <EyeOff className="mr-2 h-5 w-5" />
              ) : (
                <Eye className="mr-2 h-5 w-5" />
              )}
              {block.visible ? "Hide" : "Show"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onBringForward?.(block.id)}>
              <FarwardIcon className="mr-2 h-5 w-5" />
              Bring forward
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onBringToFront?.(block.id)}>
              <FrontIcon className="mr-2 h-5 w-5" />
              Bring to front
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onBringBackward?.(block.id)}>
              <BackwardIcon className="mr-2 h-5 w-5" />
              Bring backward
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onBringToBack?.(block.id)}>
              <BackIcon className="mr-2 h-5 w-5" />
              Bring to back
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }
);

BlockItem.displayName = "BlockItem";

function EditorLeftSide() {
  const [showApiKeyDialog, setShowApiKeyDialog] = React.useState(false);
  const blocks = useOrderedBlocks();
  const [selectedIds, setSelectedIds] = useEditorStore(
    useShallow((state) => [state.selectedIds, state.setSelectedIds])
  );
  const [
    setHoveredId,
    updateBlockValues,
    duplicateBlock,
    deleteBlock,
    showHideBlock,
    bringForwardBlock,
    bringBackwardBlock,
    bringToTopBlock,
    bringToBackBlock,
  ] = useEditorStore(
    useShallow((state) => [
      state.setHoveredId,
      state.updateBlockValues,
      state.duplicateBlock,
      state.deleteBlock,
      state.showHideBlock,
      state.bringForwardBlock,
      state.bringBackwardBlock,
      state.bringToTopBlock,
      state.bringToBackBlock,
    ])
  );

  const handleSelect = React.useCallback(
    (block: IEditorBlocks) => {
      if (!block.visible) {
        return;
      }
      setSelectedIds([block.id]);
    },
    [setSelectedIds]
  );

  return (
    <div className="editor-left-side fixed left-3 top-3 bottom-3 z-20 hidden md:flex w-64 flex-col border border-border/50 bg-background/95 backdrop-blur shadow-xl rounded-[1.25rem] overflow-hidden">
      <p className="p-4 pb-3 text-sm font-semibold">Layers</p>
      <ScrollArea className="flex-1">
        {blocks.map((block) => (
          <BlockItem
            key={block.id}
            block={block}
            selected={selectedIds.length === 1 && selectedIds[0] === block.id}
            onSelectBlock={handleSelect}
            onHoverChange={(hovered) => setHoveredId(hovered ? block.id : null)}
            onRename={(id, label) => updateBlockValues(id, { label })}
            onDuplicate={duplicateBlock}
            onDelete={deleteBlock}
            onToggleVisibility={showHideBlock}
            onBringForward={bringForwardBlock}
            onBringBackward={bringBackwardBlock}
            onBringToFront={bringToTopBlock}
            onBringToBack={bringToBackBlock}
          />
        ))}
      </ScrollArea>
      <div className="border-t border-border p-2 flex items-center justify-between gap-2">
        <div />
        <div className="flex items-center gap-2">
          <ModeToggle />
          <Button
            variant="outline"
            size="icon"
            className="size-10"
            onClick={() => setShowApiKeyDialog(true)}
          >
            <SettingsIcon className="size-5" />
          </Button>
        </div>
      </div>
      <ApiKeyDialog
        open={showApiKeyDialog}
        onOpenChange={setShowApiKeyDialog}
      />
    </div>
  );
}

export default EditorLeftSide;
