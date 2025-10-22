/* eslint-disable react/no-danger */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEventHandler,
  type HTMLAttributes,
} from "react";
import type { IEditorBlockText } from "../../editor-types";
import type { EditorContextType } from "../../use-editor";
import CommonBlock from "./common-block";

const placeCaretAtEnd = (element: HTMLElement) => {
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
};

function TextBlock({
  block,
  editor,
  style,
  ...props
}: {
  block: IEditorBlockText;
  editor: EditorContextType;
} & HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draftHtml, setDraftHtml] = useState(block.text);

  useEffect(() => {
    if (isEditing) {
      return;
    }
    setDraftHtml(block.text);
    if (ref.current && ref.current.innerHTML !== block.text) {
      ref.current.innerHTML = block.text;
    }
  }, [block.text, isEditing]);

  const maybeGrowHeight = useCallback(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    if (element.scrollHeight > element.clientHeight) {
      editor.setBlockSize(block.id, { height: element.scrollHeight + 2 });
    }
  }, [block.id, editor]);

  const finishEditing = useCallback(
    (nextHtml: string) => {
      setIsEditing(false);
      editor.setCanvasState({
        ...editor.canvasState,
        isTextEditing: false,
      });
      if (nextHtml !== block.text) {
        editor.updateBlockValues(block.id, {
          text: nextHtml,
        });
      }
    },
    [block.id, block.text, editor]
  );

  const handleDoubleClick = useCallback(() => {
    if (isEditing) {
      return;
    }
    const currentHtml = ref.current?.innerHTML ?? block.text;
    setDraftHtml(currentHtml);
    setIsEditing(true);
    editor.setCanvasState({
      ...editor.canvasState,
      isTextEditing: true,
    });
    requestAnimationFrame(() => {
      const element = ref.current;
      if (!element) {
        return;
      }
      if (element.innerHTML !== currentHtml) {
        element.innerHTML = currentHtml;
      }
      placeCaretAtEnd(element);
      element.focus();
    });
  }, [block.text, editor, isEditing]);

  const handleInput = useCallback(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    setDraftHtml(element.innerHTML);
    requestAnimationFrame(maybeGrowHeight);
  }, [maybeGrowHeight]);

  const handlePaste: ClipboardEventHandler<HTMLDivElement> = useCallback(
    (event) => {
      event.preventDefault();
      const text = event.clipboardData.getData("text/plain");
      const selection = window.getSelection();
      if (!selection?.rangeCount) {
        return;
      }
      selection.deleteFromDocument();
      const range = selection.getRangeAt(0);
      range.insertNode(document.createTextNode(text));
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
      handleInput();
    },
    [handleInput]
  );

  return (
    <CommonBlock
      ref={ref}
      style={{
        ...(style ?? {}),
        wordWrap: "break-word",
        color: block.color,
        fontFamily: `${block.font.family}, san-serif`,
        fontWeight: block.font.weight,
        fontSize: `${block.fontSize}px`,
        lineHeight: `${block.lineHeight}px`,
        letterSpacing: `${block.letterSpacing}px`,
        textAlign: block.textAlign,
        ...(block?.textTransform
          ? {
              textTransform: block.textTransform,
            }
          : {}),
        ...(block?.textDecoration
          ? {
              textDecoration: block.textDecoration,
            }
          : {}),
      }}
      editor={editor}
      contentEditable={isEditing}
      suppressContentEditableWarning
      {...props}
      onDoubleClick={handleDoubleClick}
      onBlur={() => finishEditing(ref.current?.innerHTML ?? draftHtml)}
      onInput={handleInput}
      onPaste={handlePaste}
      dangerouslySetInnerHTML={
        isEditing ? undefined : { __html: block.text }
      }
      block={block}
    />
  );
}

export default TextBlock;
