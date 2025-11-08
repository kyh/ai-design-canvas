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
  IEditorBlockHtml,
  IEditorBlocks,
} from "@/lib/schema";
import {
  textBlockSchema,
  frameBlockSchema,
  imageBlockSchema,
  arrowBlockSchema,
  htmlBlockSchema,
} from "@/lib/schema";
import { generateId } from "@/lib/id-generator";
import ZoomHandler from "./zoomable";
import { parseLinearGradientFill, blockNodeId } from "../utils";
import {
  calculateArrowBounds,
  blockPositionToGroupPosition,
  groupPositionToBlockPosition,
  scaleArrowPoints,
} from "../utils/arrow-bounds";
import { editorStoreApi, selectOrderedBlocks } from "../use-editor";
import {
  ensureBlockDefaults,
  MAX_IMAGE_DIMENSION,
} from "../services/templates";
import { useCanvasStore } from "../hooks/use-canvas-store";
import { useTransformerSync } from "../hooks/use-transformer-sync";
import { useCanvasZoomPan } from "../hooks/use-canvas-zoom-pan";
import { useCanvasHotkeys } from "../hooks/use-canvas-hotkeys";
import { Html } from "react-konva-utils";

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

const HtmlContent = React.memo(
  ({ html }: { html: string }) => {
    return (
      <iframe
        srcDoc={html}
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          display: "block",
        }}
      />
    );
  },
  (prev, next) => prev.html === next.html
);

HtmlContent.displayName = "HtmlContent";

function HtmlNode({
  block,
  onClick,
  onDragStart,
  onDragEnd,
  onHover,
  draggable,
  isSelecting,
}: {
  block: IEditorBlockHtml;
  onClick: (event: KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onDragStart: (event: KonvaEventObject<DragEvent>) => void;
  onDragEnd: (position: { x: number; y: number }) => void;
  onHover: (hovering: boolean) => void;
  draggable: boolean;
  isSelecting: boolean;
}) {
  const { scaleX, scaleY } = getScaleWithFlip(block);
  const fillProps = mapFillProps(block);
  const shadowProps = getShadowProps(block);

  const htmlDivProps = React.useMemo(
    () => ({
      style: {
        width: `${block.width}px`,
        height: `${block.height}px`,
        padding: "8px",
        boxSizing: "border-box" as const,
        overflow: "visible" as const,
        pointerEvents: isSelecting ? ("none" as const) : ("auto" as const),
      },
    }),
    [block.width, block.height, isSelecting]
  );

  const htmlGroupProps = React.useMemo(() => ({ x: 0, y: 0 }), []);

  return (
    <Group
      id={blockNodeId(block.id)}
      name="canvas-node"
      x={block.x}
      y={block.y}
      width={block.width}
      height={block.height}
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
        onDragEnd({ x: node.x(), y: node.y() });
      }}
      listening
    >
      <Rect
        x={0}
        y={0}
        width={block.width}
        height={block.height}
        cornerRadius={getCornerRadius(block)}
        stroke={block.border?.color}
        strokeWidth={block.border?.width}
        dash={block.border?.dash}
        {...fillProps}
        {...shadowProps}
        perfectDrawEnabled={false}
      />
      <Html key={block.id} groupProps={htmlGroupProps} divProps={htmlDivProps}>
        <HtmlContent html={block.html} />
      </Html>
    </Group>
  );
}

// Helper to get outline bounds for any block type - ensures consistency
const getBlockOutlineBounds = (block: IEditorBlocks) => {
  if (block.type === "arrow") {
    const arrowBlock = block as IEditorBlockArrow;
    const bounds = calculateArrowBounds(arrowBlock);
    const groupPos = blockPositionToGroupPosition(
      arrowBlock.x,
      arrowBlock.y,
      arrowBlock
    );
    return {
      x: groupPos.x,
      y: groupPos.y,
      width: bounds.width,
      height: bounds.height,
    };
  }
  return {
    x: block.x,
    y: block.y,
    width: block.width,
    height: block.height,
  };
};

function HoverOutline({ block, zoom }: { block: IEditorBlocks; zoom: number }) {
  const { scaleX, scaleY } = getScaleWithFlip(block);
  const bounds = getBlockOutlineBounds(block);

  return (
    <Rect
      x={bounds.x}
      y={bounds.y}
      width={bounds.width}
      height={bounds.height}
      rotation={block.rotation ?? 0}
      scaleX={scaleX}
      scaleY={scaleY}
      stroke="#6366f1"
      dash={[6 / zoom, 6 / zoom]}
      strokeWidth={1 / zoom}
      listening={false}
      cornerRadius={block.type === "arrow" ? 0 : getCornerRadius(block)}
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

// Helper functions to calculate block placement - ensures preview and final placement match

const DEFAULT_BLOCK_SIZES = {
  text: { width: 320, height: 52 },
  frame: { width: 240, height: 240 },
  html: { width: 240, height: 240 },
  arrow: { width: 200, height: 0 }, // Arrow uses points, not width/height
} as const;

const calculateBlockPlacement = (
  start: PointerPosition,
  current: PointerPosition | null,
  blockType: "text" | "frame" | "image" | "html",
  isDrag: boolean,
  pendingImageData?: { url: string; width: number; height: number } | null
) => {
  if (!current) {
    return null;
  }

  const dx = current.x - start.x;
  const dy = current.y - start.y;

  let width: number;
  let height: number;
  let x: number;
  let y: number;

  if (isDrag) {
    width = Math.abs(dx);
    height = Math.abs(dy);
    x = Math.min(start.x, current.x);
    y = Math.min(start.y, current.y);

    // For images, maintain aspect ratio during drag
    if (blockType === "image" && pendingImageData) {
      const aspectRatio = pendingImageData.width / pendingImageData.height;
      if (Math.abs(dx) > Math.abs(dy)) {
        height = width / aspectRatio;
      } else {
        width = height * aspectRatio;
      }
    }
  } else {
    // Default sizes
    if (blockType === "text") {
      width = DEFAULT_BLOCK_SIZES.text.width;
      height = DEFAULT_BLOCK_SIZES.text.height;
    } else if (blockType === "frame") {
      width = DEFAULT_BLOCK_SIZES.frame.width;
      height = DEFAULT_BLOCK_SIZES.frame.height;
    } else if (blockType === "html") {
      width = DEFAULT_BLOCK_SIZES.html.width;
      height = DEFAULT_BLOCK_SIZES.html.height;
    } else if (blockType === "image" && pendingImageData) {
      const scale = Math.min(
        1,
        MAX_IMAGE_DIMENSION /
          Math.max(pendingImageData.width, pendingImageData.height)
      );
      width = Math.max(1, Math.round(pendingImageData.width * scale));
      height = Math.max(1, Math.round(pendingImageData.height * scale));
    } else {
      width = 100;
      height = 100;
    }
    x = start.x;
    y = start.y;
  }

  return { x, y, width, height };
};

const calculateArrowPlacement = (
  clickPosition: PointerPosition,
  points: [number, number, number, number]
) => {
  // Arrow points [0, 0, dx, dy] mean the arrow goes from (block.x, block.y) to (block.x + dx, block.y + dy)
  // We want the arrow start point to always be at clickPosition
  // So: block.x + offsetX + adjustedPoints[0] = clickPosition.x
  // Since adjustedPoints[0] = points[0] - offsetX = 0 - offsetX = -offsetX
  // We get: block.x + offsetX - offsetX = block.x = clickPosition.x
  // Therefore, block.x should equal clickPosition.x (not adjusted)

  const tempBlock: IEditorBlockArrow = {
    id: "",
    type: "arrow",
    label: "",
    x: clickPosition.x,
    y: clickPosition.y,
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

  // The arrow start point renders at: Group.x + adjustedPoints[0]
  // Where: Group.x = block.x + offsetX, and adjustedPoints[0] = points[0] - offsetX = -offsetX
  // So: arrow start = (block.x + offsetX) + (-offsetX) = block.x
  // We want the arrow start to be at clickPosition, so: block.x = clickPosition.x
  // But when we store the block, we need to account for the offset so it renders correctly
  // The stored block position should be: clickPosition (not adjusted)
  // This way when rendered: Group.x = clickPosition.x + offsetX, and arrow renders at clickPosition.x
  const blockX = clickPosition.x;
  const blockY = clickPosition.y;

  // For preview rendering, calculate group position that makes arrow start at clickPosition
  // Group.x = block.x + offsetX = clickPosition.x + offsetX
  // Arrow start = Group.x + adjustedPoints[0] = (clickPosition.x + offsetX) + (-offsetX) = clickPosition.x ✓
  const groupPos = blockPositionToGroupPosition(blockX, blockY, tempBlock);

  return {
    blockPosition: { x: blockX, y: blockY },
    groupPosition: groupPos,
    bounds,
    adjustedPoints: bounds.adjustedPoints,
  };
};

function PlacementPreview({
  mode,
  start,
  current,
  zoom,
  pendingImageData,
}: {
  mode: "text" | "frame" | "arrow" | "image" | "html";
  start: PointerPosition;
  current: PointerPosition | null;
  zoom: number;
  pendingImageData: { url: string; width: number; height: number } | null;
}) {
  if (!current) {
    return null;
  }

  const dx = current.x - start.x;
  const dy = current.y - start.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const isDrag = distance > 5;

  if (mode === "arrow") {
    const points: [number, number, number, number] = isDrag
      ? [0, 0, dx, dy]
      : [0, 0, 200, 0];
    const placement = calculateArrowPlacement(start, points);
    return (
      <Group
        x={placement.groupPosition.x}
        y={placement.groupPosition.y}
        opacity={0.5}
        listening={false}
      >
        <KonvaArrow
          points={placement.adjustedPoints}
          pointerLength={20}
          pointerWidth={20}
          fill="#000000"
          stroke="#000000"
          strokeWidth={4}
        />
      </Group>
    );
  }

  // For other block types, use shared calculation
  const placement = calculateBlockPlacement(
    start,
    current,
    mode as "text" | "frame" | "image" | "html",
    isDrag,
    pendingImageData
  );

  if (!placement) {
    return null;
  }

  const isFrameOrHtml = mode === "frame" || mode === "html";
  const fillProps = isFrameOrHtml ? { fill: "#ffffff" } : {};
  const strokeColor = isFrameOrHtml ? "#d1d5db" : "#6366f1";

  return (
    <Rect
      x={placement.x}
      y={placement.y}
      width={placement.width}
      height={placement.height}
      stroke={strokeColor}
      strokeWidth={1 / zoom}
      dash={[4 / zoom, 4 / zoom]}
      fill={isFrameOrHtml ? "#ffffff80" : "transparent"}
      cornerRadius={isFrameOrHtml ? 16 : 0}
      listening={false}
      opacity={0.5}
      {...fillProps}
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
  const [isPlacingBlock, setIsPlacingBlock] = React.useState(false);
  const [placementStart, setPlacementStart] =
    React.useState<PointerPosition | null>(null);
  const [placementCurrent, setPlacementCurrent] =
    React.useState<PointerPosition | null>(null);
  const [placementHasMoved, setPlacementHasMoved] = React.useState(false);
  const [pendingImageData, setPendingImageData] = React.useState<{
    url: string;
    width: number;
    height: number;
  } | null>(null);

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
    deleteSelectedBlocks,
    setBlockPosition,
    updateBlockValues,
  } = useCanvasStore();

  // Sync pendingImageData from store
  React.useEffect(() => {
    const store = editorStoreApi;
    const unsubscribe = store.subscribe((state) => {
      setPendingImageData(state.pendingImageData);
    });
    setPendingImageData(store.getState().pendingImageData);
    return unsubscribe;
  }, []);

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
    deleteSelectedBlocks,
  });

  // Mode helpers
  const isPlacementMode = React.useCallback(() => {
    return (
      mode === "text" ||
      mode === "frame" ||
      mode === "arrow" ||
      mode === "image" ||
      mode === "html"
    );
  }, [mode]);

  const isSelectMode = mode === "select";
  const isMoveMode = mode === "move";

  const createBlockAtPosition = React.useCallback(
    (
      position: PointerPosition,
      endPosition?: PointerPosition,
      size?: { width: number; height: number }
    ) => {
      const blockType = mode;
      const blocks = selectOrderedBlocks(storeApi.getState());

      if (blockType === "text") {
        // Use shared calculation for consistency
        const isDrag = !!size;
        const placement = calculateBlockPlacement(
          position,
          endPosition || position,
          "text",
          isDrag
        );
        if (!placement) return;

        const defaultBlock = ensureBlockDefaults(
          textBlockSchema.parse({
            id: generateId(),
            type: "text",
            label: `Text ${blocks.length + 1}`,
            x: placement.x,
            y: placement.y,
            width: placement.width,
            height: placement.height,
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
        storeApi.getState().addBlock(defaultBlock);
        setMode("select");
      } else if (blockType === "frame") {
        // Use shared calculation for consistency
        const isDrag = !!size;
        const placement = calculateBlockPlacement(
          position,
          endPosition || position,
          "frame",
          isDrag
        );
        if (!placement) return;

        const defaultBlock = ensureBlockDefaults(
          frameBlockSchema.parse({
            id: generateId(),
            type: "frame",
            label: `Frame ${blocks.length + 1}`,
            x: placement.x,
            y: placement.y,
            width: placement.width,
            height: placement.height,
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
        storeApi.getState().addBlock(defaultBlock);
        setMode("select");
      } else if (blockType === "arrow") {
        // Use same calculation as preview
        const points: [number, number, number, number] = size
          ? [0, 0, size.width, size.height]
          : [0, 0, 200, 0];
        const placement = calculateArrowPlacement(position, points);
        const blocks = selectOrderedBlocks(storeApi.getState());
        const defaultBlock = ensureBlockDefaults(
          arrowBlockSchema.parse({
            id: generateId(),
            type: "arrow",
            label: `Arrow ${blocks.length + 1}`,
            x: placement.blockPosition.x,
            y: placement.blockPosition.y,
            width: placement.bounds.width,
            height: placement.bounds.height,
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
          } satisfies IEditorBlockArrow)
        );
        storeApi.getState().addBlock(defaultBlock);
        setMode("select");
      } else if (blockType === "image" && pendingImageData) {
        // Use shared calculation for consistency
        const isDrag = !!size;
        const placement = calculateBlockPlacement(
          position,
          endPosition || position,
          "image",
          isDrag,
          pendingImageData
        );
        if (!placement) return;

        const defaultBlock = ensureBlockDefaults(
          imageBlockSchema.parse({
            id: generateId(),
            type: "image",
            label: `Image ${blocks.length + 1}`,
            x: placement.x,
            y: placement.y,
            width: placement.width,
            height: placement.height,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            url: pendingImageData.url,
            fit: "contain",
            position: "center",
            visible: true,
            opacity: 100,
          } satisfies IEditorBlockImage)
        );
        storeApi.getState().addBlock(defaultBlock);
        setPendingImageData(null);
        storeApi.getState().setPendingImageData(null);
        setMode("select");
      } else if (blockType === "html") {
        // Use shared calculation for consistency
        const isDrag = !!size;
        const placement = calculateBlockPlacement(
          position,
          endPosition || position,
          "html",
          isDrag
        );
        if (!placement) return;

        const defaultBlock = ensureBlockDefaults(
          htmlBlockSchema.parse({
            id: generateId(),
            type: "html",
            label: `HTML ${blocks.length + 1}`,
            x: placement.x,
            y: placement.y,
            width: placement.width,
            height: placement.height,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            html: `<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      margin: 0;
      padding: 8px;
      font-size: 14px;
      font-family: system-ui, sans-serif;
      color: #1f2937;
    }
    input {
      display: block;
      width: 100%;
      padding: 4px 8px;
      margin-top: 8px;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      font-size: 14px;
      font-family: system-ui, sans-serif;
      background-color: white;
      color: #1f2937;
      box-sizing: border-box;
    }
    input:focus {
      outline: none;
      border-color: #6366f1;
      box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
    }
  </style>
</head>
<body>
  <div>hello world</div>
  <input />
</body>
</html>`,
            background: "#ffffff",
            border: {
              color: "#d1d5db",
              width: 1,
            },
            radius: { tl: 16, tr: 16, br: 16, bl: 16 },
            visible: true,
            opacity: 100,
          } satisfies IEditorBlockHtml)
        );
        storeApi.getState().addBlock(defaultBlock);
        setMode("select");
      }
    },
    [mode, pendingImageData, setMode, storeApi]
  );

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
      if (!isBlockVisible(block) || !isSelectMode) {
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
    [setHoveredId, setSelectedIds, updateSelection, isSelectMode]
  );

  const commitSelectionRect = React.useCallback(() => {
    setIsSelecting(false);
    setSelectionRect(null);
    selectionStartRef.current = null;
    setPreviewSelectionIds([]);
  }, []);

  // Mode-specific handlers
  const handlePlacementMouseDown = React.useCallback(
    (stage: Konva.Stage, pointer: PointerPosition) => {
      const canvasPoint = toCanvasCoordinates(stage, pointer, zoom);
      setPlacementStart(canvasPoint);
      setPlacementCurrent(canvasPoint);
      setPlacementHasMoved(false);
      setIsPlacingBlock(true);
    },
    [zoom]
  );

  const handleSelectionMouseDown = React.useCallback(
    (stage: Konva.Stage, pointer: PointerPosition, shiftKey: boolean) => {
      if (!shiftKey) {
        setSelectedIds([]);
      }
      setPreviewSelectionIds([]);
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
    [setSelectedIds, zoom]
  );

  const handleStageMouseDown = React.useCallback(
    (event: KonvaEventObject<MouseEvent>) => {
      const stage = stageRef.current;
      if (!stage || isMoveMode) {
        return;
      }

      const target = event.target;
      const transformer = transformerRef.current;
      if (isTransformerNode(target, transformer)) {
        return;
      }

      const isCanvasNode = target.hasName("canvas-node");
      const pointer = getPointerPosition(stage);
      if (!pointer) {
        return;
      }

      // Handle placement mode - allow placement even on top of existing blocks
      if (isPlacementMode()) {
        handlePlacementMouseDown(stage, pointer);
        return;
      }

      // Handle selection mode
      if (!isSelectMode) {
        return;
      }

      // Don't start selection if clicking on a canvas node
      if (isCanvasNode) {
        return;
      }

      handleSelectionMouseDown(stage, pointer, event.evt.shiftKey);
    },
    [
      isMoveMode,
      isPlacementMode,
      isSelectMode,
      handlePlacementMouseDown,
      handleSelectionMouseDown,
    ]
  );

  const handleStageMouseMove = React.useCallback(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }

    // Handle placement drag
    if (isPlacingBlock && placementStart) {
      const pointer = getPointerPosition(stage);
      if (pointer) {
        const canvasPoint = toCanvasCoordinates(stage, pointer, zoom);
        setPlacementCurrent(canvasPoint);
        // Check if mouse has moved
        if (placementStart) {
          const dx = canvasPoint.x - placementStart.x;
          const dy = canvasPoint.y - placementStart.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance > 2) {
            setPlacementHasMoved(true);
          }
        }
      }
      return;
    }

    // Handle selection drag
    if (!isSelecting) {
      setPreviewSelectionIds([]);
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
  }, [blocks, isSelecting, zoom, isPlacingBlock, placementStart]);

  const handleStageMouseUp = React.useCallback(() => {
    // Handle placement completion
    if (isPlacingBlock && placementStart) {
      if (placementCurrent) {
        const dx = placementCurrent.x - placementStart.x;
        const dy = placementCurrent.y - placementStart.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // If moved more than 5 pixels, treat as drag; otherwise single click
        if (distance > 5) {
          // Drag: create block with custom size
          if (mode === "arrow") {
            // For arrows, use the drag vector directly
            createBlockAtPosition(placementStart, placementCurrent, {
              width: dx,
              height: dy,
            });
          } else {
            // For other blocks, pass start and end - helper will calculate position
            createBlockAtPosition(placementStart, placementCurrent, {
              width: Math.abs(dx),
              height: Math.abs(dy),
            });
          }
        } else {
          // Single click: create block with default size
          createBlockAtPosition(placementStart, placementStart);
        }
      } else {
        // Fallback: single click
        createBlockAtPosition(placementStart, placementStart);
      }

      setIsPlacingBlock(false);
      setPlacementStart(null);
      setPlacementCurrent(null);
      setPlacementHasMoved(false);
      return;
    }

    // Handle selection completion
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
    isPlacingBlock,
    placementStart,
    placementCurrent,
    mode,
    createBlockAtPosition,
  ]);

  const handleStageClick = React.useCallback(
    (event: KonvaEventObject<MouseEvent>) => {
      const stage = stageRef.current;
      if (!stage || !isSelectMode) {
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
    [setSelectedIds, isSelectMode]
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

  const handleTransform = React.useCallback(() => {
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

      // For text blocks, update width/height in real-time to prevent deformation
      if (block.type === "text") {
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        const newWidth = Math.max(1, node.width() * scaleX);
        const newHeight = Math.max(1, node.height() * scaleY);

        // Update the node's width/height directly to prevent text deformation
        node.width(newWidth);
        node.height(newHeight);
        node.scaleX(1);
        node.scaleY(1);
      }
    });
  }, [blocks]);

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
      const rotation = node.rotation();

      // For text blocks, width/height were already updated in handleTransform
      // so we can use them directly (scale is already 1)
      // We also reset scaleX/scaleY to 1 to prevent deformation
      if (block.type === "text") {
        const width = Math.max(1, node.width());
        const height = Math.max(1, node.height());
        updateBlockValues(id, {
          x: node.x(),
          y: node.y(),
          width,
          height,
          rotation,
          scaleX: 1,
          scaleY: 1,
        });
        return;
      }

      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
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
              if (!isSelectMode) {
                return;
              }
              if (hovering) {
                setHoveredId(block.id);
              } else if (hoveredId === block.id) {
                setHoveredId(null);
              }
            };

            const dragHandlers = {
              onDragStart: (evt: KonvaEventObject<DragEvent>) => {
                evt.cancelBubble = true;
                if (!isSelectMode) {
                  return;
                }
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
              draggable: isSelectMode && !isTextEditing,
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
            } else if (block.type === "html") {
              content = (
                <HtmlNode
                  key={block.id}
                  block={block as IEditorBlockHtml}
                  onClick={handleBlockClick}
                  {...dragHandlers}
                  isSelecting={isSelecting}
                />
              );
            }

            if (!content) {
              return null;
            }

            return (
              <React.Fragment key={block.id}>
                {content}
                {isPreviewed && isSelectMode ? (
                  <HoverOutline block={block} zoom={zoom} />
                ) : null}
              </React.Fragment>
            );
          })}

          {hoveredId && isSelectMode
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
          {isPlacingBlock &&
          placementStart &&
          placementHasMoved &&
          isPlacementMode() ? (
            <PlacementPreview
              mode={mode as "text" | "frame" | "arrow" | "image" | "html"}
              start={placementStart}
              current={placementCurrent}
              zoom={zoom}
              pendingImageData={pendingImageData}
            />
          ) : null}
        </Layer>
        <Layer>
          {selectedIds.length > 0 && !isTextEditing ? (
            <Transformer
              ref={transformerRef}
              rotateEnabled
              onTransform={handleTransform}
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
