import type { Key } from "react-aria-components";
import {
  Select as AriaSelect,
  Button,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  SelectValue,
} from "react-aria-components";
import { cn } from "../../lib/cn";

export interface SelectItem {
  id: string;
  label: string;
}

export interface SelectProps {
  label?: string;
  items: SelectItem[];
  selectedKey: string | null;
  onSelectionChange: (key: string) => void;
  isDisabled?: boolean;
  isRequired?: boolean;
  name?: string;
  placeholder?: string;
  className?: string;
}

export function Select({
  label,
  items,
  selectedKey,
  onSelectionChange,
  isDisabled,
  isRequired,
  name,
  placeholder = "Select an option",
  className,
}: SelectProps) {
  const empty = items.length === 0;

  return (
    <AriaSelect
      selectedKey={selectedKey}
      onSelectionChange={(key: Key | null) => {
        if (key !== null) onSelectionChange(key as string);
      }}
      isDisabled={isDisabled || empty}
      isRequired={isRequired}
      name={name}
      placeholder={empty ? "No options available" : placeholder}
      className={cn("group", className)}
    >
      {label ? <Label className="mb-2 block label-style">{label}</Label> : null}
      <Button
        className={cn(
          "flex w-full cursor-pointer items-center justify-between border border-border bg-background px-4 py-3 text-sm text-foreground shadow-elevated",
          "hovered:bg-muted",
          "data-[focused]:border-ring data-[focused]:ring-2 data-[focused]:ring-ring data-[focused]:ring-offset-2 data-[focused]:ring-offset-background",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        <SelectValue className="truncate data-[placeholder]:text-faint" />
        <svg
          className="size-4 shrink-0 text-muted-foreground"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M8 11L3 6h10l-5 5z" />
        </svg>
      </Button>
      <Popover
        shouldFlip
        className={cn(
          "w-[var(--trigger-width)] overflow-y-auto border border-border bg-popover shadow-popover",
          "data-[placement=bottom]:origin-top data-[placement=top]:origin-bottom",
          "entering:animate-in entering:fade-in-0 entering:zoom-in-95",
          "exiting:animate-out exiting:fade-out-0 exiting:zoom-out-95",
        )}
      >
        <ListBox items={items} className="max-h-60 overflow-y-auto p-1">
          {(item) => (
            <ListBoxItem
              id={item.id}
              textValue={item.label}
              className={cn(
                "cursor-pointer px-3 py-2 text-sm text-foreground outline-none",
                "hover:bg-popover-hover hovered:bg-popover-hover data-[focused]:bg-popover-hover",
                "selected:bg-popover-selected selected:font-medium",
              )}
            >
              {item.label}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </AriaSelect>
  );
}
