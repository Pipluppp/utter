import { ChevronDown } from "lucide-react";
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
import { selectRecipe } from "./Select";

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
  popoverClassName?: string;
  size?: "default" | "compact";
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
  popoverClassName,
  size = "default",
}: AutocompleteSelectProps<T>) {
  const empty = items.length === 0;
  const { contains } = useFilter({ sensitivity: "base" });
  const styles = selectRecipe();
  const compact = size === "compact";

  return (
    <Select
      selectedKey={selectedKey}
      onSelectionChange={(key: Key | null) => {
        if (key !== null) onSelectionChange(key as string);
      }}
      isDisabled={isDisabled || empty}
      placeholder={empty ? "No options available" : placeholder}
      className={styles.root({ className })}
    >
      {label ? <Label className="mb-2 block label-style">{label}</Label> : null}
      <Button
        className={
          compact
            ? "flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground hover:border-muted-foreground data-[focused]:border-muted-foreground"
            : styles.trigger()
        }
      >
        <SelectValue
          className={
            compact
              ? "truncate data-[placeholder]:text-muted-foreground"
              : styles.value({ className: "font-[family-name:var(--font-mono)]" })
          }
        />
        <ChevronDown
          size={compact ? 14 : 16}
          className={compact ? "shrink-0" : styles.icon()}
          aria-hidden="true"
        />
      </Button>
      <Popover
        shouldFlip
        className={
          compact
            ? "min-w-32 overflow-y-auto rounded-lg border border-border bg-popover shadow-popover data-[placement=bottom]:origin-top data-[placement=top]:origin-bottom entering:animate-in entering:fade-in-0 entering:zoom-in-95 exiting:animate-out exiting:fade-out-0 exiting:zoom-out-95 flex flex-col"
            : styles.popover({ className: `flex flex-col ${popoverClassName ?? ""}` })
        }
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
                className={
                  compact
                    ? "w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-faint focus:border-ring focus:outline-none"
                    : "w-full border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-faint focus:border-ring focus:outline-none"
                }
              />
            </SearchField>
            <ListBox
              items={items}
              renderEmptyState={() => (
                <div
                  className={
                    compact ? "px-2 py-1 text-xs text-faint" : "px-3 py-2 text-sm text-faint"
                  }
                >
                  No results.
                </div>
              )}
              className="max-h-60 overflow-y-auto p-1"
            >
              {(item) => (
                <ListBoxItem
                  id={item.id}
                  textValue={String(item[filterKey] ?? item.label)}
                  className={
                    compact
                      ? "cursor-default rounded-sm px-2 py-1 text-xs text-foreground outline-none press-scale-sm-y hover:bg-popover-hover hovered:bg-popover-hover data-[focused]:bg-popover-hover selected:font-medium"
                      : styles.item()
                  }
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
