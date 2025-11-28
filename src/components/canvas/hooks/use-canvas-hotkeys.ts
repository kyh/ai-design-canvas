import * as React from "react";
import { editorStoreApi } from "../use-editor";
import type Konva from "konva";

interface UseCanvasHotkeysOptions {
  setMode: (
    mode:
      | "move"
      | "select"
      | "text"
      | "frame"
      | "arrow"
      | "image"
      | "draw"
  ) => void;
  deleteSelectedBlocks: () => void;
  copySelectedBlocks: () => void;
  pasteBlocks: (position?: { x: number; y: number }) => void;
  stage: Konva.Stage | null;
  zoom: number;
}

const isEditableTarget = (target: EventTarget | null) => {
  if (!target || !(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  const tagName = target.tagName;
  if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") {
    return true;
  }
  return Boolean(
    target.closest('input, textarea, select, [contenteditable="true"]')
  );
};

const getPointerPosition = (stage: Konva.Stage | null) => {
  if (!stage) {
    return null;
  }
  const pointer = stage.getPointerPosition();
  if (!pointer) {
    return null;
  }
  return pointer;
};

const toCanvasCoordinates = (
  stage: Konva.Stage,
  position: { x: number; y: number },
  zoom: number
) => {
  const stagePos = stage.position();
  return {
    x: (position.x - stagePos.x) / zoom,
    y: (position.y - stagePos.y) / zoom,
  };
};

export const useCanvasHotkeys = ({
  setMode,
  deleteSelectedBlocks,
  copySelectedBlocks,
  pasteBlocks,
  stage,
  zoom,
}: UseCanvasHotkeysOptions) => {
  const spacePressedRef = React.useRef(false);
  const spacePrevModeRef = React.useRef<
    | "move"
    | "select"
    | "text"
    | "frame"
    | "arrow"
    | "image"
    | "draw"
    | null
  >(null);

  React.useEffect(() => {
    const store = editorStoreApi;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }

      const state = store.getState();

      // Handle Cmd+A / Ctrl+A to select all blocks
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
        if (isEditableTarget(event.target) || state.canvas.isTextEditing) {
          return; // Let browser handle select all in input fields
        }
        event.preventDefault();
        // Get all visible blocks
        const allBlockIds = state.blockOrder
          .map((id) => state.blocksById[id])
          .filter((block) => block && block.visible)
          .map((block) => block!.id);
        if (allBlockIds.length > 0) {
          store.getState().setSelectedIds(allBlockIds);
        }
        return;
      }

      // Handle Cmd+C / Ctrl+C to copy selected blocks
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c") {
        if (isEditableTarget(event.target) || state.canvas.isTextEditing) {
          return; // Let browser handle copy in input fields
        }
        if (state.selectedIds.length > 0) {
          event.preventDefault();
          copySelectedBlocks();
        }
        return;
      }

      // Handle Cmd+V / Ctrl+V to paste blocks
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "v") {
        if (isEditableTarget(event.target) || state.canvas.isTextEditing) {
          return; // Let browser handle paste in input fields
        }
        if (state.clipboard && state.clipboard.length > 0) {
          event.preventDefault();
          // Get pointer position on canvas for paste location
          const pointer = getPointerPosition(stage);
          const pastePosition =
            pointer && stage
              ? toCanvasCoordinates(stage, pointer, zoom)
              : undefined;
          pasteBlocks(pastePosition);
        }
        return;
      }

      if (event.code === "Space") {
        if (event.metaKey || event.ctrlKey || event.altKey) {
          return;
        }
        if (isEditableTarget(event.target) || state.canvas.isTextEditing) {
          return;
        }
        event.preventDefault();
        if (!spacePressedRef.current) {
          spacePressedRef.current = true;
          spacePrevModeRef.current = state.canvas.mode;
          if (state.canvas.mode !== "move") {
            setMode("move");
          }
        }
        return;
      }

      // Don't interfere with modifier keys for mode switching
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (isEditableTarget(event.target) || state.canvas.isTextEditing) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === "v") {
        setMode("select");
        event.preventDefault();
        return;
      }

      if (key === "f") {
        setMode("frame");
        event.preventDefault();
        return;
      }

      if (key === "t") {
        setMode("text");
        event.preventDefault();
        return;
      }

      if (key === "a") {
        setMode("arrow");
        event.preventDefault();
        return;
      }

      if (key === "d") {
        setMode("draw");
        event.preventDefault();
        return;
      }

      if (key === "backspace" || key === "delete") {
        if (state.selectedIds.length > 0) {
          event.preventDefault();
          deleteSelectedBlocks();
        }
      }
    };

    const resetSpaceMode = () => {
      if (!spacePressedRef.current) {
        return;
      }
      spacePressedRef.current = false;
      const previousMode = spacePrevModeRef.current;
      spacePrevModeRef.current = null;
      if (!previousMode) {
        return;
      }
      const currentMode = store.getState().canvas.mode;
      if (currentMode !== previousMode) {
        setMode(previousMode);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();
        resetSpaceMode();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", resetSpaceMode);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", resetSpaceMode);
    };
  }, [
    deleteSelectedBlocks,
    setMode,
    copySelectedBlocks,
    pasteBlocks,
    stage,
    zoom,
  ]);
};
