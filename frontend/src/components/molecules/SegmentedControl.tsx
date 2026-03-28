import type { Key } from "react-aria-components";
import {
  SelectionIndicator,
  ToggleButton,
  ToggleButtonGroup,
  composeRenderProps,
  type ToggleButtonProps,
} from "react-aria-components";

export interface SegmentedControlItem {
  id: string;
  label: string;
}

function SegmentedControlButton(props: ToggleButtonProps) {
  return (
    <ToggleButton
      {...props}
      className="press-scale-sm relative z-10 cursor-default rounded-full px-3 py-1.5 text-xs uppercase tracking-wide text-muted-foreground outline-none not-data-[selected]:data-[hovered]:bg-muted not-data-[selected]:data-[hovered]:text-foreground not-data-[selected]:data-[pressed]:bg-muted not-data-[selected]:data-[pressed]:text-foreground data-[selected]:text-background"
    >
      {composeRenderProps(props.children, (children) => (
        <>
          <SelectionIndicator className="absolute inset-0 z-0 rounded-full bg-foreground" />
          <span className="relative z-10">{children}</span>
        </>
      ))}
    </ToggleButton>
  );
}

interface SegmentedControlProps {
  items: SegmentedControlItem[];
  selectedKey: string;
  onSelectionChange: (key: string) => void;
  "aria-label": string;
}

export function SegmentedControl({
  items,
  selectedKey,
  onSelectionChange,
  "aria-label": ariaLabel,
}: SegmentedControlProps) {
  return (
    <ToggleButtonGroup
      className="inline-flex rounded-full border border-border"
      aria-label={ariaLabel}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={new Set([selectedKey])}
      onSelectionChange={(keys: Set<Key>) => {
        const key = [...keys][0];
        if (key != null) onSelectionChange(String(key));
      }}
    >
      {items.map((item) => (
        <SegmentedControlButton key={item.id} id={item.id}>
          {item.label}
        </SegmentedControlButton>
      ))}
    </ToggleButtonGroup>
  );
}
