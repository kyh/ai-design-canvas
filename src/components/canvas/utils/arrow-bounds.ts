import type { IEditorBlockArrow } from "@/lib/schema";

/**
 * Calculates the bounding box for an arrow block, accounting for:
 * - The arrow line segment (from points[0,1] to points[2,3])
 * - The arrowhead extension (pointerLength in the direction of the arrow)
 * - The arrowhead width (pointerWidth perpendicular to the arrow direction)
 * - The stroke width
 *
 * Returns the bounding box dimensions, position offsets, and adjusted points
 * that should be used for rendering the arrow within a Group.
 */
export interface ArrowBounds {
  /** Width of the bounding box */
  width: number;
  /** Height of the bounding box */
  height: number;
  /** X offset from block.x to the Group's x position (adjustedMinX) */
  offsetX: number;
  /** Y offset from block.y to the Group's y position (adjustedMinY) */
  offsetY: number;
  /** Points adjusted to be relative to the Group's origin (0,0) */
  adjustedPoints: [number, number, number, number];
  /** The original points (for reference) */
  originalPoints: [number, number, number, number];
}

export function calculateArrowBounds(
  block: IEditorBlockArrow
): ArrowBounds {
  const pointerLength = block.pointerLength ?? 20;
  const pointerWidth = block.pointerWidth ?? 20;
  const strokeWidth = block.strokeWidth ?? 4;
  const points: [number, number, number, number] = [
    block.points[0],
    block.points[1],
    block.points[2],
    block.points[3],
  ];

  // Calculate arrow direction vector
  const dx = points[2] - points[0];
  const dy = points[3] - points[1];
  const length = Math.sqrt(dx * dx + dy * dy);
  const isHorizontal = Math.abs(dx) > Math.abs(dy);

  // Normalize direction vector
  const dirX = length > 0 ? dx / length : 1;
  const dirY = length > 0 ? dy / length : 0;

  // Calculate base bounding box from points
  const minX = Math.min(points[0], points[2]);
  const maxX = Math.max(points[0], points[2]);
  const minY = Math.min(points[1], points[3]);
  const maxY = Math.max(points[1], points[3]);

  // Arrowhead extends in the direction of the arrow (from end point)
  // The end point is the one with larger X (if horizontal) or larger Y (if vertical)
  const endPointX = dx >= 0 ? points[2] : points[0];
  const endPointY = dy >= 0 ? points[3] : points[1];

  // Calculate arrowhead extension
  const arrowheadExtendX = dirX * pointerLength;
  const arrowheadExtendY = dirY * pointerLength;

  // Calculate final bounding box including arrowhead
  const finalMinX = Math.min(minX, endPointX + Math.min(0, arrowheadExtendX));
  const finalMaxX = Math.max(maxX, endPointX + Math.max(0, arrowheadExtendX));
  const finalMinY = Math.min(minY, endPointY + Math.min(0, arrowheadExtendY));
  const finalMaxY = Math.max(maxY, endPointY + Math.max(0, arrowheadExtendY));

  // Add padding for arrowhead width (perpendicular to arrow direction)
  const arrowWidth = Math.max(1, finalMaxX - finalMinX);
  const arrowHeight = Math.max(1, finalMaxY - finalMinY);

  // For horizontal arrows, add arrowhead width to height; for vertical, add to width
  const finalWidth = isHorizontal ? arrowWidth : arrowWidth + pointerWidth;
  const finalHeight = isHorizontal
    ? Math.max(arrowHeight, pointerWidth, strokeWidth)
    : arrowHeight;

  // Calculate padding needed for arrowhead width (centered)
  const widthPadding = isHorizontal ? 0 : pointerWidth / 2;
  const heightPadding = isHorizontal
    ? Math.max(pointerWidth, strokeWidth) / 2
    : 0;

  // Adjust bounding box to include padding
  const adjustedMinX = finalMinX - widthPadding;
  const adjustedMinY = finalMinY - heightPadding;

  // Adjust points to be relative to the Group's origin (top-left of bounding box)
  const adjustedPoints: [number, number, number, number] = [
    points[0] - adjustedMinX,
    points[1] - adjustedMinY,
    points[2] - adjustedMinX,
    points[3] - adjustedMinY,
  ];

  return {
    width: finalWidth,
    height: finalHeight,
    offsetX: adjustedMinX,
    offsetY: adjustedMinY,
    adjustedPoints,
    originalPoints: points,
  };
}

/**
 * Converts a Group position (which includes the offset) back to the block position.
 * This is used when dragging or transforming arrows.
 */
export function groupPositionToBlockPosition(
  groupX: number,
  groupY: number,
  block: IEditorBlockArrow
): { x: number; y: number } {
  const bounds = calculateArrowBounds(block);
  return {
    x: groupX - bounds.offsetX,
    y: groupY - bounds.offsetY,
  };
}

/**
 * Converts a block position to the Group position (which includes the offset).
 * This is used when positioning the Group for rendering.
 */
export function blockPositionToGroupPosition(
  blockX: number,
  blockY: number,
  block: IEditorBlockArrow
): { x: number; y: number } {
  const bounds = calculateArrowBounds(block);
  return {
    x: blockX + bounds.offsetX,
    y: blockY + bounds.offsetY,
  };
}

/**
 * Scales an arrow's points while keeping the start point fixed.
 * Used when resizing arrows - only the stem length changes, not the arrowhead size.
 */
export function scaleArrowPoints(
  block: IEditorBlockArrow,
  scale: number
): [number, number, number, number] {
  const originalDx = block.points[2] - block.points[0];
  const originalDy = block.points[3] - block.points[1];

  const newDx = originalDx * scale;
  const newDy = originalDy * scale;

  return [
    block.points[0], // Start point stays the same
    block.points[1], // Start point stays the same
    block.points[0] + newDx, // New end point
    block.points[1] + newDy, // New end point
  ];
}

