import type { IEditorBlockText, ITextTransform } from "@/lib/schema";
import ControllerRow from "../controller-row";
import { useEditorStore } from "@/components/canvas/use-editor";

interface TextTransformControlProps {
  blockId: string;
  block?: IEditorBlockText;
  className?: string;
}

function TextTransformControl({ blockId, block, className }: TextTransformControlProps) {
  const storeBlock = useEditorStore(
    (state) => state.blocksById[blockId] as IEditorBlockText | undefined
  );
  const resolvedBlock = block ?? storeBlock;
  const updateBlockValues = useEditorStore((state) => state.updateBlockValues);
  if (!resolvedBlock) {
    return null;
  }
  return (
    <ControllerRow label="Transform" className={className} contentClassName="justify-between">
      <select
        name="textTransform"
        id="textTransform"
        value={resolvedBlock.textTransform || "inherit"}
        onChange={(e) => {
          updateBlockValues(blockId, {
            textTransform: e.target.value as ITextTransform,
          });
        }}
        className="h-8 w-full rounded-md border border-border bg-background px-2 pr-6 text-xs appearance-none outline-hidden focus:border-primary focus:ring-1 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="inherit">Default</option>
        <option value="capitalize">Capitalize</option>
        <option value="uppercase">Uppercase</option>
        <option value="lowercase">Lowercase</option>
      </select>
    </ControllerRow>
  );
}

export default TextTransformControl;
