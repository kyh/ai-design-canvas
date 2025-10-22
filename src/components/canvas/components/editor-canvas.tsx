/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import Selecto from "react-selecto";
import Moveable from "react-moveable";
import InfiniteViewer from "react-infinite-viewer";
import { cn } from "@/lib/utils";
import type { EditorContextType } from "../use-editor";
import TextBlock from "./blocks/text-block";
import FrameBlock from "./blocks/frame-block";
import { EditorDimensionViewable } from "./block-extensions";
import ZoomHandler from "./zoomable";
import type {
  IEditorBlockFrame,
  IEditorBlockImage,
  IEditorBlockText,
  IEditorBlocks,
} from "../editor-types";
import ImageBlock from "./blocks/img-block";
import { calculateDefaultZoom } from "../utils";

const MOVEABLE_DIRECTIONS = [
  "nw",
  "n",
  "ne",
  "w",
  "e",
  "sw",
  "s",
  "se",
] as const;

const buildBlockTransform = (block: IEditorBlocks) => {
  const transforms = [`translate(${block.x}px, ${block.y}px)`];
  if (block?.flip?.verticle) {
    transforms.push("scaleY(-1)");
  }
  if (block?.flip?.horizontal) {
    transforms.push("scaleX(-1)");
  }
  if (block.rotate?.type === "2d") {
    transforms.push(`rotate(${block.rotate?.value ?? 0}deg)`);
  } else if (block.rotate?.type === "3d") {
    transforms.push(
      `rotateX(${block.rotate?.valueX ?? 0}deg)`,
      `rotateY(${block.rotate?.valueY ?? 0}deg)`,
      `rotateZ(${block.rotate?.valueZ ?? 0}deg)`
    );
  }
  return transforms.join(" ");
};

function EditorCanvas({ editor }: { editor: EditorContextType }) {
  const canvasWrapperRef = React.useRef<HTMLDivElement>(null);
  const infiniteViewerRef = React.useRef<InfiniteViewer>(null);
  const moveableRef = React.useRef<Moveable>(null);
  const selectoRef = React.useRef<Selecto>(null);
  const [dimensionVisible, setDimensionVisible] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);

  React.useEffect(() => {
    infiniteViewerRef.current?.scrollCenter();
  }, []);

  React.useEffect(() => {
    if (editor.canvasState.mode === "move") {
      editor.setHoveredBlockId(null);
    }
  }, [editor.canvasState.mode, editor.setHoveredBlockId]);

  const hoverOverlayStyle = React.useMemo<React.CSSProperties | undefined>(() => {
    if (
      !editor.hoveredBlockId ||
      editor.canvasState.mode === "move" ||
      editor.canvasState.isTextEditing ||
      isDragging
    ) {
      return undefined;
    }

    const block = editor.blocks.find((item) => item.id === editor.hoveredBlockId);
    if (!block || !block.visible) {
      return undefined;
    }

    if (
      editor.selectedBlocks.length === 1 &&
      editor.selectedBlocks[0]?.id === block.id
    ) {
      return undefined;
    }

    return {
      display: "block",
      width: block.width,
      height: block.height,
      transform: buildBlockTransform(block),
    };
  }, [
    editor.blocks,
    editor.canvasState.isTextEditing,
    editor.canvasState.mode,
    editor.hoveredBlockId,
    editor.selectedBlocks,
    isDragging,
  ]);

  React.useEffect(() => {
    const container = canvasWrapperRef.current;
    if (!container) {
      return;
    }
    const defaultZoom = calculateDefaultZoom(
      editor.canvasState.size.width,
      editor.canvasState.size.height,
      container
    );
    infiniteViewerRef.current?.setZoom(defaultZoom);
    infiniteViewerRef.current?.scrollCenter();
    editor.setCanvasState({
      ...editor.canvasState,
      zoom: defaultZoom,
    });
  }, []);

  const renderDirections = React.useMemo(() => {
    const defaultDirections = [...MOVEABLE_DIRECTIONS];
    if (editor.selectedBlocks.length !== 1) {
      return defaultDirections;
    }
    const selectedId = editor.selectedBlocks[0]?.id;
    if (!selectedId) {
      return defaultDirections;
    }
    const block = editor.blocks.find((item) => item.id === selectedId);
    if (!block) {
      return defaultDirections;
    }
    return defaultDirections.filter((direction) => {
      if (block.height < 60 && (direction === "w" || direction === "e")) {
        return false;
      }
      if (block.width < 60 && (direction === "n" || direction === "s")) {
        return false;
      }
      return true;
    });
  }, [editor.blocks, editor.selectedBlocks]);

  const visibleBlocks = React.useMemo(
    () => editor.blocks.filter((block) => block.visible),
    [editor.blocks]
  );

  return (
    <div ref={canvasWrapperRef} className="flex-1 w-full h-full relative">
      <InfiniteViewer
        ref={infiniteViewerRef}
        useMouseDrag={editor.canvasState.mode === "move"}
        useAutoZoom
        className={cn(
          `infinite-viewer w-full h-full bg-gray-50 editor-canvas-scroll ${editor.canvasState.mode}`,
          {
            "cursor-grab": editor.canvasState.mode === "move",
          }
        )}
        zoomRange={[0.3, 5]}
        zoom={editor.canvasState.zoom}
        onPinch={(e) => {
          editor.setCanvasState({ ...editor.canvasState, zoom: e.zoom });
        }}
      >
        <div
          style={{
            height: editor.canvasState.size.height,
            width: editor.canvasState.size.width,
          }}
          className="editor-canvas relative shadow-normal"
        >
          <div className="hovered" style={hoverOverlayStyle} />
          <div
            ref={editor.canvasRef}
            className="relative w-full h-full overflow-hidden"
          >
            <div
              className="absolute top-0 left-0 w-full h-full"
              style={{
                background: editor.canvasState.background,
              }}
            />
            {visibleBlocks.map((block, index) => {
              const layerStyle = { zIndex: index + 2 };

              if (block.type === "text") {
                return (
                  <TextBlock
                    key={block.id}
                    block={block as IEditorBlockText}
                    editor={editor}
                    style={layerStyle}
                  />
                );
              }
              if (block.type === "image") {
                return (
                  <ImageBlock
                    key={block.id}
                    block={block as IEditorBlockImage}
                    editor={editor}
                    style={layerStyle}
                  />
                );
              }
              if (block.type === "frame") {
                return (
                  <FrameBlock
                    key={block.id}
                    block={block as IEditorBlockFrame}
                    editor={editor}
                    style={layerStyle}
                  />
                );
              }
              return null;
            })}
          </div>
          <Moveable
            target={editor.selectedBlocks}
            ref={moveableRef}
            keepRatio={
              editor.selectedBlocks.length === 1 &&
              editor.selectedBlocks?.[0]?.classList?.contains(
                "editor-block-image"
              )
            }
            draggable={
              editor.canvasState.mode !== "move" &&
              !editor.canvasState.isTextEditing
            }
            ables={[EditorDimensionViewable]}
            props={{
              dimensionViewable: true,
              dimensionVisible,
            }}
            zoom={1 / editor.canvasState.zoom}
            rotationPosition="none"
            resizable={
              editor.selectedBlocks.length < 2 &&
              editor.canvasState.mode !== "move" &&
              !editor.canvasState.isTextEditing
            }
            rotatable={
              editor.selectedBlocks.length < 2 &&
              editor.canvasState.mode !== "move" &&
              !editor.canvasState.isTextEditing
            }
            origin={false}
            useResizeObserver
            useMutationObserver
            snappable={
              editor.canvasState.mode !== "move" &&
              !editor.canvasState.isTextEditing
            }
            snapContainer=".editor-canvas"
            snapDirections={{
              top: true,
              left: true,
              bottom: true,
              right: true,
              center: true,
              middle: true,
            }}
            elementSnapDirections={{
              middle: true,
              center: true,
              top: true,
              left: true,
              bottom: true,
              right: true,
            }}
            isDisplaySnapDigit={false}
            snapThreshold={5}
            elementGuidelines={[
              ".editor-canvas",
              ...editor.blocks.map(({ id }) => `.block-${id}`),
            ]}
            onDrag={(e) => {
              e.target.style.transform = e.transform;
            }}
            onDragStart={() => {
              setIsDragging(true);
              editor.setHoveredBlockId(null);
            }}
            onDragGroup={(e) => {
              e.events.forEach((ev) => {
                ev.target.style.transform = ev.transform;
              });
            }}
            onClickGroup={(e) => {
              selectoRef.current!.clickTarget(e.inputEvent, e.inputTarget);
            }}
            renderDirections={renderDirections}
            onResize={(e) => {
              const { height } = e;
              const { width } = e;
              e.target.style.width = `${width}px`;
              e.target.style.height = `${height}px`;
              e.target.style.transform = e.drag.transform;
            }}
            onResizeStart={() => {
              editor.setHoveredBlockId(null);
              setDimensionVisible(true);
              setIsDragging(true);
            }}
            onDragEnd={(e) => {
              const target = e.target as HTMLElement;
              const { id } = target;
              const matrix = new DOMMatrixReadOnly(target.style.transform);
              editor.setBlockPosition(id, {
                x: matrix.m41,
                y: matrix.m42,
              });
              setIsDragging(false);
            }}
            onResizeEnd={(e) => {
              setDimensionVisible(false);
              setIsDragging(false);
              const target = e.target as HTMLElement;
              const { id } = target;
              editor.setBlockSize(id, {
                width: parseFloat(target.style.width),
                height: parseFloat(target.style.height),
              });
            }}
            // onDragGroupEnd={e => {
            //   e.events.forEach(ev => {
            //     const target = ev.target as HTMLElement;
            //     const { id } = target;
            //     const block = editor.blocks.find(b => b.id === id);
            //     if (block) {
            //       block.x = parseFloat(target.style.left);
            //       block.y = parseFloat(target.style.top);
            //     }
            //   });
            // }}
          />
        </div>
      </InfiniteViewer>
      {editor.canvasState.mode !== "move" && (
        <Selecto
          ref={selectoRef}
          dragContainer=".editor-canvas-scroll"
          selectableTargets={[".editor-block"]}
          selectByClick
          hitRate={0}
          ratio={0}
          selectFromInside={false}
          toggleContinueSelect={["shift"]}
          onDragStart={(e) => {
            const moveable = moveableRef.current!;
            const { target } = e.inputEvent;
            if (
              moveable.isMoveableElement(target) ||
              editor.selectedBlocks.some(
                (t) => t === target || t.contains(target)
              )
            ) {
              e.stop();
            }
          }}
          onSelect={(e) => {
            if (e.isDragStartEnd) {
              return;
            }
            editor.setSelectedBlocks(e.selected);
          }}
          onSelectEnd={(e) => {
            const moveable = moveableRef.current!;
            if (e.isDragStart) {
              e.inputEvent.preventDefault();

              moveable.waitToChangeTarget().then(() => {
                moveable.dragStart(e.inputEvent);
              });
            }
            editor.setSelectedBlocks(e.selected);
          }}
        />
      )}
      <ZoomHandler
        zoomIn={() => {
          const value = (infiniteViewerRef?.current?.getZoom() || 1) + 0.2;
          if (value > 2) {
            return;
          }
          infiniteViewerRef?.current?.setZoom(value);
          infiniteViewerRef.current!.scrollCenter();
          editor.setCanvasState({
            ...editor.canvasState,
            zoom: value,
          });
        }}
        zoomOut={() => {
          const value = (infiniteViewerRef?.current?.getZoom() || 1) - 0.2;
          if (value < 0.3) {
            return;
          }
          infiniteViewerRef?.current?.setZoom(value);
          infiniteViewerRef.current!.scrollCenter();
          editor.setCanvasState({
            ...editor.canvasState,
            zoom: value,
          });
        }}
        resetZoom={() => {
          infiniteViewerRef?.current?.setZoom(1);
          infiniteViewerRef.current!.scrollCenter();
          editor.setCanvasState({ ...editor.canvasState, zoom: 1 });
        }}
      />
    </div>
  );
}

export default EditorCanvas;
