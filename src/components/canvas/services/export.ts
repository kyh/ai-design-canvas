import type Konva from "konva";
import type {
  IEditorBlocks,
  IEditorSize,
  IEditorBlockArrow,
} from "@/lib/schema";
import { loadFontsForBlocks } from "./fonts";
import {
  calculateArrowBounds,
  blockPositionToGroupPosition,
} from "../utils/arrow-bounds";
import { blockNodeId } from "../utils";

/**
 * Padding to add around selected blocks when exporting (in pixels)
 */
const EXPORT_PADDING = 20;

/**
 * Conversion factor from degrees to radians
 */
const DEG_TO_RAD = Math.PI / 180;

/**
 * Gets the default pixel ratio for high-DPI displays
 * Safe for SSR - returns 1 if window is not available
 */
const getDefaultPixelRatio = (): number => {
  if (typeof window === "undefined") {
    return 1;
  }
  return window.devicePixelRatio || 1;
};

/**
 * Bounding box type for export calculations
 */
type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Calculates the bounding box for selected blocks from block data.
 * Handles all block types including arrows which require special calculation.
 * Includes EXPORT_PADDING around the bounds.
 */
export function calculateSelectedBlocksBounds(
  blocks: IEditorBlocks[],
  selectedIds: string[]
): Bounds | null {
  if (selectedIds.length === 0) {
    return null;
  }

  // Use Set for O(1) lookup performance
  const selectedIdsSet = new Set(selectedIds);
  const selectedBlocks = blocks.filter((block) => selectedIdsSet.has(block.id));
  if (selectedBlocks.length === 0) {
    return null;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const block of selectedBlocks) {
    let bounds: Bounds;

    if (block.type === "arrow") {
      const arrowBlock = block as IEditorBlockArrow;
      const arrowBounds = calculateArrowBounds(arrowBlock);
      const groupPos = blockPositionToGroupPosition(
        arrowBlock.x,
        arrowBlock.y,
        arrowBlock
      );
      // For arrows, use the group position and arrow bounds
      // We'll apply rotation/scale transforms below
      bounds = {
        x: groupPos.x,
        y: groupPos.y,
        width: arrowBounds.width,
        height: arrowBounds.height,
      };
    } else {
      bounds = {
        x: block.x,
        y: block.y,
        width: block.width,
        height: block.height,
      };
    }

    // Account for rotation and scale transforms
    const rotation = (block.rotation ?? 0) * DEG_TO_RAD;
    const scaleX = block.scaleX ?? 1;
    const scaleY = block.scaleY ?? 1;
    const flipX = block.flip?.horizontal ? -1 : 1;
    const flipY = block.flip?.vertical ? -1 : 1;
    const actualScaleX = scaleX * flipX;
    const actualScaleY = scaleY * flipY;

    // Calculate the four corners of the rectangle
    const w = bounds.width * Math.abs(actualScaleX);
    const h = bounds.height * Math.abs(actualScaleY);
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;

    // Corners relative to center (before rotation)
    const corners = [
      { x: -w / 2, y: -h / 2 },
      { x: w / 2, y: -h / 2 },
      { x: w / 2, y: h / 2 },
      { x: -w / 2, y: h / 2 },
    ];

    // Rotate corners and find bounds
    let blockMinX = Infinity;
    let blockMinY = Infinity;
    let blockMaxX = -Infinity;
    let blockMaxY = -Infinity;

    corners.forEach((corner) => {
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      const rotatedX = corner.x * cos - corner.y * sin;
      const rotatedY = corner.x * sin + corner.y * cos;
      const worldX = centerX + rotatedX;
      const worldY = centerY + rotatedY;

      blockMinX = Math.min(blockMinX, worldX);
      blockMinY = Math.min(blockMinY, worldY);
      blockMaxX = Math.max(blockMaxX, worldX);
      blockMaxY = Math.max(blockMaxY, worldY);
    });

    minX = Math.min(minX, blockMinX);
    minY = Math.min(minY, blockMinY);
    maxX = Math.max(maxX, blockMaxX);
    maxY = Math.max(maxY, blockMaxY);
  }

  return {
    x: minX - EXPORT_PADDING,
    y: minY - EXPORT_PADDING,
    width: maxX - minX + EXPORT_PADDING * 2,
    height: maxY - minY + EXPORT_PADDING * 2,
  };
}

/**
 * Waits for the next animation frame to ensure redraw is complete
 */
async function waitForRedraw(): Promise<void> {
  await new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(resolve);
    });
  });
}

/**
 * Calculates the bounding box from visible selected nodes
 */
function calculateVisibleNodesBounds(
  stage: Konva.Stage,
  selectedIds: string[],
  padding: number = EXPORT_PADDING
): Bounds | null {
  const selectedNodes = selectedIds
    .map((id) => stage.findOne(`#${blockNodeId(id)}`))
    .filter((node): node is Konva.Node => {
      return node != null && node.visible();
    });

  if (selectedNodes.length === 0) {
    return null;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  selectedNodes.forEach((node) => {
    const box = node.getClientRect();
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.width);
    maxY = Math.max(maxY, box.y + box.height);
  });

  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  };
}

/**
 * Hides the transformer, UI-only layers, and all non-selected blocks, returns restore function
 */
function hideNonSelectedElements(
  stage: Konva.Stage,
  selectedIds: string[],
  blocks: IEditorBlocks[]
): () => void {
  const visibilityStates = new Map<Konva.Node, boolean>();
  const layerVisibilityStates = new Map<Konva.Layer, boolean>();

  // Hide transformer
  const transformer = stage.findOne("Transformer");
  if (transformer) {
    visibilityStates.set(transformer, transformer.visible());
    transformer.visible(false);
  }

  // Hide layers that contain UI-only elements (hover outlines, selection outlines, placement previews)
  // Also hide the layer containing the transformer
  const layers = stage.getLayers();
  layers.forEach((layer) => {
    // Check if this layer contains any canvas-node elements
    const hasContentNodes = layer.find("canvas-node").length > 0;

    // Check if it has the transformer
    const hasTransformer = layer.find("Transformer").length > 0;

    // Hide transformer layer
    if (hasTransformer) {
      layerVisibilityStates.set(layer, layer.visible());
      layer.visible(false);
    }
    // Hide UI-only layers (hover outlines, selection outlines, etc.)
    // But keep the background layer (it has a Rect fill)
    else if (!hasContentNodes) {
      // Check if this is the background layer (has a Rect with fill)
      const rects = layer.find("Rect");
      const isBackgroundLayer = rects.some((rect) => {
        const fill = (rect as Konva.Rect).fill();
        return fill && fill !== "transparent";
      });

      // Only hide if it's not the background layer
      if (!isBackgroundLayer) {
        layerVisibilityStates.set(layer, layer.visible());
        layer.visible(false);
      }
    }
  });

  // Hide all blocks that aren't selected
  // Use Set for O(1) lookup performance
  const selectedIdsSet = new Set(selectedIds);

  // Find all nodes with IDs matching block-* pattern
  blocks.forEach((block) => {
    const nodeId = blockNodeId(block.id);
    const node = stage.findOne(`#${nodeId}`);

    if (node) {
      const isSelected = selectedIdsSet.has(block.id);
      const blockIsVisible = block.visible !== false;

      // Store original visibility state
      visibilityStates.set(node, node.visible());

      // Show only if selected AND the block's visible property is true
      node.visible(isSelected && blockIsVisible);
    }
  });

  // Hide any Rect elements that are hover/selection outlines
  // These are typically Rect elements with stroke but no fill
  const allRects = stage.find("Rect");
  const selectedBlockIds = new Set(selectedIds);

  allRects.forEach((rect) => {
    const rectName = rect.name();
    const rectId = rect.id();

    // Skip if it's part of a selected block (check if ID matches block-* pattern)
    const isBlockRect = rectId.startsWith("block-");
    if (isBlockRect) {
      const blockId = rectId.replace("block-", "");
      if (selectedBlockIds.has(blockId)) {
        return; // This is part of a selected block, keep it visible
      }
    }

    // If it's not a canvas-node, it might be an outline
    if (!rectName || rectName !== "canvas-node") {
      const fill = (rect as Konva.Rect).fill();
      const stroke = (rect as Konva.Rect).stroke();

      // Hide outlines (has stroke, no fill or transparent fill)
      // Also hide if it's the background canvas rect (we want to keep that, but it has a fill)
      if (stroke && (!fill || fill === "transparent")) {
        visibilityStates.set(rect, rect.visible());
        rect.visible(false);
      }
    }
  });

  // Force redraw and wait for it to complete
  stage.getLayers().forEach((layer) => layer.batchDraw());

  // Return restore function
  return () => {
    visibilityStates.forEach((wasVisible, node) => {
      node.visible(wasVisible);
    });
    layerVisibilityStates.forEach((wasVisible, layer) => {
      layer.visible(wasVisible);
    });
    stage.getLayers().forEach((layer) => layer.batchDraw());
  };
}

/**
 * Captures selected blocks as an image data URL.
 * If selectedIds is provided and not empty, only selected blocks are captured.
 * Otherwise, captures the entire canvas.
 *
 * This is the main reusable function for capturing canvas images,
 * suitable for both export and sending to AI backend.
 */
export const captureSelectedBlocksAsImage = async (
  stage: Konva.Stage | null,
  blocks: IEditorBlocks[],
  selectedIds: string[] = []
): Promise<string | null> => {
  if (!stage) {
    return null;
  }

  await loadFontsForBlocks(blocks);

  const hasSelection = selectedIds.length > 0;
  let bounds = hasSelection
    ? calculateSelectedBlocksBounds(blocks, selectedIds)
    : null;
  let restoreVisibility: (() => void) | null = null;

  try {
    // Hide transformer and non-selected blocks if exporting selection
    if (hasSelection && bounds) {
      restoreVisibility = hideNonSelectedElements(stage, selectedIds, blocks);
      await waitForRedraw();

      // Recalculate bounds from actual visible nodes to get precise bounds
      const visibleBounds = calculateVisibleNodesBounds(stage, selectedIds);
      if (visibleBounds) {
        bounds = visibleBounds;
      }
    }

    if (bounds) {
      // Export only the selected region
      return stage.toDataURL({
        pixelRatio: getDefaultPixelRatio(),
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      });
    }

    // Export entire canvas
    return stage.toDataURL({ pixelRatio: getDefaultPixelRatio() });
  } finally {
    // Restore visibility
    if (restoreVisibility) {
      restoreVisibility();
    }
  }
};

/**
 * @deprecated Use captureSelectedBlocksAsImage instead
 * Legacy function for backward compatibility
 */
export const captureStageAsImage = captureSelectedBlocksAsImage;

/**
 * Downloads the canvas or selected blocks as an image file.
 * Uses captureSelectedBlocksAsImage internally for the actual capture.
 */
export const downloadStageAsImage = async (
  stage: Konva.Stage,
  blocks: IEditorBlocks[],
  selectedIds: string[] = []
) => {
  const dataUrl = await captureSelectedBlocksAsImage(
    stage,
    blocks,
    selectedIds
  );

  if (!dataUrl) {
    return;
  }

  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = "canvas.png";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportCanvasAsJson = ({
  blocks,
  size,
  background,
}: {
  blocks: IEditorBlocks[];
  size: IEditorSize;
  background?: string;
}) => {
  const data = JSON.stringify(
    {
      blocks,
      size,
      background,
    },
    null,
    2
  );
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "canvas.json";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
