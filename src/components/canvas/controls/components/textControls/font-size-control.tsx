import { NumberInput } from "@/components/ui/input";
import ControllerRow from "../controller-row";
import { useEditorStore } from "@/components/canvas/use-editor";
import type { IEditorBlockText } from "@/lib/schema";

interface FontSizeControlProps {
  blockId: string;
  block?: IEditorBlockText;
  className?: string;
}

function FontSizeControl({ blockId, block, className }: FontSizeControlProps) {
  const storeBlock = useEditorStore(
    (state) => state.blocksById[blockId] as IEditorBlockText | undefined
  );
  const resolvedBlock = block ?? storeBlock;
  const updateBlockValues = useEditorStore((state) => state.updateBlockValues);

  const onChange = (value: number) => {
    if (!resolvedBlock) {
      return;
    }
    const lineHeightRatio = resolvedBlock.lineHeight / resolvedBlock.fontSize;
    const newLineHeight = Math.round(lineHeightRatio * value);
    const linesApprox = Math.max(1, resolvedBlock.height / resolvedBlock.lineHeight);
    const newHeight = Math.round(linesApprox * newLineHeight);
    updateBlockValues(blockId, {
      fontSize: value,
      lineHeight: newLineHeight,
      height: newHeight,
    });
  };

  if (!resolvedBlock) {
    return null;
  }

  return (
    <ControllerRow label="Size" className={className} contentClassName="gap-3">
      <NumberInput min={0} max={500} value={resolvedBlock.fontSize} onChange={onChange} />
      <input
        type="range"
        className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-foreground/10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-[10px] [&::-webkit-slider-thumb]:h-[10px] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer"
        value={resolvedBlock.fontSize}
        max={100}
        min={5}
        onChange={(event) => {
          const next = Number.parseInt(event.target.value, 10);
          onChange(next);
        }}
      />
    </ControllerRow>
  );
}

export default FontSizeControl;
