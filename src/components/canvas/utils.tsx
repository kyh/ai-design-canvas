import {
  BoxIcon,
  ImageIcon,
  TextIcon,
  ArrowRightIcon,
} from "@radix-ui/react-icons";
import { Code as CodeIcon, Pencil } from "lucide-react";
import type { IEditorBlockType } from "@/lib/schema";

export function BlockIcon(type: IEditorBlockType) {
  switch (type) {
    case "text":
      return <TextIcon />;
    case "frame":
      return <BoxIcon />;
    case "image":
      return <ImageIcon />;
    case "arrow":
      return <ArrowRightIcon />;
    case "html":
      return <CodeIcon />;
    case "draw":
      return <Pencil className="h-4 w-4" />;
    default:
      return <BoxIcon />;
  }
}

export const blockNodeId = (blockId: string) => `block-${blockId}`;

export const calculateDefaultZoom = (
  canvasWidth: number,
  canvasHeight: number,
  container: HTMLDivElement
) => {
  const containerWidth = container.clientWidth - 50;
  const containerHeight = container.clientHeight - 50;

  if (
    containerWidth <= 0 ||
    containerHeight <= 0 ||
    canvasWidth < containerWidth ||
    canvasHeight < containerHeight
  ) {
    return 1;
  }

  const widthRatio = containerWidth / canvasWidth;
  const heightRatio = containerHeight / canvasHeight;

  // Calculate the minimum ratio to fit the canvas in the container
  const minRatio = Math.min(widthRatio, heightRatio);

  // Calculate the default zoom level
  const defaultZoom = Math.floor(minRatio * 100);

  return defaultZoom / 100;
};

const splitGradientArgs = (input: string) => {
  const args: string[] = [];
  let buffer = "";
  let depth = 0;
  for (const char of input) {
    if (char === "(") {
      depth += 1;
      buffer += char;
      continue;
    }
    if (char === ")") {
      depth = Math.max(0, depth - 1);
      buffer += char;
      continue;
    }
    if (char === "," && depth === 0) {
      args.push(buffer.trim());
      buffer = "";
      continue;
    }
    buffer += char;
  }
  if (buffer.trim()) {
    args.push(buffer.trim());
  }
  return args;
};

const parseStop = (value: string, index: number, total: number) => {
  const colorMatch = value.match(
    /(rgba?\([^\)]+\)|#[0-9a-fA-F]{3,8}|hsl\([^\)]+\)|hsla\([^\)]+\)|[a-zA-Z]+)/
  );
  const color = colorMatch ? colorMatch[0].trim() : value.trim();
  const remainder = value.replace(color, "").trim();
  let offset: number;
  if (remainder.endsWith("%")) {
    offset = Number.parseFloat(remainder) / 100;
  } else if (remainder.length === 0) {
    if (total === 1) {
      offset = 0;
    } else {
      offset = index / (total - 1);
    }
  } else {
    offset = Number.parseFloat(remainder);
    if (Number.isNaN(offset)) {
      offset = total === 1 ? 0 : index / (total - 1);
    }
  }
  return { color, offset: Math.min(Math.max(offset, 0), 1) } as const;
};

const angleToPoints = (angleDeg: number, width: number, height: number) => {
  const angleRad = ((90 - angleDeg) * Math.PI) / 180;
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const diagonal = Math.sqrt(width * width + height * height);
  const distance = diagonal / 2;
  const dx = Math.cos(angleRad) * distance;
  const dy = Math.sin(angleRad) * distance;
  return {
    start: { x: halfWidth - dx, y: halfHeight - dy },
    end: { x: halfWidth + dx, y: halfHeight + dy },
  };
};

export const parseLinearGradientFill = (
  value: string,
  width: number,
  height: number
) => {
  const match = value.match(/linear-gradient\((.*)\)/i);
  if (!match) {
    return { fill: value };
  }
  const inner = match[1];
  const parts = splitGradientArgs(inner);
  if (!parts.length) {
    return { fill: value };
  }
  let angle = 180;
  const first = parts[0];
  const directionMatch = first.match(/^to\s+([a-z\s]+)/i);
  if (directionMatch) {
    const dir = directionMatch[1].trim().toLowerCase();
    if (dir === "right") angle = 90;
    else if (dir === "left") angle = 270;
    else if (dir === "bottom") angle = 180;
    else if (dir === "top") angle = 0;
    else if (dir === "top right" || dir === "right top") angle = 45;
    else if (dir === "bottom right" || dir === "right bottom") angle = 135;
    else if (dir === "bottom left" || dir === "left bottom") angle = 225;
    else if (dir === "top left" || dir === "left top") angle = 315;
    parts.shift();
  } else {
    const angleMatch = first.match(/(-?\d+(?:\.\d+)?)deg/);
    if (angleMatch) {
      angle = Number.parseFloat(angleMatch[1]);
      parts.shift();
    }
  }
  const stops = parts.length ? parts : [first];
  const parsedStops = stops.map((stop, index) =>
    parseStop(stop, index, stops.length)
  );
  const colorStops: (number | string)[] = [];
  parsedStops.forEach((stop) => {
    colorStops.push(stop.offset, stop.color);
  });
  const { start, end } = angleToPoints(angle, width, height);
  return {
    fillLinearGradientStartPoint: start,
    fillLinearGradientEndPoint: end,
    fillLinearGradientColorStops: colorStops,
  } as const;
};
