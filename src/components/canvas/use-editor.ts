"use client";

import type Konva from "konva";
import { create } from "zustand";
import { generateId } from "@/lib/id-generator";
import type {
  IEditorBlockFrame,
  IEditorBlockImage,
  IEditorBlockText,
  IEditorBlockArrow,
  IEditorBlocks,
  IEditorSize,
  Template,
} from "@/lib/schema";
import {
  frameBlockSchema,
  imageBlockSchema,
  textBlockSchema,
  arrowBlockSchema,
} from "@/lib/schema";
import { loadFontsForBlocks } from "./services/fonts";
import { downloadStageAsImage, exportCanvasAsJson } from "./services/export";
import {
  ensureBlockDefaults,
  parseBlock,
  parseTemplate,
  MAX_IMAGE_DIMENSION,
} from "./services/templates";
import {
  centerBlockInViewport,
  centerStageWithinContainer,
} from "./utils/canvas-math";
import { calculateArrowBounds } from "./utils/arrow-bounds";

type HistoryEntry = Pick<Template, "blocks" | "size" | "background">;

interface EditorCanvasState {
  size: IEditorSize;
  background?: string;
  mode: "move" | "select" | "text" | "frame" | "arrow" | "image" | "draw";
  isTextEditing: boolean;
  zoom: number;
  stagePosition: { x: number; y: number };
  containerSize: { width: number; height: number };
  hasCentered: boolean;
}

interface EditorState {
  blocksById: Record<string, IEditorBlocks>;
  blockOrder: string[];
  selectedIds: string[];
  hoveredId: string | null;
  canvas: EditorCanvasState;
  history: {
    undo: HistoryEntry[];
    redo: HistoryEntry[];
  };
  stage: Konva.Stage | null;
  pendingImageData: { url: string; width: number; height: number } | null;
  clipboard: IEditorBlocks[] | null;
}

interface EditorActions {
  setStage: (stage: Konva.Stage | null) => void;
  setSelectedIds: (ids: string[]) => void;
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
  setIsTextEditing: (value: boolean) => void;
  setStageZoom: (zoom: number) => void;
  setStagePosition: (position: { x: number; y: number }) => void;
  setCanvasContainerSize: (size: { width: number; height: number }) => void;
  centerStage: () => void;
  updateCanvasSize: (size: Partial<IEditorSize>) => void;
  setCanvasBackground: (background: string | undefined) => void;
  setHoveredId: (id: string | null) => void;
  setPendingImageData: (
    data: { url: string; width: number; height: number } | null
  ) => void;
  addTextBlock: () => void;
  addFrameBlock: () => void;
  addImageBlock: (args: { url: string; width: number; height: number }) => void;
  addArrowBlock: () => void;
  duplicateBlock: (id: string) => void;
  deleteBlock: (id: string) => void;
  deleteSelectedBlocks: () => void;
  showHideBlock: (id: string) => void;
  updateBlockValues: (id: string, values: Partial<IEditorBlocks>) => void;
  bringForwardBlock: (id: string) => void;
  bringToTopBlock: (id: string) => void;
  bringBackwardBlock: (id: string) => void;
  bringToBackBlock: (id: string) => void;
  setBlockPosition: (id: string, position: { x: number; y: number }) => void;
  setBlockSize: (
    id: string,
    size: { width?: number | null; height?: number | null }
  ) => void;
  addBlock: (block: IEditorBlocks) => void;
  loadTemplate: (template: Template) => void;
  handleUndo: () => void;
  handleRedo: () => void;
  downloadImage: () => Promise<void>;
  exportToJson: () => void;
  copySelectedBlocks: () => void;
  pasteBlocks: (position?: { x: number; y: number }) => void;
}

export type EditorStore = EditorState & EditorActions;

const clone = <T>(value: T): T =>
  typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));

const createSnapshot = (state: EditorState): HistoryEntry => ({
  blocks: state.blockOrder
    .map((id) => state.blocksById[id])
    .filter(Boolean)
    .map((block) => clone(block)),
  size: clone(state.canvas.size),
  background: state.canvas.background,
});

export const selectOrderedBlocks = (state: EditorState): IEditorBlocks[] =>
  state.blockOrder.map((id) => state.blocksById[id]).filter(Boolean);

const blocksArray = selectOrderedBlocks;

const calculateViewportCenteredPosition = (
  state: EditorState,
  width: number,
  height: number
) =>
  centerBlockInViewport(
    {
      stage: state.stage,
      stagePosition: state.canvas.stagePosition,
      zoom: state.canvas.zoom || 1,
      containerSize: state.canvas.containerSize,
      canvasSize: state.canvas.size,
    },
    width,
    height
  );

const computeCenteredStagePosition = (state: EditorState) => {
  const {
    canvas: { size, containerSize, zoom },
  } = state;
  if (
    !containerSize.width ||
    !containerSize.height ||
    !size.width ||
    !size.height
  ) {
    return null;
  }
  return centerStageWithinContainer({
    canvasSize: size,
    containerSize,
    zoom: zoom || 1,
  });
};

const buildInitialState = (template?: Template): EditorState => {
  const { canvasSize, background, blocksById, blockOrder } =
    parseTemplate(template);

  return {
    blocksById,
    blockOrder,
    selectedIds: [],
    hoveredId: null,
    canvas: {
      size: canvasSize,
      background,
      mode: "select",
      isTextEditing: false,
      zoom: 1,
      stagePosition: { x: 0, y: 0 },
      containerSize: { width: 0, height: 0 },
      hasCentered: false,
    },
    history: {
      undo: [],
      redo: [],
    },
    stage: null,
    pendingImageData: null,
    clipboard: null,
  };
};

export const useEditorStore = create<EditorStore>((set, get) => ({
  ...buildInitialState(),

  setStage: (stage) => {
    set((state) => {
      if (state.stage === stage) {
        return state;
      }
      if (!stage) {
        return { ...state, stage };
      }
      const nextState: EditorState = { ...state, stage };
      if (nextState.canvas.hasCentered) {
        return nextState;
      }
      const position = computeCenteredStagePosition(nextState);
      if (!position) {
        return nextState;
      }
      return {
        ...nextState,
        canvas: {
          ...nextState.canvas,
          stagePosition: position,
          hasCentered: true,
        },
      };
    });
  },

  setSelectedIds: (ids) => {
    set((state) => {
      if (
        state.selectedIds.length === ids.length &&
        state.selectedIds.every((value, index) => value === ids[index])
      ) {
        return state;
      }
      return { ...state, selectedIds: ids };
    });
  },

  setMode: (mode) => {
    set((state) => {
      if (state.canvas.mode === mode) {
        return state;
      }
      return {
        ...state,
        canvas: { ...state.canvas, mode },
        selectedIds: [],
        hoveredId: null,
      };
    });
  },

  setIsTextEditing: (value) => {
    set((state) =>
      state.canvas.isTextEditing === value
        ? state
        : {
            ...state,
            canvas: { ...state.canvas, isTextEditing: value },
          }
    );
  },

  setStageZoom: (zoom) => {
    set((state) =>
      state.canvas.zoom === zoom
        ? state
        : { ...state, canvas: { ...state.canvas, zoom } }
    );
  },

  setStagePosition: (position) => {
    set((state) => {
      const current = state.canvas.stagePosition;
      if (current.x === position.x && current.y === position.y) {
        if (state.canvas.hasCentered) {
          return state;
        }
        return {
          ...state,
          canvas: { ...state.canvas, hasCentered: true },
        };
      }
      return {
        ...state,
        canvas: {
          ...state.canvas,
          stagePosition: position,
          hasCentered: true,
        },
      };
    });
  },

  setHoveredId: (id) => {
    set((state) =>
      state.hoveredId === id ? state : { ...state, hoveredId: id }
    );
  },

  setPendingImageData: (data) => {
    set((state) => ({
      ...state,
      pendingImageData: data,
    }));
  },

  setCanvasContainerSize: (size) => {
    set((state) => {
      const current = state.canvas.containerSize;
      if (current.width === size.width && current.height === size.height) {
        return state;
      }
      const nextCanvas = {
        ...state.canvas,
        containerSize: size,
      };
      if (state.canvas.hasCentered) {
        return {
          ...state,
          canvas: nextCanvas,
        };
      }
      const position = computeCenteredStagePosition({
        ...state,
        canvas: nextCanvas,
      });
      if (!position) {
        return {
          ...state,
          canvas: nextCanvas,
        };
      }
      return {
        ...state,
        canvas: {
          ...nextCanvas,
          stagePosition: position,
          hasCentered: true,
        },
      };
    });
  },

  centerStage: () => {
    set((state) => {
      const position = computeCenteredStagePosition(state);
      if (!position) {
        return state;
      }
      const current = state.canvas.stagePosition;
      if (
        current.x === position.x &&
        current.y === position.y &&
        state.canvas.hasCentered
      ) {
        return state;
      }
      return {
        ...state,
        canvas: {
          ...state.canvas,
          stagePosition: position,
          hasCentered: true,
        },
      };
    });
  },

  updateCanvasSize: (size) => {
    set((state) => {
      const nextSize = {
        ...state.canvas.size,
        ...size,
      };
      const snapshot = createSnapshot(state);
      const nextCanvas = {
        ...state.canvas,
        size: nextSize,
        hasCentered: false,
      };
      const position = computeCenteredStagePosition({
        ...state,
        canvas: nextCanvas,
      });
      const centeredCanvas = position
        ? {
            ...nextCanvas,
            stagePosition: position,
            hasCentered: true,
          }
        : nextCanvas;
      return {
        ...state,
        canvas: {
          ...centeredCanvas,
        },
        history: {
          undo: [snapshot, ...state.history.undo],
          redo: [],
        },
      };
    });
  },

  setCanvasBackground: (background) => {
    set((state) => {
      const snapshot = createSnapshot(state);
      return {
        ...state,
        canvas: {
          ...state.canvas,
          background,
        },
        history: {
          undo: [snapshot, ...state.history.undo],
          redo: [],
        },
      };
    });
  },

  addTextBlock: () => {
    set((state) => {
      const snapshot = createSnapshot(state);
      const blocks = blocksArray(state);
      const position = calculateViewportCenteredPosition(state, 320, 52);
      const defaultBlock = ensureBlockDefaults(
        textBlockSchema.parse({
          id: generateId(),
          type: "text",
          label: `Text ${blocks.length + 1}`,
          ...position,
          width: 320,
          height: 52,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          text: "New text",
          color: "#1f2933",
          fontSize: 24,
          lineHeight: 32,
          letterSpacing: 0,
          textAlign: "left",
          font: { family: "Poppins", weight: "500" },
          visible: true,
          opacity: 100,
        } satisfies IEditorBlockText)
      );

      return {
        ...state,
        blocksById: {
          ...state.blocksById,
          [defaultBlock.id]: defaultBlock,
        },
        blockOrder: [...state.blockOrder, defaultBlock.id],
        selectedIds: [defaultBlock.id],
        canvas: { ...state.canvas, mode: "select" },
        history: {
          undo: [snapshot, ...state.history.undo],
          redo: [],
        },
      };
    });
  },

  addFrameBlock: () => {
    set((state) => {
      const snapshot = createSnapshot(state);
      const blocks = blocksArray(state);
      const position = calculateViewportCenteredPosition(state, 240, 240);
      const defaultBlock = ensureBlockDefaults(
        frameBlockSchema.parse({
          id: generateId(),
          type: "frame",
          label: `Frame ${blocks.length + 1}`,
          ...position,
          width: 240,
          height: 240,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          background: "#ffffff",
          border: {
            color: "#d1d5db",
            width: 1,
          },
          radius: { tl: 16, tr: 16, br: 16, bl: 16 },
          visible: true,
          opacity: 100,
        } satisfies IEditorBlockFrame)
      );

      return {
        ...state,
        blocksById: {
          ...state.blocksById,
          [defaultBlock.id]: defaultBlock,
        },
        blockOrder: [...state.blockOrder, defaultBlock.id],
        selectedIds: [defaultBlock.id],
        canvas: { ...state.canvas, mode: "select" },
        history: {
          undo: [snapshot, ...state.history.undo],
          redo: [],
        },
      };
    });
  },

  addImageBlock: ({ url, width, height }) => {
    set((state) => {
      const snapshot = createSnapshot(state);
      const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(width, height));
      const scaledWidth = Math.max(1, Math.round(width * scale));
      const scaledHeight = Math.max(1, Math.round(height * scale));
      const blocks = blocksArray(state);
      const position = calculateViewportCenteredPosition(
        state,
        scaledWidth,
        scaledHeight
      );

      const defaultBlock = ensureBlockDefaults(
        imageBlockSchema.parse({
          id: generateId(),
          type: "image",
          label: `Image ${blocks.length + 1}`,
          ...position,
          width: scaledWidth,
          height: scaledHeight,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          url,
          fit: "contain",
          position: "center",
          visible: true,
          opacity: 100,
        } satisfies IEditorBlockImage)
      );

      return {
        ...state,
        blocksById: {
          ...state.blocksById,
          [defaultBlock.id]: defaultBlock,
        },
        blockOrder: [...state.blockOrder, defaultBlock.id],
        selectedIds: [defaultBlock.id],
        canvas: { ...state.canvas, mode: "select" },
        history: {
          undo: [snapshot, ...state.history.undo],
          redo: [],
        },
      };
    });
  },

  addArrowBlock: () => {
    set((state) => {
      const snapshot = createSnapshot(state);
      const blocks = blocksArray(state);

      // Default arrow: horizontal, 200px long, pointing right
      const points: [number, number, number, number] = [0, 0, 200, 0];

      // Create a temporary block to calculate bounds
      const tempBlock: IEditorBlockArrow = {
        id: "", // Not used for calculation
        type: "arrow",
        label: "",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        points,
        pointerLength: 20,
        pointerWidth: 20,
        fill: "#000000",
        stroke: "#000000",
        strokeWidth: 4,
        visible: true,
        opacity: 100,
      };

      const bounds = calculateArrowBounds(tempBlock);

      // Calculate centered position for the bounding box
      const position = calculateViewportCenteredPosition(
        state,
        bounds.width,
        bounds.height
      );

      // Convert bounding box position to block position (accounting for offset)
      const actualX = position.x - bounds.offsetX;
      const actualY = position.y - bounds.offsetY;

      const defaultBlock = ensureBlockDefaults(
        arrowBlockSchema.parse({
          id: generateId(),
          type: "arrow",
          label: `Arrow ${blocks.length + 1}`,
          x: actualX,
          y: actualY,
          width: bounds.width,
          height: bounds.height,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          points: points,
          pointerLength: 20,
          pointerWidth: 20,
          fill: "#000000",
          stroke: "#000000",
          strokeWidth: 4,
          visible: true,
          opacity: 100,
        } satisfies IEditorBlockArrow)
      );

      return {
        ...state,
        blocksById: {
          ...state.blocksById,
          [defaultBlock.id]: defaultBlock,
        },
        blockOrder: [...state.blockOrder, defaultBlock.id],
        selectedIds: [defaultBlock.id],
        canvas: { ...state.canvas, mode: "select" },
        history: {
          undo: [snapshot, ...state.history.undo],
          redo: [],
        },
      };
    });
  },

  duplicateBlock: (id) => {
    set((state) => {
      const block = state.blocksById[id];
      if (!block) {
        return state;
      }
      const snapshot = createSnapshot(state);
      const newId = generateId();
      const duplicated = parseBlock({
        ...clone(block),
        id: newId,
        label: `${block.label} Copy`,
        x: block.x + 24,
        y: block.y + 24,
      });

      const index = state.blockOrder.indexOf(id);
      const nextOrder = [...state.blockOrder];
      nextOrder.splice(index + 1, 0, newId);

      return {
        ...state,
        blocksById: {
          ...state.blocksById,
          [duplicated.id]: duplicated,
        },
        blockOrder: nextOrder,
        selectedIds: [duplicated.id],
        history: {
          undo: [snapshot, ...state.history.undo],
          redo: [],
        },
      };
    });
  },

  deleteBlock: (id) => {
    set((state) => {
      if (!state.blocksById[id]) {
        return state;
      }
      const snapshot = createSnapshot(state);
      const rest = { ...state.blocksById };
      delete rest[id];
      const nextOrder = state.blockOrder.filter((blockId) => blockId !== id);
      const nextSelected = state.selectedIds.filter(
        (blockId) => blockId !== id
      );
      const nextHovered = state.hoveredId === id ? null : state.hoveredId;
      return {
        ...state,
        blocksById: rest,
        blockOrder: nextOrder,
        selectedIds: nextSelected,
        hoveredId: nextHovered,
        history: {
          undo: [snapshot, ...state.history.undo],
          redo: [],
        },
      };
    });
  },

  deleteSelectedBlocks: () => {
    set((state) => {
      if (state.selectedIds.length === 0) {
        return state;
      }
      const snapshot = createSnapshot(state);
      const idsToRemove = new Set(state.selectedIds);
      const nextBlocksById = { ...state.blocksById };
      idsToRemove.forEach((blockId) => {
        delete nextBlocksById[blockId];
      });
      const nextOrder = state.blockOrder.filter(
        (blockId) => !idsToRemove.has(blockId)
      );
      const nextHovered = idsToRemove.has(state.hoveredId ?? "")
        ? null
        : state.hoveredId;
      return {
        ...state,
        blocksById: nextBlocksById,
        blockOrder: nextOrder,
        selectedIds: [],
        hoveredId: nextHovered,
        history: {
          undo: [snapshot, ...state.history.undo],
          redo: [],
        },
      };
    });
  },

  showHideBlock: (id) => {
    set((state) => {
      const block = state.blocksById[id];
      if (!block) {
        return state;
      }
      const snapshot = createSnapshot(state);
      const nextBlock = { ...block, visible: !block.visible };
      return {
        ...state,
        blocksById: {
          ...state.blocksById,
          [id]: nextBlock,
        },
        history: {
          undo: [snapshot, ...state.history.undo],
          redo: [],
        },
      };
    });
  },

  updateBlockValues: (id, values) => {
    set((state) => {
      const block = state.blocksById[id];
      if (!block) {
        return state;
      }
      const snapshot = createSnapshot(state);
      const nextBlock = ensureBlockDefaults({
        ...block,
        ...values,
      } as IEditorBlocks);
      return {
        ...state,
        blocksById: {
          ...state.blocksById,
          [id]: nextBlock,
        },
        history: {
          undo: [snapshot, ...state.history.undo],
          redo: [],
        },
      };
    });
  },

  bringForwardBlock: (id) => {
    set((state) => {
      const index = state.blockOrder.indexOf(id);
      if (index === -1 || index === state.blockOrder.length - 1) {
        return state;
      }
      const snapshot = createSnapshot(state);
      const nextOrder = [...state.blockOrder];
      [nextOrder[index], nextOrder[index + 1]] = [
        nextOrder[index + 1],
        nextOrder[index],
      ];
      return {
        ...state,
        blockOrder: nextOrder,
        history: {
          undo: [snapshot, ...state.history.undo],
          redo: [],
        },
      };
    });
  },

  bringToTopBlock: (id) => {
    set((state) => {
      const index = state.blockOrder.indexOf(id);
      if (index === -1 || index === state.blockOrder.length - 1) {
        return state;
      }
      const snapshot = createSnapshot(state);
      const nextOrder = [...state.blockOrder];
      nextOrder.splice(index, 1);
      nextOrder.push(id);
      return {
        ...state,
        blockOrder: nextOrder,
        history: {
          undo: [snapshot, ...state.history.undo],
          redo: [],
        },
      };
    });
  },

  bringBackwardBlock: (id) => {
    set((state) => {
      const index = state.blockOrder.indexOf(id);
      if (index <= 0) {
        return state;
      }
      const snapshot = createSnapshot(state);
      const nextOrder = [...state.blockOrder];
      [nextOrder[index], nextOrder[index - 1]] = [
        nextOrder[index - 1],
        nextOrder[index],
      ];
      return {
        ...state,
        blockOrder: nextOrder,
        history: {
          undo: [snapshot, ...state.history.undo],
          redo: [],
        },
      };
    });
  },

  bringToBackBlock: (id) => {
    set((state) => {
      const index = state.blockOrder.indexOf(id);
      if (index <= 0) {
        return state;
      }
      const snapshot = createSnapshot(state);
      const nextOrder = [...state.blockOrder];
      nextOrder.splice(index, 1);
      nextOrder.unshift(id);
      return {
        ...state,
        blockOrder: nextOrder,
        history: {
          undo: [snapshot, ...state.history.undo],
          redo: [],
        },
      };
    });
  },

  setBlockPosition: (id, position) => {
    set((state) => {
      const block = state.blocksById[id];
      if (!block) {
        return state;
      }
      const snapshot = createSnapshot(state);
      const nextBlock = {
        ...block,
        x: Math.round(position.x),
        y: Math.round(position.y),
      };
      return {
        ...state,
        blocksById: {
          ...state.blocksById,
          [id]: nextBlock,
        },
        history: {
          undo: [snapshot, ...state.history.undo],
          redo: [],
        },
      };
    });
  },

  setBlockSize: (id, size) => {
    set((state) => {
      const block = state.blocksById[id];
      if (!block) {
        return state;
      }
      const snapshot = createSnapshot(state);
      const nextBlock = {
        ...block,
        ...(typeof size.width === "number"
          ? { width: Math.max(1, size.width) }
          : {}),
        ...(typeof size.height === "number"
          ? { height: Math.max(1, size.height) }
          : {}),
      };
      return {
        ...state,
        blocksById: {
          ...state.blocksById,
          [id]: nextBlock,
        },
        history: {
          undo: [snapshot, ...state.history.undo],
          redo: [],
        },
      };
    });
  },

  addBlock: (block) => {
    set((state) => {
      const snapshot = createSnapshot(state);
      const parsed = parseBlock(block);
      return {
        ...state,
        blocksById: {
          ...state.blocksById,
          [parsed.id]: parsed,
        },
        blockOrder: [...state.blockOrder, parsed.id],
        selectedIds: [parsed.id],
        history: {
          undo: [snapshot, ...state.history.undo],
          redo: [],
        },
      };
    });
  },

  loadTemplate: (template) => {
    set((state) => {
      const snapshot = createSnapshot(state);
      const initial = buildInitialState(template);
      const mergedState: EditorState = {
        ...state,
        blocksById: initial.blocksById,
        blockOrder: initial.blockOrder,
        selectedIds: initial.selectedIds,
        hoveredId: null,
        canvas: {
          ...initial.canvas,
          containerSize: state.canvas.containerSize,
          zoom: state.canvas.zoom,
          stagePosition: state.canvas.stagePosition,
          hasCentered: false,
        },
        history: {
          undo: [snapshot, ...state.history.undo],
          redo: [],
        },
        stage: state.stage,
      };
      const position = computeCenteredStagePosition(mergedState);
      if (!position) {
        return mergedState;
      }
      return {
        ...mergedState,
        canvas: {
          ...mergedState.canvas,
          stagePosition: position,
          hasCentered: true,
        },
      };
    });
  },

  handleUndo: () => {
    set((state) => {
      if (state.history.undo.length === 0) {
        return state;
      }
      const [snapshot, ...remainingUndo] = state.history.undo;
      const redoSnapshot = createSnapshot(state);
      const nextBlocksById = snapshot.blocks.reduce<
        Record<string, IEditorBlocks>
      >((acc, block) => {
        acc[block.id] = block;
        return acc;
      }, {});
      const nextOrder = snapshot.blocks.map((block) => block.id);
      const baseState: EditorState = {
        ...state,
        blocksById: nextBlocksById,
        blockOrder: nextOrder,
        selectedIds: [],
        canvas: {
          ...state.canvas,
          size: snapshot.size,
          background: snapshot.background ?? state.canvas.background,
          hasCentered: false,
        },
        history: {
          undo: remainingUndo,
          redo: [redoSnapshot, ...state.history.redo],
        },
      };
      const position = computeCenteredStagePosition(baseState);
      if (!position) {
        return baseState;
      }
      return {
        ...baseState,
        canvas: {
          ...baseState.canvas,
          stagePosition: position,
          hasCentered: true,
        },
      };
    });
  },

  handleRedo: () => {
    set((state) => {
      if (state.history.redo.length === 0) {
        return state;
      }
      const [snapshot, ...remainingRedo] = state.history.redo;
      const undoSnapshot = createSnapshot(state);
      const nextBlocksById = snapshot.blocks.reduce<
        Record<string, IEditorBlocks>
      >((acc, block) => {
        acc[block.id] = block;
        return acc;
      }, {});
      const nextOrder = snapshot.blocks.map((block) => block.id);
      const baseState: EditorState = {
        ...state,
        blocksById: nextBlocksById,
        blockOrder: nextOrder,
        selectedIds: [],
        canvas: {
          ...state.canvas,
          size: snapshot.size,
          background: snapshot.background ?? state.canvas.background,
          hasCentered: false,
        },
        history: {
          undo: [undoSnapshot, ...state.history.undo],
          redo: remainingRedo,
        },
      };
      const position = computeCenteredStagePosition(baseState);
      if (!position) {
        return baseState;
      }
      return {
        ...baseState,
        canvas: {
          ...baseState.canvas,
          stagePosition: position,
          hasCentered: true,
        },
      };
    });
  },

  downloadImage: async () => {
    const state = get();
    const { stage, selectedIds } = state;
    if (!stage) {
      return;
    }
    await downloadStageAsImage(stage, blocksArray(state), selectedIds);
  },

  exportToJson: () => {
    const state = get();
    exportCanvasAsJson({
      blocks: blocksArray(state),
      size: state.canvas.size,
      background: state.canvas.background,
    });
  },

  copySelectedBlocks: () => {
    set((state) => {
      if (state.selectedIds.length === 0) {
        return state;
      }
      const copiedBlocks = state.selectedIds
        .map((id) => state.blocksById[id])
        .filter(Boolean)
        .map((block) => clone(block));
      return {
        ...state,
        clipboard: copiedBlocks,
      };
    });
  },

  pasteBlocks: (position?: { x: number; y: number }) => {
    set((state) => {
      if (!state.clipboard || state.clipboard.length === 0) {
        return state;
      }
      const snapshot = createSnapshot(state);
      const newBlocks: IEditorBlocks[] = [];
      const newIds: string[] = [];

      // Calculate the minimum x and y from copied blocks to maintain relative positions
      const minX = Math.min(...state.clipboard.map((b) => b.x));
      const minY = Math.min(...state.clipboard.map((b) => b.y));

      // Use pointer position if provided, otherwise use offset from original position
      const pasteX = position?.x ?? minX + 24;
      const pasteY = position?.y ?? minY + 24;

      state.clipboard.forEach((block) => {
        const newId = generateId();
        const newBlock = parseBlock({
          ...clone(block),
          id: newId,
          x: block.x - minX + pasteX,
          y: block.y - minY + pasteY,
          label: `${block.label} Copy`,
        });
        newBlocks.push(newBlock);
        newIds.push(newId);
      });

      // Add all new blocks
      const newBlocksById = { ...state.blocksById };
      newBlocks.forEach((block) => {
        newBlocksById[block.id] = block;
      });

      return {
        ...state,
        blocksById: newBlocksById,
        blockOrder: [...state.blockOrder, ...newIds],
        selectedIds: newIds,
        history: {
          undo: [snapshot, ...state.history.undo],
          redo: [],
        },
      };
    });
  },
}));

const selectBlocksForFonts = (state: EditorState) =>
  state.blockOrder.map((id) => state.blocksById[id]).filter(Boolean);

const blocksAreEqual = (prev: IEditorBlocks[], next: IEditorBlocks[]) =>
  prev.length === next.length &&
  prev.every((block, index) => block === next[index]);

// Initialize fonts for initial state (client-side only)
if (typeof window !== "undefined") {
  void loadFontsForBlocks(selectBlocksForFonts(useEditorStore.getState()));

  let prevBlocks = selectBlocksForFonts(useEditorStore.getState());
  useEditorStore.subscribe((state) => {
    const blocks = selectBlocksForFonts(state);
    if (!blocksAreEqual(prevBlocks, blocks)) {
      prevBlocks = blocks;
      void loadFontsForBlocks(blocks);
    }
  });
}

export const editorStoreApi = useEditorStore;

export const initializeEditorStore = (template?: Template) => {
  const initial = buildInitialState(template);
  useEditorStore.setState((state) => {
    const mergedCanvas = {
      ...initial.canvas,
      containerSize: state.canvas.containerSize,
      zoom: state.canvas.zoom,
      stagePosition: state.canvas.stagePosition,
      hasCentered: false,
    };
    const mergedState: EditorState = {
      ...state,
      blocksById: initial.blocksById,
      blockOrder: initial.blockOrder,
      selectedIds: initial.selectedIds,
      hoveredId: initial.hoveredId,
      canvas: mergedCanvas,
      history: initial.history,
      stage: state.stage,
    };
    const position = computeCenteredStagePosition(mergedState);
    if (!position) {
      return mergedState;
    }
    return {
      ...mergedState,
      canvas: {
        ...mergedCanvas,
        stagePosition: position,
        hasCentered: true,
      },
    };
  });
};
