import { Star } from "lucide-react";
import {
  Button as AriaButton,
  Input,
  Label,
  SearchField,
  ToggleButton,
} from "react-aria-components";
import { SegmentedControl } from "../../../components/molecules/SegmentedControl";
import { SortSelect } from "../../../components/molecules/SortSelect";
import { inputStyles } from "../../../lib/styles/input";

const SOURCE_ITEMS = [
  { id: "all", label: "All" },
  { id: "uploaded", label: "Clone" },
  { id: "designed", label: "Designed" },
];

const SORT_OPTIONS = [
  { id: "created_at:desc", label: "↓ Date" },
  { id: "created_at:asc", label: "↑ Date" },
  { id: "name:desc", label: "↓ Name" },
  { id: "name:asc", label: "↑ Name" },
  { id: "generation_count:desc", label: "↓ Usage" },
  { id: "generation_count:asc", label: "↑ Usage" },
];

export interface VoiceFilterBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  source: "all" | "uploaded" | "designed";
  onSourceChange: (value: "all" | "uploaded" | "designed") => void;
  sort: string;
  sortDir: "asc" | "desc";
  onSortChange: (sort: string, dir: "asc" | "desc") => void;
  favorites: "all" | "true";
  onFavoritesChange: (value: "all" | "true") => void;
}

export function VoiceFilterBar({
  query,
  onQueryChange,
  source,
  onSourceChange,
  sort,
  sortDir,
  onSortChange,
  favorites,
  onFavoritesChange,
}: VoiceFilterBarProps) {
  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <SearchField
          value={query}
          onChange={onQueryChange}
          aria-label="Search voices"
          className="group relative min-w-48 flex-1"
        >
          <Label className="mb-2 block label-style">Search</Label>
          <Input
            autoComplete="off"
            placeholder="Search voices..."
            className={inputStyles({ className: "pr-9 [&::-webkit-search-cancel-button]:hidden" })}
          />
          <AriaButton className="absolute right-2 top-[38px] flex h-6 w-6 items-center justify-center text-muted-foreground data-[hovered]:text-foreground data-[pressed]:text-foreground group-data-[empty]:hidden">
            ×
          </AriaButton>
        </SearchField>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SortSelect
          items={SORT_OPTIONS}
          selectedKey={`${sort}:${sortDir}`}
          onSelectionChange={(key) => {
            const [s, d] = key.split(":");
            onSortChange(s, d as "asc" | "desc");
          }}
          aria-label="Sort voices"
          placeholder="Sort by"
        />
        <SegmentedControl
          items={SOURCE_ITEMS}
          selectedKey={source}
          onSelectionChange={(key) => onSourceChange(key as "all" | "uploaded" | "designed")}
          aria-label="Source filter"
        />
        <div className="ml-auto">
          <ToggleButton
            isSelected={favorites === "true"}
            onChange={(isSelected) => onFavoritesChange(isSelected ? "true" : "all")}
            aria-label={favorites === "true" ? "Show all voices" : "Show favorites only"}
            className={({ isSelected }) =>
              `flex min-h-[30px] items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold tracking-wide transition-colors press-scale-sm ${
                isSelected
                  ? "border-foreground bg-foreground text-background data-[hovered]:bg-foreground/80 data-[pressed]:bg-foreground/80"
                  : "border-border text-muted-foreground data-[hovered]:bg-muted data-[hovered]:text-foreground data-[pressed]:bg-muted data-[pressed]:text-foreground"
              }`
            }
          >
            {({ isSelected }) => (
              <>
                <Star size={12} className={isSelected ? "fill-current" : ""} />
                <span className="hidden sm:inline">Favorites</span>
              </>
            )}
          </ToggleButton>
        </div>
      </div>
    </>
  );
}
