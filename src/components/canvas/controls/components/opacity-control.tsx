import { NumberInput } from "@/components/ui/input";
import ControllerRow from "./controller-row";
import { useEditorStore } from "@/components/canvas/use-editor";

interface OpacityControlProps {
  blockId: string;
  className?: string;
}

function OpacityControl({ blockId, className }: OpacityControlProps) {
  const block = useEditorStore((state) => state.blocksById[blockId]);
  const updateBlockValues = useEditorStore((state) => state.updateBlockValues);
  if (!block) {
    return null;
  }
  return (
    <ControllerRow label="Opacity" className={className} contentClassName="gap-3">
      <NumberInput
        min={0}
        max={100}
        value={block.opacity}
        onChange={(e) => {
          updateBlockValues(blockId, {
            opacity: e,
          });
        }}
      />
      <input
        type="range"
        className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-foreground/10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-[10px] [&::-webkit-slider-thumb]:h-[10px] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer"
        value={block.opacity ?? 0}
        max={100}
        min={0}
        onChange={(event) => {
          updateBlockValues(blockId, {
            opacity: Number.parseInt(event.target.value, 10),
          });
        }}
      />
    </ControllerRow>
  );
}

export default OpacityControl;
