import * as React from "react";
import { CursorArrowIcon, HandIcon } from "@radix-ui/react-icons";
import { FiDownload } from "react-icons/fi";
import { GrUndo, GrRedo } from "react-icons/gr";
import ButtonsGroup from "@/components/ui/buttons-group";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "../use-editor";
import { BlockIcon } from "../utils";
import { cn } from "@/lib/utils";
import { shallow } from "zustand/shallow";

function EditorHeader({ className }: { className?: string }) {
  const imageInputRef = React.useRef<HTMLInputElement>(null);
  const [mode, setMode] = useEditorStore(
    (state) => [state.canvas.mode, state.setMode],
    shallow
  );
  const addTextBlock = useEditorStore((state) => state.addTextBlock);
  const addFrameBlock = useEditorStore((state) => state.addFrameBlock);
  const addImageBlock = useEditorStore((state) => state.addImageBlock);
  const [handleUndo, handleRedo, undoCount, redoCount] = useEditorStore(
    (state) => [
      state.handleUndo,
      state.handleRedo,
      state.history.undo.length,
      state.history.redo.length,
    ],
    shallow
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
            },
            {
              children: <HandIcon />,
              onClick: () => setMode("move"),
              isActive: mode === "move",
              label: "Move",
            },
          ]}
        />
        <ButtonsGroup
          buttons={[
            {
              children: BlockIcon("text"),
              onClick: () => addTextBlock(),
              label: "Add Text",
            },
            {
              children: BlockIcon("image"),
              onClick: () => {
                if (imageInputRef.current) {
                  imageInputRef.current.click();
                }
              },
              label: "Add Image",
            },
            {
              children: BlockIcon("frame"),
              onClick: () => addFrameBlock(),
              label: "Add Frame",
            },
          ]}
        />
        <div className="w-px h-6 bg-border mx-1" />
        <ButtonsGroup
          buttons={[
            {
              children: <GrUndo />,
              onClick: handleUndo,
              label: "Undo",
              disabled: undoCount === 0,
            },
            {
              children: <GrRedo />,
              onClick: handleRedo,
              label: "Redo",
              disabled: redoCount === 0,
            },
          ]}
        />
        <div className="w-px h-6 bg-border mx-1" />
        <Button className="gap-2 rounded-xl h-10 px-6" onClick={downloadImage}>
          <FiDownload /> Export
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
                addImageBlock({
                  url: img.src,
                  width: img.width,
                  height: img.height,
                });
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
