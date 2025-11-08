import * as React from "react";
import { CursorArrowIcon, HandIcon } from "@radix-ui/react-icons";
import { Download, Undo, Redo } from "lucide-react";
import ButtonsGroup from "@/components/ui/buttons-group";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "../use-editor";
import { BlockIcon } from "../utils";
import { cn } from "@/lib/utils";
import { useShallow } from "zustand/react/shallow";

function EditorHeader({ className }: { className?: string }) {
  const imageInputRef = React.useRef<HTMLInputElement>(null);
  const [mode, setMode] = useEditorStore(
    useShallow((state) => [state.canvas.mode, state.setMode])
  );
  const setPendingImageData = useEditorStore((state) => state.setPendingImageData);
  const [handleUndo, handleRedo, undoCount, redoCount] = useEditorStore(
    useShallow((state) => [
      state.handleUndo,
      state.handleRedo,
      state.history.undo.length,
      state.history.redo.length,
    ])
  );
  const downloadImage = useEditorStore((state) => state.downloadImage);

  return (
    <>
      <div
        className={cn(
          "fixed top-3 left-1/2 z-20 -translate-x-1/2 flex items-center gap-2 border border-border/50 bg-background/95 backdrop-blur shadow-lg rounded-[1.25rem] p-2",
          className
        )}
      >
        <ButtonsGroup
          buttons={[
            {
              children: <CursorArrowIcon />,
              onClick: () => setMode("select"),
              isActive: mode === "select",
              label: "Select",
              hotkey: "V",
            },
            {
              children: <HandIcon />,
              onClick: () => setMode("move"),
              isActive: mode === "move",
              label: "Move",
              hotkey: "Space",
            },
          ]}
        />
        <ButtonsGroup
          buttons={[
            {
              children: BlockIcon("text"),
              onClick: () => setMode("text"),
              isActive: mode === "text",
              label: "Add Text",
              hotkey: "T",
            },
            {
              children: BlockIcon("image"),
              onClick: () => {
                if (imageInputRef.current) {
                  imageInputRef.current.click();
                }
              },
              isActive: mode === "image",
              label: "Add Image",
            },
            {
              children: BlockIcon("frame"),
              onClick: () => setMode("frame"),
              isActive: mode === "frame",
              label: "Add Frame",
              hotkey: "F",
            },
            {
              children: BlockIcon("arrow"),
              onClick: () => setMode("arrow"),
              isActive: mode === "arrow",
              label: "Add Arrow",
              hotkey: "A",
            },
            {
              children: BlockIcon("html"),
              onClick: () => setMode("html"),
              isActive: mode === "html",
              label: "Add HTML",
              hotkey: "H",
            },
          ]}
          className="hidden md:flex"
        />
        <div className="hidden md:block w-px h-6 bg-border mx-1" />
        <ButtonsGroup
          buttons={[
            {
              children: <Undo />,
              onClick: handleUndo,
              label: "Undo",
              hotkey: "⌘Z",
              disabled: undoCount === 0,
            },
            {
              children: <Redo />,
              onClick: handleRedo,
              label: "Redo",
              hotkey: "⌘⇧Z",
              disabled: redoCount === 0,
            },
          ]}
          className="hidden md:flex"
        />
        <div className="hidden md:block w-px h-6 bg-border mx-1" />
        <Button className="hidden md:flex gap-2 rounded-xl h-10 px-6" onClick={downloadImage}>
          <Download /> Export
        </Button>
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
    </>
  );
}

export default EditorHeader;
