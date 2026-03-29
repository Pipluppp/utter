import { Button as AriaButton, Input, Label, SearchField } from "react-aria-components";
import type { AutocompleteSelectItem } from "../../../components/molecules/AutocompleteSelect";
import { AutocompleteSelect } from "../../../components/molecules/AutocompleteSelect";
import { SortSelect } from "../../../components/molecules/SortSelect";
import { inputStyles } from "../../../lib/styles/input";

const STATUS_ITEMS: AutocompleteSelectItem[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "processing", label: "Processing" },
  { id: "completed", label: "Completed" },
  { id: "failed", label: "Failed" },
  { id: "cancelled", label: "Cancelled" },
];

const SORT_OPTIONS = [
  { id: "created_at:desc", label: "↓ Date" },
  { id: "created_at:asc", label: "↑ Date" },
  { id: "duration_seconds:desc", label: "↓ Duration" },
  { id: "duration_seconds:asc", label: "↑ Duration" },
  { id: "voice_name:desc", label: "↓ Name" },
  { id: "voice_name:asc", label: "↑ Name" },
];

export interface HistoryFilterBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  voiceId: string;
  voiceItems: AutocompleteSelectItem[];
  onVoiceIdChange: (value: string) => void;
  sort: string;
  sortDir: "asc" | "desc";
  onSortChange: (sort: string, dir: "asc" | "desc") => void;
}

export function HistoryFilterBar({
  query,
  onQueryChange,
  status,
  onStatusChange,
  voiceId,
  voiceItems,
  onVoiceIdChange,
  sort,
  sortDir,
  onSortChange,
}: HistoryFilterBarProps) {
  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <SearchField
          value={query}
          onChange={onQueryChange}
          aria-label="Search history"
          className="group relative min-w-48 flex-1"
        >
          <Label className="mb-2 block label-style">Search</Label>
          <Input
            autoComplete="off"
            placeholder="Search history..."
            className={inputStyles({
              className: "pr-9 [&::-webkit-search-cancel-button]:hidden",
            })}
          />
          <AriaButton className="absolute right-2 top-[38px] flex h-6 w-6 items-center justify-center text-muted-foreground data-[hovered]:text-foreground data-[pressed]:text-foreground group-data-[empty]:hidden">
            ×
          </AriaButton>
        </SearchField>
        <AutocompleteSelect
          label="Status"
          items={STATUS_ITEMS}
          selectedKey={status}
          onSelectionChange={onStatusChange}
          searchLabel="Search statuses"
          searchPlaceholder="Search..."
          popoverClassName="min-w-36"
        >
          {(item) => item.label}
        </AutocompleteSelect>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SortSelect
          items={SORT_OPTIONS}
          selectedKey={`${sort}:${sortDir}`}
          onSelectionChange={(key) => {
            const [s, d] = key.split(":");
            onSortChange(s, d as "asc" | "desc");
          }}
          aria-label="Sort history"
          placeholder="Sort by"
        />
        <AutocompleteSelect
          items={voiceItems}
          selectedKey={voiceId}
          onSelectionChange={onVoiceIdChange}
          searchLabel="Search voices"
          searchPlaceholder="Search..."
          size="compact"
          placeholder="All Voices"
        >
          {(item) => item.label}
        </AutocompleteSelect>
      </div>
    </>
  );
}
