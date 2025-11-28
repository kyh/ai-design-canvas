import BorderControl from "./components/border-control";
import ControllerBox from "./components/controller-box";
import ColorControl from "./components/color-control";
import RadiusControl from "./components/radius-control";
import ShadowControl from "./components/shadow-control";
import FlipControl from "./components/flip-control";
import OpacityControl from "./components/opacity-control";
import { useEditorStore } from "@/components/canvas/use-editor";

function LayerController({
  blockId,
  className,
}: {
  blockId: string;
  className?: string;
}) {
  const block = useEditorStore((state) => state.blocksById[blockId]);
  const updateBlockValues = useEditorStore((state) => state.updateBlockValues);
  if (!block) {
    return null;
  }

  if (block.type === "draw") {
    return (
      <ControllerBox title="Layer" className={className}>
        <ColorControl
          name="Color"
          value={block.stroke}
          onChange={(value) => {
            updateBlockValues(blockId, {
              stroke: value,
            });
          }}
          className="justify-between"
          disableGradient
        />
      </ControllerBox>
    );
  }
  return (
    <ControllerBox title="Layer" className={className}>
      <ColorControl
        name="Fill"
        value={block?.background}
        onChange={(e) => {
          updateBlockValues(blockId, {
            background: e,
          });
        }}
        className="justify-between"
      />
      <BorderControl blockId={blockId} />
      <ShadowControl blockId={blockId} />
      <RadiusControl blockId={blockId} />
      <OpacityControl blockId={blockId} />
      <FlipControl blockId={blockId} />
    </ControllerBox>
  );
}

export default LayerController;
