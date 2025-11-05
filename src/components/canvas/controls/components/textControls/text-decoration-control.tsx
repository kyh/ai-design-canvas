import type { IEditorBlockText, ITextDecoration } from "@/lib/schema";
import ControllerRow from "../controller-row";
import { useEditorStore } from "@/components/canvas/use-editor";

interface TextDecorationControlProps {
  blockId: string;
  block?: IEditorBlockText;
  className?: string;
}

function TextDecorationControl({ blockId, block, className }: TextDecorationControlProps) {
  const storeBlock = useEditorStore(
    (state) => state.blocksById[blockId] as IEditorBlockText | undefined
  );
  const resolvedBlock = block ?? storeBlock;
  const updateBlockValues = useEditorStore((state) => state.updateBlockValues);
  if (!resolvedBlock) {
    return null;
  }
  return (
    <ControllerRow
      label="Decoration"
      className={className}
      contentClassName="justify-between"
    >
      <select
        name="textDecoration"
        id="textDecoration"
        value={resolvedBlock.textDecoration || "inherit"}
        onChange={(e) => {
          updateBlockValues(blockId, {
            textDecoration: e.target.value as ITextDecoration,
          });
        }}
        className="h-8 w-full rounded-md border border-border bg-background px-2 pr-6 text-xs appearance-none outline-hidden focus:border-primary focus:ring-1 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="inherit">Default</option>
        <option value="overline">Overline</option>
        <option value="line-through">Line Through</option>
        <option value="underline">Underline</option>
      </select>
    </ControllerRow>
  );
}

export default TextDecorationControl;
