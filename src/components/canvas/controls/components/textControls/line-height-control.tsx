import { NumberInput } from "@/components/ui/input";
import ControllerRow from "../controller-row";
import { useEditorStore } from "@/components/canvas/use-editor";
import type { IEditorBlockText } from "@/lib/schema";

interface LineHeightControlProps {
  blockId: string;
  block?: IEditorBlockText;
  className?: string;
}

function LineHeightControl({ blockId, block, className }: LineHeightControlProps) {
  const storeBlock = useEditorStore(
    (state) => state.blocksById[blockId] as IEditorBlockText | undefined
  );
  const resolvedBlock = block ?? storeBlock;
  const updateBlockValues = useEditorStore((state) => state.updateBlockValues);

  const onChange = (value: number) => {
    if (!resolvedBlock) {
      return;
    }
    const linesApprox = Math.max(1, resolvedBlock.height / resolvedBlock.lineHeight);
    const newHeight = Math.round(linesApprox * value);
    updateBlockValues(blockId, {
      lineHeight: value,
      height: newHeight,
    });
  };

  if (!resolvedBlock) {
    return null;
  }

  return (
    <ControllerRow label="Line" className={className} contentClassName="gap-3">
      <NumberInput min={0} max={500} value={resolvedBlock.lineHeight} onChange={onChange} />
      <input
        type="range"
        className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-foreground/10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-[10px] [&::-webkit-slider-thumb]:h-[10px] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer"
        value={resolvedBlock.lineHeight}
        max={100}
        min={5}
        onChange={(event) => {
          onChange(Number.parseInt(event.target.value, 10));
        }}
      />
    </ControllerRow>
  );
}

export default LineHeightControl;
