import { ChevronDown } from "lucide-react";
import type { Key } from "react-aria-components";
import { Button, ListBox, ListBoxItem, Popover, Select, SelectValue } from "react-aria-components";

export interface SortOption {
  id: string;
  label: string;
}

interface SortSelectProps {
  items: SortOption[];
  selectedKey: string;
  onSelectionChange: (key: string) => void;
  "aria-label": string;
  placeholder?: string;
}

export function SortSelect({
  items,
  selectedKey,
  onSelectionChange,
  "aria-label": ariaLabel,
  placeholder = "Sort by",
}: SortSelectProps) {
  return (
    <Select
      aria-label={ariaLabel}
      selectedKey={selectedKey}
      onSelectionChange={(key: Key | null) => {
        if (key !== null) onSelectionChange(key as string);
      }}
    >
      <Button className="press-scale-sm flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs tracking-wide text-muted-foreground transition-colors data-[hovered]:bg-muted data-[hovered]:text-foreground data-[pressed]:bg-muted data-[pressed]:text-foreground data-[focused]:border-ring">
        <SelectValue className="normal-case font-semibold data-[placeholder]:text-muted-foreground">
          {({ defaultChildren }) => defaultChildren || placeholder}
        </SelectValue>
        <ChevronDown size={14} className="shrink-0" aria-hidden="true" />
      </Button>
      <Popover
        shouldFlip
        className="w-[var(--trigger-width)] min-w-36 overflow-y-auto rounded-lg border border-border bg-popover shadow-popover data-[placement=bottom]:origin-top data-[placement=top]:origin-bottom entering:animate-in entering:fade-in-0 entering:zoom-in-95 exiting:animate-out exiting:fade-out-0 exiting:zoom-out-95"
      >
        <div className="px-3.5 pt-2.5 pb-1 text-[11px] tracking-wide text-faint">Sort by</div>
        <ListBox items={items} className="p-1.5">
          {(item) => (
            <ListBoxItem
              id={item.id}
              textValue={item.label}
              className="press-scale-sm-y cursor-default rounded-sm px-3.5 py-2 text-[13px] tracking-wide text-foreground outline-none data-[hovered]:bg-popover-hover data-[pressed]:bg-popover-hover data-[focused]:bg-popover-hover data-[selected]:bg-popover-selected data-[selected]:font-medium"
            >
              {item.label}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </Select>
  );
}
