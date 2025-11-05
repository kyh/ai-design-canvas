import { NumberInput } from "@/components/ui/input";
import ControllerRow from "../controller-row";
import { useEditorStore } from "@/components/canvas/use-editor";
import type { IEditorBlockText } from "@/lib/schema";

interface LetterSpacingControlProps {
  blockId: string;
  block?: IEditorBlockText;
  className?: string;
}

function LetterSpacingControl({ blockId, block, className }: LetterSpacingControlProps) {
  const storeBlock = useEditorStore(
    (state) => state.blocksById[blockId] as IEditorBlockText | undefined
  );
  const resolvedBlock = block ?? storeBlock;
  const updateBlockValues = useEditorStore((state) => state.updateBlockValues);

  const onChange = (value: number) => {
    if (!resolvedBlock) {
      return;
    }
    updateBlockValues(blockId, {
      letterSpacing: value,
    });
  };

  if (!resolvedBlock) {
    return null;
  }

  return (
    <ControllerRow label="Spacing" className={className} contentClassName="gap-3">
      <NumberInput min={-5} max={200} value={resolvedBlock.letterSpacing} onChange={onChange} />
      <input
        type="range"
        className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-foreground/10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-[10px] [&::-webkit-slider-thumb]:h-[10px] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer"
        value={resolvedBlock.letterSpacing}
        max={50}
        min={0}
        onChange={(event) => {
          onChange(Number.parseInt(event.target.value, 10));
        }}
      />
    </ControllerRow>
  );
}

export default LetterSpacingControl;
