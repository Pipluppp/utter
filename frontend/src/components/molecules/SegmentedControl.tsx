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
      className="press-scale-sm relative z-10 cursor-default px-3 py-1 text-xs uppercase tracking-wide text-muted-foreground outline-none not-selected:hover:text-foreground selected:text-background"
    >
      {composeRenderProps(props.children, (children) => (
        <>
          <SelectionIndicator className="absolute inset-0 z-0 rounded-full bg-foreground transition-all duration-200 ease-out" />
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
      className="inline-flex rounded-full border border-border transition-colors hover:border-muted-foreground"
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
