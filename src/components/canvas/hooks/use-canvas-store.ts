import { useMemo } from "react";
import { useEditorStore } from "../use-editor";
import { useShallow } from "zustand/react/shallow";
import { useOrderedBlocks } from "./use-ordered-blocks";

export const useCanvasStore = () => {
  // Use the reusable hook for stable blocks reference
  const blocks = useOrderedBlocks();

  // Select other state with useShallow
  const state = useEditorStore(
    useShallow((s) => ({
      selectedIds: s.selectedIds,
      hoveredId: s.hoveredId,
      mode: s.canvas.mode,
      isTextEditing: s.canvas.isTextEditing,
      zoom: s.canvas.zoom,
      stagePosition: s.canvas.stagePosition,
      containerSize: s.canvas.containerSize,
      size: s.canvas.size,
      background: s.canvas.background,
    }))
  );

  // Select actions - these are stable function references
  const actions = useEditorStore(
    useShallow((s) => ({
      setSelectedIds: s.setSelectedIds,
      setHoveredId: s.setHoveredId,
      setStage: s.setStage,
      setStageZoom: s.setStageZoom,
      setStagePosition: s.setStagePosition,
      setCanvasContainerSize: s.setCanvasContainerSize,
      setIsTextEditing: s.setIsTextEditing,
      setMode: s.setMode,
      addFrameBlock: s.addFrameBlock,
      addTextBlock: s.addTextBlock,
      addArrowBlock: s.addArrowBlock,
      deleteSelectedBlocks: s.deleteSelectedBlocks,
      setBlockPosition: s.setBlockPosition,
      updateBlockValues: s.updateBlockValues,
    }))
  );

  // Combine with stable blocks reference
  return useMemo(
    () => ({
      blocks,
      ...state,
      ...actions,
    }),
    [blocks, state, actions]
  );
};
