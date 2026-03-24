import type { Key } from "react-aria-components";
import {
  Autocomplete,
  Button,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  SearchField,
  Select,
  SelectValue,
  useFilter,
} from "react-aria-components";
import { cn } from "../../lib/cn";

export interface AutocompleteSelectItem {
  id: string;
  label: string;
  [key: string]: unknown;
}

export interface AutocompleteSelectProps<T extends AutocompleteSelectItem> {
  label?: string;
  items: T[];
  selectedKey: string | null;
  onSelectionChange: (key: string) => void;
  placeholder?: string;
  filterKey?: keyof T & string;
  isDisabled?: boolean;
  children: (item: T) => React.ReactNode;
  searchLabel?: string;
  searchPlaceholder?: string;
  className?: string;
}

export function AutocompleteSelect<T extends AutocompleteSelectItem>({
  label,
  items,
  selectedKey,
  onSelectionChange,
  placeholder = "Select an option",
  filterKey = "label" as keyof T & string,
  isDisabled,
  children,
  searchLabel = "Search",
  searchPlaceholder = "Search...",
  className,
}: AutocompleteSelectProps<T>) {
  const empty = items.length === 0;
  const { contains } = useFilter({ sensitivity: "base" });

  return (
    <Select
      selectedKey={selectedKey}
      onSelectionChange={(key: Key | null) => {
        if (key !== null) onSelectionChange(key as string);
      }}
      isDisabled={isDisabled || empty}
      placeholder={empty ? "No options available" : placeholder}
      className={cn("group", className)}
    >
      {label ? (
        <Label className="mb-2 block text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </Label>
      ) : null}
      <Button
        className={cn(
          "flex w-full cursor-pointer items-center justify-between border border-border bg-background px-4 py-3 text-sm text-foreground shadow-elevated",
          "hovered:bg-muted",
          "data-[focused]:border-ring data-[focused]:ring-2 data-[focused]:ring-ring data-[focused]:ring-offset-2 data-[focused]:ring-offset-background",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        <SelectValue className="truncate font-[family-name:var(--font-mono)] data-[placeholder]:text-faint" />
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
          "flex w-[var(--trigger-width)] flex-col overflow-y-auto border border-border bg-background shadow-elevated",
          "entering:animate-in entering:fade-in-0 entering:zoom-in-95",
          "exiting:animate-out exiting:fade-out-0 exiting:zoom-out-95",
        )}
      >
        {/* biome-ignore lint/a11y/noStaticElementInteractions: trap single-char keys so global shortcuts don't fire */}
        <div
          className="flex flex-col"
          onKeyDown={(e: React.KeyboardEvent) => {
            if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key.length === 1) {
              e.stopPropagation();
            }
          }}
        >
          <Autocomplete filter={contains}>
            <SearchField autoFocus aria-label={searchLabel} className="p-1">
              <Input
                placeholder={searchPlaceholder}
                className="w-full border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-faint focus:border-ring focus:outline-none"
              />
            </SearchField>
            <ListBox
              items={items}
              renderEmptyState={() => (
                <div className="px-3 py-2 text-sm text-faint">No results.</div>
              )}
              className="max-h-60 overflow-y-auto p-1"
            >
              {(item) => (
                <ListBoxItem
                  id={item.id}
                  textValue={String(item[filterKey] ?? item.label)}
                  className={cn(
                    "cursor-pointer px-3 py-2 text-sm text-foreground outline-none",
                    "hover:bg-subtle data-[focused]:bg-subtle",
                    "selected:bg-muted selected:font-medium",
                  )}
                >
                  {children(item)}
                </ListBoxItem>
              )}
            </ListBox>
          </Autocomplete>
        </div>
      </Popover>
    </Select>
  );
}
