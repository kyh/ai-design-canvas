import * as React from "react";
import type { IEditorBlockText } from "@/lib/schema";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CaretDownIcon, Cross2Icon } from "@radix-ui/react-icons";
import { cn } from "@/lib/utils";
import ControllerRow from "../controller-row";
import { fontsList, fontWeights } from "./fonts";
import { useEditorStore } from "@/components/canvas/use-editor";

interface FontControlProps {
  blockId: string;
  block?: IEditorBlockText;
  className?: string;
}

const DEFAULT_WEIGHTS = [
  "100",
  "200",
  "300",
  "400",
  "500",
  "600",
  "700",
  "800",
  "900",
];

const findFont = (family?: string) =>
  family ? fontsList.find((font) => font.family === family) : undefined;

function FontControl({ blockId, block, className }: FontControlProps) {
  const storeBlock = useEditorStore(
    (state) => state.blocksById[blockId] as IEditorBlockText | undefined
  );
  const resolvedBlock = block ?? storeBlock;
  const updateBlockValues = useEditorStore((state) => state.updateBlockValues);
  const [open, setOpen] = React.useState(false);
  const [weights, setWeights] = React.useState<string[]>(DEFAULT_WEIGHTS);

  React.useEffect(() => {
    const block = resolvedBlock;
    if (!block || !block.font.family) {
      return;
    }
    let cancelled = false;

    const loadWeights = async () => {
      const font = findFont(block.font.family);
      if (!font) {
        if (!cancelled) {
          setWeights(DEFAULT_WEIGHTS);
        }
        return;
      }
      const loadedFont = await font.load();
      if (cancelled) {
        return;
      }
      const info = loadedFont.getInfo();
      const availableWeights = Object.keys(info?.fonts?.normal || {});
      const nextWeights = availableWeights.length ? availableWeights : DEFAULT_WEIGHTS;
      setWeights(nextWeights);
      if (!nextWeights.includes(block.font.weight) && nextWeights.length > 0) {
        const fallbackWeight = nextWeights.includes("400") ? "400" : nextWeights[0];
        if (fallbackWeight && fallbackWeight !== block.font.weight) {
          updateBlockValues(block.id, {
            font: {
              ...block.font,
              weight: fallbackWeight,
            },
          });
          await loadedFont.loadFont(undefined, {
            weights: [fallbackWeight],
          });
        }
      }
    };

    void loadWeights();

    return () => {
      cancelled = true;
    };
  }, [resolvedBlock, updateBlockValues]);

  if (!resolvedBlock) {
    return null;
  }

  const selectedFontFamily = resolvedBlock.font.family;
  const selectedFont = findFont(selectedFontFamily);

  const applyFontWeights = (
    family: string,
    fontWeightsList: string[],
    desiredWeight: string
  ) => {
    if (!resolvedBlock) {
      return;
    }
    setWeights(fontWeightsList);
    const nextWeight = fontWeightsList.includes(desiredWeight)
      ? desiredWeight
      : fontWeightsList.includes("400")
      ? "400"
      : fontWeightsList[0] ?? desiredWeight;

    updateBlockValues(blockId, {
      font: {
        ...resolvedBlock.font,
        family,
        weight: nextWeight,
      },
    });
  };

  const handleUpdateFontFamily = async (family: string) => {
    if (!resolvedBlock) {
      return;
    }
    const font = findFont(family);
    if (!font) {
      return;
    }
    const loadedFont = await font.load();
    const info = loadedFont.getInfo();
    const availableWeights = Object.keys(info?.fonts?.normal || {});
    applyFontWeights(
      family,
      availableWeights.length ? availableWeights : DEFAULT_WEIGHTS,
      resolvedBlock.font.weight
    );
    const targetWeight = resolvedBlock.font.weight;
    await loadedFont.loadFont(undefined, {
      weights: [targetWeight],
    });
    setOpen(false);
  };

  const handleWeightChange = async (family: string, weight: string) => {
    const font = findFont(family);
    if (!font) {
      return;
    }
    const loadedFont = await font.load();
    await loadedFont.loadFont(undefined, {
      weights: [weight],
    });
  };

  return (
    <>
      <ControllerRow
        label="Font"
        className={className}
        contentClassName="justify-between"
      >
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex h-7 w-full items-center justify-between rounded-md border border-border bg-muted px-2 text-xs transition hover:border-primary"
            >
              <span className="max-w-[140px] overflow-hidden text-ellipsis whitespace-nowrap">
                {selectedFont?.family ?? resolvedBlock.font.family ?? "Select"}
              </span>
              <CaretDownIcon className="h-3 w-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="center" side="left" className="w-[240px]">
            <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
              <p className="text-xs font-semibold">Fonts</p>
              <button
                type="button"
                className="rounded p-1 text-foreground/60 hover:bg-accent"
                onClick={() => setOpen(false)}
              >
                <Cross2Icon className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="max-h-72 overflow-auto">
              <div className="flex flex-col gap-1">
                {fontsList.map((font) => (
                  <button
                    key={font.family}
                    type="button"
                    className={cn(
                      "flex h-[28px] w-full items-center rounded-md px-2 text-left text-sm transition hover:bg-accent",
                      {
                        "bg-muted": font.family === selectedFontFamily,
                      }
                    )}
                    onClick={() => {
                      void handleUpdateFontFamily(font.family);
                    }}
                  >
                    <span className="block w-full overflow-hidden text-ellipsis whitespace-nowrap">
                      {font.family}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </ControllerRow>
      <ControllerRow label="Weight" contentClassName="justify-between">
        <select
          name="fontWeight"
          id="fontWeight"
          value={resolvedBlock.font?.weight}
          onChange={(event) => {
            const nextWeight = event.target.value || "400";
            updateBlockValues(blockId, {
              font: {
                ...resolvedBlock.font,
                weight: nextWeight,
              },
            });
            void handleWeightChange(resolvedBlock.font.family, nextWeight);
          }}
          disabled={weights.length < 2}
          className="h-8 w-full rounded-md border border-border bg-background px-2 pr-6 text-xs appearance-none outline-hidden focus:border-primary focus:ring-1 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {weights.map((weight) => (
            <option key={weight} value={weight}>
              {fontWeights.find((item) => item.value === weight)?.label || weight}
            </option>
          ))}
        </select>
      </ControllerRow>
    </>
  );
}

export default FontControl;
