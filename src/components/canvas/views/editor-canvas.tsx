import * as React from "react";
import type Konva from "konva";
import {
  Stage,
  Layer,
  Rect,
  Text as KonvaText,
  Group,
  Image as KonvaImage,
  Arrow as KonvaArrow,
  Transformer,
} from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type {
  IEditorBlockFrame,
  IEditorBlockImage,
  IEditorBlockText,
  IEditorBlockArrow,
  IEditorBlocks,
} from "@/lib/schema";
import ZoomHandler from "./zoomable";
import { parseLinearGradientFill, blockNodeId } from "../utils";
import {
  calculateArrowBounds,
  blockPositionToGroupPosition,
  groupPositionToBlockPosition,
  scaleArrowPoints,
} from "../utils/arrow-bounds";
import { editorStoreApi } from "../use-editor";
import { useCanvasStore } from "../hooks/use-canvas-store";
import { useTransformerSync } from "../hooks/use-transformer-sync";
import { useCanvasZoomPan } from "../hooks/use-canvas-zoom-pan";
import { useCanvasHotkeys } from "../hooks/use-canvas-hotkeys";

type PointerPosition = { x: number; y: number };

interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const ZOOM_STEP = 1.1;

const isTransformerNode = (
  node: Konva.Node | null,
  transformer: Konva.Transformer | null
) => {
  if (!node || !transformer) {
    return false;
  }
  if (node === transformer) {
    return true;
  }
  let parent: Konva.Node | null = node.getParent();
  while (parent) {
    if (parent === transformer) {
      return true;
    }
    parent = (parent.getParent() as Konva.Node | null) ?? null;
  }
  return false;
};

const getCornerRadius = (block: IEditorBlocks) => {
  const radius = block.radius;
  if (!radius) {
    return 0;
  }
  const { tl = 0, tr = tl, br = tl, bl = tl } = radius;
  return [tl, tr, br, bl];
};

const getOpacity = (value?: number) => {
  if (typeof value !== "number") {
    return 1;
  }
  return Math.max(0, Math.min(1, value / 100));
};

const useImageElement = (src: string | undefined) => {
  const [image, setImage] = React.useState<HTMLImageElement | null>(null);

  React.useEffect(() => {
    if (!src) {
      setImage(null);
      return;
    }
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    const handleLoad = () => setImage(img);
    const handleError = () => setImage(null);
    img.addEventListener("load", handleLoad);
    img.addEventListener("error", handleError);
    return () => {
      img.removeEventListener("load", handleLoad);
      img.removeEventListener("error", handleError);
    };
  }, [src]);

  return image;
};

const getScaleWithFlip = (block: IEditorBlocks) => {
  const horizontal = block.flip?.horizontal ? -1 : 1;
  const vertical = block.flip?.vertical ? -1 : 1;
  return {
    scaleX: (block.scaleX ?? 1) * horizontal,
    scaleY: (block.scaleY ?? 1) * vertical,
  };
};

const getShadowProps = (block: IEditorBlocks) => {
  const shadow = block.shadow;
  if (!shadow?.enabled) {
    return {};
  }
  return {
    shadowColor: shadow.color,
    shadowOffsetX: shadow.offsetX ?? 0,
    shadowOffsetY: shadow.offsetY ?? 0,
    shadowBlur: shadow.blur ?? 0,
  };
};

const mapFillProps = (block: IEditorBlocks) => {
  const fill = block.background;
  if (!fill) {
    return {};
  }
  if (!fill.includes("gradient")) {
    return { fill };
  }
  return parseLinearGradientFill(fill, block.width, block.height);
};

const isBlockVisible = (block: IEditorBlocks) => block.visible !== false;

const toCanvasCoordinates = (
  stage: Konva.Stage,
  position: PointerPosition,
  zoom: number
) => {
  const stagePos = stage.position();
  return {
    x: (position.x - stagePos.x) / zoom,
    y: (position.y - stagePos.y) / zoom,
  };
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

const rectFromPoints = (
  start: PointerPosition,
  end: PointerPosition
): SelectionRect => ({
  x: Math.min(start.x, end.x),
  y: Math.min(start.y, end.y),
  width: Math.abs(end.x - start.x),
  height: Math.abs(end.y - start.y),
});

const blockIntersectsRect = (block: IEditorBlocks, rect: SelectionRect) => {
  const bx1 = block.x;
  const by1 = block.y;
  const bx2 = block.x + block.width;
  const by2 = block.y + block.height;

  const rx1 = rect.x;
  const ry1 = rect.y;
  const rx2 = rect.x + rect.width;
  const ry2 = rect.y + rect.height;

  return !(bx2 < rx1 || bx1 > rx2 || by2 < ry1 || by1 > ry2);
};

function FrameNode({
  block,
  onClick,
  onDragStart,
  onDragEnd,
  onHover,
  draggable,
}: {
  block: IEditorBlockFrame;
  onClick: (event: KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onDragStart: (event: KonvaEventObject<DragEvent>) => void;
  onDragEnd: (position: { x: number; y: number }) => void;
  onHover: (hovering: boolean) => void;
  draggable: boolean;
}) {
  const { scaleX, scaleY } = getScaleWithFlip(block);
  const fillProps = mapFillProps(block);
  const shadowProps = getShadowProps(block);

  return (
    <Rect
      id={blockNodeId(block.id)}
      name="canvas-node"
      x={block.x}
      y={block.y}
      width={block.width}
      height={block.height}
      rotation={block.rotation ?? 0}
      opacity={getOpacity(block.opacity)}
      cornerRadius={getCornerRadius(block)}
      stroke={block.border?.color}
      strokeWidth={block.border?.width}
      dash={block.border?.dash}
      scaleX={scaleX}
      scaleY={scaleY}
      visible={isBlockVisible(block)}
      onClick={onClick}
      onTap={onClick}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      {...fillProps}
      {...shadowProps}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={(event) => {
        const node = event.target;
        onDragEnd({ x: node.x(), y: node.y() });
      }}
      listening
      shadowForStrokeEnabled={false}
      perfectDrawEnabled={false}
    />
  );
}

function TextNode({
  block,
  onClick,
  onDragStart,
  onDragEnd,
  onHover,
  draggable,
}: {
  block: IEditorBlockText;
  onClick: (event: KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onDragStart: (event: KonvaEventObject<DragEvent>) => void;
  onDragEnd: (position: { x: number; y: number }) => void;
  onHover: (hovering: boolean) => void;
  draggable: boolean;
}) {
  const { scaleX, scaleY } = getScaleWithFlip(block);

  return (
    <KonvaText
      id={blockNodeId(block.id)}
      name="canvas-node"
      x={block.x}
      y={block.y}
      width={block.width}
      height={block.height}
      text={block.text}
      fill={block.color}
      fontSize={block.fontSize}
      fontFamily={block.font.family}
      fontStyle={block.font.weight === "400" ? "normal" : "bold"}
      letterSpacing={block.letterSpacing}
      lineHeight={block.lineHeight / block.fontSize}
      align={block.textAlign}
      rotation={block.rotation ?? 0}
      opacity={getOpacity(block.opacity)}
      visible={isBlockVisible(block)}
      scaleX={scaleX}
      scaleY={scaleY}
      draggable={draggable}
      onClick={onClick}
      onTap={onClick}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onDragStart={onDragStart}
      onDragEnd={(event) => {
        const node = event.target;
        onDragEnd({ x: node.x(), y: node.y() });
      }}
      listening
      perfectDrawEnabled={false}
    />
  );
}

function ImageNode({
  block,
  onClick,
  onDragStart,
  onDragEnd,
  onHover,
  draggable,
}: {
  block: IEditorBlockImage;
  onClick: (event: KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onDragStart: (event: KonvaEventObject<DragEvent>) => void;
  onDragEnd: (position: { x: number; y: number }) => void;
  onHover: (hovering: boolean) => void;
  draggable: boolean;
}) {
  const image = useImageElement(block.url);
  const { scaleX, scaleY } = getScaleWithFlip(block);
  const shadowProps = getShadowProps(block);

  if (!image || image.width === 0 || image.height === 0) {
    return null;
  }

  return (
    <KonvaImage
      id={blockNodeId(block.id)}
      name="canvas-node"
      x={block.x}
      y={block.y}
      width={block.width}
      height={block.height}
      image={image ?? undefined}
      opacity={getOpacity(block.opacity)}
      rotation={block.rotation ?? 0}
      scaleX={scaleX}
      scaleY={scaleY}
      cornerRadius={getCornerRadius(block)}
      listening
      draggable={draggable}
      onClick={onClick}
      onTap={onClick}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onDragStart={onDragStart}
      onDragEnd={(event) => {
        const node = event.target;
        onDragEnd({ x: node.x(), y: node.y() });
      }}
      visible={isBlockVisible(block)}
      {...shadowProps}
      perfectDrawEnabled={false}
    />
  );
}

function ArrowNode({
  block,
  onClick,
  onDragStart,
  onDragEnd,
  onHover,
  draggable,
}: {
  block: IEditorBlockArrow;
  onClick: (event: KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onDragStart: (event: KonvaEventObject<DragEvent>) => void;
  onDragEnd: (position: { x: number; y: number }) => void;
  onHover: (hovering: boolean) => void;
  draggable: boolean;
}) {
  const { scaleX, scaleY } = getScaleWithFlip(block);
  const shadowProps = getShadowProps(block);

  // Calculate bounding box and positioning using utility function
  const bounds = calculateArrowBounds(block);
  const groupPos = blockPositionToGroupPosition(block.x, block.y, block);

  return (
    <Group
      id={blockNodeId(block.id)}
      name="canvas-node"
      x={groupPos.x}
      y={groupPos.y}
      width={bounds.width}
      height={bounds.height}
      rotation={block.rotation ?? 0}
      scaleX={scaleX}
      scaleY={scaleY}
      opacity={getOpacity(block.opacity)}
      visible={isBlockVisible(block)}
      draggable={draggable}
      onClick={onClick}
      onTap={onClick}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onDragStart={onDragStart}
      onDragEnd={(event) => {
        const node = event.target;
        // Pass the Group's position directly - handleNodeDragEnd will calculate the offset
        onDragEnd({ x: node.x(), y: node.y() });
      }}
      listening
    >
      <KonvaArrow
        points={bounds.adjustedPoints}
        pointerLength={block.pointerLength ?? 20}
        pointerWidth={block.pointerWidth ?? 20}
        fill={block.fill ?? block.stroke ?? "#000000"}
        stroke={block.stroke ?? block.fill ?? "#000000"}
        strokeWidth={block.strokeWidth ?? 4}
        {...shadowProps}
        perfectDrawEnabled={false}
      />
    </Group>
  );
}

function HoverOutline({ block, zoom }: { block: IEditorBlocks; zoom: number }) {
  const { scaleX, scaleY } = getScaleWithFlip(block);

  // For arrow blocks, use the same bounding box calculation as the Group
  if (block.type === "arrow") {
    const arrowBlock = block as IEditorBlockArrow;
    const bounds = calculateArrowBounds(arrowBlock);
    const groupPos = blockPositionToGroupPosition(
      arrowBlock.x,
      arrowBlock.y,
      arrowBlock
    );

    return (
      <Rect
        x={groupPos.x}
        y={groupPos.y}
        width={bounds.width}
        height={bounds.height}
        rotation={block.rotation ?? 0}
        scaleX={scaleX}
        scaleY={scaleY}
        stroke="#6366f1"
        dash={[6 / zoom, 6 / zoom]}
        strokeWidth={1 / zoom}
        listening={false}
        opacity={0.8}
      />
    );
  }

  return (
    <Rect
      x={block.x}
      y={block.y}
      width={block.width}
      height={block.height}
      rotation={block.rotation ?? 0}
      scaleX={scaleX}
      scaleY={scaleY}
      stroke="#6366f1"
      dash={[6 / zoom, 6 / zoom]}
      strokeWidth={1 / zoom}
      listening={false}
      cornerRadius={getCornerRadius(block)}
      opacity={0.8}
    />
  );
}

function SelectionOutline({
  rect,
  zoom,
}: {
  rect: SelectionRect | null;
  zoom: number;
}) {
  if (!rect) {
    return null;
  }
  return (
    <Rect
      x={rect.x}
      y={rect.y}
      width={rect.width}
      height={rect.height}
      stroke="#4f46e5"
      dash={[4 / zoom, 4 / zoom]}
      strokeWidth={1 / zoom}
      fill="#4f46e510"
      listening={false}
    />
  );
}

function EditorCanvas() {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const stageRef = React.useRef<Konva.Stage | null>(null);
  const transformerRef = React.useRef<Konva.Transformer | null>(null);
  const selectionStartRef = React.useRef<PointerPosition | null>(null);
  const selectionChangedRef = React.useRef(false);
  const storeApi = editorStoreApi;

  const [selectionRect, setSelectionRect] =
    React.useState<SelectionRect | null>(null);
  const [previewSelectionIds, setPreviewSelectionIds] = React.useState<
    string[]
  >([]);
  const [isSelecting, setIsSelecting] = React.useState(false);
  const [editingText, setEditingText] = React.useState<{
    id: string;
    value: string;
    clientX: number;
    clientY: number;
    width: number;
    height: number;
    scale: number;
  } | null>(null);
  const [isStageDragging, setIsStageDragging] = React.useState(false);

  const {
    blocks,
    selectedIds,
    hoveredId,
    mode,
    isTextEditing,
    zoom,
    stagePosition,
    containerSize,
    size,
    background,
    setSelectedIds,
    setHoveredId,
    setStage,
    setStageZoom,
    setStagePosition,
    setCanvasContainerSize,
    setIsTextEditing,
    setMode,
    addFrameBlock,
    addTextBlock,
    addArrowBlock,
    deleteSelectedBlocks,
    setBlockPosition,
    updateBlockValues,
  } = useCanvasStore();

  const { applyZoom, handleWheel } = useCanvasZoomPan({
    stageRef,
    containerRef,
    stagePosition,
    zoom,
    containerSize,
    setStageZoom,
    setStagePosition,
  });

  const handleStageRef = React.useCallback(
    (node: Konva.Stage | null) => {
      stageRef.current = node;
      setStage(node);
    },
    [setStage]
  );

  useCanvasHotkeys({
    setMode,
    addFrameBlock,
    addTextBlock,
    addArrowBlock,
    deleteSelectedBlocks,
  });

  React.useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      const { width, height } = entry.contentRect;
      setCanvasContainerSize({ width, height });
    });
    const node = containerRef.current;
    if (node) {
      observer.observe(node);
    }
    return () => {
      if (node) {
        observer.unobserve(node);
      }
    };
  }, [setCanvasContainerSize]);

  useTransformerSync(stageRef, transformerRef, blocks, selectedIds);

  const updateSelection = React.useCallback(
    (updater: (current: string[]) => string[]) => {
      const current = storeApi.getState().selectedIds;
      const next = updater(current);
      setSelectedIds(next);
    },
    [setSelectedIds, storeApi]
  );

  const handleNodeSelection = React.useCallback(
    (block: IEditorBlocks, evt: KonvaEventObject<MouseEvent | TouchEvent>) => {
      evt.cancelBubble = true;
      if (!isBlockVisible(block)) {
        return;
      }
      const isMulti = evt.evt.shiftKey;
      setHoveredId(block.id);
      if (isMulti) {
        updateSelection((current) => {
          if (current.includes(block.id)) {
            return current;
          }
          return [...current, block.id];
        });
      } else {
        setSelectedIds([block.id]);
      }
    },
    [setHoveredId, setSelectedIds, updateSelection]
  );

  const commitSelectionRect = React.useCallback(() => {
    setIsSelecting(false);
    setSelectionRect(null);
    selectionStartRef.current = null;
    setPreviewSelectionIds([]);
  }, []);

  const handleStageMouseDown = React.useCallback(
    (event: KonvaEventObject<MouseEvent>) => {
      const stage = stageRef.current;
      if (!stage) {
        return;
      }
      if (mode === "move") {
        return;
      }
      const target = event.target;
      const transformer = transformerRef.current;
      if (isTransformerNode(target, transformer)) {
        return;
      }
      const isCanvasNode = target.hasName("canvas-node");
      if (isCanvasNode) {
        return;
      }
      if (!event.evt.shiftKey) {
        setSelectedIds([]);
      }
      setPreviewSelectionIds([]);
      const pointer = getPointerPosition(stage);
      if (!pointer) {
        return;
      }
      selectionChangedRef.current = false;
      const canvasPoint = toCanvasCoordinates(stage, pointer, zoom);
      selectionStartRef.current = canvasPoint;
      setSelectionRect({
        x: canvasPoint.x,
        y: canvasPoint.y,
        width: 0,
        height: 0,
      });
      setIsSelecting(true);
    },
    [mode, setSelectedIds, zoom]
  );

  const handleStageMouseMove = React.useCallback(() => {
    if (!isSelecting) {
      setPreviewSelectionIds([]);
      return;
    }
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    const pointer = getPointerPosition(stage);
    if (!pointer || !selectionStartRef.current) {
      return;
    }
    const canvasPoint = toCanvasCoordinates(stage, pointer, zoom);
    const rect = rectFromPoints(selectionStartRef.current, canvasPoint);
    setSelectionRect(rect);
    const previewIds = blocks
      .filter(
        (block) => isBlockVisible(block) && blockIntersectsRect(block, rect)
      )
      .map((block) => block.id);
    setPreviewSelectionIds(previewIds);
  }, [blocks, isSelecting, zoom]);

  const handleStageMouseUp = React.useCallback(() => {
    if (!isSelecting || !selectionRect) {
      commitSelectionRect();
      return;
    }
    const newSelection = blocks
      .filter(
        (block) =>
          isBlockVisible(block) && blockIntersectsRect(block, selectionRect)
      )
      .map((block) => block.id);
    updateSelection((current) => {
      if (current.length === 0) {
        selectionChangedRef.current = newSelection.length > 0;
        return newSelection;
      }
      const merged = new Set(current);
      newSelection.forEach((id) => merged.add(id));
      selectionChangedRef.current = newSelection.length > 0;
      return Array.from(merged);
    });
    commitSelectionRect();
  }, [
    blocks,
    commitSelectionRect,
    isSelecting,
    selectionRect,
    updateSelection,
  ]);

  const handleStageClick = React.useCallback(
    (event: KonvaEventObject<MouseEvent>) => {
      const stage = stageRef.current;
      if (!stage) {
        return;
      }
      if (selectionChangedRef.current) {
        selectionChangedRef.current = false;
        return;
      }
      const target = event.target;
      const transformer = transformerRef.current;
      if (isTransformerNode(target, transformer)) {
        return;
      }
      if (!target.hasName("canvas-node")) {
        setSelectedIds([]);
        setPreviewSelectionIds([]);
      }
    },
    [setSelectedIds]
  );

  const handleStageDragMove = React.useCallback(
    (event: KonvaEventObject<DragEvent>) => {
      const stage = stageRef.current;
      if (!stage || event.target !== stage) {
        return;
      }
      setStagePosition({ x: stage.x(), y: stage.y() });
    },
    [setStagePosition]
  );

  const handleStageDragEnd = React.useCallback(
    (event: KonvaEventObject<DragEvent>) => {
      const stage = stageRef.current;
      if (!stage || event.target !== stage) {
        return;
      }
      setStagePosition({ x: stage.x(), y: stage.y() });
      setIsStageDragging(false);
    },
    [setStagePosition]
  );

  const handleStageDragStart = React.useCallback(
    (event: KonvaEventObject<DragEvent>) => {
      const stage = stageRef.current;
      if (!stage || event.target !== stage) {
        return;
      }
      setIsStageDragging(true);
    },
    []
  );

  const handleNodeDragEnd = React.useCallback(
    (id: string, position: { x: number; y: number }) => {
      const block = blocks.find((b) => b.id === id);
      if (block?.type === "arrow") {
        const arrowBlock = block as IEditorBlockArrow;
        // Convert Group position back to block position
        const blockPos = groupPositionToBlockPosition(
          position.x,
          position.y,
          arrowBlock
        );
        setBlockPosition(id, blockPos);
      } else {
        setBlockPosition(id, position);
      }
    },
    [setBlockPosition, blocks]
  );

  const handleTransformEnd = React.useCallback(() => {
    const transformer = transformerRef.current;
    if (!transformer) {
      return;
    }
    const nodes = transformer.nodes();
    nodes.forEach((node) => {
      const id = node.id().replace("block-", "");
      const block = blocks.find((b) => b.id === id);
      if (!block) {
        return;
      }
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      const rotation = node.rotation();
      const width = Math.max(1, node.width() * scaleX);
      const height = Math.max(1, node.height() * scaleY);
      node.scaleX(1);
      node.scaleY(1);

      // For arrow blocks, we need to scale only the stem length, not the arrowhead
      if (block.type === "arrow") {
        const arrowBlock = block as IEditorBlockArrow;

        // Calculate scale based on the bounding box diagonal change
        // This gives us a more accurate scale for the arrow length
        const originalDiagonal = Math.sqrt(
          arrowBlock.width * arrowBlock.width +
            arrowBlock.height * arrowBlock.height
        );
        const newDiagonal = Math.sqrt(width * width + height * height);
        const scale = originalDiagonal > 0 ? newDiagonal / originalDiagonal : 1;

        // Scale the arrow points (stem length only, arrowhead size stays constant)
        const newPoints = scaleArrowPoints(arrowBlock, scale);

        // Create a temporary block with new points to calculate new bounds
        const tempBlock: IEditorBlockArrow = {
          ...arrowBlock,
          points: newPoints,
        };
        const newBounds = calculateArrowBounds(tempBlock);

        // Convert Group position back to block position
        const blockPos = groupPositionToBlockPosition(
          node.x(),
          node.y(),
          tempBlock
        );

        updateBlockValues(id, {
          x: blockPos.x,
          y: blockPos.y,
          width: newBounds.width,
          height: newBounds.height,
          rotation,
          points: newPoints,
          // Keep arrowhead size constant - don't update pointerLength or pointerWidth
        });
      } else {
        updateBlockValues(id, {
          x: node.x(),
          y: node.y(),
          width,
          height,
          rotation,
        });
      }
    });
  }, [updateBlockValues, blocks]);

  const handleStartTextEdit = React.useCallback(
    (block: IEditorBlockText) => {
      const container = containerRef.current;
      const stage = stageRef.current;
      if (!container || !stage) {
        return;
      }
      const rect = container.getBoundingClientRect();
      const position = stagePosition ?? stage.position();
      const scale = zoom;
      setEditingText({
        id: block.id,
        value: block.text,
        clientX: rect.left + position.x + block.x * scale,
        clientY: rect.top + position.y + block.y * scale,
        width: block.width * scale,
        height: block.height * scale,
        scale,
      });
      setIsTextEditing(true);
      setSelectedIds([block.id]);
    },
    [setIsTextEditing, setSelectedIds, stagePosition, zoom]
  );

  const commitTextEdit = React.useCallback(() => {
    if (!editingText) {
      return;
    }
    const block = storeApi.getState().blocksById[editingText.id];
    if (!block || block.type !== "text") {
      setEditingText(null);
      setIsTextEditing(false);
      return;
    }
    const value = editingText.value;
    const lines = value.split(/\n/).length;
    const newHeight = Math.max(block.lineHeight, lines * block.lineHeight);
    updateBlockValues(block.id, {
      text: value,
      height: newHeight,
    });
    setEditingText(null);
    setIsTextEditing(false);
  }, [editingText, setIsTextEditing, storeApi, updateBlockValues]);

  const zoomIn = React.useCallback(() => {
    applyZoom(zoom * ZOOM_STEP);
  }, [applyZoom, zoom]);

  const zoomOut = React.useCallback(() => {
    applyZoom(zoom / ZOOM_STEP);
  }, [applyZoom, zoom]);

  const resetZoom = React.useCallback(() => {
    applyZoom(1, { x: containerSize.width / 2, y: containerSize.height / 2 });
  }, [applyZoom, containerSize.height, containerSize.width]);

  const isMoveMode = mode === "move";

  const editingBlock = React.useMemo(() => {
    if (!editingText) {
      return null;
    }
    return (
      (storeApi.getState().blocksById[editingText.id] as
        | IEditorBlockText
        | undefined) ?? null
    );
  }, [editingText, storeApi]);

  return (
    <div ref={containerRef} className="relative flex-1 canvas-stage">
      <Stage
        ref={handleStageRef}
        width={containerSize.width}
        height={containerSize.height}
        scaleX={zoom}
        scaleY={zoom}
        x={stagePosition?.x ?? 0}
        y={stagePosition?.y ?? 0}
        draggable={isMoveMode && !isTextEditing}
        onDragStart={handleStageDragStart}
        onDragMove={handleStageDragMove}
        onDragEnd={handleStageDragEnd}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onClick={handleStageClick}
        onWheel={handleWheel}
        onMouseLeave={() => setHoveredId(null)}
        style={{
          cursor: isMoveMode
            ? isTextEditing
              ? "default"
              : isStageDragging
              ? "grabbing"
              : "grab"
            : "default",
        }}
      >
        <Layer listening={false}>
          <Rect
            x={0}
            y={0}
            width={size.width}
            height={size.height}
            fill={background ?? "#ffffff"}
            stroke="#d4d4d8"
            strokeWidth={1}
          />
        </Layer>

        <Layer>
          {blocks.map((block) => {
            const handleHover = (hovering: boolean) => {
              if (hovering) {
                setHoveredId(block.id);
              } else if (hoveredId === block.id) {
                setHoveredId(null);
              }
            };

            const dragHandlers = {
              onDragStart: (evt: KonvaEventObject<DragEvent>) => {
                evt.cancelBubble = true;
                setHoveredId(block.id);
                updateSelection((current) => {
                  if (current.includes(block.id)) {
                    return current;
                  }
                  return [block.id];
                });
              },
              onDragEnd: (position: { x: number; y: number }) =>
                handleNodeDragEnd(block.id, position),
              onHover: handleHover,
              draggable: !isMoveMode && !isTextEditing,
            };
            const handleBlockClick = (
              evt: KonvaEventObject<MouseEvent | TouchEvent>
            ) => handleNodeSelection(block, evt);

            const isPreviewed =
              !selectedIds.includes(block.id) &&
              previewSelectionIds.includes(block.id);

            let content: React.ReactNode = null;
            if (block.type === "frame") {
              content = (
                <FrameNode
                  key={block.id}
                  block={block as IEditorBlockFrame}
                  onClick={handleBlockClick}
                  {...dragHandlers}
                />
              );
            } else if (block.type === "text") {
              content = (
                <Group key={block.id}>
                  <TextNode
                    block={block as IEditorBlockText}
                    {...dragHandlers}
                    onClick={(evt) => {
                      if (evt.evt.detail === 2) {
                        handleStartTextEdit(block as IEditorBlockText);
                        return;
                      }
                      handleNodeSelection(block, evt);
                    }}
                  />
                </Group>
              );
            } else if (block.type === "image") {
              content = (
                <ImageNode
                  key={block.id}
                  block={block as IEditorBlockImage}
                  onClick={handleBlockClick}
                  {...dragHandlers}
                />
              );
            } else if (block.type === "arrow") {
              content = (
                <ArrowNode
                  key={block.id}
                  block={block as IEditorBlockArrow}
                  onClick={handleBlockClick}
                  {...dragHandlers}
                />
              );
            }

            if (!content) {
              return null;
            }

            return (
              <React.Fragment key={block.id}>
                {content}
                {isPreviewed ? (
                  <HoverOutline block={block} zoom={zoom} />
                ) : null}
              </React.Fragment>
            );
          })}

          {hoveredId
            ? (() => {
                const block = blocks.find((item) => item.id === hoveredId);
                if (!block || selectedIds.includes(block.id)) {
                  return null;
                }
                return <HoverOutline block={block} zoom={zoom} />;
              })()
            : null}
        </Layer>

        <Layer listening={false}>
          <SelectionOutline rect={selectionRect} zoom={zoom} />
        </Layer>
        <Layer>
          {selectedIds.length > 0 && !isTextEditing ? (
            <Transformer
              ref={transformerRef}
              rotateEnabled
              onTransformEnd={handleTransformEnd}
              enabledAnchors={[
                "top-left",
                "top-center",
                "top-right",
                "middle-left",
                "middle-right",
                "bottom-left",
                "bottom-center",
                "bottom-right",
              ]}
            />
          ) : null}
        </Layer>
      </Stage>

      {editingText && editingBlock ? (
        <textarea
          style={{
            position: "fixed",
            left: editingText.clientX,
            top: editingText.clientY,
            width: editingText.width,
            minHeight: editingText.height,
            transformOrigin: "left top",
            zIndex: 30,
            fontSize: `${editingBlock.fontSize}px`,
            lineHeight: `${editingBlock.lineHeight}px`,
            fontFamily: editingBlock.font.family,
            fontWeight: editingBlock.font.weight,
            color: editingBlock.color,
            border: "1px solid #4f46e5",
            padding: "8px",
            outline: "none",
            background: "white",
          }}
          value={editingText.value}
          onChange={(event) =>
            setEditingText((prev) =>
              prev ? { ...prev, value: event.target.value } : prev
            )
          }
          onBlur={commitTextEdit}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setEditingText(null);
              setIsTextEditing(false);
            }
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              commitTextEdit();
            }
          }}
          autoFocus
        />
      ) : null}

      <ZoomHandler zoomIn={zoomIn} zoomOut={zoomOut} resetZoom={resetZoom} />
    </div>
  );
}

export default EditorCanvas;
